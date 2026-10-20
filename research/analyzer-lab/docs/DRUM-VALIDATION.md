# P0 drum cycle validation — 2026-10-10

Interpreter: the previously provisioned isolated lab venv, Python 3.12.14. Python 3.11 was unavailable and was not separately validated. Existing pinned NumPy 2.2.6, SciPy 1.15.3, soundfile 0.13.1, mir_eval 0.8.2 and jsonschema 4.25.1 were reused. No dependency installs/upgrades, external weights or dataset downloads occurred in this cycle. Node 25.2.1/npm 11.6.2 used existing repository dependencies.

## Synthetic measurement

The procedural corpus uses seed 1729 at 22050 Hz, nine independent tracks with 4 train / 2 validation / 3 test. Train fits normalization/coefficients; validation alone selects thresholds. Test includes alternating timbres, kick/hat/snare overlap with sustained bass, and silence.

| Class | Reference | Estimated | Matched | Precision | Recall | F |
| --- | --- | --- | --- | --- | --- | --- |
| kick | 23 | 31 | 23 | 0.741935 | 1.000000 | 0.851852 |
| snare | 12 | 11 | 11 | 1.000000 | 0.916667 | 0.956522 |
| hihat | 41 | 38 | 37 | 0.973684 | 0.902439 | 0.936709 |

All measurements use one-to-one class matching at 50 ms. The silence track produced zero proposals and predictions; both-empty scores are undefined. Extra kick predictions and missed overlapping events remain failures. No threshold/model adjustment was made in response to the test scores. These figures describe generator identities within a shared procedural sound family, not recorded instrument accuracy.

## Commands and gates

```powershell
& research/analyzer-lab/.venv/Scripts/python.exe -m plexus_analyzer_lab drum-fixture --output-dir research/analyzer-lab/tmp/drums-p0
& research/analyzer-lab/.venv/Scripts/python.exe -m plexus_analyzer_lab drum-train --manifest research/analyzer-lab/tmp/drums-p0/dataset.json --output research/analyzer-lab/models/drums-p0.json
& research/analyzer-lab/.venv/Scripts/python.exe -m plexus_analyzer_lab drum-benchmark --manifest research/analyzer-lab/tmp/drums-p0/dataset.json --model research/analyzer-lab/models/drums-p0.json --output-dir research/analyzer-lab/runs/drums-p0-complete
& research/analyzer-lab/.venv/Scripts/python.exe -m pytest research/analyzer-lab/tests --basetemp research/analyzer-lab/.cache/pytest -q
& research/analyzer-lab/.venv/Scripts/python.exe -m compileall -q research/analyzer-lab/src
node --test tests/contracts.test.mjs tests/analyzer-parity.test.mjs
npm run build
git diff --check
```

Final Python suite: **130 passed**, no failures/skips (26.61 s). Compileall passed. The final MIDI-specific suite contains 48 cases. All 92 new text files across the initial lab and this P0 addition passed JSON/whitespace/local-link review, and `git diff --check` passed.

Actual CLI integration was also exercised through the ignored local helper:

```powershell
& research/analyzer-lab/.venv/Scripts/python.exe research/analyzer-lab/.cache/validate_drum_cli.py
```

It imported independently authored fixture MIDI via `drum-import-midi`, verified the sample-clock agreement within 1 ms and retained `human_annotation`. It refit to `models/drums-p0-v1.json` and evaluated into `runs/drums-p0-v1/`. Training mean/scale/coefficients/thresholds were exactly equal to the first model. Final micro P/R/F = 0.8875 / 0.934211 / 0.910256 (71 matched, 80 estimated, 76 reference). The overlap+bass test accounts for eight extra kick and one extra hat detection, one missed snare and four missed hats. Thresholds remained kick 0.25, snare 0.45, hat 0.60.

The initial CLI benchmark exposed a missing canonical event `provider` field, corrected without changing numerical fitting/detection. Its partial directory was preserved; the successful run used a new output directory. Registry regression caught the new research provider placed in the oracle-provider list; capability metadata now records it separately in `researchImplementation`, preserving the seven-provider registry and its CLI contract.

Node targeted validation: **44 passed**, no failures/skips. Production TypeScript/Vite build passed, with existing >500 kB chunk warnings. Production source, root dependency/config files and golden fixtures have no diff. Full Node/npm test suite and fresh golden regeneration were not required for this isolated Python change. Browser/physical Quest smoke was skipped because no application runtime or renderer changed. No Bun or new runtime fallback was used; the pre-existing Python 3.12 venv remains the recorded deviation from the preferred 3.11 baseline.

Meaningful Python tests cover deterministic WAV bytes, sample-clock labels, simultaneous classes, complete annotation requirements, permission gates, actual hash/group leakage, test-label isolation from fitting, model integrity, unsupported/missing oracle artifacts, per-class pseudo-label consensus, confusion counts and zero silence hits. Reviewed MIDI importer tests additionally exercise MIDI clocks and mappings.

Targeted source review was used because this checkout has no Graphify corpus. `diff_export.ps1` was skipped as unnecessary; direct file/diff inspection and untracked text/JSON/link checks were used. No commit or PR was created.

## Unvalidated evidence

No real Slakh/MIDI/stem assets existed in the targeted local dataset locations. No actual Omnizart/Spleeter drum checkpoint was installed or executed. External canonical drum oracle ingestion is contract-tested, and unavailable evidence remains explicit. The working MIDI importer does not prove audible onset alignment or annotation/source rights; those are explicit curator review inputs. Real mixture accuracy, bass/clap/open-hat robustness, confidence calibration, long-dataset resource profiling and any production integration remain future measured work.
