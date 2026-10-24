# T06e native wall / membrane validation

Status: implementation and desktop gates passed; Pages **99af80e1880dcf1352a226c1576de4a93ce428e1**, parent **a4d8484a49d44699f4020ab278cba7bc9c957aa8**, release **t06e-native-wall-20261024T105422000Z**. [Public XR](https://philofobreal.github.io/plexus-engine/xr/?release=t06e-native-wall-20261024T105422000Z). Exact Pages build built; 17 HTML/assets, 4 routes and 337 unchanged input hashes verified. Real public Wall menu/reload/Copy/native play/pause/worker/Hybrid smoke passed; see [deployment](xr-native-wall-deployment-data.json).

## Result and ownership

The existing identity now publishes preprojection membrane, caustics, mosaic and event-crack paths, using the same authored route, fronts/waves, palette and material law. No second simulation, audio analysis or background canvas. Colored spatial fringe approximates original split edges; background refraction/lens/ring/deep-field imaging remains T06f. Hybrid remains default; Native remains experimental. A single integration owner covers shared types, visuals producer/worker and XR GPU/menu consumers. See [contract](xr-native-wall-contract.md), ADR-009 AO and worker governance.

Optional wall frame: 3200 * 16 floats = 204800 bytes; primary 437760 and cosmos 308352 bytes unchanged. Same one-flight/latest-request lease and generation/epoch/revision/time checks. Pair validation, fixed two main banks, copy before return, stale return once, absence clears, old source adapters and main fallback covered. Off emits no extra transfer/draw. Native GPU uses one batch (four total draws per eye), soft strokes/discs, bounded width, quality stride, distance and near-runway clearance. It renders behind stage/notes including transparent objects. GPU fill/attribute copy remains a cost.

## Player behavior

Wall tab: Off / Preset / On; material Preset / Membrane / Mosaic; Wall amount, Fringe, Caustics, Pressure waves, Cracks. Migration/default is Off, Preset material, gains 50. Preset retains original authored gate/material/amount even through MVP optics suppression. On explicitly enables wall and uses unit amount only if authored amount was zero. Existing Advanced gain law: 50 neutral, 0 removes the component. Asset/plan objects remain immutable; no automatic lens enable. Both Hybrid/Native consume this presentation. All seven controls persist and Copy report includes them. Local edited 40/60/40/40/60 plus On/Mosaic survived reload; Copy success toast observed; Wall defaults restored. OS clipboard paste remains manual.

## Validation

Production TypeScript/Vite build passes (ordinary chunk warning). 420/420 targeted; initial focused 54/54; compatibility 105/105. Full cumulative 1702: 1693 pass, 9 failures with exact predecessor names and assertion messages; zero skips/cancellations. [Machine evidence](xr-native-wall-validation-data.json) retains complete comparisons. All 181 previous active test files remain, plus one new file with 10 cases (182 active). Two reviewed exhaustive-default assertion extensions preserve predecessors; 14 source/test archives checked. Protected loader unchanged. Source-evolution manifest updated only for the additive CanvasVisualSource presentation; full predecessor and superseded review retained, historical timing measurements unchanged. Initial 81-case run had three exhaustive-default expectations awaiting reviewed extension; subsequent focused/full runs pass those cases.

Full test run used filesystem escalation because earlier cumulative runs established sandbox temporary preset rename and Git config restrictions. No failed full sandbox run this task. Node/npm runtime unchanged. Deployment uses Node gh-pages entrypoint in place of Bun-dependent package script; no package/lock/dependency change. No source branch push or force push.

### Exact commands

```powershell
npm run build
node --test --test-reporter=tap tests/xr-native-wall.test.mjs tests/xr-native-worker.test.mjs tests/xr-native-material.test.mjs tests/xr-native-weave.test.mjs tests/xr-native-wormhole.test.mjs tests/gameplay-purity.test.mjs tests/xr-settings.test.mjs tests/xr-background-settings.test.mjs tests/xr-menu.test.mjs tests/xr-wormhole.test.mjs tests/xr-wormhole-continuity.test.mjs tests/wormhole-frame-context.test.mjs tests/xr-controller-regeneration.test.mjs tests/wormhole-determinism.test.mjs tests/wormhole-exact-frame.test.mjs tests/visual-mode-transition.test.mjs tests/wormhole-depth-integrity.test.mjs tests/wormhole-lifecycle.test.mjs tests/contracts.test.mjs tests/styles-deterministic.test.mjs tests/mvp-macro-tuning-mapper.test.mjs tests/mvp-async-lifecycle.test.mjs tests/semantics-integration.test.mjs tests/wormhole-wall-geometry.test.mjs tests/wormhole-wall-material.test.mjs tests/wormhole-wall-waves.test.mjs tests/wormhole-wall-cracks.test.mjs tests/wormhole-wall-mosaic.test.mjs tests/wormhole-wall-refraction-field.test.mjs tests/accepted-timing-measurement.test.mjs
npm test -- --test-reporter=tap
node --test --test-reporter=tap tests/wormhole-frame-context.test.mjs tests/xr-wormhole.test.mjs tests/xr-wormhole-continuity.test.mjs tests/accepted-timing-measurement.test.mjs
git diff --check
node scripts/audit-native-wall.mjs
```

Additional focused: `node --test --test-reporter=tap tests/xr-native-wall.test.mjs tests/xr-settings.test.mjs tests/xr-background-settings.test.mjs tests/xr-menu.test.mjs` (54/54). Compatibility: `node --test --test-reporter=tap tests/wormhole-wall-geometry.test.mjs tests/wormhole-wall-material.test.mjs tests/wormhole-wall-waves.test.mjs tests/wormhole-wall-cracks.test.mjs tests/wormhole-wall-mosaic.test.mjs tests/wormhole-wall-refraction-field.test.mjs tests/wormhole-frame-context.test.mjs tests/accepted-timing-measurement.test.mjs tests/xr-wormhole.test.mjs tests/xr-wormhole-continuity.test.mjs` (105/105). Complete raw logs under logs/t06e; immutable artifact hashes in machine evidence.

## Browser and technical performance

Reusable [browser program](../../tests/browser/native-wall-smoke.html) uses the actual module worker, failing if fallback occurs. Four song times (including backward seek/replay): worker/direct wall floats and rendered pixels exactly equal, companions match. This is worker/direct parity, not raster/native pixel identity. A separate regression projects original native points onto legacy raster wall stroke coordinates (within 0.01 pixel before lens).

Four isolated families visible: membrane 1163 carriers / 4586 lit pixels; caustics 225 / 1117; cracks 36 / 165; mosaic 300 / 1892. Fringe variant changes 4240 pixels. 64 mm stereo disparities 2.059 / 0.985 px near/far; near exclusion, oblique view and quality pass. Both opaque and transparent stage covers reduce 10590 wall pixels to zero. Off has three draws; On fixture four draws / 17984 triangles / zero textures / 1422 wall instances.

32 samples after eight warmup: worker producer p50/p95 3.8/5.6 ms; main request/adoption 0.1/0.2; transfer timer-rounded 0/0.1; attribute copy 0.5/0.6; roundtrip 4.8/6.2 ms. These desktop fixture results do not compare speed with T06d (different fixture/JIT). GPU execution timing, physical Quest pacing and comfort unmeasured. No guaranteed speedup; additional wall fill can cost frames. Native removes raster/offscreen background work but still copies attributes on main.

## Delivery and manual gate

Deploy uses prepared source/asset identities, previous Pages parent check, exact built commit and public byte verification; real public UI test follows. Rollback: Wall Off, Hybrid, or republish retained T06d tree in a new Pages commit. No force push.

Manual: enable Native in System, Wall On (current factory wall amount may be zero); compare Preset and Membrane/Mosaic, five gain controls including zero; reload and Copy/paste; same-track Quest head movement/stutter, note/path visibility, pause/resume and Hybrid. Event cracks require qualifying original fronts and may be omitted by Performance policy. Stop for feedback before T06f.
