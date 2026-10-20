# Confirmed fourth-difference onset evidence (v5)

Owner: analyzer / root shared contract integration. Explicit direct headless use:

```ts
analyzeAudio({samples, sampleRate,
  options: {adaptiveOnsets: true, adaptiveOnsetVersion: 5}});
```

The existing `TrackAnalysis.adaptiveOnsets` union now accepts
`confirmed-difference-v5`; version 4 remains `residual-innovation-v4`, and an
absent selector with the flag enabled remains v3. A supplied selector requires
the flag to be true and exactly 4 or 5; invalid values fail before progress.
No flag preserves default algorithm-7 accepted beat/chart/visual outputs. The
browser worker and general lab bridge still do not forward these options; this
is a direct diagnostic/headless API, not automatic UI or XR activation.

## Signal evidence

Fixed filter `y[n]=(x[n]-4x[n-1]+6x[n-2]-4x[n-3]+x[n-4])/16`. Its sinusoidal
amplitude response is `sin(omega/2)^4`, verified analytically by a regression.
Absolute coefficient sum is one. It suppresses smooth low-frequency carriers,
including several simultaneous tones; it does not identify instruments, count
voices or model all polyphony. Float32 quantization, high-frequency backgrounds,
smooth attacks and source discontinuities remain risks.

Let H=round(2 ms*fs), R=round(4 ms*fs), L=round(30 ms*fs), each at least one.
The direct branch compares preceding H versus observed next R samples of squared
filtered signal, ratio eight, numerical floor 1e-20 and raw L-history-relative
floor `1e-5*(8000/fs)^2`. Past attacks do not raise a long filtered-history gate.
It refines to maximum positive filtered-power step. Starting at refined index+5
(beyond four-sample memory), actual next H samples must sustain filtered power
above both the relative floor and one eighth of past power; observed silence
also rejects removals. Missing tail samples are never padded as evidence.

The second branch runs the preserved v4 extractor and confirms its proposals
with maximum observed fourth-difference power in the same R window, above the
same raw-relative/numerical floor. It retains the original v4 sample timestamp.
This peak test recovers short soft onsets diluted in an R-window mean; v4 remains
responsible for that branch's proposal and removal checks. It is not independent
oracle agreement. All proposals share strength suppression at round(3 ms*fs),
followed by ordered output; no accepted musical targets are emitted.

## Transport and uncertainty

Metadata publishes exact filter coefficients/memory, R as `refinementSamples`,
and the maximum possible forward support `lookaheadSamples=R+5+H`. This bound is
roughly 6 ms plus five samples, not a measured realtime or physical device latency.
`supportStartSample=max(0,proposal-L-4)`. For direct evidence support ends at
max(proposal+R,index+5+H), clipped to actual sample count; v4-confirmed evidence
ends at proposal+R, likewise clipped. Indices are half-open real sample ranges;
left-edge zero assumptions remain explicit endpoint ambiguity.

Each candidate carries `evidenceSource`, `time`, sample/proposal indices,
support bounds, `endpointAmbiguous`, `strength` and `innovationRatio`.
Direct strength is after-mean minus eight times before-mean, and ratio is
after-mean/before-mean. Confirmed strength is filtered peak power, and ratio is
peak/before-mean. Both use PCM-squared units and the same numerical denominator
floor; they are different statistics, not calibrated confidence or probability.
Their suppression ranking must not be interpreted as a musical likelihood.
The endpoint flag conservatively covers anchors before L+4 or within the maximum
forward margin of the file end. No initial/final acceptance is inferred.

The dependency-light normalizer checks clocks, exact window/filter constants,
real source-specific support, finite positive evidence, ordering/spacing and
physical timestamps; it returns a fresh value and drops undeclared candidate
fields. Independent JSON Schema checks shape/units/required fields, not relational
clock equations. Both validators are tested. Existing v1/v2/v3/v4 definitions and
their implementations remain preserved. See the [validation record](../../research/analyzer-lab/docs/AN-03D-VALIDATION.md)
for measured gains, retained failures, cost and reproduction commands.
