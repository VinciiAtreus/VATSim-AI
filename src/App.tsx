import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  Download,
  Flag,
  Headphones,
  FolderOpen,
  History,
  Info,
  Keyboard,
  MessageSquare,
  Plane,
  Radio,
  RotateCcw,
  Route,
  Send,
  Settings2,
  ShieldCheck,
  SkipBack,
  Target,
  TriangleAlert,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { readPreference, writePreference } from './workstation/preferences'
import StripBay from './workstation/StripBay'
import FinalApproach from './workstation/FinalApproach'
import { useRadio } from './workstation/useRadio'
import { holdingPoint, rfl, squawk, safetyAlerts, stopBarOff, utcTime } from './workstation/model'
import AirportMap from './components/AirportMap'
import ModalShell from './components/ModalShell'
import SessionLibrary from './components/SessionLibrary'
import PilotStation, { type SessionAction } from './components/PilotStation'
import ObservationEditor from './components/ObservationEditor'
import { useSession } from './hooks/useSession'
import { MAX_SESSION_BYTES, decodeSession, forkSession, parseSessionFile } from './sim/sessionCodec'
import { listSessions, type SavedSession } from './storage/sessionStore'
import { ENGINE_VERSION } from './sim/version'
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
import type { Aircraft, Frequency, RunwayId, Session } from './sim/types'

type Modal = 'scenarios' | 'reference' | 'debrief' | 'settings' | 'sessions' | 'restore' | null
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
  if (a.phase === 'stopped' && a.heldFrom)
    return [
      { label: 'Continue taxi', text: command('continue taxi'), primary: true },
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

export default function App() {
  const { session, stateRef, update, ready, saveStatus, saveNow, notice, dismissNotice } =
    useSession()
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryError, setLibraryError] = useState('')
  const [obstructionRunway, setObstructionRunway] = useState<RunwayId>('32R')
  const [pendingRestore, setPendingRestore] = useState<{
    session: Session
    migrated: boolean
    source: string
  } | null>(null)
  const [selectedId, setSelectedId] = useState('MAS612')
  const [frequency, setFrequency] = useState<Frequency>('121.650')
  const [panel, setPanel] = useState<'aircraft' | 'instructor'>('aircraft')
  const [modal, setModal] = useState<Modal>(null)
  const [command, setCommand] = useState('')
  const [commandError, setCommandError] = useState('')
  const [toast, setToast] = useState('')
  const [audio, setAudio] = useState(() => readPreference('wmkk-audio') === 'true')
  const [mode, setMode] = useState(() => readPreference('wmkk-mode') || 'night')
  const [voiceInput, setVoiceInput] = useState(() => readPreference('wmkk-voice') === 'true')
  const [pttBinding, setPttBinding] = useState(
    () =>
      readPreference('wmkk-ptt') || (/Mac/.test(navigator.platform) ? 'AltRight' : 'ControlRight'),
  )
  const [latch, setLatch] = useState(() => readPreference('wmkk-latch') === 'true')
  const [phraseOnly, setPhraseOnly] = useState(() => readPreference('wmkk-phrase') === 'true')
  const [utc, setUtc] = useState(() => new Date())
  const [rx, setRx] = useState<Frequency[]>(RADIOS.map((r) => r.frequency))
  const [busyFrequency, setBusyFrequency] = useState<Frequency | null>(null)
  const [weather, setWeather] = useState(() => {
    try {
      return JSON.parse(readPreference('wmkk-weather') || '') as {
        wind: string
        qnh: string
        atis: number
      }
    } catch {
      return { wind: '320/05', qnh: '1012', atis: 0 }
    }
  })
  useEffect(() => {
    const timer = window.setInterval(() => setUtc(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.mode = mode
    writePreference('wmkk-mode', mode)
  }, [mode])
  useEffect(() => {
    writePreference('wmkk-latch', String(latch))
    writePreference('wmkk-audio', String(audio))
    writePreference('wmkk-voice', String(voiceInput))
    writePreference('wmkk-ptt', pttBinding)
    writePreference('wmkk-phrase', String(phraseOnly))
    writePreference('wmkk-weather', JSON.stringify(weather))
  }, [audio, voiceInput, pttBinding, phraseOnly, weather, latch])
  const [allFrequencies, setAllFrequencies] = useState(false)
  const [replayIndex, setReplayIndex] = useState<number | null>(null)
  const [reviewFilter, setReviewFilter] = useState<
    'all' | 'radio' | 'interventions' | 'observations'
  >('all')
  const [confirmScenario, setConfirmScenario] = useState<string | null>(null)
  const commandInput = useRef<HTMLInputElement>(null)
  const transcriptEnd = useRef<HTMLDivElement>(null)
  const lastSpoken = useRef(0)
  const lastBusyEvent = useRef('')
  const busyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pause = useCallback(() => {
    if (!ready) return
    update((s) =>
      record(
        { ...s, running: !s.running },
        'system',
        s.running ? 'Exercise paused by controller.' : 'Exercise running.',
      ),
    )
  }, [ready, update])

  useEffect(() => {
    let last = performance.now()
    const interval = window.setInterval(() => {
      const now = performance.now()
      const elapsed = Math.min((now - last) / 1000, 1)
      last = now
      if (stateRef.current.running) update((s) => tick(s, elapsed))
    }, 100)
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
    if (audio && session.running && rx.includes(latest.frequency!) && 'speechSynthesis' in window) {
      const voice = new SpeechSynthesisUtterance(
        latest.text
          .replace(/32R/g, 'three two right')
          .replace(/32L/g, 'three two left')
          .replace(/\b33\b/g, 'three three'),
      )
      voice.lang = 'en-GB'
      voice.rate = 1
      const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
      const aircraftIndex = session.aircraft.findIndex((a) => a.id === latest.aircraftId)
      if (voices.length) voice.voice = voices[Math.max(0, aircraftIndex) % voices.length]
      window.speechSynthesis.speak(voice)
    }
  }, [session.events, audio, rx, session.running])
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
      if (e.code === 'KeyP' && !e.repeat && replayIndex === null) {
        e.preventDefault()
        pause()
      }
      if (['Digit1', 'Digit2', 'Digit4'].includes(e.code))
        update((s) => ({ ...s, speed: Number(e.code.slice(-1)) as 1 | 2 | 4 }))
      if (['F1', 'F2', 'F3'].includes(e.key)) {
        e.preventDefault()
        setFrequency(RADIOS[Number(e.key.slice(1)) - 1].frequency)
      }
      if (e.key === 'Enter' && !e.repeat)
        document.querySelector<HTMLButtonElement>('.clearance-primary')?.click()
      if (e.code === 'KeyH' && !e.repeat) {
        setCommand(`${selectedId}, hold position`)
        commandInput.current?.focus()
      }
      if (e.key === '/') {
        e.preventDefault()
        commandInput.current?.focus()
      }
      if (e.key === '?') setModal('reference')
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [pause, modal, replayIndex, update, selectedId])

  const scenario = SCENARIOS.find((s) => s.id === session.scenarioId)!
  const displayedAircraft =
    replayIndex === null ? session.aircraft : session.events[replayIndex].snapshot
  const selected = displayedAircraft.find((a) => a.id === selectedId) ?? displayedAircraft[0]
  const actions = actionsFor(selected)
  const active = displayedAircraft.filter((a) => a.phase !== 'complete')
  const waiting = active.filter((a) => a.pending).length
  const issues = session.events.filter(
    (e) =>
      e.kind === 'note' || (['instructor', 'operator'].includes(e.kind) && e.severity !== 'info'),
  )
  const messages = session.events
    .filter(
      (e) =>
        ['controller', 'pilot'].includes(e.kind) &&
        (allFrequencies || rx.includes(e.frequency!)) &&
        (replayIndex === null || e.id <= session.events[replayIndex].id),
    )
    .slice(-40)
  const replayEvent = replayIndex === null ? null : session.events[replayIndex]
  const observationAnchor =
    (replayEvent?.kind === 'note'
      ? session.events.find((e) => e.id === replayEvent.relatedEventId)
      : replayEvent) ?? session.events.filter((e) => e.kind !== 'note').at(-1)!
  const reviewEvents = session.events.filter(
    (e) =>
      reviewFilter === 'all' ||
      (reviewFilter === 'radio' && ['controller', 'pilot'].includes(e.kind)) ||
      (reviewFilter === 'interventions' && e.kind === 'operator') ||
      (reviewFilter === 'observations' && issues.includes(e)),
  )

  function act(action: SessionAction) {
    const result = action(stateRef.current)
    update(() => result.session)
    return result.error
  }
  function inspectEvent(eventId: number) {
    const index = session.events.findIndex((e) => e.id === eventId)
    if (index >= 0) replay(index)
  }

  function prepare(text: string) {
    setCommand(text)
    setCommandError('')
    commandInput.current?.focus()
  }
  function send(text = command) {
    if (!ready) {
      setCommandError('Wait for the saved exercise to finish loading.')
      return
    }
    if (replayIndex !== null) {
      setCommandError('Return to the live session before transmitting.')
      return
    }
    if (!session.running) {
      setCommandError('Start or resume the exercise before transmitting.')
      return
    }
    const result = transmit(stateRef.current, text, frequency)
    update(() => result.session)
    if (result.error) setCommandError(result.error)
    else {
      setCommand('')
      setCommandError('')
    }
    commandInput.current?.focus()
  }
  const radio = useRadio({
    enabled: ready && session.running && replayIndex === null && !modal,
    busy: busyFrequency === frequency,
    text: command,
    transmit: send,
    notify: setToast,
    voice: voiceInput,
    binding: pttBinding,
    latch,
  })
  useEffect(() => {
    if (radio.capturedBinding) setPttBinding(radio.capturedBinding)
  }, [radio.capturedBinding])
  useEffect(() => {
    const event = session.events.filter((e) => e.kind === 'pilot').at(-1)
    if (!event) return
    const key = `${session.id}:${event.id}`
    if (lastBusyEvent.current === key) return
    lastBusyEvent.current = key
    if (!event.frequency || !rx.includes(event.frequency) || !session.running) return
    clearTimeout(busyTimer.current)
    setBusyFrequency(event.frequency)
    busyTimer.current = setTimeout(
      () => setBusyFrequency(null),
      Math.min(6500, Math.max(1200, event.text.length * 38)),
    )
  }, [session.events.length, session.running, session.id, rx])
  useEffect(() => {
    if (!session.running) {
      clearTimeout(busyTimer.current)
      setBusyFrequency(null)
    }
  }, [session.running])
  useEffect(() => () => clearTimeout(busyTimer.current), [])
  const alerts = safetyAlerts(session)
  const alertHistory = useRef<Map<string, string>>(new Map())
  const alertSignature = alerts.map((a) => `${a.id}:${a.level}`).join('|')
  useEffect(() => {
    if (!ready || replayIndex !== null) return
    const current = new Map(alerts.map((a) => [a.id, a.level]))
    const started = alerts.filter((a) => alertHistory.current.get(a.id) !== a.level)
    const ended = [...alertHistory.current.keys()].filter((id) => !current.has(id))
    alertHistory.current = current
    if (!started.length && !ended.length) return
    update((s) => {
      let next = s
      for (const a of started)
        next = record(next, 'instructor', `ALERT START ${a.id}: ${a.text}`, {
          aircraftId: a.aircraftId,
          severity: a.level === 'critical' ? 'critical' : 'attention',
        })
      for (const id of ended) next = record(next, 'system', `ALERT END ${id}`)
      return next
    })
  }, [alertSignature, ready, replayIndex, update, session.id])
  async function loadScenario(id: string) {
    if (!ready) return
    if ((session.time > 0 || session.attempted > 0) && confirmScenario !== id) {
      setConfirmScenario(id)
      return
    }
    await saveNow()
    window.speechSynthesis?.cancel()
    lastSpoken.current = 0
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
  async function openLibrary() {
    if (!ready) return
    if (stateRef.current.running)
      update((s) =>
        record({ ...s, running: false }, 'system', 'Exercise paused to open saved sessions.'),
      )
    setModal('sessions')
    setLibraryLoading(true)
    setLibraryError('')
    await saveNow()
    try {
      setSavedSessions(await listSessions())
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : 'Saved sessions could not be read.')
    } finally {
      setLibraryLoading(false)
    }
  }
  async function importFile(file: File) {
    setLibraryError('')
    if (file.size > MAX_SESSION_BYTES) {
      setLibraryError('File exceeds the 10 MB import limit.')
      return
    }
    try {
      const decoded = parseSessionFile(await file.text())
      setPendingRestore({ ...decoded, source: file.name })
      setModal('restore')
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : 'This file could not be imported.')
    }
  }
  function prepareRestore(saved: SavedSession) {
    try {
      const decoded = decodeSession(saved.envelope, 'checkpoint')
      setPendingRestore({ ...decoded, source: 'Browser checkpoint' })
      setModal('restore')
    } catch (error) {
      setLibraryError(
        error instanceof Error ? error.message : 'This checkpoint could not be opened.',
      )
    }
  }
  async function applyRestore() {
    if (!pendingRestore) return
    await saveNow()
    const next = record(
      forkSession(pendingRestore.session),
      'system',
      pendingRestore.migrated
        ? 'Legacy record migrated to the current model with scripted pilots. Restored as a separate paused exercise.'
        : 'Exercise restored as a separate paused copy. Original checkpoint preserved.',
    )
    window.speechSynthesis?.cancel()
    lastSpoken.current = next.nextEventId - 1
    update(() => next)
    setSelectedId(next.aircraft[0].id)
    setFrequency(next.aircraft[0].frequency)
    setReplayIndex(null)
    setCommand('')
    setCommandError('')
    setPendingRestore(null)
    setModal(null)
    setToast('Exercise restored paused. Resume when ready.')
  }
  function exportSession() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            ...sessionExport(stateRef.current),
            workstation: { mode, audio, voiceInput, pttBinding, phraseOnly, weather, latch },
          },
          null,
          2,
        ),
      ],
      {
        type: 'application/json',
      },
    )
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
      <div className="workstation">
        <header className="position-bar">
          <div className="position-ident">
            <span className="position-mark">V</span>
            <div>
              <h1>WMKK KUALA LUMPUR</h1>
              <p>Position: KL GND EAST + TWR (combined)</p>
            </div>
          </div>
          <div className="utc-clock">
            <time>{utcTime(utc)}</time>
            <span>UTC</span>
          </div>
          <div className="weather-block">
            <span>ATIS</span>
            <strong className="atis-letter">{String.fromCharCode(65 + (weather.atis % 26))}</strong>
            <label>
              WIND<b>{weather.wind}</b>
            </label>
            <label>
              QNH<b>{weather.qnh}</b>
            </label>
          </div>
          <div className="runway-chips">
            {(['32R', '33', '32L'] as const).map((id) => {
              const occupants = displayedAircraft
                .filter((a) => a.runway === id && a.runwayOccupied)
                .map((a) => a.id)
              if (session.blockedRunway === id) occupants.push('VEHICLE')
              return (
                <span key={id} className={`runway-chip ${occupants.length ? 'occupied' : ''}`}>
                  <b>{id}</b> {id === '32L' ? 'ARR' : 'DEP'}{' '}
                  <strong>{occupants.length ? `OCC ${occupants.join(' ')}` : 'CLEAR'}</strong>
                </span>
              )
            })}
          </div>
          <div className="equipment-tools">
            <button
              onClick={() => setMode(mode === 'night' ? 'day' : 'night')}
              aria-label="Toggle day/night mode"
            >
              {mode === 'night' ? 'Day' : 'Night'}
            </button>
            <button aria-label="Command reference" onClick={() => setModal('reference')}>
              <BookOpen size={16} />
            </button>
            <button aria-label="Session debrief" onClick={() => setModal('debrief')}>
              <History size={16} />
            </button>
            <button aria-label="Workstation settings" onClick={() => setModal('settings')}>
              <Settings2 size={16} />
            </button>
          </div>
          <div className="simulator-corner" aria-label="Simulator controls">
            <span>Simulator</span>
            <button
              onClick={pause}
              disabled={!ready || replayIndex !== null}
              aria-label={
                session.running
                  ? 'Pause exercise'
                  : session.time
                    ? 'Resume exercise'
                    : 'Start exercise'
              }
            >
              {session.running ? 'Pause' : session.time ? 'Resume' : 'Run'}
            </button>
            {([1, 2, 4] as const).map((speed) => (
              <button
                key={speed}
                aria-pressed={session.speed === speed}
                onClick={() => update((s) => ({ ...s, speed }))}
              >
                {speed}×
              </button>
            ))}
            <button
              onClick={() => {
                setConfirmScenario(session.scenarioId)
                setModal('scenarios')
              }}
            >
              Reset
            </button>
            <span className="sim-elapsed">
              T+{formatTime(session.time)} · MOV {session.completed}
            </span>
            <button aria-label="Saved sessions" onClick={() => void openLibrary()}>
              Files
            </button>
            <button
              aria-label="Local save status"
              onClick={() => void openLibrary()}
              title={saveStatus.error}
            >
              {saveStatus.state === 'saved'
                ? 'SAVED LOCALLY'
                : saveStatus.state === 'error'
                  ? 'SAVE UNAVAILABLE'
                  : saveStatus.state.toUpperCase()}
            </button>
            <details>
              <summary aria-label="Simulator menu">Menu</summary>
              <div>
                <button
                  aria-label="Choose exercise"
                  onClick={(e) => {
                    e.currentTarget.closest('details')?.removeAttribute('open')
                    setConfirmScenario(null)
                    setModal('scenarios')
                  }}
                >
                  {scenario.title}
                </button>
                <button onClick={exportSession}>Download JSON</button>
              </div>
            </details>
          </div>
        </header>
        <div
          className={`safety-line ${alerts.some((a) => a.level === 'critical') ? 'critical' : alerts.length ? 'caution' : ''}`}
          aria-live="polite"
        >
          <span>RIMCAS / SYS</span>
          {toast && <button onClick={() => setToast('')}>{toast}</button>}
          {alerts.map((a) => (
            <button key={a.id} onClick={() => a.aircraftId && setSelectedId(a.aircraftId)}>
              {a.text}
            </button>
          ))}
          {notice ? (
            <button onClick={() => setModal('settings')}>{notice}</button>
          ) : saveStatus.error ? (
            <button onClick={() => setModal('settings')}>{saveStatus.error}</button>
          ) : (
            !alerts.length && <span>No alerts</span>
          )}
          {notice && (
            <button
              className="dismiss-system"
              onClick={dismissNotice}
              aria-label="Dismiss restore notice"
            >
              ×
            </button>
          )}
        </div>
        <main className="workspace-grid">
          <StripBay
            aircraft={displayedAircraft}
            selected={selected.id}
            onSelect={(id) => {
              setSelectedId(id)
              setPanel('aircraft')
            }}
          />
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
              wind={weather.wind}
              criticalAircraft={alerts
                .filter((a) => a.level === 'critical' && a.aircraftId)
                .map((a) => a.aircraftId!)}
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
                <button className="text-button" onClick={() => setPanel('instructor')}>
                  Annotate event
                </button>
                <button className="text-button" onClick={() => setReplayIndex(null)}>
                  Return to live
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
            <div className="lower-displays">
              <FinalApproach aircraft={displayedAircraft} onSelect={setSelectedId} />
              <section
                className={`communications ${radio.transmitting ? 'transmitting' : ''}`}
                aria-label="Radio communications"
              >
                <div className="communications-heading">
                  <div>
                    <Radio size={15} />
                    <h2>R/T log</h2>
                    <span className="comms-frequency">
                      {radio.transmitting ? 'TRANSMITTING' : 'TX'} {frequency}
                    </span>
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
                      <time>{e.utc ? utcTime(e.utc) : formatTime(e.time)}</time>
                      <span className="transcript-speaker">
                        {e.kind === 'controller'
                          ? frequency.startsWith('121')
                            ? 'GND'
                            : 'TWR'
                          : e.aircraftId}
                        {e.source === 'operator' && (
                          <small className="operator-radio-tag">OPERATOR</small>
                        )}
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
                      {session.aircraft.some((a) => a.pilotMode === 'operator')
                        ? 'Pseudo-pilot active'
                        : 'Scripted pilots'}
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
                      disabled={replayIndex !== null || !ready}
                    />
                    <button
                      type="submit"
                      aria-label="Transmit clearance"
                      disabled={!command.trim() || replayIndex !== null || !ready}
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
                <div className="selected-equipment">
                  <div className="selected-title">
                    <h2>{selected.id}</h2>
                    <span>{selected.operation === 'departure' ? 'OUTBOUND' : 'INBOUND'}</span>
                  </div>
                  <p>
                    {selected.spoken} · {selected.type}/{selected.wake}
                  </p>
                  <dl className="selected-data">
                    {[
                      ['DEST', selected.destination],
                      ['RWY', selected.runway],
                      ['STAND', selected.stand],
                      ['SSR', squawk(selected)],
                      ['GS', `${selected.speed} KT`],
                      ['RFL', rfl(selected)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="phase-ladder">
                    {(selected.operation === 'departure'
                      ? ['STAND', 'PUSH', 'TAXI', 'HOLD', 'LINE UP', 'T/O']
                      : ['FINAL', 'CLEARED', 'LAND', 'TAXI IN', 'BLOCKS']
                    ).map((phase, index) => {
                      const current =
                        selected.operation === 'departure'
                          ? (
                              {
                                parked: 0,
                                pushback: 1,
                                ready: 1,
                                taxiing: 2,
                                stopped: 2,
                                holding: 3,
                                'lining-up': 4,
                                'lined-up': 4,
                                departing: 5,
                                complete: 5,
                              } as Record<string, number>
                            )[selected.phase]
                          : selected.phase === 'final'
                            ? Number(!!selected.landingCleared)
                            : selected.phase === 'landing'
                              ? 2
                              : selected.phase === 'complete'
                                ? 4
                                : 3
                      return (
                        <span key={phase} className={current === index ? 'current' : ''}>
                          {phase}
                        </span>
                      )
                    })}
                  </div>
                  {selected.frequency !== frequency && selected.phase !== 'complete' && (
                    <button
                      className="switch-frequency"
                      onClick={() => setFrequency(selected.frequency)}
                    >
                      <Radio size={14} />
                      Switch to {selected.frequency}
                    </button>
                  )}
                  <div className="clearance-buttons">
                    {actions.map((action) => (
                      <button
                        key={action.label}
                        className={action.primary ? 'clearance-primary' : 'clearance-secondary'}
                        disabled={
                          replayIndex !== null || !ready || !session.running || radio.transmitting
                        }
                        onClick={() => (phraseOnly ? prepare(action.text) : send(action.text))}
                      >
                        {action.label}
                      </button>
                    ))}
                    {!actions.some((a) => a.primary) && (
                      <button disabled className="clearance-primary">
                        {selected.phase === 'departing'
                          ? 'Take-off roll — monitor'
                          : selected.phase === 'landing'
                            ? 'Landing roll — monitor'
                            : PHASE_LABELS[selected.phase]}
                      </button>
                    )}
                  </div>
                  <p className="equipment-help">
                    {phraseOnly
                      ? 'Phrase training: prepare the instruction, then use PTT.'
                      : `Transmits on ${frequency}. Pilot readbacks appear in the R/T log.`}
                  </p>
                  {selected.discrepancy && (
                    <p className="readback-warning">
                      CHECK READBACK · issued {selected.discrepancy.issued}, read back{' '}
                      {selected.discrepancy.readback}
                    </p>
                  )}
                </div>
                <section className="ptt-equipment">
                  <h3>Push to talk</h3>
                  <button
                    className={`ptt-button ${radio.transmitting ? 'tx' : ''}`}
                    aria-label="Push to talk"
                    aria-pressed={radio.transmitting}
                    disabled={!session.running || replayIndex !== null || !ready}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return
                      e.preventDefault()
                      e.currentTarget.setPointerCapture(e.pointerId)
                      radio.press()
                    }}
                    onPointerUp={() => {
                      if (!latch) radio.release()
                    }}
                    onPointerCancel={() => radio.release(true)}
                    onLostPointerCapture={() => {
                      if (!latch) radio.release(true)
                    }}
                    onKeyDown={(e) => {
                      if (['Space', 'Enter'].includes(e.code)) {
                        e.preventDefault()
                        if (!e.repeat) radio.press()
                      }
                    }}
                    onKeyUp={(e) => {
                      if (['Space', 'Enter'].includes(e.code)) {
                        e.preventDefault()
                        if (!latch) radio.release()
                      }
                    }}
                  >
                    <span className="mic-symbol">♩</span>
                    <span>
                      <strong aria-live="polite">
                        {!session.running
                          ? 'Paused'
                          : radio.transmitting
                            ? 'TRANSMITTING'
                            : radio.processing
                              ? 'Processing…'
                              : latch
                                ? 'Press to talk'
                                : 'Hold to talk'}
                      </strong>
                      <small>{frequency}</small>
                    </span>
                    <kbd>{pttBinding}</kbd>
                  </button>
                  <p className="equipment-help">
                    {voiceInput
                      ? 'Browser speech · hold to speak, release to send.'
                      : 'Typed PTT · enter text in the R/T log, then hold and release.'}{' '}
                    Window must have focus.
                  </p>
                  {radio.recognised && <p className="recognised-text">{radio.recognised}</p>}
                </section>
                <section className="vccs-equipment">
                  <h3>Voice comms (VCCS)</h3>
                  {RADIOS.map((r) => (
                    <div
                      className={`vccs-row ${frequency === r.frequency ? 'selected' : ''}`}
                      key={r.frequency}
                    >
                      <button
                        onClick={() => {
                          if (!radio.transmitting) setFrequency(r.frequency)
                        }}
                        disabled={radio.transmitting}
                        aria-label={`Transmit on ${r.short} ${r.frequency}`}
                        aria-pressed={frequency === r.frequency}
                      >
                        <strong>KL {r.short}</strong>
                        <span>{r.frequency}</span>
                      </button>
                      <button
                        className={`rx-lamp ${rx.includes(r.frequency) ? 'enabled' : ''} ${busyFrequency === r.frequency ? 'lit' : ''}`}
                        aria-label={`Receive ${r.short}`}
                        aria-pressed={rx.includes(r.frequency)}
                        onClick={() =>
                          setRx((old) =>
                            old.includes(r.frequency)
                              ? old.filter((f) => f !== r.frequency)
                              : [...old, r.frequency],
                          )
                        }
                      >
                        RX
                      </button>
                      <span
                        className={`tx-lamp ${frequency === r.frequency ? 'selected' : ''} ${frequency === r.frequency && radio.transmitting ? 'lit' : ''}`}
                      >
                        TX
                      </span>
                    </div>
                  ))}
                </section>
                <section className="stopbar-equipment">
                  <h3>Stop bars</h3>
                  <div>
                    {(['32R', '33'] as const).map((runway) => (
                      <span
                        className={`stopbar-chip ${stopBarOff(displayedAircraft, runway) ? 'off' : ''}`}
                        key={runway}
                      >
                        <i />
                        {holdingPoint(runway)} · {runway}{' '}
                        {stopBarOff(displayedAircraft, runway) ? 'OFF' : 'LIT'}
                      </span>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <div className="instructor-content">
                <div className="instructor-intro">
                  <span className="eyebrow">EXERCISE DIRECTOR</span>
                  <h2>Instructor station</h2>
                  <p>Controlled events for procedural development and debrief.</p>
                  <p>Local controls share this workstation; no separate instructor login.</p>
                </div>
                <PilotStation
                  key={`${session.id}-${selected.id}`}
                  aircraft={selected}
                  running={session.running}
                  disabled={replayIndex !== null || !ready}
                  act={act}
                />
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
                    disabled={replayIndex !== null || !ready}
                    onClick={() => update((s) => instructorEvent(s, 'guidance'))}
                  >
                    <span />
                  </button>
                </div>
                <p className="eyebrow event-label">INJECT AN EVENT</p>
                <label className="obstruction-selector">
                  <span>Obstruction runway</span>
                  <select
                    aria-label="Obstruction runway"
                    value={obstructionRunway}
                    disabled={replayIndex !== null || !!session.blockedRunway}
                    onChange={(e) => setObstructionRunway(e.target.value as RunwayId)}
                  >
                    {Object.keys(RUNWAYS).map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={`event-button ${session.injectReadback ? 'armed' : ''}`}
                  disabled={replayIndex !== null || !ready}
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
                  disabled={replayIndex !== null || !ready}
                  onClick={() =>
                    update((s) => instructorEvent(s, 'obstruction', obstructionRunway))
                  }
                >
                  <TriangleAlert size={17} />
                  <span>
                    <strong>Runway obstruction</strong>
                    <small>
                      {session.blockedRunway
                        ? `${session.blockedRunway} occupied · click to clear`
                        : `Place inspection vehicle on ${obstructionRunway}`}
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
                          onClick={() => inspectEvent(e.kind === 'note' ? e.relatedEventId! : e.id)}
                        >
                          <div>
                            <time>{formatTime(e.time)}</time>
                            <span>
                              {e.kind === 'note'
                                ? 'INSTRUCTOR NOTE'
                                : e.severity === 'critical'
                                  ? 'REVIEW REQUIRED'
                                  : 'COACHING NOTE'}
                            </span>
                          </div>
                          <p>{e.text}</p>
                          <small>
                            {e.kind === 'note'
                              ? `Inspect linked event #${e.relatedEventId}`
                              : 'Inspect event'}
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
                {ready && (
                  <ObservationEditor
                    key={session.id}
                    anchor={observationAnchor}
                    events={session.events}
                    act={act}
                  />
                )}
              </div>
            )}
            <div className="inspector-bottom">
              <span>
                <span className="live-dot" />
                ENGINE READY
              </span>
              <span>v{ENGINE_VERSION}</span>
            </div>
          </aside>
        </main>
        <footer className="equipment-footer">
          <span>
            {active.length} aircraft · {waiting} awaiting response
          </span>
          <span>
            <kbd>{pttBinding}</kbd> PTT · <kbd>P</kbd> Run/pause · <kbd>/</kbd> Free text ·{' '}
            <kbd>?</kbd> Reference
          </span>
          <button onClick={exportSession}>Export session</button>
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
      {modal === 'sessions' && (
        <SessionLibrary
          records={savedSessions}
          loading={libraryLoading}
          error={libraryError}
          status={saveStatus}
          currentId={session.id}
          onClose={() => setModal(null)}
          onSave={() => void openLibrary()}
          onExport={exportSession}
          onImport={(file) => void importFile(file)}
          onRestore={prepareRestore}
        />
      )}
      {modal === 'restore' && pendingRestore && (
        <ModalShell
          title="Restore this exercise?"
          eyebrow="REVIEW SESSION RECORD"
          onClose={() => setModal('sessions')}
        >
          <div className="restore-summary">
            <span className="eyebrow">
              {SCENARIOS.find((s) => s.id === pendingRestore.session.scenarioId)?.code}
            </span>
            <h3>{SCENARIOS.find((s) => s.id === pendingRestore.session.scenarioId)?.title}</h3>
            <dl>
              <div>
                <dt>Source</dt>
                <dd>{pendingRestore.source}</dd>
              </div>
              <div>
                <dt>Elapsed time</dt>
                <dd>{formatTime(pendingRestore.session.time)}</dd>
              </div>
              <div>
                <dt>Aircraft / events</dt>
                <dd>
                  {pendingRestore.session.aircraft.length} / {pendingRestore.session.events.length}
                </dd>
              </div>
              <div>
                <dt>Dataset</dt>
                <dd>{AIRPORT_DATA.id}</dd>
              </div>
            </dl>
          </div>
          <p className="modal-intro">
            This opens a separate copy with the clock paused. The current exercise is checkpointed
            first if browser storage is available. Existing checkpoints are preserved.
          </p>
          {pendingRestore.migrated && (
            <div className="migration-notice">
              <Info size={16} />
              <p>
                This legacy record will use the current model with scripted pilots. Version 0.1
                airborne landing states also adopt the moving-arrival model. Historical snapshots
                remain as originally recorded.
              </p>
            </div>
          )}
          {saveStatus.error && (
            <div className="library-error" role="alert">
              Local storage is unavailable. Export the current exercise before replacing it if you
              need a copy.
            </div>
          )}
          <div className="modal-footer">
            <button className="secondary-button" onClick={() => setModal('sessions')}>
              Cancel
            </button>
            <button className="primary-button" onClick={() => void applyRestore()}>
              <History size={15} />
              Restore paused
            </button>
          </div>
        </ModalShell>
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
                  <li>Start the exercise and approve pushback on ground.</li>
                  <li>Wait for “ready to taxi”.</li>
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
          <div className="review-filters" role="group" aria-label="Filter review events">
            {(['all', 'radio', 'interventions', 'observations'] as const).map((filter) => (
              <button
                key={filter}
                className={reviewFilter === filter ? 'active' : ''}
                aria-pressed={reviewFilter === filter}
                onClick={() => setReviewFilter(filter)}
              >
                {filter === 'all'
                  ? 'All events'
                  : filter === 'radio'
                    ? 'Radio'
                    : filter === 'interventions'
                      ? 'Interventions'
                      : 'Observations'}
              </button>
            ))}
          </div>
          <div className="event-timeline">
            {reviewEvents.map((e) => (
              <button
                key={e.id}
                className={`timeline-event ${e.severity}`}
                onClick={() => inspectEvent(e.kind === 'note' ? e.relatedEventId! : e.id)}
              >
                <time>{formatTime(e.time)}</time>
                <span className={`timeline-kind ${e.kind}`}>
                  {e.source === 'operator' ? 'pilot / op' : e.kind}
                </span>
                <p>
                  {e.relatedEventId && (
                    <small className="linked-event-label">
                      Linked to event #{e.relatedEventId} ·{' '}
                    </small>
                  )}
                  {e.text}
                </p>
                <ArrowUpRight size={14} />
              </button>
            ))}
            {reviewEvents.length === 0 && (
              <p className="debrief-note">No events in this view yet.</p>
            )}
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
            <h3>Display and voice</h3>
            <div className="settings-row">
              <span>Display mode</span>
              <button
                className="secondary-button"
                onClick={() => setMode(mode === 'night' ? 'day' : 'night')}
              >
                {mode === 'night' ? 'Night' : 'Day'}
              </button>
            </div>
            <div className="settings-row">
              <span>
                Browser speech recognition
                <small>
                  Chrome cloud processing; microphone permission required.{' '}
                  {radio.supported ? 'Available in this browser.' : 'Unavailable in this browser.'}
                </small>
              </span>
              <button
                className="secondary-button"
                disabled={!radio.supported}
                aria-pressed={voiceInput}
                onClick={() => setVoiceInput(!voiceInput)}
              >
                {voiceInput ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <div className="settings-row">
              <span>
                PTT binding
                <small>
                  Keyboard, mouse button 4/5 or gamepad. Browser window must have focus.
                </small>
              </span>
              <button
                className="secondary-button"
                onClick={() => radio.setBindingCapture(!radio.bindingCapture)}
              >
                {radio.bindingCapture ? 'Press a key or button…' : pttBinding}
              </button>
            </div>
            <div className="settings-row">
              <span>
                Latching PTT
                <small>
                  Press once to talk, press again to send. Blur and the 30-second guard still
                  cancel.
                </small>
              </span>
              <button
                className="secondary-button"
                aria-pressed={latch}
                onClick={() => setLatch(!latch)}
              >
                {latch ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <div className="settings-row">
              <span>
                Show phrase only<small>Clearance buttons prepare text for PTT practice.</small>
              </span>
              <button
                className="secondary-button"
                aria-pressed={phraseOnly}
                onClick={() => setPhraseOnly(!phraseOnly)}
              >
                {phraseOnly ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <p>
              Browser recognition does not provide AudioWorklet pre-roll or reliable phrase hints.
              Airport geometry, radio assignments, holding points, squawks and flight levels are
              exercise placeholders, unverified against the Malaysian AIP.
            </p>
          </div>
          <div className="settings-section">
            <h3>Weather / ATIS</h3>
            <div className="settings-row">
              <label>
                Wind{' '}
                <input
                  aria-label="Weather wind"
                  value={weather.wind}
                  onChange={(e) =>
                    setWeather((w) => ({ ...w, wind: e.target.value, atis: (w.atis + 1) % 26 }))
                  }
                />
              </label>
              <label>
                QNH{' '}
                <input
                  aria-label="Weather QNH"
                  value={weather.qnh}
                  onChange={(e) =>
                    setWeather((w) => ({ ...w, qnh: e.target.value, atis: (w.atis + 1) % 26 }))
                  }
                />
              </label>
            </div>
          </div>
          <div className="settings-section">
            <h3>
              <Activity size={17} />
              Development prototype
            </h3>
            <p>
              The exercise is automatically checkpointed in this browser and reopens paused after
              refresh. Use saved sessions to import or restore a record. Export a JSON copy to keep
              it independently; no server storage is used.
            </p>
            <button
              className="secondary-button settings-library"
              onClick={() => void openLibrary()}
            >
              <FolderOpen size={15} />
              Open saved exercises
            </button>
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
              {AIRPORT_DATA.note} Browser speech recognition is optional. No generative pilot AI,
              separation-minima model, or professional assessment is implemented.
            </p>
          </div>
          <div className="settings-section">
            <h3>
              <Keyboard size={17} />
              Keyboard shortcuts
            </h3>
            <div className="shortcut-list">
              <span>
                Pause or resume<kbd>P</kbd>
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
