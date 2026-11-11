# VATSIM AI — development requirements

## Intended product

A desktop-browser WMKK controller-training platform, intended to progress toward professionally reviewed, instructor-led procedural exercises. The trainee controls ATC and simulated pilots operate aircraft. TowerLine screenshots supplied by the owner are workflow references only; no third-party code or assets are included.

The first release is a development prototype. It is not an approved training device, an operational tool, or a validated representation of WMKK procedures. Professional training suitability and any approval route must be established with the training organisation and CAAM. A 2D surface display does not establish suitability for full visual tower training. AI replacement of pseudo-pilots must not be assumed acceptable.

## Current implemented slice

- Three illustrative runway pairs and a deliberately schematic movement network.
- Four fictional exercise flights, with departure and arrival workflows.
- Selectable aircraft, flight strips, frequency selection, and typed transmissions.
- Structured command parsing, phase checks, route limits, and explicit readbacks.
- Continuous movement, hold-short endpoints, physical line-up movement, runway occupation state, handoffs, and scripted go-arounds.
- Arrivals progress down a schematic final approach. Landing clearance and runway occupancy are separate: occupancy begins at touchdown. An uncleared or obstructed arrival goes around at the exercise decision point. Approach movement and timing are demonstration values; actual performance and separation are not validated.
- Three selectable exercises; pause, resume, 1× / 2× / 4×; background-tab auto-pause.
- Instructor-triggered wrong-runway readback and runway obstruction.
- Guided guards or unguided recording of an occupied-runway clearance.
- Event snapshots, event-by-event inspection, session JSON export, optional browser-generated readback audio.
- Responsive browser workstation; same-browser instructor panel, not a separate multi-user station.

Pilots are scripted or human-operated through local takeover. Optional browser speech recognition prepares controller drafts for review; it never transmits automatically. There is no generative pilot AI, automatic competency scoring, server persistence service, user authentication, or live VATSIM connection. IndexedDB checkpoints recover paused after refresh. A local exercise library provides validated import and independent restored copies; exported JSON is the portable retention mechanism. Browser storage is not a professional records archive.

## First professional development objective

Complete an instructor-reviewed departure and arrival exercise on a versioned WMKK dataset, preserving the issued instruction, pilot interpretation, aircraft action, instructor intervention, and resulting evidence.

## Roles

| Role                   | Required capability                                             | Current status                                                                                       |
| ---------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Trainee                | Surface display, flight strips, radio, clearances, coordination | Local text/voice-draft workflow and exercise coordination implemented                                |
| Instructor             | Exercise control, observations, event injection, replay, rubric | Local controls, linked observations, manual draft criteria, replay and reports implemented           |
| Pseudo-pilot           | Override communications and aircraft actions                    | Local takeover, queued execution, radio and motion freeze implemented                                |
| Training administrator | Controlled lessons, releases, permissions, retained records     | Local versioned lesson library and portable reports; cloud roles/archives outside browser-only scope |

## Product requirements

1. Operational data is versioned separately from code with source, effective date, applicability, review status, and reviewer recorded.
2. Aircraft position, clearance, radio ownership, and pilot readback remain distinct state.
3. Ambiguity must not silently select an aircraft, runway, route, or frequency.
4. Unsupported inputs leave aircraft unchanged and produce an explicit observation.
5. Human operators can take over when AI or speech fails in the eventual multi-user version.
6. Instructor assistance is configurable and recorded with the session.
7. Replay uses captured outputs and states, never regenerated language-model responses.
8. Assessment criteria are defined by qualified instructors. AI advice is distinguishable from formal assessment.
9. Trainee visibility is limited to information appropriate to the simulated position and lesson.
10. Browser, device, network, recording, and recovery requirements are validated with the intended training organisation.

## Milestone gates

| Gate                       | Deliverable                                                                     | Evidence required to proceed                                                    |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A: intended use            | Training objectives, fidelity requirements, training partner, approval approach | Training lead accepts the supported tasks and limitations                       |
| B: WMKK dataset            | Reviewed geometry, movement restrictions, sectors, source register              | Expert review of selected routes, holding positions, responsibilities           |
| C: text workflows          | One complete departure and arrival                                              | Automated workflow tests and instructor walkthrough                             |
| D: voice/pilots            | Speech adapters, structured interpretation, operator override                   | Reviewed speech corpus, critical-field accuracy, latency and failure evaluation |
| E: instructor station      | Multi-user exercise control, recording and debrief                              | Instructor operates without developer intervention                              |
| F: mixed traffic           | Relevant separation, runway use, coordination, restrictions                     | Instructor-reviewed scenario suite                                              |
| G: professional evaluation | Supervised trials and discrepancy resolution                                    | Training partner accepts the specified use; required approvals obtained         |

This repository implements a schematic technical foundation for gate C. It does not claim gate A or B is complete. Gate B data replaces the demonstration graph before operational fidelity is evaluated.

## Decisions required before professional evaluation

- Intended course and competency objectives; supplemental practice versus training credit or assessment.
- Qualified Malaysian ATC subject-matter reviewer and training lead.
- Access to authorised local procedures, equipment/display conventions, and approved data sources.
- Supported runway configuration, ground sector, stands, routes, and aircraft types.
- Visual tower environment and hardware requirements for the intended training tasks.
- Audio/record retention, access controls, data location, and deployment requirements.
- Public product branding and any relationship with the existing VATSIM organisation.

## Release principle

Every training release locks its software commit, airport dataset, scenario version, aircraft models, and speech/AI configuration. A development count or automated observation is never presented as a competency score.

## Owner-selected consolidated browser scope

Version 0.4 combines lesson authoring, traffic scheduling, exercise weather, timed events, adjacent-station practice, browser voice drafts, manual instructor criteria, replay playback, printable/CSV exports, release provenance and source-readiness display. This is a single software release; it does not assert completion of the professional review gates. Accounts, shared sessions and server archives are excluded by the owner’s browser-only choice. See [the release walkthrough](RELEASE_0_4.md) for supported bounds and remaining external validation.
