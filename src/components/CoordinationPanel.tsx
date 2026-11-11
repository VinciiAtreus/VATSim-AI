import { ArrowRight, Radio } from 'lucide-react'
import { requestCoordination, decideCoordination } from '../sim/engine'
import type { Aircraft, Coordination } from '../sim/types'
import type { SessionAction } from './PilotStation'
import { useState } from 'react'
export default function CoordinationPanel({
  aircraft: a,
  items,
  required,
  disabled,
  act,
}: {
  aircraft: Aircraft
  items: Coordination[]
  required: boolean
  disabled: boolean
  act: (action: SessionAction) => string | undefined
}) {
  const [error, setError] = useState('')
  const relevant = items.filter((c) => c.aircraftId === a.id)
  return (
    <section className="coordination-panel" aria-label="Adjacent station coordination">
      <p className="eyebrow">
        <Radio size={13} />
        COORDINATION {required ? '· REQUIRED' : '· OPTIONAL'}
      </p>
      <p className="pilot-station-help">
        Acceptance is separate from the radio transfer.{' '}
        {required ? 'Obtain acceptance before instructing the aircraft to change frequency.' : ''}
      </p>
      {relevant.map((c) => (
        <div className={`coordination-item ${c.status}`} key={c.id}>
          <strong>
            {c.from}
            <ArrowRight size={12} />
            {c.to}
          </strong>
          <span>{c.status}</span>
        </div>
      ))}
      {['holding', 'vacated'].includes(a.phase) && (
        <button
          className="secondary-button"
          disabled={disabled}
          onClick={() => setError(act((s) => requestCoordination(s, a.id)) ?? '')}
        >
          Request adjacent-station acceptance
        </button>
      )}
      {error && (
        <p role="alert" className="station-error">
          {error}
        </p>
      )}
    </section>
  )
}
export function CoordinationDesk({
  items,
  disabled,
  act,
}: {
  items: Coordination[]
  disabled: boolean
  act: (action: SessionAction) => string | undefined
}) {
  return (
    <section className="instructor-extra">
      <p className="eyebrow">ADJACENT STATION DESK</p>
      {items
        .filter((c) => c.status === 'pending')
        .map((c) => (
          <div className="coordination-decision" key={c.id}>
            <p>
              {c.aircraftId} · {c.from} → {c.to}
            </p>
            <div className="builder-toolbar">
              <button
                className="secondary-button"
                disabled={disabled}
                onClick={() => act((s) => decideCoordination(s, c.id, true))}
              >
                Accept {c.aircraftId}
              </button>
              <button
                className="secondary-button"
                disabled={disabled}
                onClick={() => act((s) => decideCoordination(s, c.id, false))}
              >
                Decline {c.aircraftId}
              </button>
            </div>
          </div>
        ))}
      {!items.some((c) => c.status === 'pending') && (
        <p className="pilot-station-help">No transfer requests awaiting a decision.</p>
      )}
    </section>
  )
}
