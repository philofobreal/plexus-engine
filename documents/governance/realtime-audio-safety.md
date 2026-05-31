# Realtime Audio Safety

This document extends `../../AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

## Playback Contract

Playback uses native Web Audio. `AudioBufferSourceNode` is one-shot and must never be reused after stop, end, pause, or seek.

The only accepted playback time formula is:

```ts
playbackTime = playOffset + (audioContext.currentTime - playStartTime);
```

Do not derive canonical playback time from UI sliders, animation frame timestamps, p5 frame count, media elements, or wall-clock timers.

## Source Node Lifecycle

For manual stop, pause, seek, replacement, or cancellation:

1. Clear `source.onended`.
2. Stop the source in a guarded call.
3. Disconnect the source.
4. Drop the reference.
5. Create a fresh source for the next playback segment.

The `onended` handler may only handle natural track completion after confirming the computed playback time is at the end threshold.

## Realtime Work Budget

The render loop may read precomputed frames and events. It must not:

- Decode audio.
- Analyze spectra.
- Run beat detection.
- Spawn workers.
- Await promises.
- Allocate unbounded objects.
- Mutate worker result arrays.

Visual modes may branch on precomputed `trackAnalysis` features, sections, cues, and patterns, but they must keep the same realtime budget: no audio analysis, no worker spawning, and no unbounded per-frame allocation in drawing paths.

## Seek And End Safety

Seek must synchronously align:

- Playback offset.
- Current time.
- Visual event index.
- Dashboard projection.
- End-of-track reset state.

Track end must reset user-visible playback state, visual transient state, and event consumption state in one ordered transition.

## Memory Safety

Audio buffers used for playback must remain valid after analysis dispatch. If worker analysis uses transferable buffers, the implementation must document whether it copied or transferred data and why playback data cannot be detached.

No audio path may depend on `p5.sound`.
