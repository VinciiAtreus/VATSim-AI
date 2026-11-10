import { useState } from 'react'
import type { Weather } from '../sim/types'
import type { SessionAction } from './PilotStation'
import { WeatherFields } from './ExerciseBuilder'
import { updateWeather } from '../sim/engine'
export default function WeatherPanel({
  weather,
  disabled,
  act,
}: {
  weather: Weather
  disabled: boolean
  act: (action: SessionAction) => string | undefined
}) {
  const [draft, setDraft] = useState({ ...weather })
  const [feedback, setFeedback] = useState('')
  return (
    <details className="instructor-extra">
      <summary>Exercise weather and information</summary>
      <p className="pilot-station-help">
        Display and briefing values only; performance and runway configuration do not change.
      </p>
      <WeatherFields value={draft} onChange={setDraft} />
      <button
        className="secondary-button"
        disabled={disabled}
        onClick={() =>
          setFeedback(
            act((s) => updateWeather(s, draft)) ?? 'Exercise weather updated and recorded.',
          )
        }
      >
        Apply exercise weather
      </button>
      {feedback && (
        <p role="status" className="pilot-station-help">
          {feedback}
        </p>
      )}
    </details>
  )
}
