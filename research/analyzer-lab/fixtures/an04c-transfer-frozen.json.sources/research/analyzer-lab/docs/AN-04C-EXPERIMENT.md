# AN-04C — held-out harmonic residual and temporal periodicity evidence

Frozen before measurement, 2026-10-14. Owner/integration: Codex / root.
Scope: pure analyzer/types; reproducible diagnostics, authored controls and full
cumulative tests. Existing pitch extraction, references and consumers unchanged.

## Frozen model and decisions

- Assess AN-04B original-clock complete frames with valid primary frequency.
  Harmonic model: constant plus sine/cosine pairs, max eight harmonics, each
  strictly below 0.4*sampleRate. This is a stationary sinusoidal subspace, not
  source separation or a universal instrument model.
- Train on first floor(2*N/3) samples, evaluate residual on both training prefix
  and untouched suffix. Remove prefix mean; denominator energy uses that same
  mean. Unweighted rectangle support; no fitted frequency/time offset or truth
  correction. Keep original support and the extended three-frame decision support.
- Two-pass modified Gram–Schmidt QR on the prefix, orthogonalization propagated
  to the suffix. Relative column-norm rank threshold 1e-10. Compare against a
  deliberately independent-column projection baseline on the identical prefix;
  do not assume finite-window harmonic columns are orthogonal.
- Fit residual <=0.1, suffix residual <=0.1 and at least three consecutive
  adjacent AN-04B frames with <=25-cent changes give
  `steady-harmonic-compatible`. Otherwise keep unavailable, unstable or
  large-residual reasons. No pitch correction, note boundaries or source count.
- Suffix residual can exceed one and is NOT clipped; it is prediction error,
  not a bounded probability. Zero/near-floor denominators stay unavailable.
- Budget: 350 million basis/orthogonalization work estimate per call; explicit
  error on overflow. Do not silently subsample frames.

## Evidence distinctions

Retain and replay AN-04B authored and recorded PCM with identical hashes and raw
pitch output; reuse its actual immutable librosa-YIN/audioFlux-NCF pitch votes.
This is not another MIR-provider inference run or a new pitch reference.
No external pair exists here for source isolation or temporal/source identity.

For numerical least-squares checking only, run actual NumPy and SciPy `lstsq`
on the same prefix matrix/frequency/PCM, cutoff 1e-10 (SciPy driver gelsd).
Agreement on arithmetic is a numerical comparison, not a music/source label.
Both may share LAPACK ancestry. Plexus does not vote on its own reference.
Freeze a deterministic small frame sample for this arithmetic cross-check;
report its sample coverage, both outputs, versions and source/parameter identities.

Authored additions: incommensurate mixtures, octave/unison two-source mixtures,
one-source gain changes, vibrato and note transitions, noise/DC/floor. Development
and transfer use disjoint rate/frequency tuples with identical source/model hash
set. Source count remains evaluator-only; never treat large residual as proof
of multiple instruments, or small residual as proof of one.

## Measurements and retention

Compare mean prefix/suffix residual versus independent-column baseline on
stationary monophonic cases, model compatibility coverage and temporal run
behavior; show ambiguity/nonstationary controls separately. Recorded metrics
are unannotated coverage only. Preserve abstention and all previous raw results.
Retain source snapshots and append the regression inventory without replacement.
No dependency installation, neural training, worker/runtime schema migration or
XR/visual publication. Ground-truth status false, confidence null, isolation
unverified. Production promotion requires independent multitrack annotation.
