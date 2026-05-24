# Worker Communication

This document extends `../../AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

## Boundary Contract

Worker input and output are public contracts. Keep them typed and versionable.

Minimum analysis request fields:

- Request id.
- Sample payload.
- Sample rate.
- Algorithm version when behavior changes.

Minimum analysis success fields:

- Request id.
- BPM.
- Frame list.
- Beat event list.
- Hop size.
- Track analysis when visual-music features, sections, cues, and patterns are part of the accepted algorithm version.

Minimum failure fields:

- Request id.
- Error code.
- Human-readable message.

## Race Prevention

Every load creates a new current request id. A worker response may update state only when its request id equals the current request id.

When a new file is selected:

- Stop playback.
- Invalidate the previous request id.
- Terminate any active worker.
- Clear or quarantine old analysis results until the new result is accepted.

Stale success and stale failure messages must be ignored after worker cleanup.

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
