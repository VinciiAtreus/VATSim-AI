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

## Workstation overhaul

The equipment layout adds paper strip bays, a final approach view, runway occupancy and stop-bar indications, and Day/Night modes. The dashed Simulator corner contains run/pause, speed, setup and saved sessions. **P** runs/pauses; Space no longer pauses.

The **Dictate** button retains the reviewed-draft workflow. Select **Voice PTT** in the Push to talk panel (or enable **Browser speech recognition** in Settings), choose an English speech language, then hold Right Ctrl (Right Option on macOS), speak, and release. Browser speech may process audio online; microphone permission alone does not enable Voice PTT or guarantee speech-service availability. Say callsign digits separately, for example “Malaysian one one three four”. Active callsigns and ATC phrases are supplied as contextual hints only when the browser exposes that API; Edge support varies. Recognition alternatives can be copied into an editable draft and never apply automatically. Capture status and persistent service errors appear in the PTT panel. **Typed PTT** sends text explicitly entered in the R/T log. Bindings and optional latching PTT are configurable. See [implementation and remaining acceptance work](docs/OVERHAUL_IMPLEMENTATION.md).
