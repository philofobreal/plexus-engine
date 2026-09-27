# XR rhythm game delivery review - 2026-09-27

Consolidated review of the uncommitted `/xr/` change set (ADR-009 host, gameplay domain, shared
MVP Wormhole background, whole-track choreography, cue-evidenced automation publication,
analyzer v5). It replaces four per-session logs (stabilization, render scheduling/Wormhole,
choreography, variation/cue placement). Contract:
[feature](../features/xr-rhythm-game-mvp.md), [musical score](../features/xr-musical-choreography.md),
[acceptance criteria](../acceptance-criteria/xr-rhythm-game-mvp-acs.md),
[ADR-009](../adr/ADR-009-xr-rhythm-game-host.md), [ADR-005 addendum](../adr/ADR-005-visual-os-style-system.md#addendum-cue-evidenced-automation-publication-2026-09-26).

Status: implementation candidate. Physical Quest 3 acceptance has NOT been performed; see the
[Quest checklist](xr-rhythm-game-quest3-manual-test.md).

## Ownership

Integration owner for the whole change set: repository maintainer (philofobreal). The same
single owner covers the single-agent-ownership areas touched here:

| Subsystem | Change | Owner note |
| --- | --- | --- |
| audio | `AudioEngine` host options (`loopPlayback`, `heroMetronome`), stale decode guards, source-identity `onended`, listener unsubscribe | Playback lifecycle; single owner |
| analyzer / worker output | v5: impact cues require a detected onset; `significantMoments` uncapped | Worker output content; single owner |
| automation | `alignAutomationToCues` publication gate, `applyMvpWormholePreset`, `prepareWormholePerformance`, runtime helpers moved from `src/ui/` | Affects dashboard, MVP and XR plans |
| semantics | `cueEvidence` (pure evidence anchors consumed by automation) | ADR-005 boundary |
| config | shared macro/Advanced gain resolution moved from `src/ui/mvp/` | Shared by MVP and XR |
| visuals | injected `WormholeRenderState`, `Canvas2DRendererBackend`, `WormholeCanvasSource`, shared transient decay constants | Renderer-visible identity unchanged |
| gameplay / xr | new ADR-009 layers | New owners per ADR-009 |
| build | `three`, `@types/three`, `@types/webxr`, `/xr/` MPA entry, lockfiles | Dependency change |

## Findings and resolutions

| Finding | Resolution |
| --- | --- |
| AudioEngine default loop prevented a finished state; Hero stems wasted XR memory | XR-only constructor options disable looping and Hero stems/sources; dashboard/MVP defaults unchanged. |
| Stale file/decode results could overwrite a later load | Request-id guards after `arrayBuffer()` and after decode; worker guards retained. |
| Delayed `onended` from an old source could end a replacement playback | Raw audio clock plus source identity check for natural end. |
| Grid fallback created notes in silence | Removed; only published BeatEvents create notes. |
| Low timing confidence disabled arrows/pairs | Confidence selects the spacing scaffold only; whole-track phrase planning. |
| Automatic scene proposals landed on grid positions without audible evidence | Shared publication gate (ADR-005 addendum); unsupported proposals omitted and reported. |
| Sustained density produced impact cues on cooldown; first-32 `significantMoments` cap biased consumers | Analyzer v5 (cache version bump); BeatEvent, tempo and section detection unchanged. |
| Unconditional XR animation loop, DPR 2 and MSAA | Invalidation-driven desktop loop, 60 Hz desktop cap, DPR 1.25 / 1920x1080 cap, no MSAA; headset cadence retained in XR. |
| Background needed the real MVP Wormhole and slider semantics | Same `CosmicWormholeIdentity` with injected private state; shared `resolveMetaTuning`; 960x540 / 30 Hz budget; lazy and bypassed when off. |

## Review remediation (2026-09-27, behavior-preserving)

- Cue evidence (`cueContext`, `musicalCueAnchors`) moved from `src/automation/` to
  `src/semantics/cueEvidence.ts`; automation keeps only proposal snapping and publication.
  Identical gate inputs from `cues`/`significantMoments` are evaluated once.
- `WormholeCanvasSource` no longer regenerates a plan (the facade always supplies it), uses a
  fresh empty-analysis copy instead of the shared template, and receives the diagnostics flag
  from `src/xr/main.ts` (also passed to `XrRuntime` and `XrAppController`).
- Transient decay rates are shared constants (`src/visuals/transientDecay.ts`) for the renderer
  and the closed-form background evaluation.
- Gameplay vocabularies are typed against the Visual OS unions; the family mapping and the
  gesture entry mapping live in one module with their difference documented. Cut speed/cone
  thresholds moved into `RhythmGameConfig` with unchanged values.
- MVP compatibility re-export shims removed; imports point at `src/config/` and `src/automation/`.
- Boundary guards added: only `XrAppController` may import automation from `src/xr/`; the
  Wormhole source cannot import state/ui/audio/xr or plan regeneration; `three` is imported
  only under `src/xr/`.
- `bun.lock` was hand-edited in an earlier pass (Bun unavailable). It was regenerated with Bun
  1.3.14 `install --lockfile-only` in an isolated copy; resolved versions and integrities are
  identical to the hand-edited file and to `package-lock.json`.

## Evidence from earlier passes

Browser evidence used full UI automation on the production preview (`/plexus-engine/xr/`), not
HTTP-only checks: synthetic percussion WAVs through the real file picker, decoder and analysis
worker; Play/Space/pause/resume/restart/natural end; background toggle; `/` and `/mvp/` still
loading. No application console errors were captured. With `?xrDiagnostics=1`, paused frames
stayed constant across samples, a 3840x2160 resize produced exactly one frame at a 1920x1080
backing store, and switching the background off bypassed its rendering (draw calls 12 -> 11).
A ~29 s playing sample submitted ~54 frames/s with the background on. These are browser
submission counts, not GPU timings.

A real user-supplied 5:58 track (86 BPM, overall timing confidence 0.237, not stored in the
repository) produced 625 notes, 578 arrows and 72 pairs with 5-6 distinct textures in every
quarter. 86 automation proposals became 79 evidence-backed points (7 late proposals omitted;
mean displacement 0.283 s, maximum 2.347 s).

Not measured: GPU utilisation, headset frame time, controller/audio latency, comfort and
fatigue. These remain Quest acceptance items.

## Validation (2026-09-27)

Runtime discovery: Node v25.2.1 and npm are on PATH; the declared scripts were used.

- `npx tsc --noEmit` - passed.
- `npm run build` - passed for `/`, `/mvp/` and `/xr/`; the existing >500 kB chunk advisory
  (`xr`, `PreviewQualityControl`) is informational.
- `npm test` - 1050/1059 passed; the 9 failures are the baseline listed below.
- `git diff --check` - clean.
- Browser smoke (in-app browser against the running dev server, page-load level, no audio
  loaded): `/xr/?xrDiagnostics=1` rendered the launch overlay and the unsupported-WebXR status;
  enabling the background created the diagnostic Wormhole canvas, proving the injected flag;
  `/mvp/` and `/` loaded. No console errors. The pane was hidden, so no desktop XR frames were
  submitted by design; playback and scoring were not re-exercised in this pass.

Known baseline failures (present on a clean `HEAD` worktree, unrelated to this change set):
wormhole clip-profile role keys / visibility / weak-role depth / role contrast, factory preset
near/far geometry, weighted separation, preset speed order, projected overdrive/punch/drive/drift
ordering and speed-vs-travel response. They come from the 2026-09-22 preset retune and are not
masked. Golden-master snapshots were not changed.

Residual risk: uncapped `significantMoments` feed `TimelineCanvas` and `MotifPlanner`; very long
tracks were not profiled there. The publication gate omits unevidenced legacy section starts
(pinned by `automation-cue-alignment.test.mjs`); this is intentional product behavior per the
ADR-005 addendum. `diff_export.ps1` was not generated; the review used the live working tree.

## Presentation, settings and depth delivery (2026-09-27/28)

Delivered task by task with user sign-off after each: premium runway/targets/HUD
(`XrRunway`, `SceneGeometry`), game-style command drawer (`XrCommandDrawer`), Wormhole-facing
track path (`XrTrackPath` + `CanvasVisualSource.focalPoint`), player generation settings
(Difficulty, Activity, Variation, Hands, Lead, Zones; `RhythmGenerationProfile`,
`RhythmHandPolicy`, `RhythmZonePolicy`), hit-gate section callout (`XrSectionCallout`) and
Wormhole depth (identity depth cue + three XR stereo planes). Contracts: ACs XR-8..XR-12,
ADR-009 addenda C-E, the feature and musical-choreography documents.

Final integration pass:
- Boundaries: `src/gameplay/` imports only gameplay modules and `src/types/`; XR scene/runtime
  modules import only gameplay, types, `three` and XR modules; `VisualRendererBackend` is
  unchanged; `src/xr/main.ts` still imports only `WormholeCanvasSource` from visuals.
- One projection authority (`XrTrackPath`), guarded by a source test; defaults reproduce the
  historical chart byte-for-byte (`tests/fixtures/xr-chart-default-golden.json`).
- Hot path: per-frame key/signature strings in `RhythmGameScene.update()` and `XrHud.update()`
  were replaced by field comparisons; new per-frame work (runway phase, path shear, callout frame,
  depth routing) is allocation-free. Residual, pre-existing: `RhythmGameSession.getSnapshot()`
  returns a new small object per frame (gameplay API, left unchanged).
- Fixed during the review: `XrSectionCallout.update()` crashed on non-finite song time; a setting
  change during a track load left the section callout without its timeline.
- Accessibility: menu button announces the status light; every settings group is
  `aria-describedby` its hint; native radios keep arrow-key navigation.
- Measured desktop draw calls while playing with the Wormhole: 11-12 (base scene 8 without it).

Validation (2026-09-28): `npm test` 1112 tests, 1103 pass; only the 9 known baseline Wormhole preset failures
listed above; `npm run build` passes; the XR matrix in `testing-validation.md` passes; browser
smoke on the built `dist/` (drawer, regeneration without re-analysis, Wormhole planes, callout, MVP
load) showed no console errors. Physical Quest 3 validation has not been performed; use the
additions section of the Quest 3 manual test.
