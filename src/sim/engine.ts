import { initialAircraft, pilotRequest, RUNWAYS, SCENARIOS } from './airport'
import { parseTransmission } from './parser'
import type { Aircraft, Command, Frequency, Point, RunwayId, Session, SimEvent } from './types'

export function copyAircraft(aircraft: Aircraft[]): Aircraft[] {
  return aircraft.map((a) => ({
    ...a,
    position: { ...a.position },
    route: a.route.map((p) => ({ ...p })),
    discrepancy: a.discrepancy ? { ...a.discrepancy } : undefined,
  }))
}
export function record(
  session: Session,
  kind: SimEvent['kind'],
  text: string,
  options: Partial<Pick<SimEvent, 'aircraftId' | 'severity' | 'frequency'>> = {},
): Session {
  const event: SimEvent = {
    id: session.nextEventId,
    time: session.time,
    kind,
    text,
    severity: 'info',
    ...options,
    snapshot: copyAircraft(session.aircraft),
    blockedRunway: session.blockedRunway,
  }
  return { ...session, nextEventId: session.nextEventId + 1, events: [...session.events, event] }
}
export function createSession(scenarioId = 'morning'): Session {
  const validId = SCENARIOS.some((s) => s.id === scenarioId) ? scenarioId : 'morning'
  let s: Session = {
    version: 1,
    scenarioId: validId,
    time: 0,
    running: false,
    speed: 1,
    aircraft: initialAircraft(validId),
    events: [],
    nextEventId: 1,
    guidance: true,
    injectReadback: validId === 'readback',
    blockedRunway: null,
    completed: 0,
    attempted: 0,
    accepted: 0,
  }
  s = record(
    s,
    'system',
    'Exercise loaded. Illustrative WMKK dataset; procedural validation pending.',
  )
  for (const a of s.aircraft)
    s = record(s, 'pilot', pilotRequest(a), { aircraftId: a.id, frequency: a.frequency })
  return s
}

function setRoute(a: Aircraft, route: Point[]) {
  a.route = route
  a.routeIndex = 0
  a.holdReported = false
}
function occupied(s: Session, runway: RunwayId, ownId: string) {
  return (
    s.blockedRunway === runway ||
    s.aircraft.some((a) => a.id !== ownId && a.runway === runway && a.runwayOccupied)
  )
}

function validate(s: Session, a: Aircraft, c: Command, frequency: Frequency): string | null {
  if (a.phase === 'complete') return 'This aircraft has completed its exercise.'
  if (frequency !== a.frequency)
    return `No response: ${a.id} is on ${a.frequency}. Select the correct transmit frequency.`
  const r = RUNWAYS[a.runway]
  if ('runway' in c && c.runway !== a.runway)
    return `Unable. Assigned runway is ${a.runway}; runway reassignment is outside this first exercise.`
  if (a.discrepancy && !['correct', 'standby', 'hold'].includes(c.type))
    return 'Resolve the outstanding runway readback discrepancy first.'
  switch (c.type) {
    case 'pushback':
      return a.phase !== 'parked' || a.operation !== 'departure'
        ? 'Pushback is available for a departure at its stand.'
        : null
    case 'taxi':
      if (!['ready', 'stopped', 'taxiing'].includes(a.phase) || a.operation !== 'departure')
        return 'Aircraft must be ready to taxi. Approve pushback first if it is at stand.'
      if (c.via !== r.route)
        return `Demonstration route to runway ${a.runway} is via ${r.route}. Other routes have not been modelled.`
      return null
    case 'hold':
      return !['ready', 'pushback', 'taxiing', 'stopped', 'holding'].includes(a.phase)
        ? 'Hold position is available for aircraft on the ground outside the runway.'
        : null
    case 'handoff': {
      const target = a.operation === 'departure' ? r.frequency : r.ground
      if (c.frequency !== target)
        return `Expected next station frequency is ${target} for this aircraft.`
      if (a.operation === 'departure' && a.phase !== 'holding')
        return 'Transfer this departure to tower when it is holding short.'
      if (a.operation === 'arrival' && a.phase !== 'vacated')
        return 'Transfer this arrival to ground after it has vacated the runway.'
      if (a.frequency === c.frequency) return 'The aircraft is already on that frequency.'
      return null
    }
    case 'lineup':
      if (a.phase !== 'holding' || a.frequency !== r.frequency)
        return 'Line-up requires the aircraft holding short on the correct tower frequency.'
      return occupied(s, a.runway, a.id) && s.guidance
        ? 'Training guard: runway occupied. Hold the aircraft or remove the obstruction in Instructor controls.'
        : null
    case 'takeoff':
      if (a.phase !== 'lined-up' || a.frequency !== r.frequency)
        return 'Aircraft must be lined up on the correct tower frequency before departure.'
      return occupied(s, a.runway, a.id) && s.guidance
        ? 'Training guard: runway occupied. Takeoff clearance has not been applied.'
        : null
    case 'land':
      if (a.phase !== 'final' || a.frequency !== r.frequency)
        return 'Landing clearance requires an arrival on final on the correct tower frequency.'
      return occupied(s, a.runway, a.id) && s.guidance
        ? 'Training guard: runway occupied. Landing clearance has not been applied.'
        : null
    case 'goaround':
      return a.phase !== 'final' ? 'Go-around is available for an arrival on final.' : null
    case 'gate':
      return a.phase !== 'vacated' ||
        a.frequency !== r.ground ||
        c.stand !== a.stand ||
        c.via !== 'C'
        ? `Taxi to stand requires runway vacated, ground frequency ${r.ground}, and the demonstration route to ${a.stand} via C.`
        : null
    case 'correct':
      return !a.discrepancy ? 'There is no outstanding readback discrepancy to correct.' : null
    default:
      return null
  }
}

export function transmit(
  session: Session,
  input: string,
  frequency: Frequency,
): { session: Session; error?: string } {
  const parsed = parseTransmission(input, session.aircraft)
  let s = { ...session, aircraft: copyAircraft(session.aircraft), attempted: session.attempted + 1 }
  s = record(s, 'controller', input.trim(), { frequency })
  if (!parsed.ok) {
    s = record(s, 'instructor', parsed.error, { severity: 'attention' })
    return { session: s, error: parsed.error }
  }
  const c = parsed.command
  const a = s.aircraft.find((item) => item.id === c.aircraftId)!
  const error = validate(s, a, c, frequency)
  if (error) {
    s = record(s, 'instructor', error, { aircraftId: a.id, severity: 'attention' })
    return { session: s, error }
  }
  const r = RUNWAYS[a.runway]
  a.pending = false
  a.overdueReported = false
  let readback = ''
  switch (c.type) {
    case 'pushback':
      a.phase = 'pushback'
      setRoute(a, [{ x: a.position.x - 45, y: a.position.y }])
      a.clearance = 'Pushback approved'
      readback = `Pushback approved, ${a.spoken}.`
      break
    case 'taxi': {
      const taxiX = r.hold.x
      setRoute(a, [{ x: taxiX, y: a.position.y }, { ...r.hold }])
      a.clearance = `Taxi via ${c.via} · hold short ${a.runway}`
      if (s.injectReadback) {
        const wrong: RunwayId = a.runway === '32R' ? '32L' : '32R'
        a.discrepancy = { issued: a.runway, readback: wrong }
        a.phase = 'stopped'
        s = { ...s, injectReadback: false }
        readback = `Taxi via ${c.via}, hold short runway ${wrong}, ${a.spoken}.`
      } else {
        a.phase = 'taxiing'
        readback = `Taxi via ${c.via}, hold short runway ${a.runway}, ${a.spoken}.`
      }
      break
    }
    case 'hold':
      a.phase = 'stopped'
      a.speed = 0
      a.clearance = 'Hold position'
      readback = `Holding position, ${a.spoken}.`
      break
    case 'handoff': {
      a.frequency = c.frequency
      a.pending = true
      a.requestAt = s.time
      a.clearance = `Transferred to ${c.frequency}`
      readback = `Contact ${a.operation === 'departure' ? 'Lumpur Tower' : 'Lumpur Ground'} ${c.frequency}, ${a.spoken}.`
      break
    }
    case 'lineup':
      a.phase = 'lining-up'
      a.runwayOccupied = true
      a.speed = 0
      setRoute(a, [{ ...r.entry }])
      a.clearance = `Line up and wait · runway ${a.runway}`
      readback = `Runway ${a.runway}, line up and wait, ${a.spoken}.`
      break
    case 'takeoff':
      a.phase = 'departing'
      a.clearance = `Cleared for takeoff · runway ${a.runway}`
      setRoute(a, [
        { x: r.x, y: r.top },
        { x: r.x, y: -110 },
      ])
      readback = `Runway ${a.runway}, cleared for takeoff, ${a.spoken}.`
      break
    case 'land':
      a.phase = 'landing'
      a.runwayOccupied = true
      a.clearance = `Cleared to land · runway ${a.runway}`
      setRoute(a, [
        { x: r.x, y: r.bottom - 45 },
        { x: r.x, y: 290 },
        { x: r.x + 60, y: 290 },
      ])
      readback = `Runway ${a.runway}, cleared to land, ${a.spoken}.`
      break
    case 'goaround':
      a.phase = 'going-around'
      a.clearance = 'Go around'
      setRoute(a, [{ x: r.x, y: -110 }])
      readback = `Going around, ${a.spoken}.`
      break
    case 'gate':
      a.phase = 'taxiing'
      a.clearance = `Taxi to stand ${a.stand} via C`
      setRoute(a, [
        { x: 640, y: 440 },
        { x: 770, y: 440 },
      ])
      readback = `Taxi to stand ${a.stand} via C, ${a.spoken}.`
      break
    case 'standby':
      a.clearance = 'Standby'
      readback = `${a.spoken}, standing by.`
      break
    case 'correct':
      delete a.discrepancy
      a.phase = 'taxiing'
      a.clearance = `Taxi via ${r.route} · hold short ${a.runway}`
      readback = `Correction, hold short runway ${a.runway}, ${a.spoken}.`
      break
  }
  s = { ...s, accepted: s.accepted + 1 }
  s = record(s, 'pilot', readback, { aircraftId: a.id, frequency })
  if (a.discrepancy)
    s = record(
      s,
      'instructor',
      `${a.id} read back runway ${a.discrepancy.readback}; you issued ${a.discrepancy.issued}. Correct the readback before continuing.`,
      { aircraftId: a.id, severity: 'critical' },
    )
  if (['lineup', 'takeoff', 'land'].includes(c.type) && occupied(s, a.runway, a.id))
    s = record(
      s,
      'instructor',
      `Runway conflict: ${a.id} cleared onto occupied runway ${a.runway}. Unguided exercise: clearance applied.`,
      { aircraftId: a.id, severity: 'critical' },
    )
  return { session: s }
}

function advance(a: Aircraft, distance: number) {
  let remaining = distance
  while (remaining > 0 && a.routeIndex < a.route.length) {
    const next = a.route[a.routeIndex]
    const dx = next.x - a.position.x
    const dy = next.y - a.position.y
    const length = Math.hypot(dx, dy)
    if (length > 0) a.heading = (Math.atan2(dx, -dy) * 180) / Math.PI
    if (length <= remaining) {
      a.position = { ...next }
      a.routeIndex += 1
      remaining -= length
    } else {
      a.position = {
        x: a.position.x + (dx / length) * remaining,
        y: a.position.y + (dy / length) * remaining,
      }
      remaining = 0
    }
  }
}

export function tick(session: Session, delta: number): Session {
  if (!session.running || delta <= 0 || !Number.isFinite(delta)) return session
  let s: Session = {
    ...session,
    time: session.time + delta * session.speed,
    aircraft: copyAircraft(session.aircraft),
  }
  const dt = delta * session.speed
  for (const a of s.aircraft) {
    if (a.pending && s.time - a.requestAt >= 90 && !a.overdueReported) {
      a.overdueReported = true
      s = record(
        s,
        'instructor',
        `${a.id}: request waiting more than 90 seconds. Exercise coaching threshold; acknowledge when workload permits.`,
        { aircraftId: a.id, severity: 'attention' },
      )
    }
    const movement =
      (
        {
          pushback: 1.5,
          taxiing: 4,
          'lining-up': 3,
          departing: 40,
          landing: 24,
          'going-around': 35,
        } as Partial<Record<Aircraft['phase'], number>>
      )[a.phase] ?? 0
    if (!movement) continue
    a.speed =
      a.phase === 'taxiing' ? 15 : a.phase === 'pushback' ? 4 : a.phase === 'landing' ? 110 : 145
    advance(a, movement * dt)
    if (a.routeIndex >= a.route.length) {
      a.speed = 0
      if (a.phase === 'lining-up') {
        a.phase = 'lined-up'
        s = record(s, 'system', `${a.id} lined up on runway ${a.runway}.`, { aircraftId: a.id })
      } else if (a.phase === 'pushback') {
        a.phase = 'ready'
        a.pending = true
        a.requestAt = s.time
        s = record(s, 'pilot', `${a.spoken}, pushback complete, ready to taxi.`, {
          aircraftId: a.id,
          frequency: a.frequency,
        })
      } else if (a.phase === 'taxiing' && a.operation === 'departure') {
        a.phase = 'holding'
        a.pending = true
        a.requestAt = s.time
        s = record(
          s,
          'pilot',
          `${a.spoken}, holding short runway ${a.runway}, ready for departure.`,
          { aircraftId: a.id, frequency: a.frequency },
        )
      } else if (a.phase === 'landing') {
        a.phase = 'vacated'
        a.runwayOccupied = false
        a.pending = true
        a.requestAt = s.time
        s = record(s, 'pilot', `${a.spoken}, runway ${a.runway} vacated.`, {
          aircraftId: a.id,
          frequency: a.frequency,
        })
      } else {
        a.phase = 'complete'
        a.runwayOccupied = false
        a.pending = false
        s = { ...s, completed: s.completed + 1 }
        s = record(
          s,
          'system',
          `${a.id}: ${a.operation === 'departure' ? 'departure complete, adjacent control assumed' : a.clearance === 'Go around' ? 'go-around complete, adjacent control assumed' : `arrived at stand ${a.stand}`}.`,
          { aircraftId: a.id },
        )
      }
    }
  }
  return s
}

export function instructorEvent(
  session: Session,
  action: 'readback' | 'obstruction' | 'guidance',
): Session {
  if (action === 'readback')
    return record(
      { ...session, injectReadback: !session.injectReadback },
      'instructor',
      session.injectReadback
        ? 'Scripted readback error cancelled.'
        : 'Next accepted taxi clearance will receive a scripted wrong-runway readback.',
    )
  if (action === 'guidance')
    return record(
      { ...session, guidance: !session.guidance },
      'instructor',
      `Training guards ${session.guidance ? 'disabled: unsafe runway clearances can be applied and recorded' : 'enabled: occupied-runway clearances are held'}.`,
    )
  const blockedRunway = session.blockedRunway ? null : '32R'
  return record(
    { ...session, blockedRunway },
    'instructor',
    blockedRunway
      ? 'Exercise event: inspection vehicle occupying runway 32R.'
      : 'Exercise event: runway 32R obstruction removed.',
    { severity: blockedRunway ? 'attention' : 'info' },
  )
}

export function formatTime(seconds: number): string {
  const value = Math.floor(Math.max(0, seconds))
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export function sessionExport(s: Session) {
  return {
    schema: 'vatsim-ai.session.v1',
    exportedAt: new Date().toISOString(),
    dataset: 'wmkk-schematic-0.1',
    limitations: [
      'Illustrative geometry',
      'Simplified kinematics',
      'Scripted pilots; no speech recognition',
      'Not validated or approved for professional training',
    ],
    session: { ...s, running: false },
  }
}
