import { useCallback, useEffect, useRef, useState } from 'react'
interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type Constructor = new () => Recognition
function constructor(): Constructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: Constructor
    webkitSpeechRecognition?: Constructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}
export function useVoiceDraft(enabled: boolean, onDraft: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const current = useRef<Recognition | null>(null)
  const callback = useRef(onDraft)
  callback.current = onDraft
  const cancel = useCallback(() => {
    const r = current.current
    current.current = null
    r?.abort()
    setListening(false)
  }, [])
  useEffect(() => {
    if (!enabled) cancel()
    return cancel
  }, [enabled, cancel])
  function toggle() {
    if (current.current) {
      current.current.stop()
      return
    }
    if (!enabled) return
    const C = constructor()
    if (!C) {
      setError('Speech recognition is unavailable in this browser. Use typed transmissions.')
      return
    }
    try {
      const r = new C()
      current.current = r
      r.lang = 'en-GB'
      r.continuous = false
      r.interimResults = false
      r.onresult = (e) => {
        if (current.current !== r) return
        const text = Array.from(e.results)
          .filter((v) => v.isFinal)
          .map((v) => v[0].transcript)
          .join(' ')
          .trim()
        if (text.length > 1000) {
          setError(
            'Voice draft exceeds 1,000 characters. Dictate a shorter instruction; nothing was transmitted.',
          )
          return
        }
        if (text) callback.current(text)
      }
      r.onerror = (e) => {
        if (current.current !== r) return
        setError(
          e.error === 'not-allowed' || e.error === 'service-not-allowed'
            ? 'Microphone or speech-service permission was denied. Typed transmissions remain available.'
            : `Speech recognition stopped (${e.error}). Review any existing draft or type the instruction.`,
        )
      }
      r.onend = () => {
        if (current.current !== r) return
        current.current = null
        setListening(false)
      }
      setError('')
      setListening(true)
      r.start()
    } catch {
      cancel()
      setError(
        'Could not start speech recognition. Check browser microphone support and permissions; typed transmissions remain available.',
      )
    }
  }
  useEffect(() => {
    if (!listening) return
    const id = window.setTimeout(() => {
      cancel()
      setError('Voice capture stopped after 30 seconds. Review the draft or try again.')
    }, 30000)
    return () => window.clearTimeout(id)
  }, [listening, cancel])
  return { supported: !!constructor(), listening, error, toggle, cancel }
}
