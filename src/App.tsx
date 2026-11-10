import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Flag,
  Headphones,
  History,
  Info,
  Keyboard,
  LayoutDashboard,
  ListFilter,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Plane,
  Play,
  Radio,
  Radar,
  RotateCcw,
  Route,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SkipBack,
  Square,
  Target,
  TriangleAlert,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import AirportMap from './components/AirportMap'
import { AIRPORT_DATA, PHASE_LABELS, RADIOS, RUNWAYS, SCENARIOS } from './sim/airport'
import {
  createSession,
  formatTime,
  instructorEvent,
  record,
  sessionExport,
  tick,
  transmit,
} from './sim/engine'
import type { Aircraft, Frequency, Session } from './sim/types'

type Modal = 'scenarios' | 'reference' | 'debrief' | 'settings' | null
type Action = { label: string; text: string; primary?: boolean }

function actionsFor(a: Aircraft): Action[] {
  const r = RUNWAYS[a.runway]
  const command = (text: string) => `${a.id}, ${text}`
  if (a.discrepancy)
    return [
      {
        label: 'Correct runway readback',
        text: command(`negative, I say again runway ${a.runway}`),
        primary: true,
      },
      { label: 'Hold position', text: command('hold position') },
    ]
  if (a.phase === 'parked')
    return [
      { label: 'Approve pushback', text: command('pushback approved'), primary: true },
      { label: 'Standby', text: command('standby') },
    ]
  if (['ready', 'stopped', 'taxiing'].includes(a.phase) && a.operation === 'departure')
    return [
      {
        label: a.phase === 'taxiing' ? 'Reissue taxi clearance' : 'Issue taxi clearance',
        text: command(`taxi runway ${a.runway} via ${r.route}, hold short runway ${a.runway}`),
        primary: true,
      },
      { label: 'Hold position', text: command('hold position') },
    ]
  if (a.phase === 'holding' && a.frequency !== r.frequency)
    return [
      {
        label: 'Transfer to tower',
        text: command(`contact Lumpur Tower ${r.frequency}`),
        primary: true,
      },
      { label: 'Standby', text: command('standby') },
    ]
  if (a.phase === 'holding')
    return [
      {
        label: 'Line up and wait',
        text: command(`runway ${a.runway}, line up and wait`),
        primary: true,
      },
      { label: 'Hold position', text: command('hold position') },
    ]
  if (a.phase === 'lined-up')
    return [
      {
        label: 'Clear for takeoff',
        text: command(`runway ${a.runway}, cleared for takeoff`),
        primary: true,
      },
      { label: 'Standby', text: command('standby') },
    ]
  if (a.phase === 'final')
    return [
      {
        label: 'Clear to land',
        text: command(`runway ${a.runway}, cleared to land`),
        primary: true,
      },
      { label: 'Go around', text: command('go around') },
    ]
  if (a.phase === 'vacated' && a.frequency !== r.ground)
    return [
      {
        label: 'Transfer to ground',
        text: command(`contact Lumpur Ground ${r.ground}`),
        primary: true,
      },
    ]
  if (a.phase === 'vacated')
    return [
      { label: 'Taxi to stand', text: command(`taxi to stand ${a.stand} via C`), primary: true },
    ]
  return a.phase === 'complete' ? [] : [{ label: 'Standby', text: command('standby') }]
}

function ModalShell({
  title,
  eyebrow,
  onClose,
  children,
  wide = false,
}: {
  title: string
  eyebrow: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => before?.focus()
  }, [])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return
          const items = ref.current?.querySelectorAll<HTMLElement>(
            'button, input, select, textarea, a[href], [tabindex="0"]',
          )
          if (!items?.length) return
          const first = items[0]
          const last = items[items.length - 1]
          if (
            e.shiftKey &&
            (document.activeElement === first || document.activeElement === ref.current)
          ) {
            e.preventDefault()
            last.focus()
          }
          if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session>(() => createSession())
  const stateRef = useRef(session)
  const [selectedId, setSelectedId] = useState('MAS612')
  const [frequency, setFrequency] = useState<Frequency>('121.650')
  const [filter, setFilter] = useState<'all' | 'departure' | 'arrival'>('all')
  const [search, setSearch] = useState('')
  const [panel, setPanel] = useState<'aircraft' | 'instructor'>('aircraft')
  const [modal, setModal] = useState<Modal>(null)
  const [command, setCommand] = useState('')
  const [commandError, setCommandError] = useState('')
  const [toast, setToast] = useState('')
  const [audio, setAudio] = useState(false)
  const [allFrequencies, setAllFrequencies] = useState(false)
  const [replayIndex, setReplayIndex] = useState<number | null>(null)
  const [confirmScenario, setConfirmScenario] = useState<string | null>(null)
  const commandInput = useRef<HTMLInputElement>(null)
  const transcriptEnd = useRef<HTMLDivElement>(null)
  const lastSpoken = useRef(0)
  const update = useCallback((fn: (s: Session) => Session) => {
    const next = fn(stateRef.current)
    stateRef.current = next
    setSession(next)
  }, [])
  const pause = useCallback(
    () =>
      update((s) =>
        record(
          { ...s, running: !s.running },
          'system',
          s.running ? 'Exercise paused by controller.' : 'Exercise running.',
        ),
      ),
    [update],
  )

  useEffect(() => {
    let last = performance.now()
    const interval = window.setInterval(() => {
      const now = performance.now()
      const elapsed = Math.min((now - last) / 1000, 1)
      last = now
      if (stateRef.current.running) update((s) => tick(s, elapsed))
    }, 250)
    const visibility = () => {
      if (document.hidden && stateRef.current.running)
        update((s) =>
          record(
            { ...s, running: false },
            'system',
            'Exercise paused: browser tab is in the background.',
          ),
        )
    }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [update])
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(''), 4500)
    return () => window.clearTimeout(t)
  }, [toast])
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [session.events.length, frequency, allFrequencies])
  useEffect(() => {
    const latest = session.events.filter((e) => e.kind === 'pilot').at(-1)
    if (!latest || latest.id <= lastSpoken.current) return
    lastSpoken.current = latest.id
    if (audio && 'speechSynthesis' in window) {
      const voice = new SpeechSynthesisUtterance(
        latest.text
          .replace(/32R/g, 'three two right')
          .replace(/32L/g, 'three two left')
          .replace(/\b33\b/g, 'three three'),
      )
      voice.lang = 'en-GB'
      voice.rate = 1
      window.speechSynthesis.speak(voice)
    }
  }, [session.events, audio])
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModal(null)
        setConfirmScenario(null)
        return
      }
      if (
        (e.target as HTMLElement).matches(
          'input, textarea, select, button, a[href], [contenteditable]',
        ) ||
        modal ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return
      if (e.code === 'Space' && !e.repeat && replayIndex === null) {
        e.preventDefault()
        pause()
      }
      if (e.key === '/') {
        e.preventDefault()
        commandInput.current?.focus()
      }
      if (e.key === '?') setModal('reference')
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [pause, modal, replayIndex])

  const scenario = SCENARIOS.find((s) => s.id === session.scenarioId)!
  const displayedAircraft =
    replayIndex === null ? session.aircraft : session.events[replayIndex].snapshot
  const selected = displayedAircraft.find((a) => a.id === selectedId) ?? displayedAircraft[0]
  const actions = actionsFor(selected)
  const visibleAircraft = displayedAircraft.filter(
    (a) =>
      (filter === 'all' || a.operation === filter) &&
      `${a.id} ${a.type} ${a.stand}`.toLowerCase().includes(search.toLowerCase()),
  )
  const active = displayedAircraft.filter((a) => a.phase !== 'complete')
  const waiting = active.filter((a) => a.pending).length
  const issues = session.events.filter((e) => e.kind === 'instructor' && e.severity !== 'info')
  const messages = session.events
    .filter(
      (e) =>
        ['controller', 'pilot'].includes(e.kind) &&
        (allFrequencies || e.frequency === frequency) &&
        (replayIndex === null || e.id <= session.events[replayIndex].id),
    )
    .slice(-40)
  const replayEvent = replayIndex === null ? null : session.events[replayIndex]

  function prepare(text: string) {
    setCommand(text)
    setCommandError('')
    commandInput.current?.focus()
  }
  function send() {
    if (replayIndex !== null) {
      setCommandError('Return to the live session before transmitting.')
      return
    }
    if (!session.running) {
      setCommandError('Start or resume the exercise before transmitting.')
      return
    }
    const result = transmit(stateRef.current, command, frequency)
    update(() => result.session)
    if (result.error) setCommandError(result.error)
    else {
      setCommand('')
      setCommandError('')
    }
    commandInput.current?.focus()
  }
  function loadScenario(id: string) {
    if ((session.time > 0 || session.attempted > 0) && confirmScenario !== id) {
      setConfirmScenario(id)
      return
    }
    window.speechSynthesis?.cancel()
    const next = createSession(id)
    update(() => next)
    setSelectedId('MAS612')
    setFrequency('121.650')
    setReplayIndex(null)
    setCommand('')
    setCommandError('')
    setModal(null)
    setConfirmScenario(null)
    setToast('Exercise loaded. Review the briefing, then start when ready.')
  }
  function exportSession() {
    const blob = new Blob([JSON.stringify(sessionExport(stateRef.current), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${scenario.code.toLowerCase()}-session-${Math.floor(session.time)}s.json`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setToast('Session history exported as JSON.')
  }
  function replay(index: number) {
    update((s) => ({ ...s, running: false }))
    setReplayIndex(index)
    setModal(null)
    setCommandError('')
  }
  function toggleAudio() {
    if (!('speechSynthesis' in window)) {
      setToast('Browser speech synthesis is unavailable. Text readbacks remain available.')
      return
    }
    if (audio) window.speechSynthesis.cancel()
    setAudio(!audio)
  }

  return (
    <div className="app-shell">
      <aside className="nav-rail">
        <a
          className="brand-mark"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="VATSIM AI workstation"
        >
          <svg viewBox="0 0 32 32">
            <path
              d="m6 8 10 19L26 8M12 8l4 8 4-8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
        <div className="rail-links">
          <button
            className="rail-button selected"
            aria-label="Controller workstation"
            title="Controller workstation"
            onClick={() => setModal(null)}
          >
            <LayoutDashboard size={20} />
          </button>
          <button
            className="rail-button"
            aria-label="Choose exercise"
            title="Exercises"
            onClick={() => {
              setConfirmScenario(null)
              setModal('scenarios')
            }}
          >
            <Radar size={21} />
          </button>
          <button
            className="rail-button"
            aria-label="Session debrief"
            title="Session debrief"
            onClick={() => setModal('debrief')}
          >
            <History size={20} />
          </button>
          <button
            className="rail-button"
            aria-label="Command reference"
            title="Command reference (?)"
            onClick={() => setModal('reference')}
          >
            <BookOpen size={20} />
          </button>
        </div>
        <div className="rail-bottom">
          <button
            className="rail-button"
            aria-label="Workstation settings"
            onClick={() => setModal('settings')}
          >
            <Settings2 size={19} />
          </button>
          <span className="user-avatar" title="Local development session">
            LC
          </span>
        </div>
      </aside>
      <div className="workstation">
        <header className="main-header">
          <div className="product-title">
            <span>
              VATSIM <strong>AI</strong>
            </span>
            <span className="product-edition">CONTROLLER WORKSTATION</span>
          </div>
          <div className="header-breadcrumb">
            <span>Training environment</span>
            <ChevronRight size={13} />
            <strong>WMKK</strong>
          </div>
          <span className="development-pill">
            <span />
            DEVELOPMENT PREVIEW
          </span>
          <div className="header-actions">
            <button className="quiet-button" onClick={() => setModal('reference')}>
              <BookOpen size={15} />
              <span>Reference</span>
              <kbd>?</kbd>
            </button>
            <button
              className="icon-button"
              aria-label={audio ? 'Disable pilot readback audio' : 'Enable pilot readback audio'}
              onClick={toggleAudio}
            >
              {audio ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            <span className="header-separator" />
            <span className="local-session">
              <span className="live-dot" />
              LOCAL SESSION
            </span>
          </div>
        </header>
        <section className="session-bar" aria-label="Exercise controls">
          <div className="airport-ident">
            <span className="airport-code">WMKK</span>
            <div>
              <h1>Kuala Lumpur International</h1>
              <p>
                <span>GROUND & TOWER</span>
                <span className="sub-dot">·</span>RWY 32 / 33 configuration
              </p>
            </div>
          </div>
          <button
            className="exercise-selector"
            onClick={() => {
              setConfirmScenario(null)
              setModal('scenarios')
            }}
          >
            <span className="exercise-icon">
              <FileText size={17} />
            </span>
            <span>
              <small>{scenario.code}</small>
              <strong>{scenario.title}</strong>
            </span>
            <ChevronDown size={14} />
          </button>
          <div className="session-clock">
            <Clock3 size={16} />
            <span>{formatTime(replayEvent?.time ?? session.time)}</span>
            <small>ELAPSED</small>
          </div>
          <div className="playback">
            <button
              className={`play-button ${session.running ? 'running' : ''}`}
              disabled={replayIndex !== null}
              onClick={pause}
              aria-label={
                session.running
                  ? 'Pause exercise'
                  : session.time
                    ? 'Resume exercise'
                    : 'Start exercise'
              }
            >
              {session.running ? (
                <Pause size={14} fill="currentColor" />
              ) : (
                <Play size={14} fill="currentColor" />
              )}
              <span>{session.running ? 'Pause' : session.time ? 'Resume' : 'Start exercise'}</span>
            </button>
            <div className="speed-group" aria-label="Simulation speed">
              {([1, 2, 4] as const).map((speed) => (
                <button
                  key={speed}
                  aria-pressed={session.speed === speed}
                  className={session.speed === speed ? 'active' : ''}
                  onClick={() => update((s) => ({ ...s, speed }))}
                  disabled={replayIndex !== null}
                >
                  {speed}×
                </button>
              ))}
            </div>
            <button
              className="icon-button end-button"
              aria-label="Pause and open debrief"
              title="Pause and debrief"
              onClick={() => {
                if (session.running) pause()
                setModal('debrief')
              }}
            >
              <Square size={13} />
            </button>
          </div>
        </section>
        <main className="workspace-grid">
          <aside className="traffic-panel" aria-label="Flight strips">
            <div className="panel-heading">
              <div>
                <ListFilter size={16} />
                <h2>Flight strips</h2>
                <span className="count-badge">{active.length}</span>
              </div>
              <button
                className="icon-button"
                onClick={() => setSearch('')}
                aria-label="Clear traffic search"
                title="Clear traffic search"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
            <div className="traffic-search">
              <Search size={14} />
              <input
                aria-label="Search flight strips"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Callsign, aircraft or stand"
              />
              <kbd>/</kbd>
            </div>
            <div className="traffic-tabs">
              {(['all', 'departure', 'arrival'] as const).map((f) => (
                <button
                  key={f}
                  className={filter === f ? 'active' : ''}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All traffic' : f === 'departure' ? 'Departures' : 'Arrivals'}
                  <span>
                    {session.aircraft.filter((a) => f === 'all' || a.operation === f).length}
                  </span>
                </button>
              ))}
            </div>
            <div className="strip-section-label">
              <span>ACTIVE TRAFFIC</span>
              <span>{waiting} awaiting</span>
            </div>
            <div className="flight-strip-list">
              {visibleAircraft.map((a) => (
                <button
                  className={`flight-strip ${a.id === selected.id ? 'selected' : ''} ${a.operation}`}
                  key={a.id}
                  onClick={() => {
                    setSelectedId(a.id)
                    setPanel('aircraft')
                  }}
                  aria-label={`Select ${a.id}`}
                  aria-pressed={a.id === selected.id}
                >
                  <div className="strip-top">
                    <span className="strip-callsign">
                      {a.operation === 'arrival' ? (
                        <ArrowDownLeft size={15} />
                      ) : (
                        <ArrowUpRight size={15} />
                      )}
                      {a.id}
                    </span>
                    <span className="aircraft-type">
                      {a.type}
                      <small>/{a.wake}</small>
                    </span>
                    {a.pending && <span className="calling-dot" title="Pilot awaiting response" />}
                  </div>
                  <div className="strip-middle">
                    <span>
                      {a.operation === 'arrival' ? 'ARR WMKK' : a.destination}
                      <span className="strip-mid-dot">·</span>
                      {a.operation === 'arrival' ? 'STAND' : 'FROM'} {a.stand}
                    </span>
                    <strong>{a.runway}</strong>
                  </div>
                  <div className="strip-bottom">
                    <span className={`phase-tag ${a.discrepancy ? 'warning' : ''}`}>
                      {a.discrepancy ? 'CHECK READBACK' : PHASE_LABELS[a.phase]}
                    </span>
                    <span className="strip-frequency">{a.frequency}</span>
                  </div>
                </button>
              ))}
              {visibleAircraft.length === 0 && (
                <div className="empty-state">
                  <Search size={22} />
                  <p>No matching aircraft</p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setSearch('')
                      setFilter('all')
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
            <div className="traffic-summary">
              <div>
                <span className="legend-dot departure" />
                Departures
                <strong>{active.filter((a) => a.operation === 'departure').length}</strong>
              </div>
              <div>
                <span className="legend-dot arrival" />
                Arrivals<strong>{active.filter((a) => a.operation === 'arrival').length}</strong>
              </div>
            </div>
            <div className="briefing-card">
              <div>
                <Target size={16} />
                <span>EXERCISE OBJECTIVE</span>
              </div>
              <p>{scenario.objective}</p>
              <button onClick={() => setModal('reference')}>
                View command reference
                <ArrowRight size={13} />
              </button>
            </div>
            <button className="dataset-note" onClick={() => setModal('settings')}>
              <Info size={14} />
              <span>
                Schematic airport data<small>Procedure validation pending</small>
              </span>
              <ChevronRight size={13} />
            </button>
          </aside>
          <div className="centre-workspace">
            <AirportMap
              aircraft={displayedAircraft}
              selected={selected.id}
              onSelect={(id) => {
                setSelectedId(id)
                setPanel('aircraft')
              }}
              blockedRunway={
                replayIndex === null
                  ? session.blockedRunway
                  : session.events[replayIndex].blockedRunway
              }
              replay={replayIndex !== null}
            />
            {replayIndex !== null && (
              <div className="replay-bar">
                <History size={15} />
                <span>
                  EVENT {replayIndex + 1}/{session.events.length}
                </span>
                <input
                  aria-label="Replay event"
                  type="range"
                  min="0"
                  max={session.events.length - 1}
                  value={replayIndex}
                  onChange={(e) => setReplayIndex(Number(e.target.value))}
                />
                <span>{formatTime(replayEvent!.time)}</span>
                <button className="text-button" onClick={() => setReplayIndex(null)}>
                  Return to live
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
            <section className="communications" aria-label="Radio communications">
              <div className="communications-heading">
                <div>
                  <Radio size={15} />
                  <h2>Communications</h2>
                  <span className="comms-frequency">{frequency}</span>
                </div>
                <button
                  className={`text-button ${allFrequencies ? 'lime-text' : ''}`}
                  onClick={() => setAllFrequencies(!allFrequencies)}
                >
                  {allFrequencies ? 'All frequencies' : 'Active frequency'}
                  <ChevronDown size={12} />
                </button>
              </div>
              <div
                className="transcript"
                role="log"
                aria-label="Radio transcript"
                aria-live="polite"
              >
                {messages.map((e) => (
                  <div key={e.id} className={`transcript-row ${e.kind}`}>
                    <time>{formatTime(e.time)}</time>
                    <span className="transcript-speaker">
                      {e.kind === 'controller' ? 'YOU' : e.aircraftId}
                    </span>
                    <p>{e.text}</p>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="transcript-empty">
                    No transmissions on this frequency. Select an aircraft to check its assigned
                    station.
                  </p>
                )}
                <div ref={transcriptEnd} />
              </div>
              <div className="transmit-area">
                <div className="radio-selector">
                  <label>
                    <Headphones size={14} />
                    <span>TRANSMIT ON</span>
                    <select
                      aria-label="Transmit frequency"
                      value={frequency}
                      onChange={(e) => {
                        setFrequency(e.target.value as Frequency)
                        setCommandError('')
                      }}
                    >
                      {RADIOS.map((r) => (
                        <option value={r.frequency} key={r.frequency}>
                          {r.short} · {r.frequency}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="scripted-label">
                    <span className="live-dot" />
                    Scripted pilots
                  </span>
                </div>
                <form
                  className={`command-form ${commandError ? 'has-error' : ''}`}
                  onSubmit={(e) => {
                    e.preventDefault()
                    send()
                  }}
                >
                  <Keyboard size={17} />
                  <input
                    ref={commandInput}
                    aria-label="Controller transmission"
                    placeholder={`${selected.id}, ${selected.phase === 'parked' ? 'pushback approved' : 'enter an instruction…'}`}
                    value={command}
                    onChange={(e) => {
                      setCommand(e.target.value)
                      setCommandError('')
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={replayIndex !== null}
                  />
                  <button
                    type="submit"
                    aria-label="Transmit clearance"
                    disabled={!command.trim() || replayIndex !== null}
                  >
                    <span>Transmit</span>
                    <Send size={15} />
                  </button>
                </form>
                {commandError ? (
                  <p className="command-error" role="alert">
                    <TriangleAlert size={12} />
                    {commandError}
                  </p>
                ) : (
                  <div className="command-help">
                    <span>Typed radio · full callsign required</span>
                    <button onClick={() => setModal('reference')}>
                      Command reference
                      <ArrowUpRight size={11} />
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
          <aside className="inspector-panel">
            <div className="inspector-tabs">
              <button
                className={panel === 'aircraft' ? 'active' : ''}
                onClick={() => setPanel('aircraft')}
              >
                <Plane size={15} />
                Aircraft
              </button>
              <button
                className={panel === 'instructor' ? 'active' : ''}
                onClick={() => setPanel('instructor')}
              >
                <ShieldCheck size={15} />
                Instructor
                {issues.length > 0 && <span className="issue-count">{issues.length}</span>}
              </button>
            </div>
            {panel === 'aircraft' ? (
              <>
                <div className="aircraft-profile">
                  <div className="profile-eyebrow">
                    <span>SELECTED AIRCRAFT</span>
                    <span className={`operation-label ${selected.operation}`}>
                      {selected.operation === 'arrival' ? 'INBOUND' : 'OUTBOUND'}
                    </span>
                  </div>
                  <div className="profile-title">
                    <div>
                      <h2>{selected.id}</h2>
                      <p>{selected.spoken}</p>
                    </div>
                    <div className="plane-avatar">
                      <Plane size={27} strokeWidth={1.2} />
                    </div>
                  </div>
                  <div className="profile-type">
                    <span>
                      {selected.type === 'B738'
                        ? 'Boeing 737-800'
                        : selected.type === 'A320'
                          ? 'Airbus A320'
                          : 'Airbus A330-300'}
                    </span>
                    <span>{selected.wake === 'H' ? 'HEAVY' : 'MEDIUM'}</span>
                  </div>
                </div>
                <div className="aircraft-data">
                  <div>
                    <span>PHASE</span>
                    <strong className="phase-value">
                      <span className="live-dot" />
                      {PHASE_LABELS[selected.phase]}
                    </strong>
                  </div>
                  <div>
                    <span>ASSIGNED RUNWAY</span>
                    <strong>{selected.runway}</strong>
                  </div>
                  <div>
                    <span>
                      {selected.operation === 'arrival' ? 'ARRIVAL STAND' : 'DEPARTURE STAND'}
                    </span>
                    <strong>{selected.stand}</strong>
                  </div>
                  <div>
                    <span>GROUND SPEED</span>
                    <strong>
                      {selected.speed}
                      <small> KT</small>
                    </strong>
                  </div>
                  <div>
                    <span>DESTINATION</span>
                    <strong>{selected.destination}</strong>
                  </div>
                  <div>
                    <span>RADIO FREQUENCY</span>
                    <strong>{selected.frequency}</strong>
                  </div>
                </div>
                <div className="clearance-card">
                  <span className="eyebrow">
                    <FileText size={13} />
                    CURRENT CLEARANCE
                  </span>
                  <p>{selected.clearance}</p>
                </div>
                {selected.discrepancy && (
                  <div className="readback-warning">
                    <TriangleAlert size={16} />
                    <div>
                      <strong>Readback discrepancy</strong>
                      <p>
                        Issued {selected.discrepancy.issued} · read back{' '}
                        {selected.discrepancy.readback}. A correction is required.
                      </p>
                    </div>
                  </div>
                )}
                <div className="suggested-actions">
                  <p className="eyebrow">SUGGESTED TRANSMISSIONS</p>
                  {selected.frequency !== frequency && selected.phase !== 'complete' && (
                    <button
                      className="switch-frequency"
                      onClick={() => {
                        setFrequency(selected.frequency)
                        setToast(`Transmitting on ${selected.frequency}.`)
                      }}
                    >
                      <Radio size={14} />
                      <span>Switch to {selected.frequency}</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                  {actions.map((action) => (
                    <button
                      key={action.label}
                      className={`suggested-action ${action.primary ? 'primary' : ''}`}
                      onClick={() => prepare(action.text)}
                      disabled={replayIndex !== null}
                    >
                      <span>
                        {action.primary ? <MessageSquare size={15} /> : <Radio size={14} />}
                        {action.label}
                      </span>
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                  {actions.length === 0 && (
                    <div className="completed-message">
                      <CheckCheck size={18} />
                      Aircraft exercise complete
                    </div>
                  )}
                  <p className="suggestion-note">
                    Select a suggestion to prepare it.
                    <br />
                    Review, then transmit on the correct frequency.
                  </p>
                </div>
                <div className="instructor-prompt">
                  <span className="instructor-avatar">
                    <ShieldCheck size={18} />
                  </span>
                  <div>
                    <strong>Your instructor station</strong>
                    <p>Control events and review the session.</p>
                    <button onClick={() => setPanel('instructor')}>
                      Open instructor controls
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="instructor-content">
                <div className="instructor-intro">
                  <span className="eyebrow">EXERCISE DIRECTOR</span>
                  <h2>Instructor station</h2>
                  <p>Controlled events for procedural development and debrief.</p>
                </div>
                <div className="instructor-control">
                  <div>
                    <ShieldCheck size={17} />
                    <span>
                      <strong>Training guards</strong>
                      <small>
                        {session.guidance
                          ? 'Hold unsafe runway clearances'
                          : 'Record unsafe clearance consequences'}
                      </small>
                    </span>
                  </div>
                  <button
                    role="switch"
                    aria-checked={session.guidance}
                    aria-label="Training guards"
                    className={`toggle-switch ${session.guidance ? 'on' : ''}`}
                    disabled={replayIndex !== null}
                    onClick={() => update((s) => instructorEvent(s, 'guidance'))}
                  >
                    <span />
                  </button>
                </div>
                <p className="eyebrow event-label">INJECT AN EVENT</p>
                <button
                  className={`event-button ${session.injectReadback ? 'armed' : ''}`}
                  disabled={replayIndex !== null}
                  onClick={() => update((s) => instructorEvent(s, 'readback'))}
                >
                  <MessageSquare size={17} />
                  <span>
                    <strong>Incorrect runway readback</strong>
                    <small>
                      {session.injectReadback
                        ? 'Armed · next taxi clearance'
                        : 'Script the next taxi readback'}
                    </small>
                  </span>
                  {session.injectReadback ? <Check size={16} /> : <PlusIcon />}
                </button>
                <button
                  className={`event-button ${session.blockedRunway ? 'armed' : ''}`}
                  disabled={replayIndex !== null}
                  onClick={() => update((s) => instructorEvent(s, 'obstruction'))}
                >
                  <TriangleAlert size={17} />
                  <span>
                    <strong>Runway obstruction</strong>
                    <small>
                      {session.blockedRunway
                        ? '32R occupied · click to clear'
                        : 'Place inspection vehicle on 32R'}
                    </small>
                  </span>
                  {session.blockedRunway ? <Check size={16} /> : <PlusIcon />}
                </button>
                <div className="instructor-events">
                  <div className="section-inline-heading">
                    <p className="eyebrow">OBSERVATIONS</p>
                    <span>{issues.length}</span>
                  </div>
                  {issues.length ? (
                    issues
                      .slice(-6)
                      .reverse()
                      .map((e) => (
                        <button
                          className={`observation ${e.severity}`}
                          key={e.id}
                          onClick={() =>
                            replay(session.events.findIndex((item) => item.id === e.id))
                          }
                        >
                          <div>
                            <time>{formatTime(e.time)}</time>
                            <span>
                              {e.severity === 'critical' ? 'REVIEW REQUIRED' : 'COACHING NOTE'}
                            </span>
                          </div>
                          <p>{e.text}</p>
                          <small>
                            Inspect event
                            <ArrowUpRight size={11} />
                          </small>
                        </button>
                      ))
                  ) : (
                    <div className="no-observations">
                      <CheckCheck size={22} />
                      <strong>No observations yet</strong>
                      <p>Exercise events and communication issues appear here.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="inspector-bottom">
              <span>
                <span className="live-dot" />
                ENGINE READY
              </span>
              <span>v0.1.0</span>
            </div>
          </aside>
        </main>
        <footer className="status-bar">
          <div>
            <span className={`status-dot ${session.running ? 'running' : ''}`} />
            <strong>
              {replayIndex !== null
                ? 'REPLAY'
                : session.running
                  ? 'EXERCISE RUNNING'
                  : 'EXERCISE PAUSED'}
            </strong>
            <span className="status-divider" />
            <span>{active.length} aircraft</span>
            <span className="status-divider" />
            <span>{waiting} awaiting response</span>
          </div>
          <div className="status-shortcuts">
            <span>
              <kbd>Space</kbd>Pause / resume
            </span>
            <span>
              <kbd>/</kbd>Transmission
            </span>
            <span>
              <kbd>?</kbd>Reference
            </span>
          </div>
          <button onClick={exportSession}>
            <Download size={12} />
            Export session
          </button>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={16} />
          {toast}
          <button onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}
      {modal === 'scenarios' && (
        <ModalShell
          title="Choose your exercise"
          eyebrow="WMKK TRAINING LIBRARY"
          onClose={() => {
            setModal(null)
            setConfirmScenario(null)
          }}
          wide
        >
          <p className="modal-intro">
            Focused exercises for developing the controller workflow. Each uses the same
            illustrative airport dataset.
          </p>
          <div className="scenario-cards">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                className={`scenario-card ${s.id === session.scenarioId ? 'current' : ''}`}
                onClick={() => loadScenario(s.id)}
              >
                <div className={`scenario-art art-${s.id}`}>
                  <div className="mini-runway" />
                  <div className="mini-runway second" />
                  <Plane size={22} />
                  <span>{s.code}</span>
                </div>
                <div className="scenario-card-content">
                  <span className="eyebrow">{s.category}</span>
                  <h3>{s.title}</h3>
                  <p>{s.description}</p>
                  <div className="scenario-meta">
                    <span>
                      <Clock3 size={12} />
                      {s.duration}
                    </span>
                    <span>
                      <Plane size={12} />
                      {s.traffic}
                    </span>
                  </div>
                  <span className="scenario-load">
                    {confirmScenario === s.id
                      ? 'Confirm reset & load exercise'
                      : s.id === session.scenarioId
                        ? 'Restart this exercise'
                        : 'Load exercise'}
                    <ArrowRight size={15} />
                  </span>
                </div>
              </button>
            ))}
          </div>
          {confirmScenario && (
            <div className="reset-notice">
              <TriangleAlert size={16} />
              <span>
                Loading an exercise resets this session. Export the current history first if you
                need to keep it.
              </span>
              <button className="text-button" onClick={exportSession}>
                Export first
                <Download size={13} />
              </button>
            </div>
          )}
        </ModalShell>
      )}
      {modal === 'reference' && (
        <ModalShell
          title="Your radio, precisely."
          eyebrow="DEVELOPMENT COMMAND REFERENCE"
          onClose={() => setModal(null)}
          wide
        >
          <p className="modal-intro">
            Use the full callsign. These are the supported prototype commands, not a complete
            operational phraseology manual. Selecting an example prepares a transmission for{' '}
            {selected.id}.
          </p>
          <div className="reference-layout">
            <div className="reference-commands">
              {[
                ['Pushback', 'pushback approved'],
                [
                  'Taxi to holding point',
                  `taxi runway ${selected.runway} via ${RUNWAYS[selected.runway].route}, hold short runway ${selected.runway}`,
                ],
                ['Hold position', 'hold position'],
                ['Transfer to tower', `contact Lumpur Tower ${RUNWAYS[selected.runway].frequency}`],
                ['Line up', `runway ${selected.runway}, line up and wait`],
                ['Takeoff', `runway ${selected.runway}, cleared for takeoff`],
                ['Landing', `runway ${selected.runway}, cleared to land`],
                ['Go around', 'go around'],
                ['Acknowledge', 'standby'],
                ['Correct readback', `negative, I say again runway ${selected.runway}`],
                ['Transfer to ground', `contact Lumpur Ground ${RUNWAYS[selected.runway].ground}`],
                ['Taxi to arrival stand', `taxi to stand ${selected.stand} via C`],
              ].map(([label, text]) => (
                <button
                  key={label}
                  onClick={() => {
                    setModal(null)
                    window.setTimeout(() => prepare(`${selected.id}, ${text}`), 0)
                  }}
                >
                  <span>{label}</span>
                  <code>
                    {selected.id}, {text}
                  </code>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
            <div className="reference-notes">
              <div>
                <Target size={19} />
                <h3>A complete departure</h3>
                <ol>
                  <li>Approve pushback on ground.</li>
                  <li>Start the exercise and wait for “ready to taxi”.</li>
                  <li>Taxi via the demonstration route.</li>
                  <li>At the holding point, transfer to tower.</li>
                  <li>Select the tower frequency.</li>
                  <li>Line up and wait, then clear for takeoff.</li>
                </ol>
              </div>
              <div className="reference-note">
                <Info size={16} />
                <p>
                  Commands are checked against aircraft phase, frequency, and the supported route.
                  Instructions outside this vocabulary are logged without changing aircraft state.
                </p>
              </div>
              <p className="muted-small">
                For MAS1134: select 118.500, issue landing clearance, wait for runway vacation,
                transfer to 121.650, then taxi to B10 via C.
              </p>
            </div>
          </div>
        </ModalShell>
      )}
      {modal === 'debrief' && (
        <ModalShell
          title="Every instruction tells a story."
          eyebrow="SESSION REVIEW"
          onClose={() => setModal(null)}
          wide
        >
          <div className="debrief-metrics">
            <div>
              <Clock3 size={17} />
              <strong>{formatTime(session.time)}</strong>
              <span>Exercise time</span>
            </div>
            <div>
              <CheckCheck size={17} />
              <strong>
                {session.completed}/{session.aircraft.length}
              </strong>
              <span>Aircraft completed</span>
            </div>
            <div>
              <Radio size={17} />
              <strong>
                {session.accepted}/{session.attempted}
              </strong>
              <span>Instructions applied</span>
            </div>
            <div>
              <Flag size={17} />
              <strong>{issues.length}</strong>
              <span>Observations</span>
            </div>
          </div>
          <p className="debrief-note">
            Development evidence only. Counts are not competency scores. Select an event to inspect
            the airport snapshot recorded at that moment.
          </p>
          <div className="event-timeline">
            {session.events.map((e, i) => (
              <button
                key={e.id}
                className={`timeline-event ${e.severity}`}
                onClick={() => replay(i)}
              >
                <time>{formatTime(e.time)}</time>
                <span className={`timeline-kind ${e.kind}`}>{e.kind}</span>
                <p>{e.text}</p>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
          <div className="modal-footer">
            <button className="secondary-button" onClick={() => replay(0)}>
              <SkipBack size={15} />
              Review from beginning
            </button>
            <button className="primary-button" onClick={exportSession}>
              <Download size={15} />
              Export session JSON
            </button>
          </div>
        </ModalShell>
      )}
      {modal === 'settings' && (
        <ModalShell
          title="Workstation & data"
          eyebrow="ENVIRONMENT DETAILS"
          onClose={() => setModal(null)}
        >
          <div className="settings-section">
            <h3>
              <Activity size={17} />
              Development prototype
            </h3>
            <p>
              This release runs its simulation in your browser tab. Export history before
              refreshing; sessions are not yet stored on a server.
            </p>
            <div className="settings-row">
              <span>
                Pilot readback audio<small>Uses your browser’s speech synthesis</small>
              </span>
              <button className="secondary-button" onClick={toggleAudio}>
                {audio ? <Volume2 size={15} /> : <VolumeX size={15} />}
                {audio ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
          <div className="settings-section">
            <h3>
              <LayersIcon />
              Airport data
            </h3>
            <dl>
              <div>
                <dt>Dataset</dt>
                <dd>{AIRPORT_DATA.id}</dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd className="amber-text">Illustrative · unverified</dd>
              </div>
              <div>
                <dt>Simulation</dt>
                <dd>Simplified movement & scripted pilots</dd>
              </div>
            </dl>
            <p>
              {AIRPORT_DATA.note} No speech recognition, generative pilot AI, separation-minima
              model, or professional assessment is implemented.
            </p>
          </div>
          <div className="settings-section">
            <h3>
              <Keyboard size={17} />
              Keyboard shortcuts
            </h3>
            <div className="shortcut-list">
              <span>
                Pause or resume<kbd>Space</kbd>
              </span>
              <span>
                Focus transmission<kbd>/</kbd>
              </span>
              <span>
                Open command reference<kbd>?</kbd>
              </span>
              <span>
                Close dialog<kbd>Esc</kbd>
              </span>
            </div>
          </div>
          <div className="modal-footer">
            <button
              className="secondary-button"
              onClick={() => {
                setModal('scenarios')
                setConfirmScenario(session.scenarioId)
              }}
            >
              <RotateCcw size={15} />
              Reset exercise
            </button>
            <button className="primary-button" onClick={() => setModal(null)}>
              Back to workstation
              <ArrowRight size={15} />
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  )
}

function PlusIcon() {
  return <span className="small-plus">+</span>
}
function LayersIcon() {
  return <Route size={17} />
}
