import { useCallback, useEffect, useRef, useState } from 'react'
// Web Speech is intentionally isolated: unsupported browsers keep the typed path.
type RecognitionResult = { isFinal: boolean; 0: { transcript: string; confidence: number } }
type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
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
}
export function useRadio(options: {
  enabled: boolean
  busy: boolean
  text: string
  transmit: (text: string) => void
  notify: (message: string) => void
  voice: boolean
  binding: string
  latch: boolean
}) {
  const [transmitting, setTransmitting] = useState(false)
  const [recognised, setRecognised] = useState('')
  const [processing, setProcessing] = useState(false)
  const [bindingCapture, setBindingCapture] = useState(false)
  const [capturedBinding, setCapturedBinding] = useState<string | null>(null)
  const opts = useRef(options)
  opts.current = options
  const down = useRef(false)
  const startTime = useRef(0)
  const guard = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const recognizer = useRef<Recognition | null>(null)
  const releaseRef = useRef<(cancel?: boolean) => void>(() => {})
  const supported = Boolean(
    (window as RecognitionWindow).SpeechRecognition ??
    (window as RecognitionWindow).webkitSpeechRecognition,
  )
  const press = useCallback(() => {
    const o = opts.current
    if (down.current) {
      if (o.latch) releaseRef.current()
      return
    }
    if (!o.enabled) {
      o.notify('Paused — resume in the simulator corner before transmitting.')
      return
    }
    if (o.busy) {
      o.notify('FREQUENCY BUSY — wait for the pilot readback.')
      return
    }
    if (recognizer.current) {
      o.notify('Recognition processing — please wait.')
      return
    }
    down.current = true
    startTime.current = performance.now()
    setTransmitting(true)
    setRecognised('')
    guard.current = setTimeout(() => {
      releaseRef.current(true)
      opts.current.notify('STUCK MIC · transmission ended after 30 s.')
    }, 30_000)
    if (o.voice) {
      const Constructor =
        (window as RecognitionWindow).SpeechRecognition ??
        (window as RecognitionWindow).webkitSpeechRecognition
      if (!Constructor) {
        releaseRef.current(true)
        o.notify('Speech recognition unavailable. Use Chrome or switch to typed PTT.')
        return
      }
      const recognition = new Constructor()
      recognizer.current = recognition
      recognition.lang = 'en-GB'
      recognition.continuous = true
      recognition.interimResults = true
      let final = ''
      let confidence = 1
      let cancelled = false
      recognition.onresult = (event) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            final += ` ${result[0].transcript}`
            confidence = Math.min(confidence, result[0].confidence)
          } else interim += result[0].transcript
        }
        setRecognised((final + interim).trim())
      }
      recognition.onerror = (event) => {
        cancelled = true
        o.notify(
          event.error === 'not-allowed'
            ? 'Microphone permission denied. Allow microphone access in Chrome or use typed PTT.'
            : `Recognition: ${event.error}. Nothing sent.`,
        )
      }
      recognition.onend = () => {
        recognizer.current = null
        setProcessing(false)
        if (down.current) {
          down.current = false
          setTransmitting(false)
          clearTimeout(guard.current)
          if (!cancelled)
            opts.current.notify('Recognition ended before PTT release. Nothing sent; try again.')
          return
        }
        if (cancelled || performance.now() - startTime.current < 350) return
        if (!final.trim()) {
          opts.current.notify('No speech recognised. Nothing sent.')
          return
        }
        if (confidence < 0.6) {
          opts.current.notify('Say again — recognition confidence below 0.6. Nothing applied.')
          return
        }
        if (opts.current.enabled) opts.current.transmit(final.trim())
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
        o.notify('Microphone could not start. Nothing sent.')
      }
    }
  }, [])
  const release = useCallback((cancel = false) => {
    if (!down.current) {
      if (cancel) {
        recognizer.current?.abort()
        setProcessing(false)
      }
      return
    }
    down.current = false
    setTransmitting(false)
    clearTimeout(guard.current)
    const tooShort = performance.now() - startTime.current < 350
    if (recognizer.current) {
      if (cancel || tooShort) recognizer.current.abort()
      else {
        setProcessing(true)
        recognizer.current.stop()
      }
    } else if (!cancel && !tooShort) {
      if (opts.current.text.trim()) opts.current.transmit(opts.current.text)
      else
        opts.current.notify(
          'Typed PTT: enter a clearance in Free text, then hold and release. Enable browser speech in settings to speak.',
        )
    }
    if (tooShort && !cancel) opts.current.notify('Too short, nothing sent (minimum 350 ms).')
  }, [])
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
