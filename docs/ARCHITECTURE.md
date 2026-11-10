# Architecture and Vercel deployment

## Current slice

```text
React workstation
    │ typed transmission + selected frequency
    ▼
Structured parser ──► phase/frequency/route checks
    │
    ▼
Session engine ──► aircraft state + scripted readback + event snapshot
    │
    ├── SVG airport display
    ├── flight strips / radio / instructor observations
    └── event review / JSON export
```

- `src/sim/types.ts`: explicit aircraft, command, session and event contracts.
- `src/sim/airport.ts`: versioned illustrative data, radio list and scenario catalogue.
- `src/sim/parser.ts`: constrained grammar; unknown or conflicting instructions are not guessed.
- `src/sim/engine.ts`: immutable session updates, motion along routes, radio ownership, scripted readbacks, instructor events, and historical snapshots.
- `src/components/AirportMap.tsx`: display geometry, layers, route overlay, pan/zoom and selection.
- `src/App.tsx`: local session orchestration, controller/instructor UI, dialogs and export.

The browser timer advances the clock in small steps while running; a background tab automatically pauses the exercise. Movement values are display-space demonstration values, not physical performance models. The approach aircraft is held at its scripted final setup until a supported instruction is applied.

Event snapshots are deep copied. A replay snapshot includes aircraft state and runway obstruction state; it does not regenerate pilot dialogue. Event inspection pauses the live session, disables clearance transmission, and displays historical aircraft details.

## Current deployment

Vercel serves a static Vite build. No environment variables, secret keys, database, or backend are required for this slice.

| Vercel setting   | Value           |
| ---------------- | --------------- |
| Framework preset | Vite            |
| Root directory   | Repository root |
| Install command  | `npm ci`        |
| Build command    | `npm run build` |
| Output directory | `dist`          |
| Node.js          | 24.x            |

`vercel.json` declares the build and basic response headers. Microphone access is disabled because speech input is not implemented. Update the policy deliberately when adding voice input. Branch previews should be reviewed before production promotion. Hosting access controls remain the owner's Vercel project responsibility; this app does not implement authentication.

## Next architecture stages

1. Replace illustrative geometry and rules through the reviewed data pipeline.
2. Extract a session adapter so local updates and network updates share a contract.
3. Introduce authenticated trainee/instructor/operator roles, authoritative session state, command ordering, reconnect handling, and durable events.
4. Add speech services behind a server-side adapter; keep credentials out of client bundles.
5. Evaluate realtime hosting against the then-current Vercel runtime limits and required session duration. Do not assume in-memory function state is durable or shared across instances. Use durable storage and a session ownership/coordination design.
6. Record audio, speech interpretation, model/provider versions, intervention history, and scenario/data versions under the training organisation's retention rules.
7. Add validated performance and separation models only for reviewed training requirements.

AI or speech-provider failure must leave an explainable session state and permit human pseudo-pilot takeover. Captured model outputs, not model calls, drive replay. Professional suitability must be assessed separately from functional software testing.
