# T02b: role lifecycle and bounded halo integration preview

Date: 2026-10-23, Europe/Budapest. Single integration owner: this chat's agent.
Base source `effd6db7d268fd318dbcd4dbb1bec18e268a5441`, branch `codex/xr-development-baseline`.
Accepted T03/T02a changes retained. T02a continuation was accepted by the user; stop again after
this task's deployment and concise expectation/manual-test handoff. T04 and later work not started.

## Scope and ownership

Adapted PR 8 exact head `6ef28d1a56fcacf5f8dfdc046f0816e816bcbcdf`'s bounded instanced reticle,
retaining current controller/scene changes. XR owns the scene, render resources and generation
seam; gameplay retains the existing T02a plan/observer and sole judge/score. No WorldDirector,
WorldPlan, encounter/structure/era/outcome runtime, analyzer, worker protocol or dependency change.
No historical test/assertion/research artifact removed, excluded or rebaselined.

`XrNoteHalos` is a separate ring/tick mesh with a fixed 16-instance/burst pool. It follows the
canonical note positions, current speed, spawn fade and shared track bend. Hit effects follow
accepted session notifications and survive active-note expiry; misses dim, skipped notes do not
burst. Plan changes and run resets clear stale effects, including when chart ids are reused.
The controller clears roles before async preparation/load, publishes only under the accepted
generation token and detaches before dispose. Consumer failure hides halos while gameplay runs.
Details/limits/rollback: [ADR-009 Addendum AJ](../adr/ADR-009-xr-rhythm-game-host.md#addendum-aj-role-lifecycle-and-bounded-halo-preview-2026-10-23-t02b).

Production default remains off: normal URL has neither roles nor an installed observer. The
separate `?xrHaloPreview=1` URL marks existing phrase starts as white signal markers at least
1.5 song seconds apart. It does not synthesize phrases/beats or finalize T08's musical meaning,
colours, bonuses, cockpit fit or tuning UI. It is an integration preview, not production promotion.

## Validation

- `npm run build`: TypeScript and Vite pass; existing large-chunk warning only. A first build
  found missing contextual callback parameter types; the observer's generic type was corrected.
- `node --test --test-reporter=tap tests/xr-note-halos.test.mjs tests/xr-controller-regeneration.test.mjs tests/rhythm-resolution.test.mjs tests/gameplay-purity.test.mjs tests/xr-note-gpu.test.mjs tests/xr-slice-gpu.test.mjs tests/xr-track-path.test.mjs tests/xr-background-settings.test.mjs`:
  112/112 pass. Twelve new cases cover the real halo, score parity, canonical row/path/speed,
  instance upload caching/limits/overflow, retained and idempotent hits, skipped/reset/seek,
  reused ids, disposal, default-off, stale regeneration/load, failed consumer and late disposal.
  Two initial new-test harness mistakes (bend helper argument order, frame callback signature)
  were corrected against their existing definitions; no predecessor assertion was changed.
- `npm test -- --test-reporter=tap`: 1598 cases, 1589 pass, nine retained baseline failures,
  zero unexpected failures, 374012.4495 ms. Exact names/locations/assertion messages match T00/T03
  (reporter prefix and line indentation normalized only). The full suite remains non-green.
- Final normal-mode optimization attaches no observer when preview is off. After this one-line
  change, `node --test --test-reporter=tap tests/xr-controller-regeneration.test.mjs tests/xr-note-halos.test.mjs`
  passed 29/29 and the production build passed again. No further functional edits.
- `git diff --check`: PASS. [Compact results and failure identities](xr-halo-lifecycle-validation-data.json).

Node v25.2.1/npm 11.6.2, declared Node/npm build/test scripts. No Bun-first execution. The Pages
deploy uses the installed gh-pages Node entrypoint because package deploy invokes Bun. Full
regression/network/hidden preview helper use the already-required sandbox escalation, with no
auto-review rejection. No package/dependency/runner migration or benchmark threshold assertion.

## Browser evidence and limits

Production build served locally by Vite preview at port 5174. Loaded a generated mono PCM16 WAV
of the existing deterministic `house-128` fixture: 7 s, 44100 Hz, 617444 bytes, SHA-256
`d6b0d3d70e0907b6a5568e81156db9bd1cbdbe803db67a62243f6acf04a7350c`.
Generator: `node scripts/write-audio-smoke-fixture.mjs logs/t02b/halo-smoke.wav`; exclusive create,
no golden writes. Real decode/analyzer publication/plan/chart produced BPM 128, nine directional
notes and one pair; playback reached Results with nine misses, zero points, no console error.
This verifies wiring, not annotated musical accuracy or human-play acceptance.

The short song's transient halo is verified separately with the versioned
`tests/browser/xr-note-halo-smoke.html`, served by the existing Vite dev server. This isolated
page imports the real Three/halo/note/session modules, renders at explicit fixed song times and
offers Pending/Accepted hit/Miss/Seek past/Restart controls. No independent live clock or test
module is installed in the application or packaged by the production build. Actual WebGL
screenshots show white ring/ticks, an accepted-hit expanding ring (one hit, 100 points), a dim
miss (zero hits, zero points), zero halos after seek, and a clean pending halo after restart.
Captured error logs empty. Screenshot artifacts: `logs/t02b/halo-pending.jpg`, `halo-hit.jpg`,
`halo-miss.jpg`. Node pose tests separately cover shared bend, row/offset and configuration parity.

Physical Quest stereo/clipping, human hit timing/readability and sustained CPU/GPU/overdraw/memory
remain unmeasured. No performance speedup claimed. No private/user music used or transmitted.
The generated WAV/logs stay outside source control. Diff snapshot script not used; direct scoped
Git diff/source review preserves the dirty working tree and all prior work.

## What the user should expect / manual checks

Open the halo preview link after deployment, load a usual track and press Play. Some phrase-start
notes have a thin white circle with four ticks. The circle travels with the note, briefly expands
on an accepted hit and dims on a miss. Hand colours/arrows, hit detection and score stay the same.
Pause/resume should freeze/continue the same effect; restart, another track or regeneration must
not leave old rings or bursts. The normal URL keeps the previous appearance. T08 will decide the
final role meaning and cockpit fit; do not expect bonuses or world-building mechanics here.

Rollback: remove the query parameter (normal default off), or restore the previous Pages tree in
a new commit. Source rollback removes only T02b XR modules/wiring, preserving T02a/T03/evidence.
No storage migration; do not force-push Pages history or reset unrelated local work.

## Deployment

Published with `node node_modules/gh-pages/bin/gh-pages.js -d dist --nojekyll -m 'Deploy T02b: bounded halo lifecycle preview'`.
The verified existing target is `https://philofobreal.github.io/plexus-engine/`, branch `gh-pages`,
path `/`, HTTPS enforced, no CNAME. Previous release is T02a
`ade5aedf53ba3b4f17413c0860e89e224983169d`; no source push/merge or DNS/hosting migration.
Release marker: `t02b-halo-lifecycle-20261023T214715168Z`.

Validated all three entry asset references and the halo/guard markers in the concrete XR bundle
before publication. The manifest records the dirty source base, application diff hash and hash
manifest of 318 build inputs, including all new untracked modules; 12 changed application source
copies retained with patch/manifest/build logs at `logs/t02b/deploy/`. Generated smoke WAV and the
isolated browser harness are not production assets.

Pages commit `75bccd8b87f937d9bfa8630d6d8f98848901cd51`, verified parent T02a `ade5aed`;
Pages API status built with no error. Public release marker matched; root/MVP/XR and the explicit
halo query route returned 200 with matching HTML. All three HTML and 13 JS/CSS/worker hashes
match the concrete dist. The source branch remains uncommitted/unpushed with explicit provenance.

The public preview URL loaded the same synthetic WAV through the real decode/analyzer/plan/chart
path, produced BPM 128/nine arrows/one pair and played through to Results (zero hits, nine misses,
zero points). Captured errors empty; screenshot `logs/t02b/deploy/live-smoke.jpg`. Transient halo
pixel states are evidenced by the isolated real-WebGL page, not claimed from that Results image.
No physical Quest or human-track acceptance is implied. A file-chooser tool operation was slow;
it was not a controlled decode/render latency measurement and no timing result is inferred from it.

[Compact deployment proof and artifact hashes](xr-halo-lifecycle-deployment-data.json).
Cumulative inventory retains 170 active test files and 209 test/helper/fixture/browser-harness
source identities. Raw manifests/logs at `logs/t02b/`; the new browser harness and audio-WAV writer
are versioned reusable tools, while generated WAV/images/logs remain ignored artifacts.

User-facing preview: `https://philofobreal.github.io/plexus-engine/xr/?xrHaloPreview=1`.
T02b is ready for manual testing. No subsequent feature task has started.
