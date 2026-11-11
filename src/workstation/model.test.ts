import { RUNWAYS } from '../sim/airport'
import { describe, expect, it } from 'vitest'
import { createSession, tick, transmit } from '../sim/engine'
import { parseTransmission } from '../sim/parser'
import { bayFor, safetyAlerts, stopBarOff } from './model'
import { placeLabels } from './labels'

describe('overhaul contracts', () => {
  it('EFS-05 moves a cleared departure into PUSH / START', () => {
    const s = createSession()
    expect(bayFor(s.aircraft[0])).toBe('STANDS')
    expect(bayFor(transmit(s, 'MAS612, pushback approved', '121.650').session.aircraft[0])).toBe(
      'PUSH / START',
    )
  })
  it('SMD-06 places twenty tightly clustered aircraft without overlapping labels', () => {
    const base = createSession().aircraft[0]
    const labels = placeLabels(
      Array.from({ length: 20 }, (_, i) => ({
        ...base,
        id: `MAS${600 + i}`,
        position: { x: 770 + (i % 4) * 2, y: 340 + Math.floor(i / 4) * 2 },
      })),
    )
    expect(labels).toHaveLength(20)
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i],
          b = labels[j]
        expect(
          a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y,
        ).toBe(false)
      }
  })
  it('ALT-01 clears on landing clearance, escalates inside 1.5 NM and freezes on pause', () => {
    let s = createSession()
    const a = s.aircraft.find((a) => a.operation === 'arrival')!
    a.position.y = RUNWAYS[a.runway].bottom + 100
    expect(safetyAlerts(s)[0].level).toBe('critical')
    expect(tick(s, 30)).toEqual(s)
    s = transmit(s, `${a.id}, runway 32L cleared to land`, a.frequency).session
    expect(safetyAlerts(s)).toEqual([])
  })
  it('SB-02 extinguishes the stopbar only during runway entry', () => {
    const s = createSession('departure')
    const a = s.aircraft[0]
    a.phase = 'holding'
    a.frequency = '118.800'
    a.position = { ...RUNWAYS[a.runway].hold }
    expect(stopBarOff(s.aircraft, '32R')).toBe(false)
    const next = transmit(s, 'MAS612 runway 32R line up and wait', '118.800').session
    expect(stopBarOff(next.aircraft, '32R')).toBe(true)
    expect(stopBarOff(tick({ ...next, running: true }, 150).aircraft, '32R')).toBe(false)
  })
  it.each([
    'Malaysian six one two, pushback and start-up approved',
    'Malaysian six one two, taxi to holding point Alpha One One, runway three two right, via Alpha',
    'Malaysian six one two, wind three two zero degrees fife knots, runway three two right, cleared for take-off',
    'Malaysian six one two, contact Lumpur Tower one one eight decimal eight',
  ])('PTT-22 parses the spoken catalogue: %s', (text) => {
    expect(parseTransmission(text, createSession().aircraft).ok).toBe(true)
  })
  it('rejects an incorrect holding point instead of ignoring it', () => {
    expect(
      parseTransmission(
        'MAS612 taxi to holding point Y1 runway 32R via A',
        createSession().aircraft,
      ).ok,
    ).toBe(false)
  })
})

describe('engine upgrade', () => {
  it('ENG-01 integrates the same 10 Hz steps across jittered frame intervals', () => {
    const s = { ...createSession('departure'), running: true }
    const one = tick(s, 1)
    let many = s
    for (let i = 0; i < 100; i++) many = tick(many, 0.01) as typeof many
    expect(many.time).toBe(one.time)
    expect(many.aircraft).toEqual(one.aircraft)
  })
  it('PTT-21 queries an impossible takeoff clearance without moving an aircraft', () => {
    const s = createSession()
    const next = transmit(s, 'MAS612 runway 32R cleared for takeoff', '121.650')
    expect(next.error).toBeDefined()
    expect(next.session.aircraft).toEqual(s.aircraft)
    expect(next.session.events.at(-1)?.text).toContain('Confirm instruction? We are at stand')
  })
  it('holding and continuing retains the aircraft route rather than rebuilding it', () => {
    let s = createSession('departure')
    s = transmit(s, 'MAS612 pushback approved', '121.650').session
    s = tick({ ...s, running: true }, 150)
    s = transmit(s, 'MAS612 taxi runway 32R via T2 T3 F1 G B9 A A11', '121.650').session
    const route = s.aircraft[0].route
    s = transmit(s, 'MAS612 hold position', '121.650').session
    const held = s.aircraft[0].position
    s = tick(s, 10)
    expect(s.aircraft[0].position).toEqual(held)
    s = transmit(s, 'MAS612 continue taxi', '121.650').session
    expect(s.aircraft[0].phase).toBe('taxiing')
    expect(s.aircraft[0].route).toEqual(route)
    s = tick(s, 1)
    expect(s.aircraft[0].position).not.toEqual(held)
  })
})
