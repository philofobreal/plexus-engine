# T03: 500 m XR background validation

Date: 2026-10-23 (Europe/Budapest). Integration/XR owner: this chat.
Base commit: `effd6db7d268fd318dbcd4dbb1bec18e268a5441`.
Status: implementation and automated checks delivered; physical Quest/manual acceptance pending.
Depends on T00; the user accepted T01's staged plan before this implementation.

## Result and ownership

Visuals > Background distance now offers 40 / 100 / 200 / 500 m. The authored default is still
200 m. XrBackgroundSettings owns the extended numeric type and allowed list; XrSettings owns
the fourth choice and hint. Its existing normalization/descriptor path feeds both desktop/VR
menus, XrSettingsStore and the scene. No duplicate menu or persistence rule was added.

SceneConfig.cameraFarMeters increases from 600 to 1000. XrRuntime already consumes that
constant with near = 0.05 m. The installed Three 0.186 WebXRManager.updateCamera copies the
application camera near/far into its XR eye cameras and calls session.updateRenderState when
they change; no separate session clipping code is necessary for this existing local-floor setup.
Depth sensing is not requested by this host.

WormholeBackdrop, XrMenuModel, XrSettingsStore and XrRuntime require no code change: their existing
scale, shared descriptor, version-1 normalization and camera-config seams handle the new choice.
Distance remains presentation scope: no chart regeneration, playback restart, scoring, live clock,
global State or render-worker protocol change. A quality rebuild preserves the selected distance.
Track far-aim and spatial-field emergence follow 500 m using their existing pure laws.

## Geometry and precision

At distance D, backdropScale is D/40. The plane's reference width 106 m and height 60 m therefore
become 1325 x 750 m at D=500, keeping the same horizontal/vertical angles from the reference eyes.
Raster dimensions, quality/cadence, mipmaps, worker/source instance and upload dimensions do not
increase merely by changing distance. Tests assert the source is retained and its raster options
unchanged; this is not a measured GPU/frame-rate claim.

Maximum corner radius from the reference eyes:

`sqrt(500^2 + (1325/2)^2 + (750/2)^2) = 910.7860616 m`.

Camera-space forward depth at any head rotation is bounded by this radius. For an eye translation
within 5 m, the triangle bound is 915.7860616 m, leaving over 84 m under far=1000. The old far=600
clips corners when looking toward them. The projection regression reproduces that old failure
and passes with the new far value at the desktop eye position and three-dimensional translated
poses spanning a 6 x 6 m room. It looks near each corner with additional yaw/pitch offsets and
asserts both image-plane and depth-frustum inclusion. This does not claim the whole panorama
fits inside every headset field of view; intentionally looking away remains normal view clipping.

Near is unchanged, so far/near is 20000. For conventional 24-bit perspective depth, using
`depth(z) = f/(f-n) - fn/((f-n)z)` and inverting one quantization step:

| Eye-space z | Theoretical world-space step |
| --- | --- |
| 0.85 m | 0.000861 mm |
| 1.2 m | 0.001717 mm |
| 5 m | 0.029801 mm |
| 10 m | 0.119205 mm |
| 20 m | 0.476825 mm |

Each step is below 0.5 mm throughout this sampled gameplay range and differs by less than 0.1%
from far=600. This calculation assumes a conventional 24-bit buffer; it is not a measurement of
the physical headset's actual precision, compositor, or absence of visual depth artifacts.

## Automated validation

Runtime: Node v25.2.1 / npm 11.6.2, Windows x64; dependencies/lockfiles unchanged.
Commands run from the project root:

```powershell
node --test tests/xr-background-settings.test.mjs tests/xr-settings.test.mjs tests/xr-spatial.test.mjs tests/xr-track-path.test.mjs tests/xr-wormhole-spatial-field.test.mjs tests/xr-performance.test.mjs
npm run build
npm test
git diff --check
```

- Targeted: 92/92 pass, including normalization, descriptor activation, old/current version-1
  storage, angular size/fixed nearer layers, live change/quality rebuild without raster expansion,
  far-corner clipping reproduction, depth precision, track aim and spatial-field laws at 500 m.
- Build: TypeScript and Vite pass; existing chunk-size warnings only.
- Full suite: 1559 tests, 1550 pass, 9 fail, 0 skipped/cancelled/todo; 280684 ms. It ran outside sandbox
  to avoid the T00-proven Temp rename/Git-config restrictions. No runtime/runner fallback used.
- Existing background-distance tests were extended rather than removed. The previous 200 m
  quality-rebuild assertion is retained alongside the new 500 m rebuild. No golden regenerated.
- During the first targeted run the new menu test called activateMenuItem with the wrong
  argument shape; corrected to its existing `(state, context, layout, id)` API, then all 92 passed.

Raw artifacts: `logs/t03/targeted.log`, `build.log`, `tests.log`, `http-smoke.json`.
Diff snapshot: `diff_export.ps1` considered and skipped for this small local patch; direct
`git diff` inspection and whitespace checking used. No network fetch, push or deploy performed.

## Desktop browser smoke

The old server was no longer running at the start of this turn (connection refused). Restarted
outside sandbox with `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`, then confirmed
XR HTTP 200 and real WebGL stage/menu rendering in the in-app browser.

Using actual canvas-menu pointer interaction: Settings -> Visuals -> 500 m; the choice highlights
correctly and all four distance labels fit. Reloaded the document, reopened Settings -> Visuals,
and 500 m remains selected. Captured browser error logs were empty. No track was loaded in this
smoke, and WebXR immersive-vr is unsupported by this desktop browser. This proves desktop
presentation/settings wiring and actual WebGL startup, not physical Quest acceptance or audio
gameplay/performance. Automated Node tests separately prove no chart/play scope change.

Screenshot after reload: `logs/t03/500m-reloaded.jpg`, SHA-256
`e0a8abe35e6c0109b1708e284c41d90def6a05c0f8b63743e8904770f527418d`.
The test tab is retained. After smoke the foreground Vite process was stopped and the same
Vite entrypoint/host/port was started with PowerShell Start-Process -WindowStyle Hidden for the
user's manual test. PID is in `logs/t03/dev-server.pid`; output/error logs are adjacent.

## Manual acceptance and rollback

Open `http://127.0.0.1:5173/plexus-engine/xr/`, load a familiar track and select
Settings -> Visuals -> Background distance -> 500 m. Check:

1. Changing 40/100/200/500 during playback keeps the image's angular size and does not reset
   playback/chart/score; return to 500 and reload to confirm persistence.
2. In the established HTTPS Quest test environment, look toward each panorama corner, turn and
   translate the head within the play area; confirm no far-edge cut or close-note depth artifact.
3. Standard/Tall targets, saber/menu clarity and pause/seek/re-entry/recenter remain usable.
4. Compare the same quality/rate/track window against 200 m; report diagnostics and any apparent
   frame/memory difference. Physical device p50/p95/p99/GPU/compositor costs remain unmeasured.

This task pauses for that feedback. The next planned task is T02 (minimal PR 8 role/session seam),
with T04/T05 remaining separate subsequent changes; no other feature was implemented here.

Compatibility: v1 stored 40/100/200 records remain valid, default 200 unchanged; new 500 is saved
in the same shape. An older app loading a 500 record falls back to its authored default. No new
feature flag, schema/cache version, worker buffer or asset is required. Rollback selects 200 m
then reverts the three production-file edits (allowed value, descriptor choice and camera far);
old code also normalizes a remaining 500 record to 200. Retain the validation/history record.

## Completion evidence

All nine full-suite failures match T00 by exact test location, test name and assertion text.
The T00 Temp rename/Git-config failures are absent outside sandbox. No unexpected failures;
the full suite remains non-green because the existing preset/motion assertions still fail.
The three newly added tests account for the increase from 1556 to 1559 discovered test cases.
See [machine-readable validation](xr-500m-background-validation-data.json) for the failure
identities and SHA-256 values of the raw build, targeted/full-suite, HTTP and screenshot artifacts.
No application changes followed the successful targeted/build/full runs; only the SceneConfig
explanatory comment was rounded more precisely and documentation/evidence were updated.

## Subsequent authorized deployment

The user explicitly requested deployment now and after every completed task. This extends the
earlier local handoff: T03 is now deployed to the verified existing GitHub Pages target, and
manual acceptance should use the public HTTPS XR URL. DotRoll migration remains T24.

- Public XR: `https://philofobreal.github.io/plexus-engine/xr/`.
- Release ID: `t03-500m-20261023T210201329Z`; public diagnostic marker at
  `https://philofobreal.github.io/plexus-engine/release.json`.
- Pages commit: `665a608ba0f75958c9d69647fff53bc7e3edbfaa`, message
  `Deploy T03: optional 500 m XR background`; Pages API status `built` with no error.
- Previous Pages commit: `83dcb7a418fb48c1947513cbec53d9246960e6a7`, verified as the parent of
  this deployment commit. No history reset/force push. Rollback can restore that tree in a new
  Pages commit without modifying the application source checkout.
- Source remains base `effd6db7d268fd318dbcd4dbb1bec18e268a5441` plus the working-tree T03
  application patch, SHA-256 `30172eb6661ee0499bcef710700458fae63ceb7baa9360e8d650d2ce65d0a805`.
  The source branch was not pushed or merged. The release marker explicitly records this provenance.

Commands: `npm run build` (PASS, existing chunk warnings only), then
`node node_modules/gh-pages/bin/gh-pages.js -d dist --nojekyll -m 'Deploy T03: optional 500 m XR background'`
(Published). Used the project's installed gh-pages package with Node/npm, equivalent to the
existing Bun-based deploy script; no dependency, package script, base path, DNS or hosting change.
Publishing/network verification ran outside sandbox as required for Git/network access.

Before publishing, validated all three entrypoint asset references and the built XR bundle's
500 m option; retained release manifest and source patch under `logs/t03/deploy/`. After Pages
finished, fetched root/MVP/XR routes (all 200), verified the release ID and exact SHA-256 of all
three entry HTML files plus 13 JS/CSS/worker assets against the concrete dist. Live browser
smoke showed the actual WebGL stage and Settings -> Visuals -> 500 m; selection works and
captured error logs were empty. No audio/headset run was claimed. The completed full regression
was not repeated for unchanged application code; its nine exact baseline failures remain.

Compact proof: [deployment data](xr-500m-deployment-data.json). Raw API/verification/build/publish
logs and release manifest: `logs/t03/deploy/`. Live screenshot: `logs/t03/deploy/live-500m.jpg`.
The deploy is complete; wait for the user's manual/Quest feedback before starting T02.
