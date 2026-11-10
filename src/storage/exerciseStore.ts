import { decodeExercise } from '../sim/exercises'
import type { ExerciseDefinition } from '../sim/types'
const KEY = 'vatsim-ai.exercises.v1'
export function loadExercises(): { exercises: ExerciseDefinition[]; error?: string } {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw) || raw.length > 30) throw new Error('Invalid lesson library.')
    const exercises = raw.map(decodeExercise)
    if (new Set(exercises.map((e) => e.id)).size !== exercises.length)
      throw new Error('Duplicate lesson identity.')
    return { exercises }
  } catch {
    return {
      exercises: [],
      error:
        'The local lesson library could not be read. Existing data is preserved; lesson JSON export and running an unsaved lesson remain available.',
    }
  }
}
export function storeExercise(exercise: ExerciseDefinition): ExerciseDefinition {
  const current = loadExercises()
  if (current.error) throw new Error(current.error)
  if (['morning', 'departure', 'readback'].includes(exercise.id))
    exercise = { ...exercise, id: `custom-${crypto.randomUUID()}`, revision: 1 }
  const previous = current.exercises.find((e) => e.id === exercise.id)
  const saved = decodeExercise({
    ...exercise,
    revision: previous ? previous.revision + 1 : exercise.revision,
  })
  const next = [...current.exercises.filter((e) => e.id !== saved.id), saved]
  if (next.length > 30)
    throw new Error(
      'The local library holds 30 lessons. Export and remove a lesson before adding another.',
    )
  localStorage.setItem(KEY, JSON.stringify(next))
  return saved
}
export function removeExercise(id: string): void {
  const current = loadExercises()
  if (current.error) throw new Error(current.error)
  localStorage.setItem(KEY, JSON.stringify(current.exercises.filter((e) => e.id !== id)))
}
