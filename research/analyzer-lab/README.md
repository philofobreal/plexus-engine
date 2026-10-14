# Plexus Analyzer Oracle Lab

The [AN-03G record](docs/AN-03G-VALIDATION.md) adds an actual physical-band DSP
improvement:63 more known and71 more new authored attacks at2 ms without extra
or negative increases. A pure semantic evidence gate retains both-library
qualification and explicit consumer abstention. This direct research stream is
not activated in TrackAnalysis/worker or accepted visual/XR targets.

The [AN-03F record](docs/AN-03F-VALIDATION.md) compares actual librosa/audioFlux
onsets on identical PCM and accepts only their one-to-one agreements as eligible
references. The [continuing policy](docs/TWO-LIBRARY-REFERENCE-POLICY.md) excludes
single-library pseudo-labels from trusted development targets. The new peak
probe is retained **without promotion**, because its new-condition extras grow.
Both failed attempts and old/new tests remain cumulative evidence.

The [AN-03E record](docs/AN-03E-VALIDATION.md) adds a direct research continuation
filter, preserving prior onset matches while reducing source-removal negatives.
It also measures nine original-clock excerpts from three local MP3 recordings
against librosa. Agreement is diagnostic; these recordings have no ground-truth
annotations. This new function is not a TrackAnalysis/worker version selector.

The [AN-03D record](docs/AN-03D-VALIDATION.md) adds fixed-difference evidence with
v4-confirmed soft proposals (`adaptiveOnsets: true, adaptiveOnsetVersion: 5`).
It recovers the preceding polyphonic/noise misses and beating negatives, while
retaining new soft-pluck/source-removal counterexamples and complete history.
This remains direct headless diagnostic evidence; defaults and browser/CLI
activation are unchanged.

The [AN-03C record](docs/AN-03C-VALIDATION.md) adds actual v4 recognition of repeated
weak carrier attacks, selected with `adaptiveOnsets: true, adaptiveOnsetVersion: 4`.
It preserves v3/default output and documents new polyphonic/beating limitations.

The [AN-03B development record](docs/AN-03B-VALIDATION.md) documents actual adaptive
v3 DSP/headless integration (`adaptiveOnsets: true`), strict 2 ms dense-event
improvements, retained counterexamples and the cumulative source/test history.

Research-only WAV → existing Plexus headless analyzer + librosa → canonical JSON → differential report → provenance-bearing JSONL. No browser, production dependency, model download, or algorithm port.

From the **plexus-engine repository root**, with Node and the repository's normal npm dependencies already available:

```powershell
py -3.11 -m venv research/analyzer-lab/.venv
& research/analyzer-lab/.venv/Scripts/Activate.ps1
python -m pip install -e 'research/analyzer-lab[test]'
python -m plexus_analyzer_lab doctor
python -m plexus_analyzer_lab oracle list
python -m plexus_analyzer_lab fixture --output research/analyzer-lab/tmp/click.wav --bpm 120 --duration 16
python -m plexus_analyzer_lab analyze --audio research/analyzer-lab/tmp/click.wav --oracle librosa --plexus
```

POSIX: `python3.11 -m venv research/analyzer-lab/.venv` and `source research/analyzer-lab/.venv/bin/activate`. Install with the same editable pip command. This package intentionally requires a repository checkout; a standalone wheel does not contain production source or bridge/schema resources. Python ≥3.11 is supported; use 3.11 as the preferred research baseline. The implementation session used 3.12.14 and records this difference in manifests.

`analyze` prints the absolute run directory. Substitute that directory below:

```powershell
python -m plexus_analyzer_lab report --run <run-directory>
python -m plexus_analyzer_lab export-training --run <run-directory> --output research/analyzer-lab/tmp/examples.jsonl
python -m plexus_analyzer_lab benchmark --manifest <dataset-manifest.json>
python -m pytest research/analyzer-lab/tests --basetemp research/analyzer-lab/.cache/pytest
```

Each run contains `manifest.json`, `plexus.raw.json` when successful, provider canonical files, `report.json`, and `report.md`. Repeated `report` only rewrites the two reports. BPM absolute/relative and octave-equivalent error, beat/onset precision/recall/F-measure, and metadata differences are measurement evidence. Unsupported outputs remain `null`; supported empty outputs remain `[]`. Unknown confidence remains `null`, not zero or an invented probability. A successful synthetic run may show disagreement: it does not establish which algorithm is correct.

Core direct dependencies are pinned in [pyproject.toml](pyproject.toml). `jsonschema` enforces the interchange contracts; `pytest` is a test extra. A validated environment snapshot is in [requirements.validation.txt](requirements.validation.txt); install it before the editable package when replaying that precise environment. Python/OS and every actual package version are recorded for every run. No root npm dependency changes are needed.

Configuration: `--config <json>` overlays [lab.default.json](configs/lab.default.json), with beat/event/section tolerances, deterministic split seed, provider timeout, Plexus options and librosa parameters. Repeat `--oracle` to request multiple providers. An optional provider requires `--enable-provider <id>` plus a command **argument list** in `providers.<id>.command`. Missing optional environments are nonfatal in doctor; failed requested providers remain visible in the run and command exits nonzero after writing usable partial reports. WAV decode uses bundled/system libsndfile; ffmpeg is not required.

See [architecture](docs/ARCHITECTURE.md), [experiment protocol](docs/EXPERIMENT-PROTOCOL.md), [license policy](docs/ORACLE-AND-LICENSE-POLICY.md), [dataset policy](docs/DATASET-POLICY.md), and [capability roadmap](docs/CAPABILITY-ROADMAP.md). The example [Slakh-like manifest](fixtures/manifests/slakh-like.example.json) contains references only and is not runnable until local licensed assets are supplied. Nothing downloads a dataset or model.

[Implementation validation](docs/VALIDATION.md) records the actual environment, commands, results and unvalidated limits.

The next P0 research slice is implemented: [independent DrumEventClassifier](docs/DRUM-EVENT-CLASSIFIER.md) adds `drum-fixture`, `drum-train`, `drum-benchmark`, and reviewed `drum-import-midi`. It uses separate track/group splits, original acoustic features and uncalibrated kick/snare/hi-hat evidence. [P0 validation](docs/DRUM-VALIDATION.md) records the initial synthetic holdout results and real-data limitations.

[The expanded improvement cycle](docs/DRUM-IMPROVEMENT-CYCLE.md) adds `drum-fixture --corpus v2`, `drum-train --algorithm v2`, `drum-compare` and `music-reference`. Defaults remain v1. The new paired holdout improves all drum classes; historical kick/snare regressions remain visible. A separate original production tonal-sustain correction identifies algorithm 6. The research model remains outside production.

[AN-01 validation](docs/AN-01-VALIDATION.md) records the subsequent algorithm 7 signal/clock/level contract. Lab decoding now defaults to channel 0, matching the host policy, and records a decoded PCM hash. Explicit mean projection remains available through `load_audio(..., mono_projection="arithmetic-mean")`. Physical RMS and exact feature clocks are additive production metadata; partial terminal windows publish acoustic evidence but abstain from attack/grid inference pending AN-02.

[Analyzer development method v1](docs/ANALYZER-DEVELOPMENT-METHOD.md) and the [VJ/XR strategy](../../documents/research/analyzer-development-strategy.md) define task/clock contracts, proposed precision targets and review gates. Event reports include signed timing statistics, absolute p95/p99 and false-positive/miss counts; these are matched-only diagnostics, not production-readiness guarantees. [The audit record](docs/ANALYZER-AUDIT-VALIDATION.md) distinguishes actual checks from planned metrics.

[AN-02 first-cycle validation](docs/AN-02-VALIDATION.md) adds an independent opt-in
[acoustic candidate stream](../../documents/features/analyzer-acoustic-candidates.md).
The ordinary algorithm-7 projection stays unchanged. The authored regression
corpus is retained; it does not establish recorded-music generalization.

[AN-02 C2 validation](docs/AN-02-C2-VALIDATION.md) measures gain changes, attacks
over a sustained carrier, dense repetitions and modulation negatives on identical
PCM with librosa. Stage observations diagnose power-gate and suppression losses;
neither research ablation is promoted. All authored cases and failed attempts are
retained alongside the first-cycle regressions.

[AN-03 analyzer improvement](docs/AN-03-VALIDATION.md) implements predictive
background innovation in the actual headless analyzer via `predictiveOnsets: true`.
It recovers the known C2 mixed attacks and adds a frozen synthetic robustness
matrix, strict transport checks and long-track cost observations. V1 remains
available; uncertain clip-start candidates are not automatically promoted to
visual or XR targets. Before/after scores and every measured revision are retained.

## Cumulative regression and code history

`npm test` recursively runs all active Node tests, including newly added folders.
The [cumulative harness](tools/harness/README.md) additionally runs the declared
build and entire Python suite, verifies executed-file coverage and preserves
hash-chained source inventories and compact run histories:

```powershell
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py inventory
& ./research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/harness/regression.py full --report research/analyzer-lab/.cache/NEW-full-validation.json
node research/analyzer-lab/diagnostics/measure-an02-candidates.mjs --output research/analyzer-lab/.cache/NEW-an02-measurements.json
```

Use fresh report/output paths. `inventory` appends additions, but changed protected
files require the documented exact-hash migration review; it never accepts a
replacement silently. All active prior tests run with new tests. Detached
historical `documents/tests` snapshots remain inventoried and explicitly
unexecuted when their original context is unavailable. Known baseline failures
stay nonzero and visible; new failures block acceptance.

[Research code retention](docs/RESEARCH-CODE-RETENTION.md) records 21 byte-preserved
original scripts and [configurable replay tools](tools/archive/README.md), including
their limitations. Large generated audio/models/logs and environments remain
ignored; compact evidence and source identities are versioned. A past result is
never rewritten to represent an improvement in a later run.
