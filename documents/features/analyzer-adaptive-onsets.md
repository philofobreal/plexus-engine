# Adaptive attack evidence v3

Owner: offline analyzer; shared transport and normalization owned by root in this
integration. Actual DSP is `src/analyzer/AdaptiveOnsets.ts`, with lightweight
`src/types/adaptiveOnsets.ts`. No dependencies or playback/renderer changes.

```ts
const result = analyzeAudio({samples, sampleRate, options: {adaptiveOnsets: true}});
const candidates = result.trackAnalysis.adaptiveOnsets?.candidates;
```

The boolean option defaults off. Main algorithm 7 and accepted musical/visual/XR
events keep their previous behavior. V1 `acousticOnsets`, v2 `predictiveOnsets`
and v3 `adaptiveOnsets` can be requested together; their exact algorithm identities
remain separate. V3 does not substitute external library timestamps or truth.
This switch currently applies to direct headless API calls and the retained
diagnostic exporters. The normal browser worker request and the general lab CLI
bridge do not forward these optional onset flags. No dashboard/XR UI enablement
is claimed; a later request-policy integration needs its own validation.
Malformed options fail before progress; malformed optional output is discarded
by normalization. JSON Schema validates the additive wire shape independently.

## Adaptive contrast

Fit the same single-tone recurrence as [v2](analyzer-predictive-onsets.md) over
observed past 30 ms: `e[n]=x[n]-a*x[n-1]+x[n-2]`, coefficient clamped to [-2,2].
Let B be its mean residual power over that history, S the original signal power,
and C the mean residual power over the most recent rounded 2 ms. The active
contrast is C on poorly predicted histories (`B > 0.1*S`), otherwise `max(B,C)`.
This avoids treating every tonal-envelope phase change as a new attack while
reducing previous-attack masking on noise-dominated histories. It is a model
quality heuristic, not a calibrated instrument, audibility or tonality classifier.

Compute mean next observed 4 ms innovation A on rounded 2 ms anchors. Require
`A >= 8*max(contrast,1e-20)` and the numerical/relative floor
`max(1e-20, S*1e-5*(8000/fs)^3)`. The changed rate exponent is a development
choice tested on the declared matrices; it does not guarantee rate invariance.
Retain the actual-silence cutoff guard. Additionally reject a spike whose observed
continuing innovation beyond the two-sample predictor memory decreases below
one eighth of the active contrast. Never interpret an unavailable future as zero.
This source-removal heuristic has limited synthetic evidence; audible cut clicks,
very brief transients and difficult mixtures need separate annotation/testing.

Refine to the maximum positive innovation-power step, peak-pick, and suppress
nearby candidates by descending strength, sample-index ties, within rounded
3 ms rather than 15 ms. Consumer-specific target spacing is a separate decision.
The candidate stream still has an explicit 3 ms resolution/suppression limit.

## Units and clock

Metadata explicitly publishes `contrastSamples` and `minimumSeparationSamples`
in addition to full 30 ms history, 4 ms lookahead and 2 ms proposal hop. All
durations use `max(1,round(seconds*fs))`. `strength=A-8*contrast` has PCM-squared
units. `innovationRatio=A/max(contrast,1e-20)` is neither probability nor v1
total-power ratio. Shared v2 candidate field shapes retain their units; the
comparison baseline differs and the algorithm ID is always `adaptive-innovation-v3`.

Integer proposal/refined indices, `time=sampleIndex/fs`, actual half-open support
and incomplete-history/future flags are retained. Strength/refinement and endpoint
uncertainty do not certify a playable target. In particular, unconfirmed clip-start
candidates remain visible. Fit/storage/refinement are deterministic, do not mutate
PCM and stay headless. The lattice is separate from the main FFT/grid hop.
Work is O(L+P log P), storage O(L/hop+P); input PCM is additional supplied storage.

See [AN-03B validation](../../research/analyzer-lab/docs/AN-03B-VALIDATION.md) for
the actual improvements, retained failed revisions, new mixed-density misses,
negative counterexamples, long-profile observations and cumulative test history.
