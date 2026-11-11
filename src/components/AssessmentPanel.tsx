import { useState } from 'react'
import { assessCriterion, formatTime } from '../sim/engine'
import type { Session, Assessment } from '../sim/types'
import type { SessionAction } from './PilotStation'
export default function AssessmentPanel({
  session,
  anchorId,
  act,
}: {
  session: Session
  anchorId: number
  act: (action: SessionAction) => string | undefined
}) {
  const [criterionId, setCriterion] = useState(session.exercise.criteria[0]?.id ?? '')
  const [reviewer, setReviewer] = useState('')
  const [rating, setRating] = useState<Assessment['rating']>('not-observed')
  const [note, setNote] = useState('')
  const [eventId, setEventId] = useState(anchorId)
  const [feedback, setFeedback] = useState('')
  const eligible = session.events.filter((e) => !['note', 'assessment'].includes(e.kind))
  return (
    <div className="assessment-panel">
      <p className="modal-intro">
        Manual instructor judgement against this exercise revision's draft criteria. Reviewer names
        are self-entered and unauthenticated. No AI score or automatic competency decision is
        produced.
      </p>
      <div className="assessment-results">
        {session.exercise.criteria.map((c) => {
          const a = session.assessments.find((item) => item.criterionId === c.id)
          return (
            <article key={c.id}>
              <h3>{c.title}</h3>
              <p>{c.description}</p>
              <strong>{a?.rating ?? 'Not rated'}</strong>
              {a && (
                <>
                  <small>
                    {a.reviewer} · {formatTime(a.time)} · evidence #{a.eventId}
                  </small>
                  <p>{a.note}</p>
                </>
              )}
            </article>
          )
        })}
      </div>
      {session.exercise.criteria.length > 0 ? (
        <form
          className="assessment-form"
          onSubmit={(e) => {
            e.preventDefault()
            const error = act((s) =>
              assessCriterion(s, { criterionId, reviewer, rating, note, eventId }),
            )
            setFeedback(
              error ?? 'Manual assessment recorded. Previous ratings remain in the event history.',
            )
            if (!error) setNote('')
          }}
        >
          <label>
            Criterion
            <select
              aria-label="Assessment criterion"
              value={criterionId}
              onChange={(e) => setCriterion(e.target.value)}
            >
              {session.exercise.criteria.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reviewer name
            <input
              aria-label="Reviewer name"
              required
              maxLength={80}
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
            />
          </label>
          <label>
            Manual rating
            <select
              aria-label="Manual rating"
              value={rating}
              onChange={(e) => setRating(e.target.value as Assessment['rating'])}
            >
              <option value="not-observed">Not observed</option>
              <option value="needs-review">Needs review</option>
              <option value="demonstrated">Demonstrated in this exercise</option>
            </select>
          </label>
          <label>
            Evidence event
            <select
              aria-label="Assessment evidence event"
              value={eventId}
              onChange={(e) => setEventId(Number(e.target.value))}
            >
              {eligible.map((e) => (
                <option key={e.id} value={e.id}>
                  #{e.id} · {formatTime(e.time)} · {e.text.slice(0, 90)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assessment rationale
            <textarea
              aria-label="Assessment rationale"
              maxLength={1000}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button className="primary-button">Record manual assessment</button>
          {feedback && <p role="status">{feedback}</p>}
        </form>
      ) : (
        <p>
          No criteria are defined. Add them in a new lesson revision before starting an exercise.
        </p>
      )}
    </div>
  )
}
