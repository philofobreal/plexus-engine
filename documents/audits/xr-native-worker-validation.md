# T06c2: native geometry off the main thread

The user accepted T06c after reporting worse native-mode main-thread stutter on Quest. The native
factory now prefers a module worker running the same private `WormholeNativeSource`. XR keeps
Three/GPU rendering and attribute upload. No background canvas, OffscreenCanvas, raster target,
SharedArrayBuffer, new player switch, dependency, analyzer/audio/judge change or source-branch push.
Native/Hybrid selection, presets, material settings, storage and Copy stay on their existing model.

An independent native protocol carries generation/request/presentation revision/continuity epoch
and caller song time. One request is in flight and one latest request replaces older desired times.
One 437760-byte transferable worker buffer is returned exactly once after copying active ranges
into alternating pending/presented host banks. No displayed bank is detached or overwritten at
message arrival. Focal/spatial state is adopted with the displayed packet. Seek/pause/settings
invalidate stale results; preparation restarts the worker. Disposal, startup/compute/decode/error
and 15 s/5 s deadline paths terminate it. Native main fallback is automatic and labelled in
diagnostics. The existing `xrBackgroundThread=main` technical override also applies to native.
[Contract and ownership](xr-native-worker-contract.md).

The original producer receives explicit host-classified continuity, avoiding worker arrival jitter
as a second song clock. It evaluates the full authored field: quality still bounds consumer
instances/fill. Producer thinning is deferred because it would change neighbour/preset character.
This is live preview, not the T05c exact sampler; no render lead/extrapolated song time is added.
Background off stops requests and retains the idle worker; mode/quality rebuild and teardown dispose.

## Validation

Node v25.2.1, npm 11.6.2. Exact commands and source/artifact hashes are in the
[machine report](xr-native-worker-validation-data.json).

- `npm run build`: TypeScript/Vite pass, normal chunk-size warning. Initial duplicate interface/class
  import name was corrected to a type alias before the final build and cumulative tests.
- `node --test --test-reporter=tap tests/xr-native-worker.test.mjs tests/xr-native-material.test.mjs tests/xr-native-weave.test.mjs tests/xr-native-wormhole.test.mjs tests/gameplay-purity.test.mjs tests/xr-settings.test.mjs tests/xr-background-settings.test.mjs tests/xr-menu.test.mjs tests/xr-wormhole.test.mjs tests/xr-wormhole-continuity.test.mjs tests/wormhole-route-geometry.test.mjs tests/wormhole-frame-context.test.mjs tests/xr-controller-regeneration.test.mjs tests/wormhole-determinism.test.mjs tests/wormhole-exact-frame.test.mjs tests/visual-mode-transition.test.mjs tests/wormhole-depth-integrity.test.mjs tests/wormhole-lifecycle.test.mjs tests/contracts.test.mjs tests/styles-deterministic.test.mjs`: **282/282 pass**.
- `npm test -- --test-reporter=tap`: **1683 tests, 1674 pass, 9 exact T06c baseline names/messages**;
  no skips/cancellations. All 179 predecessor active files retained: 178 byte-identical, one reviewed
  composition-import assertion replacement with archived source/reason. Eleven new cases in file
  180. Eight implementation/test predecessors retained. Protected XR loader and analyzer evolution
  unchanged; no timing golden or historical result regenerated.
- The final text-only native hint now describes the worker/fallback instead of incorrectly saying
  no worker. After that copy edit, `npm run build` and
  `node --test --test-reporter=tap tests/xr-settings.test.mjs tests/xr-menu.test.mjs` passed **24/24**.
- `git diff --check`: pass (existing CRLF advisories). `diff_export.ps1` omitted in favour of scoped
  review, immutable predecessors, cumulative identities and complete build-input manifest.
- `node scripts/audit-native-worker.mjs`: exact baseline, retention and browser gates pass.

Unit tests use actual structured-clone transfers/detachment, including one reusable output lease,
two stable host banks, analysis copy, bounded latest-request coalescing, paused wakeups, merged
settings, seek/pause invalidation, reprepare/late callbacks, constructor/startup/runtime/decode/
deadline fallback, malformed identities/counts/buffers, unknown replies, unchanged acknowledgement,
worker lease refusal, idempotent disposal and renderer diagnostics. Actual identity packets match
the direct source across forward/backward paused samples. Initial new fixture failures (VM error
prefix and a fake source exposing a frame before its first render) were corrected to the actual
source contract; failed log retained, no predecessor tests weakened.

## Real browser evidence and performance limits

The real module worker (fallback factory deliberately throws in this probe) matches the direct
producer at 2.125, 3, 0.4 and revisited 2.125 seconds: **zero data difference, zero changed pixels**,
equal counts/focal/spatial companions. Analysis unchanged. Defined bright fixture: 6922 coloured
pixels, two draws /8374 triangles /zero textures. The initial visibility gate checked the final
history-dependent profile endpoint (only three pixels above threshold); the final gate explicitly
retains and displays the defined fresh 2.125 s packet. Initial report retained; all four parity
cases were already exact, and no production material law changed for the probe.

32 measured desktop samples after eight warmup samples, before cumulative test execution:

| CPU component | p50 ms | p95 ms |
| --- | ---: | ---: |
| Direct producer on main | 3.5 | 4.7 |
| Same producer in worker | 3.8 | 4.6 |
| Main request/adoption calls | below timer resolution | 0.2 |
| Main transfer-to-bank copy | below timer resolution | 0.1 |
| Main GPU attribute copy | 0.4 | 0.6 |
| Worker roundtrip | 4.2 | 5.0 |

These are separate component distributions, not an end-to-end FPS or GPU benchmark. Sub-resolution
values do not mean zero work. CPU submission is asynchronous GPU command submission, not GPU
execution. Moving producer CPU off the main thread does not remove GPU fill/upload, and response
latency still exists. No physical Quest pacing/comfort or guaranteed device speedup is claimed.

Local XR loaded the retained 28 s /128 BPM WAV, generated 42 notes/41 arrows/3 pairs, played/paused,
displayed `worker geometry; no background canvas` and latency in the footer, and restored Hybrid.
No console warnings/errors. A local tab attachment/navigation timeout recovered on the same tab;
the actual XR UI, worker and playback all completed normally. Public release/UI verification is
recorded in [deployment evidence](xr-native-worker-deployment-data.json).

Publisher: installed `node node_modules/gh-pages/bin/gh-pages.js -d dist --nojekyll` with the T06c2
message, replacing only the Bun-dependent operational deploy invocation. No package/lockfile change
or force push. Manual: native mode and worker label; Quest head-movement/frame pacing with the
same track/settings; pause/resume, material/direction changes and Hybrid restoration. Storage/Copy
retain their prior contract; OS clipboard paste remains manual. Remaining visuals: T06d stars/
galaxies/skybox, T06e wall/membrane, T06f optics/full Quest gates. Stop for feedback before T06d.
