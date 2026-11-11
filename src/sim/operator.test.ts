import { describe, expect, it } from 'vitest'
import {
  addObservation,
  createSession,
  instructorEvent,
  resolvePilotInstruction,
  sendPilotCall,
  sessionExport,
  setAircraftMotionPaused,
  setPilotMode,
  tick,
  transmit,
} from './engine'
import { decodeSession } from './sessionCodec'

function takeover() {
  return setPilotMode({ ...createSession(), running: true }, 'MAS612', 'operator')
}

describe('instructor pseudo-pilot control', () => {
  it('does not consume a scripted readback injection during manual execution', () => {
    let s = setPilotMode({ ...createSession('readback'), running: true }, 'MAS612', 'operator')
    s = transmit(s, 'MAS612, pushback approved', '121.650').session
    s = tick(resolvePilotInstruction(s, 'MAS612', true).session, 150)
    s = transmit(s, 'MAS612, taxi runway 32R via T2 T3 F1 G B9 A A11', '121.650').session
    s = resolvePilotInstruction(s, 'MAS612', true).session
    expect(s.injectReadback).toBe(true)
    expect(s.aircraft[0].phase).toBe('taxiing')
    expect(s.aircraft[0].discrepancy).toBeUndefined()
    expect(decodeSession(sessionExport(s)).session.aircraft[0].phase).toBe('taxiing')
  })
  it('does not apply a landing instruction that has expired after an automatic go-around', () => {
    let s = setPilotMode({ ...createSession(), running: true }, 'MAS1134', 'operator')
    s = transmit(s, 'MAS1134, runway 32L cleared to land', '118.500').session
    s = tick(s, 80)
    expect(s.aircraft[2].phase).toBe('going-around')
    const result = resolvePilotInstruction(s, 'MAS1134', true)
    expect(result.error).toMatch(/arrival on final/)
    expect(result.session.accepted).toBe(0)
    expect(result.session.aircraft[2].landingCleared).toBe(false)
    expect(decodeSession(sessionExport(result.session)).session.aircraft[2].phase).toBe(
      'going-around',
    )
  })
  it('queues a trainee instruction without applying movement or inventing a readback', () => {
    const original = takeover()
    const s = transmit(original, 'MAS612, pushback approved', '121.650').session
    expect(s.aircraft[0].phase).toBe('parked')
    expect(s.aircraft[0].queuedInstruction?.text).toBe('MAS612, pushback approved')
    expect(s.attempted).toBe(1)
    expect(s.accepted).toBe(0)
    expect(s.events.at(-1)?.kind).toBe('operator')
    expect(original.aircraft[0].queuedInstruction).toBeUndefined()
    const applied = resolvePilotInstruction(s, 'MAS612', true).session
    expect(applied.aircraft[0].phase).toBe('pushback')
    expect(applied.aircraft[0].queuedInstruction).toBeUndefined()
    expect(applied.attempted).toBe(1)
    expect(applied.accepted).toBe(1)
    expect(applied.events.at(-1)).toMatchObject({ kind: 'pilot', source: 'operator' })
    expect(resolvePilotInstruction(applied, 'MAS612', true).error).toMatch(/No instruction/)
  })
  it('does not queue wrong-frequency or invalid-phase instructions', () => {
    const s = takeover()
    expect(transmit(s, 'MAS612, pushback approved', '118.800').error).toMatch(/No response/)
    const result = transmit(s, 'MAS612, runway 32R cleared for takeoff', '121.650')
    expect(result.error).toMatch(/lined up/)
    expect(result.session.aircraft[0].queuedInstruction).toBeUndefined()
  })
  it('declines and replaces instructions with an explicit audit trail', () => {
    let s = transmit(takeover(), 'MAS612, pushback approved', '121.650').session
    const firstId = s.aircraft[0].queuedInstruction!.eventId
    s = transmit(s, 'MAS612, standby', '121.650').session
    expect(s.events.at(-1)?.text).toContain(`Replaces unexecuted instruction #${firstId}`)
    s = resolvePilotInstruction(s, 'MAS612', false).session
    expect(s.aircraft[0].phase).toBe('parked')
    expect(s.aircraft[0].clearance).toBe('Awaiting instructions')
    expect(s.aircraft[0].queuedInstruction).toBeUndefined()
    expect(s.accepted).toBe(0)
    expect(s.events.at(-1)).toMatchObject({
      kind: 'pilot',
      source: 'operator',
      text: 'Unable, Malaysian six one two.',
    })
  })
  it('revalidates a delayed landing instruction against a newly occupied runway', () => {
    let s = setPilotMode({ ...createSession(), running: true }, 'MAS1134', 'operator')
    s = transmit(s, 'MAS1134, runway 32L cleared to land', '118.500').session
    s = instructorEvent(s, 'obstruction', '32L')
    const result = resolvePilotInstruction(s, 'MAS1134', true)
    expect(result.error).toMatch(/runway occupied/)
    expect(result.session.aircraft[2].landingCleared).toBe(false)
    expect(result.session.aircraft[2].queuedInstruction).toBeDefined()
    s = instructorEvent(result.session, 'obstruction', '32L')
    s = resolvePilotInstruction(s, 'MAS1134', true).session
    expect(s.aircraft[2].landingCleared).toBe(true)
  })
  it('keeps a frozen runway occupied while other traffic moves', () => {
    let s = takeover()
    s = {
      ...s,
      aircraft: s.aircraft.map((a) =>
        a.id === 'MAS612'
          ? { ...a, phase: 'lining-up' as const, runwayOccupied: true, route: [{ x: 925, y: 600 }] }
          : a,
      ),
    }
    s = setAircraftMotionPaused(s, 'MAS612', true)
    const position = { ...s.aircraft[0].position }
    const arrivalY = s.aircraft[2].position.y
    const advanced = tick(s, 10)
    expect(advanced.aircraft[0].position).toEqual(position)
    expect(advanced.aircraft[0].speed).toBe(0)
    expect(advanced.aircraft[0].runwayOccupied).toBe(true)
    expect(advanced.aircraft[2].position.y).toBeLessThan(arrivalY)
    s = tick(setAircraftMotionPaused(advanced, 'MAS612', false), 10)
    expect(s.aircraft[0].position).not.toEqual(position)
    expect(advanced.events.at(-1)?.snapshot[0].position).toEqual(position)
  })
  it('suppresses routine scripted reports but retains automatic arrival decisions', () => {
    let s = setPilotMode({ ...createSession(), running: true }, 'MAS1134', 'operator')
    const pilotCount = s.events.filter((e) => e.kind === 'pilot').length
    s = tick(s, 80)
    expect(s.aircraft[2].phase).toBe('going-around')
    expect(s.events.filter((e) => e.kind === 'pilot')).toHaveLength(pilotCount)
    expect(s.events.some((e) => e.kind === 'system' && e.text.includes('pilot report due'))).toBe(
      true,
    )
    expect(
      s.events.some((e) => e.severity === 'critical' && e.text.includes('automatic go-around')),
    ).toBe(true)
  })
  it('sends bounded operator radio dialogue without applying embedded instructions', () => {
    const s = takeover()
    const result = sendPilotCall(s, 'MAS612', 'MAS612, pushback approved')
    expect(result.session.aircraft).toEqual(s.aircraft)
    expect(result.session.attempted).toBe(0)
    expect(result.session.events.at(-1)).toMatchObject({
      kind: 'pilot',
      source: 'operator',
      frequency: '121.650',
    })
    expect(sendPilotCall(s, 'MAS612', 'x'.repeat(1001)).session).toBe(s)
    expect(sendPilotCall(s, 'MXD124', 'Test').error).toMatch(/Take over/)
    expect(sendPilotCall({ ...s, running: false }, 'MAS612', 'Test').error).toMatch(/Resume/)
  })
  it('cancels pending work and releases motion when returning to a scripted pilot', () => {
    let s = transmit(takeover(), 'MAS612, pushback approved', '121.650').session
    s = setAircraftMotionPaused(s, 'MAS612', true)
    s = setPilotMode(s, 'MAS612', 'scripted')
    expect(s.aircraft[0]).toMatchObject({
      pilotMode: 'scripted',
      motionPaused: false,
      phase: 'parked',
    })
    expect(s.aircraft[0].queuedInstruction).toBeUndefined()
    expect(s.events.at(-1)?.text).toMatch(/cancelled/)
    expect(transmit(s, 'MAS612, pushback approved', '121.650').session.aircraft[0].phase).toBe(
      'pushback',
    )
  })
  it('preserves event-linked notes and takeover state through export and recovery', () => {
    let s = transmit(takeover(), 'MAS612, pushback approved', '121.650').session
    const target = s.aircraft[0].queuedInstruction!.eventId
    s = addObservation(tick(s, 5), target, 'Review the clearance timing.', 'attention').session
    expect(s.events.at(-1)).toMatchObject({
      kind: 'note',
      relatedEventId: target,
      time: 5,
      aircraftId: 'MAS612',
    })
    const decoded = decodeSession(sessionExport(s)).session
    expect(decoded).toEqual({ ...s, running: false })
    expect(decoded.events.find((e) => e.id === target)?.time).toBe(0)
    expect(addObservation(s, 9999, 'Missing target', 'info').error).toBeDefined()
    expect(addObservation(s, s.events.at(-1)!.id, 'Nested note', 'info').error).toBeDefined()
    expect(addObservation(s, target, 'x'.repeat(1001), 'info').session).toBe(s)
  })
})
