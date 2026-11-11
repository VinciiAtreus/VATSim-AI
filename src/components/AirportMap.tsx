import {
  chart,
  TERMINALS,
  STANDS,
  PUSHBACK,
  NODES,
  SURFACE_EDGES,
  HOLD_NAMES,
  CONTEXT_LINES,
  PARKING_STANDS,
  METRES_PER_UNIT,
  MAP_ROTATION,
} from '../sim/geometry'
import { useEffect, useRef, useState } from 'react'
import { Crosshair, Layers3, Minus, Plus, Route, Wind, Plane } from 'lucide-react'
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
  const svgRef = useRef<SVGSVGElement>(null)
  const [canvasSize, setCanvasSize] = useState(440)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setCanvasSize(Math.min(entry.contentRect.width, entry.contentRect.height)),
    )
    if (svgRef.current) observer.observe(svgRef.current)
    return () => observer.disconnect()
  }, [])
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
  const angle = (MAP_ROTATION * Math.PI) / 180
  const rotate = (p: { x: number; y: number }) => ({
    x: 470 + (p.x - 470) * Math.cos(angle) - (p.y - 380) * Math.sin(angle),
    y: 380 + (p.x - 470) * Math.sin(angle) + (p.y - 380) * Math.cos(angle),
  })
  const bounds = Object.values(RUNWAYS).flatMap((r) => [
    rotate({ x: r.x, y: r.top }),
    rotate({ x: r.x, y: r.bottom }),
  ])
  if (selectedAircraft?.phase === 'final') bounds.push(rotate(selectedAircraft.position))
  const minY = Math.min(...bounds.map((p) => p.y)),
    maxY = Math.max(...bounds.map((p) => p.y))
  const minX = Math.min(...bounds.map((p) => p.x)),
    maxX = Math.max(...bounds.map((p) => p.x))
  const fitSize = Math.max(950, maxY - minY + 140, maxX - minX + 200)
  const fitY = (minY + maxY) / 2,
    fitX = (minX + maxX) / 2 + 40
  const unitsPerPixel = fitSize / zoom / Math.max(1, canvasSize)
  const scaleTarget = 80 * unitsPerPixel * METRES_PER_UNIT
  const magnitude = 10 ** Math.floor(Math.log10(scaleTarget))
  const scaleMetres =
    [1, 2, 5]
      .map((n) => n * magnitude)
      .filter((n) => n <= scaleTarget)
      .at(-1) ?? magnitude
  const scalePixels = scaleMetres / METRES_PER_UNIT / unitsPerPixel
  return (
    <section className="map-panel" aria-label="WMKK chart-transcribed airport display">
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
          ref={svgRef}
          className={`airport-svg ${drag ? 'dragging' : ''}`}
          viewBox={`${fitX - fitSize / 2 / zoom + offset.x} ${fitY - fitSize / 2 / zoom + offset.y} ${fitSize / zoom} ${fitSize / zoom}`}
          role="img"
          aria-label="Chart-transcribed airport layout with three runway pairs. Use the flight strip list to select an aircraft."
          onPointerDown={(e) => {
            if ((e.target as Element).closest('[data-aircraft]')) return
            if (e.button === 0) {
              e.currentTarget.setPointerCapture(e.pointerId)
              setDrag({ x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y })
            }
          }}
          onPointerMove={(e) => {
            if (drag) {
              const rect = e.currentTarget.getBoundingClientRect()
              const scale = fitSize / zoom / Math.min(rect.width, rect.height)
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
          <g transform={`rotate(${MAP_ROTATION} 470 380)`}>
            {CONTEXT_LINES.map((line, i) => (
              <g key={`context-${i}`}>
                <polyline
                  points={line.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#45605a"
                  strokeWidth="5"
                />
                <polyline
                  points={line.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#baad67"
                  strokeWidth=".55"
                />
                {labels && (
                  <text
                    x={line.points[0].x + 4}
                    y={line.points[0].y - 4}
                    className="taxi-label"
                    style={{ fontSize: 11 * unitsPerPixel }}
                  >
                    {line.name}
                  </text>
                )}
              </g>
            ))}
            {SURFACE_EDGES.map(([from, to]) => (
              <g key={`${from}-${to}`}>
                <line
                  x1={NODES[from].x}
                  y1={NODES[from].y}
                  x2={NODES[to].x}
                  y2={NODES[to].y}
                  stroke="#45605a"
                  strokeWidth="5"
                />
                <line
                  x1={NODES[from].x}
                  y1={NODES[from].y}
                  x2={NODES[to].x}
                  y2={NODES[to].y}
                  stroke="#bcad63"
                  strokeWidth=".7"
                />
              </g>
            ))}
            {TERMINALS.map((t) => {
              const points = t.points.map(([x, y]) => chart(x, y))
              const x = points.reduce((sum, p) => sum + p.x, 0) / points.length
              const y = points.reduce((sum, p) => sum + p.y, 0) / points.length
              return (
                <g key={t.name}>
                  <polygon
                    points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="#708779"
                    stroke="#94a89a"
                    strokeWidth=".7"
                  />
                  {labels && (
                    <text
                      transform={`rotate(${-MAP_ROTATION} ${x} ${y})`}
                      x={x}
                      y={y - 15}
                      textAnchor="middle"
                      className="terminal-label"
                      style={{ fontSize: 11 * unitsPerPixel }}
                    >
                      {t.name}
                    </text>
                  )}
                </g>
              )
            })}
            {labels &&
              zoom >= 1.5 &&
              PARKING_STANDS.map(({ name, position, apron }) => (
                <g key={name} data-gate={name}>
                  <title>Stand {name}</title>
                  <line
                    x1={position.x}
                    y1={position.y}
                    x2={apron.x}
                    y2={apron.y}
                    stroke="#d5c375"
                    strokeWidth=".55"
                  />
                  <text
                    transform={`translate(${position.x} ${position.y}) rotate(${-MAP_ROTATION})`}
                    y={-3 * unitsPerPixel}
                    textAnchor="middle"
                    className="gate-map-label"
                    style={{ fontSize: 11 * unitsPerPixel, strokeWidth: 3 * unitsPerPixel }}
                  >
                    {name}
                  </text>
                </g>
              ))}
            {Object.entries(STANDS).map(([name, p]) => (
              <g key={name}>
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={PUSHBACK[name as keyof typeof PUSHBACK].x}
                  y2={PUSHBACK[name as keyof typeof PUSHBACK].y}
                  stroke="#e3cf7d"
                  strokeWidth="1"
                />
                {labels && (
                  <text
                    data-gate={name}
                    transform={`translate(${p.x} ${p.y}) rotate(${-MAP_ROTATION})`}
                    y={-8 * unitsPerPixel}
                    textAnchor="middle"
                    className="gate-map-label"
                    style={{ fontSize: 12 * unitsPerPixel, strokeWidth: 3 * unitsPerPixel }}
                  >
                    {name}
                  </text>
                )}
              </g>
            ))}
            {Object.entries(RUNWAYS).map(([id, r]) => (
              <g key={id}>
                <rect
                  x={r.x - 3}
                  y={r.top}
                  width="6"
                  height={r.bottom - r.top}
                  fill="#344747"
                  stroke="#b0beb5"
                  strokeWidth=".8"
                />
                <line
                  x1={r.x}
                  y1={r.top + 12}
                  x2={r.x}
                  y2={r.bottom - 12}
                  stroke="#c6d4cc"
                  strokeWidth=".7"
                  strokeDasharray="5 6"
                />
                <text
                  x={r.x + 7}
                  y={r.top + 8}
                  className="runway-number"
                  style={{ fontSize: 14 * unitsPerPixel }}
                >
                  {r.opposite}
                </text>
                <text
                  x={r.x + 7}
                  y={r.bottom}
                  className="runway-number"
                  style={{ fontSize: 14 * unitsPerPixel }}
                >
                  {id}
                </text>
                <line
                  x1={r.hold.x}
                  y1={r.hold.y}
                  x2={r.entry.x}
                  y2={r.entry.y}
                  stroke="#45605a"
                  strokeWidth="5"
                />
                <line
                  x1={r.hold.x}
                  y1={r.hold.y}
                  x2={r.entry.x}
                  y2={r.entry.y}
                  stroke="#bcad63"
                  strokeWidth=".7"
                />
                <line
                  x1={r.hold.x}
                  y1={r.hold.y - 4}
                  x2={r.hold.x}
                  y2={r.hold.y + 4}
                  stroke="#f0cf77"
                  strokeWidth="1.6"
                />
                {labels && (
                  <text
                    x={r.hold.x + 4}
                    y={r.hold.y - 6}
                    className="taxi-label"
                    style={{ fontSize: 11 * unitsPerPixel }}
                  >
                    {HOLD_NAMES[id as RunwayId]} HOLD
                  </text>
                )}
              </g>
            ))}
            {blockedRunway && (
              <g
                transform={`translate(${RUNWAYS[blockedRunway].x} ${(RUNWAYS[blockedRunway].top + RUNWAYS[blockedRunway].bottom) / 2}) rotate(${-MAP_ROTATION})`}
              >
                <circle r="13" stroke="#efad75" fill="#573e2b" strokeDasharray="3 3" />
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
                transform={`translate(${route[route.length - 1].x} ${route[route.length - 1].y}) rotate(${-MAP_ROTATION})`}
              >
                <circle r="7" stroke="#c5e78d" strokeWidth="2" fill="#203b32" />
                <text x="13" y="4" className="aircraft-map-label" fill="#c5e78d">
                  CLEARANCE LIMIT
                </text>
              </g>
            )}
            {aircraft
              .filter((a) => !['complete', 'scheduled'].includes(a.phase))
              .sort((a, b) => Number(a.id === selected) - Number(b.id === selected))
              .map((a) => (
                <g
                  key={a.id}
                  transform={`translate(${a.position.x} ${a.position.y})`}
                  data-aircraft={a.id}
                  onClick={() => onSelect(a.id)}
                  className="aircraft-marker"
                  aria-hidden="true"
                >
                  <g transform={`scale(${unitsPerPixel})`}>
                    <circle r="18" fill="transparent" />
                    {a.id === selected && (
                      <>
                        <circle r="15" fill="#b6e76a" opacity=".08" />
                        <circle
                          r="13"
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
                    <g
                      transform={`rotate(${-MAP_ROTATION}) translate(0 ${a.stand === 'B8' ? 36 : 0})`}
                    >
                      <rect
                        x="20"
                        y="-14"
                        width="100"
                        height="32"
                        rx="3"
                        fill="#122823"
                        fillOpacity=".85"
                      />
                      <text
                        x="26"
                        y="-3"
                        className="aircraft-map-label"
                        style={{ fontSize: 11 }}
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
                      <text x="26" y="10" className="aircraft-map-detail" style={{ fontSize: 9 }}>
                        {a.type} ·{' '}
                        {a.speed
                          ? `${Math.round(a.speed)} KT`
                          : a.phase === 'final'
                            ? 'FINAL'
                            : a.stand}
                      </text>
                    </g>
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
          <button
            aria-label="Focus selected aircraft"
            title="Focus selected aircraft and nearby gates"
            disabled={!selectedAircraft}
            onClick={() => {
              if (!selectedAircraft) return
              const p = rotate(selectedAircraft.position)
              setZoom(12)
              setOffset({ x: p.x - fitX, y: p.y - fitY })
            }}
          >
            <Plane size={16} />
          </button>
          <button
            onClick={() => setZoom(Math.min(20, Math.round(zoom * 1.4 * 100) / 100))}
            aria-label="Zoom in"
          >
            <Plus size={16} />
          </button>
          <span>{zoom.toFixed(2)}×</span>
          <button
            onClick={() => setZoom(Math.max(0.65, Math.round((zoom / 1.4) * 100) / 100))}
            aria-label="Zoom out"
          >
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
          <span style={{ width: scalePixels, display: 'block' }} />
          <small>
            {scaleMetres >= 1000 ? `${scaleMetres / 1000} km` : `${scaleMetres} m`} · approx.
          </small>
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
          CAAM CHART TRACE · UNVALIDATED <span className="map-version">v0.2</span>
        </span>
      </div>
    </section>
  )
}
