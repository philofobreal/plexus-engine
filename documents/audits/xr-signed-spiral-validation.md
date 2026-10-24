# T04a: preset-owned coherent spiral direction

Date: 2026-10-24. One integration owner: the agent in this chat.
This delivers T04a and an initial consumer seam; T04b is still a separate acceptance gate.
T02c's halo-menu follow-up is included without a separate deployment/pause, as requested.

## Contract and authoring

The user's clarification makes preset configuration authoritative wherever a feature is relevant.
For coherent grain/arm twist, author `visualTuning.wormholeSpiralDirection` in a preset JSON:
`-1` = left, `0` = straight, `+1` = right. Finite values normalize to [-1,1]; invalid values take
legacy +1. The ten factory Wormhole presets explicitly author +1, retaining their prior look.
Old presets with no direction load as +1 rather than inheriting a preceding left preset.
The dashboard's Wormhole control and existing full tuning copy/preset serialization include it.
Magnitude remains the existing nonnegative `wormholeSpiral`. Direction adds no macro/Advanced gain.

Relevance follows the existing material law: zero twist stays zero; disabled Grain material stays
disabled. This change does not turn either on. Path bend, camera orientation, local per-grain
currents and lens swirl retain separate laws. Arm density and weave consume coherent twist where
their existing geometry does so. T04b must finish the consumer inventory and matched history audit.

The pure plan adapter uses the separate explicit target permission `spiralMirrorable`; the old
path `mirrorable` permission does not imply it. Five existing Wormhole targets opt in. An optional
absolute point `spiralDirection: -1 | 1` selects a permitted pair variant at preset resolution,
without changing the preset file. Reapplication is idempotent. Without a point override, authored
preset direction wins. Foreign-identity automation cannot reset the Wormhole-owned field.

XR Material > Spiral direction defaults to Auto (preset/plan); Left/Right are explicit, persistent
player overrides. The existing version-1 localStorage record and human/JSON Copy settings contain
the choice. It changes presentation in place, preserving chart, score and playback. All new player
switches follow this menu/storage/copy policy; existing technical debug URL switches may remain.
Halo selection is now Visuals > Note halos > Off/Phrase; the old halo URL flag was removed.

## Ownership, time and compatibility

Config owns normalization, signed effective twist and morph math. Automation owns optional plan
direction/transfer; types own additive contracts; visuals consume the resolved sign; XR owns its
menu override and GPU uniform. No new audio, analyzer, semantic detector, score or clock owner.
The shared morph interpolates effective signed twist once through zero, then encodes magnitude
and direction. Unequal magnitudes do not create a second multiplication curve. Pause holds song
time; 30/60/120 Hz mathematical fixtures agree. Existing seek snaps remain existing behavior.
Full arbitrary playback/seek/export history equivalence is NOT claimed by T04a.

Plan/envelope version 1 keeps an additive optional field, validated and preserved by the transfer
writer. Old application readers may drop it. The spatial frame's existing numeric `spiralTurns`
domain expands from nonnegative to signed [-8,8]; frame shape and bundled worker protocol remain
unchanged. Main/worker and XR consumers ship together, with negative carrier and shader tests.
This is not a cross-version worker compatibility promise or the T05 exact-frame protocol.

The eight-row Visuals/Material tabs exposed overlap with the two-line hint. Row origin moves up
12 canvas pixels while preserving 38 px controls; existing reachability, fit and nonoverlap tests
remain active. No dependencies, source branch push, merge or unrelated baseline fixes.

## Validation and retained evidence

Exact commands and machine results are in [validation data](xr-signed-spiral-validation-data.json).
`npm run build` uses installed Node/npm, TypeScript and Vite; existing large-chunk warnings remain.
`npm test -- --test-reporter=tap` recursively runs cumulative regressions. Known failures count as
baseline only when both names and assertion messages match the previous nine-failure inventory.
`git diff --check` covers tracked edits. No goldens or measured analyzer results were regenerated.

251/251 targeted cases passed (signed math/preset/transfer, Visual OS permissions, settings/menu,
controller lifecycle, spatial source/GPU/worker, MVP gains and dashboard contracts). Initial full
run found six new discrepancies: five additive contract/source-review expectations and a genuine
menu overlap. Their corrections retain predecessor test bytes and historical source hashes;
[retention manifest](../tests/t04a-retention.json) identifies each replacement and its reason.
Historical archives are inert evidence, not executed tests. The original nine product failures
remain active and are not reclassified by editing assertions.

Completed cumulative run: 1613 cases, 1604 pass, nine exact retained baseline failures, zero
unexpected failures, zero skipped/cancelled. Final targeted rerun covers the preset Straight gate
and foreign-identity guard; final production build and whitespace check pass. Inventory retains
all 170 previous active test files plus the new signed-spiral suite (171 active files, 211 source
identities). The historical source-evolution manifest adds only reviewed type-contract identities;
original measured source snapshots/results and analyzer implementation remain unchanged.

Actual local browser automation verified Left persists after reload and Copy settings includes
both human direction and JSON direction plus halo. Isolated real renderer smoke shows -0.800 and
+0.800 turns at the same explicit 4 s song time, using the existing material-active Overdrive preset.
The harness warms only the existing playback fade with fixed song times; it does not introduce
a live clock. Choosing a material-disabled preset initially showed zero, correctly; production
material gates were retained. Local HMR history contains an intermediate missing-method error;
final production/live smoke must use a fresh page and record its own errors.
Raw logs/screenshots live under ignored `logs/t04/`; the small reproducible browser harness is
versioned at `tests/browser/wormhole-spiral-smoke.html`.

Deployment: publish the verified dist to the existing GitHub Pages target, including T02c; retain
the previous Pages commit and source/input hashes, then verify release marker, routes and asset
bytes. See [deployment data](xr-signed-spiral-deployment-data.json) after publication.

## Manual handoff and remaining gate

In XR, Visuals > Note halos > Phrase should show selected phrase-start rings; Off removes them.
Material > Spiral direction > Auto follows preset/automation; Left/Right choose coherent twist
when Grain material and Spiral twist are active. Reload and Copy settings should retain both.
These controls must not restart the song or clear score. The path and lens need not turn with it.

T04b remains pending: complete arm/weave/wall/lens inventory, matched raster/XR comparisons and
arbitrary seek/export/history evidence. Physical Quest stereo, readability and performance are
unmeasured. No new XR default is promoted. Stop after this deployment for manual feedback.
Rollback: publish the retained prior Pages tree in a new commit; choose halo Off/direction Auto
for player fallback. Remove only this slice's edits to revert source, retaining prior tasks.
Diff export is skipped: the bounded source review, patch and cumulative inventory provide this
handoff's evidence without generating a broad historical branch snapshot.

Preset Straight (`wormholeSpiralDirection: 0`) also disables automatic pair variation. An explicit
XR player Left/Right selection remains a manual override; Auto returns to preset/plan authority.

Final publication: release `t04a-preset-spiral-20261023T223102292Z`, Pages commit
`13967e8739b0ae070fded9d2257fd6496973b836`, parent `75bccd8b87f937d9bfa8630d6d8f98848901cd51`.
Pages built; release marker, three HTML entries, thirteen assets, four routes and a public preset
config verified. Fresh public WebGL/menu automation confirms persistent Left, selectable Phrase,
and both human/JSON settings fields in Copy settings. These are desktop results, not Quest proof.

Fresh public synthetic audio smoke: the retained 7 s / 128 BPM fixture produced nine notes and
played to Results (no human hits; nine misses). Console error log empty. The test Left choice
was restored to Auto for handoff. This is not a human hit-precision or full pause/seek/export run.
All 318 deployed source-input hashes still match the checkout after publication.
Publisher fallback: `node node_modules/gh-pages/bin/gh-pages.js -d dist --nojekyll -m 'Deploy T04a: preset spiral direction and persisted player controls'`.
