import type { Aircraft, Frequency, ParseResult, RunwayId } from './types'

const digits: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  tree: '3',
  four: '4',
  five: '5',
  fife: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  niner: '9',
}
const phonetics: Record<string, string> = {
  alpha: 'a',
  alfa: 'a',
  bravo: 'b',
  charlie: 'c',
  delta: 'd',
  echo: 'e',
  foxtrot: 'f',
  golf: 'g',
  hotel: 'h',
  india: 'i',
  juliett: 'j',
  kilo: 'k',
  lima: 'l',
  mike: 'm',
  november: 'n',
  oscar: 'o',
  papa: 'p',
  quebec: 'q',
  romeo: 'r',
  sierra: 's',
  tango: 't',
  uniform: 'u',
  victor: 'v',
  whiskey: 'w',
  xray: 'x',
  yankee: 'y',
  zulu: 'z',
}
function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/\bmalaysian\b/g, 'mas')
    .replace(/\bair\s?asia\b/g, 'axm')
    .replace(/\bbatik(?:\s+air)?\b/g, 'mxd')
    .replace(
      /\b(zero|one|two|three|tree|four|five|fife|six|seven|eight|nine|niner)\b/g,
      (word) => digits[word],
    )
    .replace(
      /\b(alpha|alfa|bravo|charlie|delta|echo|foxtrot|golf|hotel|india|juliett|kilo|lima|mike|november|oscar|papa|quebec|romeo|sierra|tango|uniform|victor|whiskey|xray|yankee|zulu)\b/g,
      (word) => phonetics[word],
    )
    .replace(/\b(right|left)\b/g, (word) => (word === 'right' ? 'r' : 'l'))
    .replace(/(?<=\d)\s+(?=\d)/g, '')
    .replace(/(?<=\d)\s+(?=[rl]\b)/g, '')
    .replace(/\b(mas|axm|mxd)\s+(?=\d)/g, '$1')
    .replace(/[,;!]/g, ' ')
    .replace(/\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseTransmission(input: string, aircraft: Aircraft[]): ParseResult {
  if (!input.trim())
    return { ok: false, error: 'Enter a callsign and an instruction before transmitting.' }
  const text = normalize(input)
  const callsigns = text.match(/\b[a-z]{3}\d{1,4}\b/g) ?? []
  if (callsigns.length !== 1)
    return {
      ok: false,
      error: 'Address exactly one aircraft using its full callsign, for example MAS612.',
    }
  const a = aircraft.find((item) => item.id.toLowerCase() === callsigns[0])
  if (!a)
    return { ok: false, error: `Callsign ${callsigns[0].toUpperCase()} is not in this exercise.` }
  const body = text.replace(callsigns[0], '').trim()
  const runwayMatches = [...body.matchAll(/\brunway\s*(\d{2}[rl]?)\b/g)].map((m) =>
    m[1].toUpperCase(),
  )
  if (new Set(runwayMatches).size > 1)
    return {
      ok: false,
      error: 'The instruction contains conflicting runway designators. Clarify the runway.',
    }
  const runway = runwayMatches[0] as RunwayId | undefined
  if (runway && !['32R', '32L', '33'].includes(runway))
    return {
      ok: false,
      error: `Runway ${runway} is outside this exercise configuration. Available: 32R, 32L, 33.`,
    }
  const aircraftId = a.id
  if (/^(?:pushback (?:and start(?:up)? )?approved|start(?:up)? and pushback approved)$/.test(body))
    return { ok: true, command: { type: 'pushback', aircraftId } }
  if (/^(?:hold position|stop immediately)$/.test(body))
    return { ok: true, command: { type: 'hold', aircraftId } }
  if (/^stand\s?by$/.test(body)) return { ok: true, command: { type: 'standby', aircraftId } }
  if (/^go around$/.test(body)) return { ok: true, command: { type: 'goaround', aircraftId } }
  if (runway && /^negative\s+(?:i say again\s+)?runway\s*\d{2}[rl]?$/.test(body))
    return { ok: true, command: { type: 'correct', aircraftId, runway } }
  if (/^contact (?:lumpur )?(?:tower|ground)\s+\d{3}\.\d{1,3}$/.test(body)) {
    const match = body.match(/(\d{3})\.(\d{1,3})$/)!
    const frequency = `${match[1]}.${match[2].padEnd(3, '0')}` as Frequency
    const tower = /tower/.test(body)
    const allowed = tower ? ['118.800', '118.500', '119.800'] : ['121.650', '118.050']
    if (!allowed.includes(frequency))
      return {
        ok: false,
        error: 'That station and frequency do not match a radio in this exercise.',
      }
    return { ok: true, command: { type: 'handoff', aircraftId, frequency } }
  }
  if (
    runway &&
    /^taxi (?:to (?:holding point )?)?runway\s*\d{2}[rl]? via [a-z][a-z0-9 ]*?(?: hold short(?: of)? runway\s*\d{2}[rl]?)?$/.test(
      body,
    )
  ) {
    const via = body
      .match(/via ([a-z0-9 ]+?)(?: hold|$)/)![1]
      .replace(/([a-z]) +(?=\d)/g, '$1')
      .toUpperCase()
    return { ok: true, command: { type: 'taxi', aircraftId, runway, via } }
  }
  const gate = body.match(/^taxi to stand ([a-z]\d{1,2}) via ([a-z][a-z0-9 ]*)$/)
  if (gate)
    return {
      ok: true,
      command: {
        type: 'gate',
        aircraftId,
        stand: gate[1].toUpperCase(),
        via: gate[2].replace(/([a-z]) +(?=\d)/g, '$1').toUpperCase(),
      },
    }
  if (
    runway &&
    /^(?:runway\s*\d{2}[rl]? line up and wait|line up and wait runway\s*\d{2}[rl]?)$/.test(body)
  )
    return { ok: true, command: { type: 'lineup', aircraftId, runway } }
  if (
    runway &&
    /^(?:runway\s*\d{2}[rl]? cleared for take\s?off|cleared for take\s?off runway\s*\d{2}[rl]?)$/.test(
      body,
    )
  )
    return { ok: true, command: { type: 'takeoff', aircraftId, runway } }
  if (
    runway &&
    /^(?:runway\s*\d{2}[rl]? cleared to land|cleared to land runway\s*\d{2}[rl]?)$/.test(body)
  )
    return { ok: true, command: { type: 'land', aircraftId, runway } }
  return {
    ok: false,
    error:
      'Instruction not recognised. Use the command reference or a suggested transmission; no aircraft state was changed.',
  }
}
