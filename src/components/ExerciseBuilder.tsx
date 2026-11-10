import { useState } from 'react'
import { Download, Plus, Save, Upload, X } from 'lucide-react'
import { initialAircraft } from '../sim/airport'
import { decodeExercise, exerciseExport, parseExerciseFile } from '../sim/exercises'
import type { ExerciseDefinition, Weather } from '../sim/types'

export function downloadArtifact(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function WeatherFields({
  value,
  onChange,
}: {
  value: Weather
  onChange: (weather: Weather) => void
}) {
  return (
    <div className="weather-fields">
      {(
        [
          ['windDirection', 'Wind direction', 0, 360],
          ['windSpeed', 'Wind speed (kt)', 0, 100],
          ['qnh', 'QNH (hPa)', 900, 1100],
        ] as const
      ).map(([key, label, min, max]) => (
        <label key={key}>
          {label}
          <input
            type="number"
            aria-label={label}
            min={min}
            max={max}
            required
            value={Number.isFinite(value[key]) ? value[key] : ''}
            onChange={(e) =>
              onChange({
                ...value,
                [key]: e.target.value === '' ? Number.NaN : Number(e.target.value),
              })
            }
          />
        </label>
      ))}
      <label>
        Information
        <select
          aria-label="Information identifier"
          value={value.information}
          onChange={(e) => onChange({ ...value, information: e.target.value })}
        >
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
export default function ExerciseBuilder({
  initial,
  onSave,
  onLoad,
  confirmId,
}: {
  initial: ExerciseDefinition
  onSave: (exercise: ExerciseDefinition) => ExerciseDefinition
  onLoad: (exercise: ExerciseDefinition) => void
  confirmId: string | null
}) {
  const [draft, setDraft] = useState<ExerciseDefinition>(() => structuredClone(initial))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  function validate() {
    try {
      const value = decodeExercise(draft)
      setError('')
      return value
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid exercise.')
      return null
    }
  }
  const profiles = initialAircraft('morning')
  return (
    <div className="exercise-builder">
      <p className="modal-intro">
        Author a local lesson using the four modelled traffic profiles. Geometry, routes, and
        performance remain schematic. Weather changes the briefing and display; it does not model
        visibility, aerodynamics, or automatic runway selection.
      </p>
      <div className="builder-toolbar">
        <label className="secondary-button">
          <Upload size={14} />
          Import lesson JSON
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Import lesson JSON"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                if (file.size > 128 * 1024) throw new Error('Lesson file exceeds 128 KB.')
                setDraft(parseExerciseFile(await file.text()))
                setError('')
                setNotice('Lesson imported for review. Save or load it when ready.')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not import lesson.')
              }
            }}
          />
        </label>
        <button
          className="secondary-button"
          onClick={() => {
            const d = validate()
            if (d)
              downloadArtifact(
                `${d.id}-r${d.revision}.json`,
                JSON.stringify(exerciseExport(d), null, 2),
                'application/json',
              )
          }}
        >
          <Download size={14} />
          Export lesson JSON
        </button>
      </div>
      <label>
        Lesson title
        <input
          aria-label="Lesson title"
          maxLength={100}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <label>
        Exercise objective
        <textarea
          aria-label="Exercise objective"
          maxLength={1000}
          rows={2}
          value={draft.objective}
          onChange={(e) => setDraft({ ...draft, objective: e.target.value })}
        />
      </label>
      <p className="eyebrow">FICTIONAL EXERCISE WEATHER</p>
      <WeatherFields
        value={draft.weather}
        onChange={(weather) => setDraft({ ...draft, weather })}
      />
      <p className="eyebrow">TRAFFIC AND RELEASE TIMES</p>
      <div className="builder-traffic">
        {profiles.map((profile) => {
          const t = draft.traffic.find((a) => a.profileId === profile.id)
          return (
            <fieldset key={profile.id}>
              <legend>
                <label>
                  <input
                    type="checkbox"
                    checked={!!t}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        traffic: e.target.checked
                          ? [
                              ...draft.traffic,
                              {
                                profileId: profile.id,
                                callsign: profile.id,
                                spoken: profile.spoken,
                                releaseAt: 0,
                              },
                            ]
                          : draft.traffic.filter((a) => a.profileId !== profile.id),
                      })
                    }
                  />
                  {profile.type} · {profile.stand} · runway {profile.runway}
                </label>
              </legend>
              {t && (
                <div className="traffic-inputs">
                  <label>
                    Callsign
                    <input
                      aria-label={`${profile.id} callsign`}
                      value={t.callsign}
                      maxLength={7}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          traffic: draft.traffic.map((a) =>
                            a === t ? { ...a, callsign: e.target.value.toUpperCase() } : a,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Spoken callsign
                    <input
                      aria-label={`${profile.id} spoken callsign`}
                      value={t.spoken}
                      maxLength={100}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          traffic: draft.traffic.map((a) =>
                            a === t ? { ...a, spoken: e.target.value } : a,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Release at (seconds)
                    <input
                      aria-label={`${profile.id} release time`}
                      type="number"
                      min={0}
                      max={3600}
                      value={t.releaseAt}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          traffic: draft.traffic.map((a) =>
                            a === t ? { ...a, releaseAt: Number(e.target.value) } : a,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              )}
            </fieldset>
          )
        })}
      </div>
      <div className="builder-options">
        <label>
          <input
            type="checkbox"
            checked={draft.requireCoordination}
            onChange={(e) => setDraft({ ...draft, requireCoordination: e.target.checked })}
          />
          Require adjacent-station acceptance before transfer
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.automaticCoordination}
            onChange={(e) => setDraft({ ...draft, automaticCoordination: e.target.checked })}
          />
          Scripted adjacent station (responds after 8 exercise seconds)
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.baseScenario === 'readback'}
            onChange={(e) =>
              setDraft({ ...draft, baseScenario: e.target.checked ? 'readback' : 'morning' })
            }
          />
          Arm an initial incorrect taxi readback
        </label>
      </div>
      <p className="eyebrow">TIMED INSTRUCTOR EVENTS</p>
      {draft.triggers.map((t, i) => (
        <div className="trigger-row" key={t.id}>
          <label>
            At (seconds)
            <input
              aria-label={`Event ${i + 1} time`}
              type="number"
              min={0}
              max={7200}
              value={t.at}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  triggers: draft.triggers.map((a) =>
                    a === t ? { ...a, at: Number(e.target.value) } : a,
                  ),
                })
              }
            />
          </label>
          <label>
            Action
            <select
              aria-label={`Event ${i + 1} action`}
              value={t.action}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  triggers: draft.triggers.map((a) =>
                    a === t ? { ...a, action: e.target.value as typeof t.action } : a,
                  ),
                })
              }
            >
              <option value="block">Place runway obstruction</option>
              <option value="clear">Clear runway obstruction</option>
              <option value="readback">Arm incorrect readback</option>
            </select>
          </label>
          <label>
            Runway
            <select
              aria-label={`Event ${i + 1} runway`}
              value={t.runway}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  triggers: draft.triggers.map((a) =>
                    a === t ? { ...a, runway: e.target.value as typeof t.runway } : a,
                  ),
                })
              }
            >
              {['32R', '32L', '33'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <button
            className="icon-button"
            aria-label={`Remove event ${i + 1}`}
            onClick={() => setDraft({ ...draft, triggers: draft.triggers.filter((a) => a !== t) })}
          >
            <X size={15} />
          </button>
        </div>
      ))}
      <button
        className="secondary-button"
        disabled={draft.triggers.length >= 20}
        onClick={() =>
          setDraft({
            ...draft,
            triggers: [
              ...draft.triggers,
              { id: crypto.randomUUID(), at: 60, action: 'block', runway: '32R' },
            ],
          })
        }
      >
        <Plus size={14} />
        Add timed event
      </button>
      <p className="pilot-station-help">
        One runway obstruction is modelled at a time; a later block event replaces the previous one.
      </p>
      <p className="eyebrow">DRAFT MANUAL ASSESSMENT CRITERIA</p>
      <p className="pilot-station-help">
        These are author-defined development criteria. A qualified instructor must review them for
        the intended course.
      </p>
      {draft.criteria.map((c, i) => (
        <div className="criterion-row" key={c.id}>
          <label>
            Criterion {i + 1}
            <input
              aria-label={`Criterion ${i + 1} title`}
              value={c.title}
              maxLength={100}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  criteria: draft.criteria.map((a) =>
                    a === c ? { ...a, title: e.target.value } : a,
                  ),
                })
              }
            />
          </label>
          <label>
            Description
            <textarea
              aria-label={`Criterion ${i + 1} description`}
              value={c.description}
              maxLength={500}
              rows={2}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  criteria: draft.criteria.map((a) =>
                    a === c ? { ...a, description: e.target.value } : a,
                  ),
                })
              }
            />
          </label>
          <button
            className="text-button"
            onClick={() => setDraft({ ...draft, criteria: draft.criteria.filter((a) => a !== c) })}
          >
            Remove criterion {i + 1}
          </button>
        </div>
      ))}
      <button
        className="secondary-button"
        disabled={draft.criteria.length >= 12}
        onClick={() =>
          setDraft({
            ...draft,
            criteria: [
              ...draft.criteria,
              { id: crypto.randomUUID(), title: 'New criterion', description: '' },
            ],
          })
        }
      >
        <Plus size={14} />
        Add criterion
      </button>
      {error && (
        <p className="library-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="modal-footer">
        <button
          className="secondary-button"
          onClick={() => {
            const d = validate()
            if (!d) return
            try {
              const saved = onSave(d)
              setDraft(saved)
              setNotice(`Saved revision ${saved.revision} in this browser.`)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not save lesson.')
            }
          }}
        >
          <Save size={14} />
          Save lesson
        </button>
        <button
          className="primary-button"
          onClick={() => {
            const d = validate()
            if (d) onLoad(d)
          }}
        >
          {confirmId === draft.id ? 'Confirm reset & run lesson' : 'Run this lesson'}
        </button>
      </div>
    </div>
  )
}
