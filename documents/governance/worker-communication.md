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
- `frames`.
- `events`.
- `hopSize`.
- `trackAnalysis`.

Current failure message fields:

- `type: 'analysis_error'`.
- `requestId`.
- `errorCode`.
- `message`.

## Analyzer Worker Structure

`src/audio/analyzer.worker.ts` keeps the worker boundary as a typed message contract, but the analysis implementation is no longer a monolithic `onmessage` function. The message handler is a thin orchestration shell that constructs class-owned analysis steps, assembles the final `TrackAnalysis`, and posts a typed success or failure payload.

Internal ownership:

- `FeatureExtractor` owns sample-window processing, Hann-windowed FFT execution, RMS, spectral flux, bass/mid/high band ratios, centroid, flatness, pitch-confidence arrays, and typical RMS/flux maxima.
- `GridAligner` owns BPM estimation, beat length, bar length, strongest-hit anchoring, downbeat search, and `gridOffset`.
- `SectionAnalyzer` owns bar-block aggregation, adaptive threshold calculation, `BarAnalysis` output, section splitting, section labels, section RMS fields, and dominant-feature selection.
- `DramaturgyBuilder` owns beat-event selection, visual cue emission, significant musical moment candidates, and recurring `MusicPattern` grouping from deterministic section signatures.

The worker must remain dependency-free from DOM, p5, `AudioEngine`, UI, renderer modules, and shared mutable runtime state. New analysis behavior should be added to the owning class above or to a similarly focused worker-internal class, not by growing the message handler.

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

When recurring temporal patterns are emitted, they must be derived from deterministic section signatures or other deterministic full-track features. Pattern ids must be stable for one accepted worker result and must be referenced by cue events through optional `patternId` fields.

## Termination And Errors

Workers must terminate on:

- Successful accepted result.
- Analysis error.
- User cancellation or superseded load.
- Component teardown.

Worker errors must restore UI control state through the audio/UI boundary and must not leave playback controls permanently disabled.

If worker errors, stale worker messages, or cancellation paths are changed, add or update a targeted regression test covering the boundary contract.
