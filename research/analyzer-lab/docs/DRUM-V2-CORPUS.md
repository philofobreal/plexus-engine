# Frozen procedural drum corpus v2

`drums.synthetic_v2.generate_corpus_v2(output_dir, seed=20261010,
sample_rate=22050)` creates 24 WAV/annotation pairs and returns the absolute
`dataset.json` path. The target directory must be new, including when an existing
directory is empty. Rates must be integers between 16000 and 192000 Hz; seeds
must be nonnegative integers. There are no downloads, sampled recordings,
library models, or external weights.

```python
from plexus_analyzer_lab.drums.synthetic_v2 import generate_corpus_v2

manifest = generate_corpus_v2("data/local/procedural-v2")
```

Version `2.0.0` uses schedule `irregular-overlap-velocity-v1`, frozen before the
classifier experiment. Its specification hash is
`91543a11690523e81a8386aa622ab3b9cf9ed4ccdcbc699ba47fa0c37203acca`.
Changing the frozen specification or evaluating a changed holdout requires a new
corpus version and a fresh declaration of the experiment. Do not adjust test
waveforms, labels, thresholds, or feature choices using v2 test scores.

The dataset lasts 205 seconds: 12 training tracks, six validation tracks, and six
test tracks. Every track lasts between 8.0 and 9.6 seconds. Track IDs start with
`v2-`; group IDs start with `independent-procedural-v2-` and are distinct from v1.
Paths in the manifest are relative filenames. The split and groups do not change
when the seed changes. Alternate seeds are related renderings of the same
procedural design and should retain their groups when combining datasets.

| Split | Track ID suffix | Seconds | Drum events | Confound |
| --- | --- | --- | --- | --- |
| train | train-kick | 8.0 | kick | none |
| train | train-snare | 8.2 | snare | none |
| train | train-hat | 8.4 | hi-hat | none |
| train | train-weak-overlap | 9.2 | overlapping classes | none |
| train | train-strong-bass-mix | 9.6 | overlapping classes | strong sustained bass |
| train | train-bass-negative | 8.0 | none | sustained bass |
| train | train-ramp-negative | 8.2 | none | slow bass attack |
| train | train-tone-negative | 8.4 | none | pure tone |
| train | train-dc-negative | 8.0 | none | constant DC |
| train | train-quiet-negative | 8.2 | none | near-silent noise |
| train | train-swell-negative | 8.4 | none | broad-band noise swell |
| train | train-clap-negative | 8.6 | none | clap-like bursts |
| validation | validation-irregular | 8.3 | overlapping classes | none |
| validation | validation-bass-overlap | 9.1 | overlapping classes | strong bass |
| validation | validation-weak-voices | 8.5 | alternating classes | none |
| validation | validation-ramp-tone | 8.1 | none | bass ramp and tone |
| validation | validation-swell-clap | 8.7 | none | noise swell and clap-like bursts |
| validation | validation-dc-quiet | 8.0 | none | DC and near-silent noise |
| test | test-syncopated | 8.7 | overlapping classes | none |
| test | test-bass-weak-overlap | 9.5 | overlapping classes | strong bass, weak hits |
| test | test-varied-voices | 8.9 | alternating classes | none |
| test | test-ramp-tone | 8.6 | none | bass ramp and tone |
| test | test-swell-clap | 9.0 | none | noise swell and clap-like bursts |
| test | test-dc-quiet | 8.4 | none | DC and near-silent noise |

Training includes five positive and seven negative tracks; validation and test
each include three positive and three negative tracks. Burst and swell negatives
provide non-drum transients for candidate classification. They complement steady
and near-silent negatives; their truth does not depend on whether the current
candidate extractor detects an onset.

Positive timing starts at an independently seeded off-grid position. Step
multipliers cycle through `1.0, 0.73, 1.21, 0.92, 1.37`, with additional independent
jitter of up to 19 ms. Mixtures overlap kicks and hats, add snares on two of every
three principal positions, and add offset hats on selected positions. The
scheduled times are rounded once to integer source samples. Hi-hat events remain
one aggregate `hihat` class with `openLike` and `closedLike` subclasses; their
waveform durations are 520 and 85 ms. Snare subclasses alternate `tonalLike` and
`noisyLike`. Kicks reuse the independently authored v1 decaying-pitch helper;
snare/hat variants, confounds, and v2 scheduling are authored in the new module.

Velocity scalars range from 0.18 to 1.0 on principal events and from 0.15 to 0.61
on offset hats. Track drum gains range from 0.071 to 0.46, before class scaling;
strong bass gains reach 0.68 on a positive holdout mixture. A single track-level
attenuation limits peaks to 0.92 without raising quiet recordings. These scalars
describe synthesis amplitude, not human performance velocity or model confidence.

Each annotation declares complete coverage of kick/snare/hi-hat. Only the
scheduled positive voice generators create events. Bass, ramps, pure tones, DC,
quiet noise, noise swells, and clap-like confounds never create drum labels.
Clap-like confound onset sample indices are recorded separately in generator
provenance so their exclusion is auditable. No side-stick, clap, or other extra
event class is inferred from its sound.

Canonical `ground_truth` and event confidence `1.0` refer only to the exact
authored generator identity. Provenance states
`truthScope: "sharedProceduralFamily: exact scheduled synthesis identities; not real instrument recognition"`.
Every event retains `sampleIndex`, `generatorIdentity`, `velocityScalar`, and
`preNormalizationGain`. Generator provenance contains corpus/version/schedule
identity, specification/hash, the exact scheduled events, main/track/timbre/
confound seeds, sample rate, NumPy/soundfile/libsndfile versions, and peak scale.
Rights permit use of these independently generated research fixtures; no external
dataset rights are inherited or asserted.

The deterministic v1 IEEE-float WAV writer is reused because it omits timestamp
chunks. Tests verify identical WAV bytes, hashes, schedules, and annotations for
the same seed/rate in the current numerical environment, apart from the intended
generation timestamp. Record library versions and the repository source revision
alongside experiment results when reproducing on another machine.

Corpus tests validate canonical/dataset schemas, audio identities and bounds,
sample-clock onsets, overlaps, subclass and amplitude variation, negative
confounds, frozen splits, reproducibility, and output collision/input failures.
They neither fit a classifier nor inspect test prediction scores.

Use v2 test as the primary procedural holdout for the v2 experiment; retain v1
test as a historical regression report. Training and validation support model
development, while test is reserved for the declared holdout evaluation. All
splits share related procedural timbre families: distinct files and groups do not
establish family-independent generalization. Neither v1 nor v2 supports a claim
about real drums, commercial recordings, unknown production mixes, or review of
licensed real-world annotations. Such claims require separately reviewed real
assets and independent held-out evaluation.
