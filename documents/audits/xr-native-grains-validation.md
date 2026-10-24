# T06a: experimental native grains and trails

Date: 2026-10-24. Integration owner: this chat. Owners: shared visuals/types, XR scene/GPU,
player settings and docs. User accepted T05c and authorized the next task; deploy/manual gate
remains required. No subagents, dependencies, analyzer, audio-clock or worker protocol changes.

## Player behavior

Settings > System > Wormhole mode offers Hybrid (legacy default) and Native grains (experimental).
The choice is presentation-only, normalized for legacy version-1 records, persisted through the
existing settings store and included in Copy settings. It never regenerates a chart or changes
score/playback. Native removes the background raster worker, OffscreenCanvas, bitmap and plane;
the game's own renderer/menu/HUD keep their existing independent canvas/textures.

Native uses one instanced mesh with actual depth for the original grain heads/trails. The private
shared identity still owns seeds, releases, travel, route, signed twist, preset gains and colour.
Switching to Hybrid disposes native resources and restores all retained raster/spatial settings.
Factory/prepare failure falls back to Hybrid and the diagnostic label names it. Startup applies
the stored mode before enabling the source, so a native startup does not create the raster source.

Mode is an XR/device representation choice; it is not inserted into musical presets. Existing
artistic parameters remain preset-owned. Quality limits native grains (360/720/1080/1440; the
top tiers share the 1440 cap), distance is its far cutoff, sharpness changes ribbon edges.
Raster backend/material renderer/line-composite/pacing settings are retained Hybrid preferences;
native has no such image passes. The old decorative spatial field is hidden in native mode.
Weave, volumetric nebula, bloom/filament detail, wall/membrane/cracks, stars/galaxies/skybox and
lens/refraction are not migrated. Native is consequently sparser than Hybrid, especially in quiet
roles. This is the required first grains/trails spike, not completion of the full T06 inventory.
See [element inventory and schema](xr-native-wormhole-contract.md) for representation/cost limits.

## Implementation and lifecycle

`WormholeNativeFrame` is a separate spatial v1 schema, not reinterpreted raster buffers. Its 1440
records use stride 16 and one reused 90 KiB CPU buffer, borrowed until the next accepted render.
The shared route helper records local xyz before the perspective divide. The source converts once
to eye-line stage axes in metres (+y up, forward -z); XR places that group at the viewer placement.
Stable pool IDs and absolute release generations travel with positions/radius/colour/opacity and
preparation generation/frame serial/songTime. GPU attributes copy active records synchronously.

The consumer uses actual per-eye model-view/projection, one fixed instanced geometry, no texture
or offscreen target. Depth tests preserve opaque occlusion, widths are bounded to 4-80 mm radius,
trails to 1.5 m. A 0.3 m near cutoff and 2.4 m gameplay corridor with ribbon margin protect the near
volume; a trail crossing that corridor is reduced to its safe head. No camera roll or shake.
Preparation revision guards, dispose, repeated enable/disable, native/Hybrid switching and fallback
are tested. Physical hand/saber/cockpit clearance remains a Quest acceptance gate.

## Validation

```text
npm run build
node --test --test-reporter=tap tests/xr-native-wormhole.test.mjs tests/gameplay-purity.test.mjs tests/xr-settings.test.mjs tests/xr-background-settings.test.mjs tests/xr-menu.test.mjs tests/xr-wormhole.test.mjs tests/xr-wormhole-continuity.test.mjs tests/wormhole-route-geometry.test.mjs tests/wormhole-frame-context.test.mjs tests/xr-controller-regeneration.test.mjs tests/wormhole-determinism.test.mjs tests/wormhole-exact-frame.test.mjs
npm test -- --test-reporter=tap
git diff --check
node scripts/audit-native-wormhole.mjs
```

Build passed (existing chunk-size advisory only). Final targeted 182/182. Full 1663: 1654 passed,
9 exact T05c baseline failures, no skipped/cancelled. The [machine report](xr-native-grains-validation-data.json)
matches full names and assertion evidence, not just the count. All 176 predecessor files remain
active with the new test file (177 total). Three exhaustive contract tests have reviewed additive
extensions: native factory import, normalized default and descriptor/group ownership. Their
predecessors and seven implementation sources are retained in [retention](../tests/t06-retention.json).
The XR loader and analyzer evolution manifest/measurements remain unchanged. The initial targeted
failures are retained: menu placement moved to System to fit the existing layout, legacy missing
mode is treated as Hybrid, and manual direction changes redraw the paused native source immediately.

The versioned `tests/browser/native-wormhole-smoke.html` uses real Three/WebGL rendering, not
mocked shader outputs. At simulated 64 mm stereo separation, near disparity was ~2.03 px and far
1 px. The opaque blocker reduced the grain's red-channel sum from 3101 to zero. Near geometry was
culled. Right/left signed twist was +0.12/-0.12. The actual identity sample carried 1358 records;
1357 visible instances rendered in one call / 2714 triangles / zero textures. CPU sample time and
all raw metrics are recorded; this small desktop fixture is not a headset GPU timing benchmark.
Source tests forbid canvas, OffscreenCanvas and Worker construction and pin fixed buffer ownership.

Actual local XR menu journey: select Native, reload, load the 28 s synthetic fixture, play/pause,
inspect the native diagnostic label, Copy settings and return to Hybrid. Native remained selected
after reload; Hybrid's full background returned. Console errors were absent. Copy acknowledged
`Settings copied.` and the actual report serializer includes the mode. The automation clipboard
reader returned an older T04b payload (as in T05b); retained raw evidence avoids claiming a native
clipboard read/paste roundtrip. User paste is part of manual acceptance.

Node/npm validation needed no runner fallback. Publish uses the installed Node gh-pages entrypoint
instead of the Bun-dependent package deploy script; no package change. `diff_export.ps1` was skipped
in favour of scoped review, predecessor archives, cumulative test IDs and deployment source hashes.
No source branch push/merge or force push is part of this task. The [deployment record](xr-native-grains-deployment-data.json)
records the public release, previous Pages commit, byte verification, browser smoke and rollback.

## Manual gate

On XR choose Settings > System > Wormhole mode > Native grains (experimental). Check binocular
depth/head translation, foreground occlusion, note/saber visibility, comfort, pause/resume, mode
switching and persistence. Copy settings and paste to confirm the native mode line. Switch Hybrid
back on to recover the full previous background. Physical Quest measurement is still required;
native must not become the default from this desktop result. Stop for the user's feedback before
T06b/remaining native element work; T07 has not started.
