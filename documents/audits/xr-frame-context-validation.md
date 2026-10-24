# T05a shared Wormhole context and host policy

Date: 2026-10-24. Integration owner: this chat. Owners: visuals, config/automation, lightweight
types and documentation. Audio, analyzer, gameplay, UI storage and worker protocol are unchanged.
The user accepted T04b and requested the next task with the established deploy/manual-test pause.

The accepted T01 plan splits T05 into context extraction (T05a), host/backend composition (T05b)
and deterministic exact sampling/worker capability (T05c). This delivery completes the first slice.
The applicable boundary is [ADR-011](../adr/ADR-011-shared-wormhole-frame-context.md).

## Behavior and ownership

The extracted `WormholeFrameContext` owns the existing embedded simulation, one private identity,
raw/target/resolved tuning, preset/semantic projection, signed anchors, timestamp-based decays and
one modulation/director update per accepted frame. `WormholeCanvasSource` retains only preview
cadence, revision-checked plan asset loading, surfaces, draw/carrier presentation and disposal.
Its Canvas2D/WebGL/worker consumers keep the same output contract and existing fallback behavior.

A copied version-1 policy seed explicitly supplies unboosted raw tuning, macros, Advanced boosts,
raw/meta gain mode and semantic policy. The context imports no XR defaults. The compatibility
source supplies those defaults only when a seed is omitted; an explicit host seed is used as-is.
Raw mode retains Studio controls; meta mode applies the shared macro -> clamp -> Advanced pipeline
once. The signed timeline's initial anchors now use that same seed, with prior caller defaults
retained. The new context does not run beside another host simulation: Studio/MVP remain on their
existing renderer until T05b performs the ownership handoff.

Analysis/plan are borrowed immutable publications. Live frame/features are copied before director
mutation; resolved asset objects are copied during preparation. A missing asset cannot partially
publish a new plan. Superseded/disposed adapter preparation cannot publish into the new context.
There is no per-frame fetch, another analyzer/planner, event consumer, audio clock or gameplay path.
No player-facing toggle was added; preset ownership and existing menu/persistence/copy behavior
remain the applicable rule. XR Auto/Left/Right and Note halos remain available unchanged.

## Validation and retention

Runtime: Node v25.2.1 / npm 11.6.2. No dependencies or lockfiles changed. Exact final commands,
counts and evidence hashes are in [validation data](xr-frame-context-validation-data.json).

The new test uses retained `documents/tests/WormholeCanvasSource.pre-t05a.ts.txt` (SHA-256
`173b0d2731d245798d76de6b157154d3c72c130f3e9b1c3aad4dbbe97554d436`), identical to the source
in the T04b deployment manifest. It compares complete tuning/target/frame/features/modulation/
director/transient/fade/transition records, accepted/skipped frames and route synchronization
across 60 Hz calls, pause/repeat, seek and live controls. The retained adapter deliberately uses
current dependencies to isolate the extraction; it is not a complete historical bundle replay.
Other tests check distinct raw/meta seeds, no gain compounding, copied seed isolation, immutable
analysis, atomic assets, one update/draw, stale/disposed preparation and signed initial anchors.
The existing test helper and measured analyzer source identities remain unchanged. A temporary
helper extension was reverted after the source-retention tests correctly rejected it; comparison
loading is local to the new test. No predecessor measurement/golden was rewritten.

The real browser harness `tests/browser/wormhole-spiral-history-smoke.html` is reused through the
existing Vite dev server in the in-app desktop browser. Actual Canvas2D, WebGL2 and render worker
display the same signed carrier at 1.5 s (+0.8), 2.186705093060352 s (zero within 1.3e-15) and 2.5 s
(-0.5499910301333368), including the shown song time. Console errors are empty. Raw JSON and
screenshot evidence live under ignored `logs/t05a/`. This checks raster wiring and the signed
carrier; it does not establish exact cross-backend pixels or exact worker export capability.

The existing Studio and MVP paths also loaded the retained 7 s synthetic WAV (128 BPM), played,
paused and revisited seek positions 35.7/10/35.7 percent (MVP 357/100/357 of 1000), ending paused.
Both console error logs are empty and screenshots are retained. An in-app new-tab attachment
timed out once; reusing the finished QA tab succeeded. MVP's normal unsaved-workspace guard was
handled for this disposable synthetic test session before navigating to Studio. No real user
track or session was used, saved or overwritten. The pre-existing shared Vite server was retained.

Build: `npm run build` (TypeScript + Vite). Targeted suite: 182/182 passing before the test-local
loader refinement; the final retention/context check also passes 13/13. The final cumulative suite
passes 1626/1635 cases with nine exact retained baseline failures, no new failures, cancellations
or skips. Names and full error messages match the T04b TAP evidence. All 173 earlier active test
files remain in the 174-file discovery; 215 test/helper/fixture/browser source identities are
retained. The earlier full run with the temporary helper extension is retained separately
(1635 cases, 1623 pass, nine baseline plus three protected-helper identity failures); the final
full run supersedes it. Existing Vite >500 kB chunk warnings
are informational. `git diff --check` checks tracked whitespace. No broad `diff_export.ps1` snapshot
is needed: scoped source review, retained predecessor and input manifests provide the handoff.

## Rollout and manual gate

Publish through the existing GitHub Pages `gh-pages` target. Node runs its installed publisher
because the repository's deploy script invokes Bun. Exact fallback:
`node node_modules/gh-pages/bin/gh-pages.js -d dist --nojekyll -m 'Deploy T05a: shared Wormhole frame context and explicit host policy'`.
No source push/merge or force push. The prior Pages tree is
`78b30a41cafa55bdcc3141965537bc2a526f0a3c`; publish it in a new commit to roll back.

Expected visible result: the current Wormhole image and behavior remain the same; this slice
prepares shared host integration. Manually check XR load/play/pause and a seek, Auto/Left/Right,
macros/Line stroke and retained settings; check Studio/MVP playback and presets for regressions.
Pause after deployment for the user's result before T05b. General route/director history
reconstruction, Studio/MVP shared WebGL composition, context-loss acceptance, exact export,
encoded-video parity and physical Quest performance remain later gates.

Final release: `t05a-frame-context-20261024T002109899Z`, Pages commit
`ae3b0983a475da740d877fc217930699605ad436`, parent T04b
`78b30a41cafa55bdcc3141965537bc2a526f0a3c`. Pages reports built; the public release marker,
all 16 HTML/asset byte hashes and four routes match. All 321 source inputs, including both new
runtime modules, still match the checkout. See [deployment data](xr-frame-context-deployment-data.json).

Fresh public XR loaded the retained 7 s / 128 BPM synthetic track, enabled PLAY, ran to Results
(nine notes, nine misses, no human hits) and emitted no console errors. Screenshot evidence is
`logs/t05a/deploy/live-xr-results.jpg`. Desktop immersive VR is unavailable; this is a desktop
load/render/play/end smoke, with physical Quest testing left to the manual gate.
