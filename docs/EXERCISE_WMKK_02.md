# WMKK–02: departure fundamentals — prototype exercise

Scenario version: 0.1. Dataset: `wmkk-schematic-0.1`. Status: development demonstration, awaiting instructor review.

## Objective

Demonstrate the clearance-state sequence for one departure from stand through pushback, ground taxi, hold short, transfer, line-up, and takeoff. This is not a validated WMKK lesson.

## Initial conditions

- Two fictional departures: MAS612 at B6 and MXD124 at B8.
- MAS612: B738, medium, destination WSSS, assigned runway 32R.
- Ground 121.650 and Tower 118.800 used as demonstration stations.
- Fictional weather: wind 320°/05 KT, QNH 1012.
- Exercise loaded paused; guards enabled; readback injection disabled.
- Diagram route A is illustrative; it is not an approved taxi route.

## Walkthrough

1. Select **Departure fundamentals** from the exercise library. Confirm reset if a session is in progress.
2. Start the exercise. Select MAS612 and transmit on 121.650:
   `MAS612, pushback approved`
3. Wait for pushback completion and the pilot's ready-to-taxi call.
4. Transmit:
   `MAS612, taxi runway 32R via A, hold short runway 32R`
5. Monitor the aircraft reaching its clearance limit. Time can be accelerated to 4×.
6. When holding short, transmit:
   `MAS612, contact Lumpur Tower 118.800`
7. Select 118.800. Transmit:
   `MAS612, runway 32R, line up and wait`
8. Wait for the aircraft to finish lining up, then transmit:
   `MAS612, runway 32R, cleared for takeoff`
9. Observe departure completion. Pause, open debrief, inspect the sequence, and export the JSON record.

Suggestions prepare text but never send it automatically. The text input is not speech recognition. Optional readback audio uses browser speech synthesis.

## Acceptance cases

| Case                          | Expected behaviour                                                            | Evidence                                         |
| ----------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| Taxi before pushback complete | Instruction not applied; aircraft remains in previous phase                   | Phase and instructor observation                 |
| Wrong frequency               | No response; aircraft unchanged                                               | Transmitted frequency and observation            |
| Unsupported route             | No inferred alternate route                                                   | Route and explicit rejection                     |
| Valid taxi                    | Movement stops at the modelled holding point                                  | Positions, hold state and pilot call             |
| Early transfer                | Transfer not applied until holding short                                      | Frequency and observation                        |
| Line-up                       | Aircraft moves to the runway entry, occupying runway                          | Position and phase transitions                   |
| Takeoff while still lining up | Instruction not applied                                                       | Observation and unchanged phase                  |
| Valid takeoff                 | Departure completes and runway flag clears                                    | Completion event                                 |
| Seeded wrong readback         | Assigned runway remains 32R; pilot says 32L; aircraft stops                   | Separate issued/readback records and discrepancy |
| Correction                    | Correct runway readback; original route resumes                               | Correction and subsequent phase                  |
| Obstructed runway, guards on  | Line-up/takeoff not applied                                                   | Training-guard observation                       |
| Obstructed runway, guards off | Clearance applied with critical conflict observation                          | Instructor intervention and applied clearance    |
| Replay                        | Historical aircraft and obstruction state shown without altering live session | Captured snapshot and disabled transmit controls |

## Limits

No validated aircraft dynamics, departure clearance, SID flight, wake/separation minima, controller coordination, TSAT/CTOT enforcement, or competency grading is included. Pilot reaction delays are not modelled. Resolve these against the intended lesson before professional evaluation.
