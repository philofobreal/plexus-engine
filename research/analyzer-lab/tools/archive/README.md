# Retained research programs

These tools preserve authored implementation history and offer explicit-input,
fresh-output refactors. They are not production entrypoints, current acceptance
tests, golden generators, or model-selection authority.

`history-20261010/inventory.json` identifies every retained original by SHA256.
Its `sources/*.txt` files preserve the original Python/MJS bytes without making
their old top-level writes executable. `historical-evidence.json` holds compact
log extracts and available provenance records; the experiment summaries remain
under `../../fixtures/`. See [retention policy](../../docs/RESEARCH-CODE-RETENTION.md)
for the individual disposition of all 21 programs.

From the repository root, use the existing lab interpreter:

```powershell
& research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/archive/review_files.py --root . --mode untracked
& research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/archive/schema_snapshot.py --root . --mode initial-contracts --output research/analyzer-lab/.cache/schema-replay-new
& research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/archive/compare_failures.py --baseline-log BASELINE.log --current-log CURRENT.log --output COMPARISON-new.json
& research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/archive/check_identity.py --root . --ref COMMIT --checkout CHECKOUT --output IDENTITY-new.json
& research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/tools/archive/measure_tonal_sustain.py --root . --output research/analyzer-lab/.cache/tones-new --sample-rate 44100 --frequency 440
```

All commands provide `--help`. No command automatically installs dependencies.
Writing tools require `--output` and reject an existing destination. Read-only
review prints to stdout. `pristine_build.py` exports Git build inputs; execution
additionally requires `--run-build`. It never restores files into the repository.
The Node tonal loader accepts explicit JSON on stdin and writes only to stdout.

`schema_snapshot.py` verifies an inert source against the inventory, then rewrites
only initial path assignments in its AST before replaying that historical stage
inside a fresh directory. Its five modes preserve the original generator/patch
algorithms; outputs do not include subsequent schema hardening. `minimize-an01`
requires an explicit pre-AN-01 base file. `update-an01` requires `--schema-dir` and
`--input`; its staged patch preserves the original historical `zero-pad` wording,
so it must not replace the current contract. `initial-v2` reads an explicit v1
schema and uses feature/basis names from the selected repository working tree.

`summarize_an01.py` deliberately verifies historical counts (205 lab passes, 64
integration passes, ten baseline failures, nine known fixtures). Supply every
input explicitly. Its result is a historical replay record, not fresh test
evidence. `model_validation.py` reads validation metadata only and emits no fitted
parameters. A freeze result cannot prove that test results were never inspected.

`verify_archive.py --root <repo> --output <fresh-directory>` runs targeted archive
checks. `--historical-evidence-dir <supplied-originals>` additionally rechecks the
known original logs and checkout; `--tonal-smoke` runs a two-second current-only
tone. `--record-output <fresh-file>` preserves compact check evidence separately
from generated files. It does not run the full suite, a build, or model training.

Tonal replay uses original authored waveforms and the shared generator WAV writer.
`--with-librosa` uses the installed research dependency. An optional
`--baseline-feature-extractor` substitutes that one source file in the current
analyzer; it is not a complete previous-version reconstruction. Exact historical
algorithm-5 comparison needs the recorded FeatureExtractor bytes or a matching
Git revision. No copied production source or fitted weights are stored here.
