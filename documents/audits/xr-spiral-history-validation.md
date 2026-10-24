# T04b: signed spiral consumers and history

Date: 2026-10-24. Single integration owner: the agent in this chat.
User accepted T04a and authorized the next task, with normal deploy/manual-test handoff.
No new player switch: preset direction and the persisted XR Auto/Left/Right override retain T04a's policy.

## Starting facts and final behavior

T04a removed positive clamps and added preset/plan direction, but morph state still depended on
render history. A retained-source replay reproduces the defect at 2.5 song seconds: the 30 Hz
live sample is +0.46614931208109356 turns, whereas direct/backward seek yields -2 turns.
The controlled fixture uses neutral gains, magnitude 2, opposite point directions at 0/2 s,
transition speed .005 and a 2 s linear morph. It uses the retained T04a source with current
dependencies to isolate this defect; it is not an execution of the whole historical bundle.

`WormholeSpiralAutomation` builds absolute anchors from the already-published plan and existing
preset merge/gain helpers. It does no analysis, plan generation, IO, score or clock work. The
shared exponential morph law is unchanged; signed effective twist is interpolated once, with
the matching nonnegative magnitude. Overlapping transitions start from the preceding curve at
the exact point time. A point at time zero establishes the initial preset. Sampling is allocation
free and logarithmic; preparation is bounded by the supplied plan and cached until the plan view,
preset publication or gain policy changes. Missing presets disable this channel until ready.

The same fixture now gives +0.5418323709253965 turns in 24/36/60 Hz playback, direct seek and
backward seek: maximum signed-channel difference zero. First-sample/boundary timing is fixed,
so the corrected live result also differs from the old frame-delayed trigger's live result.
Legacy all-right plans without pair overrides bypass the new channel, retaining their prior
tuning behavior. A preset Straight value blocks automatic variation; zero magnitude/material
remains inactive. Explicit player Left/Right remains the live manual override from T04a.

The source applies the channel after its existing morph and before its one identity draw.
Studio/MVP use a narrow renderer host hook at the same point in the pipeline, with `ct` taken
from AudioEngine or the existing export clock. MVP gains are applied once, fresh from raw
presets. The scaled-plan cache now includes direction and bend flags, so direction-only edits
cannot reuse stale views. Transfer, normalized journey storage and archive undo/redo retain sign.

An immutable `VisualTransitionAnchor` carries the authored point origin for the directional
automation's short visual disturbance. The global renderer owns `State.spiralTransitionAnchor`;
the embedded source owns its private equivalent. They publish/reset it once per drawn frame.
The identity uses it only when its id exactly equals the active transition id. Independent
semantic transitions retain their existing owner and timing. No AudioEngine ownership changes,
state swapping, new worker schema, additional beat consumption or new global clock.

## Consumer inventory and rules

| Consumer | Signed rule / evidence |
| --- | --- |
| Grain head and tail | Shared coherent twist enters `wormholeGrainFlowAngle`; stable local flow, generation and material phase remain intact. Actual head geometry reverses around its unchanged local trajectory. |
| Arm density crest | Uses the same signed `spiralTurns` in `armTwist`; no second mirror flag. Complete arm-conditioned carrier alpha matches across controlled history/export samples. |
| Connective weave | Uses the grain loop's resolved heads/tangents; no independent reprojection or direction interpretation. Actual weave carriers match across the controlled samples. |
| Material / trail GPU handoff | Already-resolved raster coordinates and phases; the GPU does not reinterpret direction. Existing carrier and line suites stay active. |
| Wall / caustic / lens swirl | Their existing authored optics laws stay independent. Real wall/lens/background strokes remain identical when only coherent direction changes. The MVP optics gate remains intact. |
| XR particles and wisps | Consume the signed frame value with the existing y-down to y-up conversion. Existing headset-rate `XrFrameSignal` smoothing remains sign-odd, bounded and seek-resettable; it is a preview presentation law, not another mirror. |
| Worker | The displayed frame's signed state travels atomically with that image/generation. The new sampler is inside the existing source; protocol v1 and buffer bounds stay unchanged. |

## Evidence

Final command/result inventory is in [validation data](xr-spiral-history-validation-data.json).
The main targeted command covers the new history/real-consumer suites plus paused renderer,
MVP async lifecycle, morph scale, signed tuning, XR source/field, determinism/lifecycle/depth,
styles, visual-mode transitions and contracts: 238/238 passed. `npm run build` passes TypeScript
and Vite; existing chunk-size warnings remain informational. `npm test -- --test-reporter=tap`
is the cumulative gate; `git diff --check` checks tracked whitespace. No dependency change,
golden regeneration, measured-analyzer rewrite, source push or merge.

Reproduce the before/after control from the checkout root:

```powershell
node scripts/audit-spiral-history.mjs documents/tests/WormholeCanvasSource.pre-t04b.ts.txt logs/t04b/history-comparison.json
```

The diagnostic's retained-input hash is checked against T04a's source manifest. Raw evidence
lives under ignored `logs/t04b/`; the diagnostic and browser harness are versioned source.
The measured-source evolution manifest retains its preceding JSON and prior replacement hashes;
the protected original source snapshots/results remain unchanged.

Actual browser automation runs `tests/browser/wormhole-spiral-history-smoke.html`: real Canvas2D
after 24 Hz history, WebGL2 after a backward seek, and a real render worker paused request agree
at 1.5 s (+0.8 turns), 2.186705093060352 s (zero within 1.3e-15), and 2.5 s
(-0.5499910301333368 turns), each carrying the exact requested shown time. The real WebGL2 path
is confirmed rather than inferred from a requested option. Captured console errors are empty.
Screenshots and machine-visible results are retained. This is signed-carrier agreement, not a
claim of exact pixels across different raster backends.

## Acceptance boundary, rollout and manual handoff

T04b validates coherent signed history, controlled real grain/arm/weave geometry, independent
optics, the actual export-time consumer and worker/XR signed handoff. General host/director/
route history reconstruction, exact worker export protocol, compositing and cross-backend pixel
parity remain T05's separate gates. No encoded video was produced by this task: export-clock
geometry is tested, while isolated/export-job work remains T05/T19. Physical Quest stereo,
readability, sustained frame time/overdraw and human cut accuracy remain unmeasured.

Deployment uses the existing GitHub Pages publisher and retains T04a's prior commit
`13967e8739b0ae070fded9d2257fd6496973b836`. See [deployment data](xr-spiral-history-deployment-data.json).
Node/npm is the available runner; publishing uses installed Node's gh-pages entrypoint instead
of the existing Bun script. Roll back by publishing the prior Pages tree in a new commit, or
use the existing manual direction override/legacy plan. No new default or experimental flag.

Expected visible change: in Auto, revisiting the same point of a directional spiral plan should
give the same handedness and transition progress. Check playback, pause/resume and repeated
forward/backward seek in Studio/MVP; in XR check the same Auto versus existing Left/Right override
and retained settings. Existing halos, chart and score behavior should remain intact. Stop after
deployment for manual feedback before T05. A full physical-headset check remains the user's gate.
Diff export is skipped: the bounded source review, retained source inputs and cumulative inventory
provide the handoff evidence without generating a broad historical snapshot.

The retained source module is versioned as `documents/tests/WormholeCanvasSource.pre-t04b.ts.txt`;
it is an input to the explicitly mixed-dependency diagnostic, not an active test or full historical replay.
Cumulative final result: 1627 tests, 1618 pass, nine exact retained baseline failures, zero new
failures/skips/cancellations. Inventory: 173 active files, all 171 previous files retained;
214 current test/helper/fixture/browser source identities. Studio UI also loaded the retained
7 s synthetic track, imported/copy-round-tripped directions [1,-1] and revisited 35.7%, 10%,
35.7% seek positions with an empty console error log.

Final publication: `t04b-spiral-history-20261023T233450568Z`, commit
`78b30a41cafa55bdcc3141965537bc2a526f0a3c`, parent T04a `13967e8739b0ae070fded9d2257fd6496973b836`.
Pages built; release marker, four routes and 16 HTML/asset bytes verified. All 319 deployed source
inputs still match the checkout, including the new untracked runtime helper. Fresh public XR
loaded the 7 s / 128 BPM fixture and reached Results (nine notes, nine misses, no human hits);
fresh public MVP loaded it, played/paused and revisited Seek values 357/100/357 of 1000, ending
paused. Console errors empty on both pages. These are desktop smoke checks, not physical-device
or encoded-export acceptance.
Exact publisher fallback (installed Node; existing script requires Bun):
`node node_modules/gh-pages/bin/gh-pages.js -d dist --nojekyll -m 'Deploy T04b: deterministic signed spiral history and consumers'`.
