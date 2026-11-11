import { STANDS } from './geometry'
import { describe, expect, it } from 'vitest'
import {
  addObservation,
  createSession,
  sessionExport,
  setPilotMode,
  tick,
  transmit,
} from './engine'
import { decodeSession, forkSession, parseSessionFile } from './sessionCodec'

function fixture() {
  return JSON.parse(JSON.stringify(sessionExport(createSession())))
}

describe('session interchange', () => {
  it('migrates version 0.2 checkpoints and snapshots without losing their identity or history', () => {
    const data = fixture()
    data.schema = 'vatsim-ai.session.v2'
    data.engineVersion = '0.2.0'
    data.session.version = 2
    const clean = (a: Record<string, unknown>) => {
      delete a.pilotMode
      delete a.motionPaused
      delete a.queuedInstruction
    }
    data.session.aircraft.forEach(clean)
    data.session.events.forEach((e: { source?: string; snapshot: Record<string, unknown>[] }) => {
      delete e.source
      e.snapshot.forEach(clean)
    })
    const decoded = decodeSession(data, 'checkpoint')
    expect(decoded.migrated).toBe(true)
    expect(decoded.session.id).toBe(data.session.id)
    expect(decoded.session.events).toHaveLength(data.session.events.length)
    expect(
      decoded.session.aircraft.every((a) => a.pilotMode === 'scripted' && !a.motionPaused),
    ).toBe(true)
    expect(decoded.session.events[1].source).toBe('scripted')
    expect(decoded.session.events[0].snapshot[0].pilotMode).toBe('scripted')
  })
  it.each([
    'foreign-queue',
    'missing-transmission',
    'future-link',
    'missing-source',
    'invalid-mode',
    'scripted-freeze',
  ])('rejects invalid instructor state: %s', (corruption) => {
    let s = setPilotMode(createSession(), 'MAS612', 'operator')
    s = transmit(s, 'MAS612, pushback approved', '121.650').session
    s = addObservation(s, 1, 'Review event', 'info').session
    const data = JSON.parse(JSON.stringify(sessionExport(s)))
    if (corruption === 'foreign-queue')
      data.session.aircraft[0].queuedInstruction.text = 'MXD124, pushback approved'
    if (corruption === 'missing-transmission')
      data.session.aircraft[0].queuedInstruction.eventId = 9999
    if (corruption === 'future-link') data.session.events.at(-1).relatedEventId = 9999
    if (corruption === 'missing-source') delete data.session.events[1].source
    if (corruption === 'invalid-mode') data.session.aircraft[0].pilotMode = 'external'
    if (corruption === 'scripted-freeze') {
      data.session.aircraft[1].pilotMode = 'scripted'
      data.session.aircraft[1].motionPaused = true
    }
    expect(() => decodeSession(data)).toThrow(/Cannot open session/)
  })
  it('recovers long local checkpoints while retaining the file-import history limit', () => {
    let s = createSession('departure')
    for (let i = 0; i < 1250; i++) s = transmit(s, 'MAS612, standby', '121.650').session
    const data = sessionExport(s)
    expect(data.session.events.length).toBeGreaterThan(2500)
    expect(() => decodeSession(data)).toThrow(/2,500/)
    expect(decodeSession(data, 'checkpoint').session.events).toHaveLength(s.events.length)
  })
  it('rejects oversized transmissions without creating an unreadable checkpoint', () => {
    const result = transmit(createSession(), `MAS612, ${'x'.repeat(5000)}`, '121.650')
    expect(result.error).toMatch(/1,000/)
    expect(() => decodeSession(sessionExport(result.session))).not.toThrow()
    expect(result.session.attempted).toBe(0)
    expect(result.session.events.at(-1)?.kind).toBe('instructor')
  })
  it('round-trips current state, historical snapshots, and pending discrepancies', () => {
    let s = createSession('readback')
    s = transmit(s, 'MAS612, pushback approved', '121.650').session
    s = tick({ ...s, running: true }, 150)
    s = transmit(s, 'MAS612, taxi runway 32R via T2 T3 F1 G B9 A A11', '121.650').session
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
    expect(restored.session.version).toBe(4)
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
    expect(s.aircraft[0].position.x).toBe(STANDS.B6.x)
    expect(s.events[0].snapshot[0].position.x).toBe(STANDS.B6.x)
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
