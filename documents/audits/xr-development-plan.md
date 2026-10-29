# Plexus XR execution and measurement plan (T01)

Date: 2026-10-23 (Europe/Budapest). Integration/contract owner: the agent in this chat.
Status: T01 staged plan accepted by the user; individual proposals remain gated by their owning tasks.
Baseline: `effd6db7d268fd318dbcd4dbb1bec18e268a5441`; branch `codex/xr-development-baseline`.
The user accepted the T00 handoff by asking to continue. This accepts continuation, not an
invented headset/performance report. T00's nine product failures and missing measurements remain.

Read together with the [tracker](xr-development-tracker.md),
[baseline](xr-development-baseline.md), [architecture contract](../governance/architecture-contract.md)
and [testing policy](../governance/testing-validation.md). AGENTS remains authoritative.
Every task or smaller delivered implementation slice is deployed to the verified current target
before its manual-test pause, following the user's later explicit instruction. Until T24 the
current target is the existing GitHub Pages deployment, not an unidentified DotRoll environment.
No parallel agents are required by this plan; one integration owner controls cross-module contracts.

## Independently reviewable architecture proposals

| Proposal | Boundary | Acceptance before implementation |
| --- | --- | --- |
| [ADR-011](../adr/ADR-011-shared-wormhole-frame-context.md) | Shared Wormhole context, signed twist, exact-frame and separate native data seam | Confirm host policy handoff, preview/exact ownership and versions; T06 record layout reviewed after element inventory |
| [ADR-012](../adr/ADR-012-isolated-export-job-runtime.md) | Frozen snapshot, private render context, job control | Confirm snapshot/resource ownership and Stop/Cancel semantics; implement and validate in T19 slices |
| [ADR-013](../adr/ADR-013-studio-server-session-boundary.md) | Launcher, server authorization and business authority | T23/T24 require actual platform/product decisions; no hosting stack selected now |

ADR-010 is occupied by PR 8. ADR-011/012/013 were absent from current master and the inspected
PR's ADR list when drafted. Recheck numbering before merge. These files are Proposed and grant
no new import exception. Where an accepted implementation needs a new composition/state boundary,
update AGENTS, affected governance, tests and ADR status together under the integration owner.

Source caveat: featureFlags.semanticResolver and semanticChoreography are currently true, although
older comments/governance describe off defaults. T01 records this drift and preserves actual
behavior; changing those flags is not an incidental documentation fix. Visual OS default generation
and its existing legacy fallback remain unchanged.

## Decisions and compatibility registry

| ID | Open decision | Working assumption / trigger |
| --- | --- | --- |
| D01 | Meaning of tsrs | Resolved by user at T17: WASM acceleration is the goal; ts-rs only if justified. Scalar WAT/WABT research ABI needs no Rust DTO generation or root dependency change |
| D02 | DotRoll domain/package/runtime | Unknown; no server deployment assumptions. Ask before T23 environment selection, then verify actual platform at T24 |
| D03 | Which business/IP computations move server-side | Auth/authorization/secrets server-side; client hot paths remain local. Ask before server service implementation; scaffold is not completed IP protection |
| D04 | New export container/codecs | MP4/H.264/AAC proposed beside existing WebM; confirm at T20 before backend/license work |
| D05 | Meaning of highlighted note | Initial accent/phrase/section role, same judge/base score; ask at T08 if reference implies a different mechanic. Any bonus requires separate scoring policy |
| D06 | Complete native 3D representation | T06 inventory covers every family; grains/trails spike alone stays partial. Do not promote until element representation and stereo/perf evidence are accepted |
| D07 | Freedom while exporting | MVP editing/playback can continue against an immutable job snapshot. Host navigation/tab close need guard; persistence requires a separate server job |
| D08 | Caption timing/subset/overlap | Manual `[start,end)` blocks, no HTML/automatic lyric alignment. Confirm subset/overlap at T21; propose reject overlaps in first version |
| D09 | Which visible motion must turn left/right | T04 reproduces coherent spiral; ask if spiral/lens/local flow/path bend is still ambiguous after reproduction. No camera roll workaround |
| D10 | Cockpit reference | Original image(6).png has not been inspected. Locate/request it at T07; text description enables planning but cannot prove reference match |
| D11 | Reference tracks and physical device runs | Select and identify tracks when measuring relevant tasks; current Node fixtures are not headset evidence. User continuation does not supply missing device metrics |

Only the dependent decision gates its task. D01-D04 do not block T03 or other independent XR work.
All choices above are reversible proposals until implemented and evidenced. Do not ask for secrets,
domain credentials or an entire requirements questionnaire during the first XR slice.

| Contract / cache | Current | Proposed change / compatibility and rollback |
| --- | --- | --- |
| XR settings storage | v1, 40/100/200 m | T03 adds 500 as an allowed value; same v1 shape, current 200 default unchanged. Old app may normalize 500 to its default; retain old values |
| Plan payload | version 1, optional bendMirror | T04 optional spiralDirection beside bendMirror, absent +1; transfer/normalizer/history round trips updated together; older readers may drop it |
| Tuning | nonnegative wormholeSpiral | T04 separate normalized direction [-1,1], legacy +1, no macro gain; signed effective twist follows shared interpolation. Keep magnitude/boost behavior |
| Preview render worker | protocol 1, preparation generation | T05 preview adapter remains compatible; exact-frame worker protocol 2 separately negotiated; fail/fallback rather than misread v1 |
| Exact frame identity | no per-request serial | Proposed contextId/generation/requestSerial/songTime; atomic companion data, explicit result lease |
| Native spatial carriers | no complete native contract | T06 separate schema v1 after element/stride/units inventory; never reinterpret raster-coordinate buffers as 3D |
| Analyzer/cache | algorithm 7, hop 1024, optional eventTiming | T10 numeric changes require algorithm/cache increment with worker/normalizer/all hosts; no bump for T01 or backend-only numerically equivalent port |
| Musical evidence/chart | optional research evidence; legacy BeatEvents | T11 versioned optional event stream and provenance; T12 opt-in chart-generation profile/version. Old payload -> current chart fallback |
| Export | unversioned worker, global state | T19 snapshot v1 + job protocol v1 + render sampling identity; additive legacy ExportBackend adapter; active job disposed before fallback/new start |
| Captions | absent | T21 caption-plan schema v1, empty fallback, snapshot captures it; no audio or asset handles in saved workspace |
| Server | absent | T23 API /api/v1 and session schema v1 proposed; gated actual runtime/store. No frontend auth bypass or fabricated server config |

Proposed composition flags start off: sharedWormholeContext (T05), nativeWormhole3d (T06),
isolatedExportRuntime (T19), validated musical evidence/chart profile (T11/T12) and wasmAnalyzer
(T18). Names are proposals, not keys present in featureFlags.ts. Signed spiral legacy +1 needs
no broad generator switch; cockpit/halo/HUD/center display have explicit Off/current-look settings.
WASM has TS fallback, native3d has hybrid fallback, WebGL has Canvas2D fallback. Auth has no bypass
fallback: Studio stays closed if its server gate is unavailable. Promotions change defaults only
after their task-specific evidence; they do not silently rewrite previously saved settings.

## Review and implementation order

T01 is documentation only. The next proposed product task is T03, followed by a user test pause.
The first release slice then proceeds through T02/T04/T05/T07/T08, T09/T14/T16 as their dependencies
allow. These are separate changes, not one feature branch merge of PR 8. T06, T10-T13/T15,
T17-T18, T19-T21 and T22-T24 remain separately gated work streams executed sequentially here.

| Review slice | Scope | Exit / manual handoff |
| --- | --- | --- |
| T03 | Settings/type/list/UI/store plus 500 m clipping/depth calculation | Existing distances/default unchanged; menu persistence; head-turn corners; raster unchanged |
| T02a | Minimal role-sidecar and notification contract | Domain purity, reset/seek/finish/idempotence; observer exceptions isolated after committed judgment |
| T02b | Controller/scene role lifecycle seam | Generation invalidation/dispose; no WorldDirector dependency; integration tests |
| T04a | Config/tuning/plan/transfer direction ownership | Legacy +1, old payload/history, one mirror application; signed mathematical fixtures |
| T04b | Grain/arm/weave/wall/lens and spatial consumer audit/integration | Matched 2D/XR left/right, through-zero morph; seek/export/history comparisons |
| T05a | Shared context/policy extraction | XR/MVP defaults distinct; no duplicate event/director gain; old host paths pass |
| T05b | Studio/MVP backend and compositing integration | WebGL/fallback, crossfade/PostFX/transparency/chroma/resize/context-loss smoke |
| T05c | Exact sampler / worker-v2 capability boundary | Atomic request identity, bounded buffers, exact requested frames and deterministic discontinuities; consumed by T19 |
| T07/T08 | Static cockpit, then base halo fit/meaning | Off/reduced modes, note/saber/menu clearance; same judge/score; original image and Quest check |
| T19a | Render-state extraction and snapshot capture | Existing legacy behavior retained; stable resource ownership, no shared State swapping |
| T19b | Isolated job/encoder control | Stop prefix/Cancel/cleanup across phases, immutable output during editing/new load |
| T19c | Minimizable progress UI and interaction | Persistent controls, navigation guard, real multi-minute export and UI-latency measurements |
| T22/T23/T24 | Entrypoints; real auth; verified deployment | Review separately; public Studio release requires all applicable gates |

No arbitrary calendar deadline is inferred. Status/order are in the tracker; missing evidence is
`unmeasured`, missing required environment/decision is a task-local `blocked`, research that fails
promotion is `experimental` or `deferred`. Every delivered subtask also pauses for user feedback.

## Per-task impact and acceptance register

Owners, dependencies and initial status inherit the tracker. Each row below adds starting fact,
state/time impact, risk/performance focus and concrete evidence. Runtime changes preserve
AudioEngine as the live clock, immutable publication, explicit reset and request/generation tokens.
All cross-boundary handoffs have this chat's single integration owner.

| Task | Starting fact -> target / state and time change | Risk / cost / evidence / rollback |
| --- | --- | --- |
| T00 | Fresh master -> recorded baseline; no runtime change | Nine product failures retained; build/full regression and targeted rechecks; retain immutable report |
| T01 | Baseline -> three Proposed ADRs and task/metering register; no schema/code change | Check links/numbering/policy; rollback proposed docs only |
| T02 | No observer/sidecar on master -> minimal gameplay roles and XR lifecycle | Duplicate reward/stale callback; bounded role IDs, no score/clock change; session/purity/regeneration tests; remove observer/consumer |
| T03 | Distance enum ends at 200 -> 500 and safe off-axis frustum | Clipping/depth near notes; calculate max corner view depth and depth resolution, settings/store/spatial tests and Quest head turns; revert choice/far change |
| T04 | Positive clamps/bend-only mirror -> signed effective twist | Double sign/phase discontinuity; tuning+transfer+grain/spatial/history/seek tests; default +1/legacy point fallback |
| T05 | Shared backend exists, host policy differs -> one shared context per host | Duplicate director/events, gain/compositing/copy overhead; cross-host render A/B, exact sampler gates; disable shared flag |
| T06 | Raster carriers/aggregate field -> opt-in native elements | Stereo/occlusion/overdraw; full family inventory, bounded instances and Quest cost; fall back hybrid |
| T07 | Open stage/textual reference -> modular static cockpit | Occlusion/draw calls; Standard/Tall clearance, reference angles/dispose/recenter/reentry, Quest; Off/Reduced |
| T08 | Classic/Shard and current cuts -> explicit type/role table + halo | Confused glyphs/score; same hitbox/judge/base score, bounded instancing/overflow policy, note GPU/scoring/session tests; hide sidecar |
| T09 | Existing hand/zone/overhead policy -> movement-aware playable chart | Impossible same-hand/crossing routes; pure judge/render position parity and automated validator, seeded charts and Quest; legacy profile |
| T10 | Algorithm 7/hop 1024, timing opt-in -> measured local timing/structure fix | Quiet/sustain false positives, tempo aliases/cache drift; golden+verification+annotated held-out strata and negative regions; old algorithm/cache retained by identity |
| T11 | Heuristic vocal/melody scores -> typed timed evidence/dominance | Fabricated vocal identity/extra offline CPU; uncertainty/provenance/calibration and negative/overlap corpus; absent evidence fallback |
| T12 | BeatEvent chart -> opt-in validated-source chart | Duplicate reward or silent notes; per-note selection reasons, motor constraints, deterministic source switching/legacy fixtures; old chart profile |
| T13 | Existing cue publication -> correct target arrival/anticipation | Bypassing gate/races/too many transitions; cue-error landmarks, manual/locked edits, seek/transfer/export parity; previous plan generator behavior |
| T14 | Existing HUD/menu -> Angular and Orbital generics | Text/subpixel vibration/geometry count; seeded pure geometry, same information/hit areas, Standard/Tall and Quest readability; current-look/Off |
| T15 | Generic layout -> offline track/section HUD plan | Hidden second semantic engine; seed/section fixtures, bounded family changes, stable gameplay anchors; generic style fallback |
| T16 | Existing 24-band precomputed spectrum -> optional center display | Note occlusion/history drift; song-time spectrum/history projection, real PCM scope only, bounded buffers, seek/export and GPU smoke; Off |
| T17 | No WASM backend -> one/two bottleneck kernels measured | Interop/copy/cold cost exceeds gain; TS numerical reference and full-pipeline cold/warm/Quest benchmark; reject prototype if gate fails |
| T18 | Only promoted T17 kernels -> optional production backend | Detach/OOM/worker race; adapter failures/cancellation/cache parity, TS+WASM same corpus, lazy asset/MIME smoke; TS fallback |
| T19 | Global export redraw -> snapshot/private runtime/job/UI | PCM duplication, UI stalls/stale IDs/leaks; phase control matrix, full/prefix/cancel files, editing/new-load parity; legacy path at next start |
| T20 | WebM codecs -> confirmed new container/backend, conditional WASM acceleration | T19b whole-job profiling first; T19c/T20a evidence-gated CPU kernel/FFmpeg comparison, no presumed speedup. Double transcode/RAM/license; 720p/1080p/4K sync/memory/prefix tests; WebM |
| T21 | No timed captions -> validated immutable subset/layout | Unsafe HTML/font/parity; parser/time-boundary/unicode/overlap/length tests, aspects, seek+real export, snapshot/undo; empty captions |
| T22 | Root dashboard MPA -> launcher and /studio/ entry | Heavy startup/404/base/storage drift; dev+production direct URLs/reload/assets, host startup and MVP history; prior entry/base mapping |
| T23 | No auth/server -> verified session/gate/business authority | Client bypass/cache/session fixation/CSRF; direct route/asset/API/logout/expiry integration, public host regression; fail-closed verified gate |
| T24 | gh-pages scripts -> verified DotRoll staging/release | Unsupported process, DNS/TLS/MIME/headers; real target health/routes/auth/export/Quest and practiced rollback; previous verified release |
| T25 | Independent slices -> release evidence map | Cross-host/session/plan/version interaction; complete cumulative suites, capability matrix, physical headset and matched before/after; revoke new defaults or roll back release |

Performance/rollback choices that change public behavior must be recorded before that task's
implementation. Existing nine Wormhole assertions are never removed or silently rebaselined.
T03 may proceed independently, but modifying the implicated presets requires its own diagnosis
and product decision before claiming a green preset-related release gate.

## Measurement protocol and proposed promotion gates

These are engineering targets chosen before new measurements, not observed results. At a task's
start freeze the fixture/track IDs, algorithm/build hash, device/browser/OS, settings, sampling
method, capture window and exact metric definitions. Change a target only with an explicit reason
before evaluating that task's candidate; retain earlier raw results.

Desktop and physical Quest 3 are separate strata. Use the same three named song windows
(quiet/sparse, dense drop, transition) on the same reference recording; retain content digest,
sample clock and song times. Include 7-9 s current synthetic fixtures and 5+ minute real tracks.
Use at least 30 s warmup and three paired 180 s windows for runtime comparisons; long export
adds one full 5+ minute job. Alternate before/after order, record thermal/power state and close
unrelated workload. Do not compare T00's VM timings directly with production browser timings.

| Area | Capture | Proposed gate |
| --- | --- | --- |
| XR frame pacing | Main update/render/ahead p50/p95/p99, total frame interval, display Hz; compositor stale/dropped independently | At requested 72 Hz: main frame work p95 <=8 ms, p99 <13.89 ms; <=1% intervals >1.5 nominal; no increase in compositor stale share across paired runs. No claim if device counter unavailable |
| XR GPU/background | Scene GPU and ahead passes separately where timer exists; worker raster, request-to-shown latency, upload count/bytes, draw calls | No >10% p95 increase in unaffected strata; optimize target stage by >=15% median without worsening total-frame gate; never add percentile sums as a fake total GPU time |
| T03 | Angular geometry, far corner under head rotation/translation; near depth at gameplay distances; equal raster bytes/draw count | No corner clipping in accepted pose envelope, no note depth artifact or angular jump; unchanged raster pixel work. Compute far from actual maximum corner depth plus margin, not only 500 m center |
| Visual parity | Fixed seeds/times/history, normalized geometry and decoded images; capture captions/transparency too | Exact pure scalar/ID equality where expected; set image tolerance before T05 A/B from Canvas/WebGL edge differences, retain failing images. No arbitrary golden replacement |
| Analyzer accuracy | Held-out annotations by percussion/tonal/vocal/negative strata; onset P/R/F1, signed bias/p50/p95 error, FP/min, strict tempo, section errors | T10 candidate improves F1 by >=0.03 or onset p95 error by >=20%; protected P/R drop <=0.01, FP/min increase <=0.1; strict tempo regressions zero. Confirm annotation tolerance before evaluation; no vocal promotion without its own evidence |
| Musical arrival | Annotated drop/phrase/section anchors; cue time, morph start and target-arrival error separately | Reduce p95 arrival error >=20% versus frozen baseline, no new non-evidenced cue; preserve manual/locked timing and spacing policies |
| WASM | Download/build bytes, cold init, warm kernel, copies, full analyzeAudio and peak memory; desktop+Quest | Full pipeline median >=15% faster in measured target strata, <=5% slowdown in protected strata, numerical/event parity within predeclared bounds; include cold overhead. Fast kernel alone fails |
| Export | UI task/event response, command-to-ack vs save/finalize time, render/encode fps, output bytes, PCM/target/queue/OPFS high-water | At 1080p: control acknowledgement p95 <=100 ms, p99 <=250 ms; no unbounded growth over 5+ min, explicit admission estimate/limit, queue caps enforced. Finalize time measured separately, not promised <=100 ms |
| Export correctness | Decode full and saved prefix, audio sample/timestamp boundaries, edit/new-load hashes, all control phases | Prefix A/V end difference <=1 output-frame duration, no duplicated/missing contiguous video index, one result/download; new edits never change frozen render input; every Cancel frees resources |
| HUD/cockpit | Draw/instance counts, texture update cadence and readable angular size/contrast in Standard/Tall | No overlap with note/saber/menu clearance; no per-frame text rasterization when content unchanged; bounded pools and combined XR frame gates |

Render worker timing cannot see every browser GPU replay/upload/compositor cost. Use
BackgroundDiagnostics/GpuFrameTimer with their documented scope and external headset counters
where available; mark unsupported counters unmeasured. Node/mock tests prove laws and ownership,
not pixels, sensor latency or GPU speed. No flaky wall-clock CI performance assertions.

Analyzer output regression and musical correctness remain separate. New evidence must include
silence/sustain/DC/legato, sparse/dense and overlap negatives; keep oracle/development/held-out
splits and licenses from analyzer-lab methodology. No speed port and DSP algorithm change in
the same slice. Any failed promotion leaves the feature experimental/off or deferred.

## T01 verification and handoff

This task changes proposal/tracking documents only; application, presets, tests, dependency and
runtime schemas are untouched. Validate document links, ADR uniqueness/status, the tracker has
all T00-T25 rows and every proposal is linked; run `git diff --check` and confirm no application
diff. A full npm build/test/browser/headset run is not repeated for these prose-only changes;
T00's results remain the baseline and are not presented as a new run. No runner fallback used.
Diff snapshot script is unnecessary for these new proposals; direct diff/source reads suffice.

User review: inspect the three decisions, first slice and task-local assumptions. No new visual
behavior exists to test in T01. After feedback, start T03; report code changes, exact validation,
remaining physical tests, migration/rollback, then wait for manual testing again.

Verification completed: a Node `--input-type=module` document audit checked 23 local links,
unique Proposed ADR-011/012/013, all 26 task rows in both the tracker and impact register,
whitespace and CLAUDE inheritance. Result retained at `logs/t01/document-checks.json`.
`git diff --check` passed. `git diff --exit-code -- src tests public package.json
package-lock.json bun.lock vite.config.ts AGENTS.md documents/governance` passed with no diff.
No build, regression, browser or physical-device result is claimed for this documentation task.


## Priority clarification - 2026-10-26

The user accepted the analysis-quality audit and requested that existing measurements automatically
correct structural interpretation; they explicitly declined supplying reference timecodes. T13a
therefore begins with a measured, versioned structural view, using supported RMS/rhythm/spectral
context and preserving original event/grid/boundary times. It must not claim human-annotated
precision or independent instrument recognition. Next: T13 cue roles and target-arrival semantics,
then the T12 local-attention continuation (a break label must not universally dictate low player
activity). Additional HUD/visual features follow these foundations. No wholesale T11 research
reopening or unsupported detector promotion; retained studies/goldens remain evidence. Every
subtask ends with cumulative validation, docs/Graphify, commit/push, guarded deploy and manual pause.


### Continuation clarification - T13b (2026-10-26)

After accepted T13a, ordinary production cue placement now uses explicit originating purposes
and causal scene windows. A visual envelope attack is not a percussion detector: inner palette/
behaviour handoffs request accepted structural changes; genuine impact factories request attacks,
while unsupported decay requests may be omitted. The first overly strict envelope->attack mapping
was rejected by the three-recording check, not promoted merely because unit tests passed.

Next T13c owns point-time versus target-arrival semantics, exponential interpolation, safety-floor
re-expansion and semantic anticipation. Existing cue consistency/coverage measurements do not
satisfy the annotated p95 musical-arrival promotion gate. Then continue T12 local musical attention
and its fixed-calm-policy correction. No manual timecodes are required as a prerequisite.

### Continuation clarification - T13c (2026-10-26)

The bounded delivery fixes finite preset-base interpolation and removes legacy duration-floor
re-expansion for generated typed points. Point.time is still start, not arrival. Cached canonical
partial-preset targets, host semantic/gain ordering and signed magnitude share the same absolute
clock in dashboard/MVP/XR; legacy untyped/manual smoothing stays compatible. Asset publication
prewarms anchors, while a policy change can still rebuild them once on demand. No frame DSP.

Do not mark the entire T13 target-arrival gate complete: musical cue-at-arrival/pre-roll, semantic
anticipation and in-flight geometry are not delivered here. After the usual deploy/manual pause,
address those remaining timing contracts, then T12 local attention; do not require manual timecodes
or reopen unsupported T11 source recognition. Detailed evidence is in the current tracker checkpoint.

### Continuation clarification - T13d (2026-10-26)

Eligible unlocked generated presets now pre-roll to the unchanged canonical cue; both the point
and predecessor must be automatic typed points. Protected/manual/legacy predecessors and late
initial states retain start-duration scheduling. Scaling uses the corresponding preceding or
following gap in every host; the shared timeline draws the same derived window/finite curve.
Actual point edits become manual, while selection/no-op does not change timing. Existing evidence,
event/note times and analysis stay unchanged. This is preset-base arrival, not semantic pre-roll
or replacement of in-flight particles. After the normal validation/deploy/manual pause, address
those remaining timing contracts before claiming the whole T13 gate; then continue T12 attention.

### Continuation clarification - T13e (2026-10-26)

The existing scored ADR-003 semantic pre-roll is now sampled continuously between eligible
knots, then rendered once over the independently morphed preset base. No producer/event/note
clock changes or new source recognition. Imported ADR-004 window rules remain unchanged.
Already emitted geometry keeps its intentional lifespan; no perceptual p95/annotated musical
precision claim is made. Current phase timing foundations are bounded here. After the usual
validation, deploy and manual acceptance, continue T12 local musical attention using supported
local rhythmic/energy/spectral evidence. Do not turn remaining research limits into an endless
T13 prerequisite. See the current tracker checkpoint for tested contracts and open limits.

### User budget and continuation - T12c/1 (2026-10-27)

Local Musical attention is delivered in bounded subtasks. T12c/1 integrates original-event local
ranking and the first No Good comparison, without promoting structural/model accuracy. T12c/2
broadens the three-recording transfer checks and calibration after manual feedback. The user
requires an explicit stop and question before the next subtask because account budget is low.
Full-song external structural models are a separate later task by explicit user choice.

### Transfer decision - T12c/2 (2026-10-27)

Three full recordings now compare the T12c/1 local policy against the historical section-led
policy with equal common-stratum cardinality weights, source-index pair deduplication, both
4-second offsets, explicit missing coverage and immutable source parity. No Good and Scienide
retain more of the selector's own normalized features; GoA is mixed. This is not independent
musical validation and does not justify tuning runtime weights. The existing runtime is retained.
The local T12c phase stops here for feedback; do not manufacture another calibration subtask.
Next, only after explicit user continuation, prepare the separately requested complete-song
structural-model comparison with concrete environment/download/license costs and limitations.
No external model installation/inference or functional-boundary accuracy is delivered in T12c/2.
See the current tracker checkpoint for measurements and final validation receipts.

### External full-song study completed - T13f (2026-10-28)

The user authorized all subtasks of the separate study. Actual All-In-One eight-fold ensemble
and SongFormer predictions now cover all three complete recordings with exact PCM identity.
The study separates beat period, meter phase, raw versus function-changing boundaries and actual
planned/published scene cues. It is no annotated accuracy promotion and supplies no safe universal
threshold/label replacement. Existing T12c behavior is preserved; research bridge execution is fixed.
[Full protocol/results](../../research/analyzer-lab/docs/FULL-SONG-STRUCTURE-STUDY.md).

After this task's deploy/manual handoff, the next bounded PRODUCT implementation should address
meter/structure uncertainty and the one-sided scene-entry evidence window, with original measured
multifeature/recurrence support and intact manual ownership. Then continue the separate note-source
selection problem using qualified existing capabilities. Do not import oracle labels/weights, fit
per-track timecodes, repeat an open-ended model study, or treat timing as solved before T14.
The user waived only intermediate pauses inside this study; the final task boundary remains.

### Original scene-entry correction delivered - T13g (2026-10-28)

T13f was accepted. Estimated scene starts now admit bounded earlier/later accepted structural
evidence only when stronger sustained multifeature contrast supports it. The original proposals,
protected points, neighbouring ownership, event/meter clocks and runtime arrival semantics remain
explicit. All three full-song analyses and prior plans were reproduced before exact-analysis
replay; the existing two model families are references only. Some raw-boundary agreement improves,
functional-boundary agreement stays unchanged, and added unmatched entries prevent a universal
accuracy claim. No new model execution, detector, setting or per-song timestamp.

After commit/push/deploy STOP for manual feedback. Then address the separate qualified acoustic
note-source selection problem; local normalized band change is not dominant instrument identity.
The wider macrostructure and meter-phase uncertainty remains open, not a reason to repeatedly
run the same model study or prematurely call T13 fully precise. See the current tracker checkpoint
for coverage, limits, validation and continuation.

### Musical percussive source correction - T12d (2026-10-28)

After accepted T13g, the next bounded product task expands Musical's choices before visual
grid/proximity suppression under the SAME existing strong percussive gates. No raw research
candidate, instrument identity or model pseudo-label is promoted. XR requests a clocked optional
pool once; Classic and all legacy analysis values remain exact. The first density-inflating
draft is retained and rejected. Final selection ranks the expanded pool within the unchanged
legacy Activity budget, with normal Guarded movement and explicit diagnostic provenance.
The [current tracker](xr-development-tracker.md#current-continuation-checkpoint---t12d-percussive-note-source-2026-10-28)
records complete three-song replay, negative controls, an additive reviewed schema extension,
both protocol freezes, limitations and final receipts.

Stop after commit/push/deploy for manual testing. Then continue the main plan, with T14's visible
HUD work available independently of still-open source identity and macrostructure/meter accuracy.
No automatic broad model rerun, extra experimental menu mode or unsupported precision claim.

### Generic instrument presentation - T14 (2026-10-28)

After the user's acceptance of T12d, deliver Angular and Orbital with a shared pure seeded
generator and bounded static adapters. Current stays default and Off retains essential data.
The existing Visuals menu, localStorage and Copy own this player preference. All important
information, layout/hit areas, play-space anchors and timing semantics remain unchanged.
See the [T14 checkpoint](xr-development-tracker.md#current-continuation-checkpoint---t14-generic-instrument-design-2026-10-28)
for runtime coverage, render evidence and limits. Stop after commit/push/deploy for manual
readability/selection checks. Only after acceptance continue T15's bounded presentation planner,
using explicit existing data and retaining a generic fallback; do not infer new musical truth.

### User-directed skip and shared music display - T16 (2026-10-28)

The user accepted T14, then explicitly asked to skip T15 before any planner implementation.
T15 remains skipped/deferred; do not silently resume it. Continue with T16's required circular
spectrum in all current Wormhole host paths, reusing published display bands, the authoritative
focal frame and existing worker/export clocks. Default Off; menu/localStorage/Copy, bounded size
and opacity, clear center/lower corridor, no musical inference or fabricated waveform.
See the [T16 checkpoint](xr-development-tracker.md#current-continuation-checkpoint---t16-shared-music-display-2026-10-28).
Commit/push/deploy and stop for manual testing. After acceptance, T17 is the next main-plan task;
its toolchain/feasibility questions remain separate from this display implementation.

### WASM feasibility decision - T17 (2026-10-29)

T16 was accepted. The user clarified that WASM acceleration is the goal and ts-rs
is optional only when justified. The scalar FFT research prototype uses a fixed
typed-array ABI and an isolated pinned WABT development assembler; no Rust DTOs,
root dependencies or production backend are introduced. The exact TS transform
remains the mathematical reference.

The preregistered desktop gate passed on three complete reference recordings:
30.7-41.0% lower median `analyzeAudio` time including per-analysis initialization,
exact output/PCM parity and process maxRSS ratios below 1.1. A secondary desktop
browser No Good observation gave 22.6%. Cold compilation and byte size are reported
separately; no WAN latency, musical accuracy or gameplay FPS improvement is inferred.
See the [protocol and measured receipt](../../research/analyzer-lab/candidates/wasm-fft/README.md).

Production promotion is withheld because physical Quest 3 full-path/cold/memory
evidence is absent. T18 is deferred under its explicit prerequisite, rather than
silently treating desktop results as headset evidence. After this task's
commit/push/deploy and manual acceptance, **T19 is the next independent task**.
T15 remains skipped. Do not resume either deferred task without resolving its gate.

### User-authorized FFT integration - T18 (2026-10-29)

After accepting T17, the user explicitly requested implementing the justified WASM
acceleration. The measured scalar FFT now has a request-local production adapter,
Auto/TS/WASM menu/storage/Copy in all hosts, lazy binary loading and whole-input TS
recovery. The [technical contract](../features/analyzer-wasm.md) records ownership,
precision, ABI, numerical migration matrix, failure behavior and evidence.

Native full-path gains are37.5-38.4% across the same complete three recordings;
the actual built-browser No Good worker path improves22.6%. Output hashes remain
identical within each comparison. A development-browser outlier is separately
retained. This user direction authorizes reversible integration, not a claim that
the physical Quest performance gate or the complete numerical WASM port is done.
Those remain explicit limitations. Stop after commit/push/deploy for manual
testing; **T19 follows only after acceptance**. T15 remains skipped.

### T19 staged export migration - T19a (2026-10-29)

Quota-aware resource follow-up accepted by the user: T19c1 exact codec/trial and
configurable memory admission; T19c2 copy/surface/storage review and reductions;
T19c3 real multi-minute/full/prefix/cancel resource validation. Each slice deploys
and pauses for manual feedback. T19c1 is implemented as an opt-in MVP isolated
export repair; browser acceptance is pending. Minimizable controls/background
editing remain later T19c work, not delivered by these resource changes. The
[staged contract](../features/export-lifecycle.md#t19c-resource-follow-up---staged-for-quota-aware-delivery)
records limits and exact remaining scope. No WASM exporter is promoted.

T18 was accepted for continuation. First stabilize the existing public workflow:
synchronous job reservation, latched Stop/Cancel through teardown, suppressed late
progress/result, interruptible frame/media waits, allocation cleanup and ordered
asynchronous worker startup. This is the T19a vertical slice; it keeps the current
renderer/global-state limitations explicit and is followed by deploy/manual pause.

T19b now captures the immutable musical snapshot, copies/owns resources with admission
checks and integrates a private render context as an opt-in MVP Wormhole preview.
It adds sequential canonical sampling, honest stage profiling and Opus timing
repair; Compatible remains default. Full 2060-case run retains 9 exact baseline
failures; final affected replay passes 221/221. Browser final decode/prefix/Cancel,
long-duration memory and UI-latency gates remain open after a Computer Use URL
safety stop. Pause for manual feedback. T19c enables background editing,
persistent controls/leave guard and complete multi-minute decoded-file acceptance.
Do not advance to T20 or mark ADR-012 implemented after lifecycle repairs alone.
See [export lifecycle](../features/export-lifecycle.md) for the delivered boundary.

### Export WASM acceleration schedule - accepted direction (2026-10-29)

T19a accepted. The user requests WASM export acceleration where justified by a
professional implementation, and asks for risk-based, well-designed tests for new
behavior. T20 already contained a WASM/FFmpeg evaluation; explicitly bring whole-job
profiling and algorithm/copy-cost review into T19b. A measured, isolated CPU kernel
can be prototyped in T19c without waiting for a new format. Codec/remux/FFmpeg choice
remains T20a after its format decision. Promotion is conditional on the existing
>=15% whole-job gain, <=5% protected slowdown and export correctness/memory/control
gates. Reject a losing candidate without blocking T19 delivery or adding a default
backend. No WASM exporter, package, runtime switch or speedup is delivered by this
schedule update. T19b has since delivered the foundation above; next is T19c
after manual feedback, not T20. No whole-job WASM speed result is claimed.

The [detailed scheduled work and source findings](../features/export-lifecycle.md#scheduled-export-acceleration---user-direction-2026-10-29)
define measurement scope, reference sampling, parity, cold/warm costs and primary
sources. Apply the [export validation matrix](../governance/testing-validation.md#export-refactor-and-acceleration)
before the implementation; mocked controls alone cannot satisfy decoded-file or
browser performance acceptance. The T19a failed browser smoke remains open.
