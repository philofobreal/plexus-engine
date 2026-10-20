# Opt-in acoustic attack candidates — AN-02 first cycle

The headless analyzer can publish independent acoustic attack candidates:

```ts
const result = analyzeAudio({
    samples, sampleRate,
    options: { acousticOnsets: { windowSize: 512, hopSize: 128 } }
});
const evidence = result.trackAnalysis.acousticOnsets;
```

This is a research opt-in at `analyzeAudio()`, not a dashboard control or worker
request option. The ordinary worker continues its algorithm-7 default path.
The existing WAV research bridge also keeps its explicit legacy option allowlist;
this cycle measures the opt-in directly through the retained headless diagnostic.
Omitting the option preserves the prior result projection. The independent stream
identifies itself as `overlap-energy-rise-v1`; it does not feed accepted `events`,
beats, bars, sections, semantic dramaturgy, choreography or XR chart selection.

## Signal and timestamp contract

PCM and clocks use the [public signal contract](analyzer-signal-contract.md).
The acoustic FFT is independent from the main feature hop. Both window/hop sizes
are validated powers of two; allowed overlap is 50% or 75%, with N=512/H=128
defaults. Frames are centered on mH with a symmetric Hann window. A final padded
context center covers the last real sample, including the 50% overlap endpoint.
Padding supplies context, never new observed sample positions.

Positive magnitude flux excludes DC and Nyquist. Its EMA uses the physical time
constant tau=2 ms, with alpha = 1 − exp(−H/(fs·tau)). At a local flux maximum the
algorithm searches actual FFT support for the largest positive sample-power step.
The published time is exactly `sampleIndex/sampleRate`. This step may follow the
beginning of a pluck, noise burst or slow ramp; sample precision is not proof of
musical onset accuracy.

Mean observed power must increase at least twofold across 30 ms before/after the
localized sample, with post RMS at least 1e-6. At a truncated endpoint, candidate
evidence requires silent available prior samples; at the first sample there is
no observed prior context. Both cases remain explicitly ambiguous. An empty
pre-interval uses the numerical floor, not a claim that unobserved audio was silent.
Candidates less than 15 ms apart undergo sequential pairwise suppression, keeping
the stronger candidate. Replacing a later candidate can extend suppression along
a rising-strength chain; dense-event recall is not established.

| Field | Meaning |
| --- | --- |
| `sampleRate`, `sampleCount`, `windowSize`, `hopSize` | Exact PCM clock and independent acoustic analysis settings |
| `sampleIndex`, `time` | Refined observed sample and its time in seconds |
| `supportStartSample`, `supportEndSample` | Half-open real support `[start,end)` of the selected FFT frame |
| `endpointAmbiguous` | The full 30 ms pre/post observation is unavailable |
| `strength` | Raw smoothed magnitude flux; no probability or cross-setting calibration |
| `powerRatio` | Observed post/pre mean-power ratio, denominator floor 1e-12 |
| `spectralFlatness` | Bounded magnitude flatness on the selected frame, not a source identity |

Normalization rejects inconsistent clocks/timestamps, unordered candidates,
invalid bounds, support longer than N and contradictory endpoint ambiguity. JSON
schema validates the additive shape; runtime normalization additionally validates
cross-field relationships. Normalization copies evidence, never invents it for
legacy results. Empty candidates mean no selected evidence, not missing support.

## Demonstrated scope and next promotion gate

The first cycle demonstrates isolated authored impulse phase coverage, fixed
noise/pluck attacks, endpoint observation and declared sustain/cutoff negatives.
The [validation record](../../research/analyzer-lab/docs/AN-02-VALIDATION.md) includes
misses, false positives and timing error with denominators and source identities.

The energy-doubling gate can miss quiet attacks over a loud bed and closely spaced
attacks. A fixed 512-sample window means 64 ms at 8 kHz and 5.33 ms at 96 kHz,
so physical resolution differs. Raw flux is not comparable across gain, windows
or rates. Recorded music, ramps, mixtures, long-track cost and consumer selection
remain separate acceptance work. No confidence probability, drum label, downbeat
or playable-target guarantee follows from these candidate fields.

The new bounded flatness helper uses the same stabilized bins in geometric and
arithmetic means; the new EMA has a time-based coefficient. This cycle uses them
only in the optional stream. Migration of legacy classifier flatness and legacy
fixed-alpha smoothing remains pending. Promotion needs annotated musical cases,
candidate recall and selection-loss measurements, protected negative regressions,
and consumer-specific evidence under the [development method](../../research/analyzer-lab/docs/ANALYZER-DEVELOPMENT-METHOD.md).
