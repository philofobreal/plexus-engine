# T06d: native stars, galaxies and forward sky

User accepted T06c2 and requested the next task. The native presentation now includes the
original star/galaxy pools and a bounded sample of the existing sky. One integration owner;
no subagents, dependencies, package/lockfile, analyzer, audio, chart or judge changes.

The shared identity emits preprojection metre coordinates, original colours and brightness,
route travel/heading and stable pool IDs into an optional native cosmos field. Sky is an explicit
finite forward directional plane (1200 m source horizon), not a surrounding full-sphere scene.
It samples every sixth original sky entry: 1500/9000, with optional dust. Stars: 1800; galaxies:
nine with nine faint echoes. At most 4818 records. Lens/membrane/refraction/optical deep-field
remain separate T06e/f deliveries, not hidden image passes. Native remains experimental.

The producer stays in the T06c2 canvas-free worker. The unchanged 437760-byte grain/weave/material
bank travels with one additional fixed 308352-byte cosmic buffer under the same request lease.
Both are copied into one pending bank and returned before the next request; displayed buffers
remain owned by the host. Generation/epoch/presentation revision/song time invalidate stale data
atomically. Missing optional cosmic data clears instances. Existing main fallback and diagnostics
apply, including the retained technical `xrBackgroundThread=main` A/B override.

`NativeWormholeCosmos` owns one instanced draw, fixed attributes and procedural soft discs/streaks.
It fits source geometry uniformly to the selected 40-500 m horizon, preserving angles/relative
depth. Stable quality strides reduce stars/sky; galaxy count stays bounded at 18. Per-eye core/dust
half-width caps are 2.5/5 px, galaxy 96 px, streak 24 px. Near gameplay clearance applies; depth
write is disabled and the batch draws before grains, runway, notes and transparent HUD.

Cosmos menu exposes Stars 0-200%, Galaxies 0-200%, Sky 0-100%. These existing user-global
masters apply after private preset/gain resolution; presets still own motion/geometry/material.
The controls work in Hybrid and Native, normalize old records, persist and appear in Copy settings.
Stars/galaxies default 100%; Sky 0% preserves the previously disabled sky feature flag. Nonzero
Sky enables the original pool only in this embedded XR host; Studio/MVP defaults and the old
technical flag stay untouched. Settings are presentation scope and do not regenerate a chart.

See [contract](xr-native-cosmos-contract.md), ADR-009 Addendum AN and the
[generated evidence](xr-native-cosmos-validation-data.json).

## Validation

Node v25.2.1, npm 11.6.2. Exact commands and hashes are in the generated evidence.

- `npm run build`: TypeScript and Vite pass, standard large-chunk warning.
- Targeted native/worker/material/weave/settings/menu, shared context/clock/determinism/exact-frame,
  boundaries, styles/transitions and MVP integration: **326/326**.
- Compatibility follow-up: **26/26**, including retained authored timing provenance.
- `npm test -- --test-reporter=tap`: **1692 tests, 1683 pass, 9 exact T06c2 baseline names/messages**, no skipped/cancelled tests. Final full run 339935.705 ms; targeted 92999.6477 ms.
- `git diff --check`: pass; existing LF-to-CRLF notices are informational.

All 180 predecessor active test files retained. Two exhaustive defaults/presentation assertions
were extended only for the three masters (100/100/0), with predecessor archives and reviewed
identities. Nine new semantic cases in a new active test file. Fourteen implementation/test
predecessors retained. The protected loader is unchanged. The current source-evolution review
updates only the optional CanvasVisualPresentation field hash, retains its superseded review and
the entire prior manifest, and never rewrites measured analyzer source/results or timing goldens.

Initial logs remain available: default-expectation extensions, disabled old sky flag, and test
module-worker injection were resolved before acceptance. Minimal retained identity adapters lacked
the new sky method; the feature now invokes it only when Sky is explicitly set, preserving old
host behavior. Initial full-run temp preset rename and temporary Git config were sandbox-denied;
the complete final suite uses approved filesystem escalation with unchanged Node/test programs.
Initial runs are not reported as successful or classified as baseline.

Real WebGL/module worker: four forward/backward/revisited samples have **zero float and pixel
differences**, matching counts and focal/spatial companions; immutable analysis retained.
All layers are independently visible: Stars 316 lit pixels, Galaxies 19497, Sky 1158. Zero controls
remove their own families. Stereo probe at 64 mm eye spacing: near disparity 2.059 px, far 1 px.
Opaque and transparent stage-priority probes cover the cosmic light completely. Oblique view and
quality reduction pass. Fixture: **3 draws, 17048 triangles, zero textures, 4337 cosmic instances**.

32 desktop samples after eight warmup samples: worker producer p50/p95 **6.7/8.8 ms**;
main request/adoption **0.1/0.3 ms**, transfer copy **0.1/0.2 ms**, attribute copy **0.6/0.7 ms**,
worker roundtrip **7.5/9.7 ms**. Raw samples retained. These include the added layers; no same-device
Quest before/after or GPU timer claim. Timer-rounded low values are not zero work. GPU fill,
copies and worker CPU remain costs; lower quality or layer masters are available for manual tuning.

Local UI: seven readable tabs; edited 80/120/10 masters survive reload; Sky visibly enables in Hybrid.
Copy settings success toast observed, report contents covered by semantic tests. Automated OS
clipboard readback again returned old unrelated text, so actual paste remains manual. Original
100/100/0 values restored. No browser warnings/errors.

## Deployment and manual gate

Pages **a4d8484a49d44699f4020ab278cba7bc9c957aa8**, parent **7c55d56dfbb96c21505e0c07ba96966bd43f2729**, release **t06d-native-cosmos-20261024T101231797Z**.
[Public XR](https://philofobreal.github.io/plexus-engine/xr/?release=t06d-native-cosmos-20261024T101231797Z). 17 HTML/assets including worker, 4 routes and 335 unchanged build inputs verified byte-for-byte. Exact Pages build is built. Public native play/pause, worker diagnostic, edited Cosmos reload persistence and Hybrid restoration pass with no warnings/errors. [Deployment evidence](xr-native-cosmos-deployment-data.json).

Publisher fallback: `node node_modules/gh-pages/bin/gh-pages.js -d dist --nojekyll -m "T06d: native cosmic layers and persisted Cosmos controls"`,
because the package deploy script invokes Bun. No source/default-branch push, merge, force push or
dependency change. Release tooling checks prior Pages ref, input/asset hashes and validation before
publication. Public bytes/routes, Pages build identity and real UI are recorded separately.

`diff_export.ps1` was considered and omitted: scoped review, immutable source archives, cumulative
identities, full changed-source snapshot and build-input manifest cover this handoff without a fetch.
Python analyzer research tests were not rerun: no DSP/timing/analysis algorithm changed; the full Node
suite retains authored timing replay/provenance. Encoded export and physical Quest are unmeasured.

Manual expectation: select System > Native grains. Original stars and soft distant galaxies now
surround the visible tunnel; Cosmos > Sky adds the distant forward star plate. Check each zero/nonzero
master, reload/Copy paste, same-track head-motion pacing, stage/note readability, pause/resume and
Hybrid restoration. Sky and galaxies add GPU fill; no guaranteed headset speedup. Native wall and
optics are still later tasks. Rollback: zero layer masters, choose Hybrid, or republish the retained
T06c2 Pages tree in a new commit without force push. Stop here for feedback before T06e.
