import { Clock3, Download, FileJson, HardDrive, LoaderCircle, Save, Upload } from 'lucide-react'
import ModalShell from './ModalShell'
import { SCENARIOS } from '../sim/airport'
import { formatTime } from '../sim/engine'
import type { SaveStatus } from '../hooks/useSession'
import type { SavedSession } from '../storage/sessionStore'

type Props = {
  records: SavedSession[]
  loading: boolean
  error: string
  status: SaveStatus
  currentId: string
  onClose: () => void
  onSave: () => void
  onExport: () => void
  onImport: (file: File) => void
  onRestore: (saved: SavedSession) => void
}
export default function SessionLibrary({
  records,
  loading,
  error,
  status,
  currentId,
  onClose,
  onSave,
  onExport,
  onImport,
  onRestore,
}: Props) {
  const formatted = (date: string) =>
    new Intl.DateTimeFormat('en-SG', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Singapore',
      timeZoneName: 'short',
    }).format(new Date(date))
  return (
    <ModalShell title="Saved exercises" eyebrow="BROWSER SESSION LIBRARY" onClose={onClose} wide>
      <p className="modal-intro">
        Checkpoints stay in this browser on this site. Restoring opens a separate paused copy.
        Export JSON to move an exercise to another browser or keep an independent record.
      </p>
      <div className="library-toolbar">
        <button
          className="secondary-button"
          onClick={onSave}
          disabled={loading || status.state === 'saving'}
        >
          <Save size={15} />
          Save checkpoint now
        </button>
        <button className="secondary-button" onClick={onExport}>
          <Download size={15} />
          Export current exercise
        </button>
        <label className="primary-button import-button">
          <Upload size={15} />
          Import session JSON
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Import session JSON"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) onImport(file)
            }}
          />
        </label>
      </div>
      {(error || status.error) && (
        <div className="library-error" role="alert">
          {error || status.error}
        </div>
      )}
      <div className="library-status">
        <HardDrive size={14} />
        <span>
          {status.state === 'saving'
            ? 'Saving checkpoint…'
            : status.state === 'saved' && status.savedAt
              ? `Last saved ${formatted(status.savedAt)}`
              : status.state === 'loading'
                ? 'Opening browser storage…'
                : 'Local save unavailable. Export a JSON copy.'}
        </span>
        <span>
          {records.length} saved {records.length === 1 ? 'exercise' : 'exercises'}
        </span>
      </div>
      {loading ? (
        <div className="library-empty">
          <LoaderCircle size={23} />
          <p>Loading saved exercises…</p>
        </div>
      ) : records.length ? (
        <div className="saved-session-list">
          {records.map((saved) => {
            const exercise = SCENARIOS.find((s) => s.id === saved.scenarioId)
            return (
              <div className="saved-session" key={saved.id}>
                <span className="saved-session-icon">
                  <FileJson size={22} />
                </span>
                <div>
                  <span className="eyebrow">
                    {exercise?.code ?? 'EXERCISE'}
                    {saved.id === currentId && <span className="current-checkpoint">CURRENT</span>}
                  </span>
                  <h3>
                    {saved.envelope?.session?.exercise?.title ??
                      exercise?.title ??
                      'Saved exercise'}
                  </h3>
                  <p>
                    <Clock3 size={11} />
                    {formatTime(saved.elapsed)}
                    <span>·</span>
                    {saved.eventCount} events<span>·</span>
                    {formatted(saved.savedAt)}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => onRestore(saved)}
                  aria-label={`Restore ${exercise?.title ?? 'saved exercise'}`}
                >
                  Restore paused
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="library-empty">
          <HardDrive size={24} />
          <h3>No checkpoints yet</h3>
          <p>Save the current exercise, or import an exported session.</p>
        </div>
      )}
      <p className="library-footnote">
        Storage is local to this browser and website address. Clearing site data removes local
        checkpoints. Import supports this build and version 0.1 exports, up to 10 MB and 2,500
        events. Records are not authenticated assessment evidence.
      </p>
    </ModalShell>
  )
}
