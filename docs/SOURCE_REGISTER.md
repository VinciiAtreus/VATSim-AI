# WMKK source and validation register

Dataset: `wmkk-caam-trace-0.2`

**Status: chart-transcribed, professionally unvalidated.** Airport geometry and connected movement now share a manually traced dataset. See [WMKK_GEOMETRY.md](WMKK_GEOMETRY.md) for registration, supported routes, compatibility and limitations, and [WMKK_CHART_SOURCES.json](WMKK_CHART_SOURCES.json) for retrieved chart provenance and hashes. November 2026 charts were actually retrieved and inspected. This does not establish operational applicability or approval.

The entries below are the earlier reference register; their outstanding procedural reviews remain open.

## Sources located

| Source                                                                                                                                                                                    | Located edition                                                   | Intended use                                                                                | Validation status                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [CAAM directives index](https://www.caam.gov.my/legislation-regulations/general/civil-aviation-directives/)                                                                               | Review current index before baseline freeze                       | Identify applicable directives and revisions                                                | Located; applicability review required                          |
| [CAD 1101: Air Traffic Management](https://www.caam.gov.my/wp-content/uploads/2021/04/CAD-1101-Air-Traffic-Management-1-1.pdf)                                                            | Issue 01 / Rev 00, 1 May 2021; subsequent changes must be checked | ATC procedures, clearances, readback, coordination, separation, phraseology                 | Reference reviewed; no operational rule-set validation          |
| [CAD 1211: ATC Approved Training Organisation](https://www.caam.gov.my/wp-content/uploads/2022/11/CAD-1211-Air-Traffic-Controller-Approved-Training-Organisation-ATC-ATO-ISS01_REV01.pdf) | Issue 01 / Rev 01, 15 November 2022                               | Training-device suitability/approval, communications, equipment, record/replay requirements | Located; intended-use and approval review required              |
| [WMKK AD 2](https://aip.caam.gov.my/aip/eAIP/2026-08-06-AIRAC/html/eAIP/WM-AD-2.WMKK-en-MS.html)                                                                                          | 6 August 2026 reference edition                                   | Airport data, communications, local rules, flight procedures, chart index                   | Current effective baseline not confirmed                        |
| [CAAM AIS](https://www.caam.gov.my/public/ais/)                                                                                                                                           | Publication portal                                                | Effective amendments, supplements, circulars, NOTAM sources                                 | Reconcile effective publications before data release            |
| [AIRAC AIP SUP 50/25](https://www.caam.gov.my/wp-content/uploads/2025/09/WM-eSUP-25-50-en-MS.pdf)                                                                                         | Effective 2 October 2025                                          | Parallel approach operations                                                                | Incorporation, changes and continuing applicability need review |
| [AIRAC AIP SUP 51/25](https://www.caam.gov.my/wp-content/uploads/2025/09/WM-eSUP-25-51-en-MS.pdf)                                                                                         | Effective 2 October 2025                                          | Conditional triple-runway departure procedure                                               | Incorporation, changes and continuing applicability need review |
| TowerLine screenshots                                                                                                                                                                     | Supplied by project owner                                         | Layout/workflow comparison                                                                  | Not a procedural authority; no code or artwork copied           |

## Data items

| Item                       | Prototype representation                         | Required replacement or review                                                      |
| -------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Runway identities          | 14L/32R, 14R/32L, 15/33                          | Review against effective chart and configuration                                    |
| Tower frequencies          | Reference values 118.800, 118.500, 119.800       | Confirm effective values, usage, and handoff responsibilities                       |
| Ground frequencies         | Small demonstration subset                       | Import reviewed sector coverage and transfer rules                                  |
| Taxi geometry and routes   | Bounded CAAM chart-transcribed paths             | Georeferenced source, route restrictions, holding positions, aircraft compatibility |
| Stands                     | Four routed profiles plus traced parking context | Validate existence, geometry, dimensions, and movement constraints                  |
| Aircraft performance       | Constant-speed metric kinematics                 | Reviewed aircraft model and operational tolerances                                  |
| Wind and QNH               | Fixed fictional exercise weather                 | Consistent scenario data and applicable procedures                                  |
| Unanswered calls           | 90-second coaching observation                   | Instructor-defined exercise criterion, not asserted CAAM limit                      |
| Runway occupancy           | Coarse phase flag and injected obstruction       | Validated protected areas, complete-aircraft clearance, applicable rules            |
| Minima and wake separation | Not implemented                                  | Reviewed rules by aircraft category, configuration, and conditions                  |
| Local coordination         | Not implemented                                  | Authorised local procedures and training lead review                                |

## Rule record contract

Future operational rules must include: `ruleId`, `sourceUrl`, `sourceSection`, `edition`, `effectiveFrom`, `effectiveUntil`, `applicability`, `interpretation`, `reviewer`, `reviewedAt`, `validationStatus`, `acceptanceTestIds`, and `changeHistory`.

Statuses: proposed → source-checked → SME-reviewed → scenario-tested → released. The current chart-transcribed graph remains outside that operational release pipeline.

No reviewer or approval is recorded until a real review occurs. Public accessibility does not itself establish redistribution rights for charts or other source assets.

## Version 0.2 exercise model additions

The moving final-approach speed (1.5 display units/second), decision offset (25 display units before threshold), and short-final reminder (20 exercise seconds) are developer-defined demonstration values. They are not asserted CAAM procedures, decision heights, minima, or aircraft performance. They require instructor and aircraft-model validation before professional use. Landing clearance and physical occupancy are separate simulation state. A runway obstruction can be injected on any supported runway.
