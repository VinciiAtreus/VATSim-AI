import { useCallback, useEffect, useRef, useState } from 'react'
// Web Speech is intentionally isolated: unsupported browsers keep the typed path.
type RecognitionResult = {
  isFinal: boolean
  length?: number
  [index: number]: { transcript: string; confidence: number }
}
type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  phrases?: unknown[]
  onstart?: (() => void) | null
  onaudiostart?: (() => void) | null
  onspeechstart?: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionWindow = Window & {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
  SpeechRecognitionPhrase?: new (phrase: string, boost?: number) => unknown
}
export function useRadio(options: {
  enabled: boolean
  busy: boolean
  text: string
  transmit: (text: string, channel: string) => void
  channel: string
  notify: (message: string) => void
  voice: boolean
  binding: string
  latch: boolean
  language: string
  hints: string[]
}) {
  const [transmitting, setTransmitting] = useState(false)
  const [recognised, setRecognised] = useState('')
  const [processing, setProcessing] = useState(false)
  const [captureStatus, setCaptureStatus] = useState<
    'idle' | 'starting' | 'listening' | 'speech' | 'captured' | 'processing' | 'error'
  >('idle')
  const [feedback, setFeedback] = useState('')
  const [alternatives, setAlternatives] = useState<string[]>([])
  const [hintsApplied, setHintsApplied] = useState(false)
  const [bindingCapture, setBindingCapture] = useState(false)
  const [capturedBinding, setCapturedBinding] = useState<string | null>(null)
  const opts = useRef(options)
  opts.current = options
  const channel = useRef(options.channel)
  const down = useRef(false)
  const voiceAtPress = useRef(false)
  const completedVoice = useRef<{ text: string; confidence: number } | null>(null)
  const startTime = useRef(0)
  const guard = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const recognizer = useRef<Recognition | null>(null)
  const releaseRef = useRef<(cancel?: boolean) => void>(() => {})
  const supported = Boolean(
    (window as RecognitionWindow).SpeechRecognition ??
    (window as RecognitionWindow).webkitSpeechRecognition,
  )
  const report = useCallback((message: string) => {
    setFeedback(message)
    opts.current.notify(message)
  }, [])
  const finishVoice = useCallback(() => {
    const result = completedVoice.current
    completedVoice.current = null
    setCaptureStatus('idle')
    if (!opts.current.enabled) return
    if (!result?.text.trim()) {
      report(
        'No speech recognised. Check the microphone input and speech language, then try again. Nothing sent.',
      )
      return
    }
    if (result.confidence < 0.6) {
      report(
        'Say again — recognition confidence below 0.6. Review the recognised text or try again. Nothing applied.',
      )
      return
    }
    opts.current.transmit(result.text.trim(), channel.current)
  }, [report])
  const press = useCallback(() => {
    const o = opts.current
    if (down.current) {
      if (o.latch) releaseRef.current()
      return
    }
    if (!o.enabled) {
      report('Paused — resume in the simulator corner before transmitting.')
      return
    }
    if (o.busy) {
      report('FREQUENCY BUSY — wait for the pilot readback.')
      return
    }
    if (recognizer.current) {
      report('Recognition processing — please wait.')
      return
    }
    channel.current = o.channel
    voiceAtPress.current = o.voice
    completedVoice.current = null
    setFeedback('')
    setAlternatives([])
    setHintsApplied(false)
    down.current = true
    startTime.current = performance.now()
    setTransmitting(true)
    setRecognised('')
    guard.current = setTimeout(() => {
      releaseRef.current(true)
      report('STUCK MIC · transmission ended after 30 s.')
    }, 30_000)
    if (o.voice) {
      const Constructor =
        (window as RecognitionWindow).SpeechRecognition ??
        (window as RecognitionWindow).webkitSpeechRecognition
      if (!Constructor) {
        releaseRef.current(true)
        report('Speech recognition unavailable. Use Chrome or switch to typed PTT.')
        return
      }
      const recognition = new Constructor()
      recognizer.current = recognition
      setCaptureStatus('starting')
      recognition.lang = o.language
      recognition.maxAlternatives = 5
      const Phrase = (window as RecognitionWindow).SpeechRecognitionPhrase
      if (Phrase && 'phrases' in recognition) {
        try {
          recognition.phrases = o.hints.map((h) => new Phrase(h, 5))
          setHintsApplied(true)
        } catch {
          setHintsApplied(false)
        }
      }
      recognition.onstart = () => {
        if (recognizer.current === recognition) setCaptureStatus('listening')
      }
      recognition.onaudiostart = () => {
        if (recognizer.current === recognition) setCaptureStatus('listening')
      }
      recognition.onspeechstart = () => {
        if (recognizer.current === recognition) setCaptureStatus('speech')
      }
      recognition.continuous = true
      recognition.interimResults = true
      let cancelled = false
      recognition.onresult = (event) => {
        if (recognizer.current !== recognition) return
        let final = ''
        let confidence = 1
        let interim = ''
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            final += ` ${result[0].transcript}`
            confidence = Math.min(
              confidence,
              Number.isFinite(result[0].confidence) ? result[0].confidence : 0,
            )
          } else interim += ` ${result[0].transcript}`
        }
        completedVoice.current = { text: final.trim(), confidence }
        setCaptureStatus(down.current ? 'speech' : 'processing')
        const transcript = [final.trim(), interim.trim()].filter(Boolean).join(' ')
        setRecognised(transcript)
        const choices = Array.from(
          { length: Math.min(3, Math.max(...Array.from(event.results).map((r) => r.length ?? 1))) },
          (_, i) =>
            Array.from(event.results)
              .map((r) => r[Math.min(i, (r.length ?? 1) - 1)]?.transcript ?? '')
              .join(' ')
              .trim(),
        )
        setAlternatives([...new Set(choices)].filter((t) => t && t !== transcript))
      }
      recognition.onerror = (event) => {
        if (recognizer.current !== recognition) return
        cancelled = true
        completedVoice.current = null
        setCaptureStatus('error')
        recognizer.current = null
        down.current = false
        setTransmitting(false)
        setProcessing(false)
        clearTimeout(guard.current)
        recognition.abort()
        report(
          event.error === 'not-allowed'
            ? 'Microphone permission denied. Allow microphone access in your browser or use typed PTT.'
            : event.error === 'service-not-allowed'
              ? 'Your browser denied access to its speech service. Check browser speech settings or use typed PTT. Nothing sent.'
              : event.error === 'network'
                ? 'The browser speech service could not connect (network). Microphone permission does not enable the speech service. Check Edge speech/online permissions or try current Chrome. Nothing sent.'
                : event.error === 'language-not-supported'
                  ? 'This speech language is unavailable. Choose another English language and try again. Nothing sent.'
                  : `Recognition: ${event.error}. Nothing sent.`,
        )
      }
      recognition.onend = () => {
        if (recognizer.current !== recognition) return
        recognizer.current = null
        if (!down.current) clearTimeout(guard.current)
        setProcessing(false)
        if (cancelled) return
        if (down.current) {
          setCaptureStatus('captured')
          return
        }
        if (performance.now() - startTime.current < 350) return
        finishVoice()
      }

      // Abort is used for blur/hidden/short presses so partial speech cannot apply later.
      const abort = recognition.abort.bind(recognition)
      recognition.abort = () => {
        cancelled = true
        abort()
      }
      try {
        recognition.start()
      } catch {
        recognizer.current = null
        releaseRef.current(true)
        setCaptureStatus('error')
        report(
          'Microphone could not start. Check browser microphone and speech permissions. Nothing sent.',
        )
      }
    }
  }, [report, finishVoice])
  const release = useCallback(
    (cancel = false) => {
      if (!down.current) {
        if (cancel) {
          clearTimeout(guard.current)
          completedVoice.current = null
          setCaptureStatus('idle')
          const current = recognizer.current
          recognizer.current = null
          current?.abort()
          setProcessing(false)
        }
        return
      }
      down.current = false
      setTransmitting(false)
      clearTimeout(guard.current)
      const tooShort = performance.now() - startTime.current < 350
      if (cancel || tooShort) {
        completedVoice.current = null
        setCaptureStatus('idle')
      }
      if (recognizer.current) {
        if (cancel || tooShort) {
          const current = recognizer.current
          recognizer.current = null
          setProcessing(false)
          current.abort()
        } else {
          setProcessing(true)
          setCaptureStatus('processing')
          guard.current = setTimeout(() => {
            releaseRef.current(true)
            setCaptureStatus('error')
            report('The browser speech service did not finish. Please try again. Nothing sent.')
          }, 10_000)
          try {
            recognizer.current.stop()
          } catch {
            releaseRef.current(true)
            setCaptureStatus('error')
            report('The browser could not finish speech capture. Please try again. Nothing sent.')
          }
        }
      } else if (!cancel && !tooShort && voiceAtPress.current) {
        finishVoice()
      } else if (!cancel && !tooShort) {
        if (opts.current.text.trim()) opts.current.transmit(opts.current.text, channel.current)
        else
          report(
            'Typed PTT is selected. Choose Voice PTT above to capture your microphone, or enter a clearance in Free text to send typed input.',
          )
      }
      if (tooShort && !cancel) report('Too short, nothing sent (minimum 350 ms).')
    },
    [report, finishVoice],
  )
  releaseRef.current = release
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (bindingCapture) {
        event.preventDefault()
        setCapturedBinding(event.code)
        setBindingCapture(false)
        return
      }
      if (event.code !== opts.current.binding || event.repeat) return
      if (
        event.code === 'Space' &&
        (event.target as HTMLElement).matches('input,textarea,select,[contenteditable]')
      )
        return
      event.preventDefault()
      press()
    }
    const keyup = (event: KeyboardEvent) => {
      if (event.code === opts.current.binding) {
        event.preventDefault()
        if (!opts.current.latch) release()
      }
    }
    const blur = () => release(true)
    const visibility = () => {
      if (document.hidden) release(true)
    }
    const mouseDown = (event: MouseEvent) => {
      if (![3, 4].includes(event.button)) return
      if (bindingCapture) {
        event.preventDefault()
        setCapturedBinding(`Mouse${event.button}`)
        setBindingCapture(false)
        return
      }
      if (opts.current.binding === `Mouse${event.button}`) {
        event.preventDefault()
        press()
      }
    }
    const mouseUp = (event: MouseEvent) => {
      if (opts.current.binding === `Mouse${event.button}`) {
        event.preventDefault()
        if (!opts.current.latch) release()
      }
    }
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('mousedown', mouseDown)
    window.addEventListener('mouseup', mouseUp)
    let frame = 0
    let gamepadDown = false
    const poll = () => {
      for (const gamepad of navigator.getGamepads?.() ?? []) {
        if (!gamepad) continue
        gamepad.buttons.forEach((button, index) => {
          const binding = `Gamepad${gamepad.index}:${index}`
          if (bindingCapture && button.pressed) {
            setCapturedBinding(binding)
            setBindingCapture(false)
          }
        })
      }
      if (opts.current.binding.startsWith('Gamepad')) {
        const [pad, button] = opts.current.binding.slice(7).split(':').map(Number)
        const pressed = navigator.getGamepads?.()[pad]?.buttons[button]?.pressed ?? false
        if (pressed && !gamepadDown) press()
        if (!pressed && gamepadDown && !opts.current.latch) release()
        gamepadDown = pressed
      }
      frame = requestAnimationFrame(poll)
    }
    frame = requestAnimationFrame(poll)
    return () => {
      release(true)
      recognizer.current?.abort()
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('keyup', keyup)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('mousedown', mouseDown)
      window.removeEventListener('mouseup', mouseUp)
    }
  }, [press, release, bindingCapture])
  useEffect(() => {
    if (!options.enabled) release(true)
  }, [options.enabled, release])
  return {
    transmitting,
    captureStatus,
    feedback,
    alternatives,
    hintsApplied,
    recognised,
    processing,
    press,
    release,
    supported,
    bindingCapture,
    setBindingCapture,
    capturedBinding,
  }
}
