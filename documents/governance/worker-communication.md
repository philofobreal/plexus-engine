# Worker Communication

This document extends `../../AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

## Boundary Contract

Worker input and output are public contracts. Keep them typed and versionable.

Current analysis request fields:

- `requestId`.
- `algorithmVersion`.
- `samples` as an `ArrayBuffer`.
- `sampleRate`.

Current analysis success message fields:

- `type: 'analysis_done'`.
- `requestId`.
- `bpm`.
- `bpmConfidence`.
- `gridConfidence`.
- `downbeatConfidence`.
- `tempoCandidates`.
- `adaptiveThreshold`.
- `frames`.
- `events`.
- `hopSize`.
- `beats` — authoritative beat times (seconds), the single timing source for downstream consumers.
- `barStarts` — authoritative downbeat (bar start) times (seconds).
- `timingConfidence` — unified `{ tempo, beat, grid, overall }` confidence model, each in `[0, 1]`.
- `trackAnalysis`.

The authoritative musical timing model (`tempo`, `tempoConfidence`, `beats`, `beatConfidence`,
`barStarts`, `alternativeTempos`, `timingConfidence`) is carried on the nested `TrackAnalysis`
as well, and `beats` / `barStarts` / `timingConfidence` are mirrored at the root for direct
worker consumers. These are public-contract fields: extending them is a single-owner schema
task. `tests/fixtures/analyzer/analysis-result.schema.json` is the authoritative shape and
must be updated together with `src/types`, `normalizeAnalysisResult`, and the empty-template
fallbacks in `state/store`. No downstream module may compute an independent beat grid; all
beat/bar timing must be read from this model.

Current failure message fields:

- `type: 'analysis_error'`.
- `requestId`.
- `errorCode`.
- `message`.

## Analyzer Worker Structure

`src/audio/analyzer.worker.ts` keeps the worker boundary as a typed message contract, but the analysis implementation is no longer a monolithic `onmessage` function. The message handler is a thin boundary shell that forwards samples into `analyzeAudio()`, relays progress, and posts a typed success or failure payload. The analyzer core now runs as a data-oriented pipeline:

`SpectralCalibration -> FeatureExtractor -> GridAligner (TempoEstimator -> BeatTracker) -> FeatureNormalizer -> FeatureClassifier -> TemporalSmoother -> SectionAnalyzer -> DramaturgyBuilder / BeatEventClassifier -> SpectralPivot`.

Internal ownership:

- `SpectralCalibration` owns deterministic track-level pre-pass estimation of Hz band centers and safety-clamped band ranges, with default-band fallback for low-confidence input.
- `FeatureExtractor` owns sample-window processing, Hann-windowed FFT execution, RMS, spectral flux, Hz-based band ratios, centroid, flatness, pitch-confidence, Zero Crossing Rate, spectral rolloff, spectral crest arrays, and typical RMS/flux maxima.
- `GridAligner` is the single authoritative timing engine. It owns the onset-envelope-driven pipeline `TempoEstimator -> half/double resolution -> BeatTracker -> bar/downbeat alignment`, producing the legacy fields (BPM, tempo candidates, beat/bar length, `gridOffset`, BPM/grid/downbeat confidence) and the new model (`beats`, `barStarts`, `tempo`, `alternativeTempos`, unified `timingConfidence`). Half/double resolution uses three orthogonal cues: phase-invariant onset concentration, beat coverage (a true tempo populates most beats; its double leaves every other beat empty), and a kick-vs-snare downbeat score. A fast-tempo preference resolves toward the actual beat rate (e.g. drum & bass at ~174, not its 87 half-time feel) only when the fast grid is fully covered.
- `TempoEstimator` owns deterministic autocorrelation/comb-filter tempo estimation over the onset envelope (70-185 BPM), emitting ranked `{ bpm, confidence }` candidates with a perceptual prior.
- `BeatTracker` owns Ellis-style dynamic-programming beat tracking. It intentionally extrapolates the grid through silent/breakdown regions to keep musical timing continuous.
- `FeatureNormalizer` owns allocation of normalized `Float32Array` views from raw analyzer arrays and precomputed typical maxima. It must not sort or recompute percentiles in the orchestration path.
- `FeatureClassifier` owns semantic frame scoring for melody, vocal, FX, density, brightness, and tension from normalized vectors and extracted DSP features such as ZCR, spectral crest, flatness, rolloff, and Hz band ratios. Melody and vocal are spectral heuristics, not stem separation.
- `TemporalSmoother` owns EMA smoothing for classifier outputs and starts from the first input value to avoid artificial fade-in at track start.
- `SectionAnalyzer` owns bar-block aggregation, adaptive threshold calculation, `BarAnalysis` output, section splitting, critically low tempo/grid energy-reactive boundary fallback, evidence-based section-label scoring, section RMS fields, and dominant-feature selection.
- `DramaturgyBuilder` owns visual cue emission, significant musical moment candidates, and recurring `MusicPattern` grouping from deterministic fuzzy section similarity.
- `BeatEventClassifier` owns accepted beat peak classification and the mapping from internal semantic hit kinds to the public `1 | 2 | 3` beat-event type contract. Visual beat `events` are derived from the authoritative `GridAligner.beats`, not an independent peak-picker. Beats that the DP tracker extrapolated through silence carry no transient and must be suppressed as visual events (the grid still spans the silence), so breakdowns do not flood the renderer with phantom beat flashes.
- `SpectralPivot` owns the offline buildup/LOW_DROP compensation pass and the absolute `sE <= 0.04` noise gate that zeroes delicate feature projections.

The worker must remain dependency-free from DOM, p5, `AudioEngine`, UI, renderer modules, and shared mutable runtime state. New analysis behavior should be added to the owning class above or to a similarly focused worker-internal class, not by growing the message handler.

Tempo confidence is part of the worker result contract, not UI-only metadata. Root `AnalysisResult` and nested `TrackAnalysis` payloads must both carry `bpmConfidence`, `gridConfidence`, `downbeatConfidence`, and `tempoCandidates`. If candidates exist, root `bpm` must equal `tempoCandidates[0].bpm`. Normalization for legacy or partial payloads must provide deterministic fallbacks: confidence values default to `0` and `tempoCandidates` defaults to an empty array.

The confidence fields are evidence signals with explicit limits. `bpmConfidence` must not be raised merely because the grid was derived from that same BPM estimate. Downbeat confidence must be capped by weak BPM/grid evidence. The current low-transient evidence cap is intentionally named and documented as kick-transient evidence; do not treat it as a universal rhythm-confidence measure for bass-light material, and do not apply it as a multiplier to timing-only grid confidence.

## Race Prevention

Every load creates a new current request id. A worker response may update state only when its request id equals the current request id.

When a new file is selected:

- Stop playback.
- Invalidate the previous request id.
- Terminate any active worker.
- Clear or quarantine old analysis results until the new result is accepted.
- Reset `State.trackAnalysis` from a fresh deep copy of the empty analysis template. Do not assign the empty template object by reference; nested arrays and objects must not be shared between track loads.

Stale success and stale failure messages must be ignored after worker cleanup.

`AudioEngine.clearAnalysisState()` currently enforces reset isolation with deep-copy serialization:

```ts
State.trackAnalysis = JSON.parse(JSON.stringify(EMPTY_TRACK_ANALYSIS));
```

This is part of the memory-management contract. The empty `TrackAnalysis` object graph contains nested structures, including trend data, and reusing those object references can pollute later loads or make stale state appear current.

## Transfer And Copy Policy

Choose one intentionally:

- Copy sample data before posting to the worker when playback still depends on the source buffer.
- Transfer sample data only when the sender no longer needs the transferred buffer.

Do not pass `getChannelData(0).buffer` as a transferable unless playback safety has been proven and documented.

When the playback path still needs the decoded `AudioBuffer`, the default implementation policy is:

- Allocate a new `Float32Array` with the same length as the source channel.
- Copy channel data with `analysisSamples.set(channelData)`.
- Transfer only `analysisSamples.buffer` to the worker.
- Keep the decoded `AudioBuffer` owned by `AudioEngine` for playback.

## Deterministic Output

For the same input samples, sample rate, and algorithm version, worker output must be deterministic. Avoid nondeterministic time, random values, shared mutable globals, and environment-dependent thresholds.

When recurring temporal patterns are emitted, they must be derived from deterministic full-track features. The current implementation groups sections by Euclidean distance over energy, density, and dominant-feature evidence rather than exact string signatures. Pattern ids must be stable for one accepted worker result and must be referenced by cue events through optional `patternId` fields.

Tempo candidates must also be deterministic over the 70-185 BPM range. Half/double-time resolution may reorder only close-score aliases such as 85/170, 64/128, or 88/176; it must not hide a clearly dominant candidate. The fast-tempo preference only applies when the faster grid is genuinely fully covered, so a true slow track (e.g. 70 BPM, whose 140 double leaves every other beat empty) stays slow, while drum & bass at 174-185 locks the full beat rate instead of its half-time feel. Negative fixtures such as ambient, noise, spoken material, random clicks, and sparse one- or two-onset input should keep BPM/grid/downbeat confidence low.

## Termination And Errors

Workers must terminate on:

- Successful accepted result.
- Analysis error.
- User cancellation or superseded load.
- Component teardown.

Worker errors must restore UI control state through the audio/UI boundary and must not leave playback controls permanently disabled.

If worker errors, stale worker messages, or cancellation paths are changed, add or update a targeted regression test covering the boundary contract.
