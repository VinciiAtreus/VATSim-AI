# Workstation design — first slice

The implementation is the interactive wireframe. This diagram records the panel responsibilities for review.

```text
┌────┬─────────────────────────────────────────────────────────────────────────┐
│    │ VATSIM AI                 environment / reference / readback audio       │
│ N  ├─────────────────────────────────────────────────────────────────────────┤
│ A  │ WMKK / position           exercise selector       clock / pause / speed │
│ V  ├─────────────────┬───────────────────────────────────┬───────────────────┤
│    │ FLIGHT STRIPS   │ SURFACE DISPLAY                   │ AIRCRAFT          │
│    │                 │                                   │                   │
│    │ Search / filter │ Weather / runway pairs            │ Current phase     │
│    │ Callsign / type │ Terminals / taxiways / stands      │ Runway / stand    │
│    │ Intent / stand  │ Aircraft / selected route          │ Radio / clearance │
│    │ Phase / radio   │ Clearance limit / obstruction      │ Prepare command   │
│    │ Pending calls   │ Pan / zoom / layers                │                   │
│    │                 ├───────────────────────────────────┤ INSTRUCTOR TAB    │
│    │ Objective       │ RADIO                             │ Guards / events   │
│    │ Data status     │ Transcript / frequency / text     │ Observations      │
│    ├─────────────────┴───────────────────────────────────┴───────────────────┤
│    │ Exercise status / aircraft / pending calls                 export       │
└────┴─────────────────────────────────────────────────────────────────────────┘
```

## Interaction contracts

- Selecting a strip or map marker changes the aircraft inspector; it does not change frequency automatically.
- A station mismatch exposes a deliberate switch-frequency action.
- Suggested transmissions fill the input. Sending is a separate, deliberate action.
- Start/resume is separate from issuing commands. Text entry is not described as speech input.
- The current prototype's instructor shares a browser session with the trainee; multi-user isolation is a future requirement.
- Guard and event changes are recorded in history.
- Scenario changes confirm reset if a session has started; the owner can export first.
- Replay pauses the simulation and shows historical state; commands are disabled until returning to live.
- A session is not a persisted record until exported. The UI and README state this limitation.

## Responsive behaviour

Desktop: three working columns with a navigation rail. Smaller desktop: compact panels with independently scrollable strips and inspector. Tablet: traffic and map first, inspector below. Mobile: horizontally scrollable flight strips followed by map, communications and inspector. Professional evaluation remains desktop-targeted.

## Training-interface review required

Confirm display conventions, information available to each controller position, strips, coordination equipment, alert policies, source visibility, assistance settings, legibility targets, keyboard/foot-switch/headset needs, and requirements for an out-the-window visual environment with the training organisation. This visual design is not represented as a replica of an operational WMKK console.
