# AN-01 implementation validation (2026-10-10)

Scope: algorithm 6 → 7 signal/clock/level contract, implemented under one integration owner. The [predeclared experiment](AN-01-EXPERIMENT.md), [production contract](../../../documents/features/analyzer-signal-contract.md) and [development method](ANALYZER-DEVELOPMENT-METHOD.md) define this cycle. Known synthetic/golden material is regression evidence, not a new independent final test. No thresholds/models were selected, no dependencies installed, and no research drum model promoted.

## Result and mathematical evidence

- Public headless PCM rejects empty/wrong-type/nonfinite/out-of-domain input and invalid clocks/hops/request IDs before callbacks. Headroom above 1 remains supported. Bare radix-2 FFT input guards preserve the independent two-point DFT.
- Every real sample is represented in ceil(L/H) feature windows; FFT padding does not dilute RMS or invent a ZCR crossing. True L/fs duration, final bar/section endpoints and shared optional feature clock agree, including one-sample and exact-one-second clips.
- Bar/section `rmsAmplitude` equals independent sample-weighted power arithmetic; normalized `avgRms` is distinct from arrangement-relative `energy`. A regression covers a nonzero partial frame ending at an exact second.
- Cue evidence uses the published H/fs lattice at a late boundary. Clock copy/JSON roundtrip, malformed-clock removal and legacy fallback are tested. Transition and performance-plan consumers use the same shared helper.
- Lab WAV decoding defaults to host channel 0. Explicit mean can cancel anti-phase stereo; decoded PCM hashes/projection metadata identify the difference. Comparison rejects inconsistent projection, decoded hash, sample count or channels. Existing mono annotations retain compatible identity behavior.

`tests/analyzer-signal-contract.test.mjs` contains 12 new protected tests; `tests/test_pcm_identity.py` adds six lab tests. Existing musical correctness, local-tempo, tonal-sustain, consumer and purity checks remain applicable. Independent read-only integration review found an exact-second terminal bar omission; the implementation and regression test resolve it. No agent edited shared source or snapshots during review.

## Regression inspection and deliberate fixture changes

Before edits, a local copy of algorithm-6 analyzer/types froze the actual checkout including the previous tonal-sustain fix. `diagnostics/compare-an01-contracts.mjs` runs both versions on the same nine known inputs and reports complete summary differences; it never writes snapshots. The first comparison to the original committed fixtures showed zero baseline drift.

Initial tail publication made sustained-tone cutoffs appear as visual attacks and shifted the final DNB beat by about 46 ms and breakdown beat by about 70 ms. These regressions were rejected. Incomplete final windows now publish acoustic evidence but abstain from accepted visual attacks **and grid inference**, and stay out of complete-window normalization/sustain references. The experiment record discloses this integration clarification. An authored envelope with an extreme terminal cutoff independently verifies unchanged grid/candidates/confidence.

After correction, all nine paired comparisons retain identical tempo candidates, BPM, confidence, event counts, beat positions and grid phase. Reviewed summary changes are only:

| Fixture | Frames before → after | Other accepted change |
| --- | --- | --- |
| house-120, house-128, techno-140, trance-150, dnb-176, breakbeat-140 | 301 → 302 | techno-140 analysis bars 5 → 6, including the real terminal interval |
| sparse-techno-90 | 344 → 345 | None |
| slow-floor-70, breakdown-124 | 387 → 388 | None |

These ten count fields were patched explicitly after independent musical tests and paired review. No automatic golden-generation command was run. The headless contract fixture changes only `firstSection.avgRms` from the prior erroneous relative-energy 0 to normalized physical RMS 0.519683; its algorithm identity is now 7. Other projection values remain protected. Low-frequency short-input expectations now require ceil frame counts.

The accepted comparison and source identities are recorded in [an01-signal-contract.summary.json](../fixtures/an01-signal-contract.summary.json). Detailed logs/frozen source/paired reports remain ignored local artifacts under `.cache`; they contain no new holdout or model-selection evidence.

## Reproduction and final checks

Run from `plexus-engine/` with the existing environment:

```powershell
npm run build
npm test
node --test tests/analyzer-signal-contract.test.mjs
& research/analyzer-lab/.venv/Scripts/python.exe -m pytest -q research/analyzer-lab/tests --basetemp research/analyzer-lab/.cache/pytest-an01-final
node research/analyzer-lab/diagnostics/audit-musical-contracts.mjs
git diff --check
```

Use a fresh workspace `--basetemp` directory for another replay. Pytest's default Windows temporary-directory numbering failed under the sandbox; a fresh directory inside this workspace resolved it. No external directory was deleted. The existing Python is 3.12.14, npm 11.6.2, Node 25.2.1; build uses the project's existing scripts. A focused intermediate Node run used 24.19.0 and exposed an extensionless import in the new performance-plan helper; the import now follows that module's explicit `.ts` convention, and the final suite checks it.

The production build has passed and the final entire lab suite has passed **205 tests in 156.88 s**. A first complete Node run reported 1289 tests, 1276 passes and 13 failures: the ten known baseline failures plus two direct-import file failures and the stale ZCR source assertion. The affected automation/dramaturgy/contracts/signal-contract suites then passed **64/64 in 1.844 s** after the explicit `.ts` imports and real-support assertion correction. The final complete Node rerun reported **1303 tests, 1293 passed, 10 failed in 504.111 s**. All twelve new contract tests and existing analyzer/consumer/purity checks pass. Runtime overlap affected wall time; this is not a DSP performance benchmark.

The earlier [baseline failure proof](DRUM-IMPROVEMENT-VALIDATION.md#production-checks) reproduced ten pre-existing full Node failures on exact clean HEAD: one Windows preset-save EPERM and nine Wormhole preset assertions. The final suite has exactly those ten failure names, the same nine assertion messages and the same rename EPERM. This comparison is checked before creating the summary; there are no additional AN-01 failures. The full suite is not green. Unrelated preset code was not altered to suppress those failures. Final build was repeated after the import repairs and passed.

## Residual limits and next cycle

The final partial window can contain a real onset that is not accepted. The abstaining window's real support is less than H/fs (23.22 ms for H=1024/fs=44100); this is not a general timing-error or recall bound. Earlier attacks at a window boundary also require phase coverage. It is unknown attack evidence, not proven silence. AN-02 must independently test overlap, full hop-phase coverage, endpoint attacks, flatness numerics and time-based smoothing while preserving AN-01 contracts. Raw acoustic tail preservation is not improved terminal onset recall.

Browser smoke/actual decoder-resampling parity, production stage time/memory budgets, recorded-music generalization, independent salient-event/phrase/role annotations, confidence calibration and physical Quest audio/input/display measurements were not run. Proposed VJ/XR millisecond and precision targets remain requirements, not achieved results. Existing spectralPivot artistic mutation, global anticipation and other algorithm-6 audit findings outside AN-01 remain future work. The dated principles-audit summary remains a historical algorithm-6 record; replayed diagnostics now describe the current implementation.

No commit, PR or deployment was created. `diff_export.ps1` is unnecessary for this local source/contract handoff; tracked diff and all new text artifacts are reviewed directly.
