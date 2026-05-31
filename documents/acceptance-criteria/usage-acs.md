# Usage And Functional Acceptance Criteria V0.2

> **Current status:** This document describes the active TypeScript implementation. The `src/`, `public/visual-tuning-presets/`, and `tests/` directories are the implementation references.

## 1. Audio And Playback

* **AC 1.1 - File loading:** The user can load `.mp3`, `.wav`, and other browser-supported audio files with the `Load` control.
* **AC 1.2 - Loading lock:** When a file is selected, playback stops, `Play` and seek controls are disabled, and the status text reports decoding and analysis progress.
* **AC 1.3 - End state and loop:** When playback reaches the end threshold (`duration - 0.1s`), `Loop` mode restarts playback from `0:00`. In `Once` mode, playback stops, the seekbar returns to `0`, visual transient state (`beatDecay`, `denseImpactFlash`, cue state, event indexes) resets, and the UI returns to its idle playback state.
* **AC 1.4 - Seek and scrub buffering:** Dragging the seekbar or dramaturgy timeline updates the visible time and playhead immediately, but the audio engine does not receive repeated `seek()` calls. The UI stores the target in `scrubTime` and commits one final `AudioEngine.seek()` when the pointer or touch interaction ends.
* **AC 1.5 - Decode failure UI:** If selected audio cannot be decoded, playback and seek remain disabled, file selection is re-enabled, and the dashboard shows a file-load error instead of entering a partially playable state.

## 2. Macro Dynamics State

* **AC 2.1 - Block segmentation:** The system identifies the current musical dynamics block from beat-aligned windows and uses the block's relative energy (`0.0..1.0`) as the macro dynamics basis.
* **AC 2.2 - HIGH state:** If block-relative energy is at least the analyzer-derived adaptive threshold, the system enters `HIGH`. The dashboard displays `HIGH`, and accepted precomputed beat events are rendered normally.
* **AC 2.3 - LOW state:** If block-relative energy is below the analyzer-derived adaptive threshold, the system enters `LOW`. The dashboard displays `LOW`, and quieter visual responses are restrained by the current energy context.
* **AC 2.4 - Drop and overload overrides:** While in `HIGH`, current energy below `0.35` forces `LOW [DROP]`; current energy above `0.95` forces `LOW [OVERLOAD]` to protect the visual output from noisy overload.

## 3. Visual Reactions And Plexus Engine

* **AC 3.1 - Center pull:** Up to 75 particles move continuously from the current energy and modulation state. If a particle moves beyond roughly 45% of the visible radius from center, its velocity is gently turned back toward center.
* **AC 3.2 - Distance network:** Lines are drawn only between particles closer than the current threshold. That threshold expands with the render-facing `AudioFrame.b` density projection.
* **AC 3.3 - Whiteout protection:** A node may emit at most 6 lines and participate in at most 2 triangle fills. Base triangle alpha must not exceed 50 out of 255. Dense impact events may briefly raise triangle alpha, but the flash decays quickly to avoid persistent whiteout.
* **AC 3.4 - Shockwaves:** Accepted beat events create expanding shockwaves from the center.
  * Type 1 (`default spectral-flux hit`): thick, medium-speed, blue-tinted shockwave.
  * Type 2 (`dense impact hit`): very thick, very fast, white/pink shockwave. This type also triggers the Plexus triangle flash through `denseImpactFlash`.
  * Type 3 (`fx/high-transient hit`): thin, fast, green-tinted shockwave.
* **AC 3.5 - Visual mode selection:** The user can switch between `Classic` and `Temporal` visual modes without reloading the audio file. Classic preserves the Plexus network behavior. Temporal uses the same playback and precomputed analysis data for continuous visual modulation.
* **AC 3.6 - Beat event classification:** After spectral-flux peak picking, the worker classifies beat events from smoothed feature context: type 3 when smoothed fx presence is greater than `0.6`, type 2 when fx does not pass that threshold and smoothed density is greater than `0.7`, and type 1 otherwise.

## 4. Dashboard

* **AC 4.1 - Realtime metrics:** During playback, dashboard metric cards show Dynamics State, Energy, Density, Melody Presence, Vocal, FX, and Beat Impulse in that order. `AudioFrame.b/m/t` remain legacy compatibility fields for density, melody-presence, and fx-presence projections; `AudioFrame.t` is not displayed as a separate metric card. Melody Presence is the dashboard-facing melody metric; `VisualFeatureFrame.melody` remains the internal canonical feature signal for track analysis, cues, modulation, and temporal rendering.
* **AC 4.2 - Performance-conscious updates:** DOM text and bar widths update only every fourth render frame (`frameCount % 4 === 0`), keeping dashboard refresh near 15 FPS while playback renders at a higher cadence.
* **AC 4.3 - BPM header badge:** After successful analysis, calculated BPM appears in the `#bpm-header-badge` next to the loaded audio file name. BPM is not part of the metrics grid.
* **AC 4.4 - Responsive layout:** The tuning panel, metrics grid, and seekbar adapt to viewport width. The p5 canvas fills the window and resizes on `windowResized`.

## 5. Offline Analysis

* **AC 5.1 - Worker analysis:** Audio analysis runs in a dedicated Web Worker so large files do not block the main UI thread.
* **AC 5.2 - FFT spectral analysis:** The worker runs a 1024-sample Hann-windowed FFT. Analysis computes relative low/mid/high spectral-band ratios, spectral flux, centroid, and flatness. Visual and beat-event outputs are derived from these spectral features, not IIR crossover filters.
* **AC 5.3 - Two-pass analysis:** First, the worker computes RMS energy, spectral flux, relative band energy, centroid, and flatness, then derives beat-aligned macro dynamics blocks. Second, it smooths spectral features into the `AudioFrame` timeline, `VisualFeatureFrame` sequence, `BeatEvent` events, sections, cues, and recurring music patterns.
* **AC 5.4 - Worker output:** A success message includes `type: 'analysis_done'`, `requestId`, `bpm`, `adaptiveThreshold`, `frames` as `Array<AudioFrame>`, `events` as `Array<BeatEvent>`, `hopSize`, and `trackAnalysis`. Failure messages include `type: 'analysis_error'`, `requestId`, `errorCode`, and `message`.
* **AC 5.5 - Visual music analysis output:** `trackAnalysis` includes per-frame visual features, section structure, significant moments, recurring `MusicPattern` entries, and cue events. Playback and rendering may read this data but must not perform audio analysis in the render loop.
* **AC 5.6 - Dramaturgy output:** Worker output includes deterministic `buildupConfidence`, `spectralPivot`, and `tensionTrends` values that rendering may use to raise pre-drop tension without doing DSP in the render loop. Spectral Pivot applies only above the absolute `sE > 0.04` noise gate and writes exact zeroes to delicate metrics below that gate.

## 6. Audio Rendering

* **AC 6.1 - Native Web Audio:** Playback uses native Web Audio and must not use `p5.sound`. Playback is performed with `AudioBufferSourceNode` for low latency, precise timing from `audioContext.currentTime`, and predictable source-node lifecycle.
* **AC 6.2 - Precomputed synchronization:** During playback, the main thread performs no audio math for beat detection. It uses timestamps to consume precomputed beat and cue events and to publish the current precomputed analysis frame.

## 7. Rendering

* **AC 7.1 - Layering:** The canvas layer sits below UI chrome. Empty UI wrapper areas pass pointer events through to the visual surface.
* **AC 7.2 - Network optimization:** Plexus distance checks use squared distance. `Math.sqrt()` is called only after a candidate pair is already known to be inside the connection threshold.
* **AC 7.3 - Triangle drawing:** Triangle fills use direct `triangle(x1, y1, x2, y2, x3, y3)` drawing instead of expensive generic shape construction.
* **AC 7.4 - Render backend boundary:** `ClassicPlexusEffect` and `TemporalMusicEffect` draw through `VisualRendererBackend`. Direct p5 drawing belongs in `P5RendererBackend` or p5-owned primitives.
* **AC 7.5 - Modulation bus:** Visual animation strength is driven by `State.modulation`: `kineticTension`, `densityDrive`, `spectralChaos`, `rhythmicImpulse`, and `macroMomentum`.

## 8. Memory And State Management

* **AC 8.1 - Source node cleanup:** On pause, stop, or seek, the current `AudioBufferSourceNode.onended` handler is cleared, the node is stopped, and the node is disconnected so it can be collected.
* **AC 8.2 - Object reuse:** The particle array is initialized once with 75 entries. Rendering does not create or delete particles during normal playback. Shockwaves are removed with `splice` once their alpha reaches zero.
* **AC 8.3 - Fast background unpin feedback:** A visual-surface single click that unpins UI chrome schedules hiding with a fast `400ms` delay. Normal inactivity, hover leave, and focus-out paths keep the standard `2600ms` delay.

## 9. Stream And Timeline

* **AC 9.1 - Chroma key background:** `chromaKeyMode` controls normal tuned RGB background, green chroma-key background, or transparent clearing.
* **AC 9.2 - Low latency rendering:** `performanceMode` disables radial-gradient glow work, and chroma modes skip glow paths to reduce capture latency and CPU load.
* **AC 9.3 - Presentation URL:** Loading the app with `?presentation=true` hides UI chrome automatically by setting `State.uiVisible` to false and applying presentation CSS.
* **AC 9.4 - Overlay safety:** Stream-specific modes must not alter playback timing, worker analysis, or beat/cue event indexing.
* **AC 9.5 - Interactive dramaturgy timeline:** The seekbar chrome includes a canvas timeline that visualizes precomputed `TrackAnalysis` only. It renders BPM-derived bar lines, section blocks, `buildupConfidence`, `spectralPivot` active regions, `tensionTrends`, RMS/bar dynamics, significant cue markers, and the playhead without runtime music analysis.
* **AC 9.6 - Resizable dramaturgy timeline:** The timeline has a top resize handle. Dragging it changes timeline height inside safe bounds, uses the throttled canvas redraw path, preserves HDPI sharpness, and stores the last expanded height for later restore.
* **AC 9.7 - Canvas backend hot-path optimization:** Particle boundary pull uses squared-distance checks and vector normalization instead of p5 distance and angle trigonometry. The p5 backend caches repeated fill, stroke, and stroke-weight state changes while preserving `noStroke` and `noFill` behavior.
* **AC 9.8 - Fullscreen overlay structure:** Opening the timeline overlay applies `.timeline-overlay-active` to `.seek-container`, `.is-fullscreen-overlay` to `.timeline-wrapper`, and `body.timeline-overlay-open` to the document body. The timeline fills the viewport above other UI, hides unrelated chrome, and closes back to its previous bottom position and stored height.
* **AC 9.9 - HTML tooltip interaction:** Hovering the timeline shows `#timeline-tooltip` near the pointer. The tooltip reports current time and zoom, matching section, bar index and `HIGH`/`LOW` state, RMS, BarAnalysis bass/mid/treble spectral-band ratios, buildup pressure, tension trend, and nearby cue data where available.
* **AC 9.10 - DAW-style zoom and pan:** Mouse wheel zooms the timeline from `1x` to `16x` around the cursor. Normal left click or drag always scrubs/seeks the playhead. Shift-drag or middle-button drag pans the visible viewport. During playback, zoomed view follows the playhead when it leaves the `15%..75%` viewport range.
* **AC 9.11 - Scrub buffering:** Timeline and seekbar dragging must not repeatedly call the audio engine. Dragging updates `scrubTime`, visible time, seekbar value, and a yellow scrub playhead through `requestTimelineDraw()`. A single final audio seek is committed on pointer or touch release.
* **AC 9.12 - Renderer hot-path index sync:** `PlexusRenderer.ts` must not run O(N) `findIndex` searches over `State.events` or `State.trackAnalysis.cues` from the paused/stopped draw path. Beat and cue indexes are synchronized by the event-driven `syncEventIndex` callback registered through `addPositionChangedListener`.
* **AC 9.13 - Section sensitivity overrides:** Dragging a section line on the dramaturgy timeline stores `State.sectionOverrides["section-N"].sensitivity` in the `0.1..4.0` range and labels overridden lines as `S:x.xx`. During the draw frame, `PlexusRenderer` temporarily applies the active section sensitivity over the global `audioSensitivity`, then restores the global value before the frame ends.
* **AC 9.14 - Drop anticipation:** When `dropAnticipation` is greater than zero, the renderer samples the future frame at `currentTime + dropAnticipation`. Future `LOW` and `LOW_DROP` states dampen `kineticTension` and `densityDrive`, while the timeline shows the look-ahead window as a magenta suspense band.
