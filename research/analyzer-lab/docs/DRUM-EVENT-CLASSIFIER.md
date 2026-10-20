# P0 Musical Event Layer: first research cycle

The independent **Plexus DrumEventClassifier** is an original Python research baseline (`plexus-drum-ridge-v1`). It detects kick, snare and hi-hat evidence, including multiple classes at the same time. Its canonical provider ID is `plexus-drum-research`. It is invoked by the drum CLI, outside the oracle registry and browser runtime. Production BeatEvent visual-impact classes retain their existing meaning.

Ownership: the research lab owns features, fitted models, dataset gates and measurements. The initial P0 cycle made no production changes. The subsequent [improvement cycle](DRUM-IMPROVEMENT-CYCLE.md) adds opt-in v2 research and a separate scoped analyzer-owned tonal-sustain correction; worker, audio, state, UI, visuals and build dependency graph remain unchanged. No external source code or model weights were ported. Existing NumPy/SciPy/mir_eval dependencies are sufficient.

## Run the complete cycle

From the repository root, using the existing lab interpreter:

```powershell
& research/analyzer-lab/.venv/Scripts/python.exe -m plexus_analyzer_lab drum-fixture --output-dir research/analyzer-lab/tmp/drums-example
& research/analyzer-lab/.venv/Scripts/python.exe -m plexus_analyzer_lab drum-train --manifest research/analyzer-lab/tmp/drums-example/dataset.json --output research/analyzer-lab/models/drums-example.json
& research/analyzer-lab/.venv/Scripts/python.exe -m plexus_analyzer_lab drum-benchmark --manifest research/analyzer-lab/tmp/drums-example/dataset.json --model research/analyzer-lab/models/drums-example.json --output-dir research/analyzer-lab/runs/drums-example
```

Outputs must be new paths; existing models and measurement directories are preserved. WAV/MIDI/stems, models and run artifacts stay in the existing ignored local directories. A model JSON retains coefficients, feature order/version, training normalization, validation thresholds, fitting track/group/content/annotation hashes, permission notes, reference provenance, environment and source fingerprint. The checksum covers the full model excluding its own checksum field. Predictions retain the model checksum.

`drum-dataset.schema.json` describes the separate supervised corpus contract. `rights.reviewed`, `trainingAllowed` and `evaluationAllowed` record the curator's decision; a schema flag cannot establish ownership. Audio and annotation permissions must both permit the selected use and be documented in source/license/review notes. Each track needs a stable `groupId`, explicit train/validation/test split, local audio/annotation paths and audio SHA-256. Annotation SHA-256 is measured during preflight. WAV audio is projected to mono by the existing loader without resampling.

Canonical annotations must preserve the exact decoded track/hash/rate/duration. Supply all three `completeEventClasses` before learning absent-class negatives. `ground_truth` also requires `groundTruthReviewed: true`; `human_annotation` keeps its own evidence type. Oracle predictions and sparse consensus labels cannot supply supervised negatives in this cycle. An empty complete event list is valid silence evidence; a missing list is unsupported.

The [reviewed MIDI importer](DRUM-DATA-IMPORT.md) can produce annotation files for local rendered drum MIDI. The source MIDI, audible onset alignment, class coverage and source rights require curator review. No Slakh download or mirdata integration occurs automatically.

## Features and fitting

Transient proposals use independent fixed-Hz band energy increases on a forward 20 ms window and approximately 5 ms hop. Band peaks are combined with a 25 ms grouping window and a fixed half-window time correction. Descriptor windows examine 60 ms before, 60 ms after and the following 60 ms. The 17 features describe RMS, crest, zero crossings, centroid, flatness, band power/shares, attack and decay contrasts. They are lab-owned acoustic features, distinct from production AudioFrame exports. Rates below 16 kHz are rejected; higher rates retain their decoded clock and available Nyquist bins.

Only training candidates fit mean/standard deviation and three independently class-balanced ridge regressions. Each annotated class labels its nearest candidate within 30 ms; candidate misses remain visible in proposal coverage. Independent scores support overlapping kick/hat/snare events. At least one detected positive and one completely annotated negative are required for every class.

Only validation tracks select per-class thresholds from the fixed [-0.25, 1.5] grid, maximizing aggregate event F at 50 ms, then precision, then the higher threshold. Within each class, detections use score-prioritized 50 ms suppression. The model freezes before testing. Scores are **uncalibrated evidence**, and canonical confidence remains `null`. High-frequency energy alone is not an asserted hi-hat identity.

Actual content hashes and curator group IDs prevent cross-partition leakage; benchmark additionally rejects test IDs/groups/hashes used in fitting. Training does not read test annotations or features, although preflight hashes local files to check identity. Re-encodings and related MIDI performances need stable curator grouping; hashes alone cannot find them. Repeated inspection of the same holdout is not independent validation.

## Measurements and oracle evidence

Reports contain per-class and aggregate one-to-one timing P/R/F, timing error, per-track confusion and candidate counts. Correct classes match first; remaining timestamp matches attribute class-confusion diagnostics. Simultaneous instruments are separate reference events. Both sides empty yield an unavailable score; silence false detections remain explicit counts. Silence-only fixtures do not produce fabricated perfect scores.

Optional track `oraclePaths` can reference independently obtained canonical `oracle_prediction` files with matching identity/clock and declared `eventClasses`. The benchmark reports per-provider evidence and per-class bounded consensus using the existing consensus implementation. Only providers supporting a class vote in that class's denominator. Supported empty votes count against agreement. Missing optional files produce unavailable diagnostics; malformed or mismatched identities fail validation. Consensus remains `pseudo_label`, including single-oracle agreement of 1.0. No actual drum oracle environment/model was installed or executed during this cycle.

## Evidence limits and next experiment

Nine procedural tracks (4 train, 2 validation, 3 test) exercise isolated and overlapping hits, changed pitch/hit rate/amplitude, sustained bass and silence. The generator uses independent random streams per track and writes timestamp-free FLOAT WAVs for repeatable audio hashes. Generator identity is known by construction; these fixtures share a procedural sound family and do not establish generalization to recorded drums.

The first heldout corpus exposed extra kick predictions and some missed overlapping snares/hats. Keep those observations as failure evidence. The next experiment is a frozen-model benchmark on reviewed, grouped real/rendered MIDI+stem mixtures, adding a validated independent drum oracle when its checkpoint and environment are available. Review candidate recall, bass/clap confusion, open/closed hats and velocity strata before any production integration. No real-data accuracy or readiness claim is made.
