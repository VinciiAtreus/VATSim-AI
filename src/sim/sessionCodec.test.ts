import { describe, expect, it } from 'vitest'
import { createSession, sessionExport, tick, transmit } from './engine'
import { decodeSession, forkSession, parseSessionFile } from './sessionCodec'

function fixture() {
  return JSON.parse(JSON.stringify(sessionExport(createSession())))
}

describe('session interchange', () => {
  it('round-trips current state, historical snapshots, and pending discrepancies', () => {
    let s = createSession('readback')
    s = transmit(s, 'MAS612, pushback approved', '121.650').session
    s = tick({ ...s, running: true }, 35)
    s = transmit(s, 'MAS612, taxi runway 32R via A', '121.650').session
    const restored = parseSessionFile(JSON.stringify(sessionExport(s)))
    expect(restored.migrated).toBe(false)
    expect(restored.session).toEqual({ ...s, running: false })
    expect(restored.session.aircraft[0].discrepancy).toEqual({ issued: '32R', readback: '32L' })
    expect(restored.session.events[0].snapshot[0].phase).toBe('parked')
  })
  it('migrates a version 0.1 export and converts an airborne landing phase', () => {
    const data = fixture()
    data.schema = 'vatsim-ai.session.v1'
    data.session.version = 1
    delete data.engineVersion
    delete data.session.id
    const a = data.session.aircraft.find((a: { id: string }) => a.id === 'MAS1134')
    a.phase = 'landing'
    a.runwayOccupied = true
    delete a.landingCleared
    const restored = decodeSession(data)
    expect(restored.migrated).toBe(true)
    expect(restored.session.version).toBe(2)
    expect(restored.session.running).toBe(false)
    expect(restored.session.aircraft.find((a) => a.id === 'MAS1134')).toMatchObject({
      phase: 'final',
      landingCleared: true,
      runwayOccupied: false,
    })
  })
  it('forks a restored record without overwriting or sharing mutable aircraft state', () => {
    const s = createSession()
    const fork = forkSession(s)
    expect(fork.id).not.toBe(s.id)
    fork.aircraft[0].position.x = 999
    fork.events[0].snapshot[0].position.x = 999
    expect(s.aircraft[0].position.x).toBe(770)
    expect(s.events[0].snapshot[0].position.x).toBe(770)
  })
  it.each([
    [
      'unknown format',
      (d: ReturnType<typeof fixture>) => {
        d.schema = 'other-app'
      },
    ],
    [
      'future engine',
      (d: ReturnType<typeof fixture>) => {
        d.engineVersion = '99.0.0'
      },
    ],
    [
      'different airport dataset',
      (d: ReturnType<typeof fixture>) => {
        d.dataset = 'other-airport'
      },
    ],
    [
      'unknown scenario',
      (d: ReturnType<typeof fixture>) => {
        d.session.scenarioId = 'missing'
      },
    ],
    [
      'invalid session id',
      (d: ReturnType<typeof fixture>) => {
        d.session.id = '../anything'
      },
    ],
    [
      'unknown phase',
      (d: ReturnType<typeof fixture>) => {
        d.session.aircraft[0].phase = 'flying-now'
      },
    ],
    [
      'duplicate aircraft',
      (d: ReturnType<typeof fixture>) => {
        d.session.aircraft[1].id = d.session.aircraft[0].id
      },
    ],
    [
      'unsupported radio',
      (d: ReturnType<typeof fixture>) => {
        d.session.aircraft[0].frequency = '999.999'
      },
    ],
    [
      'non-finite position',
      (d: ReturnType<typeof fixture>) => {
        d.session.aircraft[0].position.x = Infinity
      },
    ],
    [
      'route index past end',
      (d: ReturnType<typeof fixture>) => {
        d.session.aircraft[0].routeIndex = 99
      },
    ],
    [
      'duplicate event',
      (d: ReturnType<typeof fixture>) => {
        d.session.events[1].id = 1
      },
    ],
    [
      'future event time',
      (d: ReturnType<typeof fixture>) => {
        d.session.events[0].time = 100
      },
    ],
    [
      'invalid snapshot',
      (d: ReturnType<typeof fixture>) => {
        d.session.events[0].snapshot = []
      },
    ],
    [
      'inconsistent counters',
      (d: ReturnType<typeof fixture>) => {
        d.session.accepted = 10
      },
    ],
    [
      'invalid runway obstruction',
      (d: ReturnType<typeof fixture>) => {
        d.session.blockedRunway = '99'
      },
    ],
  ])('rejects %s before replacing a session', (_, corrupt) => {
    const data = fixture()
    corrupt(data)
    expect(() => decodeSession(data)).toThrow(/Cannot open session/)
  })
  it('rejects broken JSON, oversized input, and oversized histories', () => {
    expect(() => parseSessionFile('{broken')).toThrow(/not valid JSON/)
    expect(() => parseSessionFile(' '.repeat(10 * 1024 * 1024 + 1))).toThrow(/10 MB/)
    const data = fixture()
    data.session.events = Array.from({ length: 2501 }, () => data.session.events[0])
    expect(() => decodeSession(data)).toThrow(/2,500/)
  })
  it('drops unrecognised object properties instead of merging them into state', () => {
    const data = fixture()
    data.session.untrusted = 'discard'
    data.session.aircraft[0].untrusted = 'discard'
    const restored = decodeSession(data).session
    expect(restored).not.toHaveProperty('untrusted')
    expect(restored.aircraft[0]).not.toHaveProperty('untrusted')
  })
})
