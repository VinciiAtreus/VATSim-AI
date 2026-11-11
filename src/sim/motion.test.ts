import { movementStep } from './motion'
import { decodeSession } from './sessionCodec'
import { sessionExport } from './engine'
import { describe, expect, it } from 'vitest'
import { spokenCallsign, applyTelephony } from './callsigns'
import { createSession, tick, transmit } from './engine'
import { METRES_PER_UNIT } from './geometry'
import { RUNWAYS } from './airport'
import { parseTransmission } from './parser'

describe('telephony and metric taxi timing', () => {
  it.each([
    ['MAS', 'Malaysian'],
    ['MXD', 'Malindo'],
    ['AXM', 'Redcap'],
    ['SIA', 'Singapore'],
  ])('uses %s / %s in lesson defaults and speech parsing', (icao, name) => {
    const spoken = spokenCallsign(`${icao}123`)!
    expect(spoken).toBe(`${name} one two three`)
    const a = { ...createSession().aircraft[0], id: `${icao}123`, spoken }
    expect(parseTransmission(`${spoken}, standby`, [a])).toEqual({
      ok: true,
      command: { type: 'standby', aircraftId: a.id },
    })
  })
  it.each(['MAS612', 'AXM518'])(
    'taxies %s for minutes, with equivalent exercise time at 1× and 4×',
    (id) => {
      const run = (speed: 1 | 4) => {
        let s = createSession()
        if (id === 'MAS612') {
          s = transmit(s, `${id}, pushback approved`, '121.650').session
          s = tick({ ...s, running: true }, 100)
        }
        const initial = s.aircraft.find((a) => a.id === id)!,
          r = RUNWAYS[initial.runway]
        s = transmit(
          s,
          `${id}, taxi runway ${initial.runway} via ${r.route}`,
          initial.frequency,
        ).session
        const a = s.aircraft.find((a) => a.id === id)!
        let distance = 0,
          p = a.position
        for (const next of a.route) {
          distance += Math.hypot(next.x - p.x, next.y - p.y) * METRES_PER_UNIT
          p = next
        }
        const start = s.time
        s = tick({ ...s, running: true, speed }, 10)
        const after10 = s.aircraft.find((a) => a.id === id)!
        expect(after10.phase).toBe('taxiing')
        expect(after10.speed).toBeLessThanOrEqual(15)
        let wallSeconds = 10
        while (s.aircraft.find((a) => a.id === id)!.phase === 'taxiing' && wallSeconds < 1000) {
          s = tick(s, 1)
          wallSeconds++
        }
        const final = s.aircraft.find((a) => a.id === id)!
        expect(final.phase).toBe('holding')
        expect(final.position).toEqual(r.hold)
        expect(s.time - start).toBeGreaterThan(distance / ((15 * 1852) / 3600))
        expect(s.time - start).toBeGreaterThan(120)
        console.info(
          `${id} at ${speed}x: ${Math.round(distance)} m, ${s.time - start} simulation seconds, ${wallSeconds} wall seconds`,
        )
        return s.time - start
      }
      expect(Math.abs(run(1) - run(4))).toBeLessThanOrEqual(4)
    },
  )
  it('accelerates smoothly and travels less than 80 m in the first ten taxi seconds', () => {
    let s = createSession()
    s = transmit(s, 'AXM518, taxi runway 33 via U5 Z Z8 Y Y9', '118.050').session
    const start = s.aircraft.find((a) => a.id === 'AXM518')!.position
    s = tick({ ...s, running: true }, 1)
    expect(s.aircraft.find((a) => a.id === 'AXM518')!.speed).toBeLessThan(2)
    s = tick(s, 9)
    const a = s.aircraft.find((a) => a.id === 'AXM518')!
    expect(
      Math.hypot(a.position.x - start.x, a.position.y - start.y) * METRES_PER_UNIT,
    ).toBeLessThan(80)
  })
  it('brakes ahead of a taxi turn without an instantaneous speed change', () => {
    const a = {
      ...createSession().aircraft[0],
      phase: 'taxiing' as const,
      speed: 15,
      position: { x: 8, y: 0 },
      route: [
        { x: 10, y: 0 },
        { x: 10, y: -10 },
      ],
      routeIndex: 0,
    }
    const next = movementStep(a, 1)
    expect(next.speed).toBeLessThan(15)
    expect(next.speed).toBeGreaterThan(13)
  })
  it('opens 0.5.0 checkpoints with corrected future telephony and unchanged historical snapshots', () => {
    const old = sessionExport(createSession())
    old.engineVersion = '0.5.0'
    const a = old.session.aircraft.find((a) => a.id === 'AXM518')!
    a.spoken = 'AirAsia five one eight'
    old.session.events[0].snapshot.find((a) => a.id === 'AXM518')!.spoken = a.spoken
    const original = JSON.stringify(old)
    const decoded = decodeSession(old)
    expect(decoded.migrated).toBe(true)
    expect(decoded.session.aircraft.find((a) => a.id === 'AXM518')!.spoken).toBe(
      'Redcap five one eight',
    )
    expect(decoded.session.events[0].snapshot.find((a) => a.id === 'AXM518')!.spoken).toBe(
      'AirAsia five one eight',
    )
    expect(JSON.stringify(old)).toBe(original)
  })
  it('preserves authored number pronunciation when correcting airline telephony', () => {
    expect(applyTelephony('MXD124', 'Batik one twenty four')).toBe('Malindo one twenty four')
    expect(applyTelephony('MAS612', 'Malaysian six twelve')).toBe('Malaysian six twelve')
  })
})
