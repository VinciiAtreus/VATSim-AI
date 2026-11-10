# Version 0.2 — session continuity and moving arrivals

## Review workflow

1. Open **Morning movements** and start the exercise. Select MAS1134 to see the decision countdown.
2. Leave it uncleared, or switch to 118.500 and issue its landing clearance. At 4× the initial decision window is approximately 18 real seconds.
3. An uncleared arrival calls short final once and goes around at the exercise decision point. A cleared arrival stays on final, occupies the runway at touchdown, then vacates. An obstruction on its runway also causes a recorded automatic go-around.
4. Instructor controls now select 32R, 32L, or 33 for the obstruction event. Guards still control whether an unsafe clearance is initially applied; the arrival pilot's decision-point policy remains active.
5. Issue a departure instruction and wait for **Saved locally**. Refresh: the exercise should return paused with its clearances and event history retained.
6. Open **Saved exercises** (folder icon). Export a JSON file, import it, inspect the confirmation, and restore. The original checkpoint remains; the restored copy gets a new session ID.
7. Invalid JSON, incompatible data/models, invalid snapshots, or inconsistent counters must show an error and leave the current exercise unchanged.

## Model and record versions

- App/engine: `0.2.0`.
- Session format: `vatsim-ai.session.v2`.
- Airport data: `wmkk-schematic-0.1` (still illustrative and unverified).
- Version 0.1 JSON exports are migrated with an explicit notice that moving-arrival behaviour applies on resume. Historical snapshots are retained.

## Persistence boundaries

Checkpoints use IndexedDB on the current website origin. The latest compatible record is recovered paused; unreadable records remain stored. Changes since the last committed checkpoint can be lost if the tab closes during a save. Storage errors remain visible and the user can continue training and export JSON. Browser data clearing, another browser/device, or another preview domain does not share the checkpoint library. No records are silently pruned.

File import is bounded to 10 MB and 2,500 events. This file-ingestion limit is not applied to browser checkpoint recovery or restoration. Typed transmissions over 1,000 characters are rejected without recording the oversized payload, so they cannot invalidate a checkpoint. Structural validation does not authenticate a record or make it assessment evidence. Export independent copies when retention matters. Editing the same recovered session in multiple tabs is not supported in this local prototype.

## Remaining fidelity work

The approach path, displayed speeds, decision-point timing, roll-out and occupancy model are schematic exercise values, not CAAM minima or validated aircraft dynamics. No georeferenced airport data, operational separation model, out-the-window visual system, live speech recognition, external AI service, human pseudo-pilot override, multi-user session server, or professional training approval is included.
