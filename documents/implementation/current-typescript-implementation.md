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
  adaptiveThreshold: number,
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

`trackAnalysis` is the offline visual-music layer. It contains bar-level dynamics, section-level structure, recurring temporal patterns, visual cue events, significant moments, per-frame feature vectors for melody, vocal, fx, density, brightness, and tension, plus dramaturgical `buildupConfidence`, `spectralPivot`, and `tensionTrends`. `VisualFeatureFrame.melody` remains the internal/canonical melody feature signal for track analysis, cues, modulation, and temporal rendering; the dashboard-facing melody metric is Melody Presence from the `AudioFrame.m` compatibility projection. Effects should read these precomputed values from shared state during playback instead of running analysis in the render loop.

The analyzer worker derives these values from a fixed 1024-sample FFT pipeline. Each frame is Hann-windowed before the FFT, then the worker calculates spectral flux, relative bass/mid/high magnitude bands, spectral centroid, and spectral flatness. Harmonic stability, pitched transient confidence, and a simple vocal formant ratio separate melody, vocal, and fx projections more reliably than raw band ratios alone. The render-facing `AudioFrame` values are smoothed compatibility projections of those spectral features: `e` is normalized RMS energy, `b` is a legacy field containing density projection rather than bass, `m` is a legacy field containing melody-presence projection rather than mid band, and `t` is a legacy field containing FX-presence projection rather than treble. Beat events are selected from spectral-flux peaks and classified from the smoothed density/fx context: fx presence above `0.6` emits type 3, otherwise density above `0.7` emits type 2, and all other accepted peaks emit type 1.

Bar analysis is derived from BPM-aligned four-beat windows. Each `BarAnalysis` entry stores `start`, `end`, `energy`, `density`, `avgRms`, `peakRms`, BarAnalysis bass/mid/treble spectral-band ratios, macro `HIGH`/`LOW` state, and dominant feature. `TrackSection` entries also carry `avgRms` and `peakRms`. `AudioEngine.normalizeTrackAnalysis()` backfills these fields for older analysis payloads or presets that do not yet contain the expanded contract.

Recurring temporal patterns are detected heuristically from full-track section signatures. The worker groups similar section-level energy, density, label, and dominant-feature signatures, publishes repeated groups as `MusicPattern` entries, and emits `pattern` cue events for each occurrence so effects can react when a known musical shape returns.

The dramaturgy engine builds a normalized pressure curve from `feature.tension * 0.34 + feature.density * 0.28 + frame.e * 0.22 + frame.eRatio * 0.16`. A rolling comparison between recent and previous pressure windows produces `buildupConfidence`; section-like trend segments publish rising, falling, or stable directions. Spectral Pivot is an offline post-process that boosts melody, vocal, fx, and tension only when `sE > 0.04`, `eRatio < 0.55`, and buildup or `LOW_DROP` tension is present. Below the `sE <= 0.04` noise gate, delicate features, `AudioFrame.m`, `AudioFrame.t`, and `spectralPivot` are forced to exact zero. `PlexusRenderer` blends the current buildup value into `State.modulation.kineticTension` before drawing, so pre-drop tension can influence visuals without adding analysis work to `draw()`.

## Modulation Bus And Morphing

`State.modulation` is the render-facing music abstraction:

- `kineticTension`: vocal, melody, tension, cue, and dramaturgy pressure.
- `densityDrive`: density/energy-driven animation signal.
- `spectralChaos`: fx, brightness, and high transient pressure.
- `rhythmicImpulse`: beat and cue decay impulses.
- `macroMomentum`: block-level energy and long-form momentum.

`computeModulationBus(frame, features, beatDecay, cueDecay, tuning)` clamps every output to `0.0..1.0` after applying `audioSensitivity`. It remains the compatibility API for callers that need a fresh object. The render loop uses `writeModulationBus(State.modulation, frame, features, beatDecay, cueDecay, tuning)` instead, so `State.modulation` keeps a stable object reference and draw-time updates do not allocate a new modulation object each frame. Transient reset follows the same rule: `resetTransientVisualState()` zeros the existing `State.modulation` fields in place instead of assigning a replacement object.

`State.visualTuning` is the live interpolated tuning. `State.targetTuning` is the selected destination. Presets and sliders write to `targetTuning`; `PlexusRenderer.draw()` calls `applyTuningMorph()` before frame publication so numeric tuning values move toward their targets without overshooting. Section overrides store `State.sectionOverrides["section-N"].sensitivity` and temporarily replace the live `audioSensitivity` for the active section only during the current draw frame; the original global sensitivity is restored before the frame ends. Tuning normalization and morphing iterate a module-level `visualTuningKeys` list instead of rebuilding `Object.keys(defaultVisualTuning)` in hot paths. This keeps preset changes stage-safe during live playback.

## Visual Modes

The renderer supports two selectable visual modes through `State.visualMode`:

- `classic`: preserves the original Plexus particle network, center glow, beat shockwaves, and polygon flash behavior.
- `temporal`: keeps the same particle and shockwave primitives but re-composes them around full-track analysis. It does not draw pattern detections as bar-aligned labels and avoids unrelated decorative wave/ellipse motifs. Instead, `trackAnalysis` continuously modulates polygon color, movement, density, connection sensitivity, background tone, and central mechanism rings for beat, melody, vocal, fx, and pattern resonance.

Mode selection belongs to UI projection. `src/visuals/PlexusRenderer.ts` only synchronizes playback/analysis state and delegates to the selected effect file; no audio analysis may run in either visual mode.

## Visual Tuning And Playback UI

The active implementation includes a metadata-driven visual tuning panel, JSON preset loading and copy export, surface-level playback controls, fullscreen presentation mode, OBS-oriented presentation URL mode, loop/once playback, responsive metrics, and idle-hiding UI chrome. A single visual-surface click pins or unpins the chrome after the double-click detection window, while double-click remains the play/pause gesture. Unpinning through that intentional background click uses a fast `400ms` hide delay; ordinary inactivity, hover leave, and focus-out paths continue to use the standard `2600ms` delay.

For stream output, `chromaKeyMode` selects normal, green, or transparent background clearing. `performanceMode` disables radial-gradient glow work and chroma-key modes also skip those expensive glow paths. Expensive radial glow also requires `State.isPlaying`, so paused and idle views keep their static visual state without rebuilding radial gradients. `PlexusRenderer` lowers the p5 frame-rate target by playback state: playing runs at `60 FPS`, paused with a loaded track runs at `30 FPS`, and no-audio idle runs at `15 FPS`. The frame-rate call is issued only when the target changes, and this policy does not alter audio playback or offline analysis behavior. `?presentation=true` sets `State.uiVisible` to `false` and hides the UI chrome automatically.

The seek chrome includes an interactive dramaturgy timeline canvas. It does not perform analysis at runtime. `DashboardUI.drawDramaturgyTimeline()` projects precomputed `TrackAnalysis` data into layered canvas bands: section blocks use label-specific colors, `drawTimelineGridlines()` draws BPM-derived bar boundaries, `drawTimelineRms()` draws bar-level RMS/peak pressure, `buildupConfidence` is drawn as a cyan tension wave, `spectralPivot` active regions are drawn as a magenta dotted overlay, `tensionTrends.segments` are drawn as rising/falling/stable guide strokes, and selected cue kinds (`impact`, `break`) appear as labeled markers. Per-section sensitivity lines map vertical position to `0.1..4.0` and overridden values are labeled `S:x.xx`. The configured `dropAnticipation` window is shown as a magenta suspense gradient to the right of the playhead. The canvas is HDPI-aware and redraws through `requestTimelineDraw()` when user interaction can arrive faster than animation frames. `updateDashboard()` does not imply a timeline redraw; it calls `requestDashboardTimelineDraw()`, which redraws only when the analysis reference, canvas size, zoom, scroll, scrub state, or visible playhead position changes. The playhead threshold is one visible pixel, computed as `viewport.duration / Math.max(1, rect.width)`.

Timeline scrubbing is intentionally separated from audio seeking. `DashboardUI` owns `private scrubTime: number | null`; pointer or seekbar drag calls `setScrubTime()`, updates the visible time label, updates the seekbar value, and redraws the playhead in yellow without touching the Web Audio source graph. `commitScrubTime()` is called when the interaction ends (`pointerup`, `pointercancel`, `change`, or touch-end paths). Only that commit performs the single final `AudioEngine.seek(targetTime)` call. `updateDashboard()` also respects this state: while `scrubTime` is non-null, playback time does not overwrite the user's in-progress scrub position.

The top-right timeline control opens a fullscreen inspection overlay rather than performing a small height toggle. Overlay mode applies `.timeline-overlay-active` to the `.seek-container`, `.is-fullscreen-overlay` to `.timeline-wrapper`, and `body.timeline-overlay-open` to the page. The two-level structure makes the full seek container the fixed viewport shell while the wrapper becomes the absolute drawing surface. Closing the overlay restores the previous bottom placement and the last manually expanded height. The resize handle remains available outside overlay mode for compact-to-expanded manual inspection.

Zoom and pan are local UI viewport transforms. `timelineZoomLevel` is clamped from `1` to `16`; `timelineScrollOffsetTime` stores the visible window start in seconds. The visible duration is `State.duration / timelineZoomLevel`, time-to-x mapping is `((time - viewport.start) / viewport.duration) * width`, and x-to-time mapping is `viewport.start + (x / width) * viewport.duration`. Wheel zoom keeps the cursor's time stable by recalculating `timelineScrollOffsetTime` after the zoom change. Normal left drag always scrubs/seeks; Shift-drag or middle-button drag pans. During playback, `followTimelinePlayhead()` recenters the viewport when the playhead leaves the `15%..75%` visible range.

Timeline hover uses a DOM tooltip instead of canvas text. `#timeline-tooltip` is positioned next to the pointer and reports the hovered time, zoom, section, bar state, RMS, BarAnalysis bass/mid/treble spectral-band ratios, buildup pressure, tension trend, and nearby cue where available. Keeping the tooltip in HTML avoids redrawing text-heavy canvas overlays on every pointer move.

## Performance Notes

The renderer still uses offline preprocessing for music analysis. Playback-time dramaturgy access remains an indexed lookup over `State.trackAnalysis.buildupConfidence`.

Recent hot-path optimizations:

- `PlexusRenderer.draw()` no longer recalculates event and cue indexes with `findIndex()` from the paused/stopped draw path. That O(N) search was worst near the end of long tracks because each frame had to scan most or all event arrays. Index synchronization now happens through `syncEventIndex(time)`, registered once with `AudioEngine.addPositionChangedListener()`, so the scan runs only on real position changes such as seek, stop, or load reset.
- Timeline and seekbar scrubbing no longer rebuild Web Audio source nodes on every pointer or input event. The UI buffers the drag target in `scrubTime`, redraws visual feedback through `requestAnimationFrame`, and commits one final `AudioEngine.seek()` when the gesture ends.
- `Particle.update()` now checks boundary distance with squared distance, uses vector normalization for center pull, and updates position with direct component math (`pos.x += vel.x * speed`, `pos.y += vel.y * speed`) instead of allocating through `p5.Vector.mult()`.
- `P5RendererBackend` caches fill color, stroke color, and stroke weight so repeated identical p5 state changes are skipped. The cache compares numeric RGBA components (`lastFillR/G/B/A`, `lastStrokeR/G/B/A`) instead of allocating string keys. It still tracks `noStroke()` and `noFill()` activation state so a later identical stroke/fill call re-enables drawing correctly.
- Hot render paths should use `hueToRgbInto(target, hue, saturation, lightness)` with caller-owned RGB tuples. `hueToRgb()` remains a compatibility wrapper for non-hot callers. Temporal mechanism rings pass numeric `colorR/colorG/colorB` components across the `drawMechanismRing()` boundary to avoid shared array reference hazards.
- `writeModulationBus()` updates the existing `State.modulation` object in the render loop. `computeModulationBus()` remains available when a fresh modulation object is required outside that hot path.
- Classic and temporal radial glow now require both `State.isPlaying` and `shouldUseExpensiveGlow(State.visualTuning)`, so paused, idle, performance-mode, chroma, and transparent-background paths avoid radial gradient construction.
- `DashboardUI.updateDashboard()` no longer causes an unconditional dramaturgy timeline redraw. Timeline redraw is throttled to visible changes in analysis, size, zoom, scroll, scrub state, or playhead movement of at least one visible pixel.
- Playback remains render/main-thread limited during draw. `TrackAnalysis` is still produced offline by the worker and read during playback as accepted precomputed state; the cleanup reduces allocation, garbage collection, Canvas state churn, and paused/idle render load rather than moving analysis work.
- UI chrome intentionally separates fast user-requested hide feedback (`400ms` after background unpin) from passive idle hiding (`2600ms`) so normal interaction stays forgiving while explicit hide feels immediate.

Validation for these rendering and UI performance contracts should include TypeScript checking, Vite build, Node tests, and `git diff --check`. On Windows setups where package-manager shims such as `npm` are not on `PATH`, use the local `node_modules` entrypoints through the Codex bundled Node executable and report the exact fallback commands. The current Vite production build may still report a non-fatal chunk-size warning.

Detailed documentation:

- Feature record: `documents/features/visual-tuning-presets-and-playback-ui.md`
- Acceptance criteria: `documents/acceptance-criteria/visual-tuning-presets-and-playback-ui-acs.md`
- Architecture decision: `documents/adr/ADR-001-visual-tuning-presets-and-playback-ui.md`

## AC Clarifications

- **AC 1.2 - Loading state:** Selecting a new file must stop playback, invalidate previous analysis, terminate any active worker, disable `Play` and `Seek`, reset visible playback position to `0:00`, and re-enable controls only after an accepted analysis result.
- **AC 1.3 / VT-7 - End state:** In `Loop` mode, natural track end resets the current source and immediately starts playback from `0:00`. In `Once` mode, natural track end resets playback time, seek bar, `Play` label, active strategy text, beat decay, dense impact flash, cue decay, and visual event indexes.
- **AC 1.4 - Seek:** Finished seeking must use the audio engine `seek()` path so playback offset, visible time, paused time, source-node lifecycle, and visual beat-event index are aligned in one transition. In-progress pointer or slider dragging must use `scrubTime` and must not call `seek()` repeatedly.
- **AC 1.5 - Decode failure UI:** Browser-level audio decode or file-load failures must leave `Play` and `Seek` disabled, re-enable file selection, and show a file-load error in the dashboard.
- **AC 3.6 - Beat event classification:** Beat type classification is part of the analyzer contract: smoothed fx presence greater than `0.6` maps to type 3 (`fx/high-transient hit`), otherwise smoothed density greater than `0.7` maps to type 2 (`dense impact hit`), and the fallback maps to type 1 (`default spectral-flux hit`).
- **AC 5.2 - Analyzer bands:** The current worker uses Hann-windowed FFT spectral features rather than the older IIR crossover wording from the prototype.
- **AC 5.4 - Worker output:** The worker success payload includes `type`, `requestId`, `bpm`, `adaptiveThreshold`, `frames`, `events`, `hopSize`, and `trackAnalysis`. The worker may also emit typed failure payloads with `type`, `requestId`, `errorCode`, and `message`.
- **AC 8.1 - Worker and source cleanup:** New file loads must terminate superseded workers and ignore stale worker messages. Audio samples sent to the worker must be an explicit copy when playback still depends on the decoded `AudioBuffer`.
