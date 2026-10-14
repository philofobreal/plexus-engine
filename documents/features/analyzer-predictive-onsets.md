# Predictive attack evidence v2

Owner: offline `src/analyzer/`; shared lightweight contracts in `src/types/`.
Implemented after AN-02 C2 exposed missed attacks over sustained carriers and
false modulation impacts. This is actual analyzer DSP and headless integration,
not an external-library label substitution or a diagnostic-only algorithm.

```ts
const result = analyzeAudio({ samples, sampleRate, options: { predictiveOnsets: true } });
const evidence = result.trackAnalysis.predictiveOnsets;
```

The switch is boolean; absence/false preserves the ordinary algorithm-7 JSON
projection. Existing `acousticOnsets: {}` retains the original v1 stream; both
may be requested together. V2's identity is `predictive-innovation-v2`. It is
explicit optional evidence, not the default accepted visual/beat/gameplay stream.
No current renderer or chart generator promotes these candidates automatically.
Invalid switches fail before progress; normalization removes malformed evidence.

## Model, units and support

For a sinusoid, `x[n] + x[n-2] = a*x[n-1]`, with
`a=2*cos(2*pi*f/fs)`. Fit `a=sum(p*z)/sum(p*p)`, clamp to [-2,2], from observed
past 30 ms, p=x[n-1], z=x[n]+x[n-2]. Prediction innovation is `e=z-a*p`.
Mean background innovation power is `(sum(z²)-2*a*sum(p*z)+a²*sum(p²))/count`,
clamped at zero against floating cancellation. Rolling sums are periodically
rebased; exact observed silent history resets them. Silent/default coefficient 2
is an initialization rule, not a detected 0 Hz musical source.

At rounded 2 ms proposal anchors, compute observed next 4 ms innovation power.
Require at least eight times prior innovation power and a relative signal-level
floor `backgroundPower * 1e-5 * (8000/fs)^4`, with numerical floor 1e-20.
The rate factor approximates second-difference power scaling; it is not an
audibility calibration or invariant response at every frequency. Observed active
history followed by silent continuation after the predictor's two-sample memory
is rejected as a cutoff. Missing clip tail is never interpreted as silence.

Peak-pick this evidence, refine within each actual lookahead to the largest
positive innovation-power step, then use descending-strength greedy suppression
at rounded 15 ms with sample-index ties. Neighboring sample buckets bound
suppression work after sorting, avoiding pairwise scans of every accepted event.
Refinement is a heuristic acoustic anchor, not guaranteed human audible start.

`strength` is mean innovation power above eight times background (PCM squared),
not normalized confidence or probability. `innovationRatio` compares prediction
error power, **not total signal power**; it must not be mixed with v1 `powerRatio`.
`predictorCoefficient` describes this fitted background filter, not pitch identity.

Each candidate carries integer `proposalSample`, `sampleIndex`, exact
`time=sampleIndex/fs`, actual `[supportStartSample,supportEndSample)` and
`endpointAmbiguous`. Model support includes past 30 ms plus two predictor samples;
lookahead is actual observed next 4 ms. Incomplete past/future is flagged. Consumers
must not treat unknown-prior clip-start candidates as confirmed playable targets.
The new lattice need not be radix-2 and is separate from the main FFT/grid hop.

Time is O(L+P log P) and working storage O(L/hop+P), where P is peak proposals;
the full audio input is already supplied. The model works best on locally
predictable backgrounds; arbitrary polyphony/noise, fast modulation and extremely
weak attacks can violate its assumptions. Existing verified synthetic successes
do not establish universal musical correctness.

See [AN-03 validation](../../research/analyzer-lab/docs/AN-03-VALIDATION.md) for
before/after counts, startup false positives, retained failed attempts, new
synthetic robustness, cost measurements and cumulative regression evidence.
