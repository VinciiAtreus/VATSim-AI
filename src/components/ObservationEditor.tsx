import { useState } from 'react'
import { addObservation, formatTime } from '../sim/engine'
import type { SimEvent } from '../sim/types'
import type { SessionAction } from './PilotStation'

export default function ObservationEditor({
  anchor,
  events,
  act,
}: {
  anchor: SimEvent
  events: SimEvent[]
  act: (action: SessionAction) => string | undefined
}) {
  const [text, setText] = useState('')
  const [pinned, setPinned] = useState<number | null>(null)
  const [severity, setSeverity] = useState<SimEvent['severity']>('info')
  const [feedback, setFeedback] = useState('')
  const target = events.find((e) => e.id === pinned) ?? anchor
  return (
    <form
      className="observation-editor"
      onSubmit={(e) => {
        e.preventDefault()
        const error = act((s) => addObservation(s, target.id, text, severity))
        setFeedback(error ?? `Observation linked to event #${target.id}.`)
        if (!error) {
          setText('')
          setPinned(null)
        }
      }}
    >
      <p className="eyebrow">INSTRUCTOR OBSERVATION</p>
      <div className="observation-anchor">
        <strong>
          Event #{target.id} · {formatTime(target.time)}
        </strong>
        <p>{target.text}</p>
      </div>
      {target.id !== anchor.id && (
        <button type="button" className="text-button" onClick={() => setPinned(anchor.id)}>
          Use currently inspected event
        </button>
      )}
      <label htmlFor="observation-text">Observation note</label>
      <textarea
        id="observation-text"
        rows={3}
        maxLength={1000}
        value={text}
        placeholder="Record what happened and what to review…"
        onChange={(e) => {
          if (pinned === null) setPinned(anchor.id)
          setText(e.target.value)
          setFeedback('')
        }}
      />
      <label className="observation-priority">
        Review priority
        <select
          aria-label="Observation priority"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as SimEvent['severity'])}
        >
          <option value="info">Information</option>
          <option value="attention">Coaching</option>
          <option value="critical">Review required</option>
        </select>
      </label>
      <button className="secondary-button" disabled={!text.trim()}>
        Add linked observation
      </button>
      {feedback && (
        <p role="status" className="pilot-station-help">
          {feedback}
        </p>
      )}
    </form>
  )
}
