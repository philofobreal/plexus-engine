# XR browser look, 4K background and authored defaults

Date: 2026-10-16. Base: `e11c003` in the standalone `plexus-engine` repository.
The enclosing worktree's nested repository directory was empty; a local clone of the existing
repository was prepared there without modifying the original checkout.

## Ownership and behavior

XR input owns primary-pointer gesture recognition; XR runtime owns desktop camera yaw/pitch.
The application facade gates looking while menus or immersive tracking own input. Menu rendering
owns abbreviated display text and camera-facing placement. XR settings and its authored Wormhole
tuning own the requested defaults. Audio, worker protocols and gameplay-library defaults are unchanged.

The new quality value `4k` allocates a 3840x2160 background raster and uses mipmaps, like Max.
Max remains the default. This does not raise the desktop framebuffer's existing pixel budget.
Saved user choices keep their previous precedence; Reset defaults uses the new complete configuration.

## Automated validation

Commands ran from `plexus-engine/` with the available Node 25.2.1 and npm. Existing dependencies
were copied from the original local checkout; no dependency was installed or upgraded. The first
copy attempt hit directory timestamp permissions; the copy was completed with data-only robocopy
and zero retries. No runtime or package-manager fallback was used. The copied toolchain reports
TypeScript 6.0.3 and Vite 8.0.14.

```powershell
npm run build
node --test tests/xr-settings.test.mjs tests/xr-background-settings.test.mjs tests/xr-menu.test.mjs tests/xr-spatial.test.mjs tests/xr-performance.test.mjs tests/xr-play-profile.test.mjs tests/xr-wormhole.test.mjs tests/xr-desktop-look.test.mjs
npm test
node --test tests/xr-*.test.mjs tests/gameplay-purity.test.mjs tests/rhythm-*.test.mjs tests/mvp-macro-tuning-mapper.test.mjs tests/mvp-async-lifecycle.test.mjs tests/semantics-integration.test.mjs tests/wormhole-determinism.test.mjs tests/wormhole-lifecycle.test.mjs tests/wormhole-depth-layers.test.mjs
git diff --check
```

- Production build passed, including TypeScript checking. Vite reported the existing large-chunk warning.
- Initial focused validation passed all 77 tests after updating assertions for the deliberately changed defaults.
- Full suite ran 1340 tests: 1329 passed, 11 failed. One remaining XR startup assertion still pinned the
  former Ultra/20 configuration; it was updated to Max/30. No implementation failure was hidden by this update.
- Final affected-suite validation passed all 479 tests, including XR startup, all settings, physical-input
  contracts, gameplay purity, shared MVP helpers, Wormhole lifecycle/determinism and the new pointer cases.
- Whitespace validation passed.

The ten unrelated full-suite failures were reproduced against an untouched archive of `HEAD`, in
the ignored `baseline-check.local/` directory, with this command:

```powershell
node --test tests/dev-preset-save.test.mjs tests/wormhole-clip-profile.test.mjs tests/wormhole-geometry-lfo-integration.test.mjs tests/wormhole-preset-differentiation.test.mjs tests/wormhole-projected-motion.test.mjs
```

Baseline result: 30 passed, 10 failed. These are one sandbox `EPERM` file-rename failure in
`dev-preset-save`, four existing `wormhole-clip-profile` preset assertions, one geometry/LFO preset
assertion, two preset-differentiation assertions and two projected-motion assertions. The failure
identities match the remaining failures from the full modified-tree run. They are outside this change.

## Browser validation

The sandboxed dev server could start but its localhost listener was unreachable from other processes.
A server restricted to localhost was started outside the sandbox:

```powershell
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
(Invoke-WebRequest -Uri 'http://127.0.0.1:5174/plexus-engine/xr/' -UseBasicParsing -TimeoutSec 10).StatusCode
```

HTTP returned 200. Actual in-app browser automation verified a nonblank rendered scene and:

- Gameplay displays Tall, Hyper and Auto selected on startup.
- Visuals displays Max, 36 Hz, 200 m, Line stroke 30 and Sharpness 100 selected.
- The seven quality choices fit, including recognizable Perf./Bal. abbreviations and 4K.
- Selecting 4K selects the correct item; selecting Max restores the requested default.
- Closing the menu and dragging the actual canvas visibly rotates the view.
- Reopening the menu after horizontal and vertical looking places it in front of the camera.
- Captured browser console contained no errors.

Touch and pen ownership, tap jitter, coalesced release, cancellation, blur, disposal, secondary
pointers, pitch clamping, on-demand rendering and XR orientation handoff were covered by Node tests.
Physical mobile and Quest testing, loaded-track browser gameplay, sustained 4K performance and
pixel-perfect render comparison were not performed. Existing finite background-plane coverage can
become visible when looking far to the side; this change adds camera orientation, not a new skybox.

`diff_export.ps1` was considered and skipped: no PR or complete diff snapshot was requested;
targeted `git diff` and `git diff --check` were used. Test servers were stopped after validation.

## Publication on 2026-10-19

The user requested deployment of this worktree. The production build and the same 479-test
affected suite above were rerun successfully; `git diff --check` also passed. The full suite was
not repeated, since its ten baseline failures were already recorded and no source changed.

The local clone's origin points to the original local checkout, so publishing explicitly targeted
the original repository's verified GitHub remote. GitHub Pages was confirmed to use `gh-pages:/`.
The existing publisher was invoked through Node after `npm run build`, avoiding the deploy
script's Bun dependency without modifying the package scripts or installing anything:

```powershell
node node_modules/gh-pages/bin/gh-pages.js --dist dist --repo https://github.com/philofobreal/plexus-engine.git --branch gh-pages --nojekyll --message 'Deploy XR 4K, browser look and authored defaults'
```

The publisher returned `Published`. Deployment commit: `e2bee086d1ff26d027cbbbebe35adea901410cdf`.
The previous Pages commit was `7eeb684d110039619236f8ff984722500767b2b9`.
Published XR bundle: `/plexus-engine/assets/xr-DYiggSt0.js`.

GitHub Pages reported `built` for this exact deployment commit. Live verification returned HTTP
200 for `/plexus-engine/`, `/plexus-engine/mvp/`, `/plexus-engine/xr/` and the XR JavaScript bundle.
The live XR HTML exactly matched `dist/xr/index.html`; the live bundle's SHA-256 matched the
validated local bundle. Publication smoke validation was HTTP and artifact comparison; no new
browser or physical-device run was needed for the unchanged source.

Status and live verification used `gh api repos/philofobreal/plexus-engine/pages/builds/latest`,
`Invoke-WebRequest` and SHA-256 comparison. GitHub and public-site checks required network access
outside the sandbox; the initial sandbox-only auth check could not validate the token, while the
network-enabled check confirmed the existing account and publishing succeeded. No new login was needed.

## Integration review on 2026-10-20

Independent code and documentation/test review found two desktop input regressions before master
integration: a held menu pointer could survive a keyboard/playback transition, and delaying primary
gameplay hits until release changed their timing relative to right-clicks. Menu opening, closing and
navigation now cancel the pending gesture. During play a primary press uses the current song clock
and shared ray/judge immediately; a successful hit owns the gesture, while an empty-space press may
become a look drag and never retries on release. Menu taps retain release activation.

Regression coverage now dispatches actual adapter pointer events through the facade, real ray
selection and gameplay judge; checks hit-versus-look ownership, delayed releases and held pointers
across menu navigation/start; and inspects the actual canvas text calls on every settings tab at
their authored font sizes. The ADR, feature description and acceptance criteria match this behavior
and the current single-plane background/defaults.

`npm run build` passed, and the full affected-suite command recorded above passed **484/484** tests
after these changes. No package or runtime fallback was needed. Combined Oracle validation and a
loaded-track browser smoke remain separate integration gates; the new review fixes have not been
republished by the earlier deployment.
