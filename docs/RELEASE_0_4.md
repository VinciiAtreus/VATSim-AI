# Version 0.4 — consolidated browser release

This release combines the remaining agreed browser workflows into one review branch. The owner explicitly chose browser-only operation. It needs no accounts, backend, API keys, paid service, or new dependency.

## Included workflows

| Workflow                      | Implementation                                                                                                                              | Boundary                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Lesson authoring              | Local library, revisions, objectives, traffic selection/callsigns/release times, weather, timed events, criteria, lesson JSON import/export | Four existing aircraft/stand/runway profiles; no arbitrary airport geometry                           |
| Mixed traffic exercises       | Scheduled entry of the modelled departures and arrival; individual release times                                                            | Existing schematic dynamics and occupancy model                                                       |
| Weather / information         | Initial lesson weather and recorded instructor updates; historical replay values and pilot information identifiers                          | Briefing/display values only; no wind, visibility, aerodynamics, or runway-selection model            |
| Timed instructor events       | Place/clear obstruction, arm wrong readback, ordered by exercise time; fired state survives recovery                                        | One blocked runway at a time; a new obstruction replaces the previous one                             |
| Adjacent station coordination | Request acceptance, scripted or manual decision, optional transfer prerequisite, separate radio handoff                                     | Exercise coordination workflow; no operational WMKK agreement or release procedure asserted           |
| Voice draft input             | Optional browser speech recognition, explicit microphone start/stop, draft review, separate transmit action, text fallback                  | Browser support/service dependent; not an LLM, an offline promise, or a validated aviation recognizer |
| Pseudo-pilot fallback         | Existing instructor takeover, instruction execution/decline, radio calls, freeze/resume                                                     | Same browser; no authenticated role separation                                                        |
| Manual assessment             | Lesson-version criteria, self-entered reviewer, rating, rationale, evidence link, revised ratings retained in history                       | Draft instructor criteria, unauthenticated entries; no automated score or competency certification    |
| Replay playback               | Captured snapshots played at 1/2/4 events per second, seek, pause, return to paused live session                                            | Event playback, not continuous position interpolation or recorded audio                               |
| Portable records              | Full session JSON, printable standalone HTML report, radio CSV, lesson JSON                                                                 | Local downloads; not a managed archive                                                                |
| Release / source readiness    | Visible software, build commit, dataset and lesson revision, source links and outstanding review status                                     | References are not claimed current, reconciled or approved                                            |

## Review walkthrough

1. Choose **Create a lesson**. Edit its objective, weather and traffic. Callsigns must have three letters and one to four digits. Each of the four profiles can appear once. Release times are 0–3,600 exercise seconds.
2. Add a timed obstruction on 32L at 15 seconds and a clear event at 30 seconds. Add a later incorrect-readback event if desired. Events are applied on the first running integration step at or after their scheduled time, including time-zero events.
3. Enable required coordination and select whether the adjacent station is scripted. Save the lesson, then run it. Loading a replacement exercise requires confirmation once the current exercise has started. Authoring pauses a running exercise.
4. Refresh: the exact running lesson revision and timed-event progress recover paused. Edit and save the library lesson under a later revision; the active session keeps its own definition.
5. Taxi a departure to holding short. Request adjacent-station acceptance from its inspector. A scripted station accepts after eight exercise seconds; paused time does not count. For manual mode use the Instructor desk. Decline permits a new request. Acceptance alone never changes radio frequency.
6. Try transferring without acceptance when the lesson requires it. The instruction must be held. After acceptance, issue the radio transfer on the current aircraft frequency.
7. Select the microphone to dictate. Browser permission/service may be required and audio may be processed by the browser's recognition provider. Stop capture and inspect the draft before transmitting. Pause, replay, a dialog, backgrounding, unmount, or the 30-second capture limit cancels recognition. Late results after cancellation are ignored. No audio is recorded by this app.
8. From debrief open **Manual assessment**. Enter a reviewer name, criterion, rating, evidence event and rationale. Revise a rating: the current result changes while previous entries remain in event history. These are development judgements, not competency scores.
9. Play the recorded event snapshots. Weather and coordination reflect each snapshot. Commands remain disabled and returning to live leaves the simulation paused.
10. Export a printable report and radio CSV. The HTML file contains no external assets, escapes author text, and can be printed using the browser. CSV cells are quoted and formula-like input is neutralised for spreadsheets.
11. Open **Workstation & data** to see the release and source-readiness information. Vercel builds embed the commit from `VERCEL_GIT_COMMIT_SHA`; local builds are labelled `local-development`.

## Persistence and migration

App/engine `0.4.0`, session format `vatsim-ai.session.v4`, lesson format `vatsim-ai.exercise.v1`, airport dataset `wmkk-schematic-0.1`.

Version 0.1/0.2/0.3 sessions migrate paused. Version 0.3 preserves operator modes, frozen aircraft, queued instructions, attribution, and linked observations; it does not reset them to scripted mode. Earlier versions receive appropriate defaults and retain their prior moving-arrival migration. Import/restoration still forks a separate session ID.

A session embeds its lesson definition, weather, scheduled-event progress, coordination and manual assessments. Snapshots include weather and coordination. Import validates references, traffic release state, criterion identities, timestamps and request history alongside existing engine checks. Portable session limits remain 10 MB / 2,500 events; browser checkpoints retain long-history recovery. Lesson files are limited to 128 KB, 20 timed events, 12 criteria, and the four supported traffic profiles.

The lesson library uses browser local storage, separately from IndexedDB session checkpoints, with a 30-lesson limit. Failed reads preserve existing raw data and prevent overwriting it. Storage failure leaves unsaved lesson execution and JSON export available. Browser/site storage scope, eviction, deletion and simultaneous-tab limits still apply. Neither store is a professional records archive.

## Remaining external work

The browser software workflows do not complete the professional validation gates. Reviewed georeferenced WMKK geometry, authorised local procedures, separation/wake and aircraft-performance models, instructional objectives and criteria, speech-corpus evaluation, required visual environment, supervised trials and any CAAM approval remain separate work with qualified reviewers and the training organisation.

Cloud authentication, shared multiuser sessions, durable institutional records, externally hosted speech/LLM services and audio recording are outside this owner-selected browser-only release. Pilots continue to be scripted or human-operated; no generative pilot AI or live VATSIM integration is claimed.
