import { MAP_ROTATION } from '../sim/geometry'
import type { Aircraft, Point } from '../sim/types'
export type MapLabel = {
  id: string
  x: number
  y: number
  width: number
  height: number
  compact: boolean
}
export function rotatePoint(p: Point): Point {
  const radians = (MAP_ROTATION * Math.PI) / 180
  return {
    x: 470 + (p.x - 470) * Math.cos(radians) - (p.y - 380) * Math.sin(radians),
    y: 380 + (p.x - 470) * Math.sin(radians) + (p.y - 380) * Math.cos(radians),
  }
}
// Work in screen-aligned SVG coordinates; expanded bounds include the full text.
export function placeLabels(aircraft: Aircraft[], scale = 1): MapLabel[] {
  const placed: MapLabel[] = []
  const overlaps = (r: MapLabel) =>
    placed.some(
      (p) =>
        r.x < p.x + p.width + 6 &&
        r.x + r.width + 6 > p.x &&
        r.y < p.y + p.height + 6 &&
        r.y + r.height + 6 > p.y,
    )
  for (const a of aircraft) {
    const p = rotatePoint(a.position)
    const width = 122 * scale,
      height = 40 * scale
    const offsets = [
      [18, -44],
      [18, 12],
      [-width - 18, -44],
      [-width - 18, 12],
      [-width / 2, -65],
      [-width / 2, 28],
      [26, -height / 2],
      [-width - 26, -height / 2],
    ]
    let label = offsets
      .map(([dx, dy]) => ({ id: a.id, x: p.x + dx, y: p.y + dy, width, height, compact: false }))
      .find((r) => !overlaps(r))
    if (!label) {
      // Compact labels are packed in deterministic free slots outside the cluster.
      const compactWidth = Math.max(78 * scale, a.id.length * 12 * scale)
      for (let ring = 1; !label; ring++)
        for (let slot = 0; slot < 16; slot++) {
          const angle = (slot * Math.PI) / 8
          const candidate = {
            id: a.id,
            x: p.x + Math.cos(angle) * ring * 55,
            y: p.y + Math.sin(angle) * ring * 45,
            width: compactWidth,
            height: 24 * scale,
            compact: true,
          }
          if (!overlaps(candidate)) {
            label = candidate
            break
          }
        }
    }
    placed.push(label)
  }
  return placed
}
