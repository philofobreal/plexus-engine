# T07b cockpit refinement validation (2026-10-24)

The user requested refining T07 before T08: stepped central intrusion lowering the title, rounded turns/edges while retaining the angular silhouette, instrument-style typography, an improved bezel and correction of angle-dependent title artifacts. One XR presentation integration owner; audio, analyzer, gameplay, presets, Wall and worker contracts are unchanged. Existing cabin/title settings remain saved/copied. See [contract](xr-cockpit-refinement-contract.md).

## Result and cause

The central console descends from the crown. The filename center is 0.245 m below T07, with a shallow beveled pod, recessed dark screen, cyan/magenta instrument brackets, inset outline and bottom status accents. Long straight/chamfered spans retain their shape; joined rail turns use short curves and the wide body section has rounded edges with baked vertex shading. Body and trim remain two merged unlit draws. Geometry builds only on changed layout/recenter inputs; no new runtime lights, reflections or animation.

The title, menu and HUD use the same Segoe UI/Roboto/system family and #eef8ff ink. The title uses the instrument heading's bold weight. Glyph alpha is sampled separately from RGB, with continuous explicit gradients across wrapped atlas rows, trilinear mipmaps and up to 8x anisotropy (renderer clamps capability). There is no per-frame canvas upload. The base atlas remains at most 4 MiB; including mipmaps below 5.34 MiB.

Real GPU reproduction confirmed T07 coplanarity: title z+0.17 coincided with the portal front. In the worst of seven views (0, ±25, ±50, ±65 degrees), only **45.9%** of the solo title ink survived behind the frame. The new pod/display separation retains **100% in all seven**. The screen is forward of its inset/brackets by at least 0.045 m. Depth testing remains enabled; transparent title does not write depth. This corrects the reproduced artifact and reduces oblique aliasing; physical headset readability remains manual.

## Evidence

- Build: `npm run build`, TypeScript and Vite pass; existing informational chunk-size warning.
- Targeted: `node --test --test-reporter=tap tests/xr-cockpit-refinement.test.mjs tests/xr-cockpit.test.mjs tests/xr-settings.test.mjs tests/xr-controller-regeneration.test.mjs tests/xr-menu.test.mjs tests/xr-play-profile.test.mjs tests/xr-track-path.test.mjs tests/xr-background-settings.test.mjs tests/xr-note-design.test.mjs tests/xr-note-halos.test.mjs tests/gameplay-purity.test.mjs tests/xr-wall-default-off.test.mjs`: **129/129**.
- Cumulative `npm test -- --test-reporter=tap`: 1722 / 1713 pass / nine exact baseline failures, zero skips or cancellations. Exact baseline failure names and assertion text must match T07; no new failures, skips or cancellations accepted.
- All 184 earlier test files remain in the 185-file active suite. Four new geometry/depth/HUD/typography cases. One reviewed predecessor assertion increases static triangle cap 1600→6000 for requested rounding/detail; all old settings/ray/dispose/time/memory assertions preserved. Five immutable source/test archives. Protected loader/timing evolution manifest unchanged. [Retention](../tests/t07b-retention.json).
- Initial new clearance test caught a real above-HUD overlap. Raised the crown's lower edge and positioned the shallow pod forward; above/side HUD rays and old exhaustive note-path rays pass. Initial depth test accidentally included rear cabin arches; narrowed to local display geometry. Both initial failures/results retained in logs.
- Actual WebGL: Full **3 calls / 5554 triangles / 1 caption texture**, Reduced **3 / 3938**, Off zero. Old T07 Full was 590 triangles; added geometry is static and bounded. No claim of zero performance cost. Isolated 32 desktop CPU submission samples after eight warmup: Full p50 ~0.1 / p95 ~0.6 ms; Off p50 timer-rounded 0 / p95 ~0.1 ms. GPU execution and physical Quest pacing unmeasured.
- GPU pixel checks: fixed clipping, moving title, atlas-row seam, exact paused repeat and seek replay, no per-frame uploads, bounded replacement textures, desktop plus four logical headset views. Seven-angle before/after diagnostic also passes. Both reusable harnesses retained under `tests/browser/`.
- Local actual app: long accented WAV filename, play/pause, open gameplay/Tall HUD, styled screen, Reduced/Static→Copy toast→reload persistence, Off, restored Full/Scroll; no console warnings/errors. OS clipboard paste remains manual.
- `git diff --check` passes. Scoped predecessor archives plus full deployment build-input manifest replace broad `diff_export.ps1` in this cumulative worktree; no source push.
- Node/npm runtime; full suite uses known filesystem escalation for fixture temp renames/Git configuration. Published with `node node_modules/gh-pages/bin/gh-pages.js -d dist --nojekyll` through the release script because package deploy requires unavailable Bun; no dependency/package-script change.

[Machine results](xr-cockpit-refinement-validation-data.json), [release](xr-cockpit-refinement-deployment-data.json). Log root `logs/t07b/`; machine results retain evidence hashes.

## Deployment and manual gate

Pages **7123c10b806a125c483a45cc8f9e4055f4c2ee92**, parent **08d0c8875fdba2394c5763f2626eba7a60df14ae**, release **t07b-cockpit-refinement-20261024T122253442Z**. [Public XR](https://philofobreal.github.io/plexus-engine/xr/?release=t07b-cockpit-refinement-20261024T122253442Z). Exact build built; 17 HTML/assets, 4 routes and 341 source inputs verified byte-for-byte. Public long filename/play/pause, styled pod, controls/reload/Copy, Off and restored Full/Scroll pass; no warnings/errors. [Deployment evidence](xr-cockpit-refinement-deployment-data.json).

Test on Quest: look left/right/up and around the caption, confirm no crawling/striped letters, the stepped pod and smooth edges are comfortable, above/side HUD and gameplay remain clear in Standard/Tall, pause/seek keep the marquee stable. Full/Reduced/Off and Scroll/Static/Off remain available. Physical comfort/frame pacing are unverified. Stop for manual feedback; T08 has not begun. Wall Off / Galaxies 0 baseline and deferred Wall/T06f scope are unchanged.
