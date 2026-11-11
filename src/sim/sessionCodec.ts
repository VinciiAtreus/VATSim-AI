import { AIRPORT_DATA, initialAircraft, RADIOS, RUNWAYS, SCENARIOS } from './airport'
import { copyAircraft } from './engine'
import { ENGINE_VERSION } from './version'
import { parseTransmission } from './parser'
import type { Aircraft, Session, SimEvent } from './types'

export const MAX_SESSION_BYTES = 10 * 1024 * 1024
export type DecodedSession = { session: Session; migrated: boolean }
const phases = new Set([
  'parked',
  'pushback',
  'ready',
  'taxiing',
  'stopped',
  'holding',
  'lining-up',
  'lined-up',
  'departing',
  'final',
  'landing',
  'vacated',
  'going-around',
  'complete',
])
const frequencies = new Set(RADIOS.map((r) => r.frequency as string))
type Obj = Record<string, unknown>
function object(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function finite(value: unknown, min = 0, max = 1e8): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}
function integer(value: unknown, max = 1e8): value is number {
  return finite(value, 0, max) && Number.isInteger(value)
}
function text(value: unknown, max = 120): value is string {
  return typeof value === 'string' && value.length <= max
}
function bool(value: unknown): value is boolean {
  return typeof value === 'boolean'
}
function runway(value: unknown): boolean {
  return typeof value === 'string' && Object.hasOwn(RUNWAYS, value)
}
function point(value: unknown): boolean {
  return object(value) && finite(value.x, -10000, 10000) && finite(value.y, -10000, 10000)
}
function fail(reason: string): never {
  throw new Error(`Cannot open session: ${reason}`)
}

function aircraft(value: unknown, expectedIds: string[], legacy: boolean): Aircraft {
  if (!object(value) || typeof value.id !== 'string' || !expectedIds.includes(value.id))
    fail('unknown aircraft identity.')
  const a = value
  if (
    !text(a.spoken) ||
    !text(a.stand, 12) ||
    !text(a.destination, 12) ||
    !text(a.clearance, 500) ||
    !['B738', 'A320', 'A333'].includes(a.type as string) ||
    !['M', 'H'].includes(a.wake as string) ||
    !['departure', 'arrival'].includes(a.operation as string) ||
    !phases.has(a.phase as string)
  )
    fail('invalid aircraft details or phase.')
  if (
    !point(a.position) ||
    !finite(a.heading, -360, 360) ||
    !finite(a.speed, 0, 600) ||
    !runway(a.runway) ||
    !frequencies.has(a.frequency as string) ||
    !Array.isArray(a.route) ||
    a.route.length > 128 ||
    !a.route.every(point) ||
    !integer(a.routeIndex, a.route.length)
  )
    fail('invalid movement, route, runway, or frequency.')
  if (
    !bool(a.pending) ||
    !finite(a.requestAt) ||
    !bool(a.overdueReported) ||
    !bool(a.holdReported) ||
    !bool(a.runwayOccupied) ||
    (a.landingCleared !== undefined && !bool(a.landingCleared)) ||
    (a.approachCallMade !== undefined && !bool(a.approachCallMade))
  )
    fail('invalid aircraft control state.')
  if (
    a.heldFrom !== undefined &&
    !['ready', 'pushback', 'taxiing', 'holding'].includes(a.heldFrom as string)
  )
    fail('invalid held state.')
  if (
    a.discrepancy !== undefined &&
    (!object(a.discrepancy) ||
      !runway(a.discrepancy.issued) ||
      !runway(a.discrepancy.readback) ||
      a.discrepancy.issued !== a.runway)
  )
    fail('invalid readback discrepancy.')
  if (
    !legacy &&
    (!['scripted', 'operator'].includes(a.pilotMode as string) ||
      !bool(a.motionPaused) ||
      (a.pilotMode === 'scripted' && (a.motionPaused || a.queuedInstruction !== undefined)))
  )
    fail('invalid pseudo-pilot state.')
  const q = !legacy ? a.queuedInstruction : undefined
  if (
    q !== undefined &&
    (!object(q) ||
      !integer(q.eventId) ||
      q.eventId < 1 ||
      !text(q.text, 1000) ||
      !q.text.trim() ||
      !frequencies.has(q.frequency as string))
  )
    fail('invalid queued instruction.')
  // Copy known fields only. Never spread arbitrary imported properties into application state.
  return {
    id: a.id as string,
    spoken: a.spoken,
    type: a.type as Aircraft['type'],
    wake: a.wake as Aircraft['wake'],
    stand: a.stand,
    destination: a.destination,
    operation: a.operation as Aircraft['operation'],
    phase: a.phase as Aircraft['phase'],
    heldFrom: a.heldFrom as Aircraft['heldFrom'],
    position: { x: (a.position as Obj).x as number, y: (a.position as Obj).y as number },
    heading: a.heading,
    speed: a.speed,
    runway: a.runway as Aircraft['runway'],
    frequency: a.frequency as Aircraft['frequency'],
    route: a.route.map((p) => ({ x: (p as Obj).x as number, y: (p as Obj).y as number })),
    routeIndex: a.routeIndex,
    clearance: a.clearance,
    pending: a.pending,
    requestAt: a.requestAt,
    overdueReported: a.overdueReported,
    holdReported: a.holdReported,
    runwayOccupied: a.runwayOccupied,
    discrepancy: a.discrepancy
      ? {
          issued: (a.discrepancy as Obj).issued as Aircraft['runway'],
          readback: (a.discrepancy as Obj).readback as Aircraft['runway'],
        }
      : undefined,
    landingCleared: (a.landingCleared as boolean | undefined) ?? a.phase === 'landing',
    approachCallMade: (a.approachCallMade as boolean | undefined) ?? false,
    pilotMode: legacy ? 'scripted' : (a.pilotMode as Aircraft['pilotMode']),
    motionPaused: legacy ? false : (a.motionPaused as boolean),
    queuedInstruction: q
      ? {
          eventId: (q as Obj).eventId as number,
          text: (q as Obj).text as string,
          frequency: (q as Obj).frequency as Aircraft['frequency'],
        }
      : undefined,
  }
}

function fleet(value: unknown, expected: string[], legacy: boolean): Aircraft[] {
  if (!Array.isArray(value) || value.length !== expected.length)
    fail('aircraft count does not match the exercise.')
  const list = value.map((item) => aircraft(item, expected, legacy))
  if (new Set(list.map((a) => a.id)).size !== list.length) fail('duplicate aircraft identity.')
  return list
}

export function decodeSession(
  value: unknown,
  source: 'file' | 'checkpoint' = 'file',
): DecodedSession {
  if (
    !object(value) ||
    !['vatsim-ai.session.v1', 'vatsim-ai.session.v2', 'vatsim-ai.session.v3'].includes(
      value.schema as string,
    )
  )
    fail('unsupported file format. Choose an exported VATSIM AI session.')
  if (value.dataset !== AIRPORT_DATA.id)
    fail('this airport dataset is not supported by the current build.')
  const legacyV1 = value.schema === 'vatsim-ai.session.v1'
  const migrated = value.schema !== 'vatsim-ai.session.v3'
  if (
    (!migrated && value.engineVersion !== ENGINE_VERSION) ||
    (value.schema === 'vatsim-ai.session.v2' && value.engineVersion !== '0.2.0')
  )
    fail('this engine version is not supported. Keep the original file.')
  const raw = value.session
  if (
    !object(raw) ||
    raw.version !== (legacyV1 ? 1 : migrated ? 2 : 3) ||
    !SCENARIOS.some((s) => s.id === raw.scenarioId)
  )
    fail('invalid session version or exercise.')
  if (
    !legacyV1 &&
    (typeof raw.id !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(raw.id))
  )
    fail('invalid session identifier.')
  if (
    !finite(raw.time) ||
    !bool(raw.running) ||
    ![1, 2, 4].includes(raw.speed as number) ||
    !bool(raw.guidance) ||
    !bool(raw.injectReadback) ||
    (raw.blockedRunway !== null && !runway(raw.blockedRunway))
  )
    fail('invalid clock or instructor settings.')
  // File ingestion is bounded. Locally produced history must remain recoverable
  // after an exercise grows beyond the portable-file import limit.
  const historyLimit = source === 'checkpoint' ? 1e8 : 2500
  if (
    !integer(raw.completed, 16) ||
    !integer(raw.attempted, historyLimit) ||
    !integer(raw.accepted, raw.attempted) ||
    !integer(raw.nextEventId) ||
    !Array.isArray(raw.events) ||
    raw.events.length < 1 ||
    raw.events.length > historyLimit
  )
    fail(
      source === 'file'
        ? 'invalid counters or event history; maximum 2,500 events per imported record.'
        : 'invalid checkpoint counters or event history.',
    )
  const ids = initialAircraft(raw.scenarioId as string).map((a) => a.id)
  const current = fleet(raw.aircraft, ids, migrated)
  let lastId = 0
  let lastTime = 0
  const priorEvents = new Map<number, string>()
  const events: SimEvent[] = raw.events.map((item) => {
    if (
      !object(item) ||
      !integer(item.id) ||
      item.id <= lastId ||
      !finite(item.time, lastTime, raw.time as number) ||
      !(
        migrated
          ? ['system', 'controller', 'pilot', 'instructor']
          : ['system', 'controller', 'pilot', 'instructor', 'operator', 'note']
      ).includes(item.kind as string) ||
      !['info', 'attention', 'critical'].includes(item.severity as string) ||
      !text(item.text, 4000) ||
      (item.aircraftId !== undefined && !ids.includes(item.aircraftId as string)) ||
      (item.frequency !== undefined && !frequencies.has(item.frequency as string)) ||
      (item.blockedRunway !== null && !runway(item.blockedRunway))
    )
      fail('invalid event order, timestamp, or contents.')
    if (
      !migrated &&
      ((item.kind === 'pilot'
        ? !['scripted', 'operator'].includes(item.source as string)
        : item.source !== undefined) ||
        (item.kind === 'note' && item.relatedEventId === undefined) ||
        (item.relatedEventId !== undefined &&
          (!['note', 'operator'].includes(item.kind as string) ||
            !integer(item.relatedEventId) ||
            item.relatedEventId >= item.id ||
            !priorEvents.has(item.relatedEventId) ||
            (item.kind === 'note'
              ? priorEvents.get(item.relatedEventId) === 'note'
              : priorEvents.get(item.relatedEventId) !== 'controller'))))
    )
      fail('invalid event attribution or observation link.')
    priorEvents.set(item.id, item.kind as string)
    lastId = item.id
    lastTime = item.time
    return {
      id: item.id,
      time: item.time,
      utc:
        typeof item.utc === 'string' && Number.isFinite(Date.parse(item.utc))
          ? item.utc
          : undefined,
      kind: item.kind as SimEvent['kind'],
      severity: item.severity as SimEvent['severity'],
      text: item.text,
      aircraftId: item.aircraftId as string | undefined,
      frequency: item.frequency as SimEvent['frequency'],
      blockedRunway: item.blockedRunway as SimEvent['blockedRunway'],
      snapshot: fleet(item.snapshot, ids, migrated),
      source:
        item.kind === 'pilot'
          ? migrated
            ? 'scripted'
            : (item.source as SimEvent['source'])
          : undefined,
      relatedEventId: migrated ? undefined : (item.relatedEventId as number | undefined),
    }
  })
  const byId = new Map(events.map((e) => [e.id, e]))
  for (const { list, maxId } of [
    { list: current, maxId: lastId },
    ...events.map((e) => ({ list: e.snapshot, maxId: e.id })),
  ]) {
    for (const a of list) {
      const q = a.queuedInstruction
      if (!q) continue
      const issued = byId.get(q.eventId)
      if (
        !issued ||
        issued.kind !== 'controller' ||
        issued.aircraftId !== a.id ||
        issued.text !== q.text ||
        issued.frequency !== q.frequency ||
        q.eventId > maxId
      )
        fail('queued instruction does not match its recorded transmission.')
      const parsed = parseTransmission(q.text, list)
      if (!parsed.ok || parsed.command.aircraftId !== a.id)
        fail('queued instruction targets a different aircraft or unsupported command.')
    }
  }
  if (
    raw.nextEventId <= lastId ||
    raw.completed !== current.filter((a) => a.phase === 'complete').length ||
    raw.attempted !== events.filter((e) => e.kind === 'controller').length
  )
    fail('session counters do not match its history.')
  if (legacyV1) {
    for (const a of current) {
      const r = RUNWAYS[a.runway]
      if (a.operation === 'arrival' && a.phase === 'landing' && a.position.y > r.bottom) {
        a.phase = 'final'
        a.runwayOccupied = false
        a.route = []
        a.routeIndex = 0
      }
    }
  }
  return {
    migrated,
    session: {
      version: 3,
      id: legacyV1 ? crypto.randomUUID() : (raw.id as string),
      scenarioId: raw.scenarioId as string,
      time: raw.time,
      tickRemainder: finite(raw.tickRemainder, 0, 0.1) ? raw.tickRemainder : 0,
      running: false,
      speed: raw.speed as Session['speed'],
      aircraft: current,
      events,
      nextEventId: raw.nextEventId,
      guidance: raw.guidance,
      injectReadback: raw.injectReadback,
      blockedRunway: raw.blockedRunway as Session['blockedRunway'],
      completed: raw.completed,
      attempted: raw.attempted,
      accepted: raw.accepted,
    },
  }
}

export function parseSessionFile(contents: string): DecodedSession {
  if (new Blob([contents]).size > MAX_SESSION_BYTES) fail('file exceeds the 10 MB import limit.')
  let value: unknown
  try {
    value = JSON.parse(contents)
  } catch {
    fail('file is not valid JSON.')
  }
  return decodeSession(value)
}

export function forkSession(source: Session): Session {
  return {
    ...source,
    id: crypto.randomUUID(),
    running: false,
    aircraft: copyAircraft(source.aircraft),
    events: source.events.map((e) => ({ ...e, snapshot: copyAircraft(e.snapshot) })),
  }
}
