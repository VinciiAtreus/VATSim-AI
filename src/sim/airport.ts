import type { Aircraft, Frequency, Point, RunwayId } from './types'

// Deliberately illustrative geometry. Never import this as an operational airport dataset.
export const AIRPORT_DATA = {
  id: 'wmkk-schematic-0.1',
  status: 'illustrative-unverified',
  title: 'WMKK · Kuala Lumpur International',
  note: 'Schematic geometry and demonstration routes. Not validated for operational or approved training use.',
  sourceRegister: 'docs/SOURCE_REGISTER.md',
} as const

export const RUNWAYS: Record<
  RunwayId,
  {
    x: number
    top: number
    bottom: number
    opposite: string
    frequency: Frequency
    hold: Point
    entry: Point
    route: string
    ground: Frequency
  }
> = {
  '33': {
    x: 265,
    top: 110,
    bottom: 630,
    opposite: '15',
    frequency: '119.800',
    hold: { x: 325, y: 585 },
    entry: { x: 265, y: 585 },
    route: 'Z',
    ground: '118.050',
  },
  '32L': {
    x: 580,
    top: 75,
    bottom: 645,
    opposite: '14R',
    frequency: '118.500',
    hold: { x: 635, y: 600 },
    entry: { x: 580, y: 600 },
    route: 'C',
    ground: '121.650',
  },
  '32R': {
    x: 925,
    top: 75,
    bottom: 645,
    opposite: '14L',
    frequency: '118.800',
    hold: { x: 870, y: 600 },
    entry: { x: 925, y: 600 },
    route: 'A',
    ground: '121.650',
  },
}

export const RADIOS: { frequency: Frequency; label: string; short: string; description: string }[] =
  [
    {
      frequency: '121.650',
      label: 'Lumpur Ground',
      short: 'GND EAST',
      description: 'Demonstration ground sector',
    },
    {
      frequency: '118.050',
      label: 'Lumpur Ground',
      short: 'GND WEST',
      description: 'Demonstration western ground sector',
    },
    {
      frequency: '118.800',
      label: 'Lumpur Tower',
      short: 'TWR 32R',
      description: 'Runway 14L / 32R',
    },
    {
      frequency: '118.500',
      label: 'Lumpur Tower',
      short: 'TWR 32L',
      description: 'Runway 14R / 32L',
    },
    { frequency: '119.800', label: 'Lumpur Tower', short: 'TWR 33', description: 'Runway 15 / 33' },
  ]

export const SCENARIOS = [
  {
    id: 'morning',
    code: 'WMKK–01',
    title: 'Morning movements',
    category: 'GROUND & TOWER',
    duration: '15–20 min',
    traffic: '4 aircraft',
    description:
      'Work a small departure queue and an inbound arrival. Practise taxi clearances, runway limits, and frequency transfers.',
    objective:
      'Complete a departure and an arrival while maintaining correct clearance limits and communications.',
  },
  {
    id: 'departure',
    code: 'WMKK–02',
    title: 'Departure fundamentals',
    category: 'GROUND → TOWER',
    duration: '10–15 min',
    traffic: '2 aircraft',
    description:
      'A focused exercise covering pushback, taxi, transfer to tower, line-up, and departure.',
    objective:
      'Guide MAS612 from stand B6 to departure on runway 32R using the demonstration route.',
  },
  {
    id: 'readback',
    code: 'WMKK–03',
    title: 'Readback discipline',
    category: 'COMMUNICATIONS',
    duration: '10–15 min',
    traffic: '3 aircraft',
    description:
      'A scripted incorrect runway readback tests whether you notice and correct the discrepancy.',
    objective:
      'Identify the injected readback error and transmit a correction before the aircraft proceeds.',
  },
] as const

const base = {
  speed: 0,
  heading: 0,
  route: [] as Point[],
  routeIndex: 0,
  pending: true,
  requestAt: 0,
  overdueReported: false,
  holdReported: false,
  runwayOccupied: false,
  clearance: 'Awaiting instructions',
}
export function initialAircraft(scenarioId: string): Aircraft[] {
  const aircraft: Aircraft[] = [
    {
      ...base,
      id: 'MAS612',
      spoken: 'Malaysian six one two',
      type: 'B738',
      wake: 'M',
      stand: 'B6',
      destination: 'WSSS',
      operation: 'departure',
      phase: 'parked',
      position: { x: 770, y: 340 },
      runway: '32R',
      frequency: '121.650',
    },
    {
      ...base,
      id: 'AXM518',
      spoken: 'AirAsia five one eight',
      type: 'A320',
      wake: 'M',
      stand: 'Q4',
      destination: 'WMKP',
      operation: 'departure',
      phase: 'ready',
      position: { x: 400, y: 440 },
      runway: '33',
      frequency: '118.050',
    },
    {
      ...base,
      id: 'MAS1134',
      spoken: 'Malaysian one one three four',
      type: 'A333',
      wake: 'H',
      stand: 'B10',
      destination: 'WMKK',
      operation: 'arrival',
      phase: 'final',
      position: { x: 580, y: 780 },
      runway: '32L',
      frequency: '118.500',
      clearance: 'Established final · awaiting landing clearance',
    },
    {
      ...base,
      id: 'MXD124',
      spoken: 'Batik one two four',
      type: 'B738',
      wake: 'M',
      stand: 'B8',
      destination: 'WBGG',
      operation: 'departure',
      phase: 'parked',
      position: { x: 770, y: 390 },
      runway: '32R',
      frequency: '121.650',
    },
  ]
  if (scenarioId === 'departure') return aircraft.filter((a) => ['MAS612', 'MXD124'].includes(a.id))
  if (scenarioId === 'readback') return aircraft.filter((a) => a.id !== 'MAS1134')
  return aircraft
}

export const PHASE_LABELS: Record<Aircraft['phase'], string> = {
  parked: 'AT STAND',
  pushback: 'PUSHBACK',
  ready: 'READY TO TAXI',
  taxiing: 'TAXIING',
  stopped: 'HOLDING POSITION',
  holding: 'HOLD SHORT',
  'lining-up': 'LINING UP',
  'lined-up': 'LINED UP',
  departing: 'DEPARTING',
  final: 'ON FINAL',
  landing: 'LANDING',
  vacated: 'RUNWAY VACATED',
  'going-around': 'GOING AROUND',
  complete: 'COMPLETE',
}

export function pilotRequest(a: Aircraft): string {
  if (a.phase === 'final')
    return `${a.spoken}, established final runway ${a.runway}, information Alpha.`
  if (a.phase === 'ready') return `Lumpur Ground, ${a.spoken}, ready to taxi, information Alpha.`
  return `Lumpur Ground, ${a.spoken}, stand ${a.stand}, request pushback, information Alpha.`
}
