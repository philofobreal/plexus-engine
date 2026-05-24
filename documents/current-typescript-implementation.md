# Current TypeScript Implementation

This document records the active `plexus-engine/` implementation and clarifies older V0.2 prototype wording.

## Runtime Architecture

The maintained app is a Vite + TypeScript project, not a single-file HTML prototype.

1. **Composition:** `src/main.ts` builds the DOM shell and wires subsystem instances.
2. **Audio orchestration:** `src/audio/AudioEngine.ts` owns decode, source-node lifecycle, playback timing, seek/end reset, worker request ids, stale-result rejection, and worker termination.
3. **Offline analysis:** `src/audio/analyzer.worker.ts` owns deterministic DSP analysis only and communicates through typed worker messages.
4. **Shared contracts:** `src/types/index.ts` defines audio frames, beat events, visual track analysis, analysis requests, success messages, and error messages.
5. **Shared runtime state:** `src/state/store.ts` stores accepted analysis results, visual feature state, and render-facing state.
6. **UI projection:** `src/ui/DashboardUI.ts` owns controls, visual mode selection, enabled/disabled states, dashboard text, seek display, and error projection.
7. **Visual rendering:** `src/visuals/` owns p5 rendering, particle lifecycle, shockwave lifecycle, beat-event consumption, visual cue consumption, and effect-mode delegation. `ClassicPlexusEffect.ts` and `TemporalMusicEffect.ts` contain the separate visual implementations.

## Worker Contract

The accepted worker success payload is:

```ts
{
  type: 'analysis_done',
  requestId: number,
  bpm: number,
  frames: AudioFrame[],
  events: BeatEvent[],
  hopSize: number,
  trackAnalysis: TrackAnalysis
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

`trackAnalysis` is the offline visual-music layer. It contains section-level structure, recurring temporal patterns, visual cue events, significant moments, and per-frame feature vectors for melody, vocal, fx, density, brightness, and tension. Effects should read these precomputed values from shared state during playback instead of running analysis in the render loop.

Recurring temporal patterns are detected heuristically from full-track section signatures. The worker groups similar section-level energy, density, label, and dominant-feature signatures, publishes repeated groups as `MusicPattern` entries, and emits `pattern` cue events for each occurrence so effects can react when a known musical shape returns.

## Visual Modes

The renderer supports two selectable visual modes through `State.visualMode`:

- `classic`: preserves the original Plexus particle network, center glow, beat shockwaves, and polygon flash behavior.
- `temporal`: keeps the same particle and shockwave primitives but re-composes them around full-track analysis. It does not draw pattern detections as bar-aligned labels and avoids unrelated decorative wave/ellipse motifs. Instead, `trackAnalysis` continuously modulates polygon color, movement, density, connection sensitivity, background tone, and central mechanism rings for beat, melody, vocal, fx, and pattern resonance.

Mode selection belongs to UI projection. `src/visuals/PlexusRenderer.ts` only synchronizes playback/analysis state and delegates to the selected effect file; no audio analysis may run in either visual mode.

## AC Clarifications

- **AC 1.2 - Loading state:** Selecting a new file must stop playback, invalidate previous analysis, terminate any active worker, disable `Play` and `Seek`, reset visible playback position to `0:00`, and re-enable controls only after an accepted analysis result.
- **AC 1.3 - End state:** Natural track end must reset playback time, seek bar, `Play` label, active strategy text, beat decay, snare flash, and visual beat-event index.
- **AC 1.4 - Seek:** Seeking must use the audio engine `seek()` path so playback offset, visible time, paused time, source-node lifecycle, and visual beat-event index are aligned in one transition.
- **AC 5.4 - Worker output:** The worker success payload includes `type`, `requestId`, `bpm`, `frames`, `events`, `hopSize`, and `trackAnalysis`. The worker may also emit typed failure payloads with `type`, `requestId`, `errorCode`, and `message`.
- **AC 8.1 - Worker and source cleanup:** New file loads must terminate superseded workers and ignore stale worker messages. Audio samples sent to the worker must be an explicit copy when playback still depends on the decoded `AudioBuffer`.
