import { BUILD_COMMIT, ENGINE_VERSION } from './version'
import { AIRPORT_DATA } from './airport'
import { formatTime } from './engine'
import type { Session } from './types'
function escape(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}
export function sessionReport(s: Session): string {
  const rows = s.events
    .map((e) =>
      `<tr><td>#${e.id}</td><td>${formatTime(e.time)}</td><td>${escape(e.kind)}${e.source ? ` / ${escape(e.source)}` : ''}</td><td>${escape(e.text)}${e.relatedEventId ? ` <a href="#event-${e.relatedEventId}">Evidence #${e.relatedEventId}</a>` : ''}</td></tr>`.replace(
        '<tr>',
        `<tr id="event-${e.id}">`,
      ),
    )
    .join('')
  const criteria = s.exercise.criteria
    .map((c) => {
      const a = s.assessments.find((x) => x.criterionId === c.id)
      return `<tr><td>${escape(c.title)}<p>${escape(c.description)}</p></td><td>${escape(a?.rating ?? 'Not rated')}</td><td>${escape(a?.reviewer ?? '')}</td><td>${escape(a?.note ?? '')}${a ? ` <a href="#event-${a.eventId}">Evidence #${a.eventId}</a>` : ''}</td></tr>`
    })
    .join('')
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VATSIM AI — ${escape(s.exercise.title)}</title><style>body{font:15px/1.6 system-ui;color:#172d38;max-width:1100px;margin:40px auto;padding:0 24px}h1,h2{line-height:1.2}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #a9b5bb;padding:9px;text-align:left;vertical-align:top;overflow-wrap:anywhere}p{white-space:pre-wrap}small{color:#456}a{color:#145673}@media print{body{margin:0;font-size:11px}tr{break-inside:avoid}}</style><h1>VATSIM AI exercise report</h1><h2>${escape(s.exercise.title)} · revision ${s.exercise.revision}</h2><p>${escape(s.exercise.objective)}</p><p><strong>Development record.</strong> Illustrative WMKK data and simplified dynamics. Not validated or approved for professional training. Manual ratings are unauthenticated instructor entries, not automated competency scores.</p><p>Session: ${escape(s.id)}<br>Engine: ${ENGINE_VERSION} · build: ${escape(BUILD_COMMIT)} · dataset: ${AIRPORT_DATA.id}<br>Elapsed: ${formatTime(s.time)} · completed: ${s.completed}/${s.aircraft.length} · instructions applied: ${s.accepted}/${s.attempted}<br>Weather: ${s.weather.windDirection}° / ${s.weather.windSpeed} kt · QNH ${s.weather.qnh} · information ${escape(s.weather.information)}</p><h2>Manual assessment</h2><table><thead><tr><th>Draft criterion</th><th>Rating</th><th>Reviewer</th><th>Rationale and evidence</th></tr></thead><tbody>${criteria}</tbody></table><h2>Event history</h2><table><thead><tr><th>Event</th><th>Time</th><th>Role / source</th><th>Record</th></tr></thead><tbody>${rows}</tbody></table><p>Exported records are portable browser files. They do not establish authenticity or satisfy an institutional retention policy. No audio is included.</p></html>`
}
export function radioCsv(s: Session): string {
  const cell = (v: unknown) => {
    let text = String(v ?? '')
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  return (
    '\uFEFF' +
    [
      [
        'Event',
        'Exercise seconds',
        'Role',
        'Pilot source',
        'Aircraft',
        'Frequency',
        'Transmission',
      ],
      ...s.events
        .filter((e) => ['controller', 'pilot'].includes(e.kind))
        .map((e) => [
          e.id,
          e.time,
          e.kind,
          e.source ?? '',
          e.aircraftId ?? '',
          e.frequency ?? '',
          e.text,
        ]),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n')
  )
}
