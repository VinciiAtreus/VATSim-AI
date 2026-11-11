# VATSIM AI

Desktop-browser WMKK ATC simulator with chart-registered airport geometry, connected aircraft movement, typed or reviewed voice instructions, and continuous fictional arrivals/departures.

Start the simulation, control ground/tower traffic, and use Operations for airport events, pilot takeover, radio coordination and weather. Completed traffic slots replenish automatically; there is no lesson selection, objective, scoring or exercise-complete screen. Sessions are stored locally and can be exported, reviewed or restored paused.

The default continuous model has four concurrent traffic slots on the currently supported routes. It is not live VATSIM integration, a complete airport traffic model or an approved training device. [Simulation behavior, voice controls and compatibility](docs/CONTINUOUS_SIM.md). [Chart provenance and geometry limits](docs/WMKK_GEOMETRY.md).

## Development

Node 24.x. Existing GitHub/Vercel integration; browser-only, no backend or API keys.

```sh
npm ci
npm run dev
npm test
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
npm run format:check
```

Voice input creates a text draft and requires explicit transmit. Readback Settings let you choose and preview installed English voices; natural voices depend on the browser/OS and may use its network service. No audio is recorded.

Legacy session data and local lesson storage are retained for compatibility; course-authoring/scoring screens are no longer part of the simulator. Old schematic coordinates remain explicitly incompatible with the chart dataset and are exportable unchanged from the archive.
