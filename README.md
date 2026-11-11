# VATSIM AI

A WMKK controller-workstation development prototype for desktop browsers. Built with React, TypeScript, and Vite; configured for Vercel.

**Development status:** schematic airport geometry, simplified movement, scripted pilots. Not validated or approved for professional ATC training. Optional Chrome browser speech recognition feeds the shared controller parser. No external pilot AI, live VATSIM integration, or operational separation model is implemented.

## Workstation overhaul

The position uses proximity-ordered paper flight strips, a schematic surface display, final approach view, runway/stop-bar status and independent TX/RX controls. Switch Day/Night from the top bar. The dashed **Simulator** corner contains Run/Pause, speed, reset, files and exercise selection.

**PTT:** hold Right Ctrl (Right Option on macOS), then release to send. By default this sends the text explicitly entered in the R/T log. Enable **Browser speech recognition** in workstation settings to speak instead; Chrome may process speech in the cloud and will request microphone permission. Keyboard, mouse 4/5 and gamepad bindings can be captured in settings. Latching PTT and phrase-only practice are optional. PTT is disabled while paused; use **P** to run/pause. Space no longer pauses.

See [implementation status and remaining acceptance work](docs/OVERHAUL_IMPLEMENTATION.md) for the delivered scope, data choices and test coverage. Full seeded replay, physical taxi routing/conflicts and radio-filtered audio remain future engine work.

## Instructor workflow

Take over an aircraft from the Instructor tab to execute or decline queued controller instructions, transmit manual pilot calls, and freeze individual aircraft motion. Operator actions and radio attribution persist in the session history. Add event-linked observations while inspecting replay, then use debrief filters to review radio, interventions, and observations. See the [version 0.3 walkthrough](docs/RELEASE_0_3.md) for the control boundaries.

## Run locally

Use Node.js 24:

```sh
npm ci
npm run dev
```

Open the local URL shown by Vite. Choose an exercise, review the reference, and start the simulation. Select an aircraft to prepare context-specific instructions, select the matching transmit frequency, then transmit.

The **Departure fundamentals** exercise is the easiest complete workflow. See [its walkthrough](docs/EXERCISE_WMKK_02.md). In **Morning movements**, MAS1134 progresses down final. Issue landing clearance before the exercise decision point (about 73 simulated seconds from the initial setup), or the scripted pilot goes around. This timing is an exercise policy, not a published WMKK minimum.

## Included

- Interactive schematic WMKK display with three runway pairs, selectable aircraft, taxi-route overlays, pan/zoom and layers.
- Flight strips, traffic filtering, radio selection and typed clearances.
- Departure, arrival, handoff, hold-short, line-up, go-around and stand-taxi states.
- Scripted pilot readbacks; optional browser-generated readback audio.
- Moving arrivals, one short-final reminder, touchdown-specific occupancy, and automatic exercise-policy go-arounds.
- Local autosave, paused recovery, saved-exercise library, and validated JSON import.
- Three exercises, instructor-controlled events and configurable occupied-runway guards.
- Event snapshots, historical inspection, session JSON export, pause/speed controls and background auto-pause.
- Responsive layout, keyboard shortcuts and modal keyboard focus handling.

Exercises are automatically checkpointed in IndexedDB after recorded events and approximately every three seconds during movement. Refreshing restores the latest readable checkpoint **paused**. Open **Saved exercises** from the folder icon to save, export, import, or restore a separate paused copy. Browser storage is scoped to the current browser and site address; it is not server-backed or guaranteed archival storage. Clearing site data removes checkpoints. Export JSON for an independent copy.

Import supports version 0.3 records and migrates version 0.1/0.2 exports, with an explicit model-change notice. Files are limited to 10 MB and 2,500 events; incompatible or malformed records are rejected before changing the exercise. Records are not authenticated assessment evidence. Continuous replay playback and audio recording are not implemented.

## Verify

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

To use an installed Chromium browser instead of a Playwright-managed download:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

CI installs the browser and runs engine tests, production build, and browser tests.

## Deploy to Vercel

Import this repository (or use the existing Git integration) with **Vite** as the framework. Keep the root directory at the repository root, build with `npm run build`, and serve `dist`. Select Node.js 24.x. No environment variables are needed. The repository includes `vercel.json`.

Review a branch preview before merging to the production branch. An actual Vercel deployment is verified only when Vercel reports a successful deployment; a local production build is not evidence of deployment.

## Project documents

- [Version 0.3 instructor workflow and review walkthrough](docs/RELEASE_0_3.md)
- [Version 0.2 changes and review walkthrough](docs/RELEASE_0_2.md)
- [Product requirements and milestone gates](docs/PRODUCT_REQUIREMENTS.md)
- [WMKK source and validation register](docs/SOURCE_REGISTER.md)
- [Departure exercise and acceptance cases](docs/EXERCISE_WMKK_02.md)
- [Workstation layout and interaction contracts](docs/WORKSTATION_DESIGN.md)
- [Architecture and hosting](docs/ARCHITECTURE.md)

VATSIM AI is a working project name. This prototype makes no claim of affiliation with VATSIM, CAAM, Malaysia Airports, or TowerLine. All exercise flight identities and weather are fictional.
