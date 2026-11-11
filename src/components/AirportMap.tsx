import { useEffect, useMemo, useRef, useState } from 'react'
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
import { RUNWAYS } from '../sim/airport'
import type { Aircraft, RunwayId, Weather } from '../sim/types'
import { stopBarOff } from '../workstation/model'
import { placeLabels, rotatePoint } from '../workstation/labels'
type Props = {
  aircraft: Aircraft[]
  selected: string
  onSelect: (id: string) => void
  blockedRunway: RunwayId | null
  replay: boolean
  wind: string
  weather: Weather
  criticalAircraft: string[]
}
export default function AirportMap({
  aircraft,
  selected,
  onSelect,
  blockedRunway,
  replay,
  wind,
  weather,
  criticalAircraft,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [canvasSize, setCanvasSize] = useState(440)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setCanvasSize(Math.min(entry.contentRect.width, entry.contentRect.height)),
    )
    if (svgRef.current?.parentElement) observer.observe(svgRef.current.parentElement)
    return () => observer.disconnect()
  }, [])
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [routes, setRoutes] = useState(true)
  const [showStands, setShowStands] = useState(true)
  const [showTaxi, setShowTaxi] = useState(true)
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
  const viewRef = useRef({ fitSize, fitX, fitY, zoom, offset, canvasSize })
  viewRef.current = { fitSize, fitX, fitY, zoom, offset, canvasSize }
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const v = viewRef.current,
        rect = svg.getBoundingClientRect()
      const next = Math.max(
        0.65,
        Math.min(20, v.zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.035 : 0.0015))),
      )
      const size = Math.min(rect.width, rect.height)
      const px = (e.clientX - rect.left - rect.width / 2) / size,
        py = (e.clientY - rect.top - rect.height / 2) / size
      const delta = v.fitSize / v.zoom - v.fitSize / next
      setOffset({ x: v.offset.x + px * delta, y: v.offset.y + py * delta })
      setZoom(next)
    }
    const surface = svg.parentElement!
    surface.addEventListener('wheel', wheel, { passive: false })
    return () => surface.removeEventListener('wheel', wheel)
  }, [])
  const unitsPerPixel = fitSize / zoom / Math.max(1, canvasSize)
  const scaleTarget = 80 * unitsPerPixel * METRES_PER_UNIT
  const magnitude = 10 ** Math.floor(Math.log10(scaleTarget))
  const scaleMetres =
    [1, 2, 5]
      .map((n) => n * magnitude)
      .filter((n) => n <= scaleTarget)
      .at(-1) ?? magnitude
  const scalePixels = scaleMetres / METRES_PER_UNIT / unitsPerPixel
  const active = aircraft.filter((a) => !['complete', 'scheduled'].includes(a.phase))
  const labelScale = (unitsPerPixel * 11) / 13
  const targetLabels = useMemo(() => placeLabels(active, labelScale), [aircraft, labelScale])

  return (
    <section className="surface-display" aria-label="WMKK chart-transcribed airport display">
      <div className="equipment-heading">
        <h2>{replay ? 'SESSION REPLAY' : 'Surface movement · A-SMGCS'}</h2>
        <div>
          <button aria-pressed={routes} onClick={() => setRoutes(!routes)}>
            Routes
          </button>
          <button
            onClick={() => {
              const next = !(showStands && showTaxi)
              setShowStands(next)
              setShowTaxi(next)
            }}
          >
            Labels
          </button>
          <button aria-pressed={showStands} onClick={() => setShowStands(!showStands)}>
            Stand IDs
          </button>
          <button aria-pressed={showTaxi} onClick={() => setShowTaxi(!showTaxi)}>
            Taxiway IDs
          </button>
        </div>
      </div>
      <div className="surface-canvas">
        <span className="north-wind">
          ▲ N · W {wind} · QNH {weather.qnh}
        </span>
        <svg
          ref={svgRef}
          className="surface-svg airport-svg"
          viewBox={`${fitX - fitSize / 2 / zoom + offset.x} ${fitY - fitSize / 2 / zoom + offset.y} ${fitSize / zoom} ${fitSize / zoom}`}
          role="img"
          aria-label="Chart-transcribed airport layout with selectable aircraft"
          onPointerDown={(e) => {
            if ((e.target as Element).closest('[data-aircraft]')) return
            e.preventDefault()
            window.getSelection()?.removeAllRanges()
            e.currentTarget.setPointerCapture(e.pointerId)
            setDrag({ x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y })
          }}
          onPointerMove={(e) => {
            if (!drag) return
            const rect = e.currentTarget.getBoundingClientRect()
            const scale = fitSize / zoom / Math.min(rect.width, rect.height)
            setOffset({
              x: drag.ox - (e.clientX - drag.x) * scale,
              y: drag.oy - (e.clientY - drag.y) * scale,
            })
          }}
          onPointerUp={() => setDrag(null)}
          onPointerCancel={() => setDrag(null)}
        >
          <g transform={`rotate(${MAP_ROTATION} 470 380)`}>
            {CONTEXT_LINES.map((line, i) => (
              <g key={`context-${i}`}>
                <polyline
                  className="taxiway-line"
                  points={line.points.map((p) => `${p.x},${p.y}`).join(' ')}
                />
                {showTaxi && zoom >= 2 && (
                  <text
                    className="chart-label"
                    x={line.points[0].x}
                    y={line.points[0].y - 3}
                    style={{ fontSize: 11 * unitsPerPixel }}
                  >
                    {line.name}
                  </text>
                )}
              </g>
            ))}
            {SURFACE_EDGES.map(([from, to]) => (
              <line
                key={`${from}-${to}`}
                className="taxiway-line"
                x1={NODES[from].x}
                y1={NODES[from].y}
                x2={NODES[to].x}
                y2={NODES[to].y}
              />
            ))}
            {TERMINALS.map((t) => {
              const points = t.points.map(([x, y]) => chart(x, y))
              const x = points.reduce((sum, p) => sum + p.x, 0) / points.length,
                y = points.reduce((sum, p) => sum + p.y, 0) / points.length
              return (
                <g key={t.name}>
                  <polygon
                    className="terminal-building"
                    points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                  />
                  {showStands && (
                    <text
                      transform={`rotate(${-MAP_ROTATION} ${x} ${y})`}
                      x={x}
                      y={y - 15}
                      textAnchor="middle"
                      className="chart-label"
                      style={{ fontSize: 11 * unitsPerPixel }}
                    >
                      {t.name}
                    </text>
                  )}
                </g>
              )
            })}
            {showStands &&
              zoom >= 1.5 &&
              PARKING_STANDS.map(({ name, position, apron }) => (
                <g key={name}>
                  <line
                    className="stand-position"
                    x1={position.x}
                    y1={position.y}
                    x2={apron.x}
                    y2={apron.y}
                  />
                  <text
                    data-gate={name}
                    transform={`translate(${position.x} ${position.y}) rotate(${-MAP_ROTATION})`}
                    y={-3 * unitsPerPixel}
                    textAnchor="middle"
                    className="chart-label"
                    style={{ fontSize: 11 * unitsPerPixel }}
                  >
                    {name}
                  </text>
                </g>
              ))}
            {showStands &&
              Object.entries(STANDS).map(([name, p]) => (
                <g key={name}>
                  <line
                    className="stand-position"
                    x1={p.x}
                    y1={p.y}
                    x2={PUSHBACK[name as keyof typeof PUSHBACK].x}
                    y2={PUSHBACK[name as keyof typeof PUSHBACK].y}
                  />
                  <text
                    data-gate={name}
                    transform={`translate(${p.x} ${p.y}) rotate(${-MAP_ROTATION})`}
                    y={-8 * unitsPerPixel}
                    textAnchor="middle"
                    className="chart-label"
                    style={{ fontSize: 12 * unitsPerPixel }}
                  >
                    {name}
                  </text>
                </g>
              ))}
            {Object.entries(RUNWAYS).map(([id, r]) => (
              <g key={id}>
                <rect
                  className={`runway-surface ${blockedRunway === id ? 'blocked' : ''}`}
                  x={r.x - 3}
                  y={r.top}
                  width="6"
                  height={r.bottom - r.top}
                />
                <line
                  className="runway-centre"
                  x1={r.x}
                  y1={r.top + 12}
                  x2={r.x}
                  y2={r.bottom - 12}
                />
                <text
                  className="runway-designator"
                  x={r.x + 7}
                  y={r.top + 8}
                  style={{ fontSize: 14 * unitsPerPixel }}
                >
                  {r.opposite}
                </text>
                <text
                  className="runway-designator"
                  x={r.x + 7}
                  y={r.bottom}
                  style={{ fontSize: 14 * unitsPerPixel }}
                >
                  {id}
                </text>
                <line
                  className="taxiway-line"
                  x1={r.hold.x}
                  y1={r.hold.y}
                  x2={r.entry.x}
                  y2={r.entry.y}
                />
                <line
                  className={`stopbar-line ${stopBarOff(aircraft, id as RunwayId) ? 'off' : ''}`}
                  x1={r.hold.x}
                  y1={r.hold.y - 4}
                  x2={r.hold.x}
                  y2={r.hold.y + 4}
                />
                {showTaxi && (
                  <text
                    className="chart-label"
                    x={r.hold.x + 4}
                    y={r.hold.y - 6}
                    style={{ fontSize: 11 * unitsPerPixel }}
                  >
                    {HOLD_NAMES[id as RunwayId]} HOLD
                  </text>
                )}
              </g>
            ))}
            {routes && route.length > 1 && (
              <polyline
                className="cleared-route selected-route"
                points={route.map((p) => `${p.x},${p.y}`).join(' ')}
              />
            )}
          </g>
          {active.map((a) => {
            const point = rotatePoint(a.position),
              label = targetLabels.find((l) => l.id === a.id)!
            return (
              <g
                key={a.id}
                data-aircraft={a.id}
                className={`surface-target ${a.operation} ${selected === a.id ? 'selected' : ''} ${criticalAircraft.includes(a.id) ? 'critical-target' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`Target ${a.id}`}
                onClick={() => onSelect(a.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(a.id)
                  }
                }}
              >
                <title>
                  {a.id} · {a.type} · {a.runway} · {a.speed} KT
                </title>
                <path
                  className="target-leader"
                  d={`M${point.x} ${point.y}L${label.x + label.width / 2} ${label.y + label.height / 2}`}
                />
                <rect
                  className="target-hit"
                  x={point.x - 20}
                  y={point.y - 20}
                  width="40"
                  height="40"
                />
                {selected === a.id && (
                  <circle className="selection-ring" cx={point.x} cy={point.y} r={8 * labelScale} />
                )}
                {a.operation === 'departure' ? (
                  <circle className="target-symbol" cx={point.x} cy={point.y} r={5 * labelScale} />
                ) : (
                  <rect
                    className="target-symbol"
                    x={point.x - 5 * labelScale}
                    y={point.y - 5 * labelScale}
                    width={10 * labelScale}
                    height={10 * labelScale}
                  />
                )}
                <rect
                  className="target-label-box"
                  x={label.x}
                  y={label.y}
                  width={label.width}
                  height={label.height}
                />
                <text
                  className="target-label"
                  style={{ fontSize: 13 * labelScale }}
                  x={label.x + 5 * labelScale}
                  y={label.y + 16 * labelScale}
                >
                  {a.id}
                </text>
                {!label.compact && (
                  <text
                    className="target-detail"
                    style={{ fontSize: 13 * labelScale }}
                    x={label.x + 5 * labelScale}
                    y={label.y + 32 * labelScale}
                  >
                    {a.type} {a.runway} {String(a.speed).padStart(2, '0')}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        <div className="surface-legend">
          <span>● DEP</span>
          <span>■ ARR</span>
          <span>━ STOP BAR</span>
        </div>
        <span className="schematic-notice">Chart-transcribed · unvalidated</span>
        <div className="map-scale chart-scale">
          <span
            style={{ width: scalePixels, borderTop: '1px solid currentColor', display: 'block' }}
          />
          <span>{scaleMetres >= 1000 ? `${scaleMetres / 1000} km` : `${scaleMetres} m`}</span>
        </div>
        <div className="surface-zoom">
          <button
            aria-label="Focus selected aircraft"
            onClick={() => {
              if (!selectedAircraft) return
              const p = rotate(selectedAircraft.position)
              setZoom(5)
              setOffset({ x: p.x - fitX, y: p.y - fitY })
            }}
          >
            ◎
          </button>
          <button onClick={() => setZoom(Math.min(20, zoom * 1.5))} aria-label="Zoom in">
            +
          </button>
          <button onClick={() => setZoom(Math.max(0.65, zoom / 1.5))} aria-label="Zoom out">
            −
          </button>
          <button
            onClick={() => {
              setZoom(1)
              setOffset({ x: 0, y: 0 })
            }}
            aria-label="Fit airport to display"
          >
            Fit
          </button>
        </div>
      </div>
    </section>
  )
}
