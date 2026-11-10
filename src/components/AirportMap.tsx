import { useState } from 'react'
import { Crosshair, Layers3, Minus, Plus, Route, Wind } from 'lucide-react'
import { PHASE_LABELS, RUNWAYS } from '../sim/airport'
import type { Aircraft, RunwayId, Weather } from '../sim/types'

type Props = {
  weather: Weather
  aircraft: Aircraft[]
  selected: string
  onSelect: (id: string) => void
  blockedRunway: RunwayId | null
  replay: boolean
}
export default function AirportMap({
  aircraft,
  selected,
  onSelect,
  blockedRunway,
  replay,
  weather,
}: Props) {
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [routes, setRoutes] = useState(true)
  const [labels, setLabels] = useState(true)
  const [drag, setDrag] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const selectedAircraft = aircraft.find((a) => a.id === selected)
  const route =
    selectedAircraft && selectedAircraft.routeIndex < selectedAircraft.route.length
      ? [selectedAircraft.position, ...selectedAircraft.route.slice(selectedAircraft.routeIndex)]
      : []
  return (
    <section className="map-panel" aria-label="WMKK schematic airport display">
      <div className="map-heading">
        <div className="map-heading-main">
          <span className={`live-dot ${replay ? 'amber' : ''}`} />
          <span>{replay ? 'SESSION REPLAY' : 'SURFACE MOVEMENTS'}</span>
          <span className="map-divider" />
          <span className="map-subtitle">WMKK · KUALA LUMPUR</span>
        </div>
        <div className="map-toolbar">
          <button
            className={routes ? 'map-toggle active' : 'map-toggle'}
            onClick={() => setRoutes(!routes)}
            aria-pressed={routes}
            title="Toggle selected taxi route"
          >
            <Route size={14} />
            <span>Routes</span>
          </button>
          <button
            className={labels ? 'map-toggle active' : 'map-toggle'}
            onClick={() => setLabels(!labels)}
            aria-pressed={labels}
            title="Toggle airport labels"
          >
            <Layers3 size={14} />
            <span>Labels</span>
          </button>
        </div>
      </div>
      <div className="map-canvas">
        <div className="map-weather">
          <Wind size={15} />
          <span>
            {String(weather.windDirection).padStart(3, '0')}° /{' '}
            {String(weather.windSpeed).padStart(2, '0')} KT
          </span>
          <span className="weather-separator" />
          <span>
            QNH {weather.qnh} · INFO {weather.information}
          </span>
        </div>
        <svg
          className={`airport-svg ${drag ? 'dragging' : ''}`}
          viewBox={`${600 - 600 / zoom + offset.x} ${380 - 450 / zoom + offset.y} ${1200 / zoom} ${900 / zoom}`}
          role="img"
          aria-label="Illustrative airport layout with three runway pairs. Use the flight strip list to select an aircraft."
          onPointerDown={(e) => {
            if ((e.target as Element).closest('[data-aircraft]')) return
            if (e.button === 0) {
              e.currentTarget.setPointerCapture(e.pointerId)
              setDrag({ x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y })
            }
          }}
          onPointerMove={(e) => {
            if (drag) {
              const scale = 1200 / zoom / e.currentTarget.getBoundingClientRect().width
              setOffset({
                x: drag.ox - (e.clientX - drag.x) * scale,
                y: drag.oy - (e.clientY - drag.y) * scale,
              })
            }
          }}
          onPointerUp={() => setDrag(null)}
          onPointerCancel={() => setDrag(null)}
        >
          <defs>
            <pattern id="map-grid" width="55" height="55" patternUnits="userSpaceOnUse">
              <path
                d="M 55 0 L 0 0 0 55"
                fill="none"
                stroke="#8eb4ad"
                strokeWidth=".6"
                opacity=".08"
              />
              <circle cx="0" cy="0" r="1" fill="#8eb4ad" opacity=".15" />
            </pattern>
            <pattern id="terrain-grid" width="9" height="9" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r=".65" fill="#709d79" opacity=".11" />
            </pattern>
            <filter id="plane-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
            <symbol id="aircraft-symbol" viewBox="-14 -18 28 36">
              <path d="M0-17c1.2 0 2 2 2 4v8l10 7v3L2 1v9l4 3v2l-6-2-6 2v-2l4-3V1l-10 4V2l10-7v-8c0-2 .8-4 2-4Z" />
            </symbol>
          </defs>
          <rect x="-1500" y="-1500" width="4000" height="4000" fill="url(#map-grid)" />
          <g transform="rotate(-26 600 380)">
            <path
              d="M145 55 1040 40 1040 715 700 730 150 680Z"
              fill="#29453e"
              fillOpacity=".28"
              stroke="#638677"
              strokeOpacity=".12"
              strokeDasharray="7 8"
            />
            <path d="M135 20 1060 20 1060 710 700 750 135 710Z" fill="url(#terrain-grid)" />
            <path
              d="M170 730H1070M1050 20V735M160 30H1045"
              fill="none"
              stroke="#557064"
              strokeWidth="7"
              opacity=".25"
            />
            <path
              d="M700 730V535H810V510M455 730V555H420V495"
              fill="none"
              stroke="#5d7368"
              strokeWidth="7"
              opacity=".4"
            />
            <path
              d="M700 730V535H810V510M455 730V555H420V495"
              fill="none"
              stroke="#b5b7a0"
              strokeWidth=".8"
              strokeDasharray="5 6"
              opacity=".3"
            />
            {Object.entries(RUNWAYS).map(([id, r]) => (
              <g key={id}>
                <rect
                  x={r.x - 25}
                  y={r.top - 22}
                  width="50"
                  height={r.bottom - r.top + 44}
                  rx="1"
                  fill="#2c3d3e"
                  opacity=".7"
                />
                <rect x={r.x - 15} y={r.top} width="30" height={r.bottom - r.top} fill="#81928f" />
                <rect
                  x={r.x - 13}
                  y={r.top + 2}
                  width="26"
                  height={r.bottom - r.top - 4}
                  fill="#344747"
                />
                <line
                  x1={r.x}
                  y1={r.top + 70}
                  x2={r.x}
                  y2={r.bottom - 70}
                  stroke="#c6d4cc"
                  strokeWidth="1.3"
                  strokeDasharray="13 15"
                  opacity=".65"
                />
                {[r.top + 8, r.bottom - 20].map((y) => (
                  <g key={y}>
                    {[-10, -6, -2, 2, 6, 10].map((x) => (
                      <line
                        key={x}
                        x1={r.x + x}
                        x2={r.x + x}
                        y1={y}
                        y2={y + 12}
                        stroke="#d5e0d8"
                        strokeWidth="2"
                      />
                    ))}
                  </g>
                ))}
                <text x={r.x} y={r.top + 48} textAnchor="middle" className="runway-number">
                  {r.opposite}
                </text>
                <text
                  x={r.x}
                  y={r.bottom - 38}
                  textAnchor="middle"
                  className="runway-number"
                  transform={`rotate(180 ${r.x} ${r.bottom - 44})`}
                >
                  {id}
                </text>
                <path
                  d={`M${r.hold.x} ${r.top + 32}V${r.bottom - 15}`}
                  stroke="#45605a"
                  strokeWidth="14"
                  fill="none"
                />
                <path
                  d={`M${r.hold.x} ${r.top + 32}V${r.bottom - 15}`}
                  stroke="#bcad63"
                  strokeWidth="1"
                  fill="none"
                  opacity=".7"
                />
                {[r.top + 62, r.top + 165, r.top + 295, r.bottom - 45].map((y, i) => (
                  <g key={y}>
                    <path
                      d={`M${r.x} ${y - 20}L${r.hold.x} ${y}`}
                      stroke="#45605a"
                      strokeWidth="11"
                      fill="none"
                    />
                    <path
                      d={`M${r.x} ${y - 20}L${r.hold.x} ${y}`}
                      stroke="#bcad63"
                      strokeWidth=".9"
                      fill="none"
                      opacity=".6"
                    />
                    {labels && (
                      <text
                        x={r.hold.x + (r.hold.x > r.x ? 12 : -24)}
                        y={y + 3}
                        className="taxi-label"
                      >
                        {r.route}
                        {i + 1}
                      </text>
                    )}
                  </g>
                ))}
                <line
                  x1={r.hold.x - 6}
                  x2={r.hold.x + 6}
                  y1={r.hold.y - 2}
                  y2={r.hold.y - 2}
                  stroke="#f0cf77"
                  strokeWidth="2.5"
                />
                <line
                  x1={r.hold.x - 6}
                  x2={r.hold.x + 6}
                  y1={r.hold.y + 2}
                  y2={r.hold.y + 2}
                  stroke="#f0cf77"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                {labels && (
                  <g transform={`translate(${r.hold.x + 12} ${r.top + 233}) rotate(26)`}>
                    <rect x="-8" y="-9" width="19" height="18" rx="3" fill="#b8a462" />
                    <text
                      x="1"
                      y="4"
                      textAnchor="middle"
                      fill="#1d302e"
                      fontSize="11"
                      fontFamily="monospace"
                      fontWeight="700"
                    >
                      {r.route}
                    </text>
                  </g>
                )}
              </g>
            ))}
            <path
              d="M635 245H870M635 340H870M635 440H870M325 380H460M325 440H460M325 525H635"
              stroke="#45605a"
              strokeWidth="13"
              fill="none"
            />
            <path
              d="M635 245H870M635 340H870M635 440H870M325 380H460M325 440H460M325 525H635"
              stroke="#baad67"
              strokeWidth=".8"
              fill="none"
              opacity=".6"
            />
            <g className="terminal">
              <path d="M690 285H810V470H690Z" fill="#3c554e" stroke="#648074" strokeWidth="1" />
              <path d="M725 290V465M775 290V465" stroke="#92a28b" strokeWidth="1" opacity=".3" />
              <path
                d="M730 270V155H790V270M710 195H810M710 235H810"
                stroke="#758d7e"
                strokeWidth="10"
                fill="none"
              />
              <rect x="708" y="335" width="84" height="55" fill="#708779" rx="3" />
              <rect x="708" y="400" width="84" height="38" fill="#566f62" rx="3" />
              <path d="M345 330H465V490H345Z" fill="#3c554e" stroke="#648074" />
              <path d="M354 380H455M354 432H455" stroke="#728a78" strokeWidth="12" />
              <rect x="365" y="356" width="76" height="112" fill="#677e6c" rx="3" />
              {labels && (
                <>
                  <text
                    transform="rotate(26 750 365)"
                    x="750"
                    y="365"
                    className="terminal-label"
                    textAnchor="middle"
                  >
                    TERMINAL 1
                  </text>
                  <text
                    transform="rotate(26 403 409)"
                    x="403"
                    y="409"
                    className="terminal-label"
                    textAnchor="middle"
                  >
                    TERMINAL 2
                  </text>
                  <text
                    transform="rotate(26 760 215)"
                    x="760"
                    y="215"
                    className="area-label"
                    textAnchor="middle"
                  >
                    SATELLITE
                  </text>
                </>
              )}
            </g>
            {[
              { x: 770, y: 340, label: 'B6' },
              { x: 770, y: 390, label: 'B8' },
              { x: 770, y: 440, label: 'B10' },
              { x: 400, y: 440, label: 'Q4' },
            ].map((p) => (
              <g key={p.label}>
                <path d={`M${p.x} ${p.y}h60`} stroke="#d5c375" strokeWidth=".75" opacity=".45" />
                {labels && (
                  <text x={p.x + 37} y={p.y - 7} className="stand-label">
                    {p.label}
                  </text>
                )}
              </g>
            ))}
            <g transform="translate(830 510) rotate(26)">
              <circle r="4" fill="#a3c2b5" />
              <circle r="11" fill="none" stroke="#a3c2b5" strokeOpacity=".4" />
              {labels && (
                <text x="16" y="4" className="area-label">
                  TOWER EAST
                </text>
              )}
            </g>
            {blockedRunway && (
              <g transform={`translate(${RUNWAYS[blockedRunway].x} 310) rotate(26)`}>
                <circle r="19" stroke="#efad75" fill="#573e2b" strokeDasharray="3 3" />
                <path d="m-7-7 14 14m0-14L-7 7" stroke="#efad75" strokeWidth="2" />
                <text x="29" y="4" fill="#efad75" className="aircraft-map-label">
                  RWY OCCUPIED
                </text>
              </g>
            )}
            {routes && route.length > 1 && (
              <polyline
                points={route.map((p) => `${p.x},${p.y}`).join(' ')}
                stroke="#c5e78d"
                strokeWidth="3"
                strokeDasharray="7 5"
                fill="none"
                strokeLinejoin="round"
                className="selected-route"
              />
            )}
            {routes && route.length > 1 && (
              <g
                transform={`translate(${route[route.length - 1].x} ${route[route.length - 1].y}) rotate(26)`}
              >
                <circle r="7" stroke="#c5e78d" strokeWidth="2" fill="#203b32" />
                <text x="13" y="4" className="aircraft-map-label" fill="#c5e78d">
                  CLEARANCE LIMIT
                </text>
              </g>
            )}
            {aircraft
              .filter((a) => !['complete', 'scheduled'].includes(a.phase))
              .map((a) => (
                <g
                  key={a.id}
                  transform={`translate(${a.position.x} ${a.position.y})`}
                  data-aircraft={a.id}
                  onClick={() => onSelect(a.id)}
                  className="aircraft-marker"
                  aria-hidden="true"
                >
                  <circle r="27" fill="transparent" />
                  {a.id === selected && (
                    <>
                      <circle r="23" fill="#b6e76a" opacity=".08" />
                      <circle
                        r="19"
                        stroke="#c5e78d"
                        strokeWidth="1"
                        fill="none"
                        strokeDasharray="3 4"
                      />
                    </>
                  )}
                  <use
                    href="#aircraft-symbol"
                    x="-10"
                    y="-14"
                    width="20"
                    height="28"
                    fill={
                      a.id === selected
                        ? '#d7f5a9'
                        : a.operation === 'arrival'
                          ? '#93cfe2'
                          : '#b4c8c0'
                    }
                    transform={`rotate(${a.heading})`}
                  />
                  <g transform="rotate(26)">
                    <rect
                      x="20"
                      y="-18"
                      width="126"
                      height="46"
                      rx="3"
                      fill="#122823"
                      fillOpacity=".85"
                    />
                    <text
                      x="26"
                      y="-3"
                      className="aircraft-map-label"
                      fill={
                        a.id === selected
                          ? '#d7f5a9'
                          : a.operation === 'arrival'
                            ? '#93cfe2'
                            : '#c4d7ce'
                      }
                    >
                      {a.id}
                    </text>
                    <text x="26" y="15" className="aircraft-map-detail">
                      {a.type} ·{' '}
                      {a.speed ? `${a.speed} KT` : a.phase === 'final' ? 'FINAL' : a.stand}
                    </text>
                  </g>
                </g>
              ))}
          </g>
        </svg>
        <div className="north-indicator">
          <span>N</span>
          <svg viewBox="0 0 24 38" width="20" height="34">
            <path d="M12 2 20 30 12 25 4 30Z" fill="#b3c2ba" />
            <path d="M12 2v23l-8 5Z" fill="#50695e" />
          </svg>
        </div>
        <div className="map-zoom">
          <button onClick={() => setZoom(Math.min(2.5, zoom + 0.25))} aria-label="Zoom in">
            <Plus size={16} />
          </button>
          <span>{zoom.toFixed(2)}×</span>
          <button onClick={() => setZoom(Math.max(0.65, zoom - 0.25))} aria-label="Zoom out">
            <Minus size={16} />
          </button>
          <button
            onClick={() => {
              setZoom(1)
              setOffset({ x: 0, y: 0 })
            }}
            aria-label="Fit airport to display"
          >
            <Crosshair size={16} />
          </button>
        </div>
        <div className="map-scale">
          <span />
          <small>SCHEMATIC · NOT TO SCALE</small>
        </div>
        {selectedAircraft && (
          <div className="selected-map-card">
            <span className="live-dot" />
            <strong>{selectedAircraft.id}</strong>
            <span>{PHASE_LABELS[selectedAircraft.phase]}</span>
            <span className="card-runway">RWY {selectedAircraft.runway}</span>
          </div>
        )}
      </div>
      <div className="map-footer">
        <div>
          <span className="legend-dot departure" />
          Departure
          <span className="legend-dot arrival" />
          Arrival
          <span className="legend-dot selected" />
          Selected
        </div>
        <span>
          ILLUSTRATIVE DATASET <span className="map-version">v0.1</span>
        </span>
      </div>
    </section>
  )
}
