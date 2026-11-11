import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { builtinExercise } from '../sim/exercises'
import { loadExercises, removeExercise, storeExercise } from './exerciseStore'
let data: Map<string, string>
beforeEach(() => {
  data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  })
})
afterEach(() => vi.unstubAllGlobals())
describe('local versioned lesson library', () => {
  it('copies builtins, increments revisions and removes a library entry independently', () => {
    const first = storeExercise(builtinExercise('morning'))
    expect(first.id).toMatch(/^custom-/)
    expect(first.revision).toBe(1)
    const second = storeExercise({ ...first, title: 'Revised title' })
    expect(second.id).toBe(first.id)
    expect(second.revision).toBe(2)
    expect(first.title).toBe('Morning movements')
    expect(loadExercises().exercises).toEqual([second])
    removeExercise(second.id)
    expect(loadExercises().exercises).toEqual([])
  })
  it('preserves unreadable records and refuses to overwrite them', () => {
    data.set('vatsim-ai.exercises.v1', '{broken')
    expect(loadExercises().error).toMatch(/preserved/)
    expect(() => storeExercise(builtinExercise('morning'))).toThrow(/preserved/)
    expect(() => removeExercise('unknown')).toThrow(/preserved/)
    expect(data.get('vatsim-ai.exercises.v1')).toBe('{broken')
  })
  it('does not mark an unavailable or failed browser write as saved', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('Storage quota exceeded')
      },
    })
    expect(() => storeExercise(builtinExercise('morning'))).toThrow(/quota/)
    vi.stubGlobal('localStorage', undefined)
    expect(loadExercises().error).toBeDefined()
  })
})
