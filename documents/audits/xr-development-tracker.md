# Plexus XR development tracker

Started: 2026-10-23; current checkpoint: 2026-10-28 (Europe/Budapest). Integration owner: the agent in this chat.

**T12d now gives Musical a wider percussive event choice before visual proximity suppression, with a separate legacy Activity budget. T13g scene-entry refinement remains delivered. The Classic source and legacy analysis stay exact; source/instrument identity, macrostructure and meter precision remain open.** Existing MVP/XR Offscreen rendering stays intact; annotated musical accuracy remains unproven.
Source requirements: the user-provided `plexus-xr-fejlesztesi-master-prompt.md`, T00-T25.
Canonical policy: [AGENTS.md](../../AGENTS.md); this is a delivery record, not new governance.

User steering, 2026-10-24: every player-facing feature switch, including future ones, belongs in
the shared menu descriptor model, localStorage and Copy settings output. Existing technical debug
URL overrides may remain (explicit clarification). T02c replaces the new halo query flag with a
live Visuals > Note halos choice. For this follow-up ONLY the user waives deployment and the
manual pause and explicitly requests continuation to T04. T04 resumes normal deploy/manual handoff.

Further steering: relevant visual behavior is configurable in the preset itself. T04a therefore
uses preset-owned `wormholeSpiralDirection`; automatic pair overrides require explicit permission,
and the player's persisted Auto setting follows that resolution. Manual Left/Right are overrides.
Future implementations must evaluate preset relevance rather than automatically using a global
switch for preset-owned visual behavior. Halo preview remains a player presentation setting.

The user requires deployment after every completed task, followed by a handoff and a pause for
manual testing. This later explicit instruction applies from T03 onward, including the current
task. Publish to the verified existing GitHub Pages target until a separately verified hosting
migration changes it; this does not select an unknown DotRoll environment. A passed build or
desktop test does not authorize skipping the pause. Product questions are raised when the
dependent task becomes actionable. The final review uses independent read-only subsystem audits;
one integration owner implements and validates all cross-boundary fixes.

Every task/subtask handoff must also give a concise Hungarian explanation of what the user
should expect from the delivered change: visible/behavioral effect, or explicitly internal-only
scope, plus the few concrete checks for manual testing. State what is still a later delivery so
the user does not look for an unimplemented visual or behavior. This communication preference
does not authorize starting the next task before manual feedback.

Current deployment target: `https://philofobreal.github.io/plexus-engine/`, repository `origin`,
branch `gh-pages`, path `/`, HTTPS enforced. Current releases use the guarded
`node scripts/release-pages.mjs prepare TASK`, then `publish` and `verify`: a clean committed
source is rebuilt, HEAD/full build-input inventory are checked, and the public artifact is verified.
The historical commands below explain the earlier deployments. Use the available Node/npm path: `npm run build`,
then the installed `node node_modules/gh-pages/bin/gh-pages.js -d dist --nojekyll` (plus a task
commit message). This is the equivalent of the existing Bun-based deploy script without a runner
migration. Before publishing retain the old Pages commit and validate the concrete dist; afterward
verify the Pages build, public release identity, HTML/assets and task behavior. No repeat user
confirmation is needed for this already-authorized task deployment. Source-branch push/merge and
DNS/hosting migration are separate operations, not implied by static deployment.

| Task | Owner / outcome | Dependency | Status / evidence |
| --- | --- | --- | --- |
| T00 | Integration: checkout, baseline, impact map | None | User accepted continuation on 2026-10-23; [baseline](xr-development-baseline.md); unreported device metrics remain unmeasured |
| T01 | Integration: separate contract ADR proposals, decisions, measurement plan | T00 manual feedback | User agreed to staged plan and continuation; [plan](xr-development-plan.md) |
| T02 | Gameplay + XR: minimal role-sidecar and resolution patterns from PR 8 | T00-T01 | T02a accepted; T02b implemented/deployed (`75bccd8`), accepted by subsequent user continuation; [T02a evidence](xr-role-resolution-validation.md), [T02b evidence](xr-halo-lifecycle-validation.md) |
| T03 | XR: 500 m setting, persistence, frustum | T00 | User accepted continuation; deployed to GitHub Pages (`665a608`); [checks/deploy evidence](xr-500m-background-validation.md); physical measurements remain unmeasured |
| T04 | Config + automation + visuals + XR: signed effective spiral | T01 | T04a accepted; T04b coherent-channel/consumer delivery: 238/238 targeted, full 1627/1618 pass/9 retained failures. Pages 78b30a4; manual handoff below. General exact-frame host reconstruction remains T05 |
| T05 | Visuals + host composition + export: shared WebGL Wormhole | T01 | T05a/b/c accepted; T05c deployed (b5a1a40); [exact capability evidence](xr-exact-frame-validation.md). Export workflow remains T19; native 3D remains T06 |
| T06 | Visual contracts + XR: opt-in native 3D | T01, T04-T05 | Native experimental; T06e2 clean Wall Off / Galaxies 0 baseline deployed. Further Wall/T06f deferred by user; Hybrid default. [Evidence](xr-wall-default-off-validation.md) |
| T07 | XR scene: continuous smooth cockpit + filename | T02-T03 | T07c accepted by user continuation on 2026-10-24; deployed f751dbd. Physical Quest measurements remain unmeasured. [Evidence](xr-cockpit-shell-validation.md) |
| T08 | Gameplay + XR: note meanings and bounded halos | T02, T07 fit | Accepted by user continuation on 2026-10-24, deployed 2bd7cc0. Three optional musical roles. [Evidence](xr-musical-roles-validation.md) |
| T09 | Gameplay + input/render: playable hand policy and motion | T08 | Accepted by user; Guarded optional, Legacy default. [Evidence](xr-movement-validation.md) |
| T10 | Analyzer timing cleanup | T00-T01 | Rejected experiments removed at user request; established XR path and equivalent Band search retained. Accuracy beyond available evidence remains unproven. [Record](xr-timing-cleanup.md) |
| T11 | Timed evidence and qualification | Stable T10 clock/evidence boundary | Closed for this phase by explicit user decision after T11i; limited signal/provenance capabilities only. Research retained, no classifier promoted. General tonal/vocal recognition and dominance deferred; further research is not a T12a prerequisite. [Scope](../features/music-events.md) |
| T12 | Gameplay + analyzer + automation: evidence-based chart sources | T09; supported T11 capabilities only | T12a-c delivered; T12d adds a percussive chart pool before visual suppression and separates choice from Activity density. Classic/Guarded/menu persistence remain; no research candidate or source/instrument recognition promotion |
| T13 | Analyzer + automation + semantics: measured structure, cue and visual arrival timing | T10; T11 additive | T13a-e timing foundation and T13f two-family/full-three-song study delivered. T13g now refines estimated scene entries with bounded sustained multifeature evidence. Meter phase/macrostructure, human precision and perceptual geometry arrival remain unproven; next separate qualified note-source work |
| T14 | XR + UI: two generic procedural HUD styles | T07-T08 | Planned |
| T15 | Presentation planner + XR: track-specific HUD | T13-T14 | Planned |
| T16 | Visuals + XR: optional central music display | T05, T14 tokens | Planned |
| T17 | Analyzer + performance + build: measured WASM kernel feasibility | T01, fixed T10 reference | Planned; clarify tsrs when starting |
| T18 | Analyzer + worker + audio + build: production kernel integration | Successful T17 gate | Conditional; no speedup presumed |
| T19 | Export + visuals/state + MVP: isolated snapshot/runtime | T01, T05 | Planned; single integration owner required |
| T20 | Export + build + platform: confirmed output format/backend | T19, format/environment decision | Planned |
| T21 | Caption parser/layout + MVP + export: timed Markdown | T19 | Planned; explicit timing and overlap policy needed |
| T22 | Composition + UI + build: launcher and Studio entry | T01, T14; T23 for public release | Planned |
| T23 | Server/platform + host integration: auth and business boundary | T01 hosting decision, T22 routes | Planned; concrete hosting capabilities unknown |
| T24 | Build/platform: reversible DotRoll staging/release | T22-T23 and backend requirements | Planned; domain/access unknown |
| T25 | Integration: cumulative release gate | All tasks included in that release | Planned per release |

## Completed handoff contract: T00

- Starting fact: the initial workspace's project directory was empty; the user selected GitHub
  master as the source. The unrelated broken parent worktree is not the project's Git authority.
- Goal: record a reproducible baseline without changing algorithms, presets, application behavior
  or historical evidence.
- Modules/owners: audio and analyzer worker publication; gameplay chart/judge/scoring/session;
  XR composition/runtime/scene; shared visuals; MVP facade; export; Vite build. One integration owner.
- State/time/worker changes: none. Existing AudioEngine, request IDs, render generations, event
  cursors, tuning ownership and export semantics remain authoritative.
- Risk: non-green baseline presets could be mistaken for newly introduced regressions; sandbox
  filesystem failures could be mistaken for product failures. Both are listed separately.
- Performance: informational Node measurements only; browser, GPU, worker, real-track export and
  physical Quest results remain unmeasured until manual runs. No timing assertion added to CI.
- Rollback: remove the new audit script and audit records; no application/storage migration required.
- Evidence: current commit, export comparisons, build log, full test inventory and result, exact
  failure assertions, isolated failure rechecks, chart/analyzer measurements, HTTP host smoke.
- Timing: T00 handoff was accepted by the user's subsequent continuation message. This does not
  fill missing per-device timing or physical acceptance evidence.

## Completed handoff contract: T01

- Starting facts: source/branch rechecked, T00 accepted for continuation; no application changes
  since its baseline. Existing nine preset/motion assertions remain recorded.
- Goal: independently reviewable proposals and task-local decisions, versions, flags, ownership,
  migration/fallback/rollback, first small slice and measurable promotion criteria.
- Owners: docs/integration now; visuals/config/automation/export/platform owners assigned in the
  proposals. All runtime cross-module implementation remains with one integration owner.
- Deliverables: [ADR-011](../adr/ADR-011-shared-wormhole-frame-context.md),
  [ADR-012](../adr/ADR-012-isolated-export-job-runtime.md),
  [ADR-013](../adr/ADR-013-studio-server-session-boundary.md),
  [execution/measurement plan](xr-development-plan.md).
- State/time/schema: no code changes. Worker v2, snapshot/job v1, server API/session v1 and
  direction/native/evidence extensions are proposals only; existing protocols/defaults remain.
- Risk/performance: no measured improvement claimed; promotion thresholds fixed before work,
  baseline tests remain failures; no new import permission or assumed hosting capability.
- Validation: links/ADR uniqueness/task coverage/status and whitespace checked, no application
  diff. Full build/test and browser/Quest not repeated for documentation-only changes.
- Rollback: remove T01 proposals/plan and revert this tracker update; T00 evidence stays intact.
- Timing: the user agreed and requested continuation; T03 implemented next. Separate future
  platform/format/evidence decisions remain task-local gates.

## Completed handoff contract: T03

- Starting facts: 40/100/200 enum/default 200, descriptor-driven menu/store; far 600/near 0.05.
- Goal: select/save/reload 500 m at the same angular/raster size, with safe off-axis far clipping.
- Owner/modules: XR integration; XrBackgroundSettings, XrSettings and SceneConfig changed.
  Existing store/menu/runtime/backdrop contracts reused without duplicate implementations.
- State/time/worker: presentation-only distance change, no chart/score/playback/worker-schema change.
- Performance: same source/raster retained on live distance change; far 1000 covers the 910.786 m
  corner plus room-scale eye motion; theoretical 24-bit precision and no pixel budget growth tested.
- Risk: actual headset clipping/depth/readability and sustained performance still unmeasured.
- Evidence: 92/92 targeted tests and build pass; full 1559 cases, 1550 pass and nine exact baseline
  failures; desktop WebGL menu selection/reload and empty captured error log.
- Compatibility/rollback: stored v1 legacy distances and default unchanged; old code normalizes
  500 back to default; revert three production-file changes to roll back, retain audit evidence.
- Deployment: published to the verified existing Pages target after the user's explicit request;
  release `t03-500m-20261023T210201329Z`, Pages commit `665a608ba0f75958c9d69647fff53bc7e3edbfaa`.
  Three public routes and all 16 expected HTML/assets verified; live WebGL/500 m choice confirmed.
- Timing: user accepted continuation to T02; no physical-device measurements were supplied.

## Completed handoff contract: T02a

- Starting facts: PR 8 exact head `6ef28d1a56fcacf5f8dfdc046f0816e816bcbcdf` was compared
  against current code; session matched its base except line endings, controller/scene have later
  work. No branch merge, WorldPlan/Director or old scene/controller replacement.
- Goal: independently reviewable role-sidecar and notification contract before a visual consumer.
- Owner/modules: one integration owner, gameplay (RhythmTypes, RhythmGameSession, RhythmNoteRoles,
  public gameplay exports), docs and tests. No audio/worker/global State ownership changes.
- State/time: single existing judge/score/AudioEngine clock; callbacks after committed operations;
  reset then skipped events for seek; bounded idempotent per-run notifications; no replay on attach.
- Performance: offline role plan capped at 1024, notification queue at most chart length per call;
  no observer means no notification copies/events. No device performance improvement claimed.
- Risk: stale roles/consumer faults/reentrant writes. Frozen detached notes, guarded synchronous
  mutation APIs, fault-and-detach policy, async-return rejection consumption. Existing public live
  read-only data stays read-only by ownership; this is not a security sandbox.
- Compatibility: role schema v1 is in-memory only; no persisted settings/worker/chart migration.
  No roles inferred and no consumer installed yet. Production appearance remains unchanged.
- Rollback: detach observer/keep empty sidecar; revert only T02a gameplay edits/new role file,
  retaining T03 and cumulative evidence. Deployment rollback uses the previous Pages tree.
- Evidence: [T02a validation](xr-role-resolution-validation.md): 55/55 targeted, build/whitespace
  pass; full 1586 cases, 1577 pass and nine retained baseline failures, zero unexpected failures.
  Cumulative inventory retains 169 active test files and 207 test/helper/fixture source identities.
- Deploy: `t02a-role-resolution-20261023T211826731Z`, Pages commit `ade5aedf53ba3b4f17413c0860e89e224983169d`;
  Pages built, release/three routes/16 HTML/assets hashes verified. Desktop WebGL/menu smoke,
  persisted 500 m selection and empty error log; no real-track audio or physical Quest claim.
- Next boundary: stop after T02a deployment for manual playback/lifecycle regression. T02b will
  wire chart-generation invalidation, scene lifecycle, bounded instanced halo and disposal.

## Planned delivery slices

T02b current contract (single integration owner, XR scene/controller plus test/docs owners):
adapt the PR 8 bounded instanced reticle to the T02a plan, without WorldDirector/Plan imports.
Publish roles only with an accepted chart generation; clear on load/regeneration/dispose; resets
and accepted resolution notifications drive effects. AudioEngine remains the sole live clock.
The production default stays off, with a separate `?xrHaloPreview=1` integration preview selecting
existing phrase starts as white signal markers. This is not T08 musical-role selection/meaning.
Risk gates: stale IDs, duplicate hits, callback failure, cached frame/epoch drift, clipping/overdraw
and resource lifetime. Fixed 16 instances/burst slots, at most 1024 role/resolution ids; one draw,
prefix uploads on selection/status changes, song-time/path uniforms otherwise. No Quest performance
claim; rollback removes the query flag or restores the prior verified Pages release in a new commit.
Validation: cumulative tests, targeted score/path/lifecycle/dispose checks, production audio-load
smoke and isolated actual WebGL pending/hit/miss/seek/reset renders. Pause after deploy/manual handoff.

T02b handoff: 112/112 targeted pass; full 1598 cases, 1589 pass and nine exact retained baseline
failures; final default-off observer optimization followed by 29/29 seam tests and a final build.
Whitespace check pass. Pages commit `75bccd8b87f937d9bfa8630d6d8f98848901cd51`, release
`t02b-halo-lifecycle-20261023T214715168Z`; parent is T02a `ade5aed`. Pages built, marker/four routes
and 16 HTML/assets verified. Public synthetic audio load/chart/playback reached Results without
console errors; isolated actual WebGL verified pending/hit/miss/seek/restart. Quest/human gameplay/
sustained performance remain unmeasured. Stop for manual feedback; T04 and later features not started.

1. T00/T01/T03 continuation accepted; T02a is the current independent review slice.
2. T03 as an isolated 500 m change; T02 and T04-T05 as separate contracts/implementations;
   T07-T09, T14 and T16, with a manual pause after every delivered task/subtask.
3. T10-T13/T15 musical accuracy; T06 native 3D; T17-T18 WASM: independent promotion gates.
4. T19-T21 content production; T22-T24 hosting/auth only after the relevant decisions.
5. T25 for every releasable slice. A failed research gate does not block unrelated delivered features.

Concrete acceptance thresholds, flags, schema/cache versions and fallback/rollback are proposed
in the T01 plan and must be rechecked against the actual source before each implementation.
No new server stack, tuning key or native render DTO is implemented or accepted merely by
appearing in this tracker. The per-task register supplies risks, evidence and rollback for T00-T25.

## T04a delivery contract / handoff (2026-10-24)

- Scope: preset direction/default/normalization, separate spiral-pair permission, additive plan
  transfer, signed morph and initial raster/spatial seam; XR Auto/Left/Right and T02c halo menu.
- Owners: config/automation/types/visuals/XR/UI/docs under one integration owner; no audio/analyzer
  or score/clock owner changes. Preset Straight blocks automatic pair variation.
- Evidence: 251/251 final targeted; full 1613 cases, 1604 pass, nine exact retained baseline
  failures, zero new failures. Final build and whitespace pass; 171 active files retain every
  previous test, historical predecessors and measured sources.
- Deployment: `t04a-preset-spiral-20261023T223102292Z`, Pages
  `13967e8739b0ae070fded9d2257fd6496973b836`, parent T02b `75bccd8`. Built; marker,
  four routes, 16 HTML/assets and explicit preset direction verified. T02c had no separate deploy.
- Manual expectation: Visuals > Note halos Off/Phrase; Material > Spiral direction Auto/Left/Right;
  settings survive reload and are copied. Visible twist requires existing nonzero material/twist.
  Controls preserve playback/chart/score; path/lens remain independent.
- Risks and fallback: full consumer/history/seek/export parity remains T04b; physical Quest
  stereo/readability/performance unmeasured. Choose halo Off/direction Auto or publish retained
  prior Pages tree in a new commit. Stop for manual feedback before T04b.
- [T04a audit](xr-signed-spiral-validation.md), [validation data](xr-signed-spiral-validation-data.json),
  [deployment data](xr-signed-spiral-deployment-data.json).

## T04b delivery / manual handoff (2026-10-24)

- Starting facts: accepted T04a signed fields; retained-source replay shows opposite sign after
  seek versus live playback. The user authorized normal continuation/deploy/manual pause.
- Owners: one config/automation/visuals/UI/state integration owner. New runtime helper samples
  only the published coherent spiral channel, no new analysis/planner/clock/judge.
- Behavior: cached absolute anchors use the existing exponential law once. Legacy all-right
  plans bypass it; preset Straight, material relevance and persisted manual overrides are retained.
  Matching automation phase has an immutable authored id/time; semantic phase stays independent.
- Consumers: actual grain/arm/weave geometry, independent wall/lens strokes, canonical export
  clock, signed worker carrier and XR smoothing rules checked. General host/route/director
  reconstruction and cross-backend pixels remain T05; encoded video/Quest are not claimed.
- Validation: 238/238 targeted; full 1627 cases, 1618 pass and nine exact known baseline failures,
  no unexpected failures or skips. Build and whitespace pass; 173 active files retain all 171 prior
  files, 214 source identities. Old measured sources/results and predecessor identities retained.
- Browser: real Canvas2D/WebGL2/worker agree at right/zero/left samples; Studio loaded the 7 s
  synthetic fixture, imported/copied [1,-1] and repeated seek with no console errors.
- Deployment: `t04b-spiral-history-20261023T233450568Z`, Pages commit
  `78b30a41cafa55bdcc3141965537bc2a526f0a3c`, parent T04a `13967e8`. Built, release marker,
  four routes and 16 HTML/asset hashes verified; all 319 source inputs match the checkout.
- Expected manual result: Auto revisits the same handedness/morph progress at a given song time;
  test forward/backward seek and pause/resume in Studio/MVP, XR overrides/settings and existing halos.
- Rollback: publish T04a Pages tree in a new commit; manual direction override/legacy plan remain
  available. Stop for user feedback; T05 has not started.
- [T04b audit](xr-spiral-history-validation.md), [validation data](xr-spiral-history-validation-data.json),
  [deployment data](xr-spiral-history-deployment-data.json).

## T05a delivery / manual handoff (2026-10-24)

- Starting point: user accepted T04b; accepted T01 split selects context extraction before T05b backend/composition and T05c exact sampling.
- One visuals/config/automation/types/docs integration owner; no audio, analyzer, gameplay, UI storage or worker protocol change.
- Shared context owns the former source simulation/identity, tuning, semantics, signed anchors, decays and one modulation/director update. Source retains revision-checked asset IO, cadence, raster/carrier presentation and disposal.
- Required copied raw/meta host seed keeps explicit Studio/MVP policy separate from XR defaults. Compatibility source retains omitted XR defaults; explicit seeds are never substituted. No new player switch; authored choices remain preset-owned.
- Validation: 182/182 targeted, 13/13 final retention/context check. Final cumulative 1635 cases: 1626 pass, nine exact prior names/messages, no skips/cancellations. All 173 previous active files retained among 174; 215 source identities. Build and whitespace checks pass.
- Retained pre-T05a source is exactly the T04b deployed source. New comparison pins complete records and accepted/skipped frames across playback/seek/controls; no protected helper or measured source/result changed.
- Browser: real Canvas2D/WebGL2/worker signed samples at right/zero/left agree. Studio/MVP load/play/pause/repeated seek smoke passes with empty console errors. This does not claim cross-backend pixels, encoded output or Quest measurements.
- Deployment: `t05a-frame-context-20261024T002109899Z`, commit `ae3b0983a475da740d877fc217930699605ad436`, parent `78b30a41cafa55bdcc3141965537bc2a526f0a3c`. Public verification is recorded in the linked deployment data.
- Expected manual result: unchanged image/defaults and existing controls. Test XR play/pause/seek, Auto/Left/Right, macro/Line stroke and retained settings; check Studio/MVP presets/playback for regressions.
- Rollback: publish prior T04b Pages tree in a new commit. T05b owns actual Studio/MVP backend/compositor integration; T05c owns deterministic general history and exact worker protocol. Stop for manual feedback before T05b.
- [T05a audit](xr-frame-context-validation.md), [validation data](xr-frame-context-validation-data.json), [deployment data](xr-frame-context-deployment-data.json).

## T05b delivery / manual handoff (2026-10-24)

- User accepted T05a. One visuals/config/UI/composition/docs integration owner; audio/gameplay/state shape/worker schema unchanged.
- Studio/MVP retain one existing host simulation. A renderer-owned pass presents the same Wormhole identity through shared WebGL; no embedded XR defaults, duplicate gains/events/director or Three imports. Crossfade simulation owner and final PostFX seam remain once.
- Logical/backing density, video clear, active live/crossfade/export targets, one-surface reuse and GPU disposal are explicit. Missing/lost WebGL latches compatibility fallback; Compatible then WebGL retries. XR source loss uses its existing failure/re-enable seam.
- New device menu: Studio Tuning / MVP Advanced tuning > Wormhole renderer. Compatible default; WebGL experimental. localStorage and Copy preview settings; independent of artistic presets/history.
- Validation: 197/197 targeted; final full 1646 cases, 1637 pass and nine exact prior failure names/messages, zero skips/cancellations. Build passes. All 174 old active files retained in 175; 218 source identities. Seven preceding source identities retained against T05a.
- Browser: real p5/WebGL opaque/DPR2/transparent/chroma/video pairs within predeclared image gates; ten paired PNGs retained. Real direct/crossfade/offscreen frames each invoke one gain/director/PostFX; export pixels isolated. Forced context loss falls back once. XR Canvas2D/WebGL/worker right/zero/left pass. Studio/MVP menu/WebGL/play/seek/reload smoke passed; console errors empty.
- Copy command accepted with the exact selected settings JSON. Automation clipboard reader returned an older test plan; OS paste roundtrip remains a manual check, discrepancy retained.
- Deployment: `t05b-shared-backend-20261024T011714918Z`, commit `9b1ae0d8bd3e7691d0b74f66f860418611d658bf`, parent `ae3b0983a475da740d877fc217930699605ad436`. Public verification in linked deployment data.
- Expected result: opt into WebGL for shared GPU Wormhole drawing; compare image, pause/seek, resize, identity transitions and export. Check reload/Copy. No guaranteed device speedup, encoded-video exactness or physical Quest claim.
- Rollback: choose Compatible, or publish prior T05a Pages tree in a new commit. Stop for user feedback; T05c exact sampler/worker-v2 has not started.
- [T05b audit](xr-shared-backend-validation.md), [validation data](xr-shared-backend-validation-data.json), [deployment data](xr-shared-backend-deployment-data.json).

## T05c delivery and manual gate (2026-10-24)

- User authorized the next task after the clarification that canvas removal/native 3D is T06. No task reordering or new player setting.
- Separate local/worker exact adapters, v2 capability handshake, complete frame identity and one atomic bitmap/carrier lease. Preview v1 remains unchanged. Fixed song-zero 60 Hz replay includes morph/director/route/releases and bypasses preview pacing.
- Final build and diff check passed; 129/129 targeted plus 5/5 source-provenance checks. Full cumulative: 1655 tests, 1646 pass, 9 exact T05b baseline failures, no skipped/cancelled. All 175 predecessor test sources and protected XR loader are unchanged. Predecessor contract/evolution sources retained; no historical measurements rewritten.
- Browser: 10/10 real local/worker Canvas2D and WebGL cases; zero pixel difference and exact companions in the fixture, repeat/backward requests included. Nonzero material/line payloads and immutable analysis tested. Local and public XR load/play/natural end reached Results with no console errors; desktop test without input expects 9 misses. No physical Quest claim.
- Pages b5a1a4098b88c7766b0cbdc41d9ebda173be31f9 (parent 9b1ae0d8bd3e7691d0b74f66f860418611d658bf), release t05c-exact-frame-20261024T014906431Z. Three entry HTML plus 13 assets verified byte-for-byte; four routes, 325 source inputs still match. No source-branch push or force push.
- Limits: per-frame replay is linear in song time; local fallback is synchronous and worker request deadline is 120 seconds. Efficient checkpoints, exporter integration, full-length encoded video and old live-preview/canonical comparison are T19 gates. Existing live preview is not claimed history-independent.
- Manual expectation: current XR/Studio/MVP still work; check playback/pause/seek/preset/direction and persisted/copied settings. No new visible export/native mode. Stop now; T06 begins only after manual feedback.

[Validation](xr-exact-frame-validation.md), [results](xr-exact-frame-validation-data.json), [deployment](xr-exact-frame-deployment-data.json).

## T06a native grains/trails delivery (2026-10-24)

- User accepted T05c and requested the next task. Delivered the master prompt's first grains/trails spike, not complete native3d. Inventory/schema were recorded before implementation. No subagents or dependencies.
- System > Wormhole mode: Hybrid (default) / Native grains (experimental), persisted through version-1 settings and included in Copy. Renderer choice is device policy; artistic geometry remains preset-owned. Native mode has no background canvas, OffscreenCanvas, raster worker or texture. The independent game renderer/menu/HUD remain.
- Original preprojection geometry, seeds, releases, route and signed twist feed a 1440-record spatial v1 packet. One instanced mesh, bounded width/trail length and protected near/gameplay corridor; no decorative second tunnel in native mode. Switching back or capability/prepare fallback restores Hybrid.
- Final build/diff check pass. Targeted 182/182; full 1663 with 1654 pass and the exact 9 T05c baseline failures, no skip/cancel. All 176 predecessor files retained; three reviewed additive descriptor/import/default extensions with archived sources. Protected loader and analyzer evolution/measurements unchanged.
- Real browser: near/far stereo disparity ~2.03/1 px for 64 mm simulated IPD, complete opaque occlusion and near cull. One draw / 2714 triangles / zero textures for 1357 visible native instances in the fixture. Local XR selected Native, reloaded, played/paused 28 s fixture and restored Hybrid. Copy acknowledged; automated clipboard read returned stale content, so user paste remains manual.
- Pages b74b79af29f5dd9e6c08e7736b832afeac82e03f, parent b5a1a4098b88c7766b0cbdc41d9ebda173be31f9, release t06a-native-grains-20261024T023828814Z. 16 public HTML/assets and 4 routes verified; 328 source input hashes still match. Public UI smoke and preference restoration recorded in deployment JSON. No source push/merge or force push.
- Native omits weave/filament/bloom volume, wall, stars/galaxies/skybox and lens/refraction. Desktop probes do not replace physical Quest stereo/performance/comfort/cockpit acceptance. Stop now for manual feedback before T06b or any later task.

[Inventory](xr-native-wormhole-contract.md), [validation](xr-native-grains-validation.md), [results](xr-native-grains-validation-data.json), [deployment](xr-native-grains-deployment-data.json).

## T06b spatial weave and stage priority delivery (2026-10-24)

- User accepted T06a; requested the next slice and fixed native background priority. Material absence acknowledged and explicitly scheduled as T06c next; further layers T06d-f. Full T06 remains incomplete.
- Additive optional spatial weave packet, original pool neighbour/visibility/emission laws, preprojection 3D heads and travel tangents. Existing preset Nebula Amount/Weave and persisted/copied menu boosts apply. No new switch, raster worker/canvas/texture, audio change or dependency.
- Both native batches alpha blend in the background opaque queue so opaque notes and the translucent runway draw afterward. Four real GPU overlap probes pass for grains/connections and opaque/transparent surfaces physically behind them. No extra scene pass or depth reset.
- Build/diff check passed; targeted 266/266; full 1667/1658 pass with 9 exact T06a baseline names/messages, no skipped/cancelled. All 177 predecessor active tests unchanged, new 4 cases in file 178. Five source predecessors and protected loader/evolution hashes retained.
- Real WebGL: stereo disparity 2.029/1 px near/far; near cull and stage priority pass. Fixture 1357 grain + 2830 connection instances; 2 draws, 8374 triangles, zero textures; one 5.6 ms desktop source sample. No physical Quest benchmark/comfort claim. Local/public native play/pause and Hybrid restoration verified; existing clipboard paste limitation remains manual.
- Pages 2ad4da8ca7d507fad449df90c8efccc1f0e10ffd, parent b74b79af29f5dd9e6c08e7736b832afeac82e03f, release t06b-native-weave-20261024T030246088Z. 16 HTML/assets, 4 routes and 328 unchanged build inputs verified. No source push or force push.
- Manual: check native dots/strands behind runway and notes, Material weave adjustment/zero, saved/copied settings, Hybrid restoration and headset comfort/performance. Stop before T06c.

[Contract/schedule](xr-native-weave-contract.md), [validation](xr-native-weave-validation.md), [results](xr-native-weave-validation-data.json), [deployment](xr-native-weave-deployment-data.json).

## T06c native material delivery and performance follow-up (2026-10-24)

- User accepted T06b; requested material and then reported substantially worse main-thread stutter on Quest. Delivered material; technical inspection/profile retained and canvas-free native geometry worker is T06c2 next priority, before more visual layers. No Quest stutter fix/speedup claimed in this slice.
- Existing preset Amount/Detail/Bloom and player menu boosts now drive seeded filament/fibre, core/local halo, depth extinction/colour and bounded analytic medium/broad emission lobes in the real spatial batches. Amount zero gives exactly the predecessor line pixels. Spatial analogue, not raster gather/blur parity or a global volume simulation. Optional aligned metadata; original coordinates/stride unchanged.
- Two draws, zero textures/canvas/OffscreenCanvas/raster worker/targets. Support <=0.6 m and per-eye 12/14/16/18 pixel cap by quality; near corridor includes the halo. T06b stage priority retained. Hybrid remains default. No new setting, dependency or audio/analyzer change.
- Build/diff check passed; targeted 271/271; full 1672/1663 pass with 9 exact T06b baseline names/messages, no skips/cancellations. All 178 predecessor active tests unchanged, five new cases in file 179. Five predecessor sources and protected loader/evolution hashes retained.
- WebGL probes: zero Amount exact pixels; distinct Amount/Detail/Bloom support, no empty-frame emission. Real overdrive fixture 2 draws /8374 triangles /zero textures, 6922 coloured pixels; stereo, near and all four opaque/transparent stage priority cases pass. Local native loaded 28 s fixture, played to Results (42 expected no-input misses), Bloom 100->90->100 and Hybrid restoration; public smoke retained. No warnings/errors.
- CPU profile 32 samples after eight warmup: source p50/p95 2.1/3.0 ms, packet copy 0.4/0.6, material submission 0.2/0.3. Submission excludes GPU execution; desktop fixture cannot establish Quest pacing. Source/context/identity still main-thread; quality caps only consumer. T06c2 must review worker transfer ownership/coalescing/stale generations/fallback and producer quality policy.
- Pages 4cb71ea836f34ce2c34fa2e0a195fc7a83c0f1e5, parent 2ad4da8ca7d507fad449df90c8efccc1f0e10ffd, release t06c-native-material-20261024T032453627Z. 16 HTML/assets, 4 routes and 329 unchanged build inputs verified. Node publisher used because package deploy invokes Bun; no source push/force push.
- Manual: native Material Amount/Detail/Bloom, stage visibility, saved/copied settings and Hybrid restoration; physical headset pacing remains manual. Stop before T06c2. Remaining visual inventory T06d stars/galaxies/skybox, T06e wall, T06f optics and full Quest/cockpit gates.

[Contract/schedule](xr-native-material-contract.md), [validation](xr-native-material-validation.md), [results](xr-native-material-validation-data.json), [deployment](xr-native-material-deployment-data.json).

## T06c2 native geometry worker delivery (2026-10-24)

- User accepted T06c and requested the worker/performance follow-up after reporting Quest native stutter. Native geometry now runs in a canvas-free module worker by default. Same private producer and authored full field; Three/GPU and attribute upload remain in XR. No OffscreenCanvas requirement, new switch, storage schema, dependency or audio/analyzer/judge change.
- Independent native protocol: generation/request/revision/continuity epoch and caller song time; one in-flight/latest request, one 437760-byte transferred output lease, two stable main banks and one return before next request. Seek/pause/settings discard stale work; focal/spatial state switches with displayed geometry. Worker restarts/terminates on preparation, failure and disposal. Startup/render deadlines 15 s/5 s; native main fallback labelled in diagnostics. Existing technical xrBackgroundThread=main retained for A/B.
- Build/diff check passed. Targeted 282/282; full 1683 with 1674 pass and 9 exact T06c baseline names/messages, no skips/cancellations. Final native hint copy edit rechecked with build and 24/24 settings/menu cases. All 179 predecessor active sources retained; one reviewed composition-import assertion replacement with archive/reason, 11 new cases in file 180. Eight source/test predecessors and protected loader/evolution hashes retained.
- Real module worker vs direct source: four forward/backward/revisited samples, zero packet/pixel differences and matching companions/counts. Fixture 6922 coloured pixels, 2 draws/8374 triangles/zero textures. Profile 32 samples after eight warmup: direct main producer p50/p95 3.5/4.7 ms; same worker producer 3.8/4.6; main request/adoption p95 0.2, transfer copy p95 0.1, GPU attribute copy p50/p95 0.4/0.6, roundtrip 4.2/5.0. Timer-rounded low values are not zero work; no physical Quest FPS/GPU guarantee.
- Local/public XR selected native, loaded 28 s/128 BPM fixture (42 notes/41 arrows/3 pairs), played/paused and showed worker geometry/no background canvas plus latency. Saved Native survived public reload; Hybrid restored. No console warnings/errors. No producer thinning, render lead or exact replay added; GPU/fill and upload cost remain.
- Pages 7c55d56dfbb96c21505e0c07ba96966bd43f2729, parent 4cb71ea836f34ce2c34fa2e0a195fc7a83c0f1e5, release t06c2-native-worker-20261024T092849505Z. 17 HTML/assets (including worker module), 4 routes and 334 unchanged build inputs verified. Node publisher used because package deploy invokes Bun; no source push/force push.
- Manual: same track/settings on Quest, head movement/frame pacing and worker geometry label; pause/resume, material/direction edits, Hybrid restoration and saved/copied settings. OS clipboard paste remains manual. Stop for feedback before T06d stars/galaxies/skybox; T06e wall and T06f optics/full cockpit/Quest acceptance remain incomplete.

[Contract](xr-native-worker-contract.md), [validation](xr-native-worker-validation.md), [results](xr-native-worker-validation-data.json), [deployment](xr-native-worker-deployment-data.json).

## T06d native cosmic layers delivery (2026-10-24)

- User accepted T06c2. Same original pools/route/travel now emit preprojection stars, galaxies/core echoes and normalized sky directions on a finite far forward plane. No second cosmos simulation, canvas/texture/offscreen image or source-branch push. Sky samples 1500/9000 entries; at most 4818 cosmic records. Wall T06e and lens/refraction/deep-field imaging T06f remain incomplete; native stays experimental.
- One extra fixed 308352-byte transfer travels atomically with the unchanged 437760-byte native bank. Same two main banks, one flight/latest request, lease return and generation/epoch/revision/song-time stale checks; main fallback supported. XR has one extra instanced draw, uniform horizon fit, stable quality strides, pixel/streak caps and near gameplay clearance; renders behind stage/notes/HUD.
- Cosmos menu Stars 0-200 / Galaxies 0-200 / Sky 0-100 controls existing global masters after private preset/gain resolution. Defaults 100/100/0 preserve disabled legacy sky. Explicit nonzero Sky enables the old pool only for embedded XR; preset motion/geometry remains authored. Hybrid/Native both apply; old records normalize, settings persist/copy, presentation scope.
- Build/diff passed. Targeted 326/326; compatibility 26/26; full 1692, 1683 pass and nine exact T06c2 baseline names/messages, no skips/cancellations. All 180 predecessor files retained, two reviewed exhaustive-default extensions and 14 source/test archives; new nine cases in active file 181. Current source-evolution review retains prior manifest and superseded review; historical timing data/source unchanged. Final full run used filesystem escalation after sandbox temp rename/Git config denials.
- Real module worker/direct: four times with zero float/pixel differences and matching companions; immutable analysis. Independently visible Stars/Galaxies/Sky, zero controls, 64 mm stereo disparity 2.059/1 px, opaque/transparent stage priority, quality and oblique view pass. Fixture 3 draws / 17048 triangles / zero textures / 4337 cosmic instances. 32 samples after eight warmup: worker producer p50/p95 6.7/8.8 ms; main request 0.1/0.3, transfer 0.1/0.2, attribute copy 0.6/0.7, roundtrip 7.5/9.7. Desktop only, no physical Quest/GPU timer claim.
- Local/public menu controls survive reload and show Copy success; automated OS clipboard readback remains stale, actual paste manual. Public native play/pause/worker label and Hybrid restoration verified, no console warnings/errors. Original settings restored.
- Pages a4d8484a49d44699f4020ab278cba7bc9c957aa8, parent 7c55d56dfbb96c21505e0c07ba96966bd43f2729, release t06d-native-cosmos-20261024T101231797Z; 17 HTML/assets, 4 routes, 335 unchanged input hashes. Node publisher fallback for Bun-based deploy script; no package/lock change or force push.
- Manual: Native plus each Cosmos zero/nonzero, reload/Copy paste, same-track Quest head-motion pacing, note readability and pause/Hybrid. Added GPU fill remains a cost. Stop for feedback before T06e wall; T06f optics/full cockpit/headset gates remain.

[Contract](xr-native-cosmos-contract.md), [validation](xr-native-cosmos-validation.md), [results](xr-native-cosmos-validation-data.json), [deployment](xr-native-cosmos-deployment-data.json).

## T06e native wall delivery (2026-10-24)

- User accepted T06d. Original membrane, caustic, mosaic and event-crack paths now emit before projection from the same route/front/wave pools. Colored fringe is spatial edge light; refraction/lens/deep-field imaging remains T06f. No second simulation or background canvas.
- Optional fixed 204800-byte wall carrier (3200 records) under existing atomic single-flight lease; original primary/cosmos unchanged. Stale/malformed/Off/absence, lifecycle and fallback covered. One extra bounded instanced draw; four total per eye, stage priority/near clearance preserved. Main attribute copies and GPU fill remain costs.
- Wall Off/Preset/On, material Preset/Membrane/Mosaic and five existing-law gains saved/copied for both Hybrid/Native. Default Off/Preset/50; Preset retains authored gate/material/amount; On supplies unit amount only for authored zero. Factory amount may be zero, so use On to inspect. Assets/plan immutable and optics not implicitly enabled.
- Build and diff passed; targeted 420/420, compatibility 105/105, focused 54/54. Full 1702: 1693 pass, nine exact prior failures, zero skips/cancellations. All 181 previous files retained plus ten cases in active file 182, two reviewed exhaustive-default extensions, 14 immutable archives, protected loader unchanged. Current source-evolution review retains predecessor and historical timing evidence. Full run used known filesystem sandbox escalation.
- Real module worker/direct four times: zero float/pixel differences, companions match. Four isolated families and fringe visible; stereo 2.059/0.985 px, near/quality/oblique and opaque/transparent stage priority pass. Fixture four draws / 17984 triangles / zero textures / 1422 wall instances. 32 samples after eight warmup: producer p50/p95 3.8/5.6 ms, main request 0.1/0.2, transfer timer-rounded 0/0.1, copy 0.5/0.6, roundtrip 4.8/6.2. Desktop only, no comparative speedup or physical Quest/GPU timer claim.
- Local/public edited controls survive reload, Copy toast succeeds; actual OS paste manual. Public native play/pause worker diagnostic and Hybrid restoration pass; no warnings/errors. Wall defaults restored.
- Pages 99af80e1880dcf1352a226c1576de4a93ce428e1, parent a4d8484a49d44699f4020ab278cba7bc9c957aa8, release t06e-native-wall-20261024T105422000Z; 17 HTML/assets / 4 routes / 337 unchanged inputs. Node publisher replaces Bun-dependent script; no dependency/source-branch/force push.
- Manual: Native + Wall On, Preset/manual material and gains/zero, reload/Copy paste, same-track Quest head-motion pacing and note readability, pause/Hybrid. Cracks require qualifying fronts; Performance may omit them. Stop for feedback before T06f.

[Contract](xr-native-wall-contract.md), [validation](xr-native-wall-validation.md), [results](xr-native-wall-validation-data.json), [deployment](xr-native-wall-deployment-data.json).

## T06e2 clean baseline and Wall freeze (2026-10-24)

User reports unwanted Hybrid patches and stops further Wall work. Browser identifies independent galaxy radial glows with Wall Off. New defaults Wall Off + Galaxies 0; old saved Wall opt-ins and default galaxy 100 migrate once, later explicit choices persist. Numeric wall components also zeroed; no new art or shader. Build, 83/83 targeted, full 1709 / 1700 pass / nine exact baseline failures. All 182 predecessors retained with three reviewed default extensions and six archives; seven new cases. Previous wall-only full run and initial normalizer failures retained separately; final clean run passes. Physical Quest unmeasured. Pages be4bc071b8bb671631f506ac3c38f1b65af49f26; 17 files/four routes/337 inputs verified; real old-public migration/reload/clean Hybrid passes. [Evidence](xr-wall-default-off-validation.md). T06f/Wall deferred; user requested T07 and supplied cockpit image with fixed-width filename marquee.

## T07 cockpit and fixed-width filename delivery (2026-10-24)

- User supplied cockpit reference, asked to ignore all pictured words and replace upper XSR area with fixed-width scrolling selected filename. Reference retained with hash. T06e2 unwanted Hybrid galaxy patches/Wall defaults were fixed/deployed first; no further Wall/T06f expansion.
- XR-only stage-root cabin, two merged unlit batches, open chamfered panoramic window, upper/side ribs, floor returns and narrow cyan/magenta/white trim. No realtime cabin reflection/shadow/bloom or gameplay/score/camera change. Fits current config/layout on recenter; desktop rearward origin applied once, immersive origin zero, exit restored.
- Upper 2 m x 0.22 m filename plane, exact extension included, plain bounded Unicode. One lazy glyph atlas (up to 4 MiB) updated only on filename changes; GPU UV clip/scroll follows existing song time, pause/seek deterministic, no independent clock/per-frame upload. Empty hides. Resources disposed once.
- Cockpit Full/Reduced/Off, Title Scroll/Static/Off in descriptor menu, persistence/Copy, presentation scope; new defaults Full/Scroll. Nine tabs readable with compact labels. No worker/audio/analyzer changes.
- Build/diff pass. Targeted 125/125; full 1718, 1709 pass, nine exact baseline failures, zero skips/cancellations. All 183 prior files retained, new eight cases in file 184 and one additive controller case; seven source/test archives, two reviewed additive test extensions; protected loader and timing manifest unchanged. Initial TypeScript errors fixed; no compiler setting/dependency changes. Known filesystem escalation for cumulative runner.
- Real GPU fixture Full 3 draws / 590 triangles / one texture, Reduced 3 / 254, Off zero. Caption fixture 0.5 MiB, maximum 4 MiB. Four logical headset views plus desktop, fixed clipping, atlas seam, motion/pause/seek pixels and repeated filename replacement pass. 32 samples after eight warmup: desktop update/render submission Off p50 timer-rounded 0 / p95 0.1 ms, Full 0.1 / 0.5 ms; no GPU execution or physical Quest claim.
- Local/public edited Reduced/Static reload and Copy toast pass; Full/Scroll restored. Long accented filename visible, clipped and scrolling, play/pause/Results and notes/path/HUD remain visible. OS paste and physical Quest comfort/pacing remain manual.
- Pages 08d0c8875fdba2394c5763f2626eba7a60df14ae, parent be4bc071b8bb671631f506ac3c38f1b65af49f26, release t07-cockpit-20261024T115025210Z; 17 HTML/assets / 4 routes / 339 unchanged build inputs. Node publisher replaces Bun script, no source-branch/force push.
- Stop for manual Quest head movement, recenter/re-entry, Standard/Tall note/saber/HUD clearance, long filename and title controls/Copy. Rollback Cockpit Off or prior Pages tree. T08 begins only after feedback.

[Contract](xr-cockpit-contract.md), [validation](xr-cockpit-validation.md), [results](xr-cockpit-validation-data.json), [deployment](xr-cockpit-deployment-data.json).

## T07b cockpit refinement delivery (2026-10-24)

User requested a descending stepped center console, rounded turns/edges retaining the angular silhouette, HUD typography, richer title bezel and oblique artifact correction. Static bounded merged geometry, 0.245 m lower title, inset beveled pod and cyan/magenta brackets/status accents. Shared HUD/menu/title font/ink. Real GPU reproduction confirms old coplanarity; seven-angle mounted ink worst 45.9% → 100%, with real depth gap, alpha mask, explicit continuous gradients/mipmaps/anisotropy. Existing controls/storage/Copy retained.

Build/diff pass, targeted 129/129; full 1722/1713 pass with nine exact known failures. All 184 predecessor test files retained in 185 active files; four new cases, one reviewed static triangle-cap replacement with immutable archive. Protected loader and timing manifest unchanged. Real WebGL Full 3 draws/5554 triangles, Reduced 3938, Off zero; extra triangles are static, no per-frame rebuild. Physical Quest/GPU execution unmeasured. Local/public long filename, play/pause, Reduced/Static reload/Copy, Off/restored Full/Scroll pass. Wall Off/Galaxies 0 baseline unchanged, Wall/T06f deferred.

Pages 7123c10b806a125c483a45cc8f9e4055f4c2ee92, parent 08d0c8875fdba2394c5763f2626eba7a60df14ae, release t07b-cockpit-refinement-20261024T122253442Z; 17 files/4 routes/341 build inputs verified. Node publisher replaces Bun-only package deploy; no source/force push. **Stop before T08 for manual Quest views/readability/comfort/clearance/pacing feedback.**

[Validation](xr-cockpit-refinement-validation.md), [results](xr-cockpit-refinement-validation-data.json), [deployment](xr-cockpit-refinement-deployment-data.json).

## T07c continuous smooth cockpit delivery (2026-10-24)

Final user steering: few dominant nodes, broad smooth curves and long clean spans closer to the latest reference, including both side returns and under-road connection. Closed mirrored quintic shell, shared analytic tangents/zero endpoint curvature, adaptive 0.0015 m / 6-degree sampling, parallel-transport section frames and exact seam. Full has sculpted buried-root tapered returns and softly emerging light channels; Reduced keeps complete lower arch. Existing title/font/depth/time/settings unchanged.

Build/diff pass; targeted 133/133; full 1726/1717 pass with nine exact known failures, zero skips/cancellations. All 185 prior files retained in 186 active files; four new cases. Reviewed 6000 to 12000 static geometry cap with predecessor retained; no extra draws/realtime rebuild. Actual Full 10810, Reduced 7610 triangles, three calls including title, Off zero. Six logical GPU views plus actual local/public down-oblique gameplay; caption seven-angle ink remains 100%. Physical Quest performance/comfort unmeasured. Prototype stopped on user steering and retained separately; final entire suite rerun.

Pages f751dbdbf96a42be99cd157be0f38ec6170529c9, parent 7123c10b806a125c483a45cc8f9e4055f4c2ee92, release t07c-cockpit-shell-20261024T131238102Z; 17 files/4 routes/341 source inputs exact. Node publisher fallback for unavailable Bun; no source/force push. Wall Off/Galaxies 0 unchanged, Wall/T06f deferred. **Stop before T08 for manual curve/under-road/Quest clearance and pacing feedback.**
[Validation](xr-cockpit-shell-validation.md), [results](xr-cockpit-shell-validation-data.json), [release](xr-cockpit-shell-deployment-data.json).

## T08 musical target cues delivery (2026-10-24)

T07c accepted. Accent/phrase/section sidecar, pure deterministic policy from accepted intensity/phrase/section data. Explicit skin/gesture/source/role and target table; no new judge, timing, score/combo/accuracy or section bonus rule. Off/Phrase/Music in Visuals menu/localStorage/Copy, default Off, viewer preference. One extra draw, 16 instances, 88 triangles each, no texture; section > phrase > accent and 1.5-second cue gap, 1024 offline cap. Accepted-resolution lifecycle and fail-open behavior retained.

Build/diff pass; targeted 139/139; full 1733/1724 pass / nine exact retained failures, zero skips/cancellations. All 186 prior files unchanged, 187 active; 36 GPU combinations preserve centre pixels, real local/public menu/reload/Copy/play/pause. Physical Quest readability and pacing unmeasured. Pages 2bd7cc0c8ed9ee6926e69b568ca4dae1e99ed4ec, release t08-musical-roles-20261024T134224935Z; 17 files/4 routes/342 inputs verified. No source/force push. **Stop before T09 for manual feedback.** Wall/T06f deferred.

## T09 guarded movement delivery (2026-10-24)

T08 accepted. Pure movement validator and bounded revoicing/group filter, stroke entry/exit and return time, difficulty floors/row/reach, .16 m closest temporal hand separation, crossing clearance and overhead preparation/rest. Atomic pairs, either witnesses, no invented onset/cut/overhead. Guarded Left/Right lead rigidly reflect the same canonical chart and max score/section demand. Existing near-hit position/GPU bend/inverse/real and desktop judge retained. Movement menu/localStorage/Copy uses chart scope; Legacy default/golden retained. Compact menu vertical focus now takes adjacent row first, with prior tests unchanged.

Build/diff pass; targeted 177/177; full 1743/1734 pass / nine exact retained failures, zero skips/cancellations. 187 prior test files retained in 188; one reviewed additive descriptor-default expectation with predecessor. Six archives/protected loader/timing manifest checked. Synthetic 480 profiles: 76250 → 67632 notes, 8185 pairs/654 overhead; model violations 10726 → zero. Average retention 88.7%, minimum 28.1%; conservative optional mode, physical Quest unmeasured. Local/public generated 28 s WAV, menu/Copy/reload/play/pause/regeneration verified.

Pages 5a35086b51c36bb667447168da960e2e68796b1e, release t09-movement-20261024T142006361Z; 17 files/4 routes/343 build inputs exact. Node publisher fallback; no source/force push. **Stop before T10 for manual feedback.** Wall/T06f deferred.

## T10 cleanup (2026-10-24)

User explicitly requested deletion of unsuccessful experiments and redundant artifacts, then continuation to T11. Timing UI/Q3/selected-file reanalysis removed; retired settings cleaned. Stable XR analysis, existing lab tests and equivalent Band search retained. T10 deployment/source copies and Q3-only code/tests deleted by request; no claim of improved musical truth. See [single delivery record](xr-timing-cleanup.md). Cleanup validation/publication completed (74c57b8); T11a started afterward as explicitly requested.

## Historical checkpoint — review + MVP worker, 2026-10-24

Product position: **T11a delivered; T11 partial; T12 not started.** T10 rejected experiments stay
removed. T11a does not establish musical accuracy, tonal/vocal recognition or dominance. After
this review/deploy/manual handoff, resume T11's real onset/offset/sustain/dominance evidence producer;
clarify evidence and acceptance cases before dependent chart changes. See [music events](../features/music-events.md).

Current authorized scope adds MVP offscreen worker/material rendering and reviews all accumulated
T00–T11a code and documentation, fixes confirmed defects, commits in subsystem sections, pushes
`codex/xr-development-baseline`, deploys and verifies. It does not start the next product task.
[Review and performance record](xr-review-checkpoint.md) carries current results and limitations.
The live `release.json` binds deployment to the reviewed source commit; historical deployment
records remain historical. Source-only commits do not imply a merge to master.

## Historical checkpoint — T11b acoustic activity, 2026-10-25

T11a accepted; user requested continuation of partial T11. T11b adds acoustic activity/boundary,
energy-rise and aggregated texture evidence in the existing analyzer worker; no chart consumer
or player switch. Legacy accepted data and MVP/XR offscreen rendering remain intact. Wall stays
Off; no Wall development. T10 rejected timing controls/source-copy artifacts remain removed.
[Contract, evidence, limits and validation](../features/music-events.md#t11b--acoustic-activity-evidence-2026-10-25).

**T11 remains partial; T12 not started.** Continue with validated musical onset/note-boundary/role
inference, preserving unknown/unsupported vocal/source identities until justified. Do not promote
acoustic texture into musical source identity or enable it for scoring. Stop after this delivery's
deploy for manual load/play/pause/chart feedback before the next task.


## Historical checkpoint — T11c quiet spectral entries, 2026-10-25

T11b accepted. New `spectralEntries` candidates recover quiet tone/noise additions over a stable
retained tonal carrier; all old T11b and legacy chart inputs remain exact. No player switch or
chart promotion. Fixed shared-FFT ring, pre-search-only residual fit, complete body support,
strict normalization and conservative dedup. [Contract and evidence](../features/music-events.md#t11c--quiet-spectral-entries-over-a-tonal-carrier-2026-10-25).

**T11 remains partial; T12 not started.** Remaining work is validated musical note boundaries and
role inference. Vocal/source identity remains unsupported; old attack.family is context texture,
not isolated-attack identity. Stop after this deploy for manual load/play/pause/chart feedback.
Wall remains Off; MVP/XR Offscreen rendering and rejected T10 experiment cleanup stay intact.


## Historical checkpoint - T11d fixed-band activity, 2026-10-25

T11c accepted. T11d adds entry-associated fixed frequency-mask activity/end evidence over the
continuing carrier, using the borrowed FFT and at most 32 concurrent provisional masks.
Complete quiet confirmation, file censoring and explicit budget-unavailable results are separate.
Source ownership is unresolved: same-band overlap and pitch leaving the mask are not isolated
note boundaries. All prior T11b/c/chart values stay exact. No UI switch or chart promotion.
[Contract, evidence and final validation](../features/music-events.md#t11d---entry-frozen-band-activity-2026-10-25).

**T11 remains partial; T12 not started.** Next work: validated musical boundaries/role inference,
including rejection/qualification of modulation/glide proposals. Do not infer voices or instruments
from pitch/texture, or treat this mask activity as a note-duration model. Pause after deploy for
manual load/play/pause/chart feedback. Wall remains Off; MVP/XR Offscreen and T10 cleanup stay intact.


## Historical checkpoint - T11e prefix context, 2026-10-25

T11d accepted. T11e adds a bounded measurement of the dominant excess frequency neighborhood
in two clean prefix windows, with occupied/unoccupied/uncertain labels, exact support and explicit
full-track publication. Raw/core/T11b/c/d fields are retained. An inherited retrospective dedup
limit is documented: old local decision gates do not guarantee stable online entry publication.
[Contract, regression evidence and validation](../features/music-events.md#t11e---dominant-excess-neighborhood-context-2026-10-25).

**T11 remains partial; T12 not started.** Continue with validated musical event/role qualification;
this neighborhood label cannot identify sources, classify all AM/glides or remove true attacks.
No chart promotion or player toggle. Pause after deploy for manual load/play/pause feedback.
Wall remains Off; MVP/XR Offscreen rendering and T10 cleanup remain intact.


## Historical checkpoint - T11f local attack change, 2026-10-25

T11e accepted. Graphify refreshed first, including scripts/fixture generators and exact-symbol
navigation guidance; raw AST and clustered projection are local ignored artifacts. T11f adds
short-window positive spectral change tied to existing energy attacks, with continuous measures,
explicit unavailable states and full-track publication. It does not replace the legacy context
family, correct onset localization, classify instruments or promote chart inputs.
[Contract and acceptance limits](../features/music-events.md#t11f---attack-local-positive-spectral-change-2026-10-25).

**T11 remains partial; T12 not started.** Cumulative1809 run plus reviewed-hash correction/62 passing affected checks leaves nine exact
known failures. Source-stable3-recording parity is exact; offline elapsed delta+1.30%..+6.75%.
Commit/push and guarded deploy/public browser smoke precede the manual load/play/pause pause.
Following acceptance continue validated musical event/role qualification; nearby raw energy
attacks can still merge or retarget. Wall Off, MVP/XR Offscreen and T10 cleanup remain intact.


## Historical checkpoint - T11g quiet-prefix crossing, 2026-10-25

T11f accepted; user explicitly requested the next task and documentation at appropriate workflow
points. T11g adds an optional earliest short-energy threshold crossing after a qualified quiet
prefix, keeping every legacy attack and T11b-f field unchanged. It addresses the11 demonstrated
retargeting controls as an alternative time, not generalized musical/source onset recognition.
Prefix spikes, slow rises, DC steps, continuous background and incomplete support have explicit
limits. Parent owns shared schema; independent review defects are covered before final tests.
[Contract and acceptance](../features/music-events.md#t11g---quiet-prefix-energy-crossing-2026-10-25).

Build passes; full1812 tests/1803 pass/nine exact known failures, zero skips/cancellations.
Three full recordings preserve every prior value;90 controlled crossings and11 retargeting
comparisons pass within their declared scope. Commit/push, guarded deployment and browser smoke
precede the manual pause; actual receipts belong in logs/t11g/handoff.json. T11 remains partial; no T12.
No new player switch or render-frame DSP; Wall Off and MVP/XR Offscreen remain intact.


## Historical checkpoint - T11h short-spectrum anchoring, 2026-10-25

T11g accepted. T11h upgrades the existing short-spectrum sidecar to v2, using qualified quiet
crossings and retaining legacy fallback. All45 later-addition pairs preserve support and numeric
spectral measurements, including11 legacy-retargeted controls; IDs, attacks, chart and other
evidence are retained. v1 remains valid with its original window interpretation. No new sidecar,
player switch or frame DSP. [Contract](../features/music-events.md#t11h---crossing-anchored-short-spectral-change-2026-10-25).

Build passes; full1816/1807 pass/nine exact known failures, zero skips/cancellations. Both
source-stable3-recording comparisons preserve all other values; repeat offline elapsed+2.46%..+4.00%
is not a Quest/FPS claim. Commit/push and exact-source guarded deployment precede manual acceptance. Actual receipts belong in logs/t11h/handoff.json. Stop for
manual load/play/pause feedback after deployment. T11 remains partial; T12 not started. Next
freeze and test one selective musical-event qualification rule in the existing runner, starting
with quiet-prefix sustained-tonal controls and DC/AM/glide/legato/slow-rise/nearby-sound negatives.
Record event precision/recall, per-class confusion, abstention and transfer coverage before any
production classification or T12 promotion. Keep safe legacy fallback; this correction alone
does not establish instrument/vocal identity.


## Historical checkpoint - T11i quiet-carrier study, 2026-10-25

T11h accepted. Research-only classifier and corpus are frozen at8cd5c99 before transfer.
192 development/384 same-family parameter-transfer controls: clean36/36 and72/72; protected
FP0 instead of research context-only18/18. All-target recall47.1%, all authored tonal-start
coverage28.6%, not general music recognition. No production input/public schema/host consumer
changes; all389 build inputs exactly match T11h. Parent owns study/evaluation/docs; independent
review fixes precede freeze. [Study](../features/music-events.md#t11i---frozen-quiet-carrier-qualification-study-2026-10-25).

Build passes; full1820/1811 pass/nine exact known failures, zero skips/cancellations. Final
11-hash-stable runner reproduces all576 study cases and every T11h value on3 full recordings,
with zero research-qualified events. Final documentation commit, push and guarded deploy follow. Store actual source/Pages/browser receipts in logs/t11i/handoff.json.
Then stop for manual acceptance. T11 remains partial and T12 unstarted: selective synthetic
qualification is not sufficient for musical event/role promotion. Next qualify background-present candidates from existing spectral-entry evidence with
independently checked attribution/negative/transfer support; do not keep extending a quiet-only
selector that has zero coverage on these recordings or promote it into gameplay; do not replace missing evidence with another data envelope. Wall stays Off and
MVP/XR Offscreen code is unchanged.

## Historical checkpoint - T12a Musical character, 2026-10-25

T11i accepted. The user explicitly prioritized visible gameplay and accepted closing further T11
research as a prerequisite. T11 is closed for this phase with limited capabilities; unsupported
tonal/vocal recognition, dominance and background-present qualification remain deferred. No study,
historical result or regression was removed, and no research signal was promoted into gameplay.

T12a adds Choreography > Chart profile > Classic / Musical, saved through existing localStorage
and Copy descriptors. Musical uses existing complete section intervals to keep calm phrases
compact, develop builds and emphasize peaks, with compatible automation gestures inside each
family. Accepted BeatEvent indices/times/types are retained, including pairs; grid/sections/plan
never create silent targets. Activity/Variation/hands/lead/zones/difficulty still constrain the
score. Guarded runs after all placement/overhead work; it may simplify or drop proposals. Musical
selects Guarded, Movement Legacy explicitly returns Classic, and Classic alone retains the
displayed Movement choice. Missing/invalid section context reports Classic fallback / Guarded.
Default/legacy charts remain byte-identical. [Contract](../adr/ADR-009-xr-rhythm-game-host.md#addendum-aw--t12a-section-led-musical-chart-and-larger-menu-2026-10-25).

The user permits a larger whole menu to keep related settings together. Canvas1280×900 and
panel1.60×1.125m preserve physical text size, fit nine full rows and keep header/hint/footer clear.
No new tab. Desktop FOV/aspect/zoom fit and open-menu resize are covered; redraw-on-change remains.
One integration owner handles gameplay/schema/controller/settings/docs; a UI agent owns the menu
and an independent read-only gameplay review found no blocking defect.

Validation: `npm run build`; `npm test -- --test-reporter=tap` — **1828 total,1819 pass,nine exact
known failures,0 skips/cancellations**. Failure names AND assertion messages match
`logs/timing-cleanup/baseline-failures.json`. `node --test --test-reporter=tap
tests/xr-musical-character.test.mjs tests/xr-menu.test.mjs tests/xr-settings.test.mjs
tests/xr-controller-regeneration.test.mjs` was run during development; two old hardcoded menu
coordinate conversions and one new test's missing initial paint were corrected without weakening
assertions. `node --test tests/xr-menu.test.mjs tests/xr-controller-regeneration.test.mjs`39/39;
`node --test tests/xr-musical-character.test.mjs`6/6; all55 affected tests pass in the final full run.
The new motor matrix covers360 difficulty/hand/zone/space/lead combinations with Activity/Variation
and trusted/untrusted meter, determinism, immutable inputs, pair atomicity and original provenance.
Missing/gapped/overlapping context, empty/sparse evidence, settings/store/Copy and stale regeneration
are covered. Historical default goldens remain unchanged. `git diff --check` clean.

Browser automation on the local host: Scienide Musical367 notes/367 arrows/3 pairs, actual Musical
/ Guarded context (no fallback); Classic/Guarded354/354/0; Classic/Legacy returns824/781/56.
Menu regeneration reuses the loaded analysis; play/pause, Copy success notice and reload persistence
pass, no console warnings/errors. Clipboard-tool readback returned a stale pre-T12 report despite
the success notice; browser clipboard payload is not claimed verified, while pure Copy/report and
controller routing regressions pass. No audio is uploaded; analysis runs locally in the worker.

Node25.2.1/npm11.6.2, no install/runtime fallback. No Python inference/pytest (no Python changes)
or physical Quest comfort/FPS test (no connected headset). Menu geometry/ray and desktop browser
validation do not substitute headset acceptance. Direct diff/independent review used;
`diff_export.ps1` considered and skipped. Graphify refreshed with AST-only extraction/clustering,
no LLM backend, semantic corpus or hooks. Actual graph/source/Pages/public-browser receipts belong
in ignored `logs/t12a/handoff.json`; final deployment rebuilds the committed source.

**Stop for manual acceptance after deployment.** Expect a larger menu and an opt-in playable change,
not new tonal/vocal recognition. T12 remains partial: source arbitration/fusion and complete
per-event rejection diagnostics are not delivered. After acceptance, continue the visible T12
work from this checkpoint; do not restart T11 research or claim unqualified musical identities.
Wall stays Off; MVP/XR Offscreen pipeline, DSP, source clock and worker contracts stay unchanged.

## Historical checkpoint - T12a1 hand recovery, 2026-10-25

Manual T12a feedback reported one hand disappearing, thinning the other hand's rhythm under
Musical/Ultra/Active/Expressive/Alternate/Even/Guarded/Crossover/Tall on No Good. This is a T12a
correction, not acceptance or the next roadmap task. The user's additional release request sets
Cockpit Off by default, including absent/invalid records and Reset; explicit saved choices remain.

Gameplay owns movement model V2: same speed/cut/clearance limits, early/late recovery alternatives
with explicit holds, physical post-crossing return reservation and four-real-group preview before
committing shared placement. Only the original and two existing own-side revoicings are compared;
ties retain the original. Preview reads the immutable history prefix and owns a bounded suffix,
without copying/erasing whole history or leaking trial IDs/segments. No altered hand/cut/time,
new note, source classifier, frame work, worker/schema or dependency. Final guard stays after
overhead. [Contract](xr-movement-contract.md#version-2--recovery-without-permanent-hand-starvation-t12a1-2026-10-25)
and [three-recording comparison](xr-movement-validation.md#t12a1-recording-regression--2026-10-25).

Same-source No Good V1:504 notes,64 left/440 right, last left50.643s; V2:999,495/504, both hands
reach405.513/406.140s,79 pairs. Goa451→909 and Scienide395→822 also retain both hands through
their final accepted events. All active half-minutes retain both hands; no forced hand relabeling.
This is ffmpeg44100Hz left-channel/motor evidence, not browser-identical PCM or musical accuracy.
The actual local browser No Good yields964 notes/922 arrows/83 pairs in Musical/Guarded; regeneration,
play/pause and default-Off cockpit work, no console warnings/errors. Audio released by reload.
The fresh local origin's default was inspected; public-host preexisting saved choices are preserved.

Final `npm run build` passes. `node --test --test-reporter=tap tests/rhythm-movement.test.mjs
tests/xr-musical-character.test.mjs tests/xr-settings.test.mjs tests/xr-cockpit.test.mjs
tests/xr-controller-regeneration.test.mjs`:60/60. New coverage includes mirrored recovery,
physical crossing-exit reservation and90 different384-second Musical Alternate/Even charts,
requiring both hands in each populated half-minute. All previous480/360 movement combinations,
collision/speed/rest/pair/provenance tests, default chart goldens and earlier research remain active.
`npm test -- --test-reporter=tap`:1831 total/1822 pass/nine exact known failures,0 skips/cancellations;
names AND assertion messages match `logs/timing-cleanup/baseline-failures.json`.
`git diff --check` clean. Default-Full expectations in three UI tests are explicitly updated for
the user's Off request; their predecessors remain in `9702aa57a95b3129619eb4421796da182802a58f`.

The superseded first full run was stopped after the default/source changed and is retained in
`logs/t12a1/full-tests.txt`; only `full-tests-final.txt` supplies final cumulative counts. An initial
diagnostic used an absent analyzer duration and produced an invalid empty chart; that attempt is
excluded. The corrected reusable evaluator derives duration from PCM length and rejects invalid
captures. Final reviewed recordings replay the exact cached source and retained V1 source hash.
An early waypoint experiment was removed; final motion routes retain the existing straight-path
collision rejection contract. An erasable-TypeScript syntax issue was fixed before the final build.

One integration owner; independent read-only gameplay reviews cover alternatives, reservations,
preview isolation and prefix optimization. Node25.2.1/npm11.6.2, no fallback or install. Python
inference/pytest not run (no Python changes); no physical Quest comfort/FPS test. Direct diff and
independent review replace `diff_export.ps1`, considered and skipped. AST-only Graphify refresh,
no LLM backend/hooks/semantic extraction. Actual source/Pages/public-browser/graph receipts:
ignored `logs/t12a1/handoff.json`; guarded deployment rebuilds the committed source.

**Stop for manual No Good acceptance after deploy.** Expect both hands and retained rhythm,
with cockpit default Off. Musical listening relevance and physical comfort are still manual;
this does not improve onset recognition. T12 remains partial; continue from this correction only
after feedback. T11 research remains closed for this phase. Wall Off and MVP/XR Offscreen remain.


## Historical checkpoint - T12b chart decisions, 2026-10-25

T12a1 hand recovery/default-Off cockpit accepted by the user's continuation. T12b completes
per-source-event selection accounting for the existing accepted BeatEvent chart path. Gameplay
owns one optional collector through the SAME planner/overhead/final-guard pipeline; XR owns
capture, generation-guarded publication and existing menu/drawer/Copy projection. No analyzer,
worker/state schema, frame DSP, visual preset, dependency or new persistable control.
[Contract](../adr/ADR-009-xr-rhythm-game-host.md#addendum-ay---t12b-source-event-chart-decisions-2026-10-25).

System > Diagnostics retains its existing localStorage/Copy policy. Main/pause menu and the track
panel show retained/source events, final note count and left/right totals; the panel also shows
skip reasons and guard revoicing. Copy stats includes full version-1 per-event decisions plus
settings, immediately at chart-ready, even before playing or with Wormhole Off. Original source
indices, proposal/final IDs, final mirrored hands, first rejection and actual guard issue codes
remain distinct. A pair is one source event/two notes. Intensity is not confidence and FX hits
are not asserted to be drums. No automatic experimental reports are written by the application.

Diagnostics-off uses the normal path without trace allocation. Toggle-on may build accounting
once from the captured analysis/plan, but never changes playback, scoring or the session chart.
No detailed per-frame serialization: summaries are cached and DOM data contains counts only;
full decisions serialize only on explicit Copy. Load/regeneration/error/dispose/toggle discard
stale chart records and prior performance summaries. Unrelated VR/background/halo errors retain
valid chart accounting. These two lifecycle distinctions were corrected during independent review.

Three previously accepted cached sources retain EXACT T12a1 chart SHA-256, not just counts:
No Good1500 source events ->920 retained events/999 notes (495L/504R),580 skipped,211 guard
revoicings; Goa1294->842/909(455L/454R),452 skipped,144 revoicings; Scienide1114->776/822
(416L/406R),338 skipped,149 revoicings. All source events and final note IDs account exactly once,
all three final charts pass movement validation. This is source/motor parity, not acoustic accuracy.
Receipts/full local decision JSON: ignored `logs/t12b/recording-summary.json`, `*-selection.json`.

Validation: `npm run build` passes (existing bundle-size warning). Targeted
`node --test --test-reporter=tap tests/xr-chart-diagnostics.test.mjs
 tests/xr-controller-regeneration.test.mjs tests/xr-menu.test.mjs tests/rhythm-movement.test.mjs
 tests/xr-musical-character.test.mjs`:63/63 before the final sixth lifecycle test; the final
`node --test --test-reporter=tap tests/xr-chart-diagnostics.test.mjs`:6/6. Original chart goldens,
movement/hand-starvation corpora and all historical studies/tests remain active. The first detailed
matrix exposed existing Tall overhead rest/parity removals; those now have their own authoritative
callback/reason, without changing placement. The initial failed attempt remains in ignored logs.
`npm test -- --test-reporter=tap`: **1837 total,1828 pass,nine exact known failures,0 skips or
cancellations**. Names AND assertion messages match `logs/timing-cleanup/baseline-failures.json`;
final receipt `logs/t12b/validation.json`, full output `logs/t12b/full-tests.txt`. `git diff --check`
passes. The existing DSP/preset suites account for the longer902-second cumulative run.

Local browser automation with an18-second synthetic impulse fixture shows21/35 events retained,
23 notes(13L/10R),14 skips with the actual five reason categories. Main menu summary and drawer
are readable; Copy stats reports success without starting playback. The browser clipboard bridge
returned empty despite that success notice, so native clipboard payload is not claimed verified;
controller/report tests verify the complete copied JSON and settings. Two later canvas-coordinate
calls timed out; DOM actions and captured screenshot still work, with no console warnings/errors.
The fixture is UI wiring evidence only, not a music or Quest benchmark.

One integration owner and independent read-only gameplay/UI reviews; all confirmed findings fixed.
Node25.2.1/npm11.6.2, no package/runtime fallback or install. No Python inference/pytest (no such
changes), no physical Quest FPS/comfort run (no headset). `diff_export.ps1` considered and skipped
in favor of direct diff plus independent review. Graphify refresh is AST-only, no LLM backend,
hooks or semantic corpus:894 files,8403 nodes,20231 raw/17740 canonical edges; canonical graph
has0 dangling edges (raw unresolved references remain explicitly retained). Actual graph/source/Pages/public smoke receipts: `logs/t12b/handoff.json`.

**Stop after deploy for manual acceptance.** Expect explainable counts/skip reasons through the
existing Diagnostics switch and Copy, with the accepted T12a1 gameplay unchanged. T12 remains
partial against the original general source-recognition/fusion scope: qualified multi-source
producers and optional source arbitration are deferred, not replaced by guessed tonal/vocal
labels. After acceptance continue T13 cue/visual-arrival timing on existing supported evidence;
its independent work does not reopen T11 qualification research. Wall stays Off, cockpit defaults
Off with explicit saved choices respected, and MVP/XR Offscreen rendering remains unchanged.


## Historical checkpoint - T13a measured structure, 2026-10-26

User accepted the audit recommendations and explicitly declined providing No Good timecodes.
They require a logic that uses existing rhythm/energy/concurrent spectral evidence to reconsider
drop/peak/verse/break roles. T13a therefore prioritizes measured structural interpretation before
the originally proposed cue-role/arrival slice. [Contract](../adr/ADR-009-xr-rhythm-game-host.md#addendum-az---t13a-measured-structural-interpretation-2026-10-26).

One integration owner: pure analyzer helper, optional dependency-light types and shared AudioEngine
publication. All three hosts receive one interpreted section list before any analysis callback.
No raw DSP/worker algorithm7 change, reanalysis option, accepted event/grid/cue/pattern timestamp
change, section-boundary relocation, renderer frame work or dependency. Existing source fixtures,
research and goldens remain active. Missing physical RMS/coverage/raw bands abstain; forged or
stale sidecars cannot pass by version alone. Magnitude shares are not independent source power;
constant-RMS rhythm/spectral changes remain meaningful. Source reasons/cue/pattern labels retain
raw-v7 provenance; corrected labels plus evidence are separately reported as structure-v1.

Synthetic controls distinguish observed build, contrast arrival, sustained peak, continuing body,
withdrawal/return and terminal position; adversarial raw labels cannot determine the result.
Controls include gain scaling, constant-RMS composition changes versus stationary evidence,
missing raw bands before normalization, malformed/stale reports, weighted partial-bar support,
immutable source and exact original boundaries. Shared AudioEngine ordering and existing
superseded-load/play/pause/seek/end tests remain active; XR cached summary/Copy are covered.
Targeted `node --test --test-reporter=tap tests/track-structure.test.mjs
 tests/xr-audio-integration.test.mjs tests/xr-chart-diagnostics.test.mjs
 tests/xr-controller-regeneration.test.mjs tests/xr-musical-character.test.mjs`:52/52.
`npm run build` passes with the existing chunk-size warning. The source-evolution manifest keeps
all prior hashes/review reasons and adds the derived type contract; the static publication
contract now checks normalization->interpretation->callbacks. Its predecessor is retained in
Git75d75a9. `node --test --test-reporter=tap tests/accepted-timing-measurement.test.mjs
 tests/contracts.test.mjs tests/track-structure.test.mjs tests/xr-audio-integration.test.mjs`:57/57.
The intermediate full run found those two intentional contract migrations; both were fixed,
retested and that run retained as `full-tests-before-contract-migration.txt`.
Final `npm test -- --test-reporter=tap`:1848 tests,1839 pass,nine failures,zero skips/cancellations;
all nine failure names AND assertion messages exactly match `logs/timing-cleanup/baseline-failures.json`.
No new regression; final run duration731.49s. `git diff --check` passes.
Graphify final AST refresh:896 files,8418 nodes,20266 raw edges;17773 canonical edges,zero
canonical dangling endpoints. Raw unresolved references remain navigation evidence, not ownership.

Fresh ffmpeg44100Hz left-channel runs use the same PCM hashes as the accepted captures. All three
retain EXACT accepted-event lists, beats and section intervals, with valid Guarded charts and both
hands in every populated half-minute. Final No Good:27/36 label changes, including74.374–87.702s
outro->break with mid/high coexistence;1014 notes(508L/506R),79 pairs. Goa15/32 changes,929notes
(465L/464R),68pairs; Scienide18/30 changes,816notes(410L/406R),45pairs. No Good peak17->4,
Goa13->6, Scienide11->1: these are policy decisions, not a measured accuracy score or target counts.
Detailed records: ignored `logs/t13a/recording-summary-final.json` and `*-final.json`.

The first peak rule compared section means with individual bar quantiles and was overly strict
on compressed mixes; the final rule compares like-sized active-section means and relative spread.
The superseded cumulative run was stopped after that material change and retained as
`logs/t13a/full-tests-first.txt`; only the final full run supplies acceptance counts. Earlier local
recording iterations remain separate and are excluded from final claims. No old result was rewritten.

Independent read-only gameplay/render reviews led to equal-level, raw availability and stale
sidecar corrections. The helper preserves its normalized input refs; the AudioEngine integration
harness intentionally stubs normalization, while a separate test covers the real normalizer's
missing-band defaults. Node25.2.1/npm11.6.2, no package/runtime fallback or install. No Python
inference/pytest (no Python implementation change), no physical Quest FPS/comfort run. Direct diff
and independent reviews used; diff_export.ps1 considered and skipped. Graphify AST-only refresh,
no LLM backend/hooks/semantic corpus. Actual source/Pages/public smoke receipts: `logs/t13a/handoff.json`.
Local HTTP smoke passes200/title. In-app browser creation twice timed out before webview attach;
selected-browser inventory remained empty. A purpose-built open_in_codex attempt also did not
complete and its wait was terminated. No pixel, actual browser audio, clipboard or headset
acceptance is claimed for this slice unless a later public smoke receipt explicitly records it.
Public artifact/route verification remains required before handoff.

**Stop for manual acceptance after deployment.** Expect corrected structural captions and matching
new auto-plan/gameplay/score character on reloading a track; Diagnostics/Copy expose old/new labels
and measured reasons. Saved explicit journeys may retain older authored plans. Existing Wall Off,
cockpit default Off and MVP/XR Offscreen remain. T13 is partial: exact boundaries, cue-role
placement and visual arrival still need correction. T12 local musical attention is next after the
timing foundations; Musical's fixed calm treatment is not claimed solved here. No independent
melody/vocal/instrument identification or human musical precision claim. Do not ask again for
manual timecodes as a prerequisite; continue from existing evidence and known controls after feedback.


## Current continuation checkpoint - T13b cue purposes, 2026-10-26

Historical handoff, accepted by the user's subsequent continuation; the T13c checkpoint below supersedes its next-step wording.

User accepted T13a and authorized continuation with the usual per-task deploy/manual pause.
One integration owner changed automation/type/transfer/XR diagnostics seams; independent read-only
runtime and gameplay reviews checked the cross-module contract. [Contract](../adr/ADR-009-xr-rhythm-game-host.md#addendum-ba---t13b-cue-purposes-and-causal-scene-placement-2026-10-26).

Fresh plans carry cuePlacement requested family + originating half-open window. Scene entry seeks
matching section/structural evidence at or after its own start; inner visual envelope handoffs
seek structural changes; actual impact factories still require attack, optional decay requires
release. No generic fallback for an explicit request. Intersect original midpoint/+/-4s bounds,
retain selected role's real source evidence, reject invalid explicit metadata and keep manual/
locked/edited points unchanged. Only the actual opening gets initial-state-at-zero. Entry wins a
close collision with a preceding scene accent; indexed decisions preserve duplicate-ID accounting.
Unknown but resolved automatic target handles cannot masquerade as manual. Legacy section/cue
lookup now agrees with half-open ownership. No raw analyzer/events/clock/render changes or toggle.

Diagnostics uses the existing persisted switch; drawer has a cached count and Copy adds the full
current Automation JSON with requested windows/selected times/omission reasons. Lifecycle clearing
matches the chart report; valid generated intent survives the existing Copy/Load whitelist.

Validation: 181/181 targeted tests pass: `node --test --test-reporter=tap tests/automation-cue-alignment.test.mjs tests/automation-cue-roles.test.mjs tests/dramaturgy-transfer.test.mjs tests/visual-os.test.mjs tests/automation.test.mjs tests/accepted-timing-measurement.test.mjs tests/dramaturgy.test.mjs tests/morph-scale.test.mjs tests/xr-chart-diagnostics.test.mjs tests/track-structure.test.mjs tests/xr-controller-regeneration.test.mjs`. Build/diff pass (existing chunk warning). Final native `npm test -- --test-reporter=tap`:1863 tests,1853 pass,10 raw failures,zero skips/
cancellations (884.99s). Nine baseline failures match names AND assertion messages exactly.
The extra unchanged PowerShell source-export case hit its30s child-process limit during the
concurrent suite; isolated `node --test --test-reporter=tap tests/source-export-powershell.test.mjs`
passes both pwsh/powershell cases2/2 in16.83s with identical source and timeout, no assertion change.
Raw full failure remains in the log and separate execution-failure record, never added to the
baseline. The validator checks that single exact extra failure, its isolated resolution and all
nine baseline assertions separately. No unresolved new regression.
Node25.2.1/npm11.6.2; no runtime/package install or substitution. The sandbox Windows Temp rename
was denied with EPERM in dev-preset-save.test.mjs, independently reproduced; the unchanged test
passes2/2 under native Windows Temp. Final cumulative npm test is therefore unsandboxed with the
same runner, every active test, no exclusion or edited historical measurement. Initial sandbox and
superseded runtime runs remain separately retained, not acceptance evidence. The only type
provenance manifest migration retains the prior hash/reason and complete source in Git0471d12.

Two old behavioural fixture expectations intentionally evolve, with fixtures unchanged and
predecessors retained in Git0471d12: FX-only anchors no longer satisfy explicit scene/structural
requests; a first section at0.2 stays0.2 instead of inventing an initial state at0. The cumulative
suite still includes the original untyped normal and opted-in experimental compatibility tests.

The initial envelope-start=percussion-attack policy published only15/186 No Good,17/167 Goa,
16/164 Scienide proposals, all scene entries. These mixtures lack qualifying accepted impact-CUE
coverage, not percussion. This negative result exposed a category error: micro-choreography's
attack is a visual envelope phase, with no onset detector input. Replaced that request with
explicit structure for inner handoffs, retaining strict true-attack/decay requests. Superseded
reports and full runs are retained separately; no old measurement or golden overwritten.
Final fresh ffmpeg44100Hz left-channel captures exactly retain T13a PCM hashes, accepted events,
beats, corrected sections/structure. No Good103/186 proposals published (15entry/88structure),
Goa130/167(17/113),Scienide117/164(16/101). Omitted respectively83(82no-role+1collision),37,47;
all explicit unsupported requests abstain. Prior published points outside their now-explicit
originating windows:13/16/8, now0. This establishes causal policy consistency, not human musical
accuracy or target-arrival error. Charts1004(500L/504R),901(453L/448R),801(405L/396R); all valid
and both hands in each populated30s window. Records: logs/t13b/*-accepted.json[.source.json] and
recording-summary.json. Earlier -final/-reviewed runs are superseded, retained separately.

Graphify final refresh:896 files,8423 nodes,20274 raw edges,17781 canonical edges,zero canonical dangling endpoints (2456 raw unresolved references retained). AST only, no LLM/hooks/semantic corpus. Direct diff + independent reviews;
diff_export.ps1 considered/skipped. Local Vite HTTP/browser shell loaded. Tab attach initially timed out but appeared in inventory;
No Good file chooser transfer took565s, then decode progressed to Worker analysis failed without
captured warning/error details. Small-file chooser retry timed out and reset the automation
session; subsequent tab binding also timed out. No completed browser analysis/play/Copy/pixel
smoke or Quest acceptance is claimed. The analyzer.worker-CKk3Bkpp.js build SHA remains exactly
eb5de8199ca4f3a44a8c3d64361515fa385bfd401a6b796853fd617300e65fb5, identical to T13a; new gate
runs after that worker. Cause of browser failure remains unverified. Public artifact/routes must
still pass guarded verification; automated UI coverage is separate from actual browser operation. No physical Quest test or Python model
inference (no device/Python implementation change). Detailed commands, source/Pages receipts and
limitations are in ignored logs/t13b/handoff.json. Source is pushed to the existing branch;
no master merge/new PR is implied.

Stop after deploy for manual acceptance. Reload the audio and compare automatic changes at scene
entries and within long sections; use Diagnostics/Copy to inspect omitted/selected purposes.
This improves cue selection and prevents early/cross-scene placements; point.time is still morph
START. Actual interpolation/deadline, geometry-floor re-expansion and semantic anticipation are
T13c, then T12 local attention. No annotated musical accuracy or p95 visible-arrival gain is claimed.
Wall remains Off; cockpit defaults Off; existing saved explicit choices and MVP/XR Offscreen remain.

## Current continuation checkpoint - T13c finite preset-base deadlines, 2026-10-26

Historical handoff accepted by subsequent continuation; T13d below supersedes the automatic scheduling rule.

T13b was accepted. One integration owner implements automation/config, host lifecycle and render
ordering; independent read-only visual/gameplay reviews checked ownership and compatibility.
[Contract](../adr/ADR-009-xr-rhythm-game-host.md#addendum-bb---t13c-finite-preset-base-deadlines-2026-10-26).
Generated cuePlacement points reach preset-base endpoints at start + authored/scaled duration,
including short transitions; legacy untyped/manual laws remain. Canonical partial inheritance,
interruption, rewind/pause, missing-asset suffix fencing, actual point references and per-track
seeds prevent history-dependent base drift. MVP uses its own populated asset cache. Semantic and
manual deltas compose separately after gains; ordinary smoothing resumes after arrival. Signed
spiral magnitude shares the finite deadline, with the player's forced direction applied afterward.
The normal legacy direction change still uses song-time smoothing, including while paused.
Duplicate point IDs no longer collapse morph-scale durations. No new switch or storage migration.
Prewarm on asset publication; bounded policy-change rebuild remains possible on demand. No FFT
or new clock/worker interpolation. Existing MVP/XR Offscreen architecture remains authoritative.

The reusable exclusive-output evaluator is `node scripts/evaluate-automation-arrival.mjs INPUT.source.json OUTPUT_NEW.json`.
It reads an accepted source capture and shipped local presets, records source/evaluator hashes,
and checks raw preset-base + signed endpoints. It does not decode audio or measure human musical
accuracy, semantic modulation or particle arrival. Run on the retained T13b captures:
`node scripts/evaluate-automation-arrival.mjs logs/t13b/no-good-accepted.json.source.json logs/t13c/no-good-final-arrival.json`
(repeat for goa/scienide, with new output names). All350 points pass with zero residual:
No Good103, Goa130, Scienide117. Desktop preparation14.23/13.07/11.73ms, warm1000 configure-guard
plus base/signed samples74.45/84.76/87.65ms; informational only, not Quest frame-budget evidence.
Earlier iteration outputs remain separately retained, never overwritten as historical evidence.
`node scripts/evaluate-movement.mjs --source logs/t13b/no-good-accepted.json.source.json logs/t13c/no-good-chart.json`
(repeat goa/scienide) exactly reproduces the entire T13b result value on all three recordings,
including chart hashes, source provenance, settings, movement validation and every hand window:
1004/901/801 notes. No new DSP run or timestamp change is claimed.

Targeted178/178 before the full follow-up: `node --test --test-reporter=tap tests/automation-arrival.test.mjs tests/morphing.test.mjs tests/mvp-async-lifecycle.test.mjs tests/wormhole-frame-context.test.mjs tests/wormhole-spiral-history.test.mjs tests/wormhole-spiral-consumers.test.mjs tests/morph-scale.test.mjs tests/mvp-morph-scale-control.test.mjs tests/contracts.test.mjs tests/accepted-timing-measurement.test.mjs tests/semantics-integration.test.mjs tests/mvp-macro-tuning-mapper.test.mjs tests/visual-mode-transition.test.mjs tests/styles-deterministic.test.mjs`.
The first full run1876/1864 pass/12 fail exposed one real untyped forced-direction regression
(fixed), plus two source-shape assertions that required reviewed evolution. Follow-up
`node --test --test-reporter=tap tests/xr-wormhole-spatial.test.mjs tests/wormhole-frame-context.test.mjs tests/timeline-ui.test.mjs tests/wormhole-clip-profile.test.mjs`
is57/53 pass/4 exact retained preset baseline failures. The paused legacy direction test itself
is unchanged and passes after the code correction. No first-run failure is hidden or reclassified
as a new baseline. Final cumulative run:1876 tests,1867 pass,9 fail,0 skipped/cancelled,1044.13s.
All nine failure names AND assertion messages exactly match logs/timing-cleanup/baseline-failures.json;
no extra timeout or unresolved new regression. Strict checker: node logs/t13c/check-validation.mjs.
Acceptance log: logs/t13c/full-tests-acceptance.txt; earlier full-tests-final.txt is superseded.
Inventory retains198 active test files and256 test/helper/fixture identities in logs/t13c/test-inventory.json.

Reviewed static/fixture migrations retain their predecessor in Git3246bc0: trigger now accepts
the cached scaled view; the floor assertion explicitly applies only to untyped predecessors;
contract signatures include the new optional cached-plan argument/cuePlacement guard; MVP signed
fixture supplies the actual private owned cache rather than an unrelated global map. Original
payloads/behavior assertions remain. New actual host/helper tests cover finite and legacy behavior
together. No golden, prior result or measured analyzer-source manifest is rewritten.

`npm run build` passes TypeScript/Vite (existing chunk-size warning). Node25.2.1/npm11.6.2,
no dependency install, runner substitution or Bun fallback. Final cumulative command is
`npm test -- --test-reporter=tap --test-concurrency=4`: native Windows execution is required because
the unchanged preset-save atomic Temp rename is denied with EPERM in the sandbox. Four-way
parallelism limits resource contention; every active discovered test remains included. No Python
implementation/model inference change, so no Python pytest/inference; no physical Quest attached.
Direct diff and independent read-only review used; optional diff_export.ps1 considered/skipped.

Browser fixture `tests/browser/wormhole-spiral-smoke.html` retains its legacy buttons and adds a
Finite deadline check using actual WormholeCanvasSource instances: opposing signed directions,
0.1s typed transition, midpoint/end sampling, residual0 and374400 coloured pixels, no console
warning/error. Screenshot: logs/t13c/finite-render-smoke.png. Native Vite localhost HTTP200;
the earlier sandbox server was unreachable. Actual MVP accepts the existing12s WAV, completes
analysis/plan, plays, pauses and seeks to6s with no captured console warning/error. Its main
preview is black in background IAB. A separate Git3246bc0 source snapshot on localhost5178
reproduces the same black preview with the same audio and6s seek. This rules out a new T13c-only
symptom, but does not establish its cause or a successful MVP pixel test. The comparison file
chooser stalled1466s despite a10s requested timeout; no long-audio retry is used. Screenshot
proofs and browser limitations are retained in logs/t13c. This is not full No Good/Quest acceptance.

Stop after guarded deploy for manual acceptance. Reload the track, compare short visual morphs
and repeat a passage after forward/backward seeks. The expected improvement is a bounded preset
transition instead of indefinitely approaching its base target. Point.time remains START:
cue-at-arrival/pre-roll, semantic anticipation and in-flight geometry arrival remain later work,
so the whole T13/p95 musical-arrival gate is still partial. Then continue T12 local attention.
Graphify code-only refresh covers899 files,8482 nodes,20432 raw edges and17930 canonical edges;
canonical dangling endpoints0 (2464 raw unresolved navigation references retained). The new helper
resolves to actual dashboard/MVP/context callers. AST retained before clustering; no LLM labels,
backend, hooks, semantic corpus or visualization. Generated graph remains ignored. Document audit
checks126 local links including fragments; diff whitespace check passes. Both owned local servers
were stopped and no listeners remain on5177/5178. Temporary test tabs are not marked as handoffs.

Wall remains Off; cockpit defaults Off; saved explicit choices remain. Source push/deployment
receipts and exact public checks are retained in logs/t13c/handoff.json; no new PR/master merge.

## Current continuation checkpoint - T13d preset-base cue arrival, 2026-10-26

T13c accepted. One integration owner changes shared automation/config, host projection and UI
timing presentation; independent read-only visual/gameplay reviews checked the contract and
adversarial ownership cases. [Contract](../adr/ADR-009-xr-rhythm-game-host.md#addendum-bc---t13d-preset-base-arrival-at-the-canonical-cue-2026-10-26).
Canonical cue times, source windows, plan/event/note timestamps and logical trigger tokens stay
unchanged. Eligible automatic typed preset bases start before the cue and arrive AT it. Both
current and previous point must be unlocked/non-manual with cuePlacement. A protected or legacy
predecessor, or a late first state, retains start-duration timing. An initial state at0 is established.
This is a bounded preset-base pre-roll, not the whole T13 musical/semantic arrival gate.

Separate render-window and logical-cue lookups prevent early ownership/semantic/event publication.
Newly acquired continuous fields fade their inherited host offset; selectors remain logical until
the cue. Signed magnitude/direction have separate ownership, including the shared merge's implicit
Right default when acquiring magnitude. Player forced direction applies last. Current disturbance
anchor identity stays on the logical cue, rather than starting a future pulse at pre-roll start.
Common scaling uses the preceding gap for arrival points and following gap for protected/legacy
points. The established initial state uses no transition budget. XR prepares the same default
projection as dashboard/MVP for fully automatic typed plans; raw publications stay immutable.
Mixed/protected/legacy XR plans keep their original identity and authored durations; dashboard/MVP
explicit global-scale behavior remains the existing host policy. A mixed locked4s regression
prevents accidental common rescaling of a protected XR point.

TimelineCanvas caches the derived layout, draws the same finite curve/window before the unchanged
cue and labels ARRIVE. Its shared use covers dashboard and MVP. Generated arrival duration is
edited through the inspector; canonical cue remains selectable. Actual edits, move and nudge
become reason:manual and clear a stale selected cueAnchor. A no-op/selection retains automatic
timing. Existing cuePlacement provenance survives; those manual points use T13c start-duration.
No new switch, storage migration, dependency, FFT, worker interpolation or clock. Existing files
are extended; no new product/research helper file is needed for this slice.

Validation before the final cumulative run:244/244 targeted, TypeScript/Vite build pass (existing
chunk warning). Command: `node --test --test-reporter=tap tests/automation-arrival.test.mjs tests/morph-scale.test.mjs tests/ui/TimelineCanvas.test.mjs tests/mvp-async-lifecycle.test.mjs tests/automation-plan-editing.test.mjs tests/wormhole-frame-context.test.mjs tests/mvp-morph-scale-control.test.mjs tests/contracts.test.mjs tests/morphing.test.mjs tests/timeline-ui.test.mjs tests/accepted-timing-measurement.test.mjs tests/wormhole-spiral-history.test.mjs tests/xr-wormhole-spatial.test.mjs tests/semantics-integration.test.mjs tests/mvp-macro-tuning-mapper.test.mjs tests/visual-mode-transition.test.mjs tests/styles-deterministic.test.mjs tests/gameplay-purity.test.mjs`.
Acceptance logs: logs/t13d/targeted-freeze.txt and build-freeze.txt. Initial harness assertions
mistakenly compared cross-VM object prototypes and one new event assertion omitted the existing
per-frame decay; corrected without weakening value checks. New review regressions cover ownership
acquisition, default direction, selectors, protected predecessors, clipping, duplicates, missing
assets, source immutability, actual host seek, event timing, manualization and default scale parity.
Three test-loader updates accept explicit .ts imports needed by the Node-compatible shared helper;
they no longer append .ts twice. Storage/session tests pass28/28 separately. T13c finite fixture cases now explicitly locked, retaining their
start-duration expectations alongside new automatic-arrival cases. Predecessor source/tests in
Git4bcb4946946e93e8df7c14b672f0baee36f6be85; no previous golden or result overwritten.

The only measured-source manifest change is a comment-only src/types/index.ts correction of the
cue/start description. No DTO shape changes. Complete previous manifest/source retained at that
same Git commit, all superseded hashes/review reasons retained in the migration; the unchanged
historical replay/provenance assertions remain active. Review identified/fixed signed partial
ownership and implicit default, shared scaling direction and XR default parity before acceptance.
The first full run was deliberately interrupted for those final source corrections; its partial
log remains logs/t13d/full-tests-final.txt. It is not acceptance evidence or a new baseline.

Reusable evaluator extended, with exclusive output and exact source hashes:
`node scripts/evaluate-automation-arrival.mjs logs/t13b/no-good-accepted.json.source.json logs/t13d/no-good-final-arrival.json`
(repeat goa/scienide). It now measures actual default-scale windows and an ACTIVE warm pre-roll,
including configure guards plus both samplers. All350 endpoints pass with residual0:347 cue
arrivals (102/129/116) plus3 established initial states. Default scale1 on each recording.
Preparation20.03/27.92/19.98ms and warm1000 samples102.17/112.93/151.85ms are informational desktop
Node timings, not physical Quest budgets. Earlier unscaled/warm-after-arrival iteration results
are retained separately and not used for performance claims. Scope excludes semantic modulation,
emitted geometry and human-annotated musical accuracy.

`node scripts/evaluate-movement.mjs --source logs/t13b/no-good-accepted.json.source.json logs/t13d/no-good-chart.json`
(repeat goa/scienide) exactly matches the full retained T13c result values on all recordings:
source hashes/settings, chart hashes, validation and hand windows,1004/901/801 notes. No fresh DSP
or musical accuracy result is inferred. Recording summary: logs/t13d/recording-summary.json.

Browser fixture uses real WormholeCanvasSource and shared TimelineCanvas, no audio upload. It
checks0.1s pre-roll midpoint, endpoint at4.0s and unchanged logical ownership before cue, alongside
the retained locked start-duration check. The pixel criterion now excludes the uniform background;
the earlier sum>20 criterion counted that background and is not valid nonblank evidence. Its old
result is retained. Actual pixel/console/compatibility receipt and screenshot are recorded in the
handoff. No full No Good/MVP playback or physical Quest run is claimed; T13c's reproduced black
background-IAB MVP preview remains a known unresolved environment/product symptom. No blind
file-chooser retry. Existing actual host numeric/lifecycle coverage remains cumulative.

Final cumulative command: `npm test -- --test-reporter=tap --test-concurrency=4`, native Windows
Temp because the unchanged preset-save rename is blocked with EPERM in the sandbox. Same
Node25.2.1/npm11.6.2, no install, runner substitution or Bun fallback. No Python/model change,
so no Python pytest/inference. Full receipt, Graphify, document audit and public release checks
are appended after completion; direct diff/read-only reviews used, diff_export.ps1 considered/skipped.

After guarded source push/deploy, STOP for manual feedback. Reload the track and compare short
automatic changes at section/cue markers and their ARRIVE bars; repeat after a seek. Protected
predecessors intentionally keep start-based behavior. Semantic envelopes and in-flight geometry
still have their own lifetimes; no p95 musical-accuracy promotion. Next bounded work is their
timing contract, then T12 local musical attention. Wall Off, cockpit default Off and MVP/XR
Offscreen remain. Detailed receipts/continuation: logs/t13d/handoff.json; no new PR/master merge.

Final T13d receipt: `npm test -- --test-reporter=tap --test-concurrency=4` completes1893 tests,
1884 pass,9 fail,0 skipped/cancelled in861.21s. All nine failure names AND messages exactly match
the retained baseline. `node logs/t13d/check-validation.mjs` passes; acceptance is the complete
logs/t13d/full-tests-acceptance.txt, not the interrupted earlier run. The mixed protected XR
correction is also separately checked35/35 by `node --test --test-reporter=tap tests/wormhole-frame-context.test.mjs tests/gameplay-purity.test.mjs tests/xr-wormhole-spatial.test.mjs`.
The two storage-loader migrations pass28/28 with `node --test --test-reporter=tap tests/mvp-track-storage.test.mjs tests/mvp-session-persistence.test.mjs`.
Final `npm run build` and `git diff --check` pass. Inventory retains198 active files and256
test/helper/fixture byte identities. Existing failures and all earlier test results remain retained.

Final browser proof: actual new cue arrival has endpoint residual0, midpoint error1.865e-14,
logical=true and302 bright chromatic pixels excluding the background. Locked compatibility
has residual0 and26576 such pixels. Shared actual TimelineCanvas shows the2–4s ramp ending at
the unchanged4s cue with ARRIVE; console warnings/errors0. Screenshot:
logs/t13d/render-and-timeline-accepted.png. This replaces the invalid all-background pixel count
as evidence without rewriting its old result. Own fixture tab closed; own5177 server stopped,
no listener remains. No full MVP audio/pixel or headset acceptance is invented.

Final Graphify full code-only refresh:899 files,8495 nodes,20486 raw edges,17984 canonical edges,
canonical dangling endpoints0 (2464 raw unresolved references). Incremental extraction produced
only40 nodes/128 edges; that partial is retained separately and was replaced by a complete
manifest-cleared extraction before clustering. Raw AST retained before clustering. No LLM labels,
backend/hooks/semantic corpus or visualization. Scoped runtime helper navigation resolves actual
host consumers; graph communities do not establish ownership. `node logs/t13d/check-docs.mjs`
checks128 local links/fragments. Final source/Pages/release verification is recorded in the handoff
and workspace continuation file after guarded publication, followed by the manual pause.

## Current continuation checkpoint - T13e semantic timing (2026-10-26)

T13d was accepted. This slice completes the bounded runtime foundation before returning to T12
local musical attention. ADR-003 already publishes scored transition pre-roll; its runtime held
sparse knots and smoothed the timed envelope again. No new anticipation detector is needed.
Integration owner: this chat. Semantics owns pure target resolution, visuals render composition,
UI raw base/seed handoff, and docs/build validation/publication. Parent was the sole editor;
independent read-only reviews covered code and docs, without substituting for tests.

MotifRuntimeAdapter compiles adjacent knots only inside the SAME explicitly scored transition:
matching motif ID, behavior, from/to roles and preserve policy, finite increasing time/progress.
It linearly samples already authored knot values, not a second application of the score curve.
Ordinary/legacy/malformed/mismatched spans hold. Missing actions are zero. Numeric motif
intensity/density/motion/novelty interpolate; canonical time, phrase position, wrapped phase,
operators, seed and token retain their published frame. Cached sampled data never mutates the
publication. Changed sample time invalidates resolution despite stable canonical identity.

The adapter publishes only changed semantic-owned target keys and releases exact still-owned
values on the original config object. Unrelated manual controls survive. Both raw base object
identity and value changes invalidate the cache: a new equal-valued snapshot after preset
restoration must re-publish a held contribution. Empty/pre-first/invalid-time plans release
ownership without clamping raw settings. The three-argument resolver keeps its numeric API;
an optional reusable output avoids full config allocation per sample. No State/DOM/audio import.

SemanticTuningProjection stores exact pre-overlay values, including saturation. Consumers first
restore it, morph/sample the separately gain-resolved PRESET BASE, then apply the resolved
semantic delta once before director/draw. MVP copies its reused gain scratch before resolving
base; finite and signed automation receive that base too. Cosmic dashboard/MVP and shared
WormholeFrameContext use this path; other dashboard semantic consumers retain the prior path.
Imported ADR-004 resolver windows/interpolation and all producers remain unchanged. Its adapter
exposes raw base and restores still-owned target values on removal/disable. No second worker
interpolator, clock, DSP, switch, DTO or storage migration.

Partial preset merges restore clean raw base first. Finite seeds capture it, and track-load entry
restores it before AudioEngine clears the old plan/base. Consecutive tracks cannot inherit an old
delta as baseline. Reverse XR seeks reset raw target AND raw base before preset replay. Review
fixes cover unrelated-key overwrite, cross-track inheritance and equal-valued snapshot caching.

Visible expectation: existing Wormhole semantic changes advance between scored snapshots without
an added exponential tail. T13d preset-base arrival and canonical cue/event/note ownership remain.
This is not a new effect, local-attention chart mode or instrument recognition. Emitted particles,
trails and natural geometry retain lifetimes intentionally; clearing them at each cue would alter
the effect. Perceptual arrival and annotated musical precision/p95 remain unproven. Those research
limits are not another prerequisite blocking T12. Wall Off, cockpit default Off and Offscreen stay.

Validation on final source: expanded targeted316/316 pass,0 skip/cancel; TypeScript/Vite build pass
with the existing chunk-size warning. Logs: logs/t13e/targeted-final-rebase.txt and
build-final-rebase.txt. It covers semantic sampling/projection, actual renderer/context, gains,
finite/signed automation, seek/pause/saturation, partial presets/load, density/resize, timeline,
editing, measurement provenance, semantics/DSL, deterministic styles and gameplay purity.
Exact scoped/expanded commands are retained in logs/t13e/handoff.json after publication.
The final cumulative command is npm test -- --test-reporter=tap --test-concurrency=4; its complete
receipt follows below. Native Windows Temp avoids the unchanged sandbox EPERM preset-save rename;
Node25.2.1/npm11.6.2 stay unchanged. No dependency installation, Bun or runner substitution.

Narrow retained-test migrations: the import contract accepts the new adapter, semanticPlanRuntime
mock implements raw-base restore, and the density-only harness supplies a tuning-clone function
instead of treating it as generic Empty class. Original payloads and all assertions remain;
predecessor source is Git7ffbd922d4e87cf7aa963baa82a2202bc7596e31. The complete pre-density-fix
run remains1909/1891 pass/18 fail in full-tests-before-density-loader-fix.txt. Its nine additional
mock failures are not relabeled baseline. Corrected density/renderer/contracts pass52/52. Earlier
load-fix and equal-snapshot partial runs are retained separately as interrupted, not acceptance.
No historical golden/result/measurement manifest is rewritten. Final executable source was frozen
before the acceptance cumulative launch. A prior indentation-only change generated identical JS.

Existing evaluate-movement.mjs replay on three retained logs/t13b/*-accepted.json.source.json
captures exactly matches complete T13d result values:1004/901/801 notes and hand validation.
Existing evaluate-automation-arrival.mjs still reaches all350 preset-base endpoints with residual0.
All outputs use NEW logs/t13e/* paths. Producer and ADR-004 source identity checks are unchanged;
no fresh DSP, human labels or musical accuracy is inferred. Optional resolver-output parity passes
120 deterministic comparisons. Final-source warm pure adapter+projection probe:10000 samples in
1270.31ms (0.1270ms/sample), informational desktop Node under concurrent validation, excluding
gains/director/raster/transport/Quest. Source hashes/scope remain in runtime-warm-final.json;
earlier probe retained. No CI time gate. No Python/model change; pytest/inference are not rerun.

The existing browser fixture includes real WormholeCanvasSource semantic sampling, token and
pause-drift assertions. IAB attach and Chrome creation timed out; these NEW browser assertions
and pixels are unexecuted, not a pass. Native Vite returns HTTP200, its5177 server is stopped and
no listener remains. No old screenshot is presented as current proof. Actual renderer/context
numeric pipelines pass. Full No Good audio/pixel, physical Quest and the previous black IAB MVP
symptom remain manual/unresolved. No file-chooser retry. Direct diffs/read-only audits were used;
diff_export.ps1 considered and skipped for this bounded change.

Graphify is refreshed after the equal-snapshot fix:902 code files,8525 nodes,20581 raw edges,
18074 canonical edges,0 canonical dangling endpoints (2468 raw unresolved references). Full
manifest-reset extraction completed before raw-copy/clustering; earlier premature old graph is
retained separately and superseded. No LLM labels/hooks/backend/semantic corpus/visualization.
Exact-symbol navigation is checked against source/tests, not treated as ownership proof. Inventory
retains199 active files/257 test-helper-fixture byte identities.131 local doc links/fragments pass.

After source push and guarded Pages verification STOP for manual acceptance. Test a Wormhole
transition, pause/seek into it, reselect the same preset, then load another track; check continuity
and absence of inherited old effect. Next is T12 local musical attention from accepted local
rhythm/energy/spectral evidence rather than universal calm/break policy. Do not reopen unsupported
T11 classifiers or extend T13 indefinitely. No new PR/master merge. Final machine/publication
receipts and exact commands: logs/t13e/handoff.json and workspace continuation status.

Final acceptance receipt (2026-10-27): npm test -- --test-reporter=tap --test-concurrency=4
completes1910 tests:1901 pass,9 fail,0 skipped/cancelled. All nine names AND messages exactly
match logs/timing-cleanup/baseline-failures.json. node logs/t13e/check-validation.mjs passes;
acceptance is full-tests-acceptance.txt, not either interrupted or the pre-density-fix run.
The recorded5225.16-second duration includes an observed system-clock jump during the run and
is not a performance benchmark; the child processes were independently checked as progressing.
Final targeted316/316, build, output-buffer120/120, retained chart/endpoint replay,131 document
links and diff checks pass. Final source commits/public release verification are recorded after
guarded publication in logs/t13e/handoff.json and the workspace continuation status. STOP then
for manual acceptance; next T12 local musical attention, no new PR/master merge.

## Current continuation checkpoint - T12c1 local attention (2026-10-27)

User rejected the impression that changed charts imply better musical understanding. They
explicitly selected local T12c first, external full-song model comparison later. With20% account
budget remaining they require bounded subtasks, a stop and a question before each next subtask.
T12c/1 owns pure gameplay ranking, compact XR measurement projection, existing diagnostics/menu
wording and reproduction. Parent edits all crossing boundaries; independent read-only review.

Musical now selects source events using local relative intensity, three-group published spectral
CHANGE and real event gaps under an Activity/Difficulty budget. The explicit frame clock is
sampleRate/hopSize; malformed values/association fail to declared events-only fallback. No source,
melody/vocal identity, new onset or confidence is inferred. The eligible BeatEvents keep their
exact original times/types/intensities. No worker schema, analyzer, DSP, audio clock or renderer
changes. Classic remains separate; existing Musical storage/Copy choice is reused.

Selection precedes layout and the unchanged Guarded model. Musical no longer forces calm from
break/intro labels, cycles a section vocabulary, suppresses echo half-bars or section/phrase
breaths, or reserves singles away for a potentially impossible future pair. Physical spacing,
dense-run fatigue and explicit hand choices remain. Together keeps observable shared accents;
Alternate accent cadence remains sparser. A missing/tail-truncated meter cannot reuse an expired
window. Incomplete section context retains Classic/Guarded fallback. Diagnostics/Copy report
frame-change versus events-only and separate local-attention from motor rejection.

Controlled checks: matched-budget spectral swaps inside ONE break change selected original
indices; relabeling and visual cue insertion cannot replace evidence; translated passages,
explicit/malformed clocks, uniform/accented Together, immutability, original timing and Classic
invariance are covered. Existing360 motor combinations and long hand-coverage cases remain.
Targeted104/104 initially passed; final controls include11 new cases and the retained suites.
The old test requiring a break to be calm was explicitly replaced with label invariance, with
predecessor source retained in Git ea4b4ba9a3eec0bf9f377ee2dc08cdd9f3b1b890. Original independent
safety/provenance/settings/golden assertions remain. No golden or old result was regenerated.

Existing scripts/evaluate-movement.mjs now captures compact evidence and supports --baseline-chart
SHA to compare the retained WHOLE chart policy; --baseline still means movement-only. Exclusive
new output paths preserve prior results. Fresh No Good channel0/44100Hz PCM hash, accepted events,
beats, corrected sections and plan exactly match the retained T13b capture. With the user's
Musical/Ultra/Active/Expressive/Alternate/Even/Crossover/Tall/Guarded settings, baseline1004 notes
(500L/504R,87pairs) becomes1180 (596L/584R,3pairs); model validation passes and both hands remain
active.1342/1492 eligible candidates are selected before motor layout. Fewer forced pairs and
more surviving source events are behavior changes, NOT a musical accuracy score. Earlier low-
band-weight iteration is retained separately; acceptance uses no-good-reviewed.json only.
Command: node scripts/evaluate-movement.mjs --recording AUDIO logs/t12c/no-good-reviewed.json
--baseline-chart ea4b4ba. No external model was run. Acoustic/functional quality and physical Quest
remain manual; broad three-recording transfer belongs to T12c/2. No independent structure fix.

Final validation/build/full-regression/Graphify/public receipts are recorded after completion in
logs/t12c/handoff.json. Commands use existing Node25.2.1/npm11.6.2; no install/Bun fallback. Full
suite uses native Windows Temp due the known sandbox preset-save EPERM; compare all9 baseline
failure names AND messages. Old results remain unchanged. No Python/model/inference changes.
After commit/push/guarded deploy STOP. Explain visible behavior, request manual test and ASK before
T12c/2. Do not continue automatically. Wall Off, cockpit default Off and Offscreen remain.

Final T12c/1 receipt: 1921 cumulative tests,1912 pass,9 exact retained
baseline failures,0 skipped/cancelled; names AND messages checked. Targeted104/104 and build pass.
Graphify full904 files/8552 nodes/20655 raw/18145 canonical edges,
0 canonical dangling endpoints; raw retained before clustering, no LLM/hooks.200 active test files,
258 test/helper/fixture byte identities retained. Public receipt follows in logs/t12c/handoff.json.
STOP for manual feedback and ask before T12c/2, as explicitly requested for remaining budget.

## Current continuation checkpoint - T12c/2 transfer review (2026-10-27)

The user accepted T12c/1 and authorized this bounded comparison, retaining an explicit STOP and
question between subtasks because account budget is low. Owner: integration, research CLI/tests
and documentation. No runtime source, new setting, dependency, analyzer/cache version, worker
payload, clock or renderer change. Wall Off, cockpit default Off and MVP/XR Offscreen remain.

`scripts/evaluate-movement.mjs` is now safely importable and adds a pure observer, exercised by
six regressions in `tests/attention-transfer-metrics.test.mjs`. Importing runs no recording or
file write. Existing CLI outputs remain exclusive new files. `--baseline-chart ea4b4ba` restores
the four historical chart/movement/planner modules, rather than merely the movement limiter.

Observer contract: chart IDs must map to the exact source event index/time/type; paired hands
count once, while distinct simultaneous events remain distinct. Intensity comes from the source,
not clamped chart notes. Explicit frame clock and event-associated evidence are validated;
missing/malformed evidence abstains. Compare 4-second strata at BOTH offsets 0 and 2 seconds.
For each stratum k=min(old unique event count,new unique event count); both feature means receive
the same k weight. This removes note-count redistribution as an automatic advantage. It is the
analytic expectation of matched-k subsampling, not a feasible randomly generated motor chart.
Both empty and one-sided strata, clipped duration and common support are reported. Review caught
and corrected an initial populated-source-only denominator; the earlier reports remain retained,
and only `logs/t12c2/*-final.json` and `final-summary.json` are final coverage evidence.

All three full recordings use the user's Musical/Ultra/Active/Expressive/Alternate/Even/Guarded/
Crossover/Tall generation configuration. Presentation settings do not enter this offline chart
comparison. GoA/Scienide were freshly decoded through the existing channel-0 44.1-kHz path;
No Good reuses the immutable T12c/1 full-track enriched capture because its runtime is unchanged.
PCM hashes and ALL prior capture keys (events, duration, beats, bars, timing confidence, sections,
section starts, performance plan) exactly match the canonical T13b captures. Only compact
frame-associated attention evidence is additive. Full chart/window hashes also match the
pre-observer outputs. Receipts: `source-parity.json`, `runtime-parity.json` in `logs/t12c2/`.

| Recording | Old policy notes | Local policy notes (L/R; pairs) | Raw -> Guarded notes | Model issues |
| --- | ---: | --- | --- | ---: |
| No Good | 1004 | 1180 (596/584; 3) | 1225 -> 1180 | 0 |
| GoA | 901 | 1063 (538/525; 10) | 1119 -> 1063 | 0 |
| Scienide | 801 | 899 (452/447; 22) | 921 -> 899 | 0 |

Every populated 30-second final-chart window retains both hands. This model check does not
establish physical Quest safety, listening accuracy or a musical-density target. Separate
selection rejection reasons (local budget, hand policy, overhead rest, spacing, movement) are
retained in each final report; Guarded losses are not silently presented as attention selection.

| Recording | Source-intensity delta, offsets 0 / 2 | Published positive-band-change delta, offsets 0 / 2 | Common seconds; matched events, offsets 0 / 2 |
| --- | --- | --- | --- |
| No Good | +0.01753 / +0.01519 | +0.01701 / +0.01382 | 400;906 / 384;903 |
| GoA | -0.00835 / -0.00774 | -0.00011 / +0.00031 | 340;812 / 340;821 |
| Scienide | +0.02818 / +0.02944 | +0.01970 / +0.02346 | 340;728 / 344;731 |

Published band change means positive differences in track-normalized perceptual 24-band balance,
aggregated into three equal groups. It is NOT raw spectral flux, instrument separation, independent
ground truth or a musical-quality score. The selector uses these same features. No Good/Scienide
show improved self-feature retention on shared support; GoA is near-flat/offset-sensitive in band
change and lower in source intensity. Neither higher note count nor these mixed measurements
proves the user's perceived rhythmic relevance has been solved. No weights or runtime policies
are tuned to make this small, self-scored corpus look better.

Decision: close the local transfer/calibration slice with NO further runtime tuning. Expected
player behavior is exactly T12c/1; this delivery improves reproducible checking and honest scope,
not the visible game. Remaining full-song boundary/function validation needs the separately
approved external structural-model preparation/study, independent evidence and listening. No
external model is installed or run here, no structure labels/boundaries corrected, no automatic
T12c/3 added. STOP after commit/push/deploy and ask before that separate next step.

Final T12c/2 receipt: 1927 cumulative tests, 1918 pass, 9 exact retained
baseline failures (names AND messages), 0 skipped/cancelled. Broad targeted110/110, reviewed
observer/selector17/17 and final build pass. 201 active test files / 259 test-helper-fixture
byte identities retained. Graphify code-only full905 files/8551 nodes,
20666 raw/18150 canonical edges, 0 canonical dangling endpoints; raw retained, no LLM/hooks.
Public release/source/artifact identity and final handoff: logs/t12c2/handoff.json.
STOP and ask before separately preparing the full-song structural-model study.

## Current continuation checkpoint - T13f full-song structure study (2026-10-28)

The user explicitly authorized ALL subtasks of the separate full-song model study without the
old between-subtask pause. Preparation, local inference, comparison, review/repairs, evidence,
versioning and guarded publication belong to this delivery. Stop after its final handoff; do not
continue into the next implementation automatically. This is not another T12c/3 calibration loop.
Owner: integration, research tools/tests and documentation. No production src, DTO/cache version,
worker, playback clock, preset, menu/localStorage setting or renderer change.

Actual external inference is complete: All-In-One harmonix-all (all eight checkpoints, one family
vote) and the official integrated SongFormer checkpoint, each on the complete No Good, GoA and
Scienide recordings. No audio upload, new training or model source/weights enter the product.
All six decoded PCM identities exactly match the retained Plexus captures. SongFormer loads with
zero missing/unexpected/mismatched parameters. The isolated CPU environment, model/source hashes,
rights limitations, exact reproduction and all data are described in the
[study](../../research/analyzer-lab/docs/FULL-SONG-STRUCTURE-STUDY.md).

| Recording | Plexus / All-In-One / SongFormer sections | Shared external boundaries / label-changing subset | Plexus internal boundary matches at 0.5 / 1 / 3 seconds |
| --- | --- | --- | --- |
| No Good | 36 / 27 / 29 | 21 / 4 | 0 / 12 / 18 (35 Plexus boundaries) |
| GoA | 32 / 22 / 25 | 15 / 3 | 5 / 5 / 6 (31 Plexus boundaries) |
| Scienide | 30 / 27 / 27 | 23 / 2 | 13 / 19 / 23 (29 Plexus boundaries) |

These are one-to-one prediction agreements, not accuracy. Function-changing means each external
classifier changes its label there, not that both agree on the same named function. Both raw and
label-changing references are retained; no chorus-to-drop mapping. Training-set overlap is
unverified, the models share some postprocessing ancestry, and the unannotated three-song cohort
is not a held-out generalization claim. Most time has no directly comparable label spelling;
Plexus verse is also a continuing-body/ambiguous-role fallback, not a learned vocal-verse class.

The pulse grid must not be conflated with meter phase or cue choice. At 70 ms, Plexus vs All-In-One
beat-grid agreement F1 is 0.97069 / 0.84337 / 0.81888. No Good downbeat matching is 0 of 243/244
at BOTH 150 and 500 ms despite strong beat agreement; first boundaries 1.0449 vs 0.21 seconds
show a roughly half-bar phase difference relative to that model. This is not evidence of an
AudioContext/playback-clock drift. Quiet-span grid extrapolation and unsupported SongFormer
beat/downbeat output remain distinct from false detections (SongFormer capability is null).

Actual published automation was also checked, rather than scoring only raw sections. The
36 / 32 / 30 proposed scene entries become 15 / 17 / 16 published entries (21 / 15 / 14 omitted).
The paired timing cohort excludes the initial state and contains the SAME surviving 14 / 16 / 15
points before and after cue anchoring; internal evolution cues are not macrosection targets.
Against shared raw boundaries, planned -> published matches at 0.5 seconds are 0->4 / 3->3 /
10->2; at 1 second 4->4 / 3->3 / 14->11; at 3 seconds 7->8 / 3->3 / 14->14. Thus T13b's local
anchoring is not a universal improvement on these references. Small moves can cross a tolerance
edge; these counts do not justify an automatic rollback. Against the smaller shared function-
changing subset, published matches at 1 second are only 1/4 / 1/3 / 1/2. Neither subset is truth.

Source review explains an asymmetry worth addressing in the NEXT original implementation:
alignAutomationToCues bounds accepted evidence by cuePlacement.start. A scene-entry proposal
starts exactly there, so it can move later but cannot correct an early candidate lying before
that approximate scene boundary. All surviving scene-entry shifts here are forward; median
0.627 / 0.302 / 0.139 seconds. This intentional ownership guard must not simply be deleted or
replaced with a hardcoded track offset. The next design needs to distinguish uncertain measured
scene boundaries from protected cue ownership, and evaluate meter phase plus multifeature/
recurrence support. Preserve deterministic clocks and manual/locked-point protection.

Repairs delivered here: the existing research bridge now admits the analyzer's legitimate
shared-types runtime constants while rejecting other subsystems/external imports. This fixes
real Python integration failures. The provider recheck's 260-character Windows temp-path issue
was resolved with a shorter test path; the existing lab was registered with --no-deps. No old
test was weakened. The new runner fails closed on nonfinite PCM and SongFormer input outside
its validated complete 1..420-second window. It never truncates a longer song. The pure observer
and plotter retain immutable results, input/source hashes, distinct family votes, missing support,
raw terminal quantization, actual planned/published cue cohorts and both reference resolutions.

Decision: close this full model-study task with NO production threshold/label/tempo retuning.
The original source still needs bounded structure/meter/cue work; T12c's local note attention
also does not identify drums, vocals or a dominant musical source. The next implementation should
address that structure/ownership defect first, then note-source selection using qualified existing
capabilities; do not reopen unbounded T11 research or silently advance T14 as if music precision
were solved. No per-song timestamps, ML weights, new experimental menu buttons or default changes.
Expected game behavior remains T12c/1. Wall Off, cockpit default Off and MVP/XR Offscreen remain.

Acceptance: full Python341/341; final targeted14/14 (8 new structure cases +6 retained attention
observer cases), real six-output comparison and visual inspection of the standalone figure.
Final cumulative Node, Graphify, exact build/public/source identity and commit receipts are in
logs/t13f/handoff.json. Prior failures/download attempts/observer revisions remain separate from
comparison-accepted.json; its numeric results exactly match the inspected figure's input.
STOP after commit/push/deploy for manual review; the next product implementation is separate.

Final T13f acceptance: final cumulative Node1935/1926 pass/9 exact baseline
failures (names AND messages), 0 skipped/cancelled; Python341/341, targeted14/14, build/diff pass.
Graphify full code-only909 files/8572 nodes/20717 raw/18180
canonical edges, 0 canonical dangling endpoints; raw retained, no LLM/hooks/semantic rebuild.
All259 earlier Node test/helper/fixture identities preserved;202active/260total.
The six actual model outputs are complete, and the full comparison/figure has been reviewed.
Source/push,54-file byte-equivalent app release and3-host public verification: logs/t13f/handoff.json.
STOP for manual review of this completed study; next original product correction is separate.

## Current continuation checkpoint - T13g scene-entry refinement (2026-10-28)

The user accepted T13f and authorized the next product task. This bounded correction removes the
one-sided entry defect without treating uncertain estimated boundaries as immutable acoustic truth.
The semantic evidence helper compares existing feature projections on both sides of already
accepted structural anchors. A stronger sustained change in at least two projections, supported
in two post-windows, may refine a scene entry within two beats (maximum two seconds). Exact
feature-clock coverage and original-neighbour/scene-end/tail protection are mandatory. Missing,
malformed, transient-only or one-projection evidence cannot authorize it. Manual/locked/edited
points, other cue purposes and compatibility rules keep their existing ownership.

The publication gate refines a copied scene-entry window start only when selected evidence
precedes the estimate. Original placement/time remain in the indexed report and plannedTime;
the selected time remains an exact accepted source timestamp. Copy/Load and T13d/T13e arrival,
pre-roll and direct seek use the existing schema/clocks. No new control, experimental mode,
detector, worker/cache version, runtime ML, waveform DSP or render-frame work. The stale morph
START comment in the gate is corrected to the actual runtime arrival contract. See the
[normative policy](../adr/ADR-005-visual-os-style-system.md#addendum-estimated-scene-entry-refinement---t13g-2026-10-28).

Three real recordings were analyzed once under the preceding implementation, then the exact
immutable published analyses were replayed under the correction. PCM matches all six retained
T13f model outputs, and all three BEFORE plans exactly match the older T12c captures. No model
was rerun, no timestamp/label imported and no old result/test rewritten. Analysis hashes and
full before/after captures remain in logs/t13g; the reusable evaluator is versioned under
research/analyzer-lab/diagnostics/evaluate-cue-placement.mjs.

| Recording | Published scene entries incl. opening, before / after | Existing entries retimed / omitted entries recovered | Raw shared-boundary matches at 0.5 / 1 / 3 seconds, before -> after |
| --- | --- | --- | --- |
| No Good | 15 / 19 of 36 proposals | 0 / 4 | 4/4/8 -> 5/5/9 |
| GoA | 17 / 18 of 32 proposals | 0 / 1 | 3/3/3 -> 3/3/3 |
| Scienide | 16 / 18 of 30 proposals | 3 / 2 | 2/11/14 -> 5/12/14 |

The references contain 21/15/23 raw boundaries and only 4/3/2 jointly label-changing boundaries.
Against the latter, cue matches stay 1/1/4, 1/1/1, 1/1/2 across the three tolerances. Cohorts
grow here: more matches alone are NOT an accuracy gain. GoA adds an unmatched entry, and
Scienide's 3-second F1 decreases with added unmatched entries despite tighter-tolerance gains.
This is a local ownership/placement correction supported by original sustained evidence; it does
not solve macro-function detection, meter phase or dominant-source recognition. The whole-song
sections/labels, beats and barStarts remain byte-equivalent and are deliberately not retuned.

Under the reported Musical/Ultra/Active/Expressive/Alternate/Even/Guarded/Crossover/Tall settings,
the resulting full charts contain No Good1181 (587L/594R), GoA1063 (538L/525R), Scienide901
(453L/448R); all motor checks pass. Changes in phrase context can slightly affect downstream
choreography; this does not replace its accepted acoustic-event source or claim new music identity.
Wall Off, cockpit default Off and MVP/XR Offscreen remain. User expectation: some previously late
or missing section entries can align earlier to an audible sustained change; no universal new
drop/verse detector or wholesale note-rhythm improvement should be inferred.

Validation and final source/push/public release receipts: logs/t13g/handoff.json. All prior Node
test/helper/fixture identities and Python test sources are retained; the new ten-case suite
adds transient/repeated-rhythm negatives, exact-clock failure, stronger-current preservation,
neighbour/manual/locked protection, Copy/Load and arrival/seek checks. Stop after deployment for
manual testing. Next authorized work should address qualified acoustic note-source selection
with explicit capability limits, while the unresolved structure/meter problem stays documented.

The first full integration run exposed a missing explicit .ts runtime import in the new helper
and the measured-source identity guard on an unnecessary type-comment edit. The import is fixed;
the entire type file is restored to its exact predecessor bytes, and the policy is documented
in ADR-005 instead. No protected fixture/test/hash allowlist was changed. The 33-case integration
recheck passes, numerical plans are identical to the initial replay, and the final full suite
runs again on the corrected source. Earlier failures/replays remain retained separately.

Final acceptance: Node1945/1936 pass/9 exact retained baseline failures (names AND messages),
zero skipped/cancelled; targeted89/89 and integration33/33, Python341/341. TypeScript/Vite build,
diff and177 local documentation links pass. All260 predecessor test/helper/fixture identities
remain unchanged;203 active files/261 identities now include the ten new cases. Final full
code-only Graphify:911 files/8592 nodes/20754 raw edges/18212 canonical edges, dangling0.
No LLM/hooks/semantic-corpus rebuild. Warmed desktop publication medians (nine repeats) are
37/77/47 ms on the three tracks; they are load-time-only observations, not Quest frame benchmarks.
Two logical commits, remote identity, guarded54-file/396-input release and three-route public
verification are recorded in logs/t13g/handoff.json; only the three intended cue implementation
build inputs change. STOP for manual testing after deploy; all earlier artifacts remain retained.

## Current continuation checkpoint - T12d percussive note source (2026-10-28)

The user accepted T13g and authorized the next task. Owners: analyzer/shared contracts and thin
audio/worker transport, pure gameplay, XR composition/diagnostics, renderer preparation and docs.
The existing strong supplemental percussive gates now expose a separate optional chart pool
BEFORE visual grid/proximity suppression. Every legacy hit is retained exactly. The same adaptive
floor, sustain/bass exclusions and engineering types are reused; no detector thresholds or model
labels are fitted. These are frame-window measured peaks, not certified drum/vocal/source onsets.
Raw T11/AN-03 candidate-only/scoring-ineligible layers stay ineligible and are not consumed.

AudioEngine requests the pool only for XR. The worker forwards one optional typed flag; default
headless/dashboard/MVP publications remain unchanged. Normalization validates clock, strict
frame order, values and legacy inclusion; invalid/missing pools and explicit experimental accepted
retiming retain the legacy source. The existing Musical profile selects the pool and measures its
compact attention once. Classic returns the original event array; all five difficulties on all
three recordings produce exactly the old Classic charts. Diagnostics use the selected array's
indices and report origin, potential additions and budget. Existing generation guards/lifecycle,
copied/persisted settings and motor/spacing policies remain. No new player switch or storage key.

The first full three-song replay revealed an actual implementation problem: pool growth also
raised Activity's candidate-count budget. Counts became1321/1225/1083 and equal-cardinality
self-feature alignment decreased. This draft is retained, not promoted. A separately frozen
protocol amendment decouples choice and density: the same existing budget formula uses eligible
legacy-event cardinality per attention window while ranking the enlarged pool. Newly evidenced
empty windows allow one spaced hit; invalid budgets fail conservatively. No score/threshold/time
was tuned to music. Both freezes, initial and corrected outputs remain in logs/t12d.

| Recording | Legacy / expanded events | Potential added peaks / actually chosen added source events | Old / final notes | Final left / right |
| --- | --- | --- | --- | --- |
| No Good | 1500 / 2046 | 546 / 88 | 1181 / 1129 | 564 / 565 |
| GoA | 1294 / 2188 | 894 / 177 | 1063 / 1043 | 529 / 514 |
| Scienide | 1114 / 1567 | 453 / 81 | 901 / 899 | 457 / 442 |

All PCM hashes match T13g/T13f. The ENTIRE interpreted analysis excluding only the new pool
hashes identically to T13g on each full song; all legacy events, cues, grids, sections and prepared
automation plans match. All final notes refer to measured selected-source events. Motor checks
pass, populated30s windows retain both hands, and every Classic difficulty is byte-equivalent.
Same-feature, common-cardinality four-second comparisons at offsets0/2 improve positive band-
change retention on all three recordings (about+0.020..0.022 / +0.046 / +0.018). Intensity improves
on No Good/GoA and slightly decreases on Scienide (about-0.004). These correlated, selector-owned
features are NOT independent acoustic/musical accuracy. More candidates or fewer notes is no
quality proof, and notes/IDs/hand placement may change with the supported source choice.

The original nine percussive waveform/assertion controls were separately replayed against the
pool through only a test-local projection adapter;9/9 pass, including rolling/offbeat bass,
sustain and kick/rumble/ghost-hit controls. This derived replay is not new independent material
or double-counted canonical coverage. The new canonical suite adds13 schema/source/budget/raw
audio/worker/copy-transfer/stale-publication/renderer-omission/profile-regeneration cases. The
strict JSON schema gains only the optional pool; prior schema bytes/constraints are preserved
in documents/tests/analysis-result-schema.pre-t12d.json. The reviewed source-evolution registry
retains all previous reasons/hashes and its exact predecessor archive; no old measurement or
test/helper source is overwritten. Schema shape validation and physical runtime validation stay
distinct. The broader current legacy percussion tests remain active in the complete suite.

No extra FFT, draw-time ranking, onset packet or GPU work. The render-worker projection omits
the pool alongside musicActivity while retaining main snapshot/cache identity. Wall Off, cockpit
default Off and MVP/XR Offscreen remain. Existing diagnostic timing text now distinguishes
manual/legacy morph starts from eligible automatic preset arrival deadlines. Policy:
[ADR-009 BG](../adr/ADR-009-xr-rhythm-game-host.md#addendum-bg---t12d-percussive-chart-source-and-independent-density-budget-2026-10-28).

Final cumulative validation, source/push, graph and guarded public release: logs/t12d/handoff.json.
STOP after commit/push/deploy for manual Musical testing with the user's current settings.
This closes the bounded note-source correction; dominant source/melody/vocal recognition and
macrostructure/meter accuracy remain unresolved. After manual feedback, continue the main plan
(T14 visible HUD work is independent) with those limits explicit; do not open another unbounded
T11/model/tolerance-fitting loop or claim complete musical precision.

Final acceptance: Node1958/1949 pass/9 exact baseline failures (names AND messages), zero
skipped/cancelled; targeted142/142, Python341/341, separate percussive-pool replay9/9, schema
positive/legacy and four shape-negative probes pass. Runtime normalizer tests cover physical
clock/frame/order/inclusion constraints beyond the historical schema's numeric field shapes.
All260 unaffected predecessor test/helper/fixture identities remain exact; the one strict schema
extension has an exact archived predecessor and reviewed hashes. No old test/helper source was
changed. Current204 active Node files/262 identities include13 new cases. Build/diff and196 local
documentation references pass. Graphify full code-only914 files/8622 nodes/20824 raw/18279
canonical edges, canonical dangling0; no LLM/hooks/semantic-corpus rebuild. Final18 implementation/
tool hashes equal the pre-budgeted-replay freeze; only those18 build inputs change (398 total).
The superseded first full development run was explicitly stopped to free resources; its output
and cancellation reason remain retained, and it is never counted as completed coverage. The
complete final run includes every prior active test on the frozen corrected source. Source/push,
three logical commits and guarded public artifact/route verification: logs/t12d/handoff.json.
