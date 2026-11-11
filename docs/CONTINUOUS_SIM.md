# Continuous WMKK operations (0.6.0)

The owner replaced the exercise-first product direction with a continuous ATC simulator. The main interface no longer exposes lesson selection, workshop, objectives, scoring or manual assessment. It starts a WMKK operations session. The Operations panel retains airport obstructions, pilot takeover, radio control and coordination. Session review is an operational log rather than a competency score.

## Continuous traffic

The default simulation has four concurrent traffic slots, using the existing chart-connected B6/B8 departures to 32R, Q4 departure to 33, and B10 arrival from 32L. Completed departures replenish after 90 simulation seconds; completed arrivals and go-arounds replenish after 120 seconds. Each release receives a new callsign; generated arrivals include MAS and SIA. There is no exercise completion screen or target number of aircraft.

Simulation setup enables/disables automatic releases. Turning it off leaves current aircraft under controller control. Pause stops time, movement and release timers. Releases respect the existing slot/stand model; this is continuous fictional local traffic, not live VATSIM or an unrestricted airport traffic generator. All runway directions, aircraft types, real separation rules and airport-wide routing are not yet implemented. The existing geometry and aircraft-performance validation limitations still apply.

Each session records a registry of historical callsigns and their profile/release time. Current fleets and past snapshots decode against that registry independently, so replaced aircraft do not corrupt historical evidence. Current traffic remains bounded to four slots. The import registry is bounded to 10,000 identities; existing portable-file byte/event limits remain. Long-term institutional storage is not implemented.

Legacy records and local lesson data are not deleted. Recovery of an older exercise-based session creates a separate continuous-session copy, retaining the original stored record. Historical snapshots, radio and ratings stay intact. Legacy codecs and backend tests remain for record compatibility; lesson/workshop screens are removed from the simulator. Version 0.5.0/0.5.1 records using the current chart dataset remain readable. Incompatible schematic datasets retain their existing explicit rejection and original-envelope export.

## Map interaction

Map text and overlays are non-selectable during pan. Pointer dragging prevents native selection and clears an existing selection; capture loss ends the drag. The non-passive wheel listener on the map surface prevents page scrolling and zooms about the pointer, retaining the location beneath it. Buttons/focus/fit still work.

## Readback audio

Settings list installed English speech-synthesis voices and provide a sample preview. Automatic selection prefers voices advertised as Natural/Neural/Online/Premium, then suitable English variants. Voice preference is stored locally when storage is available. Browser voices can arrive asynchronously; the selector refreshes on voiceschanged.

Readbacks expand runway suffixes, numbered taxiways, stands and decimal frequencies into spoken aviation phrases. The default rate is 0.95×, adjustable. Pilot transmissions queue without cancelling one another; pause cancels queued audio. Preview explicitly replaces playback. No audio is recorded or new cloud TTS service/API key introduced.

Voice quality depends on browser/OS voices. Natural voices may require a network connection. No natural-voice availability or aviation speech accuracy is asserted from fixture tests; choose and preview the voice on the owner's Edge installation.

Validation: 116 unit tests, 30 Chromium browser tests, production build, formatting and diff checks passed. Browser tests verify non-selecting pan, wheel zoom, continuous-mode controls, installed-voice selection/preview, and record recovery. Fixture tests establish voice selection and phrasing, not real-device speech quality. Superseded lesson/workshop browser flows were replaced with simulation checks; legacy backend and codec coverage remains.

Starting a new simulation resets the readback event cursor and replay state. A dedicated browser regression sends readbacks in two successive simulations in the same tab, verifying that reused event IDs do not silence the second session. The four focused simulation browser checks passed after this fix.
