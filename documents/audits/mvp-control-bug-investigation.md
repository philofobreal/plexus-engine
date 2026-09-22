# MVP controls and mobile performance investigation

2026-09-22. Integration owner: implementing frontend/rendering engineer. Follow
[AGENTS.md](../../AGENTS.md) and [Testing and Validation](../governance/testing-validation.md).
User retains the sequential manual-acceptance gate. These bug reports interrupt the feature
backlog; sub/bass and localization remain pending. The previously skipped Reduced load
feature is not implicitly marked implemented by this investigation.

| Item | Owners | Status |
| --- | --- | --- |
| A: Morph Scale stops before the visible end / caps at 44% | MVP/dashboard controls, shared automation constraints/cache, Visual OS adapter, storage/history, tests/docs | Manually accepted by the user on 2026-09-22 |
| B: History save sometimes fails in the leave modal | MVP controller, SessionStore, checkpoint encoding/validation and modal | Two failure paths reproduced and fixed; user authorized progression, without a separate manual-result report |
| C: Detail/material/grain lower mobile FPS; quality modes appear equivalent | Renderer, preview-quality config and Advanced projection | Deferred at the user's explicit request; no performance fix implemented |

## A: initial UI repair (user rejected as insufficient)

`computeMaxMorphScale()` constrains the global multiplier to the narrowest safe gap between
automation points. This can correctly return less than 1 (100%). `TimelineToolbar.setMorphScale()`
instead forced its DOM maximum to at least 1. The controller then clamped values from the
unreachable upper portion, and `MvpUI.refreshJourney()` projected the lower value back into
the input on each event. Example: 1.01 seconds between points and a 2-second base morph give
a 0.495 maximum after the existing 20 ms margin, while the UI advertised 1.0.

The toolbar now projects the true maximum down to its 0.25 minimum. Native `step="any"`
keeps exact fractional endpoints reachable, including 0.495; keyboard arrows retain native
range adjustment and Home/End reach the bounds. Percentage text (up to two decimals),
`aria-valuetext` and a maximum/spacing tooltip expose the accepted value and reason for the
limit. A range collapsed to 25% disables; widening the plan re-enables it.

In that initial iteration only the MVP toolbar's runtime code changed. The controller's bound, shared non-overlap
calculation, base plan, save formats, history grouping and renderer are untouched.

### Initial validation evidence

- Three new regressions in `tests/mvp-morph-scale-control.test.mjs` failed before the fix
  (DOM maximum 1 instead of 0.495) and pass afterward. They exercise synchronous controller-like
  clamp/refresh feedback, exact fractional endpoint, value/accessibility projection and
  narrowing/collapsing/widening the range. Existing real-controller/history/storage tests
  cover the unchanged integration paths.
- **81/81 targeted tests pass**, 5.0 s:

```powershell
node --test tests/mvp-morph-scale-control.test.mjs tests/morph-scale.test.mjs tests/automation-plan-editing.test.mjs tests/mvp-async-lifecycle.test.mjs tests/mvp-history.test.mjs tests/mvp-track-storage.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
git -c safe.directory=C:/novy diff --check
```

- TypeScript and production build pass; the existing shared >500 kB chunk warning is
  informational. Used bundled Node/local package entrypoints because npm is unavailable;
  no dependency installation. No full-suite rerun for this bounded UI fix; the preceding
  BPM task's full result was 923/914/9 with the documented R4 preset failures.
- Browser checked the real toolbar plus real `clampMorphScale`/`computeMaxMorphScale` in a
  temporary component page on a task-owned Vite server at port 5179. At the dense limit,
  native End and pointer drag both reached exactly 0.495 and displayed 49.5%. Left reduced
  it to 0.49255; Home returned to 0.25. A collapsed range disabled at 25%; widening re-enabled
  it and End reached 4 / 400%. Browser warnings/errors were empty. The first coordinate drag
  selected label text because screenshot and CSS coordinates differed; inspecting the DOM
  bounds and using those coordinates verified the actual drag. This is component/native-input
  QA, not a claim of complete application or physical mobile testing.
- Graphify's Python launcher again failed with access denied for
  `graphify affected clampMorphScale --depth 2`; targeted source reads were used. No graph rebuild.
  `diff_export.ps1` was considered and skipped: a local working-tree review sufficed; no PR,
  commit or network fetch. Existing unrelated changes were retained.
- Final whitespace check passes. Documentation audit: four files, 19 relative links,
  no missing targets. The temporary component page/logs/tab and task-owned dev server were
  removed/stopped after verification; no user audio or stored workspace was touched.

### Revised diagnosis and repair

The user clarified that the multiplier must use every current morph length and the first
collision across the whole journey. A later screenshot showed an exhausted slider at 44%.
A read-only inspection of the user's running Chrome page confirmed `max=0.43999999999999995`
and `value=0.44`. The page was playing; no playback, editing, reload or storage action was
performed there. That Chrome tab subsequently became unavailable, so its full plan was not
extracted. The exact audio path/current-plan edit history was requested but not supplied
during this validation.

Two separate defects were reproduced and repaired:

1. The shared helper defaulted to a 4x ceiling and the MVP controller separately requested
   a clamp of 4 when asking for its maximum. Both prevented reaching real limits above 400%.
   The common limit now uses the minimum `(boundary - point.time - 0.02) / baseMorphDuration`
   across the entire sorted plan, including the final track boundary. An explicit caller cap
   remains supported; 4 is only a fallback for missing finite geometry, not a loaded track's cap.
2. The Visual OS adapter deduplicated starts only below 50 ms but imposed a 100 ms minimum
   morph. A 64 ms opening scene therefore emitted two overlapping points. The global scale
   returned exactly `(0.064 - 0.02) / 0.1 = 0.44`, while the two points could appear as one thin
   line. A deterministic 358-second Visual OS fixture reproduced this exact failure through
   the real planner. The adapter now resolves generated starts closer than the minimum morph
   plus 20 ms margin; the succeeding scene birth wins over an unplayable preceding transient.
   It also drops unplayable terminal stubs and applies the same margin at the next point/track
   boundary. Consecutive tiny scenes and an exactly playable 120 ms boundary have regressions.
   This fixture supports the screenshot diagnosis but is not the user's exact audio recording.

The controller, cached view and restored journey all use the track-duration bound. A plan edit
that lowers the permitted scale records the accepted scale in the same undo entry, before UI
callbacks. Cache identity includes duration. Storage writes without known track duration defer
geometric clamping to restore; this prevents a valid single-point scale above 400% being lost.
Dashboard range endpoints also retain full precision and use native `step="any"`.

Base plans remain non-destructively scaled. Existing saved plans/history are not silently
rewritten or stripped of authored points. Previously generated invalid pairs in saved data
need explicit regeneration (or deliberate editing) to receive the adapter correction. The
existing 25% scale floor remains a compatibility limit for degenerate manually supplied
geometry. Projection no longer reapplies the 100 ms authoring floor: short morphs shrink
proportionally and even old dense pairs render within their available room. No audio,
renderer, session-save workflow or schema changed.

### Revised validation evidence

- Four of 47 targeted tests failed before removing the 400% cap/adding the track boundary;
  all passed after the correction. The separate real-planner 64 ms regression also failed
  before the adapter fix and passed afterward.
- Final focused suite: **176/176 passed**. Covers proportional unequal lengths, the
  limiting pair changing on edit/add/delete/reorder, exact endpoints, single-point track end,
  cache invalidation, save/load, checkpoint undo/redo above 400%, and the generated 44% case.

```powershell
node --test tests/mvp-morph-scale-control.test.mjs tests/morph-scale.test.mjs tests/automation-plan-editing.test.mjs tests/mvp-async-lifecycle.test.mjs tests/mvp-history.test.mjs tests/mvp-track-storage.test.mjs tests/mvp-session-persistence.test.mjs tests/timeline-ui.test.mjs tests/visual-os.test.mjs
node --test tests/*.test.mjs tests/ui/*.test.mjs
node --test tests/wormhole-clip-profile.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
git -c safe.directory=C:/novy diff --check
```

- Full suite before the late adapter correction: **934 total / 925 passed / 9 failed**, 391.8 s.
  Failures match the preceding R4 preset baseline: four clip-profile, one geometry-LFO,
  two preset-differentiation and two projected-motion failures. After the adapter correction,
  all direct adapter consumers were rerun: Visual OS is included in the final green suite;
  clip-profile remains **23/27**, with precisely its same four preset failures. The final
  checkpoint regression was also added after the full run and passes in the focused suite.
- Final TypeScript and Vite build pass; existing >500 kB chunk warning remains informational.
  Commands used the bundled Node executable at
  `C:/Users/budap/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`
  and local package entrypoints because npm is unavailable. No dependencies installed.
- Browser component QA used the real toolbar, pure scale helpers and actual Visual OS planner.
  Wide unequal-duration plan: End reaches 19.98 / 1998%; moving the next point closer updates
  the accepted maximum to 9.98 / 998%. The 64 ms generated fixture now starts at 100% and allows
  3.3294057607120253 / 332.94%; End and pointer drag both reach it, Home reaches 25%. At maximum,
  the limiting morph ends 20 ms before its successor. No console warnings/errors. One AX click
  timed out, then the observed button was activated through the supported locator API.
- This verifies native input plus real planner/controller/storage logic, not the exact user's
  audio or a physical mobile device. Graphify remained unavailable (Python launcher access
  denied); scoped source reads were used. No commit, PR, dependency or graph rebuild.
- Final whitespace check passes; all 19 relative links in the four updated docs resolve and
  CLAUDE.md still inherits AGENTS.md. Temporary probes/logs/component tab were removed and the
  task-owned port 5179 server stopped. The user's port 5173 server was not stopped.

### Manual acceptance for the revised fix

Reload the MVP and select the track that exhibited the issue. If a saved old journey is
restored, explicitly regenerate it to replace the old generated close pair; this replaces
the current plan through the existing confirmation/undo workflow. Then drag Morph Scale
right: all current morphs should grow proportionally until the first real boundary, with
the thumb reaching the advertised endpoint. Inspect the whole track, including its opening
and tail, rather than only a zoomed viewport. Check Home/End, moving a point closer, undo/redo,
and saving/reloading the corrected automation. A deliberately dense authored plan may still
have a genuine small maximum. Confirm the screenshot case with the actual track.

User subsequently confirmed this fix worked in manual testing and authorized the next task.

## B: history save repair

Two deterministic regressions failed before the fix: a detailed 80-point journey with 300
ordinary strength edits produced 17,196,691 raw checkpoint characters and exceeded the
1,500,000-character budget; a workspace-capture exception occurred before `try/finally` and
left the controller's saving lock engaged. These are confirmed failure paths, though the
user's exact failing checkpoint was not supplied and cannot be attributed conclusively.

`checkpointEncoding` now stores large journals as lossless, versioned prefix/suffix string
differences against a preceding same-domain snapshot. Small/legacy plain v1 checkpoints are
unchanged. No commands are dropped and live history is never rewritten. Save input is capped
at 32,000,000 characters; storage remains capped at 1,500,000. Decode rejects invalid references,
unknown encodings, more than 600 snapshots and excessive cumulative expansion before allocation.
Normal schema/continuity validation still runs after decode. Encoding is explicit-save work,
never frame/gesture work; there are no dependencies, audio persistence or renderer changes.

The controller now includes capture and serialization in its error/lock-release boundary.
`SessionStore` exposes failure categories; the shared dialog displays actionable capture,
validation, size, storage or stale-workspace errors and stays open for retry/panel saves.
Dirty-state and single-use token/cross-tab publication contracts remain unchanged.

### Validation evidence

- Initial red run: both new regressions failed. Final targeted suite: **92/92 pass**, 5.0 s.
  Includes 300-command save/restore, corrupt encoded data, Unicode/mixed domains, bounded
  expansion, legacy compatibility, serialization/capture failure, retry and modal error display.
- Full suite: **947 total / 938 pass / 9 fail**, 280.7 s. The same known R4 failures remain:
  four wormhole clip-profile, one geometry-LFO, two preset-differentiation and two projected-motion.
- TypeScript and production build pass; existing >500 kB shared-chunk warning remains.

```powershell
node --test tests/mvp-checkpoint-encoding.test.mjs tests/mvp-session-persistence.test.mjs tests/mvp-async-lifecycle.test.mjs tests/mvp-unsaved-changes.test.mjs tests/mvp-history.test.mjs tests/mvp-track-storage.test.mjs
node --test tests/*.test.mjs tests/ui/*.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
git -c safe.directory=C:/novy diff --check
```

- Chrome component QA used the actual SessionStore, EditHistory, encoder and shared modal
  on an isolated task-owned origin at port 5179. Save history persisted the 17,196,691-character
  raw fixture in a 214,897-character track record. Reload restored 300 undo commands; undo/redo
  restored exact strength values. Save all after undo restored 299 undo / 1 redo across reload;
  redo then reached the final value. Another reload without re-save had no checkpoint/history.
  No console warnings/errors in the component run. These are fixture sizes, not universal ratios.
- Full MVP opened, but the Chrome extension denied the synthetic audio file chooser upload
  (`Not allowed`). File-access enablement instructions were provided; no browser permissions
  were changed. Thus full-application file-reselection QA remains for the user's manual check;
  component reload QA is not represented as end-to-end audio restoration. Controller/identity
  lifecycle tests pass. The user's running port 5173 page/storage was not changed.
- Graphify `affected saveSessionForTrack --depth 2` failed at its Python launcher (access denied).
  Scoped source reads and local diff review were used; `diff_export.ps1` was considered and skipped
  as unnecessary for this local review. No dependency install, commit, PR or graph rebuild.
- Whitespace validation passes; 21 relative links across the five updated documents resolve.
  CLAUDE.md remains an AGENTS.md inheritance shim. Temporary fixtures/logs and the test tab
  were removed, and the task-owned server was stopped; existing unrelated changes were retained.

### Manual acceptance

1. Reload the MVP, select a track, and make several dramaturgy/Advanced edits.
2. Open the shared save dialog and choose **Save history + workspace**. Verify successful closure.
3. Reload, select the same audio file, and verify restored values plus working Undo/Redo.
4. Undo once, repeat with **Save all**, then reload/reselect and verify the redo branch too.
5. After restoration, reload again without re-saving: the previous history must not return.
6. If saving still fails, record the now-specific modal message; edits must remain accessible
   and musical panel saves must remain available.

Stop here for user acceptance before implementing C.

## C: confirmed configuration behavior; cost diagnosis pending

`src/ui/mvp/main.ts` constructs `createPreviewQualityControl(!isDesktop)`.
`PreviewQualityPreference.compactMaterialPreview` is true when **either** Reduced load is
selected **or** the host was classified compact. Therefore on a compact/mobile host both
Automatic and Reduced load select the same material-preview policy, pixel-ratio cap (1.25)
and maximum backing long edge (1280). The user's observation of little difference has a
concrete configuration explanation; it does not by itself establish a regression.

Material raster resolution consumes that policy, while detail/grain can also affect work
independently. Next acceptance stage should profile actual material generation, grain draw
count, compositing and backing resolution on representative devices, then separate the
requested artistic Detail value from effective preview budgets. Do not attribute all FPS
variation to GPU load without CPU/GPU/frame-time evidence. No Reduced load bypass, slider
disabling or renderer-quality change was implemented during A.
