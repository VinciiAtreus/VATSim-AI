export type Point = { x: number; y: number }
export type RunwayId = '32R' | '32L' | '33'
export type Phase =
  | 'scheduled'
  | 'parked'
  | 'pushback'
  | 'ready'
  | 'taxiing'
  | 'stopped'
  | 'holding'
  | 'lining-up'
  | 'lined-up'
  | 'departing'
  | 'final'
  | 'landing'
  | 'vacated'
  | 'going-around'
  | 'complete'
export type Frequency = '121.650' | '118.050' | '118.800' | '118.500' | '119.800'
export type Aircraft = {
  id: string
  spoken: string
  type: string
  wake: 'M' | 'H'
  stand: string
  destination: string
  operation: 'departure' | 'arrival'
  phase: Phase
  position: Point
  heading: number
  speed: number
  runway: RunwayId
  frequency: Frequency
  route: Point[]
  routeIndex: number
  clearance: string
  pending: boolean
  requestAt: number
  overdueReported: boolean
  holdReported: boolean
  runwayOccupied: boolean
  discrepancy?: { issued: RunwayId; readback: RunwayId }
  landingCleared?: boolean
  approachCallMade?: boolean
  pilotMode: 'scripted' | 'operator'
  motionPaused: boolean
  queuedInstruction?: { eventId: number; text: string; frequency: Frequency }
  activationTime: number
}
export type Weather = { windDirection: number; windSpeed: number; qnh: number; information: string }
export type ExerciseDefinition = {
  id: string
  revision: number
  title: string
  objective: string
  baseScenario: 'morning' | 'departure' | 'readback'
  weather: Weather
  traffic: { profileId: string; callsign: string; spoken: string; releaseAt: number }[]
  triggers: { id: string; at: number; action: 'block' | 'clear' | 'readback'; runway: RunwayId }[]
  requireCoordination: boolean
  automaticCoordination: boolean
  criteria: { id: string; title: string; description: string }[]
}
export type Coordination = {
  id: number
  aircraftId: string
  from: Frequency
  to: Frequency
  status: 'pending' | 'approved' | 'declined'
  requestedAt: number
  decidedAt?: number
}
export type Assessment = {
  criterionId: string
  rating: 'not-observed' | 'needs-review' | 'demonstrated'
  reviewer: string
  note: string
  eventId: number
  time: number
}
export type EventKind =
  | 'system'
  | 'controller'
  | 'pilot'
  | 'instructor'
  | 'operator'
  | 'note'
  | 'coordination'
  | 'assessment'
export type SimEvent = {
  id: number
  time: number
  kind: EventKind
  aircraftId?: string
  text: string
  severity: 'info' | 'attention' | 'critical'
  frequency?: Frequency
  source?: 'scripted' | 'operator'
  relatedEventId?: number
  snapshot: Aircraft[]
  blockedRunway: RunwayId | null
  weather: Weather
  coordination: Coordination[]
}
export type Session = {
  version: 4
  simulation?: {
    sequence: number
    trafficEnabled: boolean
    registry: { callsign: string; profileId: string; releaseAt: number }[]
    nextRelease: Record<string, number>
  }
  id: string
  scenarioId: string
  time: number
  running: boolean
  speed: 1 | 2 | 4
  aircraft: Aircraft[]
  events: SimEvent[]
  nextEventId: number
  guidance: boolean
  injectReadback: boolean
  blockedRunway: RunwayId | null
  completed: number
  attempted: number
  accepted: number
  exercise: ExerciseDefinition
  weather: Weather
  firedTriggers: string[]
  coordination: Coordination[]
  assessments: Assessment[]
}
export type Command =
  | { type: 'pushback'; aircraftId: string }
  | { type: 'taxi'; aircraftId: string; runway: RunwayId; via: string }
  | { type: 'hold'; aircraftId: string }
  | { type: 'handoff'; aircraftId: string; frequency: Frequency }
  | { type: 'lineup'; aircraftId: string; runway: RunwayId }
  | { type: 'takeoff'; aircraftId: string; runway: RunwayId }
  | { type: 'land'; aircraftId: string; runway: RunwayId }
  | { type: 'goaround'; aircraftId: string }
  | { type: 'gate'; aircraftId: string; stand: string; via: string }
  | { type: 'standby'; aircraftId: string }
  | { type: 'correct'; aircraftId: string; runway: RunwayId }
export type ParseResult = { ok: true; command: Command } | { ok: false; error: string }
