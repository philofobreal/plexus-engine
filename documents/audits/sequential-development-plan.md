# Sequential development plan

Requested 2026-09-22. Integration owner: the implementing agent, acting as lead frontend
and audio/DSP engineer. Follow [AGENTS.md](../../AGENTS.md) and its architecture/testing
contracts. Each task ends with automated validation, documentation, a manual handoff,
and an explicit user approval gate. Do not start the next task before that approval.

The table records current status. The detailed entries below preserve chronological handoff
evidence; their earlier pending-approval statements describe the status at that handoff.

| Task | Deliverable and acceptance focus | Owners | Status |
| --- | --- | --- | --- |
| 1 | Explicit dramaturgy Save separate from effect Save, sharing per-track localStorage. Preserve edited points, generator choices and morph scale; restore before ready; retain legacy saves; protect unsaved edits with a leave/save dialog and native unload warning. | UI facade, UI storage/controls/guard, docs; facade owns existing State plan handoff | Accepted for progression by the user's request to continue with undo/redo |
| 2 | Undo/redo for dramaturgy, optional visual-tuning scope, 300 edits, gesture grouping, regeneration/edit/delete restore, global keyboard and visible controls, track-boundary reset. | UI facade, UI history/input/controls, docs; facade owns existing State restoration | Accepted for progression by the user's request to skip Reduced load and continue |
| 3 | Use the existing Preview quality Reduced load selector for costly-operation bypasses. Lower effective Detail and disable Detail plus its affected costly controls; restore previous settings when leaving Reduced load. Inventory material/glow/post-FX and timeline work; verify actual work reduction and deterministic export policy. | visuals, config, UI, docs | Skipped at the user's explicit request; no implementation in this task |
| 4 | BPM from recurring percussive onset/flux patterns. Audit existing estimator before changing it; use duration-independent analysis windows, periodicity/tempo candidates, half/double-time handling and confidence. Test known BPM across patterns, durations, silence, sustained bass and breaks; distinguish correctness fixtures from golden regression. | analyzer; existing worker schema and consumers retained; docs | Accepted for progression; task 5 authorized by the user |
| 5 | Sub/bass responsiveness. Define frequency bands, sample-rate handling, sustained energy versus positive spectral flux/attacks, robust normalization and low-energy behavior. Publish deterministic offline features through the existing modulation owner to visual consumers; no DSP in draw. Test sub-only, bass-only, mixed kick/bass, ramps, transients, silence, sample rates and seek/export parity. | analyzer, types/worker contract, state/modulation, visuals, UI, docs; single integration owner | Accepted by the user; documentation updated |
| 6 | MVP localization and contextual tooltips. Inventory all visible labels, errors, confirmations, accessibility labels and dynamic text; introduce one locale source and a complete HU/EN MVP dictionary with fallback and persistent preference. Test missing keys, formatting and language switches; verify keyboard/touch tooltip access. | UI, config/types as needed, docs | Waiting |

Tasks 4-5 require source-grounded DSP design and authoritative technical references before
implementation. The entries above are investigation/acceptance scope, not a claim that the
current analyzer is duration-based or that its existing low-frequency signals are absent.
Task 6 assumes Hungarian and English; confirm/adjust the intended languages at that gate.

## Task 3 clarification (user follow-up, 2026-09-22)

- Use the existing Reduced load select value as the performance-mode control, rather than
  introducing another independent switch.
- In Reduced load, reduce the effective Detail setting and disable the Detail slider and
  all costly controls it drives, including the affected Advanced tuning sliders. Trace
  the existing Detail macro and Advanced Material detail mapping before implementation
  so every affected parameter is covered. A disabled slider alone is not a renderer bypass.
- Keep the disabled controls visible, show their effective reduced values, and explain why
  they are unavailable. Apply the same disabled state in every exposed tuning surface.
- Implementation default: retain the user's normal-mode values separately and restore them
  on returning to Automatic, so temporary preview reduction does not destroy artistic tuning
  or overwrite it through Save. Define preview/export projection explicitly under the existing
  independent export-quality contract.
- Tests must cover mode switching, effective parameter reduction, actual costly-path bypass,
  disabled mouse/keyboard interaction, restoration and save/reload behavior.
- This follow-up refines future task 3 only. Task 1 manual acceptance and the sequential
  approval gates remain pending; task 2 and task 3 implementation have not started.
- Documentation-only update: reviewed against existing task scope and checked for whitespace;
  no runtime tests or browser smoke rerun because no executable behavior changed.

## Task 1 implementation

- `Track dramaturgy > Save automation` saves the journey; `Advanced tuning > Save` saves
  effects. Each updates only its own slice under the unchanged
  `plexus-mvp-meta-tuning:v1:<fingerprint>` key, preserving the other's last saved values.
- `journeyStorage.ts` owns the typed stored journey and validation, reusing the existing
  pure dramaturgy parser. Plans preserve points (including IDs, presets, timings, strength,
  curves, locks, bend mirror and validated provenance), Activity, Variation, morph scale,
  and the edited flag. An intentionally empty plan stays empty.
- `metaTuningStorage.ts` owns storage IO and validated default-filled tuning projection.
  Missing/invalid journeys fall back to generated plans while valid tuning survives.
  Legacy version-1 effect-only saves remain readable. Unknown top-level versions are ignored.
- `MvpVisualController` is the single integration owner for publication to the existing
  State plan fields, morph scale and facade controls. The generated baseline remains
  separate from the restored effective plan. Restoration precedes ready and preset preload
  targets the restored plan. Load/plan revision guards and trigger/cache resets remain intact.
- Save deep-copies the effective plan at invocation, rejects initial preparation/pending
  regeneration/no-plan states and refuses publication after track replacement.
- User feedback supersedes the initial combined-button design. There is no autosave.
  The facade owns clean signatures and cached dirty state for both journey and tuning;
  leaf controls only project them. Advanced sliders/selectors/Reset and Visual character
  macros use the same mechanism as journey edits. Edits/reverts and successful publication
  refresh it outside the render loop. Saving one domain does not clear the other.
  Pending regeneration guards exit and cannot be saved until its accepted plan publishes.
- `UnsavedChangesGuard` owns one beforeunload registration while either domain is dirty and
  serializes guarded track replacement. `UnsavedChangesDialog` owns native dialog UI, focus/ESC behavior and
  async save feedback. MvpUI wires these to the facade and gates all file-input/drop paths
  through its shared handleFile method. Save failure never triggers track replacement.
  The modal offers separate Save automation / Save visual tuning buttons and Save all.
  Saving only one domain leaves the modal open while the other is dirty. Clean-domain save
  buttons are disabled. Save all performs one atomic storage write for the dirty snapshots.
- Native close/reload/navigation can only use the browser's generic warning. After staying,
  the same deferred app modal offers individual saves / Save all / Keep editing. This does not guarantee mobile
  process-kill protection and never implicitly saves during unload. Reference:
  [MDN beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).
- New track loads reset local artistic controls, Activity/Variation and morph scale before
  restoration. This resolves R3 from the [local review](local-development-review.md).
- Audio/worker schemas, analyzer algorithms, renderer behavior and dependencies are unchanged.
  Editor viewport/layer preferences and independent Preview quality are outside the saved
  musical control payload. The dashboard retains its existing copy/load workflow.

## Manual acceptance for task 1

1. Open the MVP on the same browser origin as the existing saves; load track A.
2. Choose Activity/Variation, then edit/add/delete moments. Change Strength, transition,
   a preset and Morph scale. Adjust Visual character and Advanced tuning as well.
3. Use **Advanced tuning > Save**. Effects save, but the dramaturgy still shows unsaved
   changes. Use **Track dramaturgy > Save automation**. Expect **Automation saved for this track.**
4. Reload the page and select A again. Confirm every retained moment and setting matches,
   including deleted moments staying deleted. Start playback and check preset transitions.
5. Load an unsaved track B. Expect its generated journey, Balanced/Paired, 100% morph scale,
   neutral macros/advanced gains and Rounded line ends. Load A again; its save returns.
6. Change both an automation point and Advanced tuning, then select B. **Keep editing** or
   Escape preserves A. Retry and use **Save automation**: the dialog stays open, its automation
   save is disabled, and tuning remains unsaved. **Save visual tuning** then loads B. Repeat in
   reverse order and with **Save all and continue**. Reopen A to verify each persisted change.
   Also check **Discard and continue**: reopen A and expect only previously saved settings.
7. If available, load a track with a pre-change effect-only save: effects restore and a
   generated journey remains usable. On narrow/fullscreen layouts verify Save feedback.
8. Change only an Advanced parameter (then repeat with a Visual character macro and a moment)
   and refresh or attempt to close the tab. Expect the browser warning. Stay: expect the shared
   modal with both individual saves and Save all; the clean domain's button is disabled. Save,
   then refresh: expect no unsaved-warning and restored settings after reselecting A.
9. Verify no-op edits/reversions do not warn; morph scale, preset, transition, strength,
   movement, deletion, creation, generation, macros, Advanced selectors/sliders and Reset do.
   With storage disabled/full,
   Save must report failure and keep the current track/unsaved warning.

Known storage limitation: the existing key hashes rounded analysis descriptors, not audio
bytes. Descriptor collisions and analyzer changes can affect identity. Storage is browser-
and origin-local; the later BPM change will need an explicit saved-track compatibility review.

## Initial implementation validation (before separate-save revision)

Runtime discovery found bundled Node v24.19.0 and no npm executable on PATH. The declared
package scripts were therefore executed through their local Node entrypoints, without
installing dependencies or using Bun:

```powershell
node --test tests/mvp-track-storage.test.mjs tests/mvp-async-lifecycle.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
node --test tests/*.test.mjs tests/ui/*.test.mjs
git -c safe.directory=C:/novy diff --check
```

- Final focused run: **23/23 pass**, including storage compatibility/corruption, deep snapshot,
  empty plans, saved journey publication, pending generation save rejection and A/B/A isolation.
- TypeScript and production build: pass. The existing >500 kB chunk warning remains.
- Full suite: **853 tests, 844 pass, 9 fail**, 273.1 s. The final A/B/A regression was added
  after this full run and passed in the final focused run; no product behavior changed afterward.
- The nine failures match the pre-existing R4 findings in the local review: four in
  `wormhole-clip-profile`, one in `wormhole-geometry-lfo-integration`, two in
  `wormhole-preset-differentiation`, and two in `wormhole-projected-motion`. They concern
  preset global masters, visibility/depth/role contrast, projected geometry, separation
  and speed ordering. `git diff --name-only` confirms their test files, renderer source and
  preset JSON are unchanged by this task. This is not a green full-suite release claim.
- Browser smoke: real in-app browser automation, not HTTP-only. Existing local dev server
  returned HTTP 200. A generated 12-second WAV was loaded/analyzed; Strength was changed
  to 100%, transition to Fast, Morph Scale to 25%, line ends to Square. Save reported
  success. After page reload and reselecting the same WAV, the UI showed Strength 100%,
  Morph Scale 25% and Square again. Browser warning/error log was empty. One file-chooser
  wait immediately after reload timed out; the visible topbar Load Track path succeeded.
- Not exercised here: audible playback, full transition visuals, mobile/fullscreen layouts,
  browser-level quota denial and encoded export. Automated boundary tests cover storage
  failure; the user's own track/playback acceptance remains pending.
- Documentation links and whitespace checked. `diff_export.ps1` skipped as unnecessary
  for this focused working-tree change; direct diff review was used. Git's safe-directory
  exception was command-local because the sandbox account differs from the repository owner.
- Graphify navigation was attempted with `graphify affected "MvpVisualController" --depth 2`,
  but its Python launcher was inaccessible. Used targeted `rg` and direct source/governance
  reads, without rebuilding the graph or changing tool configuration.

Residual risk is the existing descriptor-based track identity, unavailable/cleared browser
storage, existing preset failures and the broader manual checks above. No next-task
implementation has started. User approval is still required before task 2.

## Separate-save and exit-guard revision validation

The current acceptance steps and product contract above supersede the initial combined-button
behavior. No npm executable is available; bundled Node/local package entrypoints remain the
fallback, with no dependency installation. Exact commands:

```powershell
node --test tests/mvp-track-storage.test.mjs tests/mvp-async-lifecycle.test.mjs tests/mvp-unsaved-journey.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
node --test tests/*.test.mjs tests/ui/*.test.mjs
git -c safe.directory=C:/novy diff --check
```

- **36/36 focused tests pass.** Added separate-slice storage, blocked read/quota failures,
  all editing paths, no-op/revert cleanliness, stale save rejection, edits during save,
  pending regeneration protection, native unload registration/removal, deferred save prompt,
  serialized replacement, modal failure/retry/cancel/discard/busy state and toolbar feedback.
- TypeScript passes; production build passes (also rebuilt after correcting the dialog text
  color token). The existing large shared-bundle warning remains informational.
- Full suite: **867 tests, 858 pass, 9 fail**, 315.3 s. Failures are the same four clip-profile,
  one geometry-LFO, two preset-differentiation and two projected-motion assertions recorded
  above and in R4. No renderer/preset/algorithm files were changed.
- Real in-app browser automation with synthetic 13/14-second WAVs verified: a distinct
  Save automation button; dirty status after Strength changes; effect Save leaves journey
  dirty; replacement opens the modal; Keep editing preserves the current track; Save and
  continue loads the requested track and the previous track's saved Strength returns on
  reloading; the toolbar's own Save shows success; Discard and continue replaces the track.
- A dirty reload attempt kept the track and opened the return-to-page Save automation modal.
  Saving there cleared dirty state and the next reload completed. The automation surface did
  not expose the browser-native prompt through getJsDialog, so its actual presentation and
  close/Back/address-bar behavior still need manual checking in the user's browser.
- A screenshot verified readable modal text/actions and the dimmed background. Native dialog
  focus started on Keep editing. No browser warning/error logs were reported. An initial test
  tab was lost during file selection and replaced; one DOM style probe timed out, so the
  screenshot was used instead. These tool limitations are separate from product assertions.
- Not run: audible playback/export, mobile/fullscreen layout and real storage-quota denial.
  Failure behavior is covered by controlled tests; mobile process termination cannot be
  reliably guarded by beforeunload. No automatic recovery save was introduced.
- Documentation links and whitespace verified. `diff_export.ps1` remains unnecessary for
  this focused local revision; used direct working-tree diff review. Temporary audio/log files
  were removed. The descriptor-fingerprint identity limitation remains unchanged.

Task 2 remains waiting for user approval of the revised task 1.

## Unified change tracking and selectable modal saves (2026-09-22)

User refinement: Advanced tuning and Visual character must share the automation leave
protection, while the modal must allow saving automation alone, effects alone, or all dirty
settings. Current product/acceptance sections above incorporate this contract. Ownership
remains UI facade, UI controls/storage/guard and docs; no analyzer/renderer changes.

Validation used the same bundled Node fallback because npm is unavailable. Exact commands:

```powershell
node --test tests/mvp-track-storage.test.mjs tests/mvp-async-lifecycle.test.mjs tests/mvp-unsaved-changes.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
node --test tests/*.test.mjs tests/ui/*.test.mjs
git -c safe.directory=C:/novy diff --check
```

- **45/45 targeted tests pass.** New coverage includes tuning no-op/revert/reset behavior,
  independent dirty baselines, each modal save order, disabled clean-domain buttons, partial
  success followed by failure, one-write Save all, failed atomic write preservation, newer
  tuning during save, stale tuning/combined saves after track replacement and panel feedback.
- TypeScript and Vite production build pass; the existing >500 kB chunk warning remains.
- Full suite: **876 tests, 867 pass, 9 fail**, 282.9 s. Failures match the same R4 baseline
  locations in clip-profile (4), geometry-LFO (1), preset-differentiation (2) and
  projected-motion (2). Their source/test/preset files are unchanged by this task.
- Real in-app browser smoke used synthetic 15/16-second WAVs on the existing dev server.
  Changing only Line stroke opened the shared modal on track replacement; Save automation
  was disabled. With both domains changed, Save automation kept the modal open, disabled
  its own button and retained unsaved tuning. Save visual tuning then continued the load.
  Reopening the original track restored Strength 100% and Line stroke 100%, both clean.
- Save all and continue was exercised with both domains dirty and continued the replacement;
  the newly saved Square line-end selection restored on reopening the original track.
  An Advanced-only dirty reload stayed on the page and opened the same return-mode modal
  with individual saves and Save all. Saving then allowed a clean reload to the welcome screen.
  Native browser prompt presentation/close/Back behavior still requires manual verification;
  the automation confirms the app's retained state and return modal, not the browser chrome.
- Screenshot inspection confirmed readable text, all three save buttons, disabled saved
  domain and dimmed background. Browser automation encountered intermittent CDP focus/snapshot
  timeouts and range-keypress timeouts; successful retries/selector interaction completed the
  smoke above. No audible playback, export, mobile/fullscreen or real storage-denial check
  was performed; controlled tests cover write failures and continuation blocking.
- Updated feature contract, acceptance criteria and manual checklist. Direct diff/whitespace
  and documentation-reference checks used; `diff_export.ps1` was not needed. Temporary test
  WAV/log files were removed. Existing track-fingerprint limitations remain unchanged.

Task 1 was handed off for manual testing. The subsequent user instruction to continue with
undo/redo approved progression to task 2.

## Task 2: scoped undo/redo

The user authorized task 2, requested at least approximately 200 steps, focus-independent
shortcuts, and a consistent optional broader scope whose switch is never recorded. Integration
owner: implementing agent. Owners changed: UI facade/history/input/controls and docs; existing
State plan fields are still written only through the facade. No new State schema, audio,
worker, analyzer, renderer or runtime dependency changes.

### Contract and design decisions

- Default scope is dramaturgy. **Include visual tuning** adds Visual character macros,
  Advanced sliders/selectors and Reset. History is always collected for both independent
  artistic domains; the checkbox selects eligible undo/redo commands. It neither enters
  history nor marks saved content dirty, and switching does not discard either history.
- Each domain has an independent snapshot in one ordered journal. Undo chooses its last
  eligible applied edit, redo its last eligible undone edit. Switching to the broader scope
  therefore cannot restore stale tuning from a journey snapshot. A new actual edit in either
  domain clears all redo, including redo currently hidden by the scope, to establish one branch.
- Retain **300 edits total per loaded track** across both domains; undo and redo move entries
  without multiplying them. Oldest applied edits are evicted when this count is exceeded.
  History is bounded session memory, not localStorage; track replacement/reload starts fresh.
  Scope survives track replacement within the page, defaults to dramaturgy on page reload.
  This is a step bound, not a constant byte bound: large plans consume more memory per edit.
- Strength, morph and tuning pointer drags or held range keys are one group. Release,
  cancellation, leaving that range, window blur, Save, undo/redo or scope change closes it.
  Separate gestures remain separate edits. A gesture returning exactly to its starting values
  leaves no command. Timeline movement already commits only once at gesture end.
- Add/delete/time/preset/strength/transition/nudge/morph edits and accepted regeneration are
  reversible. Regeneration restores its generated baseline, effective edited plan, edited
  flag, Activity/Variation and morph scale together. Pending/failed/superseded generations
  cannot create a misleading command. Undo/redo is blocked while loading/generating/exporting.
- Restoring history invalidates the plan view and preset request revision, clears the active
  transition/trigger and republishes semantic plan/UI values. A pending response for an old
  plan cannot apply even with reused point IDs. An uncommitted timeline drag is cancelled.
- Save is not an undo command and does not clear history. The existing content signatures
  still decide unsaved status: undoing to the saved content becomes clean; undoing away becomes
  dirty. History never saves implicitly and never rolls back browser storage.
- Global capture-phase **Ctrl/Cmd+Z**, **Ctrl/Cmd+Shift+Z**, **Ctrl+Y** work with canvas, body,
  buttons, ranges, selects and text fields focused. This intentionally gives application undo
  priority over native text undo, as requested. A genuinely changed time draft commits before
  undo; the rounded display of an untouched time must not generate a phantom edit. Invalid
  time drafts reset to the current value. Keyboard repetition does not drain the entire stack.
- IME composition and Alt-modified keys retain native behavior. Modal save/export decisions
  block history behind the modal, independent of focus; loading/generation/export does too.
  Browser chrome/OS shortcuts outside the webpage cannot be intercepted.
- Playback position/state, selection, viewport/snap/follow/layers/quality preferences, file
  loading, Save and export are excluded. The broader setting covers MVP artistic edits;
  it does not introduce cross-page history for the separate legacy dashboard.
- Toolbar exposes Undo/Redo, disabled availability, next action in tooltips, shortcut hints,
  scope checkbox and eligible step counts. The scope tooltip explains its inclusion boundary.

Design references: [Qt Undo Framework](https://doc.qt.io/qt-6/qundo.html) and
[QUndoStack](https://doc.qt.io/qt-6.10/qundostack.html) describe command grouping, bounded
history, branching and clean-state concepts; [MDN keydown](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event)
documents focused targets, propagation and composition. The two-domain scope policy above is
the project's explicit design choice, not a claim of one universal undo-scope standard.

### Manual acceptance

1. Load a track. Undo/Redo must start disabled. Change Strength/transition/preset/time, move
   a moment, add/delete one and change Morph scale; undo and redo each using toolbar buttons.
2. Drag Strength several positions without releasing: one Undo restores its starting value.
   Repeat for Morph scale and (with Include visual tuning on) a macro/Advanced slider. Hold an
   arrow key to change a focused range; release, then Undo once.
3. Change a moment and an Advanced value. With the checkbox off, Undo restores only the moment.
   Turn it on and Undo the Advanced edit; Redo restores it. Toggle several times and confirm
   the toggle itself is never undone and no unrelated values change. Make a new edit after
   Undo: the old redo branch must be gone in both scopes.
4. Save a changed journey, Undo it (unsaved), then Redo it (clean). Repeat with visual tuning.
   Save must not discard history, and the existing leave modal must reflect the restored values.
5. Regenerate Activity/Variation, Undo and Redo. Check the prior manual points, options and
   morph values return together. The regenerated result must return without re-running analysis.
6. Focus the canvas, body, a button, the time field, a preset select and a slider in turn;
   test Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y. An untouched rounded time field must not steal
   the undo step. An edited valid time field commits and undoes that time edit first.
7. Open the unsaved-save modal or export dialog: shortcuts must not modify the background.
   During generation, Undo/Redo remain unavailable. Load another track: history resets, scope
   stays selected, previous track edits cannot reappear. Verify desktop/mobile/fullscreen layout.
8. During playback, undo/redo moment edits and seek across them; verify transitions remain
   coherent. This is manual visual/audio acceptance, beyond controlled stale-response tests.

Task 3 remains blocked on the user's manual acceptance and explicit approval of task 2.

### Task 2 validation record

Runtime discovery again found bundled Node v24.19.0 and no npm on PATH. Used the package
scripts' local Node entrypoints without installing dependencies. Exact validation commands:

```powershell
node --test tests/mvp-history.test.mjs tests/mvp-async-lifecycle.test.mjs tests/mvp-unsaved-changes.test.mjs tests/mvp-track-storage.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
node --test tests/*.test.mjs tests/ui/*.test.mjs
git -c safe.directory=C:/novy diff --check
```

- **59/59 targeted tests pass**, including 300-step eviction/full replay, 4000 deterministic
  mixed-scope edit/undo/redo operations with per-domain continuity assertions, all keyboard
  target types, modifier/IME/busy behavior, gesture grouping/cancellation, scope/branch rules,
  saved-baseline status, generation restoration, stale preset invalidation and track reset.
- TypeScript and production build pass. The existing >500 kB shared bundle warning remains
  informational. The initial build during concurrent testing also logged plugin timing advice.
- Final full suite after the time-draft fix: **890 tests, 881 pass, 9 fail**, 424.8 s. All nine
  failures match the existing R4 baseline: clip-profile lines 146/237/250/267, geometry-LFO
  line 175, preset-differentiation lines 84/109, projected-motion lines 109/116. These test,
  renderer and preset files are unchanged. Earlier full run before the precision regression
  fix/new test: 889 tests, 880 pass, the same nine failures, 243.2 s. No green full-suite claim.
- Browser testing found and fixed a rounded-time draft issue: an untouched 12.4567-second
  model time displayed as 12.5 was incorrectly committed before keyboard undo. The new test
  covers untouched, genuine and invalid drafts, and browser retesting verified the fix.
- Full browser automation used the local dev server (`node node_modules/vite/bin/vite.js
  --host 127.0.0.1`, HTTP 200) and a synthetic 19-second WAV. Verified: Strength 23% to 100%,
  Ctrl+Z from a focused time field restored 23% and clean state; Ctrl+Shift+Z from the preset
  select restored 100%. Advanced Line stroke remained 100% during dramaturgy-only Undo;
  enabling the wider scope allowed its Undo to 50% and Ctrl+Y from a button restored 100%.
- Clicking the canvas then pressing Ctrl+Z worked. A real pointer drag of Morph scale from
  1 to 2.25 created exactly one entry; Undo restored 1 and cleared the unsaved state. A new
  gesture cleared the old redo branch. Save followed by Undo was dirty, Redo clean. A genuine
  focused time draft (12.0) was committed and undone to 12.5 without undoing the previous morph.
- Screenshot confirmed readable Undo/Redo/scope/count controls. Browser warning/error logs
  were empty. The native regenerate confirmation was not exposed by the automation and the
  button remained inactive, so accepted regeneration replay is covered by controller tests
  and remains a manual browser check. Cmd shortcuts are covered by input tests, not a Mac.
- The first browser navigation found no running dev server; a task-owned server was started.
  One file upload/state call stalled for roughly six minutes, then the next DOM inspection
  confirmed successful analysis. Later checks used short DOM snapshots; one range-target
  shortcut timed out and a button-target Ctrl+Y completed the intended check. These are tool
  limitations, not a claim that every browser scenario passed.
- Not exercised: audible playback/seek/transition evaluation while undoing, encoded export,
  physical mobile/touch and fullscreen layout, or process-kill recovery. The manual checklist
  above remains required. History is deliberately in-memory and bounded by steps; maximum
  memory still scales with the size of the loaded plan.
- Reviewed live diffs and local documentation references; `diff_export.ps1` was considered
  and skipped because a branch/PR snapshot was unnecessary for this working-tree handoff.
  Graphify's scoped `affected MvpVisualController --depth 2` attempt again failed because its
  Python launcher was inaccessible; targeted source/governance reads were used instead.
- Temporary browser test tabs, WAV and test logs were cleaned up; the task-owned dev server
  was stopped after browser QA. Final whitespace and local document reference checks pass.

Task 2 implementation is complete and awaiting the user's manual acceptance. Task 3 has not started.

### Task 2 extension: explicit history/workspace checkpoint (2026-09-22)

Integration role: senior frontend/state architecture engineer, with sole ownership of the
cross-boundary UI/audio handoff. This extension supersedes the earlier in-memory-only history
description. Task 3 (Reduced load / costly controls) remains unstarted pending user acceptance.

Work decomposition and outcome:

1. Define durable state and identity: retain the existing analysis SHA-256 storage key; add
   full-file SHA-256 identity for history. Inspection found no MD5 implementation in active
   source or the historical v0.1/v0.2 trees. A filename/descriptor match alone is not enough.
2. Add a validated versioned checkpoint and interned journal archive. Preserve generated/effective
   plans, all musical controls, both branches, scope and the full allowlisted workspace view.
3. Extend the shared leave modal with Save history + workspace; Save all includes it. Individual
   panel saves stay independent. Add proactive Save session and explicit history opt-out.
4. Add one-use localStorage restoration: consume the latest capability at startup, retain a pending
   checkpoint in memory, and associate only after matching user-selected file bytes and accepted
   analysis. Re-save is required before another departure. No audio file or sample storage exists.
5. Validate schema/continuity/size, failure/partial publication, token ownership, file identity,
   save/load/hash races and restored history. Run browser save/reload/reselection acceptance.
6. Update feature/AC docs and governance. `AGENTS.md` now links the dedicated persistence
   contract; architecture/testing/anti-pattern docs refer to it. Checked all root-linked governance
   docs for drift; `CLAUDE.md` remains a thin inheritance shim. No dependencies were introduced.

The user clarified that audio must never be stored. The final implementation only persists JSON,
file name/size and a digest. The initial experimental IndexedDB helper was removed before handoff.
Audio bytes are read transiently once for hashing during load; the audio owner invalidates its
previous worker synchronously before waiting, and accepted publication waits for the hash.
No DSP, worker message schema or renderer-loop change is part of this task.

The exact durable-state inventory and transient exclusions are documented in the feature contract.
Playback is paused by Save and restored via AudioEngine seek. Autoplay/native fullscreen/export
jobs are not replayed. An explicit size budget rejects excessive saves instead of trimming commands.
The latest checkpoint is a next-visit restore, not a persistent multi-track history library. A small
localStorage capability survives tab closure; the first new page visit consumes it. Musical panel
saves remain after checkpoint cleanup. No automatic large history writes run on edit or unload.

#### Manual acceptance for the extension

1. Load a track, change Strength, move/add/delete a moment and adjust Advanced controls. Make
   both undo and redo available, switch Include visual tuning, change timeline visibility/layers,
   snap/follow/draw, preview quality, zoom and playhead. Open Save session; confirm the three
   separate save choices and Save all are available as appropriate.
2. Save only automation, then visual tuning. Confirm the modal stays open for history and the
   clean panel buttons disable. Save history + workspace; reload and select the same audio again.
   Verify the journal branches, scope, values, selections, view and paused position return together.
   Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y must still work across focus targets.
3. Save all directly with both panels dirty. Reload/select the same file; verify both musical
   slices and history. Repeat using an unchanged file renamed on disk; it must match. A changed
   or re-encoded file must not inherit the journal, even if its filename/length/BPM match.
4. Restore once, then leave without re-saving history. On the next reload/select there must be
   no previous journal. Also test Save, edit/scope/view change, then leave without another Save.
5. Save the two panels individually and choose Do not keep history. Reload/select: panel settings
   must survive but history must be empty. Keep editing/Escape must retain live changes.
6. Test a storage-quota failure: the modal must stay open and changes remain available. Test
   quick file switches while loading. A stale hash/analysis must not restore the wrong workspace.
7. Confirm restored playback stays paused, fullscreen requires a gesture, and export is idle.
   Test mobile sheet and unsupported export-resolution fallback on relevant physical devices.

#### Validation evidence

Node v24.19.0 was available through the bundled runtime; npm was absent. Used the declared
package scripts' equivalent local Node entrypoints, without installing anything:

```powershell
node --test tests/mvp-history.test.mjs tests/mvp-session-persistence.test.mjs tests/mvp-async-lifecycle.test.mjs tests/mvp-track-storage.test.mjs tests/mvp-unsaved-changes.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
node --test tests/*.test.mjs tests/ui/*.test.mjs
git -c safe.directory=C:/novy diff --check
```

- Focused suite: **79/79 pass**. The last regeneration-start invalidation and pending-checkpoint
  discard refinements were followed by **49/49 controller/persistence tests**, TypeScript and a
  fresh production build. The existing >500 kB shared chunk warning is informational.
- Last full suite: **910 tests, 901 pass, 9 fail**, 223.9 s. The same R4 baseline failures remain:
  clip-profile lines 146/237/250/267, geometry-LFO line 175, preset-differentiation lines 84/109,
  projected-motion lines 109/116. These test/preset/renderer paths are unchanged. Earlier complete
  runs during this extension were 908/899/9 (206.1 s) and 909/900/9 (371.6 s), before the final
  additional edge-case tests. The two small follow-up invalidation refinements above received
  targeted validation, not a fourth full run. Do not report the full suite as green.
- Full browser automation used the task-owned Vite server and a synthetic 17-second WAV.
  Save history -> reload -> reselect the file restored redo, selected point, scope, Draw,
  hidden timeline and position. Redo restored Strength 100%; Ctrl+Z in the focused time input
  returned it to 35%. Explicit history opt-out -> reload -> same file yielded zero undo/redo
  while the saved musical setting remained. Paused playback was shown after restoration.
- Individual automation and visual-tuning saves left the modal open for history. Save all,
  close tab, open a new tab and select the same file restored Strength 100%, Line stroke 100%
  and Reduced load. Wider-scope Undo returned Line stroke to 50%; focused-slider Ctrl+Y restored
  100%. The final browser console had no errors/warnings. A screenshot verified readable modal
  copy and all six buttons in a two-column layout. No audio was stored by this final code.
- Browser limitations: the first URL mistakenly used `/mvp.html` (404); `/mvp/` worked. One file
  chooser timed out after reload; using the visible topbar Load Track control completed the check.
  Hot reload briefly referenced the removed experimental media module while that multi-file edit
  was in progress; clean reloads and the final build/browser had no unresolved module errors.
  Preview quality was restored to Automatic after testing; task-owned tabs/server and temporary
  WAV/log files were cleaned up. No user tracks were used.
- Governance/document link audit: **16 files, 35 relative links, no missing targets**. Whitespace
  check passes (Git reports only Windows line-ending conversion notices).
- Graphify's previously recorded Python-launcher access-denied failure remains the navigation
  limitation; scoped source searches and ownership/governance reads were used. No graph rebuild.
- `diff_export.ps1` was considered and skipped: no PR/branch snapshot was needed. Live working-tree
  diffs, whitespace checks and local link verification were used instead; no commit or PR created.
- Residual limits: generic native unload prompts and mobile termination cannot be replaced by
  a custom save dialog; storage quota/eviction applies; re-encoding changes byte identity. Physical
  mobile/touch, audible timing, OS fullscreen and encoded export remain manual acceptance items.

Task 2 was subsequently accepted for progression. The user explicitly skipped task 3 and
authorized task 4. Its earlier clarification remains a deferred requirement, not completed work.

## Task 4: recurring percussive BPM

Single integration owner: implementing audio/DSP engineer. Scope: `TempoEstimator`,
`GridAligner`, analysis version, tests and documentation. The Reduced load selector, UI,
renderer, playback lifecycle and history persistence were not edited for this task.

### Decomposition and implementation

1. Audit the existing flux envelope, whole-track autocorrelation, metric resolution and
   correctness/golden fixtures. The old implementation already used positive spectral flux;
   its issue was global averaging/normalization and duration-wide metric coverage, not a
   literal division of track length into beats. Baseline Analyzer suite: **96/96 pass**.
2. Write failing regressions before source changes. Six of the first eight new tests failed:
   loud short competing rhythm (100 instead of 128 BPM), isolated attacks, a huge one-off hit,
   invalid samples/clocks and half/double resolution across long breaks. Existing behavior
   already passed the simple silence/phase and mixed-tempo cases.
3. Add fixed 12-second local autocorrelation windows with a 6-second hop, bounded attack
   cap, minimum repeated evidence, amplitude-independent window weights and tempo consensus.
   Keep the existing comb/prior/range and expose only internal evidence-window metadata.
4. Normalize raw low/mid/high positive flux locally before mixing, crossfade normalization
   windows and use local onset thresholds. Resolve aliases on accepted active spans with
   long gaps excluded and an explicit sparse-grid penalty. Raw-audio DnB regression exposed
   why local autocorrelation alone is insufficient: whole-track band normalization could
   still hide the quiet hats. This was fixed without changing visual percussive features.
5. Retain the sole DP timing/beat-event pipeline and unchanged worker schema. Bump analysis
   algorithm version 2 -> 3. Preserve all previous task changes. No dependencies or snapshots
   changed; the original short golden and exact headless baselines remain valid.
6. Document [algorithm, costs and limits](../features/analyzer-local-tempo.md), update worker
   ownership/testing governance and BPM metadata, then hand off only task 4 for manual review.

### Validation

Node v24.19.0 was available via the bundled runtime; npm and Bun were absent. Used local
Node entrypoints matching the declared scripts. Principal commands:

```powershell
node --test tests/analyzer*.test.mjs
node --test tests/analyzer-local-tempo.test.mjs
node --test tests/analyzer-local-tempo.test.mjs tests/analyzer-golden.test.mjs tests/analyzer-verification.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
node --test tests/*.test.mjs tests/ui/*.test.mjs
git -c safe.directory=C:/novy diff --check
```

- Targeted final algorithm checks: **36/36 pass**, including 13 new local-tempo tests,
  nine golden snapshots, golden determinism and all existing musical/semantic verification.
  Intermediate failures drove the band-normalization and sparse-grid fixes; golden snapshots
  were not loosened or regenerated. The final full run follows a prior-computation optimization.
- TypeScript and the two-entry Vite production build pass. The existing >500 kB shared chunk
  warning and Vite plugin-timing notices are informational; the analyzer worker bundle builds.
- Final complete Analyzer suite: **109/109 pass**, 64.6 s, after the positive-background
  attack guard. The first full suite was **923 tests, 913 pass, 10 fail**, 242.5 s: nine
  known R4 preset assertions plus the old parity assertion demanding a candidate from two
  attacks. That assertion was deliberately replaced with the version-3 insufficient-evidence
  contract (one/two/three attacks above a positive background -> no candidates, low-confidence
  fallback; four attacks -> candidates). The expanded check also prompted a baseline-removal
  guard so a positive last-frame plateau cannot count as the fourth attack. The final Analyzer
  run, TypeScript and fresh production build pass.
- Final full suite: **923 tests, 914 pass, 9 fail**, 271.9 s. Only the same pre-existing R4
  preset assertions remain: `wormhole-clip-profile` lines 146/237/250/267,
  `wormhole-geometry-lfo-integration` line 175, `wormhole-preset-differentiation` lines 84/109,
  `wormhole-projected-motion` lines 109/116. Those preset, renderer and test paths were not
  changed. The full suite is not green; this BPM task introduces no remaining test failure.
- Documentation links: **7 files, 18 relative links, no missing targets**. Whitespace check
  passes; Git only reports Windows line-ending conversion notices. Root governance ownership
  remains unchanged; `AGENTS.md` and `CLAUDE.md` required no edits in this task.
- A deterministic 50-frame/s pulse-envelope microbenchmark compared HEAD with the new
  estimator (five measured repetitions after warmup). Initial uncontended medians for
  30/300/1800 seconds were 0.52/4.59/18.69 ms old and 2.49/31.67/179.28 ms new. After prior
  precomputation, a run concurrent with full tests/build measured 0.75/5.40/37.05 ms old and
  3.00/35.97/210.82 ms new. These are local estimator-only diagnostics, not end-to-end loading
  promises or performance assertions. Work remains linear; the extra offline evidence costs
  CPU but adds no playback-frame DSP. No claim of a speedup is made.
- Graphify navigation was attempted with `graphify affected TempoEstimator --depth 2`; its
  configured Python launcher failed with access denied. Used scoped `rg` and direct source
  reads, without graph rebuilding. `diff_export.ps1` was considered and skipped because
  local working-tree review was sufficient; no fetch, commit or PR was needed.
- Browser interaction was not rerun for this headless-DSP-only task. Raw audio -> complete
  analysis, worker/headless parity, schema and production worker compilation provide automated
  integration coverage. Real music, audible timing and visual feel remain manual checks.
- Temporary probes, benchmark scripts and logs were removed after recording results. No
  server was started or user-owned process stopped. No audio file was stored or uploaded.

### Manual acceptance gate

1. Reload the app and re-select a known fixed-tempo house/techno track. Compare displayed BPM
   with its known BPM, including a version with a long intro/outro or breakdown if available.
2. Try a slow 70–90 BPM track and a fast 170–180 BPM DnB track. Check that the former does not
   double and the latter does not settle at half-time solely because of silent sections.
3. Try material with quiet percussion followed by a much louder passage, plus one track with
   an isolated loud impact. Confirm repeated musical rhythm drives the displayed tempo.
4. Inspect playback/seek, visible dramaturgy alignment and flashes through a breakdown.
   Silent extrapolated beats must not cause a flood of beat flashes. Ambiguous/variable-tempo
   music still has one estimated tempo; it is not a tempo-map editor.
5. Existing saves use analysis-descriptor fingerprints. If corrected BPM/sections/bar count
   change that fingerprint, older panel saves may not auto-associate and history must not
   restore onto incompatible analysis. Old localStorage records remain untouched.

The user subsequently authorized progression past the intervening bug fixes and explicitly
deferred mobile performance work. Task 5 follows; task 3 remains skipped.

## Task 5: sub and bass response

Single integration owner: implementing audio/DSP and rendering engineer. Completed in this
task: offline fixed-band extraction; version-4 frame/schema/default publication; modulation
and Wormhole consumption; deterministic regression/render checks; documentation/governance.
Details: [Sub and bass response](../features/analyzer-low-frequency.md).

The existing short-window/per-band display normalization was unsuitable for distinguishing
relative sub/bass body. The new focused extractor publishes sustained energy and positive
spectral change separately, with longer centered Hann windows, shared normalization and an
absolute noise floor. Beat detection remains independent. Work is offline and evaluated at
25 Hz before interpolation to the existing frame clock; runtime adds only bounded scalar work.
Existing grain release behavior, camera/lens stability and sensitivity ownership are preserved.
No audio storage, dependencies, localization work or mobile-quality optimization was added.

### Validation and limits

- The initial regression failed because the four published fields were absent. Final focused
  DSP/modulation/renderer tests: **38/38 passed**, including 13 low-frequency tests. Separate
  schema/parity/contracts/modulation/motion run: **65/65 passed**.
- Final full suite: **963 total / 954 passed / 9 failed**, 252.0 s. Failures remain the same
  known R4 baseline: four clip-profile, one geometry-LFO, two preset-differentiation and two
  projected-motion assertions. No golden baselines were regenerated or loosened.
- TypeScript and production build pass, including the worker bundle. Existing shared chunk
  >500 kB warning remains informational. Node is the bundled runtime; npm is unavailable.

```powershell
node --test tests/analyzer-low-frequency.test.mjs
node --test tests/analyzer-contract.test.mjs tests/analyzer-parity.test.mjs tests/modulation.test.mjs tests/contracts.test.mjs tests/wormhole-motion-profile.test.mjs
node --test tests/analyzer-low-frequency.test.mjs tests/modulation.test.mjs tests/wormhole-motion-profile.test.mjs tests/paused-renderer.test.mjs
node --test tests/*.test.mjs tests/ui/*.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
git -c safe.directory=C:/novy diff --check
```

- Chrome ran the actual MVP/worker/renderer on a task-owned port 5179 using an in-page
  synthetic WAV fixture (40 Hz, 110 Hz, then alternating 85/145 Hz notes). This avoided the
  previously blocked filesystem upload; it exercised the normal file-input/load flow without
  changing browser permissions or accessing user audio. Screenshot showed a nonblank Wormhole.
  DOM diagnostics showed sub ~0.565 versus bass ~0.0016 on the sub passage, then bass ~0.565
  with near-zero sub, and bass flux ~0.184 near a note change. Sustained flux settled to zero.
  Play/pause/backward seek/resume worked; console warnings/errors were empty. Precise seek/export
  scalar parity is covered by the real renderer harness; encoded video/physical mobile and
  subjective musical quality were not tested. The temporary diagnostics are not product UI.
- Native-JS extractor-only benchmark, three runs after warmup: median 135/791 ms for 30/180 s
  at 22.05 kHz, and 283/2765 ms at 48 kHz. Full tests/browser work overlapped; these are local
  diagnostics, not timing assertions or loading guarantees. No playback FFT was introduced.
- Graphify's scoped `affected SpectralFeatures --depth 2` attempt failed at its Python launcher
  (access denied); scoped source reads established actual owners instead. No graph rebuild.
  `diff_export.ps1` was considered and skipped: direct local review sufficed, no PR/commit/fetch.
  Existing unrelated edits remain. Root AGENTS.md/CLAUDE.md ownership is unchanged.
- Task-owned browser tab/server and temporary fixtures/logs were cleaned up. Product/AC and
  worker/realtime/testing governance were updated with frequency, timing and ownership limits.

### Manual acceptance gate

Reload and select a track with clear sustained sub notes, a higher bass line and distinct
note/level changes. Check local grain motion/trails through these passages, then seek backward
and replay. Sustained bass should remain responsive without repeated kick flashes; silence
should settle. Compare Audio sensitivity at zero and its normal setting. Authored grain/warp
settings can suppress the visible effect; the new feature does not override them.

The user accepted task 5 on 2026-09-22 and requested this
documentation update. Task 5 is accepted. The test instructions above remain useful for
regression checks; no further manual-result details were supplied. The user previously asked
to conserve tokens, so task 6 (HU/EN localization and tooltips) is left for a subsequent request.
Mobile performance remains explicitly deferred.
