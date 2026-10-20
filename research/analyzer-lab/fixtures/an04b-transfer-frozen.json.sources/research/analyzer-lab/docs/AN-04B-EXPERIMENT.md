# AN-04B: raw-mixture pitch proposals and two-provider pitch evidence

Frozen before benchmark selection, 2026-10-14. Integration owner: Codex / root.
Owners: pure analyzer/types/semantics and isolated research diagnostics/tests.

## Hypothesis and scope

Replace supplied-F0 dependence for a new raw-PCM diagnostic with an actual
periodicity estimator. Measure monophonic F0 separately from polyphonic mixture
behavior. Period alternatives are not simultaneous voices or separated sources.
Even two-provider pitch agreement cannot prove source isolation. The adapter to
AN-04A must preserve unresolved-mixture status, missing timbre and missing note
boundaries rather than publish guessed instruments, phrases or XR targets.

## Frozen parameters and comparisons

- Input: finite original-clock channel-0 float32 PCM; no resampling/padding.
  Frame length is next power of two >=0.08*sampleRate, hop round(0.02*sampleRate).
  Only complete frames; explicit unobserved tail and full support interval.
- F0 range 80–1000 Hz, CMNDF threshold 0.15, centered RMS floor 1e-6.
  Difference function over a common fixed overlap length for all lags;
  first in-range local trough below threshold. Maximum three periodicity
  alternatives. No confidence probability or polyphonic transcription claim.
- Baseline: integer-lag frequency; improvement: bounded parabolic trough
  refinement on the same difference function. No truth-driven octave correction,
  adaptive range or post-hoc timestamp correction.
- Resource budgets: 4096 complete frames, 350 million pair-difference operations;
  unsupported clocks/options and overflow fail explicitly, never silently sample
  or discard analyzed frames. Maximum sample rate 96000 Hz in this prototype.
- Actual external pair: librosa 0.11.0 YIN, audioFlux 0.1.9 PitchNCF RECT,
  same whole PCM and original frame support/hop, no centering. Native NCF returns
  the frequency array directly. Versions/runtime/native/source hashes retained.
- Agreement: same frame index/support/PCM identity, both finite frequencies in
  range and absolute log-frequency difference <=25 cents. Retain both original
  frequencies, disagreement, geometric mean and null confidence. Qualification
  of Plexus requires <=25 cents to BOTH frequencies, not just their mean.
  One supported absent vote gives no eligible pair; unmatched means unknown.

## Data and gates

Authored stable monophonic tones and harmonic complexes; disjoint development
versus frozen frequency/rate/phase tuples. Truth provided only to evaluator,
not extraction or provider adapters. Include silence, DC, below-floor PCM,
deterministic noise, missing fundamental and two-source mixtures (including
octave/unison). Mono pitch accuracy and polyphonic/non-tonal outputs are reported
separately. Agreement on negative or ambiguous mixtures is not truth.

Measure raw signed/absolute cents, <=25/50-cent coverage, missing proposals and
integer-versus-refined error on authored monophonic cases. Compare actual provider
agreement/qualification and negative exposure without treating absence as a
negative annotation. Frozen transfer requires identical algorithm/generator/
protocol hashes. Preserve rejected cases and all predecessor tests/results.

Run short original-rate channel-0 excerpts of the three user-authorized Prodigy
files if readable, with original file and decoded/excerpt PCM hashes. These are
unannotated mixtures: report coverage/agreement only, no pitch/source accuracy.
Provider agreement stays pseudo-label evidence and never enters source identity,
motif training, dramaturgy cues, choreography publication or XR scoring.

References: [librosa 0.11.0 YIN](https://librosa.org/doc/0.11.0/generated/librosa.yin.html),
[audioFlux pitch](https://audioflux.top/mir/pitch.html). YIN and NCF share periodicity
assumptions despite different implementations: correlated errors remain possible.
