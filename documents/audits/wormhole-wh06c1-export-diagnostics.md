# WH-06c1 — export diagnostics and explicit FPS

Date: 2026-11-08, Europe/Budapest. Integration owner: this chat's agent.
Predecessor: `a76317aed3f123245ac11961c601853b1e0060c6`.
Status: implementation and cumulative/local validation complete; manual acceptance pending. Release identity and public receipts are retained in the session checkpoint and `logs/wh06c1/final-*.json`.

## Problem and result

The user's Samsung S22 Ultra/Android Chrome runs normal WebM/H.264 MP4, but
the two tested **4K60 VP9 10-bit** variants fail. The previous Copy contained
only settings/cache, so it could not distinguish unavailable encoding, a
decoder gate or an actual probe failure. Desktop VP9 10-bit MP4 quality is
accepted as the reference. It is not established that every mobile resolution
or FPS is unsupported, nor that a particular Task Manager engine label identifies
the browser's codec implementation.

The shared probe now observes encoder and decoder support independently before
a 10-bit rejection and records the actual three-frame encode/decode counts.
The MP4 container trial records its one encoded packet and emitted codec string.
The existing strict acceptance and output validation stay in place. Reports
describe a probed configuration; they do not prove GPU/CPU selection, physical
phone compatibility or long-export stability. MP4's final container-only trial
can report decoder `not-required`; the preceding common 10-bit trial separately
reports its actual decode gate. Every report remains available in Copy.

MVP and dashboard offer **30 or 60 fps**, saved locally under
`plexus.export.fps`, defaulting to 60. Changing FPS is explicit and preserves the
chosen resolution/bit depth. Controls lock during the active job. Copy separates
current selections from last-attempt selections, includes support/probe/error
reports and the browser user-agent/version string, and keeps existing cache
information. The on-screen summary names the last checked codec, dimensions,
FPS, support states, stage and counts. No diagnostic history is persisted or
automatically sent anywhere.

## Ownership, bounds and unchanged contracts

- Export owns the dependency-light diagnostic schema, validation and producer.
  UI owns last-attempt journal, storage preference, display and clipboard.
- `ExportWorkerResponse` gains optional `export_diagnostic`. Inputs and transfer
  contracts do not change. Backend validates/copies the flat allowlist, checks
  worker identity/cancellation; facade and UI check current-job identity.
- The journal retains twelve bounded reports and one bounded failure; snapshots
  own their values. Unknown fields, PCM, analysis, track paths and binary codec
  descriptions are excluded. Observer exceptions cannot affect job completion.
- Existing exact Offscreen/GPU render, PostFX barrier, precision, bitrate/GOP,
  PCM buffer bounds and progressive OPFS storage remain. No complete movie is
  collected into RAM by diagnosis. FFmpeg WASM still copies video and encodes
  AAC/muxes MP4; no new video encoder, dependency or WASM memory policy is added.
- Existing MP4 default, MVP mobile 4K and saved format choice remain. No 10-bit
  failure silently becomes 8-bit. The original legacy dashboard mobile-resolution
  policy is unchanged; the Samsung acceptance workflow is in MVP.

## Validation and retention

The [predecessor manifest](../tests/wormhole-wh06c1-predecessor.json) binds
original source/test/research identities. Three existing fixture interfaces
adapt to the additive observer/diagnostic fields and real diagnostic module
while retaining their original behavioral assertions. Existing tests, baseline errors, numeric image gates,
goldens, rejected inter-frame experiments and the original exact-source test body
remain active and unchanged in meaning.

New Node cases cover encoder-versus-decoder refusal, query exceptions/missing
APIs, actual encode/decode counts and failures, no allocation before rejection,
closure, observer exceptions/mutation, malformed/stale worker messages, bounded
journal ownership, FPS/storage failures, current-versus-attempt Copy and both
host controls. The retained browser export matrix also checks actual diagnostic
messages across WebM and MP4, including strict 10-bit counts. `runWh06c1` checks
real DOM/localStorage/clipboard wiring with an explicitly simulated refusal.

Commands:

```text
npm run build
node --test tests/export-diagnostics.test.mjs tests/export-preparation.test.mjs tests/export-lifecycle.test.mjs tests/mvp-mp4-export.test.mjs tests/mvp-export-panel.test.mjs tests/mvp-background-export.test.mjs tests/ui-interaction.test.mjs
npm test -- --test-reporter=tap --test-concurrency=4
node research/export/wormhole-baseline.mjs capture --exact-host --export-host --diagnostics-host [--public-release=ID]
node research/export/wormhole-baseline.mjs verify
git diff --check
```

Targeted tests: **73/73**, zero failure/skip/cancel, 4347.8615 ms.
Local browser run: `logs/wh01/run-0a0fc801-b647-4e2f-b1a7-2ef02aaf9946`.
37 retained host checks, 21 exact-source cases, eight real DOM/copy checks,
18 export cases, 17 files and **382 independently decoded frame IDs** pass.
The 32 diagnostic messages include the successful strict 10-bit probes; all six
10-bit files retain 10-bit pixel formats. The 48 raw/PostFX comparisons retain
the original image thresholds. Immutable scalar baseline SHA remains
`937b39bf0a1c2f0b77abc8cdde91654a3840e41b95aecbbb0a98b0245573270f`.
Runtime/browser input hashes still match the captured local build.

The first cumulative run recorded 2231 tests / 2218 pass / 13 failures: nine
exact baseline errors plus four assertions that could not execute because the
old export VM fixture lacked `require` for the new diagnostic leaf. Loading the
real leaf fixes those four (15/15 focused recheck); all historical assertions
remain. The final complete rerun closes the fixture correction: **2231 tests / 2222
pass / exactly the same nine baseline names and complete error messages / zero
skips or cancellations**, 521563.4197 ms. The
[compact receipt](../tests/wormhole-wh06c1-acceptance.json) binds commands,
predecessors, baseline failures and artifact/source identities. The first run
remains distinct historical evidence; it is not rewritten as a pass.

A final layout correction places the dashboard summary below the toolbar and
hides detail in MVP's minimized export panel. Build and 73 targeted checks pass
again. The local export capture precedes these two layout-only input changes;
the release/public check binds the final product inputs. The common probe,
worker transport, exact-source and encoded-quality inputs are unchanged. No physical Samsung or whole-song speed qualification is claimed.
No new Python/analyzer algorithm or benchmark is introduced. Node/npm are the
available runners; release uses the guarded Node publisher because the package
deploy script requires Bun. No dependency installation or golden regeneration.

## Manual handoff and next tasks

In MVP choose the accepted 10-bit MP4 or 10-bit WebM, the same song and 4K60.
If it fails on Samsung, Copy export settings now includes the failed phase,
encoder/decoder outcomes and browser version. Compare **1080p30**, then 4K30
when useful, explicitly retaining 10-bit. A refusal is a valid diagnostic result;
this task does not promise to enable an unavailable 10-bit encoder. Desktop
10-bit quality and existing Stop & save / Cancel / retry must remain intact.

The [epic queue](cross-host-wormhole-rendering-epic.md) is WH-06c2 admission versus
output validation, WH-06e conditional mobile 10-bit fallback feasibility, WH-07
selectable Economy/Turbo, WH-08 long/platform qualification, then T21b/c captions
and T22–T24. **WH-06d 8-bit quality work is withdrawn by the user's direction**:
quality/speed/resource efficiency outweigh file size. Existing 8-bit choices
remain compatibility paths until mobile 10-bit is qualified. Any new software
encoder/dependency or substantial CPU cost requires the scheduled measured
decision. Do not begin the next task before this manual handoff.
