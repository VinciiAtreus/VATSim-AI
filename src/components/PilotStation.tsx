import { useState } from 'react'
import { Headphones, Pause, Play, Send } from 'lucide-react'
import {
  resolvePilotInstruction,
  sendPilotCall,
  setAircraftMotionPaused,
  setPilotMode,
} from '../sim/engine'
import type { Aircraft, Session } from '../sim/types'

export type SessionAction = (s: Session) => { session: Session; error?: string }

export default function PilotStation({
  aircraft: a,
  running,
  disabled,
  act,
}: {
  aircraft: Aircraft
  running: boolean
  disabled: boolean
  act: (action: SessionAction) => string | undefined
}) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  function perform(action: SessionAction) {
    const failure = act(action)
    setError(failure ?? '')
    return !failure
  }
  const operator = a.pilotMode === 'operator'
  return (
    <section className="pilot-station" aria-label="Pseudo-pilot station">
      <div className="section-inline-heading">
        <p className="eyebrow">
          <Headphones size={13} /> PSEUDO-PILOT
        </p>
        <span>{a.id}</span>
      </div>
      <p className="pilot-station-status">
        {operator ? 'Instructor controls this pilot' : 'Scripted pilot active'} · {a.frequency}
      </p>
      <button
        className="secondary-button"
        disabled={disabled || (!operator && ['complete', 'scheduled'].includes(a.phase))}
        onClick={() =>
          perform((s) => ({ session: setPilotMode(s, a.id, operator ? 'scripted' : 'operator') }))
        }
      >
        {operator
          ? a.queuedInstruction
            ? 'Cancel pending & return to scripted'
            : 'Return to scripted pilot'
          : `Take over ${a.id}`}
      </button>
      {operator && (
        <>
          <p className="pilot-station-help">
            Instructions wait for execution. Existing motion continues. Routine pilot calls are
            manual; the approach go-around policy remains active. Returning to scripted resumes
            frozen motion.
          </p>
          <button
            className={`secondary-button ${a.motionPaused ? 'motion-frozen' : ''}`}
            disabled={disabled || ['complete', 'scheduled'].includes(a.phase)}
            onClick={() =>
              perform((s) => ({ session: setAircraftMotionPaused(s, a.id, !a.motionPaused) }))
            }
          >
            {a.motionPaused ? <Play size={13} /> : <Pause size={13} />}
            {a.motionPaused ? 'Resume aircraft motion' : 'Freeze aircraft motion'}
          </button>
          <div className="pending-instruction" aria-label="Pending pilot instruction">
            <span className="eyebrow">
              {a.queuedInstruction
                ? `INSTRUCTION #${a.queuedInstruction.eventId}`
                : 'AWAITING CONTROLLER INSTRUCTION'}
            </span>
            {a.queuedInstruction && (
              <>
                <p>{a.queuedInstruction.text}</p>
                <small>
                  Received on {a.queuedInstruction.frequency}. Rechecked against current aircraft
                  and runway state at execution.
                </small>
                <div className="pilot-actions">
                  <button
                    className="primary-button"
                    disabled={disabled || !running}
                    onClick={() => perform((s) => resolvePilotInstruction(s, a.id, true))}
                  >
                    Execute & read back
                  </button>
                  <button
                    className="secondary-button"
                    disabled={disabled || !running}
                    onClick={() => perform((s) => resolvePilotInstruction(s, a.id, false))}
                  >
                    Unable / discard
                  </button>
                </div>
              </>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (perform((s) => sendPilotCall(s, a.id, message))) setMessage('')
            }}
          >
            <label htmlFor="pilot-call">Pilot radio call</label>
            <textarea
              id="pilot-call"
              maxLength={1000}
              rows={3}
              value={message}
              disabled={disabled || ['complete', 'scheduled'].includes(a.phase)}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`${a.spoken}, …`}
            />
            <small>Radio only; does not execute an instruction or change the route.</small>
            <button
              className="secondary-button"
              disabled={
                disabled ||
                !running ||
                !message.trim() ||
                ['complete', 'scheduled'].includes(a.phase)
              }
            >
              <Send size={13} />
              Send pilot call on {a.frequency}
            </button>
          </form>
          {!running && (
            <p className="pilot-station-help">
              Resume the simulation to execute instructions or transmit.
            </p>
          )}
        </>
      )}
      {error && (
        <p className="station-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
