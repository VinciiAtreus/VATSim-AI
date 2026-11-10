export type Point = { x: number; y: number }
export type RunwayId = '32R' | '32L' | '33'
export type Phase =
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
}
export type EventKind = 'system' | 'controller' | 'pilot' | 'instructor'
export type SimEvent = {
  id: number
  time: number
  kind: EventKind
  aircraftId?: string
  text: string
  severity: 'info' | 'attention' | 'critical'
  frequency?: Frequency
  snapshot: Aircraft[]
  blockedRunway: RunwayId | null
}
export type Session = {
  version: 1
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
