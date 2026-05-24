# Current TypeScript Implementation

This document records the active `plexus-engine/` implementation and clarifies older V0.2 prototype wording.

## Runtime Architecture

The maintained app is a Vite + TypeScript project, not a single-file HTML prototype.

1. **Composition:** `src/main.ts` builds the DOM shell and wires subsystem instances.
2. **Audio orchestration:** `src/audio/AudioEngine.ts` owns decode, source-node lifecycle, playback timing, seek/end reset, worker request ids, stale-result rejection, and worker termination.
3. **Offline analysis:** `src/audio/analyzer.worker.ts` owns deterministic DSP analysis only and communicates through typed worker messages.
4. **Shared contracts:** `src/types/index.ts` defines audio frames, beat events, analysis requests, success messages, and error messages.
5. **Shared runtime state:** `src/state/store.ts` stores accepted analysis results and render-facing state.
6. **UI projection:** `src/ui/DashboardUI.ts` owns controls, enabled/disabled states, dashboard text, seek display, and error projection.
7. **Visual rendering:** `src/visuals/` owns p5 rendering, particle lifecycle, shockwave lifecycle, and beat-event consumption.

## Worker Contract

The accepted worker success payload is:

```ts
{
  type: 'analysis_done',
  requestId: number,
  bpm: number,
  frames: AudioFrame[],
  events: BeatEvent[],
  hopSize: number
}
```

The accepted worker failure payload is:

```ts
{
  type: 'analysis_error',
  requestId: number,
  errorCode: string,
  message: string
}
```

`requestId` is required so stale worker results cannot overwrite newer loads. `hopSize` is part of the runtime contract because render synchronization derives frame indexes from playback time, sample rate, and hop size.

## AC Clarifications

- **AC 1.2 - Loading state:** Selecting a new file must stop playback, invalidate previous analysis, terminate any active worker, disable `Play` and `Seek`, reset visible playback position to `0:00`, and re-enable controls only after an accepted analysis result.
- **AC 1.3 - End state:** Natural track end must reset playback time, seek bar, `Play` label, active strategy text, beat decay, snare flash, and visual beat-event index.
- **AC 1.4 - Seek:** Seeking must use the audio engine `seek()` path so playback offset, visible time, paused time, source-node lifecycle, and visual beat-event index are aligned in one transition.
- **AC 5.4 - Worker output:** The worker success payload includes `type`, `requestId`, `bpm`, `frames`, `events`, and `hopSize`. The worker may also emit typed failure payloads with `type`, `requestId`, `errorCode`, and `message`.
- **AC 8.1 - Worker and source cleanup:** New file loads must terminate superseded workers and ignore stale worker messages. Audio samples sent to the worker must be an explicit copy when playback still depends on the decoded `AudioBuffer`.
