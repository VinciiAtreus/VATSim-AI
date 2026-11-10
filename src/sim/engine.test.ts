import { describe, expect, it } from 'vitest'
import { createSession, instructorEvent, sessionExport, tick, transmit } from './engine'
import { parseTransmission } from './parser'
import type { Frequency, Session } from './types'

function send(s: Session, text: string, frequency: Frequency = '121.650') {
  const result = transmit(s, text, frequency)
  expect(result.error, text).toBeUndefined()
  return result.session
}
function advance(s: Session, seconds: number) {
  return tick({ ...s, running: true }, seconds)
}
function atHoldingPoint(s = createSession('departure')) {
  s = send(s, 'MAS612, pushback approved')
  s = advance(s, 35)
  s = send(s, 'MAS612, taxi runway 32R via A, hold short runway 32R')
  return advance(s, 140)
}
function linedUp(s = atHoldingPoint()) {
  s = send(s, 'MAS612, contact Lumpur Tower 118.800')
  s = send(s, 'MAS612, runway 32R, line up and wait', '118.800')
  return advance(s, 25)
}

describe('radio interpretation', () => {
  it('normalises spoken callsigns, runway numbers, and phonetic taxiways', () => {
    expect(
      parseTransmission(
        'Malaysian six one two, taxi runway three two right via Alpha, hold short runway three two right.',
        createSession().aircraft,
      ),
    ).toEqual({
      ok: true,
      command: { type: 'taxi', aircraftId: 'MAS612', runway: '32R', via: 'A' },
    })
  })
  it('preserves decimal frequencies and normalises short precision', () => {
    expect(
      parseTransmission('MAS612, contact Lumpur Tower 118.8.', createSession().aircraft),
    ).toEqual({
      ok: true,
      command: { type: 'handoff', aircraftId: 'MAS612', frequency: '118.800' },
    })
  })
  it.each([
    'taxi runway 32R via A',
    'MAS9999, standby',
    'MAS612 AXM518 standby',
    'MAS612, taxi runway 32R via A, hold short runway 32L',
    'MAS612, contact Ground 118.800',
    'MAS612, runway 32R cleared for takeoff and turn left heading 180',
  ])('does not invent a command from ambiguous or unsupported input: %s', (input) => {
    expect(parseTransmission(input, createSession().aircraft).ok).toBe(false)
  })
})

describe('departure workflow', () => {
  it('completes stand → pushback → taxi → tower → line up → departure', () => {
    let s = atHoldingPoint()
    expect(s.aircraft[0].phase).toBe('holding')
    expect(s.aircraft[0].position).toEqual({ x: 870, y: 600 })
    s = linedUp(s)
    expect(s.aircraft[0].phase).toBe('lined-up')
    expect(s.aircraft[0].runwayOccupied).toBe(true)
    s = send(s, 'MAS612, runway 32R cleared for takeoff', '118.800')
    s = advance(s, 30)
    expect(s.aircraft[0].phase).toBe('complete')
    expect(s.aircraft[0].runwayOccupied).toBe(false)
    expect(s.completed).toBe(1)
  })
  it('does not taxi an aircraft that has not completed pushback', () => {
    const s = createSession()
    const result = transmit(s, 'MAS612, taxi runway 32R via A', '121.650')
    expect(result.error).toMatch(/pushback/)
    expect(result.session.aircraft).toEqual(s.aircraft)
    expect(result.session.accepted).toBe(0)
  })
  it('requires correct frequency and correct handoff position', () => {
    const s = createSession()
    expect(transmit(s, 'MAS612, pushback approved', '118.800').error).toMatch(/121.650/)
    expect(transmit(s, 'MAS612, contact Lumpur Tower 118.800', '121.650').error).toMatch(
      /holding short/,
    )
  })
  it('does not begin departure while the aircraft is still lining up', () => {
    let s = atHoldingPoint()
    s = send(s, 'MAS612, contact Tower 118.800')
    const position = { ...s.aircraft[0].position }
    s = send(s, 'MAS612, runway 32R line up and wait', '118.800')
    expect(s.aircraft[0].position).toEqual(position)
    expect(s.aircraft[0].phase).toBe('lining-up')
    expect(transmit(s, 'MAS612, runway 32R cleared for takeoff', '118.800').error).toMatch(
      /lined up/,
    )
  })
  it('holds position without losing the assigned runway and can resume taxi', () => {
    let s = send(createSession(), 'MAS612, pushback approved')
    s = advance(s, 35)
    s = send(s, 'MAS612, taxi runway 32R via A')
    s = advance(s, 10)
    s = send(s, 'MAS612, hold position')
    const position = { ...s.aircraft[0].position }
    s = advance(s, 20)
    expect(s.aircraft[0].position).toEqual(position)
    s = send(s, 'MAS612, taxi runway 32R via A')
    s = advance(s, 140)
    expect(s.aircraft[0].phase).toBe('holding')
  })
})

describe('arrival workflow', () => {
  it('progresses toward the runway without occupying it before touchdown', () => {
    const start = createSession()
    const s = advance(start, 20)
    const arrival = s.aircraft.find((a) => a.id === 'MAS1134')!
    expect(arrival.position.y).toBe(750)
    expect(arrival.phase).toBe('final')
    expect(arrival.runwayOccupied).toBe(false)
  })
  it('calls short final once and goes around at the exercise decision point without clearance', () => {
    let s = advance(createSession(), 60)
    expect(s.events.filter((e) => e.text.includes('short final runway'))).toHaveLength(1)
    s = advance(s, 15)
    expect(s.aircraft.find((a) => a.id === 'MAS1134')!.phase).toBe('going-around')
    expect(s.events.some((e) => e.text.includes('landing clearance not received'))).toBe(true)
    expect(s.events.filter((e) => e.text.includes('short final runway'))).toHaveLength(1)
  })
  it('keeps landing clearance separate from runway occupancy and records touchdown', () => {
    let s = send(createSession(), 'MAS1134, runway 32L cleared to land', '118.500')
    expect(s.aircraft.find((a) => a.id === 'MAS1134')!).toMatchObject({
      phase: 'final',
      landingCleared: true,
      runwayOccupied: false,
    })
    s = advance(s, 90)
    expect(s.aircraft.find((a) => a.id === 'MAS1134')!).toMatchObject({
      phase: 'landing',
      runwayOccupied: true,
    })
    expect(s.events.some((e) => e.text.includes('touchdown on runway 32L'))).toBe(true)
  })
  it('goes around if a cleared arrival encounters an obstructed runway', () => {
    let s = send(createSession(), 'MAS1134, runway 32L cleared to land', '118.500')
    s = instructorEvent(s, 'obstruction', '32L')
    s = advance(s, 75)
    expect(s.aircraft.find((a) => a.id === 'MAS1134')!).toMatchObject({
      phase: 'going-around',
      runwayOccupied: false,
      landingCleared: false,
    })
    expect(s.events.some((e) => e.text.includes('runway 32L occupied'))).toBe(true)
  })
  it('does not skip an automatic go-around at 4× or during a large tick', () => {
    const s = tick({ ...createSession(), running: true, speed: 4 }, 30)
    expect(s.aircraft.find((a) => a.id === 'MAS1134')!.phase).toBe('complete')
    expect(s.events.some((e) => e.text.includes('automatic go-around'))).toBe(true)
    expect(s.events.some((e) => e.text.includes('touchdown'))).toBe(false)
  })
  it('lands, vacates, changes frequency, and taxis to the assigned stand', () => {
    let s = createSession()
    s = send(s, 'MAS1134, runway 32L cleared to land', '118.500')
    expect(s.aircraft.find((a) => a.id === 'MAS1134')!.runwayOccupied).toBe(false)
    expect(s.aircraft.find((a) => a.id === 'MAS1134')!.landingCleared).toBe(true)
    s = advance(s, 120)
    const arrival = () => s.aircraft.find((a) => a.id === 'MAS1134')!
    expect(arrival().phase).toBe('vacated')
    expect(arrival().runwayOccupied).toBe(false)
    s = send(s, 'MAS1134, contact Ground 121.650', '118.500')
    s = send(s, 'MAS1134, taxi to stand B10 via C')
    s = advance(s, 100)
    expect(arrival().phase).toBe('complete')
    expect(s.completed).toBe(1)
  })
  it('goes around without recording an arrival at the stand', () => {
    let s = send(createSession(), 'MAS1134, go around', '118.500')
    s = advance(s, 40)
    expect(s.events.at(-1)?.text).toMatch(/go-around complete/)
    expect(s.aircraft.find((a) => a.id === 'MAS1134')!.runwayOccupied).toBe(false)
  })
})

describe('instructor scenarios and evidence', () => {
  it('requires correction after a seeded readback error and preserves the issued runway', () => {
    let s = send(createSession('readback'), 'MAS612, pushback approved')
    s = advance(s, 35)
    s = send(s, 'MAS612, taxi runway 32R via A')
    expect(s.aircraft[0].runway).toBe('32R')
    expect(s.aircraft[0].discrepancy).toEqual({ issued: '32R', readback: '32L' })
    expect(s.aircraft[0].phase).toBe('stopped')
    expect(transmit(s, 'MAS612, taxi runway 32R via A', '121.650').error).toMatch(/discrepancy/)
    s = send(s, 'MAS612, negative, I say again runway 32R')
    expect(s.aircraft[0].discrepancy).toBeUndefined()
    expect(s.aircraft[0].phase).toBe('taxiing')
    expect(s.events.some((e) => e.severity === 'critical')).toBe(true)
  })
  it('blocks occupied-runway clearances when training guards are enabled', () => {
    let s = atHoldingPoint()
    s = send(s, 'MAS612, contact Tower 118.800')
    s = instructorEvent(s, 'obstruction')
    expect(transmit(s, 'MAS612, runway 32R line up and wait', '118.800').error).toMatch(
      /runway occupied/,
    )
    expect(s.events.at(-1)?.blockedRunway).toBe('32R')
  })
  it('records an unsafe applied clearance when the instructor disables guards', () => {
    let s = linedUp()
    s = instructorEvent(s, 'guidance')
    s = instructorEvent(s, 'obstruction')
    s = send(s, 'MAS612, runway 32R cleared for takeoff', '118.800')
    expect(s.aircraft[0].phase).toBe('departing')
    expect(s.events.at(-1)?.severity).toBe('critical')
    expect(s.events.at(-1)?.text).toMatch(/clearance applied/)
  })
  it('does not mutate existing session state or historical snapshots', () => {
    const s = createSession()
    const before = JSON.stringify(s)
    const next = advance(send(s, 'MAS612, pushback approved'), 40)
    expect(JSON.stringify(s)).toBe(before)
    expect(next.events[0].snapshot[0].phase).toBe('parked')
    expect(next.aircraft[0].phase).toBe('ready')
  })
  it('pauses time and movement and applies simulation speed exactly', () => {
    const s = createSession()
    expect(tick(s, 60)).toBe(s)
    expect(tick({ ...s, running: true, speed: 4 }, 5).time).toBe(20)
    expect(tick({ ...s, running: true }, Number.NaN).time).toBe(0)
  })
  it('emits one unanswered-call observation per outstanding request', () => {
    let s = advance(createSession('departure'), 100)
    const count = s.events.filter((e) => e.kind === 'instructor').length
    s = advance(s, 100)
    expect(s.events.filter((e) => e.kind === 'instructor').length).toBe(count)
  })
  it('exports the full session, data version, and limitations without a running clock', () => {
    const exported = sessionExport({ ...createSession(), running: true })
    expect(exported.schema).toBe('vatsim-ai.session.v3')
    expect(exported.session.running).toBe(false)
    expect(exported.limitations).toContain('Illustrative geometry')
  })
})
