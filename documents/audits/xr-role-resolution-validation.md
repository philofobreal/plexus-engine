# T02a: minimal role sidecar and resolution notifications

Date: 2026-10-23 (Europe/Budapest). Integration owner: this chat's agent.
Source base: `effd6db7d268fd318dbcd4dbb1bec18e268a5441`, branch `codex/xr-development-baseline`,
with the accepted T03 working-tree patch retained. This is the T02a review slice approved in
the [T01 plan](xr-development-plan.md); T02b will follow only after manual feedback.

## Selective PR comparison and scope

Reference PR 8 head: `6ef28d1a56fcacf5f8dfdc046f0816e816bcbcdf`, base/merge base
`29371e4fd65b5fc9defa6ebb4bca0b1488ed5e14`. Compared the exact patch and current session,
controller/scene and PR WorldTypes/WorldDirector/XrNoteHalos sources. Current session matches
the PR base ignoring line endings; controller/scene have later changes (+154/-26 combined).
No whole branch merge or replacement of those later modules is appropriate.

Adapted the note-id sidecar and notification-only observer, including the implementation's
four-argument callback rather than its ADR's index description. The sidecar is a tiny standalone
version-1 plain-data plan; it accepts explicit assignments and does not import or instantiate
WorldDirector/WorldPlan, eras, structures, Seeder/Fenom or outcome logic. It retains the four
role names without inventing their future musical or scoring meaning. T08 selects that policy.

The PR directly invokes callbacks during mutation and passes the chart note reference. This
adaptation defers dispatch until the public operation finishes, copies/freezes each notified
note, rejects reentry through mutation/cursor APIs and detaches a throwing or async consumer.
The existing judge/scoring equations, section bonuses, practice-seek behavior and clock remain.
Contract, limits, failure semantics and caveats are in
[ADR-009 Addendum AI](../adr/ADR-009-xr-rhythm-game-host.md#addendum-ai-minimal-role-and-resolution-contracts-2026-10-23-t02a).

T02a does not install a consumer in the XR application. Renderer/controller generation cleanup,
bounded instanced halos and dispose are T02b. No new visual, role-selection UI, World narrative,
worker message, saved setting, dependency, preset or analyzer algorithm is introduced here.
No predecessor regression, research program or historical assertion was removed/rebaselined.

## Validation

- `node --test tests/rhythm-resolution.test.mjs tests/rhythm-session.test.mjs tests/rhythm-scoring.test.mjs tests/gameplay-purity.test.mjs`:
  PASS, 55/55, including 27 new cases. Deterministic capped role plans, stale-id filtering,
  hit/miss/finish idempotence, reset ordering, forward/backward seek, chart reload, score parity,
  frozen payload, fault detachment/recovery, 13 reentry APIs and rejected async callbacks covered.
- `npm run build`: PASS (`tsc && vite build`); existing chunk-size warning only, no new dependency.
- `npm test -- --test-reporter=tap`: 1586 cases, 1577 PASS, nine existing failures, no unexpected
  failures (270964.7585 ms). Compared exact test names/locations and assertion messages with T03/T00;
  only reporter prefixes and per-line indentation are normalized. All numeric/message content
  matches the retained baseline. The three sandbox-only baseline failures are absent outside sandbox.
  Full suite is still non-green; none of the nine preset/motion assertions was silenced.
- `git diff --check`: PASS. Cumulative discovery retained all earlier tests and added 27 cases.

Compact validation and exact failure inventory: [validation data](xr-role-resolution-validation-data.json).
Raw TAP/build logs: `logs/t02a/tests.tap` and `logs/t02a/deploy/build.log` (hashes in that data).
The deployment build was repeated after the final explanatory source comment edit to bind the
release manifest to the final input bytes. No functional source edit followed the passing checks.

Node v25.2.1/npm 11.6.2; project Node/npm build/test scripts used. The installed gh-pages Node
entrypoint is used for deployment because the existing package deploy script invokes Bun.
Full tests/network publishing run outside sandbox to avoid known Temp/Git/network restrictions.
No package script or runner migration. No new wall-clock CI assertion or performance claim.

## Deployment

The existing target was rechecked before publishing: GitHub Pages, `gh-pages` branch root,
`https://philofobreal.github.io/plexus-engine/`, HTTPS enforced, no CNAME. The user has explicitly
authorized deploy after each task; no source push/merge, hosting migration or DNS change is implied.

Command: `node node_modules/gh-pages/bin/gh-pages.js -d dist --nojekyll -m 'Deploy T02a: role sidecar and safe resolution notifications'`.
Result: Published. Pages commit `ade5aedf53ba3b4f17413c0860e89e224983169d` has the verified previous
T03 release `665a608ba0f75958c9d69647fff53bc7e3edbfaa` as its parent; no force push/history reset.
Release identity: `t02a-role-resolution-20261023T211826731Z` at the public `release.json` marker.

Before publication, all three entrypoint asset references were resolved and the concrete XR bundle
was checked for the notification/reentry guards. The release manifest records the base commit,
dirty-tree status, tracked application patch hash and SHA-256 manifest of all 316 build source
inputs, including the new untracked role module. Changed application source copies, the input
manifest, patch and build are retained under ignored `logs/t02a/deploy/`; release metadata contains
relative paths/hashes only.

Pages API: `built`, no error, exact release commit. Fetched the public release marker and verified
the exact SHA-256 of all three entry HTML files and 13 JS/CSS/worker assets; root, MVP and XR direct
routes returned 200 and matching HTML. Desktop in-app browser reload rendered the actual WebGL
stage; Settings > Visuals opened and retained the previous 500 m selection. Captured console error
log was empty. No audio loaded and no immersive WebXR supported in that browser; no physical Quest
or manual gameplay acceptance claimed. Screenshot: `logs/t02a/deploy/live-smoke.jpg`.

Compact public/API/browser proof: [deployment data](xr-role-resolution-deployment-data.json).
The source branch is still uncommitted/unpushed; the live release explicitly records the dirty
application tree. The cumulative validation inventory retains 169 active test files and 207
test/helper/fixture identities, hashed at `logs/t02a/test-inventory.json`. T02a is ready for the
manual handoff below. T02b/T04 and later feature work has not started.

## Manual handoff

After deployment, use the public XR page and reload it before testing. No halo is expected in
this slice. Load a usual test track and check Play, successful hits/misses and scoring, Pause /
Resume, Restart, natural end, seek if exposed, then load another track and regenerate choreography.
The run should behave as before, with no stale notes, duplicate score or unresponsive controls;
also verify the previously delivered 500 m setting remains selectable/persistent. Desktop browser
smoke is recorded separately and does not substitute for these audio/physical Quest checks.

Fallback: no observer and an empty role plan. Source rollback reverts only T02a gameplay changes
and removes its role module; retain T03 changes and historical evidence. Public rollback restores
the previous verified Pages tree in a new commit. Do not force-push or reset Pages history.
