import type { Aircraft } from '../sim/types'
import { distanceNm } from './model'
export default function FinalApproach({
  aircraft,
  onSelect,
}: {
  aircraft: Aircraft[]
  onSelect: (id: string) => void
}) {
  const arrivals = aircraft.filter((a) => a.phase === 'final' && distanceNm(a) <= 8)
  return (
    <section className="final-approach" aria-label="Final approach">
      <div className="equipment-heading">
        <h2>Final approach 32L</h2>
        <span>NM</span>
      </div>
      <svg
        viewBox="0 0 320 105"
        role="img"
        aria-label="Final approach range, 8 to 0 nautical miles"
      >
        <path d="M20 20L295 83" className="glide-path" />
        {[8, 6, 4, 2].map((n) => (
          <g key={n}>
            <path d={`M${295 - n * 34} 82v6`} className="range-tick" />
            <text x={295 - n * 34} y="101">
              {n}
            </text>
          </g>
        ))}
        <path d="M290 83h18" className="approach-runway" />
        {arrivals.map((a) => (
          <rect
            key={a.id}
            x={291 - distanceNm(a) * 34}
            y={79 - distanceNm(a) * 7.8}
            width="8"
            height="8"
            className="arrival-marker"
          />
        ))}
      </svg>
      {arrivals.length ? (
        arrivals.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className={`approach-aircraft ${a.landingCleared ? 'cleared' : ''}`}
          >
            <strong>{a.id}</strong> {distanceNm(a).toFixed(1)} NM · {a.speed} KT{' '}
            <span>{a.landingCleared ? 'CLEARED TO LAND' : 'NOT CLEARED'}</span>
          </button>
        ))
      ) : (
        <p>No arrivals inside 8 NM.</p>
      )}
    </section>
  )
}
