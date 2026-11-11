import type { Aircraft, RunwayId, Session } from '../sim/types'
import { RUNWAYS } from '../sim/airport'
export const holdingPoint = (runway: RunwayId) =>
  runway === '33' ? 'Y1' : runway === '32R' ? 'A1' : 'C1'
export const squawk = (a: Aircraft) =>
  ({ MAS612: '2341', MXD124: '2342', AXM518: '2343', MAS1134: '4512' })[a.id] ?? '2000'
export const rfl = (a: Aircraft) =>
  ({ MAS612: 'FL230', MXD124: 'FL370', AXM518: 'FL200' })[a.id] ?? '—'
export const bayNames = [
  'RUNWAY',
  'FINAL',
  'HOLDING POINT',
  'TAXI',
  'PUSH / START',
  'STANDS',
] as const
export function bayFor(a: Aircraft): string {
  if (a.runwayOccupied || ['lining-up', 'lined-up', 'departing', 'landing'].includes(a.phase))
    return 'RUNWAY'
  if (['final', 'going-around'].includes(a.phase)) return 'FINAL'
  if (a.phase === 'holding') return 'HOLDING POINT'
  if (['taxiing', 'stopped', 'vacated'].includes(a.phase)) return 'TAXI'
  if (['pushback', 'ready'].includes(a.phase)) return 'PUSH / START'
  return 'STANDS'
}
// Schematic approach units: 25 units represent the 0.5 NM exercise decision point.
export const distanceNm = (a: Aircraft) =>
  Math.max(0, (a.position.y - RUNWAYS[a.runway].bottom) / 50)
export const stopBarOff = (aircraft: Aircraft[], runway: RunwayId) =>
  aircraft.some((a) => a.runway === runway && a.phase === 'lining-up')
export type Alert = { id: string; text: string; level: 'caution' | 'critical'; aircraftId?: string }
export function safetyAlerts(s: Session): Alert[] {
  const result: Alert[] = []
  for (const a of s.aircraft) {
    if (a.phase === 'final' && !a.landingCleared && distanceNm(a) < 2.5)
      result.push({
        id: `landing-${a.id}`,
        text: `NO LANDING CLEARANCE · ${a.id} ${distanceNm(a).toFixed(1)} NM`,
        level: distanceNm(a) < 1.5 ? 'critical' : 'caution',
        aircraftId: a.id,
      })
    if (a.discrepancy)
      result.push({
        id: `readback-${a.id}`,
        text: `CHECK READBACK · ${a.id}`,
        level: 'critical',
        aircraftId: a.id,
      })
  }
  for (const runway of Object.keys(RUNWAYS) as RunwayId[]) {
    const occupants = s.aircraft.filter((a) => a.runway === runway && a.runwayOccupied)
    const clearedArrivals = s.aircraft.filter(
      (a) => a.runway === runway && a.phase === 'final' && a.landingCleared,
    )
    if (
      occupants.length + Number(s.blockedRunway === runway) > 1 ||
      (clearedArrivals.length && (occupants.length || s.blockedRunway === runway))
    )
      result.push({
        id: `occupancy-${runway}`,
        text: `MULTIPLE OCCUPANCY · ${runway}`,
        level: 'critical',
        aircraftId: occupants[0]?.id ?? clearedArrivals[0]?.id,
      })
    else if (s.blockedRunway === runway)
      result.push({
        id: `obstruction-${runway}`,
        text: `RWY OCCUPIED · ${runway} VEHICLE`,
        level: 'caution',
      })
  }
  return result
}
export const utcTime = (date: Date | string) => new Date(date).toISOString().slice(11, 19)
