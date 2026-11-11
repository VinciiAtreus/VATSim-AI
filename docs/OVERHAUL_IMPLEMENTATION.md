# Workstation overhaul implementation

Reference material: the supplied **VATSIM AI Controller Workstation — UI and System Overhaul Design** (11 November 2026) and **VATSIM AI — Realistic ATC Workstation Redesign** PDF. These are product references, not authorization to publish or replace verified airport data. Changes are local to this checkout.

## Delivered

- Neutral equipment palette, locally hosted IBM Plex fonts, night/day tokens, three columns at 1280 px, independent scrolling for equipment bays, stacked surface/right/strips below 900 px (DP-1/2/3/8, LAY-01/02).
- Live system UTC, ATIS/weather controls, runway occupancy chips, one safety/system line, dashed simulator corner with run/pause, speed, reset, checkpoints and exercise selection (TOP-01–04, ALR-01–03, SIM-01/02).
- Six paper strip bays in runway-proximity order, derived from aircraft phases; shared target/strip selection, search, fixed paper colours in both modes (EFS-01–06).
- Data-driven schematic runways/holding points, separate stand/taxiway toggles, geometric targets, leader lines, label placement with compact fallback, cleared route, automatic stop bars, pan/zoom and approach display (SMD-01–04/06–11, APP-01–03, SB-01/02). Target sizes and label sizes compensate for SVG scale. The airfield remains explicitly schematic.
- Selected-aircraft phase ladder and clearance buttons that transmit directly; optional phrase-only training prepares text for PTT.
- Rebindable keyboard, mouse buttons 4/5 and gamepad PTT, pointer capture, focus/visibility cancellation, 350 ms minimum, 30 s guard, busy readback blocking, TX indicators and latching accessibility mode (PTT-01–12/14, A11Y-06).
- Opt-in browser SpeechRecognition/WebKitSpeechRecognition with microphone/error handling, recognition preview, 0.6 confidence gate and the same parser/validator used by typed/click input. Chrome may send speech to its recognition service. Typed PTT sends the explicitly entered text, never an invented recognition result or automatically selected suggestion.
- Spoken-digit/decimal/phonetic normalization, holding-point validation, wind-prefix and hyphenated phrase handling, hold short, continue taxi and say again commands. Invalid aircraft-state instructions produce a pilot query and no aircraft change (PTT-17/21/22).
- Exact 10 Hz integration with fractional carry between browser timer callbacks, preserved held routes and UTC event stamps retained through checkpoints. Existing historical snapshots, instructor workflows and old session imports continue working.
- Independent TX/RX selection for the existing exercise radios, optional consistent browser TTS voices per aircraft, recorded readbacks, persistent preferences and preferences included in JSON exports.
- Live no-landing-clearance and multiple-occupancy alerts, readback/obstruction warnings, alert start/escalation/end event records, target-border indication and reduced-motion override.

## Deliberate data choices

The old exercise uses **118.050 as Ground West**, whereas the supplied mockup calls it Tower. The existing exercise assignments are preserved so that handoffs, imports and aircraft station checks remain consistent. All five modeled exercise radios remain available. No real-world frequency validation is claimed. The unspecified GUARD channel is not represented as an active aircraft station.

Squawks, RFLs, holding-point names and movement distances are marked as exercise placeholders in settings. Range on the final view uses the schematic exercise scale (50 display units per NM); it is not surveyed geometry. The previous exercises and their short demonstration movement timings are retained.

## Remaining design acceptance work

This is the implemented workstation and browser-input slice, **not a declaration that every requirement in the full design has passed**.

- Phase 3's new canonical data contracts, seeded command/event reconstruction, taxi-graph routing, traffic generation, 60 m physical conflict model, wake spacing, full stop-bar incursion model and per-frequency queued/retried pilot calls are not implemented. Checkpoints still store validated session snapshots and event snapshots. There is no continuous traffic mode in this checkout to preserve.
- Browser speech recognition does not expose an AudioWorklet pre-roll buffer. Phrase hints and reliable word-level alternatives/confidence are not portable across browser recognition implementations. Recognition confidence is checked at result level; there is no token-alternatives UI.
- Actual two-speaker 9/10 phrase accuracy, physical mouse/joystick devices, sub-50 ms end-to-end latency, full text contrast auditing and a real microphone were not validated by the automated suite.
- No radio-filtered TTS audio, squelch/sidetone, pilot call queue after PTT, stale-ATIS pilot correction, real geometry, global desktop PTT, detached strip window or manual stop-bar/strip dragging.
- Arrival phase labels and departure/arrival actions are adapters over the existing engine states; the proposed replacement state enums are not silently asserted to exist.
- The existing automatic go-around and short-final timing remain exercise policies; no professional ATC suitability or operational validation is claimed.

## Verification

`npm test`, `npm run build`, `npm run format:check` and `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`.

`src/workstation/model.test.ts` covers strip transitions, twenty clustered labels, no-clearance escalation/clearance, stop bars, spoken phrases, fixed-step chunking, invalid-state queries and hold/continue route preservation. `tests/overhaul.spec.ts` covers layout, UTC/day persistence, PTT indications/short presses/blur/busy/stuck guard and mocked browser speech confidence plus shared parsing. `tests/workstation.spec.ts` retains the instructor, recovery, migration, import/export and replay regression workflows, with selectors updated for the new equipment layout.

Mock recognition tests prove adapter behavior, not cloud recognition accuracy. The static build does not prove a deployment.
