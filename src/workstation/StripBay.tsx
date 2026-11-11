import { useState } from 'react'
import { PHASE_LABELS } from '../sim/airport'
import type { Aircraft } from '../sim/types'
import { bayFor, bayNames, holdingPoint, rfl, squawk } from './model'
export default function StripBay({
  aircraft,
  selected,
  onSelect,
}: {
  aircraft: Aircraft[]
  selected: string
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const active = aircraft.filter((a) => !['complete', 'scheduled'].includes(a.phase))
  const visible = active.filter((a) =>
    `${a.id} ${a.type} ${a.stand}`.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <aside className="efs-panel" aria-label="Flight strips">
      <div className="equipment-heading">
        <h2>Flight strips</h2>
        <span>
          {active.filter((a) => a.operation === 'departure').length} dep ·{' '}
          {active.filter((a) => a.operation === 'arrival').length} arr
        </span>
      </div>
      <input
        className="strip-search"
        aria-label="Search flight strips"
        placeholder="Filter callsign / stand"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="efs-bays">
        {bayNames.map((bay) => {
          const traffic = visible.filter((a) => bayFor(a) === bay)
          return (
            <section className="efs-bay" key={bay} aria-label={`${bay} bay`}>
              <header>
                <strong>{bay}</strong>
                <span>
                  {bay === 'RUNWAY' ? '32R  33  32L' : bay === 'HOLDING POINT' ? 'A11  Y9' : ''}{' '}
                  <b>{traffic.length}</b>
                </span>
              </header>
              {traffic.length ? (
                traffic.map((a) => (
                  <button
                    key={a.id}
                    className={`paper-strip ${a.operation} ${a.id === selected ? 'selected' : ''}`}
                    aria-label={`Select ${a.id}`}
                    aria-pressed={a.id === selected}
                    onFocus={() => onSelect(a.id)}
                    onClick={() => onSelect(a.id)}
                  >
                    <div className="paper-ident">
                      <strong>{a.id}</strong>
                      <small>
                        A{squawk(a)} · {a.frequency}
                      </small>
                    </div>
                    <div className="paper-details">
                      <div>
                        <span>
                          {a.type}/{a.wake}
                        </span>
                        <span>
                          {a.destination}
                          {a.operation === 'arrival' ? ' ARR' : ''}
                        </span>
                      </div>
                      <b>{PHASE_LABELS[a.phase]}</b>
                      <span>
                        {a.stand} {rfl(a)}
                        {a.pilotMode === 'operator' ? ' · PSEUDO-PILOT' : ''}
                      </span>
                    </div>
                    <div className="paper-runway">
                      <strong>{a.runway}</strong>
                      <span>{a.operation === 'arrival' ? 'ILS' : holdingPoint(a.runway)}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="empty-bay" aria-label="Empty bay" />
              )}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
