import { useCallback, useEffect, useRef, useState } from 'react'
import { createSession, record } from '../sim/engine'
import { recoverSession, saveSession } from '../storage/sessionStore'
import type { Session } from '../sim/types'

export type SaveStatus = {
  state: 'loading' | 'saving' | 'saved' | 'error'
  savedAt?: string
  error?: string
}

export function useSession() {
  const [session, setSession] = useState<Session>(() => createSession())
  const stateRef = useRef(session)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'loading' })
  const revision = useRef(0)
  const savedRevision = useRef(-1)
  const queue = useRef(Promise.resolve())
  const mounted = useRef(true)

  const update = useCallback((fn: (s: Session) => Session) => {
    const next = fn(stateRef.current)
    if (next === stateRef.current) return
    if (next.id !== stateRef.current.id || next.events.length !== stateRef.current.events.length) {
      setSaveStatus((previous) => ({ ...previous, state: 'saving' }))
    }
    stateRef.current = next
    revision.current++
    setSession(next)
  }, [])

  const saveNow = useCallback(async (): Promise<boolean> => {
    let success = true
    const current = stateRef.current
    const currentRevision = revision.current
    const pending = queue.current.then(async () => {
      if (savedRevision.current >= currentRevision) return
      if (mounted.current)
        setSaveStatus((previous) => ({ ...previous, state: 'saving', error: undefined }))
      try {
        const saved = await saveSession(current)
        savedRevision.current = currentRevision
        if (mounted.current && stateRef.current.id === current.id)
          setSaveStatus({ state: 'saved', savedAt: saved.savedAt })
      } catch (error) {
        success = false
        if (mounted.current)
          setSaveStatus({
            state: 'error',
            error:
              error instanceof Error ? error.message : 'Local save failed. Export a JSON copy.',
          })
      }
    })
    queue.current = pending.catch(() => {})
    await pending
    return success
  }, [])

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    recoverSession()
      .then((recovered) => {
        if (cancelled) return
        if (recovered.session) {
          const next = record(
            recovered.session,
            'system',
            'Exercise recovered from this browser. Clock remains paused until resumed.',
          )
          stateRef.current = next
          revision.current++
          setSession(next)
          setNotice(
            recovered.warning ?? 'Previous exercise restored paused. Resume when you are ready.',
          )
        } else if (recovered.warning) setNotice(recovered.warning)
        setReady(true)
      })
      .catch((error) => {
        if (cancelled) return
        setSaveStatus({
          state: 'error',
          error: error instanceof Error ? error.message : 'Local storage unavailable.',
        })
        setNotice('Local storage is unavailable. You can still train and export JSON copies.')
        setReady(true)
      })
    return () => {
      cancelled = true
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    void saveNow()
    const interval = window.setInterval(() => void saveNow(), 3000)
    return () => window.clearInterval(interval)
  }, [ready, saveNow, session.id, session.events.length, session.running])

  return {
    session,
    stateRef,
    update,
    ready,
    saveStatus,
    saveNow,
    notice,
    dismissNotice: () => setNotice(''),
  }
}
