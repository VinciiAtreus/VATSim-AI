# VATSIM AI

A WMKK controller-workstation development prototype for desktop browsers. Built with React, TypeScript, and Vite; configured for Vercel.

**Development status:** schematic airport geometry, simplified movement, scripted pilots. Not validated or approved for professional ATC training. No speech recognition, external AI, live VATSIM integration, or operational separation model is implemented.

## Run locally

Use Node.js 24 (minimum 22.12):

```sh
npm ci
npm run dev
```

Open the local URL shown by Vite. Choose an exercise, review the reference, and start the simulation. Select an aircraft to prepare context-specific instructions, select the matching transmit frequency, then transmit.

The **Departure fundamentals** exercise is the easiest complete workflow. See [its walkthrough](docs/EXERCISE_WMKK_02.md). The initial arrival in Morning movements remains at its scripted final setup until cleared to land or instructed to go around.

## Included

- Interactive schematic WMKK display with three runway pairs, selectable aircraft, taxi-route overlays, pan/zoom and layers.
- Flight strips, traffic filtering, radio selection and typed clearances.
- Departure, arrival, handoff, hold-short, line-up, go-around and stand-taxi states.
- Scripted pilot readbacks; optional browser-generated readback audio.
- Three exercises, instructor-controlled events and configurable occupied-runway guards.
- Event snapshots, historical inspection, session JSON export, pause/speed controls and background auto-pause.
- Responsive layout, keyboard shortcuts and modal keyboard focus handling.

Sessions currently live only in the current browser tab. Export before refreshing to retain a session. JSON export is an evidence format; importing and continuous audio/video playback are not implemented.

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

- [Product requirements and milestone gates](docs/PRODUCT_REQUIREMENTS.md)
- [WMKK source and validation register](docs/SOURCE_REGISTER.md)
- [Departure exercise and acceptance cases](docs/EXERCISE_WMKK_02.md)
- [Workstation layout and interaction contracts](docs/WORKSTATION_DESIGN.md)
- [Architecture and hosting](docs/ARCHITECTURE.md)

VATSIM AI is a working project name. This prototype makes no claim of affiliation with VATSIM, CAAM, Malaysia Airports, or TowerLine. All exercise flight identities and weather are fictional.
