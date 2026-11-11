import { movementStep } from './motion'
import { PUSHBACK, STANDS, departurePath, ARRIVAL_PATH, ARRIVAL_ROUTE, ROLLOUT } from './geometry'
import {
  AIRPORT_DATA,
  ARRIVAL_MODEL,
  arrivalDecisionSeconds,
  pilotRequest,
  RUNWAYS,
} from './airport'
import { builtinExercise, decodeExercise, decodeWeather, exerciseAircraft } from './exercises'
import { parseTransmission } from './parser'
import { BUILD_COMMIT, ENGINE_VERSION } from './version'
import type {
  Aircraft,
  Assessment,
  Command,
  ExerciseDefinition,
  Frequency,
  Point,
  RunwayId,
  Session,
  SimEvent,
  Weather,
} from './types'

export function copyAircraft(aircraft: Aircraft[]): Aircraft[] {
  return aircraft.map((a) => ({
    ...a,
    position: { ...a.position },
    route: a.route.map((p) => ({ ...p })),
    discrepancy: a.discrepancy ? { ...a.discrepancy } : undefined,
    queuedInstruction: a.queuedInstruction ? { ...a.queuedInstruction } : undefined,
  }))
}
export function record(
  session: Session,
  kind: SimEvent['kind'],
  text: string,
  options: Partial<
    Pick<SimEvent, 'aircraftId' | 'severity' | 'frequency' | 'source' | 'relatedEventId'>
  > = {},
): Session {
  const event: SimEvent = {
    id: session.nextEventId,
    time: session.time,
    kind,
    text,
    severity: 'info',
    ...(kind === 'pilot' ? { source: 'scripted' as const } : {}),
    ...options,
    snapshot: copyAircraft(session.aircraft),
    blockedRunway: session.blockedRunway,
    weather: { ...session.weather },
    coordination: session.coordination.map((c) => ({ ...c })),
  }
  return { ...session, nextEventId: session.nextEventId + 1, events: [...session.events, event] }
}
export function createSession(scenarioId = 'morning', definition?: ExerciseDefinition): Session {
  const exercise = decodeExercise(definition ?? builtinExercise(scenarioId))
  const validId = exercise.id
  let s: Session = {
    version: 4,
    id: crypto.randomUUID(),
    scenarioId: validId,
    time: 0,
    running: false,
    speed: 1,
    aircraft: exerciseAircraft(exercise),
    events: [],
    nextEventId: 1,
    guidance: true,
    injectReadback: exercise.baseScenario === 'readback',
    blockedRunway: null,
    completed: 0,
    attempted: 0,
    accepted: 0,
    exercise,
    weather: { ...exercise.weather },
    firedTriggers: [],
    coordination: [],
    assessments: [],
  }
  s = record(
    s,
    'system',
    'Exercise loaded. Chart-transcribed WMKK dataset; procedural validation pending.',
  )
  for (const a of s.aircraft.filter((a) => a.phase !== 'scheduled'))
    s = record(s, 'pilot', pilotRequest(a, s.weather.information), {
      aircraftId: a.id,
      frequency: a.frequency,
    })
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
  if (a.phase === 'scheduled') return 'This aircraft has not entered the exercise yet.'
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
      if (!r.route) return 'Departure routing for this runway is not supported by this dataset.'
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
      if (
        s.exercise.requireCoordination &&
        !s.coordination.some(
          (item) =>
            item.aircraftId === a.id &&
            item.from === a.frequency &&
            item.to === c.frequency &&
            item.status === 'approved',
        )
      )
        return 'Exercise coordination required: obtain adjacent-station acceptance before issuing the transfer.'
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
        c.via !== ARRIVAL_ROUTE
        ? `Taxi to stand requires runway vacated, ground frequency ${r.ground}, and the demonstration route to ${a.stand} via ${ARRIVAL_ROUTE}.`
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
  if (input.length > 1000) {
    const error =
      'Transmission exceeds the 1,000-character limit. Shorten the instruction; it was not transmitted.'
    return { session: record(session, 'instructor', error, { severity: 'attention' }), error }
  }
  const parsed = parseTransmission(input, session.aircraft)
  let s = { ...session, aircraft: copyAircraft(session.aircraft), attempted: session.attempted + 1 }
  s = record(s, 'controller', input.trim(), {
    frequency,
    aircraftId: parsed.ok ? parsed.command.aircraftId : undefined,
  })
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
  if (a.pilotMode === 'operator') {
    const previous = a.queuedInstruction?.eventId
    a.queuedInstruction = { eventId: s.events.at(-1)!.id, text: input.trim(), frequency }
    return {
      session: record(
        s,
        'operator',
        `${a.id}: instruction #${a.queuedInstruction.eventId} awaiting pseudo-pilot execution.${previous ? ` Replaces unexecuted instruction #${previous}.` : ''}`,
        { aircraftId: a.id },
      ),
    }
  }
  return applyCommand(s, a, c, frequency)
}

function applyCommand(
  s: Session,
  a: Aircraft,
  c: Command,
  frequency: Frequency,
): { session: Session } {
  const r = RUNWAYS[a.runway]
  a.pending = false
  a.overdueReported = false
  let readback = ''
  switch (c.type) {
    case 'pushback':
      a.phase = 'pushback'
      setRoute(a, [{ ...PUSHBACK[a.stand as keyof typeof PUSHBACK] }])
      a.clearance = 'Pushback approved'
      readback = `Pushback approved, ${a.spoken}.`
      break
    case 'taxi': {
      setRoute(a, departurePath(a.stand, a.runway, a.position))
      a.clearance = `Taxi via ${c.via} · hold short ${a.runway}`
      if (s.injectReadback && a.pilotMode === 'scripted') {
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
        { x: r.x, y: r.top - 200 },
      ])
      readback = `Runway ${a.runway}, cleared for takeoff, ${a.spoken}.`
      break
    case 'land':
      a.landingCleared = true
      a.clearance = `Cleared to land · runway ${a.runway}`
      readback = `Runway ${a.runway}, cleared to land, ${a.spoken}.`
      break
    case 'goaround':
      a.phase = 'going-around'
      a.landingCleared = false
      a.clearance = 'Go around'
      setRoute(a, [{ x: r.x, y: r.top - 200 }])
      readback = `Going around, ${a.spoken}.`
      break
    case 'gate':
      a.phase = 'taxiing'
      a.clearance = `Taxi to stand ${a.stand} via ${ARRIVAL_ROUTE}`
      setRoute(a, [...ARRIVAL_PATH, STANDS.B10])
      readback = `Taxi to stand ${a.stand} via ${ARRIVAL_ROUTE}, ${a.spoken}.`
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
  s = record(s, 'pilot', readback, { aircraftId: a.id, frequency, source: a.pilotMode })
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

export function setPilotMode(
  session: Session,
  aircraftId: string,
  mode: Aircraft['pilotMode'],
): Session {
  const original = session.aircraft.find((a) => a.id === aircraftId)
  if (
    !original ||
    original.pilotMode === mode ||
    (mode === 'operator' && ['complete', 'scheduled'].includes(original.phase))
  )
    return session
  const s = { ...session, aircraft: copyAircraft(session.aircraft) }
  const a = s.aircraft.find((item) => item.id === aircraftId)!
  const cancelled = a.queuedInstruction?.eventId
  a.pilotMode = mode
  a.motionPaused = false
  delete a.queuedInstruction
  return record(
    s,
    'operator',
    mode === 'operator'
      ? `${a.id}: pseudo-pilot takeover. New controller instructions require execution; automatic routine radio calls suppressed. Existing motion and the approach decision policy continue unless frozen.`
      : `${a.id}: returned to scripted pilot; motion resumed.${cancelled ? ` Unexecuted instruction #${cancelled} cancelled.` : ''}`,
    { aircraftId },
  )
}

export function setAircraftMotionPaused(
  session: Session,
  aircraftId: string,
  paused: boolean,
): Session {
  const original = session.aircraft.find((a) => a.id === aircraftId)
  if (
    !original ||
    original.pilotMode !== 'operator' ||
    original.phase === 'complete' ||
    original.motionPaused === paused
  )
    return session
  const s = { ...session, aircraft: copyAircraft(session.aircraft) }
  const a = s.aircraft.find((item) => item.id === aircraftId)!
  a.motionPaused = paused
  if (paused) a.speed = 0
  return record(
    s,
    'operator',
    `${a.id}: motion ${paused ? 'frozen by instructor; runway occupancy retained' : 'resumed by instructor'}.`,
    { aircraftId, severity: paused ? 'attention' : 'info' },
  )
}

export function resolvePilotInstruction(
  session: Session,
  aircraftId: string,
  execute: boolean,
): { session: Session; error?: string } {
  const s = { ...session, aircraft: copyAircraft(session.aircraft) }
  const a = s.aircraft.find((item) => item.id === aircraftId)
  if (!a || a.pilotMode !== 'operator' || !a.queuedInstruction)
    return { session, error: 'No instruction awaiting pseudo-pilot execution.' }
  if (!session.running)
    return { session, error: 'Resume the exercise before resolving a pilot instruction.' }
  const queued = a.queuedInstruction
  if (!execute) {
    delete a.queuedInstruction
    const next = record(
      s,
      'operator',
      `${a.id}: instruction #${queued.eventId} declined; aircraft clearance unchanged.`,
      { aircraftId, relatedEventId: queued.eventId },
    )
    if (a.phase === 'complete' || a.frequency !== queued.frequency) return { session: next }
    return {
      session: record(next, 'pilot', `Unable, ${a.spoken}.`, {
        aircraftId,
        frequency: queued.frequency,
        source: 'operator',
      }),
    }
  }
  const parsed = parseTransmission(queued.text, s.aircraft)
  const error = parsed.ok
    ? parsed.command.aircraftId !== a.id
      ? 'Queued instruction targets a different aircraft.'
      : validate(s, a, parsed.command, queued.frequency)
    : parsed.error
  if (error || !parsed.ok)
    return {
      session: record(s, 'operator', `Instruction #${queued.eventId} not executed: ${error}`, {
        aircraftId,
        severity: 'attention',
        relatedEventId: queued.eventId,
      }),
      error: error ?? 'Instruction cannot be executed.',
    }
  delete a.queuedInstruction
  return applyCommand(
    record(s, 'operator', `${a.id}: executing instruction #${queued.eventId}.`, {
      aircraftId,
      relatedEventId: queued.eventId,
    }),
    a,
    parsed.command,
    queued.frequency,
  )
}

export function sendPilotCall(
  session: Session,
  aircraftId: string,
  text: string,
): { session: Session; error?: string } {
  const a = session.aircraft.find((item) => item.id === aircraftId)
  if (!a || a.pilotMode !== 'operator' || ['complete', 'scheduled'].includes(a.phase))
    return { session, error: 'Take over an active aircraft before sending a pilot call.' }
  if (!session.running)
    return { session, error: 'Resume the exercise before sending a pilot call.' }
  if (!text.trim() || text.length > 1000)
    return { session, error: 'Pilot calls must contain 1–1,000 characters.' }
  // Radio-only: arbitrary dialogue never changes a clearance or creates a route.
  return {
    session: record(session, 'pilot', text.trim(), {
      aircraftId,
      frequency: a.frequency,
      source: 'operator',
    }),
  }
}

export function addObservation(
  session: Session,
  eventId: number,
  text: string,
  severity: SimEvent['severity'],
): { session: Session; error?: string } {
  const target = session.events.find((e) => e.id === eventId)
  if (!target || ['note', 'assessment'].includes(target.kind))
    return { session, error: 'Select a recorded exercise event to annotate.' }
  if (!text.trim() || text.length > 1000)
    return { session, error: 'Observations must contain 1–1,000 characters.' }
  return {
    session: record(session, 'note', text.trim(), {
      relatedEventId: eventId,
      aircraftId: target.aircraftId,
      severity,
    }),
  }
}

function routinePilotReport(s: Session, a: Aircraft, text: string): Session {
  return a.pilotMode === 'operator'
    ? record(s, 'system', `${a.id}: pilot report due — ${text}`, { aircraftId: a.id })
    : record(s, 'pilot', text, { aircraftId: a.id, frequency: a.frequency })
}

function beginAutomaticGoAround(s: Session, a: Aircraft, reason: string): Session {
  a.phase = 'going-around'
  a.landingCleared = false
  a.runwayOccupied = false
  a.pending = false
  a.clearance = 'Go around'
  setRoute(a, [{ x: RUNWAYS[a.runway].x, y: RUNWAYS[a.runway].top - 200 }])
  s = routinePilotReport(s, a, `${a.spoken}, going around, ${reason}.`)
  return record(
    s,
    'instructor',
    `${a.id}: automatic go-around — ${reason}. This is the exercise decision-point policy, not a published WMKK minimum.`,
    { aircraftId: a.id, severity: 'critical' },
  )
}

function integrate(session: Session, dt: number): Session {
  let s: Session = {
    ...session,
    time: session.time + dt,
  }
  for (const trigger of s.exercise.triggers) {
    if (trigger.at > s.time || s.firedTriggers.includes(trigger.id)) continue
    s = { ...s, firedTriggers: [...s.firedTriggers, trigger.id] }
    if (trigger.action === 'readback') s = { ...s, injectReadback: true }
    else if (trigger.action === 'block') s = { ...s, blockedRunway: trigger.runway }
    else if (s.blockedRunway === trigger.runway) s = { ...s, blockedRunway: null }
    s = record(
      s,
      'instructor',
      `Timed event ${trigger.id}: ${trigger.action === 'readback' ? 'scripted readback error armed' : `runway ${trigger.runway} ${trigger.action === 'block' ? 'obstruction placed' : 'obstruction cleared if present'}`}.`,
      { severity: trigger.action === 'block' ? 'attention' : 'info' },
    )
  }
  if (s.exercise.automaticCoordination)
    for (const item of s.coordination) {
      if (item.status === 'pending' && s.time - item.requestedAt >= 8)
        s = decideCoordination(s, item.id, true, 'scripted').session
    }
  for (const a of s.aircraft) {
    if (a.phase === 'scheduled') {
      if (s.time < a.activationTime) continue
      const traffic = s.exercise.traffic.find((t) => t.callsign === a.id)!
      a.phase = exerciseAircraft({
        ...s.exercise,
        traffic: [{ ...traffic, releaseAt: 0 }],
      })[0].phase
      a.pending = true
      a.requestAt = s.time
      s = record(s, 'system', `${a.id} entered the exercise.`, { aircraftId: a.id })
      s = record(s, 'pilot', pilotRequest(a, s.weather.information), {
        aircraftId: a.id,
        frequency: a.frequency,
      })
    }
    if (a.pending && s.time - a.requestAt >= 90 && !a.overdueReported) {
      a.overdueReported = true
      s = record(
        s,
        'instructor',
        `${a.id}: request waiting more than 90 seconds. Exercise coaching threshold; acknowledge when workload permits.`,
        { aircraftId: a.id, severity: 'attention' },
      )
    }
    if (a.motionPaused) continue
    if (a.phase === 'final') {
      const runway = RUNWAYS[a.runway]
      a.speed = 130
      a.position = {
        x: runway.x,
        y: Math.max(runway.bottom, a.position.y - ARRIVAL_MODEL.approachSpeed * dt),
      }
      if (
        !a.landingCleared &&
        !a.approachCallMade &&
        arrivalDecisionSeconds(a)! <= ARRIVAL_MODEL.shortFinalSeconds
      ) {
        a.approachCallMade = true
        a.pending = true
        a.requestAt = s.time
        a.overdueReported = false
        s = routinePilotReport(
          s,
          a,
          `${a.spoken}, short final runway ${a.runway}, request landing clearance.`,
        )
      }
      if (
        a.position.y <= runway.bottom + ARRIVAL_MODEL.decisionOffset &&
        (!a.landingCleared || occupied(s, a.runway, a.id))
      ) {
        s = beginAutomaticGoAround(
          s,
          a,
          !a.landingCleared ? 'landing clearance not received' : `runway ${a.runway} occupied`,
        )
      } else if (a.position.y <= runway.bottom) {
        a.phase = 'landing'
        a.runwayOccupied = true
        a.speed = 110
        setRoute(
          a,
          ROLLOUT.map((p) => ({ ...p })),
        )
        s = record(s, 'system', `${a.id}: touchdown on runway ${a.runway}.`, { aircraftId: a.id })
      }
      continue
    }
    if (
      !['pushback', 'taxiing', 'lining-up', 'departing', 'landing', 'going-around'].includes(
        a.phase,
      )
    )
      continue
    const movement = movementStep(a, dt)
    a.speed = movement.speed
    advance(a, movement.distance)
    if (a.routeIndex >= a.route.length) {
      a.speed = 0
      if (a.phase === 'lining-up') {
        a.phase = 'lined-up'
        s = record(s, 'system', `${a.id} lined up on runway ${a.runway}.`, { aircraftId: a.id })
      } else if (a.phase === 'pushback') {
        a.phase = 'ready'
        a.pending = true
        a.requestAt = s.time
        s = routinePilotReport(s, a, `${a.spoken}, pushback complete, ready to taxi.`)
      } else if (a.phase === 'taxiing' && a.operation === 'departure') {
        a.phase = 'holding'
        a.pending = true
        a.requestAt = s.time
        s = routinePilotReport(
          s,
          a,
          `${a.spoken}, holding short runway ${a.runway}, ready for departure.`,
        )
      } else if (a.phase === 'landing') {
        a.phase = 'vacated'
        a.runwayOccupied = false
        a.pending = true
        a.requestAt = s.time
        s = routinePilotReport(s, a, `${a.spoken}, runway ${a.runway} vacated.`)
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

export function tick(session: Session, delta: number): Session {
  if (!session.running || delta <= 0 || !Number.isFinite(delta)) return session
  let s = { ...session, aircraft: copyAircraft(session.aircraft) }
  let remaining = Math.min(delta * session.speed, 3600)
  // Substeps prevent an accelerated clock from skipping an approach decision or phase transition.
  while (remaining > 0.000001) {
    const step = Math.min(remaining, 1)
    s = integrate(s, step)
    remaining -= step
  }
  return s
}

export function instructorEvent(
  session: Session,
  action: 'readback' | 'obstruction' | 'guidance',
  runway: RunwayId = '32R',
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
  const blockedRunway = session.blockedRunway ? null : runway
  return record(
    { ...session, blockedRunway },
    'instructor',
    blockedRunway
      ? `Exercise event: inspection vehicle occupying runway ${blockedRunway}.`
      : `Exercise event: runway ${session.blockedRunway} obstruction removed.`,
    { severity: blockedRunway ? 'attention' : 'info' },
  )
}

export function formatTime(seconds: number): string {
  const value = Math.floor(Math.max(0, seconds))
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export function sessionExport(s: Session) {
  return {
    schema: 'vatsim-ai.session.v4',
    engineVersion: ENGINE_VERSION,
    buildCommit: BUILD_COMMIT,
    exportedAt: new Date().toISOString(),
    dataset: AIRPORT_DATA.id,
    limitations: [
      'Manually chart-transcribed geometry; professional validation pending',
      'Simplified kinematics',
      'Scripted or human-operated pilots; optional browser speech drafts',
      'Not validated or approved for professional training',
    ],
    session: { ...s, running: false },
  }
}

export function updateWeather(
  session: Session,
  value: Weather,
): { session: Session; error?: string } {
  try {
    const weather = decodeWeather(value)
    return {
      session: record(
        { ...session, weather },
        'instructor',
        `Exercise weather: wind ${weather.windDirection} degrees ${weather.windSpeed} knots, QNH ${weather.qnh}, information ${weather.information}. Display and briefing only; no aerodynamic model or runway reassignment.`,
      ),
    }
  } catch (e) {
    return { session, error: e instanceof Error ? e.message : 'Invalid weather.' }
  }
}
export function requestCoordination(
  session: Session,
  aircraftId: string,
): { session: Session; error?: string } {
  const a = session.aircraft.find((item) => item.id === aircraftId)
  if (!session.running) return { session, error: 'Resume the exercise before coordinating.' }
  if (!a || !(a.operation === 'departure' ? a.phase === 'holding' : a.phase === 'vacated'))
    return {
      session,
      error: 'Coordinate a departure holding short or an arrival that has vacated.',
    }
  const to = a.operation === 'departure' ? RUNWAYS[a.runway].frequency : RUNWAYS[a.runway].ground
  if (to === a.frequency)
    return { session, error: 'This aircraft is already with the next station.' }
  if (
    session.coordination.some(
      (c) =>
        c.aircraftId === aircraftId &&
        c.from === a.frequency &&
        c.to === to &&
        c.status !== 'declined',
    )
  )
    return { session, error: 'Coordination is already pending or accepted for this transfer.' }
  const item = {
    id: session.nextEventId,
    aircraftId,
    from: a.frequency,
    to,
    requestedAt: session.time,
    status: 'pending' as const,
  }
  return {
    session: record(
      { ...session, coordination: [...session.coordination, item] },
      'coordination',
      `${aircraftId}: transfer acceptance requested from ${to}, current station ${a.frequency}.`,
      { aircraftId },
    ),
  }
}
export function decideCoordination(
  session: Session,
  id: number,
  approved: boolean,
  source: 'scripted' | 'manual' = 'manual',
): { session: Session; error?: string } {
  const item = session.coordination.find((c) => c.id === id)
  if (!item || item.status !== 'pending')
    return { session, error: 'This coordination request is no longer pending.' }
  const coordination = session.coordination.map((c) =>
    c.id === id
      ? {
          ...c,
          status: approved ? ('approved' as const) : ('declined' as const),
          decidedAt: session.time,
        }
      : { ...c },
  )
  return {
    session: record(
      { ...session, coordination },
      'coordination',
      `${item.aircraftId}: ${item.to} ${approved ? 'accepted' : 'declined'} transfer (${source === 'scripted' ? 'scripted adjacent station' : 'instructor decision'}). Radio ownership changes only when the controller transfer is applied.`,
      { aircraftId: item.aircraftId },
    ),
  }
}
export function assessCriterion(
  session: Session,
  assessment: Omit<Assessment, 'time'>,
): { session: Session; error?: string } {
  const target = session.events.find((e) => e.id === assessment.eventId)
  if (
    !session.exercise.criteria.some((c) => c.id === assessment.criterionId) ||
    !['not-observed', 'needs-review', 'demonstrated'].includes(assessment.rating) ||
    !assessment.reviewer.trim() ||
    assessment.reviewer.length > 80 ||
    assessment.note.length > 1000 ||
    !target ||
    ['note', 'assessment'].includes(target.kind)
  )
    return {
      session,
      error:
        'Choose a criterion, recorded evidence, rating, and reviewer name (maximum 80 characters); notes are limited to 1,000 characters.',
    }
  const item = {
    ...assessment,
    reviewer: assessment.reviewer.trim(),
    note: assessment.note.trim(),
    time: session.time,
  }
  const assessments = [
    ...session.assessments.filter((a) => a.criterionId !== item.criterionId),
    item,
  ]
  return {
    session: record(
      { ...session, assessments },
      'assessment',
      `${item.reviewer}: ${session.exercise.criteria.find((c) => c.id === item.criterionId)!.title} — ${item.rating}. ${item.note}`,
      { relatedEventId: item.eventId, aircraftId: target.aircraftId },
    ),
  }
}
