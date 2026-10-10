# XR World Formation: implementation tracker

Design and decisions: [ADR-010](../adr/ADR-010-xr-world-formation.md). Branch:
`claude/xr-world-formation` (not committed or pushed without approval).

## Baseline (before any change, clean master 29371e4)

`npm test`: 1258 tests, 1249 pass, **9 fail** -- all pre-existing and outside XR/gameplay:
`wormhole-clip-profile` (4), `wormhole-geometry-lfo-integration` (1),
`wormhole-preset-differentiation` (2), `wormhole-projected-motion` (2). They concern Wormhole
preset JSON assets and are not touched by this work.

## Tasks

| Task | Status | Acceptance | Evidence |
| --- | --- | --- | --- |
| T00 Architecture audit | done | every subsystem has one owner and boundary | ADR-010 ownership table, lifecycle table |
| T01 World Plan contracts | done | deterministic fixtures, safe normalization, empty fallbacks | `src/gameplay/WorldTypes.ts`, `WorldTimeline.ts`; `xr-world-plan` (empty/hostile inputs, JSON round trip) |
| T02 Musical World Director | done | byte-identical plans; varied music -> varied dramaturgy | `WorldDirector.ts`; `xr-world-plan` (7 audio scenarios, determinism, no preset coupling) |
| T03 Unified 3D World Kit | done | three characters, shared language, bounded resources, disposal | `XrWorldKit.ts`, `XrWorldLayout.ts`, `XrWorld.ts`; `xr-world-render` (bounds, characters, readability, disposal); browser smoke |
| T04 World Runtime integration | done | full playback, stable evolution, no gameplay regression | `RhythmGameScene` / `XrAppController` wiring; browser playthrough of a synthesized 100 s track; seek-exact test |
| T05 World Interaction Session | done | desktop and XR equivalent; idempotent; score independent | `WorldInteractionSession.ts`, session observer; `xr-world-session` |
| T06 Special-note roles | done | special note = valid original note + world meaning | role sidecar, `XrNoteHalos.ts`; mechanical-twin and halo tests; browser (gold halo) |
| T07 Seeder and Dragonfly | done | recognizable roles, no collision interference, measured cost | seeders follow build windows, drones patrol/scan/form/field + answer achievements; readability tests over whole runs |
| T08 Fenom stabilization | done | playable inside an ordinary song; sparse fallback | encounter selection, anchors + lock, stability, outcome classes; flawless / missed / half runs tested |
| T09 Player experience | done | understandable and finishable; enable/disable | status plate, objectives, results line, World setting Off / Reduced / Full; controller lifecycle tests |
| T10 Quest performance and regression | done (desktop) | no blocking regression; device-only checks listed | full suite = baseline failures only; build; measurements; Quest checklist section added |
| T11 Adversarial review | done | one maintainable feature | findings and fixes below |

## T00 findings (audit)

- **Publication**: `XrAppController.composeChoreography` is the only place a chart is built
  (load and regeneration, guarded by `loadGeneration`); `session.loadChart(chart, sections)`
  follows. The World Plan is built right after it from the same plain data.
- **Semantics available**: `trackAnalysis.sections` (label, energy, density), `cues` (kind,
  confidence), `timingConfidence.overall`, plan points' `meta` (`automationSituation`,
  `movementGesture`, `longScenePhase`, `globalArcRole`, `variantRole`).
- **Hit/miss flow**: `RhythmGameSession.attemptStrike` (XR blade and desktop click alike),
  `update` (miss scan), `seek` (skipped notes), `finish` (remaining notes). An optional observer
  on the session is the single tap point.
- **Lifecycle**: `XrPlaybackBinding` maps AudioEngine play/pause/seek/end to the session; the
  controller pauses on visibility loss, tracking loss and reference reset. Rendering is driven
  by `XrRuntime` (desktop on demand at <= 60 Hz, every headset frame in XR).
- **Settings**: one descriptor list (`XR_SETTINGS`), scopes chart/session/presentation, persisted
  record `plexus.xr.settings` v1 with normalization of missing groups.
- **Scene**: stage root follows the viewer; playfield at the hit plane; runway <= 18 m, bends up to
  2.4 m sideways / 1 m up beyond 2.5 m; Wormhole plane at 40 m; camera far plane 50 m.
- **Performance**: notes, slices and track bend already run on the GPU with event-scope instance
  writes; the Wormhole is the dominant cost (worker raster + GPU material). The world follows the
  same pattern: static instance data, uniform updates per frame.
- **Tests**: Node test runner with a TypeScript transpiling loader; scene tests use real `three`
  with a fake DOM; only `xr-controller-regeneration` stubs `RhythmGameScene`.

## Regression risk matrix

| Risk | Area | Mitigation | Test gate |
| --- | --- | --- | --- |
| Chart changes | gameplay | world reads the chart, never writes it | default chart golden, `rhythm-chart` |
| Score changes | session | observer is notification-only | `rhythm-session`, `rhythm-scoring` |
| Duplicate world rewards after seek | world session | per-run applied flags, reset on every run reset | world session tests |
| Stale plan after regeneration | controller | plan built inside the guarded compose step | controller world tests |
| Note readability | scene | readability volume, halos keep hand colour | world layout tests |
| Frame time | scene | static instances, shader motion, bounded counts, Off/Reduced | draw/instance budget tests |
| Resource leaks | scene | dispose traversal + explicit disposal | disposal tests |
| Settings compatibility | settings | optional `world` group normalized to default | settings tests |

## Performance risk assessment

The Wormhole (worker raster + GPU material + upload) dominates the headset GPU. World Formation
adds a fixed number of draws with small vertex counts and mostly opaque or small additive
surfaces; the largest additive surfaces (membrane, rings) are far away and small on screen.
Measured numbers are recorded under T10; Quest readings are pending.

## Validation log

- `npx tsc --noEmit -p .` clean after every task.
- `node --test tests/xr-world-plan.test.mjs tests/xr-world-session.test.mjs tests/xr-world-render.test.mjs`: 39 pass.
- `node --test tests/xr-controller-regeneration.test.mjs`: 19 pass (4 new world lifecycle tests).
- `node --test tests/gameplay-purity.test.mjs tests/rhythm-session.test.mjs tests/rhythm-scoring.test.mjs tests/rhythm-chart.test.mjs
  tests/xr-settings.test.mjs tests/xr-menu.test.mjs tests/xr-performance.test.mjs tests/xr-edge-cases.test.mjs
  tests/xr-section-gates.test.mjs tests/xr-score-overview.test.mjs`: pass (default chart golden unchanged).
- `npm run build`: pass (Vite chunk-size warning, informational).
- Browser smoke (in-app browser, `/xr/?xrDiagnostics=1`, synthesized 100 s 128 BPM track with intro / build /
  drop / break / drop / outro loaded through the file input): no console errors; shaders compile; the plan read
  Localhost 0-16 s, Seeder 16-42 s, network 42-62 s, Fenom 62-93 s (sync 70-85 s, 5 anchors + lock),
  resolution 93 s; screenshots at 6 / 24 / 52 / 77 / 98 s show the hall, construction (scaffold, arms,
  conduits, drones), dematerializing walls with lattice and links, the Fenom encounter, and the settled world;
  a gold energy halo around an unchanged pink target. Whole frame: 25 draw calls at the end of the song.
  The headset was not available; no Quest numbers exist.

- Full suite after T09 (`npm test`): 1300 tests, 1291 pass, 9 fail -- the same 9 baseline failures
  (`wormhole-clip-profile` 4, `wormhole-geometry-lfo-integration` 1, `wormhole-preset-differentiation`
  2, `wormhole-projected-motion` 2); every new test passes.
- Final XR set (the ADR-009 command plus the three world suites): 327 pass. `npx tsc --noEmit -p .`
  clean; `git diff --check` clean.

### T11 review findings (fixed)

- Status plate under an above-runway HUD could meet the start frame's section caption from the eye:
  it now sits above that HUD (under the side HUD only).
- Beams stored their pulse phase in the slot the shared build helper reads as "prebuilt": the beam
  shader now ignores that flag (beams were otherwise drawn fully grown before their build).
- After the encounter the anomaly vanished in a following network era, hiding the outcome: a
  residual anomaly presence (0.3) keeps a stabilized or unstable field readable.
- Encounter scoring preferred the first drop, so the information network never formed before the
  anomaly on clear two-drop songs: position and a returning-peak bonus now weigh in.
- A final peak was forced into a calm "resolution" era: resolution now needs a published outro or a
  real tail, otherwise the song ends in the developed network.
- Solid Localhost walls hid the Wormhole's periphery for the whole song: they dematerialize as the
  network emerges.
- Flow points were sub-pixel in the headset: their size now follows the eye viewport.
- The session observer is detached on controller dispose; dead exports removed; Fenom ring
  tessellation reduced (5,760 -> 3,072 triangles).

### Residual risks

- Quest GPU cost of the opaque hall walls drawn over the Wormhole plane (overdraw on the
  dominant surface) and of the scaffold `discard` fragments; Reduced does not remove the walls.
- The world's colours were judged on a desktop monitor only.
- Old saved settings take World = Full on first load (a new feature, opt-out in Gameplay).

### Measurements (desktop, not headset)

Node 25 on the development PC, a dense 5-minute Ultra chart (1,935 notes, 11 sections), `scratchpad` bench:

| Quantity | Value |
| --- | --- |
| `buildWorldPlan` (once per chart) | 12.8 ms |
| `XrWorld.update` per frame (72 Hz, notes resolving) | 74 us |
| `WorldInteractionSession` per resolved note (incl. snapshot) | 14 us |
| State attribute upload per snapshot change | 2.3 KB (about 6 changes / s) |
| Drone matrices per frame | 768 B |
| Seeder path rewrites per song | 50 |
| World draws (Full) | at most 10, plus halos and the status plate |
| World triangles (Full) | about 7k (rings reduced to 1,024 each) plus 480 flow points |
