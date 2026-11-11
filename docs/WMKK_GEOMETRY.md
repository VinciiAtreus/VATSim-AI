# WMKK chart geometry and routing — review guide

Dataset `wmkk-caam-trace-0.2`, engine 0.5.0. This replaces the illustrative map and its movement paths together. It is a manually digitised chart subset, not a surveyed airport database or a professionally validated training model.

## Retrieved sources

The selected environment applied the owner's custom allowlist (current observations, policy enforced, revision 1). Fresh Navigraph and CAAM requests succeeded on 11 November 2026. The initial checkout was main at `136eeab`; PR #4 was still open/draft, head `a7d088c` (handover only), application parent `f524084`. Work continues on the existing PR branch and Vercel integration.

The [CAAM history index](https://aip.caam.gov.my/aip/eAIP/history-en-MS.html) listed 3 November 2026 and 29 October 2026 AIRAC editions. The [3 November WMKK publication](https://aip.caam.gov.my/aip/eAIP/2026-11-03/html/eAIP/WM-AD-2.WMKK-en-MS.html) supplied the retrieved aerodrome, ground movement, Terminal 1/2 parking and taxi route charts. Their URLs, page identities, printed dates, byte sizes and SHA-256 digests are in [WMKK_CHART_SOURCES.json](WMKK_CHART_SOURCES.json). The route tables retain their own July/October 2024 printed dates within that publication.

The first trace used the May-dated charts carried in the August reference edition, then was compared visually with the November aerodrome/ground/parking editions. November charts identify elevation-unit changes. Raster files, OCR and screenshots remain in ignored `work/charts/`; chart artwork is not shipped. The supplied [Navigraph page](https://navigraph.com/airport/WMKK/Kuala-Lumpur-Intl---Sepang) was retrieved as a reference page, not as a licensed chart source. No Navigraph artwork was used.

Publication retrieval does not reconcile every AIP amendment, supplement, NOTAM, stand restriction or aircraft limitation. No qualified reviewer or CAAM approval is recorded.

## Geometry registration

`src/sim/geometry.ts` owns the trace, rendering edges, route paths, stand lead-ins and footprint data. The working raster is the 1696 × 2400 ground-chart render. Parking-diagram points are registered to it by the transforms recorded in that file. Stand points and footprints are approximate manual traces, not the tabulated INS coordinates. Displayed parking is a subset; only B6, B8, B10 and Q4 have aircraft profiles.

The published AD 2.12 threshold anchors used for registration are:

| Threshold | Latitude N   | Longitude E   |
| --------- | ------------ | ------------- |
| 14R       | 02°44′35.84″ | 101°41′52.63″ |
| 14L       | 02°46′42.52″ | 101°42′06.67″ |
| 15        | 02°44′17.57″ | 101°40′38.97″ |

A local equirectangular calculation uses radius 6,371,000 m and the 14R latitude for longitude scale, then rotates into axes aligned with 326.01° true. Relative to 14R, 14L is approximately (2546.61, −3002.10) m and 15 (−2199.74, −802.58) m. Registration interpolates between runway columns and maps their manually selected raster endpoints to the published lengths: 14L/32R **4019 m**, 14R/32L **4000 m**, 15/33 **3960 m**, all **60 m** wide. This is approximate registration between anchors, not an accuracy certification.

One simulation unit is 10 m. The SVG rotates the runway-aligned data −33.99° to show north up. The runway drawing, approach, touchdown, roll-out, hold-short, entry and departures use those same coordinates. Knots convert through 1852 m / 3600 s; old display-space motion constants are removed. Constant speeds, instantaneous turns and the 16⅔-second decision policy remain exercise simplifications, not aircraft performance or operational minima. Initial final approach retains a 90-second flight to threshold. Selecting the arrival fits its actual off-airport position into view; the normal airport view fits the runway geometry.

## Supported movement and clearance limits

| Traffic                    | Source row                 | Accepted route      |
| -------------------------- | -------------------------- | ------------------- |
| MAS612/B6, MXD124/B8 → 32R | 2-56, East Terminal East   | T2 T3 F1 G B9 A A11 |
| AXM518/Q4 → 33             | 2-58, West Satellite South | U5 Z Z8 Y Y9        |
| MAS1134/32L → B10          | 2-38, East Terminal East   | C D2 G F4 T4 T2     |

The arrival uses the chart's normal C5 exit, then stops fully outside the runway centreline before the ground transfer and stand taxi. Other exits, intersection departures and runway crossings are not implicitly granted. Published route sequences are implemented, but local operational applicability still needs expert review.

The route graph is deliberately bounded. Context centrelines show additional chart features for orientation; they are not all routable. Departure taxi ends at the traced A11/Y9 holding position. A separate correct-frequency line-up instruction is required to traverse the hold-to-entry link. No graph edge crosses the middle runway to shortcut between terminals. There is no 32L departure traffic profile or supported departure clearance in this release.

Radio coverage remains the previous exercise subset; the 32L arrival still transfers to the exercise ground channel 121.650 rather than modelling the chart’s full 121.800/122.525 sector allocation. This update does not claim chart-accurate radio sectors.

Pushback connects a modelled stand to its adjacent stand taxilane. The chart does not establish pushback direction, tug practice, wingtip clearance or a cleared pushback area; these assumptions require review. The model has no swept aircraft envelope, stop-bar system, pavement strength enforcement or full airport route planner.

## Records and preserved release workflows

The dataset ID changes deliberately. Old schematic sessions remain in IndexedDB, can be exported unchanged, and receive an explicit incompatibility error on restore/import. They must be replayed with the previous build; their coordinates are never silently relabelled. New sessions use new IDs and do not overwrite old checkpoints. The existing local lesson library is retained; it references the same four profile IDs and now instantiates this dataset. Authors must review any free-text objectives that mention old taxi routes. Portable lesson files with the old dataset ID are rejected without rewriting them.

Voice drafts, browser-only persistence, instructor controls, coordination, authored lessons, assessment and replay remain in scope. Hosting remains the existing GitHub/Vercel integration. PR #4 remains draft and must not be merged without the owner asking.

## Review checks

Automated tests cover published runway lengths, knot conversion, connected rendered route edges, interrupted taxi resumption, rejection of the old single-letter clearance, hold-short occupancy, dataset incompatibility, and the existing release workflows. Browser checks cover map zoom/fit/labels and unchanged export of an incompatible record. Local validation: 100 unit tests, 30 Chromium browser tests, production build, formatting and diff checks passed. Airport and parking-detail screenshots were inspected. These checks verify implementation behavior; they do not constitute CAAM or professional validation.
