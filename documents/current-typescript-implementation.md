# Current TypeScript Implementation

This document records the active `plexus-engine/` implementation and clarifies older V0.2 prototype wording.

## Runtime Architecture

The maintained app is a Vite + TypeScript project, not a single-file HTML prototype.

1. **Composition:** `src/main.ts` builds the DOM shell and wires subsystem instances.
2. **Audio orchestration:** `src/audio/AudioEngine.ts` owns decode, source-node lifecycle, playback timing, seek/end reset, worker request ids, stale-result rejection, and worker termination.
3. **Offline analysis:** `src/audio/analyzer.worker.ts` owns deterministic DSP analysis only and communicates through typed worker messages.
4. **Shared contracts:** `src/types/index.ts` defines audio frames, beat events, visual track analysis, analysis requests, success messages, and error messages.
5. **Shared runtime state:** `src/state/store.ts` stores accepted analysis results, visual feature state, the abstract modulation bus, live visual tuning, target visual tuning, and render-facing state.
6. **UI projection:** `src/ui/DashboardUI.ts` owns controls, visual mode selection, enabled/disabled states, dashboard text, seek display, dramaturgy timeline drawing, and error projection.
7. **Visual rendering:** `src/visuals/` owns p5 rendering, particle lifecycle, shockwave lifecycle, beat-event consumption, visual cue consumption, and effect-mode delegation. `PlexusRenderer.ts` adapts p5 through `P5RendererBackend`, while `ClassicPlexusEffect.ts` and `TemporalMusicEffect.ts` draw through `VisualRendererBackend`.

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

`trackAnalysis` is the offline visual-music layer. It contains section-level structure, recurring temporal patterns, visual cue events, significant moments, per-frame feature vectors for melody, vocal, fx, density, brightness, and tension, plus dramaturgical `buildupConfidence` and `tensionTrends`. Effects should read these precomputed values from shared state during playback instead of running analysis in the render loop.

The analyzer worker derives these values from a fixed 1024-sample FFT pipeline. Each frame is Hann-windowed before the FFT, then the worker calculates spectral flux, relative bass/mid/high magnitude bands, spectral centroid, and spectral flatness. The render-facing `AudioFrame` values are smoothed projections of those spectral features: `e` is normalized RMS energy, `b` is density, `m` is melody presence, and `t` is fx presence. Beat events are selected from spectral-flux peaks and classified from the smoothed density/fx context: fx presence above `0.6` emits type 3, otherwise density above `0.7` emits type 2, and all other accepted peaks emit type 1.

Recurring temporal patterns are detected heuristically from full-track section signatures. The worker groups similar section-level energy, density, label, and dominant-feature signatures, publishes repeated groups as `MusicPattern` entries, and emits `pattern` cue events for each occurrence so effects can react when a known musical shape returns.

The dramaturgy engine builds a normalized pressure curve from `feature.tension * 0.34 + feature.density * 0.28 + frame.e * 0.22 + frame.eRatio * 0.16`. A rolling comparison between recent and previous pressure windows produces `buildupConfidence`; section-like trend segments publish rising, falling, or stable directions. `PlexusRenderer` blends the current buildup value into `State.modulation.kineticTension` before drawing, so pre-drop tension can influence visuals without adding analysis work to `draw()`.

## Modulation Bus And Morphing

`State.modulation` is the render-facing music abstraction:

- `kineticTension`: vocal, melody, tension, cue, and dramaturgy pressure.
- `lowFrequencyDrive`: density, bass-like frame drive, and energy.
- `spectralChaos`: fx, brightness, and high transient pressure.
- `rhythmicImpulse`: beat and cue decay impulses.
- `macroMomentum`: block-level energy and long-form momentum.

`computeModulationBus(frame, features, beatDecay, cueDecay, tuning)` clamps every output to `0.0..1.0` after applying `audioSensitivity`. Classic and temporal effects consume this bus for particle motion, line weight, glow, polygon flash, and central rings instead of reading raw frame values for animation strength.

`State.visualTuning` is the live interpolated tuning. `State.targetTuning` is the selected destination. Presets and sliders write to `targetTuning`; `PlexusRenderer.draw()` calls `applyTuningMorph()` before frame publication so numeric tuning values move toward their targets without overshooting. This keeps preset changes stage-safe during live playback.

## Visual Modes

The renderer supports two selectable visual modes through `State.visualMode`:

- `classic`: preserves the original Plexus particle network, center glow, beat shockwaves, and polygon flash behavior.
- `temporal`: keeps the same particle and shockwave primitives but re-composes them around full-track analysis. It does not draw pattern detections as bar-aligned labels and avoids unrelated decorative wave/ellipse motifs. Instead, `trackAnalysis` continuously modulates polygon color, movement, density, connection sensitivity, background tone, and central mechanism rings for beat, melody, vocal, fx, and pattern resonance.

Mode selection belongs to UI projection. `src/visuals/PlexusRenderer.ts` only synchronizes playback/analysis state and delegates to the selected effect file; no audio analysis may run in either visual mode.

## Visual Tuning And Playback UI

The active implementation includes a metadata-driven visual tuning panel, JSON preset loading and copy export, surface-level playback controls, fullscreen presentation mode, OBS-oriented presentation URL mode, loop/once playback, responsive metrics, and idle-hiding UI chrome. A single visual-surface click pins or unpins the chrome after the double-click detection window, while double-click remains the play/pause gesture. Unpinning through that intentional background click uses a fast `400ms` hide delay; ordinary inactivity, hover leave, and focus-out paths continue to use the standard `2600ms` delay.

For stream output, `chromaKeyMode` selects normal, green, or transparent background clearing. `performanceMode` disables radial-gradient glow work and chroma-key modes also skip those expensive glow paths. `?presentation=true` sets `State.uiVisible` to `false` and hides the UI chrome automatically.

The seek chrome includes an interactive dramaturgy timeline canvas. It does not perform analysis at runtime. `DashboardUI.drawDramaturgyTimeline()` projects precomputed `TrackAnalysis` data into layered canvas bands: section blocks use label-specific colors, `buildupConfidence` is drawn as a cyan tension wave, `tensionTrends.segments` are drawn as rising/falling/stable guide strokes, and selected cue kinds (`impact`, `break`, `pattern`) appear as vertical markers. During playback the playhead is a lookup/projection from `State.currentTime / State.duration`; clicking the timeline dispatches `AudioEngine.seek()` to the matching time. The `Track Dramaturgy` control can expand the timeline from compact seekbar context into a larger inspection view (`220px` on desktop, `172px` on mobile), and the canvas redraws during the height transition so HDPI scaling stays clean.

## Performance Notes

The renderer still uses offline preprocessing for music analysis. Playback-time dramaturgy access remains an indexed lookup over `State.trackAnalysis.buildupConfidence`.

Recent hot-path optimizations:

- `Particle.update()` now checks boundary distance with squared distance and uses vector normalization for center pull, avoiding `p.dist()`, `atan2()`, `cos()`, and `sin()` in that boundary path.
- `P5RendererBackend` caches fill color, stroke color, and stroke weight so repeated identical p5 state changes are skipped. The cache tracks `noStroke()` and `noFill()` activation state so a later identical stroke/fill call still re-enables drawing correctly.
- Expensive radial glow remains gated by `shouldUseExpensiveGlow()`, and chroma/low-latency modes skip those gradient paths.
- UI chrome intentionally separates fast user-requested hide feedback (`400ms` after background unpin) from passive idle hiding (`2600ms`) so normal interaction stays forgiving while explicit hide feels immediate.

Detailed documentation:

- Feature record: `documents/features/visual-tuning-presets-and-playback-ui.md`
- Acceptance criteria: `documents/acceptance-criteria/visual-tuning-presets-and-playback-ui-acs.md`
- Architecture decision: `documents/adr/ADR-001-visual-tuning-presets-and-playback-ui.md`

## AC Clarifications

- **AC 1.2 - Loading state:** Selecting a new file must stop playback, invalidate previous analysis, terminate any active worker, disable `Play` and `Seek`, reset visible playback position to `0:00`, and re-enable controls only after an accepted analysis result.
- **AC 1.3 / VT-7 - End state:** In `Loop` mode, natural track end resets the current source and immediately starts playback from `0:00`. In `Once` mode, natural track end resets playback time, seek bar, `Play` label, active strategy text, beat decay, snare flash, cue decay, and visual event indexes.
- **AC 1.4 - Seek:** Seeking must use the audio engine `seek()` path so playback offset, visible time, paused time, source-node lifecycle, and visual beat-event index are aligned in one transition.
- **AC 1.5 - Decode failure UI:** Browser-level audio decode or file-load failures must leave `Play` and `Seek` disabled, re-enable file selection, and show a file-load error in the dashboard.
- **AC 3.6 - Beat event classification:** Beat type classification is part of the analyzer contract: smoothed fx presence greater than `0.6` maps to type 3, otherwise smoothed density greater than `0.7` maps to type 2, and the fallback maps to type 1.
- **AC 5.2 - Analyzer bands:** The current worker uses Hann-windowed FFT spectral features rather than the older IIR crossover wording from the prototype.
- **AC 5.4 - Worker output:** The worker success payload includes `type`, `requestId`, `bpm`, `frames`, `events`, `hopSize`, and `trackAnalysis`. The worker may also emit typed failure payloads with `type`, `requestId`, `errorCode`, and `message`.
- **AC 8.1 - Worker and source cleanup:** New file loads must terminate superseded workers and ignore stale worker messages. Audio samples sent to the worker must be an explicit copy when playback still depends on the decoded `AudioBuffer`.
