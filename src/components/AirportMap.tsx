import { useEffect, useMemo, useRef, useState } from 'react'
import { RUNWAYS } from '../sim/airport'
import type { Aircraft, RunwayId } from '../sim/types'
import { holdingPoint, stopBarOff } from '../workstation/model'
import { placeLabels, rotatePoint } from '../workstation/labels'
type Props = {
  aircraft: Aircraft[]
  selected: string
  onSelect: (id: string) => void
  blockedRunway: RunwayId | null
  replay: boolean
  wind: string
  criticalAircraft: string[]
}
const stands = [
  { id: 'B2', x: 770, y: 240 },
  { id: 'B4', x: 770, y: 290 },
  { id: 'B6', x: 770, y: 340 },
  { id: 'B8', x: 770, y: 390 },
  { id: 'B10', x: 770, y: 440 },
  { id: 'B12', x: 770, y: 490 },
  { id: 'Q2', x: 400, y: 390 },
  { id: 'Q4', x: 400, y: 440 },
  { id: 'Q6', x: 400, y: 490 },
]
export default function AirportMap({
  aircraft,
  selected,
  onSelect,
  blockedRunway,
  replay,
  wind,
  criticalAircraft,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [labelScale, setLabelScale] = useState(1.5)
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width && height) setLabelScale(11 / 13 / Math.min(width / 1260, height / 1030))
    })
    if (canvasRef.current) observer.observe(canvasRef.current)
    return () => observer.disconnect()
  }, [])
  const [showStands, setShowStands] = useState(true),
    [showTaxi, setShowTaxi] = useState(true)
  const [zoom, setZoom] = useState(1),
    [offset, setOffset] = useState({ x: 0, y: 0 })
  const [drag, setDrag] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const active = aircraft.filter((a) => a.phase !== 'complete')
  const labels = useMemo(() => placeLabels(active, labelScale), [aircraft, labelScale])
  const selectedAircraft = aircraft.find((a) => a.id === selected)
  const route = selectedAircraft
    ? [selectedAircraft.position, ...selectedAircraft.route.slice(selectedAircraft.routeIndex)]
    : []
  return (
    <section className="surface-display" aria-label="WMKK schematic airport display">
      <div className="equipment-heading">
        <h2>{replay ? 'SESSION REPLAY' : 'Surface movement · A-SMGCS'}</h2>
        <div>
          <button aria-pressed={showStands} onClick={() => setShowStands(!showStands)}>
            Stand IDs
          </button>
          <button aria-pressed={showTaxi} onClick={() => setShowTaxi(!showTaxi)}>
            Taxiway IDs
          </button>
        </div>
      </div>
      <div className="surface-canvas" ref={canvasRef}>
        <span className="north-wind">▲ N · W {wind}</span>
        <svg
          className="surface-svg"
          viewBox={`${-30 + offset.x} ${-70 + offset.y} ${1260 / zoom} ${1030 / zoom}`}
          role="img"
          aria-label="Schematic WMKK runways, taxiways, stop bars and selectable aircraft"
          onPointerDown={(e) => {
            if ((e.target as Element).closest('[data-aircraft]')) return
            e.currentTarget.setPointerCapture(e.pointerId)
            setDrag({ x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y })
          }}
          onPointerMove={(e) => {
            if (!drag) return
            const scale = 1260 / zoom / e.currentTarget.getBoundingClientRect().width
            setOffset({
              x: drag.ox - (e.clientX - drag.x) * scale,
              y: drag.oy - (e.clientY - drag.y) * scale,
            })
          }}
          onPointerUp={() => setDrag(null)}
          onPointerCancel={() => setDrag(null)}
        >
          <g transform="rotate(-26 600 380)">
            <path className="airfield-area" d="M180 10H1020V710H180Z" />
            {Object.entries(RUNWAYS).map(([id, r]) => (
              <g key={id}>
                <path
                  className="taxiway-line"
                  d={`M${r.hold.x} ${r.top + 50}V${r.bottom - 20}L${r.x} ${r.bottom - 20}`}
                />
                <path
                  className="taxiway-line"
                  d={`M${r.x} 240H${r.hold.x}M${r.x} 440H${r.hold.x}`}
                />
                <rect
                  className={`runway-surface ${blockedRunway === id ? 'blocked' : ''}`}
                  x={r.x - 15}
                  y={r.top}
                  width="30"
                  height={r.bottom - r.top}
                />
                <path className="runway-centre" d={`M${r.x} ${r.top + 28}V${r.bottom - 28}`} />
                <text className="runway-designator" x={r.x} y={r.top - 14} textAnchor="middle">
                  {r.opposite}
                </text>
                <text className="runway-designator" x={r.x} y={r.bottom + 24} textAnchor="middle">
                  {id}
                </text>
                <path
                  className={`stopbar-line ${stopBarOff(aircraft, id as RunwayId) ? 'off' : ''}`}
                  d={`M${r.hold.x - 8} ${r.hold.y}H${r.hold.x + 8}`}
                />
                {showTaxi && (
                  <g className="taxi-sign">
                    <rect x={r.hold.x - 30} y={r.hold.y + 10} width="30" height="20" />
                    <text x={r.hold.x - 15} y={r.hold.y + 25} textAnchor="middle">
                      {holdingPoint(id as RunwayId)}
                    </text>
                  </g>
                )}
              </g>
            ))}
            <path className="taxiway-line" d="M325 350H870M325 530H870M635 240H870M635 440H870" />
            <path className="apron-area" d="M680 250H805V510H680ZM350 350H445V520H350Z" />
            <path
              className="terminal-building"
              d="M660 340H700V480H630V420H660ZM475 360H510V490H455V410H475ZM690 115H790V190H690Z"
            />
            <text className="building-label" x="655" y="454">
              T1
            </text>
            <text className="building-label" x="470" y="452">
              T2
            </text>
            <text className="building-label" x="720" y="156">
              SAT
            </text>
            {showStands &&
              stands.map((p) => (
                <g key={p.id}>
                  <circle className="stand-position" cx={p.x} cy={p.y} r="4" />
                  <text className="stand-label" x={p.x - 12} y={p.y - 5}>
                    {p.id}
                  </text>
                </g>
              ))}
            {showTaxi &&
              [
                { id: 'A', x: 870, y: 250 },
                { id: 'C', x: 635, y: 530 },
                { id: 'Y', x: 325, y: 330 },
                { id: 'E', x: 870, y: 510 },
                { id: 'H', x: 665, y: 250 },
              ].map((p) => (
                <g className="taxi-sign" key={p.id}>
                  <rect x={p.x - 9} y={p.y - 12} width="18" height="22" />
                  <text x={p.x} y={p.y + 4} textAnchor="middle">
                    {p.id}
                  </text>
                </g>
              ))}
            {route.length > 1 && (
              <polyline
                className="cleared-route"
                points={route.map((p) => `${p.x},${p.y}`).join(' ')}
              />
            )}
          </g>
          {active.map((a) => {
            const point = rotatePoint(a.position),
              label = labels.find((l) => l.id === a.id)!
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
        <span className="schematic-notice">Schematic layout, not to scale</span>
        <div className="surface-zoom">
          <button onClick={() => setZoom(Math.min(2, zoom + 0.25))} aria-label="Zoom in">
            +
          </button>
          <button onClick={() => setZoom(Math.max(0.75, zoom - 0.25))} aria-label="Zoom out">
            −
          </button>
          <button
            onClick={() => {
              setZoom(1)
              setOffset({ x: 0, y: 0 })
            }}
            aria-label="Reset map view"
          >
            Fit
          </button>
        </div>
      </div>
    </section>
  )
}
