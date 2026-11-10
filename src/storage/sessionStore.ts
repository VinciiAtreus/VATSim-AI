import { sessionExport } from '../sim/engine'
import { decodeSession } from '../sim/sessionCodec'
import type { Session } from '../sim/types'

export type SavedSession = {
  id: string
  savedAt: string
  scenarioId: string
  elapsed: number
  eventCount: number
  envelope: ReturnType<typeof sessionExport>
}
const DATABASE = 'vatsim-ai-workstation'
const STORE = 'sessions'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(
        new Error('Browser storage is unavailable. Export a JSON copy to retain this exercise.'),
      )
      return
    }
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Cannot open browser storage. Export a JSON copy.'))
    request.onblocked = () =>
      reject(new Error('Browser storage is blocked by another window. Close it or export a copy.'))
  })
}

export async function saveSession(session: Session): Promise<SavedSession> {
  const db = await openDatabase()
  const saved: SavedSession = {
    id: session.id,
    savedAt: new Date().toISOString(),
    scenarioId: session.scenarioId,
    elapsed: session.time,
    eventCount: session.events.length,
    envelope: sessionExport(session),
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).put(saved)
    transaction.oncomplete = () => {
      db.close()
      resolve(saved)
    }
    transaction.onabort = transaction.onerror = () => {
      db.close()
      reject(
        new Error(
          'Could not save locally. Browser storage may be full or disabled; export a JSON copy.',
        ),
      )
    }
  })
}

export async function listSessions(): Promise<SavedSession[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly')
    const request = transaction.objectStore(STORE).getAll()
    transaction.oncomplete = () => {
      db.close()
      const records = (request.result as SavedSession[]).filter(
        (r) =>
          r &&
          typeof r === 'object' &&
          typeof r.id === 'string' &&
          typeof r.savedAt === 'string' &&
          Number.isFinite(Date.parse(r.savedAt)) &&
          typeof r.scenarioId === 'string' &&
          Number.isFinite(r.elapsed) &&
          Number.isFinite(r.eventCount),
      )
      resolve(records.sort((a, b) => b.savedAt.localeCompare(a.savedAt)))
    }
    transaction.onabort = transaction.onerror = () => {
      db.close()
      reject(new Error('Could not read local exercise history.'))
    }
  })
}

export async function recoverSession(): Promise<{ session: Session | null; warning?: string }> {
  const records = await listSessions()
  let skipped = 0
  for (const record of records) {
    try {
      const decoded = decodeSession(record.envelope, 'checkpoint')
      return {
        session: decoded.session,
        warning:
          [
            ...(skipped
              ? ['An unreadable checkpoint was preserved; an earlier valid exercise was recovered.']
              : []),
            ...(decoded.migrated
              ? [
                  'Legacy checkpoint migrated to the current model with scripted pilots; restored paused. Review the model-change notes before resuming.',
                ]
              : []),
          ].join(' ') || undefined,
      }
    } catch {
      skipped++
    }
  }
  return {
    session: null,
    warning: skipped
      ? 'Saved checkpoints could not be opened. They were preserved; import a compatible export or start a new exercise.'
      : undefined,
  }
}
