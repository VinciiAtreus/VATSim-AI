import type { Aircraft } from '../sim/types'
import { RUNWAYS } from '../sim/airport'
import { holdingPoint } from './model'
const digits = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const letters: Record<string, string> = {
  A: 'Alpha',
  B: 'Bravo',
  C: 'Charlie',
  D: 'Delta',
  E: 'Echo',
  F: 'Foxtrot',
  G: 'Golf',
  H: 'Hotel',
  I: 'India',
  J: 'Juliett',
  K: 'Kilo',
  L: 'Lima',
  M: 'Mike',
  N: 'November',
  O: 'Oscar',
  P: 'Papa',
  Q: 'Quebec',
  R: 'Romeo',
  S: 'Sierra',
  T: 'Tango',
  U: 'Uniform',
  V: 'Victor',
  W: 'Whiskey',
  X: 'X-ray',
  Y: 'Yankee',
  Z: 'Zulu',
}
const spoken = (value: string) =>
  value
    .split('')
    .map((c) => digits[Number(c)] ?? letters[c] ?? c)
    .join(' ')
export function speechHints(aircraft: Aircraft[]): string[] {
  const active = aircraft.filter((a) => !['scheduled', 'complete'].includes(a.phase))
  return [
    ...new Set([
      ...active.flatMap((a) => [
        a.spoken,
        `${a.spoken.replace(/\s+(?:zero|one|two|three|four|five|six|seven|eight|nine)(?:\s|$).*/, '')} ${a.id.replace(/^\D+/, '')}`,
        a.id,
      ]),
      'Lumpur Ground',
      'Lumpur Tower',
      'pushback and start-up approved',
      'line up and wait',
      'cleared for take-off',
      'cleared to land',
      'hold short',
      'continue taxi',
      'say again',
      ...Object.keys(RUNWAYS).map(
        (r) =>
          `runway ${spoken(r.slice(0, 2))}${r.endsWith('R') ? ' right' : r.endsWith('L') ? ' left' : ''}`,
      ),
      ...active.flatMap((a) => [
        `holding point ${spoken(holdingPoint(a.runway))}`,
        `stand ${spoken(a.stand)}`,
      ]),
    ]),
  ].slice(0, 60)
}
