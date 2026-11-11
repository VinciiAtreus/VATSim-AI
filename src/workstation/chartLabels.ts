import {
  chart,
  CONTEXT_LINES,
  HOLD_NAMES,
  PARKING_STANDS,
  STANDS,
  TERMINALS,
} from '../sim/geometry'
import { RUNWAYS } from '../sim/airport'
import type { Point } from '../sim/types'
import type { MapLabel } from './labels'
export type ChartLabel = {
  id: string
  text: string
  position: Point
  kind: 'runway' | 'holding' | 'terminal' | 'stand' | 'taxi'
}
export const chartLabels: ChartLabel[] = [
  ...Object.entries(RUNWAYS).flatMap(([id, r]): ChartLabel[] => [
    { id: `runway-${id}`, text: id, position: { x: r.x, y: r.bottom }, kind: 'runway' },
    { id: `opposite-${id}`, text: r.opposite, position: { x: r.x, y: r.top }, kind: 'runway' },
    {
      id: `hold-${id}`,
      text: `${HOLD_NAMES[id as keyof typeof RUNWAYS]} HOLD`,
      position: r.hold,
      kind: 'holding',
    },
  ]),
  ...Object.entries(STANDS).map(([id, position]): ChartLabel => ({
    id: `stand-${id}`,
    text: id,
    position,
    kind: 'stand',
  })),
  ...TERMINALS.map((t) => {
    const points = t.points.map(([x, y]) => chart(x, y))
    return {
      id: t.name,
      text: t.name,
      kind: 'terminal' as const,
      position: {
        x: points.reduce((s, p) => s + p.x, 0) / points.length,
        y: points.reduce((s, p) => s + p.y, 0) / points.length,
      },
    }
  }),
  ...PARKING_STANDS.filter((s) => !Object.hasOwn(STANDS, s.name)).map((s) => ({
    id: `stand-${s.name}`,
    text: s.name,
    position: s.position,
    kind: 'stand' as const,
  })),
  ...CONTEXT_LINES.filter((line, i, all) => all.findIndex((l) => l.name === line.name) === i).map(
    (line) => ({
      id: `taxi-${line.name}`,
      text: line.name,
      position: line.points[Math.floor(line.points.length / 2)],
      kind: 'taxi' as const,
    }),
  ),
]
export const intersects = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  gap = 4,
) =>
  a.x < b.x + b.width + gap &&
  a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap &&
  a.y + a.height + gap > b.y
export function layoutChartLabels(
  project: (p: Point) => Point,
  viewport: { width: number; height: number },
  reserved: MapLabel[],
  options: { stands: boolean; taxiways: boolean; zoom: number; selectedStand?: string },
) {
  const placed: (ChartLabel & { x: number; y: number; width: number; height: number })[] = []
  const candidates = chartLabels.filter(
    (l) =>
      l.kind === 'runway' ||
      (l.kind === 'holding' && options.taxiways) ||
      (l.kind === 'terminal' && options.stands) ||
      (l.kind === 'stand' &&
        options.stands &&
        (options.zoom >= 3 || l.text === options.selectedStand)) ||
      (l.kind === 'taxi' && options.taxiways && options.zoom >= 3),
  )
  const priority = (l: ChartLabel) =>
    l.text === options.selectedStand
      ? 0
      : l.kind === 'runway'
        ? 1
        : l.kind === 'holding'
          ? 2
          : l.kind === 'terminal'
            ? 3
            : 4
  for (const label of [...candidates].sort((a, b) => priority(a) - priority(b))) {
    const p = project(label.position),
      width = label.text.length * 6.7 + 8,
      height = 18
    const r = {
      ...label,
      x: p.x - width / 2,
      y: p.y - (label.kind === 'stand' ? 23 : 25),
      width,
      height,
    }
    if (
      r.x < 8 ||
      r.y < 8 ||
      r.x + width > viewport.width - 8 ||
      r.y + height > viewport.height - 8
    )
      continue
    if ([...reserved, ...placed].some((other) => intersects(r, other))) continue
    placed.push(r)
  }
  return placed
}
