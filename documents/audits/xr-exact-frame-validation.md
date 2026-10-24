# T05c exact Wormhole sampling and worker capability

Integration owner: this chat. Date: 2026-10-24. Owners: visuals simulation/raster adapters,
lightweight types, render worker and documentation. User authorized continuation after T05b;
deployment and a manual-test pause remain required. No subagents or dependencies were added.

## Delivered behavior

- Separate local and worker exact adapters return the requested `frameIndex / fps`, never a
  delayed preview frame. Worker v2 explicitly negotiates its sampler/context capability.
- One atomic identity binds bitmap, focal point, grain material, trail lines and spatial state.
  One outstanding request/result lease; release is idempotent. Wrong/stale responses, cancellation,
  supersession, errors and disposal settle or discard work without publishing another frame.
- Fixed song-time replay reconstructs the real private identity, gains, morphs, director, route,
  signed automation and grain releases. It reuses prepared assets without network IO or planning.
- V1 preview, the three live hosts, presets and player preferences retain their existing paths.
  This internal capability introduces no player switch or preset setting. Menu/persistence/Copy
  and preset relevance remain requirements for future player-facing settings.

## Validation and retained evidence

Commands (Node/npm were already available):

```text
npm run build
node --test --test-reporter=tap tests/wormhole-exact-frame.test.mjs tests/wormhole-frame-context.test.mjs tests/xr-wormhole-worker.test.mjs tests/xr-webgl-backend.test.mjs tests/wormhole-spiral-history.test.mjs tests/export-deterministic.test.mjs tests/gameplay-purity.test.mjs tests/visual-mode-transition.test.mjs tests/styles-deterministic.test.mjs tests/contracts.test.mjs tests/postfx-fragmentation.test.mjs
node --test --test-reporter=tap tests/accepted-timing-measurement.test.mjs
npm test -- --test-reporter=tap
git diff --check
node scripts/audit-wormhole-exact.mjs
```

The [machine-readable report](xr-exact-frame-validation-data.json) records exact final counts,
full assertion messages against the T05b nine-failure baseline, test identities and artifact
hashes. All 175 predecessor active test files and the protected XR loader remain byte-identical.
[Retention](../tests/t05c-retention.json) also records four retained T05b source files and the
predecessor source-evolution manifest. No old test was excluded or rewritten.

The first full run exposed the expected source-provenance gate for the changed render-worker
contract. A reviewed render-only migration was added to the evolution manifest after preserving
its predecessor; historical analyzer snapshots, measured source trees and results were not changed.
The initial failing run is retained at `logs/t05c/tests.tap`; the later pre-manifest run is retained
separately. The final cumulative run is from the documented replacement, not an omitted assertion.

New tests exercise the actual v2 worker adapter and exact proxy for capability refusal, atomic
identity, wrong serial/context/generation/time, one result lease, shared carrier-buffer reuse,
supersession, cancellation, failure and disposal. Real identity command/material/line/spatial
digests are identical after 24/36/60 Hz histories, backward/repeated/fractional requests and
preview rate-cap changes. Published analysis is not mutated.

The versioned browser harness `tests/browser/wormhole-exact-frame-smoke.html` uses real Canvas2D,
WebGL2, OffscreenCanvas, module worker, bitmap transfer and bitmap readback. Ten paired cases
cover raster-only and external material/lines, exact fractional endpoints, repeats and backward
requests. It compares local versus worker within each backend, not Canvas2D versus WebGL.
Predeclared gates: normalized RGBA MAE <= 0.001, pixel fraction with any channel difference > 2
<= 0.005, repeated images exactly equal, companions exactly equal. Final metrics are in the
machine report. Console errors/warnings and PNG/screenshot artifacts are retained in `logs/t05c/`.
The initial browser failure (valid records versus unused pool capacity in local copies) is retained;
the fix copies only count * stride floats and has an additive regression assertion.

`diff_export.ps1` was skipped; scoped source review, cumulative test identities, predecessor
archives and the deployment source-input manifest provide the review evidence. No runtime or
package fallback was needed for validation. The existing Bun-dependent deploy script is replaced
only operationally with the installed Node gh-pages entrypoint; no package scripts were changed.

## Limits and manual expectations

Replay starts from zero for every frame: retained memory is bounded, while work is linear in
requested song time. It is an offline correctness foundation, not a fast full-track encoder.
The worker's frame deadline is 120 seconds; the local fallback replays synchronously. Checkpoint
acceleration, export workflow hookup, encoded/decoded video comparison and comparison against
the old live-preview trajectory are T19 acceptance work. This change does not make the existing
cadence-dependent preview history-independent. No physical Quest run or new stereo/performance
claim is made. No default was promoted.

Expect the current XR/Studio/MVP behavior and settings to keep working. Manually check play,
pause/resume, forward/backward seeking, preset/spiral direction and settings persistence/Copy.
There is no new visible export feature to select. T06 is the next task after manual acceptance:
the switchable native 3D spike, with the current hybrid path as fallback. T05c does not remove
OffscreenCanvas or claim a complete native 3D representation.

Deployment identity, public route/asset hashes and rollback parent are recorded in
[deployment evidence](xr-exact-frame-deployment-data.json). Publish only gh-pages; no source
branch push/merge. Stop after deployment for the user's manual test before starting T06.
