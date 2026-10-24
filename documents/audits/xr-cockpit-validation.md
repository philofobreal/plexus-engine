# T07 cockpit and fixed-width filename marquee validation

Status: implementation, build and desktop gates pass; Pages **08d0c8875fdba2394c5763f2626eba7a60df14ae**, parent **be4bc071b8bb671631f506ac3c38f1b65af49f26**, release **t07-cockpit-20261024T115025210Z**. [Public XR](https://philofobreal.github.io/plexus-engine/xr/?release=t07-cockpit-20261024T115025210Z). Exact Pages build built; 17 HTML/assets, 4 routes and 339 unchanged source inputs verified byte-for-byte. Public menu/reload/Copy, fixed-width long filename play/pause, Off and restored Full/Scroll pass; no warnings/errors. [Deployment evidence](xr-cockpit-deployment-data.json).

## Behavior and boundary

The supplied [reference](../references/xr-cockpit-user-reference.png) is retained; pictured words are ignored. The cabin has a wide chamfered opening, dark upper/side ribs, floor returns and narrow cyan/magenta/white trim. This is a procedural unlit interpretation, with no reflections, realtime shadow or additional bloom. XrCockpit is owned by RhythmGameScene under its stage root. Layout/recenter changes refit it; the head never drives camera shake/roll or per-frame cabin motion. Desktop's rearward camera origin is applied once; immersive entry uses the actual stage origin and exit restores preview placement. Stage layout and current gameplay configuration determine clearance.

The upper central panel displays the exact selected filename including extension, inside a fixed **2 m x 0.22 m** plane. XrTrackMarquee converts plain Unicode text to one bounded atlas only on filename changes; GPU UV movement clips scrolling to the panel, including atlas-row crossings. Empty title is hidden. Maximum 256 codepoints, line controls replaced, maximum atlas 2048 x 512 RGBA (4 MiB), no font/network request. Scroll uses existing song time: pause holds position and seek replay is deterministic. No new musical clock, analyzer, worker, gameplay or score logic.

Cockpit tab: Full / Reduced / Off, Track title Scroll / Static / Off. New appearance defaults Full/Scroll; old/malformed settings normalize, both descriptors have presentation scope and survive localStorage/Copy. Reduced keeps the frame and title but omits secondary ribs/returns; Off is the previous open stage and hides every cockpit draw. Nine tabs remain readable through compact labels. Wall remains Off and galaxy glows 0 after the separately deployed T06e2 fix; further Wall/T06f work stays deferred by user instruction.

## Checks and costs

125/125 targeted tests pass: eight new cockpit tests plus one additive actual controller case. Tests retain all 183 earlier active files, add one (184 active), preserve seven source/test archives and review two additive test extensions (exhaustive defaults; scene-double hooks plus new integration assertion). All old assertions retained; protected loader and accepted timing manifest unchanged. Full cumulative verified: 1718 / 1709 pass / nine exact baseline failures, no skips or cancellations. Machine reducer passed before publication. Build passes TypeScript and production Vite; ordinary chunk warning. Initial test run 40/40; initial build caught an unused field and unsupported parameter-property syntax, both corrected without changing compiler settings.

Actual geometry raycasts cover 24 speed/saber/play-space combinations at two eye heights, note rows/lanes at four depths, both horizontal head offsets and extreme path focus; more than 1000 clear note rays. Caption bounds fit both logical desktop/immersive forward views, unchanged inputs reuse geometry, recenter remains stage anchored, every watched GPU resource disposes once. Actual controller file selection supplies song.wav, live cockpit/title controls save without chart regeneration, playback stop or plan recomputation.

The [reusable GPU program](../../tests/browser/cockpit-smoke.html) uses real Three.js modules and a real WebGL renderer. Isolated Full: three draws / 590 triangles / one caption texture (524288 bytes for fixture). Reduced: three draws / 254 triangles. Off: zero draws. Four logical headset/offset views and a desktop view visibly render the cabin. Long Unicode caption changes 31680 pixels while staying within x=53..586 inside the fixed plane; static, atlas-row seam, paused repeat and seek replay pass. No per-frame upload/version change. Sixteen filename replacements keep the expected three total renderer textures (two live captions in the harness plus its render target), without accumulation. Production owns one title texture. No console warnings/errors.

32 samples after eight warmup at 640x360: desktop update/render submission Off p50 timer-rounded 0 ms / p95 0.1 ms; Full p50 0.1 / p95 0.5, max 0.6 ms. This is synchronous CPU submission only, not GPU execution, complete game frame pacing or a physical Quest performance claim. The additional draw/fill cost remains. Physical Quest head movement, recenter/re-entry, saber reach, caption readability and comfort are manual gates.

Local UI: Full/Reduced/Off, Scroll/Static, all nine readable tabs, edited settings reload and Copy success pass; exact long Hungarian filename appears clipped, scrolls during playback, pauses and reaches Results normally. Defaults restored Full/Scroll; actual OS clipboard paste remains manual. Public smoke follows exact release deployment.

## Exact commands and evidence

```powershell
npm run build
node --test --test-reporter=tap tests/xr-cockpit.test.mjs tests/xr-settings.test.mjs tests/xr-controller-regeneration.test.mjs tests/xr-menu.test.mjs tests/xr-play-profile.test.mjs tests/xr-track-path.test.mjs tests/xr-background-settings.test.mjs tests/xr-note-design.test.mjs tests/xr-note-halos.test.mjs tests/gameplay-purity.test.mjs tests/xr-wall-default-off.test.mjs
npm test -- --test-reporter=tap
git diff --check
node scripts/audit-cockpit.mjs
```

Full tests use filesystem escalation because prior cumulative runs established sandbox temporary preset rename and temporary Git configuration restrictions; no test/runtime changes. Node gh-pages entrypoint replaces the Bun-dependent package deploy script; no dependency/lock/script change. Research HTML initially did not initialize through absolute Vite source imports; relative source imports fixed that harness, final real GPU checks pass. Compact evidence, artifact hashes, active test identities and baseline comparison: [machine results](xr-cockpit-validation-data.json). Raw logs/screens under logs/t07. Scoped source archives/build input manifest substitute for a broad diff export. No source-branch/force push.

## Manual gate and rollback

Test the same track in Quest: cockpit Full/Reduced/Off, title Scroll/Static/Off and long filename; title clipping and readability; Standard/Tall note/HUD/saber clearance; head turns, recenter/re-entry, pause/resume; settings reload and Copy/paste. Keep background Wall Off. Rollback Cockpit Off or publish retained T06e2 Pages tree in a new commit. Stop after T07 deployment for user feedback before T08.
