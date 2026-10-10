# ADR-010: XR World Formation

## Status

Accepted; implemented on the `/xr/` host. Physical Quest 3 acceptance pending.

## Date

2026-10-09

## Context

The `/xr/` rhythm game (ADR-009) plays a song against a dark stage with an optional Wormhole
backdrop. World Formation turns the song into an evolving science-fiction environment that the
player builds and stabilizes through the existing rhythm gameplay: an industrial performance hall
(Localhost) is activated, autonomous construction units (Seeder) assemble infrastructure, the
infrastructure is reinterpreted as an information network (Tudatter: ordered "Max" lattice and
organic "Egis" flow), and a distant anomaly (Fenom) is revealed and stabilized at a musically
suitable climax.

Two responsibilities must stay separate: **music decides how the world evolves; the player's
accepted hits and misses decide how well it evolves.** Neither may own a second clock, a second
judge or a second score.

## Decision

### Ownership

| Concern | Owner | Notes |
| --- | --- | --- |
| Musical evidence, timing | `src/analyzer/` (unchanged) | Sections, cues, timing confidence |
| Musical narrative | `src/automation/` (unchanged) | Plan point `meta`: situation, gesture, arc role |
| World Plan (authored) | `src/gameplay/WorldDirector.ts` | Pure, deterministic, built once per chart |
| World contracts | `src/gameplay/WorldTypes.ts` | Plain JSON-serializable data |
| Player world state | `src/gameplay/WorldInteractionSession.ts` | Pure; fed only by `RhythmGameSession` |
| Current objective text | `src/gameplay/WorldObjectives.ts` | Pure function of plan, snapshot, song time |
| Judge, score, note states | `RhythmGameSession` (unchanged rules) | Gains an optional resolution observer |
| 3D presentation | `src/xr/scene/XrWorld*.ts`, `XrNoteHalos.ts` | Three.js; never decides outcomes |
| Composition | `XrAppController` | Builds the plan, wires observer, routes setting |
| Song clock | `AudioEngine.getCurrentTime()` | The only clock; world reads the controller's per-frame song time |

`src/gameplay/` stays free of Three.js, DOM, AudioEngine and `State` (guarded by
`tests/gameplay-purity.test.mjs`). The world modules live flat in `src/gameplay/` with a `World`
prefix, matching the `Rhythm*` convention.

### Data flow

```
TrackAnalysis (sections, cues, timing) --+
Automation plan (meta)  -----------------+--> buildWorldPlan() --> WorldPlan (frozen, JSON)
Accepted chart (RhythmNote[]) -----------+                              |
                                                                        v
RhythmGameSession --(observer: run reset, note resolved)--> WorldInteractionSession
                                                                        |
                                              WorldInteractionSnapshot (frozen, reused)
                                                                        v
                     XrWorld / XrNoteHalos / XrWorldStatus (song time + snapshot -> GPU uniforms)
```

### State categories

- **Authored World Plan** (`WorldPlan`): eras and phases with a target visual character mix,
  structure slots with authored build windows, bounded timeline events, the special-note role
  sidecar (by note id) and the optional Fenom encounter. Identical inputs give byte-identical
  JSON. Built after every chart build (load or regeneration), never per frame.
- **Player interaction state** (`WorldInteractionSession`): per-structure contribution
  quality, energized/faulted structures, role outcomes, coherence, encounter tallies and a
  bounded reaction log. Event application is idempotent per note id per run.
- **Render presentation state**: interpolation, GPU buffers, instance attributes. Rebuilt from
  the plan and the snapshot; it never feeds back.

### The resolution observer

`RhythmGameSession.setResolutionObserver(observer | null)` reports exactly what the session
already decides:

- `onRunReset()` whenever runtime state is reset (load, start, restart, seek, config swap, clear);
- `onNoteResolved(note, index, grade | null, songTime, skipped)` for every hit, every miss found by
  `update`, every pending note missed by `finish`, and every note skipped by `seek` (`skipped`).

Desktop and headset strikes reach the session through the same `attemptStrike`, so world
progress is identical for both inputs. The observer cannot change judging, timing or score.

### Rules of the World

- **Eras** (macro form): Localhost activation -> Seeder construction -> Tudatter information
  network -> Fenom encounter (optional) -> Resolution. Era starts come from analyzer sections and
  the first published onset, with conservative fractions of the duration as fallbacks. The world
  settles in a published outro (after the encounter has resolved); otherwise only over the last
  seconds, and a song ending on a peak ends in the network era rather than a forced calm. A phase's
  visual character is a mix of five channels (industry, construction, lattice, flow, anomaly) that
  the runtime crossfades over a bounded transition; the world morphs, it is never replaced.
- **Structures**: 41 fixed slots (12 pylons, 12 conduits, 6 ribs, 8 lattice nodes, 3 rings). Four
  pylons exist dim at the start. Every other slot has an authored build window placed along the
  energy-weighted song progression inside its era, so the world always forms. Notes between two
  consecutive build ends contribute to that structure: quality = (2 x 0.6 + sum of note credit) /
  (2 + resolved notes), credit perfect 1, good 0.75, miss 0. A structure without notes stays at
  the neutral 0.6.
- **Special roles** (sidecar by note id, never altering a note): `energy` (strongest eligible note
  of a structure window, construction eras), `signal` (lattice nodes, information era), `sync`
  (encounter anchors) and `stabilize` (the encounter's lock note). Eligible notes are unpaired,
  at least 1.5 s apart; at most 48 roles. Hitting an energy note completes its structure early
  (bounded local speed-up); missing one marks a fault.
- **Coherence**: an order-of-resolution moving value (perfect 1, good 0.8, miss 0, rate 0.12)
  from 0.5 at every run reset; skipped notes do not move it.
- **Fenom encounter**: chosen from drop/peak sections that start after 35% of the song and after
  the construction era, last at least 12 s and hold at least 8 notes; score = 0.5 energy + 0.3
  position + 0.1 preceding build + 0.1 returning peak (after a reflective section) + 0.1 the
  automation's climax role, so a returning drop lets the network form first. Detection spans up to 8 s before it;
  synchronization spans the peak (at most 40 s) with 3-8 sync anchors and one stabilize note;
  resolution lasts up to 8 s. Without a candidate the encounter is absent and the anomaly stays
  dormant; a world outcome is still produced.
- **Outcome**: formation (mean structure quality), coherence and, with an encounter, field
  stability = 0.5 x anchor hit share + 0.3 x accuracy inside the sync window + 0.2 x stabilize
  hit. Classes: Stabilized >= 0.75, Contained >= 0.4, otherwise Unstable; without an encounter
  World formed / Partially formed / Fragmented on formation x coherence.
- **Events** (at most 64): activation, era transitions, surges at drop/peak starts (seeded
  variant, never the same twice in a row), drone scans at high-confidence impact cues (at most one
  per 8 s; confidence >= 0.75 when timing is weak) and the encounter's reveal/sync/resolve. No
  event is beat-snapped or invented without a section or cue.

### Presentation

- Stage-root space (follows the viewer placement like the runway). A readability volume stays
  empty: |x| < 4.3 m and y < 4.6 m nearer than 21 m, y < 3.6 m beyond (the runway bends at most
  2.4 m sideways). The Fenom sits above the targets' spawn area (centre y 11 m, z -34 m, inside
  the camera's 50 m far plane and in front of the 40 m Wormhole plane).
- Motion is a pure function of song time (pause freezes, seek lands exactly). Structure rise,
  scaffold-to-solid, pulses, seeder loops and flow particles run in vertex/fragment shaders from
  per-instance attributes written once per plan; player state rewrites one small state attribute
  per changed snapshot. Drones (at most 12) are placed on the CPU.
- Special notes keep their hand colour, cut and size; a separate instanced halo marks the role and
  bursts at the hit point. A small status plate by the score HUD (under the side HUD of the Tall
  space, above the HUD over the runway so it never meets the start frame's caption) names the era,
  formation, coherence and the current objective; the results screen adds one world line.
- Drones patrol, scan at confident cues, form a ring on a surge, gather around the anomaly during
  the encounter, and one drone flies to each structure an energy, signal or sync hit activates.
  The Localhost sound-panel walls dematerialize from the top as the lattice character rises,
  opening the hall to the distance (never below a quarter of their height).
- Setting **World** (Gameplay tab, presentation scope, persisted): Off / Reduced / Full (default
  Full). Off hides every world draw and the world UI; the interaction session keeps running (pure,
  negligible) so switching on mid-song shows the true state. Reduced halves the mobile units and
  flow particles.

### Lifecycle

| Event | World behaviour |
| --- | --- |
| Load / file replacement | plan cleared with the chart; rebuilt after analysis |
| Chart regeneration | new plan; session reset through the observer |
| Start / restart | observer run reset; authored visuals follow song time 0 |
| Pause / resume | frozen (song time); no state change |
| Seek | run reset, skipped notes recorded as skipped misses (no reward, no coherence change) |
| Natural end | remaining notes missed through `finish`; outcome final |
| XR interruption / tracking loss | the controller pauses; world frozen |
| Re-entry / reference reset | world follows the stage root placement |
| Dispose | every world geometry, material, texture disposed with the scene |

## Consequences

- One new optional observer on `RhythmGameSession`; the chart, judge, score and the default chart
  golden fixture are unchanged.
- At most 10 world draws plus the halo draw and the status plate when World is on (none when off),
  about 7k triangles, static instance data, per-frame uniform writes plus at most 12 drone matrices
  (768 B), and a 2.3 KB state upload per snapshot change. Desktop measurements are in the tracker;
  Quest numbers are pending.
- The narrative content is a game adaptation of the Phenom World concepts; no characters,
  dialogue or story claims are introduced.

See the [implementation tracker](../audits/xr-world-formation-plan.md).
