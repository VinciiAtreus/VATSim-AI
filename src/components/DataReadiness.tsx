import { AIRPORT_DATA } from '../sim/airport'
import { BUILD_COMMIT, ENGINE_VERSION } from '../sim/version'
import type { ExerciseDefinition } from '../sim/types'
export default function DataReadiness({ exercise }: { exercise: ExerciseDefinition }) {
  return (
    <section className="settings-section">
      <h3>Release and source readiness</h3>
      <dl className="release-facts">
        <div>
          <dt>Software</dt>
          <dd>{ENGINE_VERSION}</dd>
        </div>
        <div>
          <dt>Build commit</dt>
          <dd>{BUILD_COMMIT}</dd>
        </div>
        <div>
          <dt>Airport dataset</dt>
          <dd>{AIRPORT_DATA.id} · illustrative, unverified</dd>
        </div>
        <div>
          <dt>Lesson</dt>
          <dd>
            {exercise.title} · revision {exercise.revision}
          </dd>
        </div>
        <div>
          <dt>Criteria status</dt>
          <dd>Author-defined development draft; instructor validation pending</dd>
        </div>
      </dl>
      <ul className="source-readiness">
        <li>
          <a
            href="https://aip.caam.gov.my/aip/eAIP/2026-08-06-AIRAC/html/eAIP/WM-AD-2.WMKK-en-MS.html"
            target="_blank"
            rel="noreferrer"
          >
            WMKK AD 2 reference edition · 6 August 2026
          </a>
          <span>
            Current effective baseline, geometry, routes, sectors and restrictions require
            reconciliation and expert review.
          </span>
        </li>
        <li>
          <a
            href="https://www.caam.gov.my/legislation-regulations/general/civil-aviation-directives/"
            target="_blank"
            rel="noreferrer"
          >
            CAAM directive publication index
          </a>
          <span>
            Applicable CAD 1101 / CAD 1211 editions and the approval route require
            training-organisation review.
          </span>
        </li>
        <li>
          <a href="https://www.caam.gov.my/public/ais/" target="_blank" rel="noreferrer">
            CAAM AIS publication portal
          </a>
          <span>
            Amendments, supplements and NOTAM applicability have not been reconciled into this
            dataset.
          </span>
        </li>
      </ul>
      <p>
        No source review or approval is inferred from these links. Scenario, software, and dataset
        identifiers are included in exported records.
      </p>
    </section>
  )
}
