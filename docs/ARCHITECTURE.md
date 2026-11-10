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
- `src/sim/sessionCodec.ts`: bounded JSON validation and version 0.1/0.2 migration.
- `src/storage/sessionStore.ts`: transactional IndexedDB checkpoints.
- `src/hooks/useSession.ts`: startup recovery, serialized saves, storage status and save retry.
- `src/components/SessionLibrary.tsx`: checkpoint library and import controls.
- `src/App.tsx`: local session orchestration, controller/instructor UI, dialogs and export/import.

The browser timer advances the clock in small steps while running; a background tab automatically pauses the exercise. Movement values are display-space demonstration values, not physical performance models. A final approach progresses at 1.5 schematic units/second. The exercise decision point is 25 units before the runway threshold; absent clearance or an occupied runway causes a recorded automatic go-around. A cleared aircraft occupies the runway only at touchdown. Integration uses substeps no larger than one simulated second to avoid skipping transitions under acceleration. These are exercise model values, not published minima or validated aircraft dynamics.

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

## Local continuity contract (version 0.2)

Recorded events and pauses trigger autosave; movement is checkpointed approximately every three seconds. Writes are serialized, and only a committed IndexedDB transaction marks a checkpoint saved. Startup tries newest records first, preserves unreadable records, and recovers the newest compatible checkpoint paused. Storage failure is visible and leaves training/export available. Closing a tab during a write can lose changes since the last committed checkpoint. No server or cross-device persistence is claimed. Concurrent editing of the same recovered exercise in multiple tabs is not supported.

Manual restore/import validates the record before replacement, checkpoints the current exercise when storage is available, and forks the restored record under a fresh ID. Original checkpoints remain. Portable file import limits: 10 MB, 2,500 events, known dataset/scenario/engine version, finite movement values, valid radio/runway/phase data, consistent counters, ordered event IDs/times, and valid historical snapshots. Version 0.1 airborne landing states are migrated to the version 0.2 approach model; historical facts are retained. Record structure is validated; authenticity is not established.

Current export format: `vatsim-ai.session.v3`, engine `0.3.0`, dataset `wmkk-schematic-0.1`. No recorded audio, database authentication, or formal assessment evidence is provided.

Browser checkpoint recovery and library restoration validate the same structure without the portable file-import history cap, so an exercise exceeding 2,500 events remains recoverable. The transmission engine rejects inputs exceeding 1,000 characters before recording their contents; a bounded instructor observation records the rejection.

## Instructor control contract (version 0.3)

Each aircraft records its pilot mode, individual motion freeze, and optional queued controller instruction. Scripted mode applies supported instructions immediately. Operator mode queues them against the original controller event; execution revalidates current phase, frequency, and occupancy without recording a second trainee transmission. Decline, replacement, takeover, release, freeze, and execution are audited. Returning to scripted mode cancels a pending instruction and releases a freeze. Custom pilot calls are bounded radio-only events. Routine scripted reports become system report-due events during takeover; the approach decision policy continues for moving aircraft.

Pilot events include scripted/operator attribution. Instructor observations are separate note events linked to an earlier non-note event, with creation time retained separately from the target's timestamp. Replay follows that link to its historical snapshot. The codec checks these references and queued transmission identity, including historical snapshots. Version 0.2 checkpoints retain their IDs and gain scripted defaults. Version 0.1 uses the existing approach migration as well.

`PilotStation.tsx` and `ObservationEditor.tsx` provide the local instructor controls. These are workstation roles, without authentication or multiuser isolation. See [release 0.3](RELEASE_0_3.md) for limitations and a review walkthrough.
