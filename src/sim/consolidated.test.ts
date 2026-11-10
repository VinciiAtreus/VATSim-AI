import { describe, expect, it } from 'vitest'
import { builtinExercise, decodeExercise, exerciseExport, parseExerciseFile } from './exercises'
import {
  addObservation,
  assessCriterion,
  createSession,
  decideCoordination,
  requestCoordination,
  sessionExport,
  setPilotMode,
  tick,
  transmit,
  updateWeather,
} from './engine'
import { decodeSession, forkSession } from './sessionCodec'
import { radioCsv, sessionReport } from './reports'
import type { ExerciseDefinition, Session } from './types'
function definition(): ExerciseDefinition {
  return {
    ...builtinExercise('morning'),
    id: 'custom-integration',
    title: 'Integration exercise',
    requireCoordination: true,
    automaticCoordination: false,
  }
}
function send(s: Session, text: string, f = '121.650') {
  const result = transmit(s, text, f as Session['aircraft'][number]['frequency'])
  expect(result.error).toBeUndefined()
  return result.session
}
function holding() {
  let s = createSession('', definition())
  s = send(s, 'MAS612, pushback approved')
  s = tick({ ...s, running: true }, 35)
  s = send(s, 'MAS612, taxi runway 32R via A')
  return tick(s, 140)
}

describe('authored exercises and integrated runtime', () => {
  it('isolates running definitions from later edits and round-trips portable lessons', () => {
    const d = definition()
    const s = createSession('', d)
    d.title = 'Edited later'
    d.weather.qnh = 990
    d.traffic[0].callsign = 'MAS999'
    expect(s.exercise.title).toBe('Integration exercise')
    expect(s.weather.qnh).toBe(1012)
    expect(s.aircraft[0].id).toBe('MAS612')
    expect(parseExerciseFile(JSON.stringify(exerciseExport(s.exercise)))).toEqual(s.exercise)
    expect(() => parseExerciseFile('{broken')).toThrow(/valid JSON/)
    expect(() => parseExerciseFile(' '.repeat(128 * 1024 + 1))).toThrow(/128 KB/)
  })
  it.each([
    'duplicate-callsign',
    'duplicate-profile',
    'bad-weather',
    'empty-traffic',
    'unknown-profile',
    'bad-release',
    'duplicate-trigger',
    'empty-title',
    'duplicate-criterion',
  ])('rejects invalid authoring data: %s', (kind) => {
    const d = definition()
    if (kind === 'duplicate-callsign') d.traffic[1].callsign = d.traffic[0].callsign
    if (kind === 'duplicate-profile') d.traffic[1].profileId = d.traffic[0].profileId
    if (kind === 'bad-weather') d.weather.qnh = NaN
    if (kind === 'empty-traffic') d.traffic = []
    if (kind === 'unknown-profile') d.traffic[0].profileId = 'unknown'
    if (kind === 'bad-release') d.traffic[0].releaseAt = -1
    if (kind === 'duplicate-trigger')
      d.triggers = [
        { id: 'same', at: 1, action: 'block', runway: '32R' },
        { id: 'same', at: 2, action: 'clear', runway: '32R' },
      ]
    if (kind === 'empty-title') d.title = ' '
    if (kind === 'duplicate-criterion') d.criteria.push({ ...d.criteria[0] })
    expect(() => decodeExercise(d)).toThrow(/Invalid exercise/)
  })
  it('releases scheduled traffic once and uses authored callsigns and information', () => {
    const d = definition()
    d.weather.information = 'C'
    d.traffic = d.traffic.filter((t) => t.profileId === 'MAS612')
    d.traffic[0] = {
      ...d.traffic[0],
      callsign: 'MAS900',
      spoken: 'Malaysian nine zero zero',
      releaseAt: 10,
    }
    let s = createSession('', d)
    expect(s.aircraft[0].phase).toBe('scheduled')
    expect(s.events.filter((e) => e.kind === 'pilot')).toHaveLength(0)
    expect(transmit(s, 'MAS900, pushback approved', '121.650').error).toMatch(/not entered/)
    s = tick({ ...s, running: true }, 9)
    expect(s.aircraft[0].phase).toBe('scheduled')
    s = tick(s, 1)
    expect(s.aircraft[0].phase).toBe('parked')
    expect(s.events.at(-1)?.text).toMatch(/information Charlie/)
    s = tick(s, 5)
    expect(s.events.filter((e) => e.text.includes('entered the exercise'))).toHaveLength(1)
    expect(decodeSession(sessionExport(s)).session.aircraft[0].id).toBe('MAS900')
  })
  it('fires ordered timed events exactly once under accelerated time and recovery', () => {
    const d = definition()
    d.triggers = [
      { id: 'block', at: 2, action: 'block', runway: '33' },
      { id: 'clear', at: 4, action: 'clear', runway: '33' },
      { id: 'readback', at: 6, action: 'readback', runway: '32R' },
    ]
    let s = tick({ ...createSession('', d), running: true, speed: 4 }, 2)
    expect(s.firedTriggers).toEqual(['block', 'clear', 'readback'])
    expect(s.blockedRunway).toBe(null)
    expect(s.injectReadback).toBe(true)
    const snapshots = s.events.filter((e) => e.text.startsWith('Timed event'))
    expect(snapshots).toHaveLength(3)
    expect(snapshots[0].blockedRunway).toBe('33')
    expect(snapshots[1].blockedRunway).toBe(null)
    s = decodeSession(sessionExport(s)).session
    s = tick({ ...s, running: true }, 10)
    expect(s.events.filter((e) => e.text.startsWith('Timed event'))).toHaveLength(3)
  })
  it('requires station acceptance separately from radio handoff and preserves ownership on decline', () => {
    let s = holding()
    const original = s
    expect(transmit(s, 'MAS612, contact Lumpur Tower 118.800', '121.650').error).toMatch(
      /coordination required/,
    )
    s = requestCoordination(s, 'MAS612').session
    expect(s.aircraft[0].frequency).toBe('121.650')
    expect(original.coordination).toHaveLength(0)
    expect(requestCoordination(s, 'MAS612').error).toMatch(/already/)
    const id = s.coordination[0].id
    s = decideCoordination(s, id, false).session
    expect(s.aircraft[0].frequency).toBe('121.650')
    s = requestCoordination(s, 'MAS612').session
    s = decideCoordination(s, s.coordination[1].id, true).session
    s = send(s, 'MAS612, contact Lumpur Tower 118.800')
    expect(s.aircraft[0].frequency).toBe('118.800')
    const recovered = decodeSession(sessionExport(s)).session
    expect(recovered.coordination).toEqual(s.coordination)
    expect(decideCoordination(s, id, true).error).toMatch(/no longer pending/)
  })
  it('uses exercise time for scripted adjacent-station replies and pauses their timer', () => {
    let s = holding()
    s = { ...s, exercise: { ...s.exercise, automaticCoordination: true } }
    s = requestCoordination(s, 'MAS612').session
    s = tick(s, 7)
    expect(s.coordination[0].status).toBe('pending')
    expect(tick({ ...s, running: false }, 50).coordination[0].status).toBe('pending')
    s = tick(s, 1)
    expect(s.coordination[0].status).toBe('approved')
    expect(s.aircraft[0].frequency).toBe('121.650')
    expect(decodeSession(sessionExport(s)).session.coordination[0].status).toBe('approved')
  })
  it('records weather independently in live state and historical snapshots', () => {
    let s = createSession()
    const historical = s.events[0].weather
    s = updateWeather(s, { windDirection: 150, windSpeed: 15, qnh: 1004, information: 'B' }).session
    expect(s.events[0].weather).toEqual(historical)
    expect(s.events.at(-1)?.weather.qnh).toBe(1004)
    expect(s.exercise.weather.qnh).toBe(1012)
    expect(updateWeather(s, { ...s.weather, qnh: 0 }).session).toBe(s)
    expect(decodeSession(sessionExport(s)).session.weather.qnh).toBe(1004)
  })
  it('keeps revised manual ratings in history and preserves their evidence through export', () => {
    let s = createSession('', definition())
    const base = s.events[0]
    s = assessCriterion(s, {
      criterionId: 'clearances',
      rating: 'needs-review',
      reviewer: 'Instructor A',
      note: 'Review this evidence.',
      eventId: base.id,
    }).session
    s = assessCriterion(s, {
      criterionId: 'clearances',
      rating: 'demonstrated',
      reviewer: 'Instructor A',
      note: 'Revised after debrief.',
      eventId: base.id,
    }).session
    expect(s.assessments).toHaveLength(1)
    expect(s.events.filter((e) => e.kind === 'assessment')).toHaveLength(2)
    expect(decodeSession(sessionExport(s)).session.assessments[0].rating).toBe('demonstrated')
    expect(addObservation(s, s.events.at(-1)!.id, 'Nested evidence', 'info').error).toBeDefined()
    expect(
      assessCriterion(s, { ...s.assessments[0], reviewer: '', eventId: 999 }).error,
    ).toBeDefined()
    const fork = forkSession(s)
    fork.exercise.weather.qnh = 999
    fork.events[0].weather.qnh = 999
    expect(s.exercise.weather.qnh).toBe(1012)
    expect(s.events[0].weather.qnh).toBe(1012)
  })
  it('migrates v0.3 pending operator work without dropping its mode, queue, or linked notes', () => {
    let s = setPilotMode(createSession(), 'MAS612', 'operator')
    s = transmit(s, 'MAS612, pushback approved', '121.650').session
    s = addObservation(s, 1, 'Existing observation', 'info').session
    const old = JSON.parse(JSON.stringify(sessionExport(s)))
    old.schema = 'vatsim-ai.session.v3'
    old.engineVersion = '0.3.0'
    old.session.version = 3
    for (const field of ['exercise', 'weather', 'coordination', 'assessments', 'firedTriggers'])
      delete old.session[field]
    for (const a of old.session.aircraft) delete a.activationTime
    for (const e of old.session.events) {
      delete e.weather
      delete e.coordination
      for (const a of e.snapshot) delete a.activationTime
    }
    const decoded = decodeSession(old)
    expect(decoded.migrated).toBe(true)
    expect(decoded.session.id).toBe(s.id)
    expect(decoded.session.aircraft[0].pilotMode).toBe('operator')
    expect(decoded.session.aircraft[0].queuedInstruction).toEqual(s.aircraft[0].queuedInstruction)
    expect(decoded.session.events.at(-1)?.relatedEventId).toBe(1)
    expect(decodeSession(sessionExport(decoded.session)).migrated).toBe(false)
  })
  it('escapes report markup and protects spreadsheet cells while preserving text', () => {
    let s = createSession()
    s = addObservation(s, 1, '<script>alert("x")</script>', 'info').session
    const html = sessionReport(s)
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('href="#event-1"')
    s = transmit(s, '=HYPERLINK("unsafe")', '121.650').session
    expect(radioCsv(s)).toContain('"\'=HYPERLINK')
    expect(radioCsv(s)).toContain('Frequency')
  })
  it.each([
    'bad-coordination',
    'future-activation',
    'missing-criterion',
    'bad-trigger',
    'bad-weather',
  ])('rejects inconsistent integrated checkpoints: %s', (kind) => {
    const data = JSON.parse(JSON.stringify(sessionExport(createSession('', definition()))))
    if (kind === 'bad-coordination')
      data.session.coordination = [
        {
          id: 1,
          aircraftId: 'MAS612',
          from: '121.650',
          to: '118.800',
          status: 'pending',
          requestedAt: 0,
        },
      ]
    if (kind === 'future-activation') data.session.aircraft[0].activationTime = 30
    if (kind === 'missing-criterion')
      data.session.assessments = [
        {
          criterionId: 'unknown',
          rating: 'demonstrated',
          reviewer: 'Instructor',
          note: '',
          eventId: 1,
          time: 0,
        },
      ]
    if (kind === 'bad-trigger') data.session.firedTriggers = ['unknown']
    if (kind === 'bad-weather') data.session.weather.qnh = 50
    expect(() => decodeSession(data)).toThrow()
  })
})
