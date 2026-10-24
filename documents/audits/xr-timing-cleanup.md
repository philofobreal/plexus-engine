# T10 timing cleanup

2026-10-24. Integration owner: this chat (audio, analyzer/worker, XR UI/settings, tests, docs/build). The user's explicit deletion request supersedes retention of the new unsuccessful T10 artifacts; no unrelated T00–T09 work or original audio was deleted.

## Decision

- Remove the new Timing tab, all player timing experiment choices and XR timing query overrides. Keep the established algorithm-7/hop-1024 path. Saved eventTiming fields are stripped without resetting other preferences; storage failure still normalizes safely.
- Remove Q3 implementation, identity, prototype, experiment-only tests, generated reports and task-specific capture/audit/finalize/publish programs. Undo mutable analysis-policy setter and same-file reload machinery. Existing v1/v2 analyzer-lab code/tests predate this feature; neither is promoted or exposed in XR.
- Keep the equivalent Band sample-bucket lookup with boundary/order/metadata/complexity and complete-output tests. Reuse the existing measured predecessor source instead of copying full source trees.
- Delete 1534 generated/redundant files (about 153 MiB), including 202 copied predecessor sources and 1122 release source copies. A small current-run log directory holds test output; no new complete source snapshot is made.

## Measurement interpretation

Fresh replay of all 336 existing tonal controls reproduces v2 8 versus Q3 20 false refinements. Q3 is worse and removed. Earlier nine-excerpt common-model agreement was unchanged (550→550); these are development pseudo-labels, not musical accuracy, beat, tempo or structure truth. Do not select a production mode from those counts. No published accuracy improvement or headset performance claim survives this cleanup. The older independent test/reference corpus remains unchanged.

Fresh full analyzer and Band comparisons on all nine exact original-PCM excerpts are bit-for-bit equal with the linear and bucket searches, including all accepted event times. 112 authored Band transfer conditions and deterministic crowded/sparse matrices cover the retained optimization. No audio file is published.

## Validation and release

Build and diff check pass. Targeted **99/99**; full **1750 tests / 1741 pass / nine exact pre-existing failures**, zero skips/cancellations. Names and assertion messages compared against the previous baseline. Local real Scienide decode/worker/play/pause and Copy checked: stable 824 notes/781 arrows/56 pairs, retired field absent, other settings equal, no console warnings/errors. Q3-only coverage was explicitly removed with the rejected feature; functional baseline tests remain. Current-run logs: logs/timing-cleanup/.

Commands: npm run build; npm test -- --test-reporter=tap; node --test --test-reporter=tap with the explicit timing/settings/controller/worker/normalizer/Band suites (99 tests); git diff --check. Runtime Node 25.2.1/npm 11.6.2. Publishing uses the installed Node gh-pages entrypoint because the package deploy script depends on unavailable Bun. No dependency installation, source branch push or force push. Python pytest remains unavailable; no Python inference change is included. Physical Quest latency/FPS is unmeasured.

Deployed 74c57b8b78ed10fac7da90b7b2ccc207aec432bc, release t10-cleanup-20261024T175407067Z. All 53 public files and three entry routes verified; 32 copied public text files match after Git CRLF/LF normalization, all other bytes exact. 344 source input hashes unchanged. Public Scienide analysis/play/pause/Copy and preference preservation pass, no console warnings/errors; stable 824/781/56 chart even with old Q3 URL. [Live XR](https://philofobreal.github.io/plexus-engine/xr/?release=t10-cleanup-20261024T175407067Z). No source/force push.

The user explicitly authorized proceeding to T11 after this cleanup. Continue only with the stable sample-clock/evidence contracts, without promoting unvalidated vocal/tonal detections.
