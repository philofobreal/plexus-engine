# Drum and musical-event improvement cycle (2026-10-10)

The expanded, independently authored procedural holdout improved every drum class. A separate production correction removes sustained-tone false visual impacts. The research drum model remains opt-in: the historical corpus reveals kick/snare regressions, and real-recording accuracy is unvalidated.

## Evidence and selection

[V2 corpus](DRUM-V2-CORPUS.md) contains 24 tracks, 205 seconds and disjoint 12/6/6 train/validation/test partitions. Its specification was frozen by a separate corpus author without inspecting classifier predictions or holdout metrics. Labels establish the scheduled identities of original procedural sounds, not arbitrary real instruments. Variants include weak hits, irregular/overlapping events, altered timbres, bass mixtures and explicit non-drum negatives.

Both v1 and v2 received the same training tracks. Train alone establishes standardization and fitted weights. Both models selected ridge from `[1, 10, 100]` and class thresholds solely on validation, ranked by macro class F, worst class F, macro precision and higher ridge. Both chose ridge 100. Test scores were first read after both models were frozen; no further tuning followed that inspection.

- Corpus specification hash: `91543a11690523e81a8386aa622ab3b9cf9ed4ccdcbc699ba47fa0c37203acca`.
- Frozen v1 checksum: `91421ab02f14d58acbf1cad25db247377560b30c9c567d9854d125412d59b43c`.
- Frozen v2 checksum: `e178de63c842db5e6a1eeb568d5da5b4af90ff336a5733c7567c7915ed0c47b3`.
- V2 validation macro F: 0.917400; thresholds kick 0.60, snare 0.45, hi-hat 0.45. Scores are uncalibrated; canonical confidence stays `null`.

## Paired expanded holdout

Same six test tracks, decoded sample clocks and class-aware one-to-one matching at 50 ms:

| Class | V1 F | V2 F | False positives v1/v2 | Misses v1/v2 |
| --- | --- | --- | --- | --- |
| Kick | 0.8250 | 0.9762 | 5 / 1 | 9 / 1 |
| Snare | 0.7143 | 0.8923 | 16 / 7 | 4 / 0 |
| Hi-hat | 0.8571 | 0.9571 | 8 / 5 | 11 / 1 |
| Micro | 0.8127 | 0.9481 | 29 / 13 | 24 / 2 |

V2 uses band-local attack/decay evidence, a prior-maximum proposal gate that rejects stationary oscillator cycling, bounded proposal groups, 30 acoustic features and 12 original nonlinear interactions. The serialized descriptors `zero_crossings_per_second` and `centroid_hz` have fixed reference normalization: crossings/second divided by 22050 and centroid Hz divided by 11025. Their values are dimensionless, not physical-unit outputs. No provider code or weights were copied.

`drum-compare` preserves both benchmarks and rejects differing dataset/audio/annotation identity, source hash, environment, split or tolerance. Model loading validates checksums, feature/basis order, reviewed fitting rights, partition identities and validation-only selection consistency. A checksum is an integrity identifier, not independent proof that a model's training record is truthful.

## Historical regression material

The original test corpus is now historical regression evidence, not a fresh holdout. Comparing the original P0 model with the new v2 model also changes the training corpus, so this is not an algorithm-only comparison.

| Class | Original P0 F | Expanded-corpus V2 F |
| --- | --- | --- |
| Kick | 0.8519 | 0.8364 |
| Snare | 0.9565 | 0.6486 |
| Hi-hat | 0.9367 | 1.0000 |

The new model generates extra kick/snare predictions on this material. Preserve the failures; do not tune thresholds against either inspected test set. Existing `drum-train` and `drum-fixture` defaults remain v1. A future development cycle needs independent development annotations and a new frozen holdout, including reviewed real or rendered MIDI/stem mixtures and a validated drum-specific oracle.

## Actual library evidence

`music-reference` runs actual Plexus and librosa 0.11.0 on the six v2 test tracks. Truth comprises unique scheduled drum-hit times and explicitly authored confound-burst starts, in `[1, duration-0.25)` to exclude file envelopes. Simultaneous drums are one raw onset for this task. Irregular fixtures do not establish BPM truth.

| Provider / output | Reference | Estimated | Matched | Precision | Recall | F |
| --- | --- | --- | --- | --- | --- | --- |
| Plexus accepted visual impacts | 79 | 49 | 37 | 0.7551 | 0.4684 | 0.5781 |
| Librosa raw onsets | 79 | 122 | 63 | 0.5164 | 0.7975 | 0.6269 |

These outputs have different contracts. Librosa supplies useful onset positions but does not identify kick/snare/hi-hat. Plexus intentionally selects visual impacts, so its recall is not a complete raw-onset contract. Neither provider is ground truth. Missing/unsupported providers produce partial reports with explicit track coverage rather than a perfect empty score. Canonical and measurement audio identities are checked against the annotation clock before scoring.

Separate six-second pure-tone negatives further show why library agreement alone is insufficient. On steady 1000 Hz at 44.1/48 kHz, librosa returned zero plateau onsets, agreeing with the corrected Plexus interpretation. On steady lower tones and some 440 Hz cases, librosa itself returned false plateau onsets (0–144 across the measured cases). Scheduled plateau truth is zero regardless of provider agreement. All ten tested tone cases preserved Plexus beat arrays, BPM, bar starts and timing confidence exactly.

## Production behavior

The analyzer owner applied an original narrowband stable-energy guard to `percussiveT`, described in [tonal sustain](../../../documents/features/analyzer-tonal-sustain.md). Algorithm version increments from 5 to 6 for cache/provenance invalidation. Eight-second 440/1000 Hz fixtures at 44.1 kHz previously emitted 40/36 false plateau impacts; now both emit zero. Decaying plucks, new attacks on a sustained tone, percussion mixtures and attacks near the file end remain covered by positive fixtures. Raw flux and timing envelopes retain their existing formulas.

No research classifier is loaded by production. AudioEngine, worker schema, shared state, runtime types, UI, rendering and gameplay ownership remain unchanged. Improvements to vocal/melody/chord/section interpretation require their own task-relevant labels and validation; these drum/onset results do not establish those capabilities.

## Replay

From repository root, using the environment in [validation](DRUM-IMPROVEMENT-VALIDATION.md):

```powershell
$python = 'research/analyzer-lab/.venv/Scripts/python.exe'
& $python -m plexus_analyzer_lab drum-fixture --corpus v2 --seed 20261010 --output-dir research/analyzer-lab/tmp/drums-v2
& $python -m plexus_analyzer_lab drum-train --manifest research/analyzer-lab/tmp/drums-v2/dataset.json --algorithm v2 --output research/analyzer-lab/models/drums-v2-development.json
& $python -m plexus_analyzer_lab drum-train --manifest research/analyzer-lab/tmp/drums-v2/dataset.json --ridge 100 --output research/analyzer-lab/models/drums-v1-on-v2-ridge100.json
& $python -m plexus_analyzer_lab drum-compare --manifest research/analyzer-lab/tmp/drums-v2/dataset.json --baseline-model research/analyzer-lab/models/drums-v1-on-v2-ridge100.json --candidate-model research/analyzer-lab/models/drums-v2-development.json --output-dir research/analyzer-lab/runs/drums-v2-paired-final
& $python -m plexus_analyzer_lab music-reference --manifest research/analyzer-lab/tmp/drums-v2/dataset.json --output-dir research/analyzer-lab/runs/music-reference-v2-final
```

Use new output paths if these already exist. Selection replay must run all three v1 ridge trials on validation before freezing; ridge 100 above replays the recorded choice. Timestamp, source/environment metadata and model checksum change when fitting again; numerical predictions are deterministic within the pinned environment. This corpus's test results are now known regression evidence. Runs, waveforms and models stay ignored local artifacts; the checked-in [measurement summary](../fixtures/drum-v2-cycle.summary.json) retains provenance and measured counts.
