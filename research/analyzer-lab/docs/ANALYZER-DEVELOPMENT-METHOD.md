# Analyzer development method v1

This is the fixed review/measurement method for the [Plexus analyzer strategy](../../../documents/research/analyzer-development-strategy.md). It extends the [experiment protocol](EXPERIMENT-PROTOCOL.md) without overriding governance. The [policy](../configs/analyzer-evaluation-policy.v1.json) records proposed engineering targets and [experiment template](../fixtures/analyzer-experiment.template.json) records a run's predeclared choices. Neither is an automatic promotion/training system. Missing evaluations remain explicitly unimplemented or unavailable; numerical targets are not current results.

## 1. Signal and mathematical contract

For each input, declare decoded sample count L, sample rate fs, channel count/projection, and true duration L/fs. Preserve an identity of decoded PCM alongside the original file hash where decoders differ. Record resampling filter/version, original→analysis clock mapping and measured delay when used. A MIDI control start and audible rendered attack are distinct annotations.

AN-01 aligns the main host and lab default to channel 0. The lab permits explicit arithmetic mean and records projection plus decoded f32le PCM hash; comparisons reject inconsistent PCM identities. Synthetic WAV channel policy is tested, while actual browser/SoundFile decoding and resampling parity remains to be measured. Mean PCM can cancel anti-phase material; per-channel spectral power/onset fusion requires a different, measured algorithm and cost. Do not change playback audio to repair analysis. The implemented clock/level contract is documented in [analyzer-signal-contract](../../../documents/features/analyzer-signal-contract.md).

Define FFT window N separately from hop H, frame origin, centering, window type, padding and valid support. The STFT is `X[m,k] = sum x[n+mH] w[n] exp(-j 2πkn/N)`. A frame summary describes its support; its time tag is not automatically the audible attack. Record and measure any event refinement/interpolation offset. N/fs controls support and fs/N controls bin spacing; H/fs controls the feature time lattice. Smaller H alone does not improve low-frequency resolution.

At 44.1 kHz with N=H=1024, support/lattice are 23.22 ms and bins are 43.07 Hz. A nearest-lattice quantization error of H/(2fs) is possible only when the estimator actually rounds a correctly localized time to the nearest frame. Current frame-start events do not carry that guarantee. Boundary attenuation, smoothing, peak selection and inference can contribute larger errors.

Candidate designs should use overlapping short windows for attacks and longer windows for low-frequency body/sustain, aligned to one sample clock. Evaluate them on impulse/short-noise/decaying-hit phase sweeps, not just attacks centered in windows. Centered long-window evidence can spread before an attack; retain support/uncertainty and do not promote it directly to an XR target time.

Keep power, magnitude, amplitude RMS, dBFS, relative balance and display normalization distinct. A consistent one-sided PSD can use `|X|²/(fs * sum(w²))` with doubled non-DC/non-Nyquist bins; integrating over bin width yields window-normalized power. This is a proposed unit convention, not the current contract of every Plexus spectral field. PCM does not provide calibrated acoustic SPL without external calibration.

Flatness is geometric mean divided by arithmetic mean of the **same** nonnegative stabilized spectrum. Above the defined noise floor it is in [0,1]; below-floor/empty support needs a declared unavailable or silence convention. Stabilizing only one mean breaks the bound. Track quantile normalization is useful for display and adaptive scores, but can amplify numerical leakage and depends on track duration/content. Preserve absolute audibility, stability and support gates before interpreting normalized peaks as attacks.

Temporal smoothing uses `alpha = 1-exp(-H/(fs*tau))` for an intended time constant tau in seconds. Preserve initial conditions, edge policy and the deliberate existing reference response when migrating. Fast attack timing, slow energy envelopes, structural trends and artistic anticipation need separate support/smoothing choices.

## 2. Evidence and downstream contracts

Every task declares:

- quantity/units, timestamp origin/support, channel and sample-rate policy;
- event type: raw acoustic onset, selected visual impact, drum identity, beat, downbeat, source interval, phrase, acoustic boundary or functional role;
- supported empty versus unsupported/unknown output, complete negative annotation coverage and label uncertainty;
- provenance, source/model/config/version, confidence meaning and consumer fallback.

Keep raw measurement, musical inference and artistic emphasis separately named and immutable at publication. A heuristic score in [0,1] is not a probability. A calibrated probability requires task-specific independent validation (e.g. Brier/reliability analysis), coverage and distribution limits. Global timing confidence cannot stand in for local beat reliability, downbeat correctness or event confidence. Preserve alternative meter/tempo/role hypotheses where uncertainty matters.

The existing `TrackAnalysis`/worker schema must be extended under one owner, with additive fields and explicit legacy behavior. AN-01 implements optional `featureClock` and physical `rmsAmplitude`; valid clocks determine feature projection and missing/malformed clocks preserve the legacy duration/count fallback. Local timing intervals, meter hypotheses, acoustic event evidence and boundary/role uncertainty remain proposed future fields. Maintain ADR-002/003/005/009 boundaries and no live DSP inside rendering.

## 3. Predeclare one experiment

Copy the [template](../fixtures/analyzer-experiment.template.json), replace draft placeholders and freeze before inspecting the reserved test set. Record hypothesis, affected owners/stages, consumer/task definition, source/data/annotation/environment hashes, selection grids, train-only normalization, validation objective, all exclusion rules, metrics, negative exposure, protected strata, effect/regression limits and rollout/rollback scope.

Keep performances, MIDI arrangements, remixes, stems, soundfont variations and generator families grouped. Use official grouped splits where available. Content hashes prevent byte duplication; they do not establish musical independence. The v1/v2 synthetic holdouts have already been inspected and are now known regression sets. A new generalization claim needs independent material, not another seed of the same known generator.

Separate algorithm development data, selection validation, frozen final test and historical regression material. If a failure from a test set motivates new development, keep it as regression evidence and disclose that the next final test must be new. Changing a metric/tolerance/stratum/label after test inspection creates a new protocol version; it does not improve the old experiment retroactively.

## 4. Diagnose stage losses

Measure candidate recall before classification, classification conditional on candidates, postprocessing/NMS losses, grid/phase attribution and final consumer selection. Record raw acoustic time separately from snapping/quantization and deliberate chart filtering. Changing multiple stages requires ablations: proposal only, features only, classifier only, postprocessing only, and combined. A higher final F cannot explain which stage improved.

For beats retain metrical correctness, alternate level ambiguity and local phase continuity. A perfect constant BPM is insufficient if phase drifts through a breakdown. For sections separately measure boundaries, acoustic recurrence and functional roles. A forced eight-bar partition is not an observed boundary; a generated motion phrase is not a detected musical phrase. For vocal/bass/drum activity require the appropriate source/class and complete interval/event labels; band energy alone cannot establish identity.

## 5. Required measurements

| Task | Measurements | Availability at this audit |
| --- | --- | --- |
| Event/class timing | P/R/F at predeclared tolerance curve, signed bias, absolute p50/p95/p99, matched sample count, FP/misses | Single-tolerance P/R/F and additive timing/count fields implemented; multi-tolerance study must be run explicitly |
| Negative regions | FP/minute, clean-negative fraction, observed duration and class/condition strata | Planned aggregate report; both-empty F remains undefined |
| Beat/downbeat | Strict pulse level, CMLc/CMLt/AMLc/AMLt, Cemgil, local phase/drift, reacquisition after gaps | Generic matching implemented; full beat metrics planned |
| Sections/roles | Internal-boundary P/R/F+deviation at 0.5/1/3 s; recurrence; functional label/arrival accuracy | Boundary matching implemented; recurrence/role metrics planned |
| Robustness | Per-track/group macro and class micro, worst protected strata, tolerance curves | Per-track/class reports exist; full stratified/group aggregate planned |
| Uncertainty | Paired independent-group bootstrap of declared deltas; task-specific confidence calibration | Planned; no existing confidence-interval readiness claim |
| Costs/contracts | Stage time/memory, deterministic output, clock/unit/schema/consumer regressions | Fixture/build/identity infrastructure exists; comprehensive measured budgets pending |
| Physical consumer | Audio-to-visible and audio/input/judge loopback; Quest reachability/comfort | Pending physical device runs |

For each matched pair, `error = estimatedTime-referenceTime` (positive is late). Timing quantiles are conditional on pairs inside the declared tolerance. They are truncated by that tolerance and exclude misses: present recall, FP, sample count and matched-only status beside every statistic. The current matcher maximizes cardinality, not minimum timing error; preserve collision/pairing rules across systems. Small-sample p99 is a sample statistic, not a population tail bound.

Recompute event metrics at each predeclared tolerance (e.g. 10/20/25/30/50/70 ms), rather than filtering a different matching after the fact. Do not invent perfect F for clean silence. Negative exposure is measured over fixed annotated intervals; missing output is failure/coverage loss, never a clean negative. Zero observed false hits has finite uncertainty: under a homogeneous Poisson model the one-sided 95% upper rate is approximately `2.996/exposureMinutes`. Thirty clean minutes would be needed to bound 0.1/min under that assumption; musical dependence requires track/group analysis too.

Report both class/event micro and track/group macro; neither alone suffices. Predefine musical strata: sample rate/channel/level; duration; genre/generator/soundfont/recording origin; dense/sparse/overlapping attacks; loud bass/quiet hits; sustain/ramp/noise; breakdowns; syncopation/swing; constant/local tempo; meter; clear versus ambiguous structural arrivals. Do not cherry-pick only populated easy strata.

For uncertainty resample independent groups, with the same resampled indices for baseline/candidate, and recompute the declared aggregate. Preserve macro/micro definition. Predeclare handling of resamples without positive class support; never substitute perfect F. Record seed, method, replicates, interval level, invalid-replicate count and independent group count. Intervals do not repair shared generator-family bias or missing recorded music. A pilot minimum of 30 independent final-test groups is a proposed coverage floor, not a statistical sufficiency theorem; use development data for effect-size/power planning.

## 6. Multiple references

Validate each library output against independent annotations on the same declared PCM/clock/task, then compare providers. Declare coverage, parameters, model checkpoint hash, timestamp semantics, confidence meaning and failures. Oracle consensus remains pseudo-label evidence; correlated providers do not provide independent votes and averaged confidences need not be probabilities. Keep raw output and provenance.

Prospective libraries enter only after capability/clock fixtures, isolated environment/dependency and artifact/license review. Install no runtime dependency merely because a research model is useful. Design original Plexus algorithms from observations; do not copy provider implementation/weights. Pitch/note/source-activity schema capacity is not a measured capability while its evaluator/adapter remains unsupported.

## 7. Promotion gates and rollback

An experiment can promote only if all applicable gates have reviewed evidence:

1. clock/PCM/annotation identity, complete labels, independent splits and frozen predeclarations;
2. intended-task improvement under the declared paired statistic and coverage;
3. task-specific precision/negative-event targets and no unacceptable protected-stratum/historical regression;
4. deterministic/headless behavior, finite/unit/schema validity, cache algorithm version and safety regressions;
5. runtime/memory bounds relative to baseline on fixed assets;
6. actual consumer evidence; physical XR claims require physical headset/audio/input/display measurement.

Failing or unavailable required evidence leaves research status. An explicit narrowed domain can be accepted as opt-in only if declared before its final test; do not discover the winning domain on a failed test and call it a fresh result. The historical v2 snare regression remains a blocking counterexample to unconditional drum-model promotion.

After a production behavior change, increment algorithm identity, retain rollback source/config and document intended golden changes separately. Do not regenerate snapshots to make unexplained drift pass. For pure performance changes, preserve the existing mathematical/consumer outputs. Never let mean F compensate for malformed data, wrong clock, false XR targets or unsafe runtime behavior.

## Primary reference sources

- [mir_eval onset evaluation](https://mir-eval.readthedocs.io/stable/api/onset.html) defines the 50 ms onset convention; [beat evaluation](https://mir-eval.readthedocs.io/stable/api/beat.html) adds continuity/alternative metrical levels and Cemgil to the 70 ms event convention. These defaults are benchmark definitions, not VJ/XR perceptual guarantees.
- [mir_eval segmentation](https://mir-eval.readthedocs.io/stable/api/segment.html) distinguishes boundary and structural-label evaluation. Functional Plexus build/drop labels require their own annotated task.
- [librosa 0.11 onset_detect](https://librosa.org/doc/0.11.0/generated/librosa.onset.onset_detect.html) peak-picks/normalizes an onset envelope; optional backtracking chooses preceding energy minima. [onset_strength](https://librosa.org/doc/0.11.0/generated/librosa.onset.onset_strength.html) documents centering/frame shift. Record clock conventions before comparing times.
- [madmom downbeat API](https://madmom.readthedocs.io/en/v0.16.1/modules/features/downbeats.html) provides neural activations and meter-constrained DBN decoding; [beat API](https://madmom.readthedocs.io/en/v0.16.1/modules/features/beats.html) is a prospective independent rhythm reference. No local validated integration is claimed.
- [Essentia MELODIA](https://essentia.upf.edu/reference/std_PredominantPitchMelodia.html) provides predominant-pitch evidence, with confidence semantics dependent on unvoiced handling; [KeyExtractor](https://essentia.upf.edu/reference/std_KeyExtractor.html) estimates key from HPCP/profile evidence. [ChordsDetection](https://essentia.upf.edu/reference/std_ChordsDetection.html) is limited to major/minor triads and documented as experimental. These are task-specific prospective references, not arbitrary instrument truth.
- [Basic Pitch official repository](https://github.com/spotify/basic-pitch) documents instrument-agnostic polyphonic note estimation and internal 22050 Hz resampling; it does not establish instrument identity or dominant melody. [Omnizart](https://github.com/Music-and-Culture-Technology-Lab/omnizart) and [MSAF](https://github.com/urinieto/msaf) are prospective task/structure references requiring selected adapters and verified environments.
- [SciPy bootstrap](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html) supports paired resampling. Sampling musical-origin groups and preserving both systems' paired groups is the protocol proposed here.
