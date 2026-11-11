import { METRES_PER_UNIT, STANDS } from './geometry'
import type { Aircraft, Point } from './types'
const metres = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) * METRES_PER_UNIT
const toMps = (knots: number) => (knots * 1852) / 3600
const toKnots = (mps: number) => (mps * 3600) / 1852

// Exercise kinematics, not a certified aircraft performance model. Speeds are
// groundspeeds; taxi braking anticipates corners and the clearance limit.
export function movementStep(a: Aircraft, dt: number): { speed: number; distance: number } {
  const remaining = a.route.slice(a.routeIndex)
  if (!remaining.length) return { speed: 0, distance: 0 }
  const next = remaining[0]
  let target =
    a.phase === 'pushback'
      ? 4
      : a.phase === 'lining-up'
        ? 8
        : a.phase === 'taxiing'
          ? 15
          : a.phase === 'landing'
            ? 110
            : 145
  const ground = ['pushback', 'taxiing', 'lining-up'].includes(a.phase)
  const acceleration =
    a.phase === 'pushback'
      ? 0.3
      : a.phase === 'departing'
        ? 2
        : a.phase === 'going-around'
          ? 1.5
          : 0.6
  const braking = a.phase === 'landing' ? 1.5 : 0.8
  if (a.phase === 'taxiing') {
    if (Object.values(STANDS).some((p) => metres(a.position, p) < 200)) target = 8
    if (remaining.length > 1) {
      const b = remaining[1],
        vx = next.x - a.position.x,
        vy = next.y - a.position.y,
        wx = b.x - next.x,
        wy = b.y - next.y
      const denom = Math.hypot(vx, vy) * Math.hypot(wx, wy)
      if (denom && (vx * wx + vy * wy) / denom < Math.cos(Math.PI / 6))
        target = Math.min(
          target,
          toKnots(Math.sqrt(toMps(7) ** 2 + 2 * braking * metres(a.position, next))),
        )
    }
  }
  if (a.phase === 'landing')
    target = Math.min(
      target,
      toKnots(Math.sqrt(toMps(8) ** 2 + 2 * braking * metres(a.position, next))),
    )
  if (ground) {
    let distance = metres(a.position, next)
    for (let i = 1; i < remaining.length; i++) distance += metres(remaining[i - 1], remaining[i])
    target = Math.min(target, Math.max(1, toKnots(Math.sqrt(2 * braking * distance))))
  }
  const current = toMps(a.speed),
    desired = toMps(target)
  const speed =
    current < desired
      ? Math.min(desired, current + acceleration * dt)
      : Math.max(desired, current - braking * dt)
  return { speed: toKnots(speed), distance: (((current + speed) / 2) * dt) / METRES_PER_UNIT }
}
