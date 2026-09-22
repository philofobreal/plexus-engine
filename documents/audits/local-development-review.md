# Local Development Review

Reviewed on 2026-09-22 against `0de24b14c674e1ddc4a497a5d16630fae19b1aae` (`master`).
Scope includes tracked edits and untracked product source, tests and documentation, plus
classification of the local tool settings. The index was empty and was not changed.
This review follows the [implementation inventory](mvp-renderer-integration-audit.md).

**Verdict: the mock repair and R1 async handoff repair are complete; the entire local integration
is not ready to be presented as a validated release.** Two reproduced MVP behavior defects, an
unresolved preset contract and a documentation/governance conflict. The
[commit plan](local-change-commit-plan.md) partitions the current work, but does not imply
these remaining findings are resolved. No commit, push, preset retuning or R2-R5 product fix
was performed. The authorized R1 follow-up is recorded below.

## Findings and disposition

### R1 — P1: Async plan publication can overwrite a newer load or generation

**Resolved in the working tree.** Owner: UI facade; no audio/worker/State schema change.
Location: [MvpVisualController](../../src/ui/mvp/MvpVisualController.ts), `loadFile`,
`finishLoading`, `regeneratePlan`, preset handoffs and tuning persistence.

Before repair, `loadFile` started an async plan build after analysis and published its result
without checking whether another file was selected. `regeneratePlan` likewise published whichever
request finishes last, independently of the selected Activity/Variation. AudioEngine's
worker request id does not guard these later UI promises. The ready callback also fires
before plan/restoration completion, making the intermediate state usable.

Reproduced with real transpiled controller methods and controlled promise completion:
start plan A, load B, finish A -> current analysis is B but `performancePlan` is A. Two
regenerations completed in reverse order left the Active selector with a Calm/Stable plan.
Only IO/planner scheduling was stubbed; State writes and facade control flow were real.

The repair introduces load and plan revisions and captures generator inputs before awaiting.
Only the accepted request publishes; ready follows plan and saved tuning preparation. A new
load prevents old restoration/save/preload writes. Preset application checks load, plan and
point id; plan publication invalidates even old-plan requests started during regeneration.
Superseded errors stay silent; current preparation failure reports an error and supports retry.
The 13 controlled lifecycle regression tests in
[mvp-async-lifecycle.test.mjs](../../tests/mvp-async-lifecycle.test.mjs) pass. Their planner/audio/IO
boundaries are controlled; controller methods and pure helpers are real. R2 and R3 remain open.

### R2 — P2: Paused journey scrubbing commits the previous playhead

Location: [MvpUI](../../src/ui/mvp/MvpUI.ts), line 165, and
[JourneyTimeline](../../src/ui/mvp/JourneyTimeline.ts), lines 301-304.

The transport scrub callback updates the journey playhead, but the journey's own callback
updates only controller preview time and transport text. On pointer release JourneyTimeline
commits `this.playheadTime`, not the last scrubbed time. The settled-pause gate suppresses
the dashboard refresh that previously could incidentally synchronize those values.

A real JourneyTimeline-method probe starting at 10 s and scrubbing to 60 s reported a 60 s
preview but committed 10 s. The callback uses the same state updates as the actual MVP
wiring. During playback the result can instead lag the last 15 Hz dashboard update.

Fix direction: retain and commit the latest scrub time in the gesture owner (or explicitly
update its playhead from the scrub callback). Test a paused click, paused drag and rapid
release without any intervening renderer/dashboard tick.

### R3 — P2: A new track without saved tuning inherits the previous track's boosts

**Resolved by sequential development task 1 (2026-09-22).** The facade now resets per-track
controls on load and restores only the accepted track's validated payload. See the
[task-1 validation and manual gate](sequential-development-plan.md). The original reproduction
below is retained as historical evidence; other findings in this review are unchanged.

Location: [MvpVisualController](../../src/ui/mvp/MvpVisualController.ts), `loadFile`
and `restoreMetaTuningForTrack`.

Loading a file clears the fingerprint but not macros/advanced boosts. Restoration returns
immediately when no saved entry exists. Consequently a new unsaved song retains the prior
song's gain settings and Square choice instead of starting from the documented defaults.
This also makes the same unsaved song look different depending on what was opened before it.

Reproduced through the real load/analysis/restoration flow with an empty storage result:
after loading another track, Intensity remained 1.0 rather than 0.5 and Grain line ends
remained Square (1) rather than Rounded (0).

Fix direction: reset per-track tuning at the accepted load boundary, then restore only that
track's validated payload. Keep the separately owned Preview quality preference. Couple
this with the implemented load revision so old restoration cannot undo the reset; test A -> unsaved B -> A.

### R4 — P2: The six preset edits violate the existing authored role contract

Location: [establish](../../public/visual-tuning-presets/vos-wh-establish.json),
[drive](../../public/visual-tuning-presets/vos-wh-drive.json),
[sparse](../../public/visual-tuning-presets/vos-wh-sparse.json),
[drift](../../public/visual-tuning-presets/vos-wh-drift.json),
[overdrive](../../public/visual-tuning-presets/vos-wh-overdrive.json),
[punch](../../public/visual-tuning-presets/vos-wh-punch.json).

The final full suite has nine failing assertions in clip profile, geometry LFO integration,
preset differentiation and projected motion. They cover background-master persistence,
minimum opacity, weak-role depth, role contrast, near/far scale, normalized separation and
speed/projected-motion ordering. See [current authored values](../features/wormhole-clip-profile.md#current-preset-tuning).

A controlled comparison copied the current source and the four affected suites into an
isolated scratch directory, replacing only these six JSON files with their HEAD versions.
All **38/38** tests then passed. The working presets were untouched. This isolates the nine
failures to the preset edits under the existing tests, rather than to the renderer kernels
or the mock repair. It does not decide whether the old artistic contract is preferable.

Fix direction: explicitly choose the intended role/background contract, then adjust either
the presets or the reviewed acceptance matrix and corresponding behavioral tests. Do not
lower thresholds solely to obtain a green run. Keep authored presets in a separate commit.

### R5 — P2: Skybox implementation and feature documentation contradict the architecture contract

Location: [CosmicWormholeIdentity](../../src/visuals/CosmicWormholeIdentity.ts), line 2604;
[architecture contract](../governance/architecture-contract.md), line 114.

The new skybox code rotates plate points around the screen center from bounded horizontal
heading. The visual feature document describes that implemented behavior, but the architecture
contract still says cosmos point fields must not rotate. Foreground, stars and galaxies are
unaffected, so this is a narrow skybox decision rather than a whole-canvas rotation.

Fix direction: reconcile the already tested artistic result with an explicit skybox exception
and decision record, or restore the constrained motion if the contract is intended to remain
universal. A green angular-agreement test alone does not resolve the conflicting policy text.

## Repair completed in this review

The background-turn-cue, long-run and vertical-bend geometry fixtures now explicitly return
`null` from `beginFieldRaster`, exercising the renderer's supported vector fallback; an
unexpected `drawFieldRaster` throws. Geometry thresholds and preset files were not relaxed.

The long-run fixture also pins grain-copy density to zero after applying its preset. Its
intentional scene is a fixed 12-star sample with an empty foreground pool; current material
presets otherwise repopulate that pool before raster acquisition (717 draw calls appeared
where 12 were expected). This is fixture isolation, not a product density change. Real
material output remains covered by the integration/raster/surface tests in the full suite.

The final 30-minute simulation passes with maximum visible displacement 14.269982 px,
route history 360/360 and authored speed anchors 82/256. Playback/export draw lists match;
the measured seek-heading delta is zero. The 30/120 fps continuity checks remain unchanged.

## Coverage and validation

Reviewed by ownership: shared automation extraction and cache; MVP composition/DOM controls,
file lifecycle, tuning/persistence, timeline and export wiring; renderer host, pause snapshot,
size/density/quality policy; direct/transition/export targets; material bounds, smoothing and
conversion; skybox/spiral changes; preset data; build entries; tests and documentation.
No new DSP, audio clock, worker schema or State shape implementation is present. The pure
raster optimizations retain frozen-reference equivalence coverage. Browser preference and
track artistic settings have separate owners. Additional low-priority gaps remain: shallow
stored-payload validation, descriptor-based fingerprint collisions, partial UI helper extraction,
and no full browser/audio MVP lifecycle coverage. Controller async coverage is now present
in the working tree as an untracked test file included in the manual commit plan.

| Check | Result |
| --- | --- |
| Full Node suite after R1 repair | **844 total, 835 pass, 9 fail**; the same nine preset assertions remain. Before R1: 831 total, 822 pass, 9 fail |
| Corrected long-run suite | **4/4 pass** |
| R1 lifecycle + macro projection + automation editing | **44/44 pass**, including 13 new lifecycle tests |
| Affected preset suites with only HEAD preset JSON in an isolated copy | **38/38 pass** |
| Controlled MVP probes | Four reproductions across R1-R3; these confirm bugs, not acceptance passes |
| TypeScript and two-entry Vite production build | Pass; existing large-chunk warning remains |
| Proposed commit order in an isolated HEAD source copy | Before R1 repair, TypeScript passed after each of groups 1-4; current complete-tree TypeScript also passes. Intermediate full test suites were not run |
| Whitespace, documentation links and commit-path inventory | Pass: 109 local links; 97 paths assigned once; nine PowerShell blocks parsed without executing them; index empty |

Node/npm discovery found the bundled Node runtime and no npm executable, so the declared
scripts were invoked using Node and local package entrypoints. Exact principal commands:

```powershell
node --test tests/wormhole-background-turn-cue.test.mjs tests/wormhole-long-run.test.mjs tests/wormhole-vertical-bend.test.mjs tests/wormhole-grain-material-integration.test.mjs
node --test tests/wormhole-long-run.test.mjs
node --test tests/mvp-async-lifecycle.test.mjs tests/mvp-macro-tuning-mapper.test.mjs tests/automation-plan-editing.test.mjs
node --test tests/*.test.mjs tests/ui/*.test.mjs
node node_modules/typescript/bin/tsc
node node_modules/vite/bin/vite.js build
git diff --check
```

The first targeted run passed 33/34 and exposed the long-run foreground-pool contamination;
the density isolation and final full run followed it. In the isolated copy only:

```powershell
node --test tests/wormhole-clip-profile.test.mjs tests/wormhole-geometry-lfo-integration.test.mjs tests/wormhole-preset-differentiation.test.mjs tests/wormhole-projected-motion.test.mjs
```

Temporary Node scripts invoked transpiled real methods with controlled IO/DOM boundaries
for the original R1-R3 review. They and the comparison copy were removed after recording results.
The R1 follow-up opened a separate in-app browser tab at `http://localhost:5173/plexus-engine/mvp/`
and verified the first-run screen and disabled Export button. No new file-load/playback browser
smoke was completed. Previous broader browser evidence is in the integration audit; this review
does not claim new mobile, fullscreen, audible-playback or encoded-export validation.

`diff_export.ps1` was skipped because it fetches and compares branch history; the review
used local HEAD/index/untracked inventories. `graphify affected PausedPreviewGate --depth 2`
and the follow-up `graphify affected MvpVisualController --depth 2`
could not start its Python launcher (access denied); scoped `rg` and direct source inspection
were used instead. No dependencies were installed. The local Claude permission file was
inspected as machine-specific tooling and is separately accounted for in the commit plan.
