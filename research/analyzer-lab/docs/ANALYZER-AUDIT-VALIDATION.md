# Analyzer principles audit: validation record

Date: 2026-10-10. Integration owner: root; affected owners: research metrics and documentation. DSP, musical representation and provider/consumer audits were read-only. This cycle adds event timing/count observability and a versioned development method. It does not implement the proposed production fixes, automatic promotion gates or new provider integrations. Production algorithm 6 and the preceding tonal-sustain fix remain intact.

See the [strategy](../../../documents/research/analyzer-development-strategy.md), [technical audit](../../../documents/research/analyzer-principles-audit.md), [method](ANALYZER-DEVELOPMENT-METHOD.md) and [diagnostic summary](../fixtures/analyzer-principles-audit.summary.json).

## Current-cycle tests and checks

Commands below run from `plexus-engine/` unless indicated. Python commands use the existing lab virtual environment. Node commands used the bundled executable `C:/Users/budap/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`; substituting this absolute executable for `node` is the runtime fallback used for reproducibility. Runtime discovery found Node 25.2.1, npm 11.6.2 and Python 3.12.14. The preferred Python 3.11 runtime was unavailable; the existing pinned environment was used. No dependencies were installed or upgraded.

| Check | Command | Result |
| --- | --- | --- |
| Event metrics and timing diagnostics, from `research/analyzer-lab/` | `.venv/Scripts/python.exe -m pytest tests/test_metrics.py tests/test_timing_diagnostics.py -q` | 18 passed in 1.33 s |
| Entire lab suite, from `research/analyzer-lab/` | `.venv/Scripts/python.exe -m pytest -q` | 199 passed in 59.50 s |
| Semantic/visual/XR consumers | `node --test tests/semantics.test.mjs tests/visual-score-dsl.test.mjs tests/automation-cue-alignment.test.mjs tests/rhythm-chart.test.mjs tests/rhythm-judge.test.mjs tests/xr-audio-integration.test.mjs tests/xr-choreography.test.mjs tests/gameplay-purity.test.mjs` | 95 passed, 0 failed, 6.629 s |
| DSP diagnostic replay | `node research/analyzer-lab/diagnostics/audit-dsp-principles.mjs` | Completed; captures current defects/design limitations, not an assertion of correctness |
| Musical contract diagnostic replay | `node research/analyzer-lab/diagnostics/audit-musical-contracts.mjs` | Completed; deterministic controlled observations |
| Python syntax | `research/analyzer-lab/.venv/Scripts/python.exe -m compileall -q research/analyzer-lab/src research/analyzer-lab/tests` | Passed |
| Tracked diff whitespace | `git diff --check` | Passed |
| New text artifacts | Static UTF-8/newline/whitespace, JSON parsing, local Markdown link and binary-artifact review | Passed; includes untracked files that `git diff --check` omits |

The new eight timing tests check signed error, interpolated quantiles, matching orientation, false/missed counts, undefined no-match timing, missing/empty output, sorted nonmutation and duplicate one-to-one matching. Existing matching/tolerance/F definitions were preserved. Timing percentiles remain conditional on matched events, not a full-error or population-tail guarantee.

Test logs are ignored local artifacts: `.cache/pytest-principles-audit.log` and `.cache/node-principles-audit.log` under the lab. The summary stores source/script identities and scopes; no large audio, model or runtime logs are committed.

## Reproducible diagnostics

The versioned scripts load actual TypeScript analyzer modules through the repository's existing headless test loader. DSP input is generated PCM or controlled onset envelopes; contract probes use controlled feature arrays or arithmetic. These are diagnostic entrypoints, not new golden tests that preserve known bad behavior.

```powershell
node research/analyzer-lab/diagnostics/audit-dsp-principles.mjs
node research/analyzer-lab/diagnostics/audit-musical-contracts.mjs
```

The DSP script writes ignored `research/analyzer-lab/.cache/analyzer-principles-audit/dsp-results.json` and prints JSON. The contract script prints JSON; the validation replay redirected it to ignored `.cache/audit-musical-contracts-replay.json`. Replaying after a fix should change the applicable observations. The committed summary is a dated snapshot, not automatically refreshed evidence.

The DFT comparison is an independent mathematical check; malformed-input, flatness, impulse phase/tail and LF support probes exercise actual DSP. Beat gap/tempo change probes exercise tracker/grid inference on authored envelopes; they do not claim recorded-audio accuracy. Section RMS, pivot and pressure probes exercise actual downstream computation with controlled features. Stereo parity and frame-clock examples prove differing declared policies arithmetically; browser decode/resampling parity was not executed. Loader wall times are excluded from the summary and are not production performance measurements. JSON converts nonfinite raw numeric values to null; accompanying `finite` flags and public nonfinite counts explain this diagnostic encoding.

## Earlier cycle: retained evidence, not rerun here

The [previous validation record](DRUM-IMPROVEMENT-VALIDATION.md) retains the algorithm-6 build and full Node suite: build passed; 1291 tests, 1281 passed, 10 failed. All 10 failures were reproduced against clean HEAD (one preset-save EPERM and nine Wormhole preset assertions). Tracked source identity comparison covered 566 blobs with zero mismatches. This is not a claim that the full suite is green.

This audit introduced no additional production source changes, so the full production build/test was not repeated. Current validation instead runs all lab tests and the relevant headless consumer regressions. No golden fixture was regenerated. No test result selected a new threshold or drum-model deployment. The earlier v2 snare regression remains explicitly blocking unconditional promotion.

## Not measured and residual limits

- Recorded music generalization, independent human salient-event/phrase/role annotations, full grouped bootstrap, calibrated confidence and proposed coverage/precision gates remain pending.
- Prospective madmom/Essentia/Omnizart/Basic Pitch/MSAF adapters and checkpoints were not installed or measured in this cycle.
- Browser smoke, stereo Web Audio decode parity, audio/display/input loopback and physical Quest acceptance were skipped: this cycle changes research metrics/documents and supplies headless diagnostics, not playback/UI/runtime behavior. Headless XR tests do not substitute for physical XR validation.
- Production stage time/memory budgets and consumer latency regressions need dedicated experiments. Proposed millisecond targets are engineering requirements, not achieved results or universal perceptual limits.
- `diff_export.ps1` was skipped as unnecessary: this is a local audit/method handoff without a PR; direct source, diff and untracked-artifact checks were used. No commit, PR or deployment was created.

The next production work follows AN-01 (signal/time/unit/validity contracts), then AN-02 (overlapping windows, phase coverage, flatness and clock-based smoothing), each with a predeclared experiment and protected regression set. Consumer clock/latency changes retain a separate owner and acceptance record.
