import { describe, expect, it } from 'vitest'
import { RUNWAYS } from './airport'
import {
  ARRIVAL_PATH,
  DEPARTURE_PATH_IDS,
  METRES_PER_UNIT,
  NODES,
  PUSHBACK,
  STANDS,
  SURFACE_EDGES,
  departurePath,
  knotsToUnitsPerSecond,
} from './geometry'
import { createSession, tick, transmit } from './engine'
import { decodeSession } from './sessionCodec'
import { sessionExport } from './engine'
import type { Point, RunwayId } from './types'

const edge = (a: Point, b: Point) =>
  SURFACE_EDGES.some(
    ([from, to]) =>
      (NODES[from] === a && NODES[to] === b) || (NODES[from] === b && NODES[to] === a),
  )

describe('chart registration and connected movement', () => {
  it('uses published dimensions and a single metric speed scale', () => {
    for (const [id, length] of [
      ['33', 3960],
      ['32L', 4000],
      ['32R', 4019],
    ] as [RunwayId, number][]) {
      expect((RUNWAYS[id].bottom - RUNWAYS[id].top) * METRES_PER_UNIT).toBeCloseTo(length, 6)
      expect(Math.abs(RUNWAYS[id].hold.x - RUNWAYS[id].x) * METRES_PER_UNIT).toBeGreaterThan(75)
    }
    expect(knotsToUnitsPerSecond(15) * METRES_PER_UNIT * 3600).toBeCloseTo(15 * 1852)
  })
  it('connects every supported departure and arrival segment through the rendered network', () => {
    for (const ids of Object.values(DEPARTURE_PATH_IDS))
      ids
        .slice(1)
        .forEach((id, i) => expect(edge(NODES[ids[i]], NODES[id]), `${ids[i]} → ${id}`).toBe(true))
    ARRIVAL_PATH.slice(1).forEach((p, i) => expect(edge(ARRIVAL_PATH[i], p)).toBe(true))
    expect(DEPARTURE_PATH_IDS['33'].some((id) => id.startsWith('R'))).toBe(false)
  })
  it('resumes an interrupted taxi on the remaining segment without a direct apron shortcut', () => {
    const a = NODES.Astart,
      b = NODES.A
    const position = { x: a.x + (b.x - a.x) * 0.4, y: a.y + (b.y - a.y) * 0.4 }
    const route = departurePath('B6', '32R', position)
    expect(route[0]).toEqual(b)
    expect(route.at(-1)).toEqual(RUNWAYS['32R'].hold)
  })
  it('rejects the former incomplete clearance and stops at A11 until a separate line-up', () => {
    let s = createSession('departure')
    s = transmit(s, 'MAS612, pushback approved', '121.650').session
    s = tick({ ...s, running: true }, 150)
    expect(s.aircraft[0].position).toEqual(PUSHBACK.B6)
    expect(transmit(s, 'MAS612, taxi runway 32R via A', '121.650').error).toMatch(/route/)
    s = transmit(s, `MAS612, taxi runway 32R via ${RUNWAYS['32R'].route}`, '121.650').session
    s = tick(s, 1000)
    expect(s.aircraft[0].phase).toBe('holding')
    expect(s.aircraft[0].position).toEqual(RUNWAYS['32R'].hold)
    expect(s.aircraft[0].runwayOccupied).toBe(false)
    expect(STANDS.B6).not.toEqual(PUSHBACK.B6)
  })
  it('refuses old schematic coordinates without mutating the record', () => {
    const saved = { ...sessionExport(createSession()), dataset: 'wmkk-schematic-0.1' }
    const before = JSON.stringify(saved)
    expect(() => decodeSession(saved)).toThrow(/incompatible.*Original records are preserved/)
    expect(JSON.stringify(saved)).toBe(before)
  })
  it('uses the published WSS departure route and stops the Q4 aircraft at Y9', () => {
    let s = createSession()
    s = transmit(s, 'AXM518, taxi runway 33 via U5 Z Z8 Y Y9', '118.050').session
    s = tick({ ...s, running: true }, 1000)
    const a = s.aircraft.find((a) => a.id === 'AXM518')!
    expect(a.position).toEqual(RUNWAYS['33'].hold)
    expect(a.phase).toBe('holding')
    expect(a.runwayOccupied).toBe(false)
  })
  it('continues takeoff north beyond the threshold rather than returning to a literal display coordinate', () => {
    let s = createSession('departure')
    s.aircraft[0] = {
      ...s.aircraft[0],
      phase: 'lined-up',
      position: { ...RUNWAYS['32R'].entry },
      frequency: '118.800',
      runwayOccupied: true,
    }
    s = transmit(s, 'MAS612, runway 32R cleared for takeoff', '118.800').session
    expect(s.aircraft[0].route.map((p) => p.y)).toEqual([
      RUNWAYS['32R'].top,
      RUNWAYS['32R'].top - 200,
    ])
    s = tick({ ...s, running: true }, 150)
    expect(s.aircraft[0].phase).toBe('complete')
    expect(s.aircraft[0].position.y).toBeLessThan(RUNWAYS['32R'].top)
  })
})
