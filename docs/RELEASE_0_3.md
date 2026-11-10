# Version 0.3 — instructor intervention and linked observations

## Review walkthrough

1. Start **Morning movements**. Select MAS612, open **Instructor**, and choose **Take over MAS612**.
2. Transmit `MAS612, pushback approved` in the controller box. The aircraft stays at stand. Its instruction appears in the pseudo-pilot station without a readback.
3. Choose **Execute & read back**. The engine checks the instruction against the current phase, frequency, and runway state, then starts pushback. The pilot readback is labelled **OPERATOR**. Controller transmission counts increase once; the applied count increases on execution.
4. Freeze aircraft motion. The session clock and other aircraft continue. The frozen aircraft keeps its phase, route, clearance and runway occupancy. Resume its motion when ready.
5. A new controller instruction replaces the previous unexecuted instruction with an explicit audit entry. **Unable / discard** removes the instruction without changing the aircraft's clearance and transmits an operator pilot response.
6. Send a custom pilot call. This is radio dialogue only: it never parses into a clearance or route. Calls use the selected aircraft's current frequency, independent of the trainee's transmit selector.
7. Return to scripted control. Any pending instruction is explicitly cancelled and frozen motion resumes. It is never silently executed.
8. Open the debrief and inspect an event, then choose **Annotate event**. Add an instructor observation with a review priority. It records both its own creation time and a link to the inspected event. Notes are not competency scores.
9. Filter the debrief by **Radio**, **Interventions**, or **Observations**. Selecting a note shows the linked event's original snapshot. Export/import and browser recovery preserve these links and pilot attribution.
10. Refresh with an instruction pending or an aircraft frozen. It should reopen paused in the same control mode. Resume the exercise before executing or sending pilot calls.

## Control boundaries

This is a same-browser instructor and pseudo-pilot station, without authenticated or separate network roles. Human control chooses when a supported instruction executes and supplies routine pilot dialogue. Aircraft motion still follows the schematic route model; there are no heading, altitude, speed, or geographic position overrides.

Routine automatic pilot reports become system **pilot report due** events during takeover. The instructor can voice them through the pilot call box. The existing automatic approach decision policy continues unless motion is frozen. Training guards still apply at execution; disabling them retains the existing unguided exercise behavior and conflict observations. Scripted readback-error injection is consumed only by a scripted pilot, not an instructor-controlled one.

Custom pilot dialogue does not create a parsed readback discrepancy. To train the existing automatic discrepancy workflow, return the aircraft to scripted control and arm the scripted wrong-runway readback.

All control changes, freezes, instruction executions, cancellations, and declines are recorded. Events identify a workstation role, not a verified person's identity. Arbitrary radio calls and observations are bounded to 1,000 characters; no audio is recorded.

## Saved records

App/engine `0.3.0`, session format `vatsim-ai.session.v3`, airport dataset `wmkk-schematic-0.1`.

Version 0.2 records migrate with their session IDs, history, aircraft motion and clearances preserved, and all aircraft set to scripted mode. Version 0.1 exports also retain the earlier moving-arrival migration. Existing checkpoints recover paused with a migration notice. Imported/restored records still fork under a separate session ID.

Validation covers event attribution, backward links to existing events, queued transmissions and their aircraft identity, control modes, snapshots, and the existing movement/counter checks. Portable import retains the 10 MB / 2,500-event limits; browser checkpoints retain the longer-history recovery path. No assessment authenticity or durable institutional archive is claimed.

## Fidelity status

Geometry, aircraft motion, route choices, and runway decision policies remain illustrative and unverified. This release introduces instructor workflow; it does not establish CAAM compliance or approval for professional training. No voice recognition, LLM pilots, live VATSIM connection, multiuser backend, or recorded audio is included.
