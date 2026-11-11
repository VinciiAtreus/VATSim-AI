# VATSIM AI — session handover

## Map update continuation, 11 November 2026

The newly selected environment applied the requested chart domains and fresh requests succeeded. Charts were retrieved, including the newer 3 November 2026 CAAM edition. The map/routing update is documented in [WMKK_GEOMETRY.md](WMKK_GEOMETRY.md), with exact source hashes in [WMKK_CHART_SOURCES.json](WMKK_CHART_SOURCES.json). Engine 0.5.0 / dataset `wmkk-caam-trace-0.2` replaces the old paths together with the drawing. Existing records are retained and exportable unchanged; incompatible schematic coordinates are rejected explicitly. PR #4 remains the existing draft review vehicle, unmerged. Local checks: 100 unit tests, 30 Chromium browser tests, production build, formatting and diff checks passed; screenshots inspected. The earlier handover below is historical context.

---

Prepared 11 November 2026 (Asia/Singapore). Read this before changing the project. This document records the state before the handover-only commit; refresh GitHub and the checkout when resuming.

## Immediate objective

Replace the inaccurate schematic WMKK map with a chart-based airport layout. The owner explicitly rejected the current map and asked for real runway geometry, terminals, gates/stands, taxiways and connections, using WMKK airport charts. Update aircraft routes and clearance limits with the geometry, rather than improving only its appearance.

Owner-supplied reference: <https://navigraph.com/airport/WMKK/Kuala-Lumpur-Intl---Sepang>.

No chart-based map replacement has been implemented. No airport/parking charts have been downloaded or inspected in this session. Do not imply that the current layout came from charts.

## Owner decisions and working style

- Product: **VATSIM AI**, a desktop-browser WMKK ATC simulator. The player controls ATC; scripted or human-operated pilots fly aircraft.
- Intended audience: professional ATC training users, with Malaysian/CAAM context. Current software is an unvalidated development prototype, not an approved training device.
- Hosting: existing Vercel project connected to GitHub. Do not move hosting to Sites or add another deployment platform.
- The owner explicitly selected **browser-only** for the consolidated release. No Supabase, cloud accounts, multiuser backend or external LLM service is currently requested.
- Build related work together rather than repeatedly delivering tiny releases. Continue implementation autonomously within the agreed scope.
- Preserve review workflow: push a branch, provide preview and PR, and merge when the owner asks. Previous “Merge” instructions applied to previous PRs; PR #4 has not been authorised for merge.
- Voice recognition failed with `network` in Vivaldi. The owner confirmed it works in **Edge** and accepts using Edge. Do not reopen that troubleshooting task unless asked.
- Do not invent surveyed coordinates, taxiway names, stands, procedures, minima or approval status.

## Repository and deployment state

| Item                               | Last verified state                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Repository                         | <https://github.com/VinciiAtreus/VATSim-AI>                                            |
| Local checkout                     | `/workspace/VATSim-AI`                                                                 |
| Working branch                     | `codex/consolidated-browser-release`                                                   |
| Latest application commit          | `f52408486eea4e735ce28a03f3613788de6b700a`                                             |
| Previous consolidated commit       | `0ecafe87ffbe6eadf3298fc64a93a327e7020761`                                             |
| Main at PR #4 base                 | `136eeab55e40b35a97b4f71fdb4f940df17db7ca`                                             |
| Open PR                            | <https://github.com/VinciiAtreus/VATSim-AI/pull/4> — open, draft, unmerged             |
| Branch preview                     | <https://vatsim-ai-git-codex-consolidated-brows-1fb953-vincii-atreus-llc.vercel.app>   |
| GitHub CI at `f524084`             | Verify workstation run #15, completed successfully                                     |
| Vercel at `f524084`                | Success; <https://vercel.com/vincii-atreus-llc/vatsim-ai/6WSkKAEyST2oQiAbWgNQ4w8d6pu2> |
| Working tree before handover files | Clean                                                                                  |

PRs #1–#3 were merged. PR #4 contains the consolidated browser release and the speech-service recovery fix. Fetch current remote state before choosing a branch: do not accidentally discard PR #4 by starting a map update from an older `main`.

## Chart access: saved configuration versus running instance

The owner says they have already added the requested domains. Respect that; do not assume they have not done so.

However, the running instance checked during this handover still returned:

- Environment ID: `ccarenv_b64_Y2NhcmVudl9jNzQ3NmNkYTQ4MzQ4MTkxYTQyNDU3NTY0ODU2YzUwZQ`.
- Phase `running`; observations current; network policy enforced.
- Custom `allowed_hosts: []`; preset `package_managers`.
- A fresh HTTPS request to the supplied Navigraph URL failed at the proxy CONNECT step with **403**. This was not a Navigraph application response, sign-in screen, or proof of subscription requirements.
- Earlier direct CAAM access was similarly blocked. Shared Chromium also failed to open CAAM, reporting `DNS_PROBE_FINISHED_NO_INTERNET`.

At the start of the next session, inspect the **selected environment's** status and retry fresh connections. The next session may pick up the owner's changed/published configuration. Do not reuse this environment ID if another instance is selected.

Requested source domains:

```text
navigraph.com
www.navigraph.com
aip.caam.gov.my
www.caam.gov.my
```

Use inherited proxy/CA settings; do not bypass network policy. If a fresh instance still rejects these hosts, report the observed mismatch rather than claiming that adding them was never done. Chart PDFs/screenshots uploaded by the owner are an alternative source path. Only request additional redirect/asset hosts after observing them. Do not claim a chart page requires a subscription until that is actually observed.

## Chart and data acquisition

Obtain the applicable WMKK aerodrome, ground movement and aircraft parking/docking charts, covering Terminal 1, satellite and Terminal 2. Record chart identity, source, edition/effective date and applicability. Start with the owner-supplied Navigraph page and official CAAM publications.

Existing references (located editions, not confirmed current):

- CAAM AIS: <https://www.caam.gov.my/public/ais/>.
- WMKK AD 2 reference edition: <https://aip.caam.gov.my/aip/eAIP/2026-08-06-AIRAC/html/eAIP/WM-AD-2.WMKK-en-MS.html>.
- Directives index: <https://www.caam.gov.my/legislation-regulations/general/civil-aviation-directives/>.
- CAD 1101 located edition: <https://www.caam.gov.my/wp-content/uploads/2021/04/CAD-1101-Air-Traffic-Management-1-1.pdf>.
- CAD 1211 located edition: <https://www.caam.gov.my/wp-content/uploads/2022/11/CAD-1211-Air-Traffic-Controller-Approved-Training-Organisation-ATC-ATO-ISS01_REV01.pdf>.

See [SOURCE_REGISTER.md](SOURCE_REGISTER.md). Accessing a chart is not evidence that the edition is current or its operational rules have been reviewed. Keep source provenance for geometry and labels. Referencing geometry and redistributing chart artwork are separate implementation choices; do not silently bundle licensed chart images.

## Current implementation

React 19, TypeScript, Vite, custom SVG map, lucide icons, Vitest and Playwright. Node **24.x**; dependency versions are pinned. Static Vercel build, no backend or API keys.

Version identifiers:

- App/engine: `0.4.0`.
- Session envelope: `vatsim-ai.session.v4`.
- Portable lesson: `vatsim-ai.exercise.v1`.
- Airport dataset: **`wmkk-schematic-0.1`**, explicitly illustrative/unverified.
- Vercel builds embed `VERCEL_GIT_COMMIT_SHA`; local builds say `local-development`.

Implemented workflows:

- Three runway pairs, four modelled traffic profiles and three built-in exercises; airport drawing and routes are schematic.
- Typed commands, strict phase/runway/radio validation, pilot readbacks, pushback/taxi/hold/line-up/takeoff/landing/go-around/stand taxi.
- Moving final approach, physical touchdown occupancy, automatic exercise-policy go-arounds, configurable occupied-runway guards.
- Local pseudo-pilot takeover, queued instructions, execute/decline, manual radio, individual motion freeze retaining occupancy, audited return to scripted control.
- Versioned local lessons, traffic callsigns and release times, fictional weather, timed runway/readback events, manual assessment criteria.
- Adjacent-station request/accept/decline workflow; acceptance is separate from radio transfer; optional required acceptance.
- Browser speech drafts with separate transmit action; browser readback audio. No audio recording, external LLM pilots or live VATSIM integration.
- Captured event snapshots, linked observations, manual assessments, playback at 1/2/4 events per second, printable HTML and radio CSV.
- IndexedDB session autosave/recovery paused, import/restore as a separate copy; local-storage lesson library.

Bounds: four existing traffic profiles, 30 saved lessons, 20 timed events and 12 criteria per lesson; lesson files 128 KB; portable session import 10 MB / 2,500 events. Long browser checkpoints retain recovery beyond the portable history cap. Typed transmissions, manual calls and observations are bounded to 1,000 characters.

## Code entry points for the map replacement

| File                               | Responsibility / implications                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/AirportMap.tsx`    | Custom SVG terminals, runway drawing, taxiway labels, stands, routes, aircraft, zoom/pan. Geometry is largely embedded here.                             |
| `src/sim/airport.ts`               | Dataset metadata, runway endpoints/holds/entries, ground and tower radios, fixed aircraft profiles, initial positions and scenario catalogue.            |
| `src/sim/engine.ts`                | Hardcoded pushback/taxi/line-up/rollout/stand routes; occupancy, motion, arrivals and command checks. Changing the SVG alone leaves movement inaccurate. |
| `src/sim/parser.ts`                | Constrained callsign/runway/taxi instruction grammar; currently models limited A/C/Z routes. Real route sequences need parser and validator work.        |
| `src/sim/exercises.ts`             | Builds authored traffic from the four profiles and validates lessons; profile IDs, stands and initial phases depend on the old dataset.                  |
| `src/sim/sessionCodec.ts`          | Dataset/model compatibility, v1–v3 migration into v4, snapshots, traffic activation, queued instructions, coordination and assessments.                  |
| `src/sim/types.ts`                 | Aircraft positions/routes/phase contracts, events and session shape.                                                                                     |
| `src/components/DataReadiness.tsx` | Visible dataset/source/validation information.                                                                                                           |
| `src/App.tsx`                      | Inspector, suggestions, replay, modals, source labels and scenario loading.                                                                              |
| `src/styles.css`                   | Map geometry presentation and workstation layout.                                                                                                        |

Existing geography and movement assumptions that must not be treated as real:

- Runway display x coordinates: 33 = 265, 32L = 580, 32R = 925. Runway length/endpoints are arbitrary display coordinates.
- A/C/Z taxi paths, B6/B8/B10/Q4 stand labels/positions and links have not been checked against charts.
- Gate routing, pushback and rollout include literal display-space waypoints in the engine.
- Final approach is 1.5 display units/second, with a 25-unit exercise decision offset and 20-second reminder. These are not CAAM minima or validated performance.
- Surface and airborne motion use display-space speeds. A georeferenced map changes their scale; account for this explicitly rather than stretching geometry and silently altering timing.

Suggested implementation sequence:

1. Acquire and inspect source charts before drawing geometry; record edition and uncertain details.
2. Establish a consistent coordinate system, projection, north orientation and measurable scale.
3. Extract airport geometry into versioned data shared by rendering and routing, rather than maintaining different map and engine layouts.
4. Model runway endpoints, taxiway junctions, holding positions, apron links and stands from sources. Mark unresolved details visibly.
5. Build connected routing with runway crossings/clearance limits explicit. Make supported taxi instructions match the graph.
6. Reposition aircraft, update route following/arrival geometry, units and scenario data together.
7. Handle saved sessions/lessons deliberately: old display coordinates must not silently appear on a new map. Preserve old records, with a compatible old-data renderer or an explicit dataset-incompatibility response; do not mislabel old geometry as the new dataset.
8. Verify topology, routes, hold-short stops, occupancy, map fit/zoom/labels and migration/import behavior. Visually compare with chart sources.
9. Publish one reviewable preview/PR update. Do not claim CAAM compliance or professional validation solely from implementation tests.

## Verification and commands

```sh
cd /workspace/VATSim-AI
npm run dev
npm test
npm run build
npm run format:check
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

For package installation/npm execution that needs a cache, use `/tmp/vatsim-npm-cache` rather than the unwritable home cache, e.g. `npm --cache /tmp/vatsim-npm-cache ci`. Dependencies and system Chromium were already installed in the last workspace; inspect before reinstalling.

Evidence before handover:

- At `0ecafe8`: **93 unit tests, 27 Chromium browser tests**, production build, formatting and diff checks passed; production screenshots inspected.
- At `f524084`: 93 unit tests, production build, and **four focused voice tests** passed locally. Added regression: network failure without `onend` releases capture, preserves the draft, permits explicit retry, and never auto-transmits.
- GitHub CI for `f524084` completed successfully after the added voice test. The full browser suite now contains **28** tests; do not confuse the earlier 27-test local run with the latest suite size.
- Vercel deployment for `f524084` succeeded.
- Compact desktop voice-error check: command bottom 658 px, footer top 704 px at 1200×735.

Tests are in `src/sim/*.test.ts`, `src/storage/exerciseStore.test.ts`, `tests/workstation.spec.ts` and `tests/consolidated.spec.ts`. Browser tests use speech lifecycle fixtures; this is not a real aviation speech-accuracy evaluation. The owner’s Edge success is the real-device observation.

## Tool / environment notes

- Read the cloud runtime skill at session start and inspect current environment readiness before network work.
- GitHub connector tools can read/update PRs and status without needing shell access to chart hosts. Avoid printing full PR diffs or Vercel comment metadata; filter results.
- No subagents were requested; do not spawn them unless a later instruction explicitly allows delegation.
- Shared browser DOM creation previously failed with `Browser Use could not read requirements`. Native Chromium controls worked through `cua.getApp`; Sky input failed with an AT-SPI provider error. This did not solve chart network access.
- Automated Playwright tests and screenshots worked with `/usr/bin/chromium`.
- Temporary screenshots/scripts are under ignored `work/`. Do not commit generated screenshots or dependencies unintentionally.

## Further reading

- [RELEASE_0_4.md](RELEASE_0_4.md): consolidated browser walkthrough, persistence and limitations.
- [ARCHITECTURE.md](ARCHITECTURE.md): state engine, deployment and local storage contracts.
- [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md): professional development gates and owner-selected browser scope.
- [SOURCE_REGISTER.md](SOURCE_REGISTER.md): source editions and review gaps.
- [WORKSTATION_DESIGN.md](WORKSTATION_DESIGN.md): workstation interaction contracts.
- [RELEASE_0_3.md](RELEASE_0_3.md): pseudo-pilot and linked-observation behavior.
