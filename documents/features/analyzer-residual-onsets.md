# Version-selected attack evidence v4

Owner: offline analyzer and dependency-light shared contracts; root owns this
integration. New DSP lives in `src/analyzer/ResidualOnsets.ts`, normalization and
model provenance in `src/types/residualOnsets.ts`.

```ts
const result = analyzeAudio({samples, sampleRate,
    options: {adaptiveOnsets: true, adaptiveOnsetVersion: 4}});
const evidence = result.trackAnalysis.adaptiveOnsets;
```

This uses the existing adaptive output field. Omitting the selector while enabling
`adaptiveOnsets` keeps [v3](analyzer-adaptive-onsets.md); absence/false of the flag
keeps the ordinary algorithm-7 projection. This version uses selector 4 with the
flag true; [v5](analyzer-difference-onsets.md) now also supports selector 5.
Malformed selectors fail before progress. V1/v2 remain available alongside the
adaptive versions. Algorithm IDs discriminate
the shared union. No existing v3 assertions, definition or timestamp was replaced.

Activation is through direct headless API calls and retained diagnostic exporters.
The normal browser worker and general lab CLI bridge do not forward this option.
No dashboard/XR enablement or accepted musical-target promotion is claimed.

## Background estimate and gates

V3's rolling 30 ms model can include earlier attacks, obscuring a weak new attack.
V4 additionally stores non-overlapping rounded 2 ms block statistics within that
history bound (at most 15 blocks; rounding may allow fewer). Fit each block's
single-tone recurrence `x[n]+x[n-2]=a*x[n-1]`, clamped to [-2,2]. A block is
eligible when normalized residual power is at most `1e-5*(8000/fs)^4`. Require
at least three eligible blocks with coefficient range at most `1e-6*(8000/fs)^2`.
Use the lowest-error eligible coefficient, with the latest block on equal error.
Otherwise use the original rolling coefficient and v3 contrast policy.

Eligible blocks are temporal consistency evidence, not independent musical
samples; recurrence terms share boundary samples. Eligibility is a heuristic,
not pitch/instrument confidence or a general proof of background correctness.
Several voices may locally fit one recurrence and still defeat this detector.

On the clean-block path compare observed next 4 ms innovation to the recent 2 ms
innovation without the previous-attack full-history guard. On fallback preserve
v3's model-quality-dependent contrast. Contrast multiplier eight, numerical floor
1e-20, real-tail/cutoff and observed continuing-innovation guards remain. The
relative floor uses `backgroundPower*1e-5*(8000/fs)^2` in v4. These fixed development
constants have declared synthetic evidence, not universal rate/audibility calibration.

Refinement remains the maximum positive innovation-power step on rounded 2 ms
proposal anchors, with 3 ms strength-ordered suppression and sample-index ties.
`strength` is excess mean innovation power in PCM squared; `innovationRatio`
is neither probability nor v1 total-energy ratio. Full history/lookahead bounds
and endpoint ambiguity remain on the real PCM clock. All used model inputs lie
inside the published support; short-block estimation may use only a subset.

## Model provenance

V4 publishes `backgroundEstimator: 'clean-block-or-rolling'`; every candidate has:

- `backgroundModel`: `clean-block` or `rolling`.
- `modelBlockCount`: number of eligible past blocks, not confidence.
- `predictorSupportStartSample` / `predictorSupportEndSample`: actual half-open
  coefficient-estimation support, before the proposal. Clean support includes one
  hop plus the two recurrence-memory samples; fallback uses full rolling support.

Malformed model identity/count/support is rejected by normalization; wire schema
requires the fields and keeps v3 strict. Incomplete past/future remains explicitly
ambiguous, including an initial model with no observed past. Candidates are not
automatically accepted visual impacts, instrument labels, beats or XR targets.

The DSP remains deterministic, headless and input-preserving. Work is
O(L+P log P), storage O(L/hop+P), with bounded short-block bookkeeping. Profiling
shows an additional cost over v3; see [AN-03C validation](../../research/analyzer-lab/docs/AN-03C-VALIDATION.md)
for actual gains, partial polyphonic transfer, five beating false positives,
preserved failed revisions, runtime observations and cumulative test history.
