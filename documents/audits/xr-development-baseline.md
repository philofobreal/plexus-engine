# Plexus XR development baseline (T00)

Recorded: 2026-10-23, Europe/Budapest. Integration owner: the agent in this chat.
Status: automated baseline captured; user manual acceptance and physical measurements pending.
Next task: T01, only after the user's baseline feedback. See the [tracker](xr-development-tracker.md).

## Checkout and scope

The user explicitly selected GitHub master as the working source. A fresh, initially clean clone
was created inside this chat's workspace at `plexus-engine/`; the other local project was not
modified. The broken parent worktree was not repaired or used as this project's Git authority.

- Repository: `https://github.com/philofobreal/plexus-engine.git`.
- Baseline: `effd6db7d268fd318dbcd4dbb1bec18e268a5441`, matching the fetched `origin/master`.
- Commit: `Merge pull request #11: separate source, analyzer data and audio exports`,
  `2026-10-23T20:28:11+02:00`.
- Working branch: `codex/xr-development-baseline`; no push, merge or deployment performed.
- Runtime: Node `v25.2.1`, npm `11.6.2`; Windows `10.0.26200 x64`, Intel Core Ultra 7 258V,
  8 logical CPUs visible to the measuring process. Bun exists but was not used.
- Existing dependencies installed from `package-lock.json` with
  `npm ci --ignore-scripts --no-audit --no-fund --cache .npm-cache`. No dependency/lockfile change.
  The cache is excluded locally in `.git/info/exclude`, not added to product source.
- No Graphify graph in the clone. Navigation used `rg` and direct source reads.
- Governance read: AGENTS, architecture contract, realtime audio safety, worker communication,
  testing/validation, platform operations, anti-patterns, session persistence and subagent
  orchestration; ADR-008 and ADR-009. CLAUDE remains an inheritance shim.

Only the audit script and audit records are new. No application, preset, test, golden, worker
schema, audio clock, storage or tuning behavior changed. Existing test/research evidence remains intact.

## Source export and PR 8 comparison

The local reference export was read from the other project's ignored `plexus-source-export.md`.
Its header matches the prompt: `Generated: 2026-10-23 20:32:38`, 1089 files. Its SHA-256 is
`1226e68017cbd51ec8dc87447441f268a1f1ab8dc245264b5b379039af9407d1`.
It is a comparison input, not the source of this clone.

The [reproducible audit](../../scripts/audit-xr-baseline.mjs) compares 17 selected files after CRLF
and trailing-newline normalization. [Per-file hashes and results](xr-development-baseline-data.json):
15 equal; `PlexusRenderer.ts` and `MvpVisualController.ts` differ. Direct diffs show encoding
differences in comments (mojibake versus em dash/box drawing), with no executable-code change in
those diffs. This is a targeted comparison, not proof that all 1089 exported files match.

[PR 8](https://github.com/philofobreal/plexus-engine/pull/8) was re-read via the GitHub connector:
open, unmerged, `mergeable: false`, 29 files, +4217/-19. Its requested head remains
`6ef28d1a56fcacf5f8dfdc046f0816e816bcbcdf`; base and actual merge-base with current master are
`29371e4fd65b5fc9defa6ebb4bca0b1488ed5e14`. The exact head was fetched for local comparisons only.

Ignoring line endings, the baseline's `RhythmGameSession.ts` matches PR 8's base version.
`XrAppController.ts` and `RhythmGameScene.ts` have since changed (+154/-26 combined, ignoring EOL),
including current host/runtime work. A whole-branch merge would overwrite or conflict with that work.
The PR's renderer-independent role sidecar, notification observer, instanced halo and dispose/reset
patterns are candidates for T02. WorldDirector, eras, building units and Fenom outcomes are not required.
ADR-010 exists on the PR branch and must not be reused for an unrelated decision.

The PR ADR says `onNoteResolved(note, index, grade, songTime, skipped)`; the actual patch declares
four arguments, omitting index. Its callback is invoked directly after scoring, so exception
isolation must be specified before adaptation. No observer has been added in T00.

## Ownership and verified data flow

| Boundary / owner | Current source and authority | Downstream impact |
| --- | --- | --- |
| Host composition | `src/main.ts`, `src/ui/mvp/main.ts`, `src/xr/main.ts`; Vite MPA | Independent runtime per page; no launcher or Studio route yet |
| Audio | `AudioEngine.ts`: decode, source lifecycle, request IDs, playback clock | Copies samples for worker; publishes accepted analysis; position events reset consumers |
| Analyzer/worker | `analyzeAudio.ts`, thin `analyzer.worker.ts`; algorithm 7, hop 1024 | Immutable events/frames/TrackAnalysis, explicit featureClock and optional eventTiming |
| State | `state/store.ts`; AudioEngine publishes analysis; UI/semantic/renderer handoffs remain as documented | XR facade only reads allowed analysis fields; scene/runtime do not import State |
| Automation/semantics | `prepareWormholePerformance`, Visual OS, cue-evidenced publication | One prepared offline plan shared with XR gameplay/background; no render-time replanning |
| Chart | `RhythmChartBuilder` -> `RhythmScorePlanner`, phrase/hand/zone/overhead policies | Existing percussive BeatEvents supply note times; grid alone supplies no audible evidence |
| Gameplay session | `RhythmGameSession`, `RhythmJudge`, `RhythmScoring` | One judge/score; reset, bounded miss/active cursors; no PR observer or world runtime |
| XR facade | `XrAppController`: captured publication, loadGeneration, plan/chart/scoring handoff | Routes setting scopes, rejects superseded composition; passes plain scene data |
| XR runtime/scene | `XrRuntime`, `RhythmGameScene`, note field, backdrop, spatial field | Three/WebXR, input, presentation and GPU resource lifetime; reads AudioEngine song time |
| Shared visuals | `PlexusRenderer`, `WormholeCanvasSource`, `WebGLRendererBackend` | MVP/dashboard use shared p5 identity; XR source injects private render state and can use WebGL2 |
| Render worker | `WormholeWorkerSource`, `wormholeRender.worker.ts`, protocol v1 | One in-flight render, generations, bounded transferred carrier pool, displayed-frame focal/material/spatial data |
| MVP facade | `MvpVisualController` | Owns edits/history/persistence handoffs, requests playback/export; leaf controls delegate |
| Export | `WebMExporter` -> `WebCodecsBackend` -> export worker | Stops p5 loop; writes `State.isExporting/exportTime`; shared renderer redraws at frameIndex/fps |
| Build | `vite.config.ts`, package scripts | Base `/plexus-engine/`; root, `/mvp/`, `/xr/`; no auth/server deployment yet |

Observed first-slice facts: background distances are 40/100/200 m, default 200 m; camera far 600 m;
backdrop reference 106 x 60 m at 40 m with proportional scaling. Background qualities include 4K.
The current defaults are ADR-009 Addendum AG's Max/36 Hz/200 m, GPU material/lines, adaptive
pacing, WebGL raster and particles; earlier ADR addendum defaults are historical. Signed spiral
work must cover config normalization, preset pairing/application, grain flow and spatial consumers.
No new flags, DTOs, migrations or alternate clocks were introduced by this audit.

## Validation results

All commands below ran from the project root. Full raw logs and test inventory are local ignored
artifacts in `logs/t00/`; compact evidence is retained here and in the data JSON.

| Command | Result |
| --- | --- |
| `npm run build` | PASS: TypeScript and Vite; 596 transformed modules; Vite 8.0.14; chunk-size warnings only |
| `node scripts/run-tests.mjs --list` | 168 active test files discovered recursively; inventory `logs/t00/discovered-tests.json` |
| `npm test` | FAIL: 1556 tests, 1544 pass, 12 fail, 0 skipped/cancelled/todo; 281599 ms |
| `node --test tests/dev-preset-save.test.mjs tests/source-export-powershell.test.mjs tests/wormhole-preset-differentiation.test.mjs` outside sandbox | 6 tests: 4 pass, 2 fail; all 3 environment failures cleared; both preset assertions persist |
| `node --test tests/wormhole-clip-profile.test.mjs tests/wormhole-geometry-lfo-integration.test.mjs tests/wormhole-projected-motion.test.mjs` | 36 tests: 29 pass, the other 7 product assertions persist |
| `node --check scripts/audit-xr-baseline.mjs` | PASS |
| `node scripts/audit-xr-baseline.mjs <reference-export.md> documents/audits/xr-development-baseline-data.json` | PASS; input path and per-file/output hashes recorded |
| `git diff --check` | PASS |
| HTTP GET root, MVP, XR on local Vite | All 200; HTTP-only smoke, no pixel/audio/headset acceptance |

Environment fallbacks: sandbox Git clone failed with `getaddrinfo() thread failed to start`, and
npm downloads reported ENOTFOUND; the same requested operations succeeded outside sandbox. The
first sandbox dev server could not be reached by a separate HTTP process; it was stopped, then
the same Vite command was restarted outside sandbox. No runtime/package-manager fallback was used.
The targeted outside-sandbox recheck was required to classify Temp rename/Git-config failures;
it was not a replacement for the full cumulative run. A full outside-sandbox suite was not repeated.

`diff_export.ps1` was considered and skipped: there is no application branch diff to summarize,
and targeted `git diff`, PR comparisons and direct reads provide the required baseline evidence
without its extra fetch/snapshot side effects. No historical test was excluded or regenerated.

## Exact existing failures

These failures were observed before any application changes and reproduced with unchanged
sources/presets. They remain failing; their assertions must be distinguished from new regressions.

| Test file : line / test name | Assertion evidence |
| --- | --- |
| `wormhole-clip-profile.test.mjs:146` / every wormhole clip preset carries role keys explicitly and leaves user-global masters untouched | `vos-wh-drift.json must not reset user-global wormholeStarfield` |
| `wormhole-clip-profile.test.mjs:237` / all presets stay visible and ring quantization is limited to authored ring roles | `establish remains visibly above the opacity floor` |
| `wormhole-clip-profile.test.mjs:250` / weak roles pin a deep-perspective depth and continuity profile | `establish depth`: actual `2.03136`, expected `4` |
| `wormhole-clip-profile.test.mjs:267` / clip roles have materially different wormhole behaviour (role-level contrast) | `deep drift deeper than establish` |
| `wormhole-geometry-lfo-integration.test.mjs:175` / factory preset pairs preserve their authored near/far projected tunnel geometry | `vos-wh-dissolve.json/vos-wh-drift.json projected scale contrast 0.580/0.492` |
| `wormhole-preset-differentiation.test.mjs:84` / wormhole factory presets keep a minimum normalized weighted separation | `vos-wh-drift.json / vos-wh-establish.json distance 0.073388 is below 0.09` |
| `wormhole-preset-differentiation.test.mjs:109` / wormhole preset speeds retain the authored dramaturgical ordering | `assert.ok(role('dissolve') > role('drift'))` is false |
| `wormhole-projected-motion.test.mjs:109` / projected forward motion preserves overdrive > punch > drive > drift | overdrive `389.64890777178124`, punch `172.16594789064624`, drive `471.543038051684`, drift `90.85003926445653` |
| `wormhole-projected-motion.test.mjs:116` / raising wormholeSpeed increases projected travel rather than only trail length | `389.64890777178124 vs 471.543038051684` |

Three additional sandbox failures cleared on the outside-sandbox recheck:

- `dev-preset-save.test.mjs:23`, development preset save updates existing keys, appends edited
  keys, and preserves metadata: EPERM renaming a Temp fixture file.
- `source-export-powershell.test.mjs:13`, `pwsh: export profiles keep source, measurements and audio separate`:
  Temp `.git/config` write denied, Git exit 128 versus expected 0.
- The same source-export test under `powershell`, with the same Temp config error.

Retained local artifact SHA-256 identities:

| Artifact under `logs/t00/` | SHA-256 |
| --- | --- |
| `build.log` | `64e187e9d7541a6a41d06332e587a88418da24688a558a7b117e6a68fe17ec7d` |
| `tests.log` | `cb84ff966b9212792ea63af92f4bb4ce5c4407f38237d22da97253b1c1099e54` |
| `discovered-tests.json` | `630d5a8b9a1ec73ea5d213c35f32dea04024fb1b23b9556cd93decbd728837da` |
| `failure-recheck.log` | `e7a53b58b262626edda90a9ff72f4682de378e4ea179d5fc6c2822800ed9e360` |
| `product-recheck.log` | `6fdc0801662782597f4cb144a5b8f43004a4eb9207588716319730fa677e9539` |

## Informational Node profiling

Standalone process after the full suite finished; Vite idle. Existing TS test loader and fixture
synthesis are excluded from timed calls. Chart first-call cost, 5 warmups, 30 samples; analyzer
first-call cost and 10 subsequent samples. p95/p99 of 10 samples are both the maximum and are
coarse descriptive values. VM/transpilation-based Node execution is not a production-browser
benchmark, musical-correctness promotion or a speedup claim. Full precision is in the data JSON.

| Input | Output | Warm p50 / p95 / p99 ms |
| --- | --- | --- |
| 300 s sparse, Normal/Standard, onset step 0.75 s | 334 notes | 1.37 / 1.67 / 4.51 |
| 300 s dense, Ultra/Tall, onset step 0.125 s | 1617 notes | 7.64 / 11.74 / 12.13 |
| house-128 synthetic, 44.1 kHz, 7 s, algorithm 7 | 13 events | 2562.24 / 3030.40 / 3030.40 |
| dnb-176 synthetic, 44.1 kHz, 7 s, algorithm 7 | 21 events | 1945.72 / 3122.38 / 3122.38 |
| breakdown-124 synthetic, 44.1 kHz, 9 s, algorithm 7 | 12 events | 2484.68 / 2726.18 / 2726.18 |

Every repeated chart and analyzer result matched its first serialized output. These synthetic
references exercise the current code; they do not substitute for annotated held-out recordings.
Scoring-load timings and output SHA-256 values are retained in the JSON.

## Missing evidence and manual baseline handoff

No renderer/audio/browser UI changes have been made. Automated browser interaction and live
audio/export profiling were not performed; HTTP reachability only is proven. No user reference
recording or headset session was selected for this run. Physical Quest 3, actual worker/GPU/upload
cost, p50/p95/p99 frame latency, compositor stale/dropped frames, draw calls, memory, sustained
thermal behavior and export control latency remain `unmeasured`. The existing diagnostics are
available but do not themselves constitute a measurement; the GPU timer omits ahead/background
passes and does not time the headset compositor. Python analyzer-lab research was not rerun:
there was no analyzer/research change, and this task's cumulative runtime baseline used npm test.

Local Vite remains running for the user's manual check:

- Dashboard: `http://127.0.0.1:5173/plexus-engine/`
- MVP: `http://127.0.0.1:5173/plexus-engine/mvp/`
- XR: `http://127.0.0.1:5173/plexus-engine/xr/`

Suggested baseline check with the same familiar track on each host: load/analyze; play/pause/
resume; seek forward/back; stop/restart; on MVP export a short WebM and check audio/video plus
Stop & save/Cancel. On XR check existing settings reload, Standard/Tall, sparse/dense sections,
and Wormhole off/on at the current 40/100/200 m choices. Record browser/device, track identity,
settings, song section and any existing defect. Physical WebXR requires the user's established
HTTPS headset test setup; this loopback URL alone is not a Quest deployment.

T00 acceptance remains pending manual feedback. Known preset failures stay visible rather than
being silently repaired during baseline collection. T01 will define the small implementation
slices and promotion thresholds; first proposed product change is the isolated T03 500 m option.
Rollback of T00 is removal of the new audit script/records; no application migration is needed.
