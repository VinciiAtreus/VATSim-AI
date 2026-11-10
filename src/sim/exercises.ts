import { AIRPORT_DATA, initialAircraft, SCENARIOS } from './airport'
import type { Aircraft, ExerciseDefinition, Weather } from './types'

export const DEFAULT_WEATHER: Weather = {
  windDirection: 320,
  windSpeed: 5,
  qnh: 1012,
  information: 'A',
}
export const EXERCISE_SCHEMA = 'vatsim-ai.exercise.v1'
export function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}
function string(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max
}
function integer(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
}
function invalid(message: string): never {
  throw new Error(`Invalid exercise: ${message}`)
}
export function decodeWeather(v: unknown): Weather {
  if (
    !isObject(v) ||
    !integer(v.windDirection, 0, 360) ||
    !integer(v.windSpeed, 0, 100) ||
    !integer(v.qnh, 900, 1100) ||
    typeof v.information !== 'string' ||
    !/^[A-Z]$/.test(v.information)
  )
    invalid('weather is outside the supported ranges.')
  return {
    windDirection: v.windDirection,
    windSpeed: v.windSpeed,
    qnh: v.qnh,
    information: v.information,
  }
}
export function builtinExercise(id: string): ExerciseDefinition {
  const base = SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]
  return {
    id: base.id,
    revision: 1,
    title: base.title,
    objective: base.objective,
    baseScenario: base.id,
    weather: { ...DEFAULT_WEATHER },
    traffic: initialAircraft(base.id).map((a) => ({
      profileId: a.id,
      callsign: a.id,
      spoken: a.spoken,
      releaseAt: 0,
    })),
    triggers: [],
    requireCoordination: false,
    automaticCoordination: true,
    criteria: [
      {
        id: 'clearances',
        title: 'Clearance accuracy',
        description: 'Review aircraft identity, runway, route, and clearance limits.',
      },
      {
        id: 'readback',
        title: 'Readback monitoring',
        description: 'Review recognition and correction of discrepancies.',
      },
      {
        id: 'coordination',
        title: 'Coordination and workload',
        description: 'Review transfers, response management, and coordination.',
      },
    ],
  }
}
export function decodeExercise(v: unknown): ExerciseDefinition {
  if (
    !isObject(v) ||
    typeof v.id !== 'string' ||
    !/^[a-z][a-z0-9-]{0,79}$/.test(v.id) ||
    !integer(v.revision, 1, 9999) ||
    !string(v.title, 100) ||
    !string(v.objective, 1000) ||
    !['morning', 'departure', 'readback'].includes(v.baseScenario as string) ||
    typeof v.requireCoordination !== 'boolean' ||
    typeof v.automaticCoordination !== 'boolean'
  )
    invalid('identity, briefing, or settings are missing.')
  const profiles = initialAircraft('morning')
  if (!Array.isArray(v.traffic) || v.traffic.length < 1 || v.traffic.length > 4)
    invalid('choose 1–4 modelled traffic profiles.')
  const traffic = v.traffic.map((t) => {
    if (
      !isObject(t) ||
      !profiles.some((a) => a.id === t.profileId) ||
      typeof t.callsign !== 'string' ||
      !/^[A-Z]{3}[0-9]{1,4}$/.test(t.callsign) ||
      !string(t.spoken, 100) ||
      !/^[a-zA-Z0-9 ,'-]+$/.test(t.spoken) ||
      !integer(t.releaseAt, 0, 3600)
    )
      invalid('invalid traffic profile, callsign, or release time.')
    return {
      profileId: t.profileId as string,
      callsign: t.callsign,
      spoken: t.spoken,
      releaseAt: t.releaseAt,
    }
  })
  for (const key of ['profileId', 'callsign', 'spoken'] as const)
    if (new Set(traffic.map((t) => t[key].toLowerCase())).size !== traffic.length)
      invalid(`duplicate traffic ${key}.`)
  if (!Array.isArray(v.triggers) || v.triggers.length > 20) invalid('maximum 20 timed events.')
  const triggers = v.triggers
    .map((t) => {
      if (
        !isObject(t) ||
        !string(t.id, 80) ||
        !integer(t.at, 0, 7200) ||
        !['block', 'clear', 'readback'].includes(t.action as string) ||
        !['32R', '32L', '33'].includes(t.runway as string)
      )
        invalid('invalid timed event.')
      return {
        id: t.id,
        at: t.at,
        action: t.action as ExerciseDefinition['triggers'][number]['action'],
        runway: t.runway as Aircraft['runway'],
      }
    })
    .sort((a, b) => a.at - b.at)
  if (new Set(triggers.map((t) => t.id)).size !== triggers.length)
    invalid('duplicate timed event identifiers.')
  if (!Array.isArray(v.criteria) || v.criteria.length > 12)
    invalid('maximum 12 assessment criteria.')
  const criteria = v.criteria.map((c) => {
    if (
      !isObject(c) ||
      !string(c.id, 80) ||
      !string(c.title, 100) ||
      typeof c.description !== 'string' ||
      c.description.length > 500
    )
      invalid('invalid assessment criterion.')
    return { id: c.id, title: c.title, description: c.description }
  })
  if (new Set(criteria.map((c) => c.id)).size !== criteria.length)
    invalid('duplicate criterion identifiers.')
  return {
    id: v.id,
    revision: v.revision,
    title: v.title,
    objective: v.objective,
    baseScenario: v.baseScenario as ExerciseDefinition['baseScenario'],
    weather: decodeWeather(v.weather),
    traffic,
    triggers,
    criteria,
    requireCoordination: v.requireCoordination,
    automaticCoordination: v.automaticCoordination,
  }
}
export function exerciseAircraft(definition: ExerciseDefinition): Aircraft[] {
  const profiles = initialAircraft('morning')
  return definition.traffic.map((t) => {
    const a = profiles.find((p) => p.id === t.profileId)!
    return {
      ...a,
      id: t.callsign,
      spoken: t.spoken,
      position: { ...a.position },
      route: [],
      phase: t.releaseAt ? 'scheduled' : a.phase,
      pending: t.releaseAt === 0,
      activationTime: t.releaseAt,
      requestAt: t.releaseAt,
    }
  })
}
export function exerciseExport(exercise: ExerciseDefinition) {
  return { schema: EXERCISE_SCHEMA, dataset: AIRPORT_DATA.id, exercise: decodeExercise(exercise) }
}
export function parseExerciseFile(text: string): ExerciseDefinition {
  if (new Blob([text]).size > 128 * 1024) invalid('file exceeds 128 KB.')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    invalid('file is not valid JSON.')
  }
  if (!isObject(value) || value.schema !== EXERCISE_SCHEMA || value.dataset !== AIRPORT_DATA.id)
    invalid('unsupported exercise file or dataset.')
  return decodeExercise(value.exercise)
}
