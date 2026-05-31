# Visual Tuning, Presets, And Playback UI

This feature document records the visual tuning and player-surface behavior in the active TypeScript implementation.

## Feature Scope

The app now exposes a broader, reusable visual tuning system, persistent JSON presets, a cleaner responsive playback UI, and industry-standard visual-surface playback controls.

## Visual Tuning

The visual tuning model is centralized in `src/config/visualTuning.ts`.

Implemented capabilities:

- Visual tuning is hidden by default and can be opened with the `Tuning` top-control button.
- The tuning panel can be dragged by its header.
- The panel uses a responsive grid that fills available space more effectively.
- All visible tuning ranges were expanded to support stronger experimentation while preserving the previous default values.
- Circle and ring stroke parameters support very large values.
- Circle background hue and opacity can be tuned independently from the circle core/ring styling.
- Global background color is tunable through RGB controls and can reach pure white.
- A single `Music sensitivity` slider scales already-computed audio and visual feature values up or down without changing the analyzer.
- Tuning controls are grouped through metadata so new parameters can be added by extending the config object and the control list.

The default tuning values remain the baseline behavior. New or old preset payloads are normalized through `normalizeVisualTuningConfig`, which merges valid numeric values onto `defaultVisualTuning`.

## Preset Management

Visual tuning presets are loaded from `public/visual-tuning-presets/`.

Implemented capabilities:

- Presets are plain JSON files.
- `public/visual-tuning-presets/index.json` is the browser-readable manifest because static web apps cannot safely list a directory at runtime.
- Preset names come from file names.
- The preset selector is placed in the top controls next to the visual effect mode selector.
- The selector display strips the `.json` suffix.
- The selector defaults to `default.json` when available instead of showing a placeholder.
- Selecting a preset immediately loads its tuning values.
- Old preset files remain valid because missing parameters are filled from defaults.
- Preset loading does not show transient success messages that would resize or shift the panel.
- The `Copy config` button exports the current tuning state as preset-compatible JSON with a `version` field and a `visualTuning` payload.
- Copy feedback is intentionally transient and confined to the tuning panel status area so it does not shift layout. Preset-load failures may use the same status area for short-lived diagnostic text.

Preset JSON can be stored either as the raw tuning object or under a `visualTuning` property. Invalid or unknown fields are ignored.

## Playback Controls

The central visual surface now behaves as the primary playback target.

Implemented capabilities:

- A translucent center play button is shown when playback can be started and is not currently running.
- Double-clicking the visual background toggles play and pause.
- Pressing `Space` toggles play and pause when the visual surface is focused.
- `ArrowLeft` and `ArrowRight` seek backward and forward by five seconds when the visual surface is focused.
- Single-clicking the visual background pins or unpins the UI chrome after the double-click detection delay. Pinned chrome remains visible and does not idle-hide.
- The fullscreen button toggles browser fullscreen mode for presentation use.
- Playback loops by default.
- A `Loop` / `Once` top-control toggle switches between endless repeat and one-shot playback.
- The audio engine restarts from the beginning on natural end when loop mode is active.

Single click no longer pauses playback. Pause follows the same double-click behavior as play.

## Track Dramaturgy Timeline

The seekbar area includes a professional inspection timeline for precomputed `TrackAnalysis` data. It is a UI projection layer only; it does not run DSP or music analysis while drawing.

Implemented capabilities:

- `drawTimelineGridlines()` draws BPM-derived four-beat bar boundaries.
- Section blocks, bar RMS/peak pressure, the `buildupConfidence` curve, `tensionTrends`, significant cue markers, and the playhead are drawn as separate canvas layers.
- `TrackAnalysis.bars` provides bar index, `HIGH`/`LOW` state, RMS, bass, mid, treble, density, energy, and dominant-feature values for timeline visualization.
- The top resize handle lets the user manually change timeline height outside overlay mode; height changes use a throttled redraw path and preserve HDPI canvas sharpness.
- The top-right timeline control opens a fullscreen overlay. The `.seek-container` receives `.timeline-overlay-active`, the `.timeline-wrapper` receives `.is-fullscreen-overlay`, and `body` receives `.timeline-overlay-open`, so the timeline fills the viewport while unrelated chrome is hidden.
- Hovering the canvas shows the DOM-based `#timeline-tooltip` with time, zoom, section, bar, RMS and BarAnalysis bass/mid/treble spectral-band ratios, buildup, trend, and nearby cue information.
- Mouse wheel zooms the timeline between `1x` and `16x` around the pointer. The visible viewport is described by `timelineScrollOffsetTime` and `State.duration / timelineZoomLevel`.
- Normal left click or drag always scrubs/seeks, including in zoomed view. Shift-drag or middle-button drag pans the viewport.
- While playing in zoomed view, the viewport follows the playhead when the playhead leaves the `15%..75%` range of the visible timeline.

Scrubbing is buffered for performance. Pointer and slider drag update `private scrubTime: number | null`, the visible time label, the seekbar value, and a yellow playhead. The Web Audio graph is not rebuilt during drag. `commitScrubTime()` performs one final `AudioEngine.seek()` call when the interaction ends.

Dashboard refresh does not automatically redraw the timeline canvas. `updateDashboard()` asks `requestDashboardTimelineDraw()` to decide whether a redraw is visible. Redraw is allowed when `TrackAnalysis` changes, the canvas size changes, zoom or scroll changes, scrub state changes, or the playhead has moved by at least one visible pixel (`viewport.duration / Math.max(1, rect.width)`). This keeps frequent dashboard text updates from repainting dense timeline layers unnecessarily.

## Metrics And Chrome

The dashboard chrome was simplified for performance use and VJ-style presentation.

Implemented capabilities:

- The top panel shows the loaded audio file name and a compact BPM header badge.
- Analysis-completion details such as sample count, section count, or cue count are not shown in the header.
- BPM is shown as a BPM header badge instead of a metric card.
- The dashboard metric labels are `Density`, `Melody Presence`, `Vocal`, `FX`, and `Beat Impulse`; BPM moved to the header badge, progress moved to the seekbar time display, and fx-presence duplication is covered by the canonical `VisualFeatureFrame.fx` metric.
- `AudioFrame.b`, `AudioFrame.m`, and `AudioFrame.t` remain legacy compatibility projections, not raw crossover bands. `AudioFrame.t` remains available to the modulation bus but is no longer a separate dashboard card.
- The metrics panel can be expanded or collapsed from a compact control above the seekbar.
- The metrics grid uses the original card-style layout and responds to viewport width.
- The cue metric card was removed.
- `Dynamics State` occupies one grid unit and its bar is labeled `Section Energy`.
- The seekbar is a minimal rectangular full-width control aligned with the metrics visual style.
- The top controls, bottom playback section, and open panels fade out after user inactivity.
- Pointer, keyboard, touch, and mouse activity reveal the chrome again.
- Hovering or focusing visible chrome keeps it visible.
- The cursor is hidden while the chrome is in the idle-hidden state.

## Implementation Notes

The feature is split across these runtime layers:

- `src/config/visualTuning.ts`: defaults, control metadata, preset normalization, audio-sensitivity helpers.
- `src/types/index.ts`: persisted tuning and playback state contracts.
- `src/state/store.ts`: shared runtime state for tuning, section sensitivity overrides, visual mode, playback loop mode, and chrome behavior.
- `src/ui/DashboardUI.ts`: DOM controls, preset loading, panel visibility, dragging, playback shortcuts, metrics projection, section sensitivity lines, spectral pivot overlay, timeline overlay/zoom/pan/scrub behavior, tooltip projection, and auto-hide behavior.
- `src/audio/AudioEngine.ts`: loop-on-end playback behavior.
- `src/visuals/`: render usage of tuning values, background color, and sensitivity-scaled audio data.

## Analysis And Error Handling Details

Browser-level file loading and `AudioContext.decodeAudioData` failures are surfaced through the dashboard as file-load errors. In that state playback and seek remain disabled, while file selection is re-enabled so the user can choose another track.

Beat event types are assigned by the analyzer worker from smoothed visual-feature context after spectral-flux peak picking:

- Type 3 is the `fx/high-transient hit`, emitted when smoothed fx presence is greater than `0.6`.
- Type 2 is the `dense impact hit`, emitted when fx does not pass that threshold and smoothed density is greater than `0.7`.
- Type 1 is the `default spectral-flux hit`, used for all other accepted beat peaks.

The analyzer also publishes BPM-aligned `BarAnalysis` entries and RMS fields on `TrackSection`. Older payloads are normalized by `AudioEngine.normalizeTrackAnalysis()` so missing bar/RMS fields fall back safely instead of breaking the UI.

## Performance Details

Two interaction hot paths are explicitly guarded:

- The paused/stopped p5 draw path does not run `findIndex()` over event or cue arrays each frame. Beat and cue indexes are synchronized through `AudioEngine.addPositionChangedListener(syncEventIndex)`, so linear scans happen only on actual position changes.
- Seekbar and timeline drag do not call `AudioEngine.seek()` repeatedly. They update `scrubTime` and redraw visual feedback through `requestTimelineDraw()`, then commit one audio seek when the gesture ends.
- The render loop writes modulation through `writeModulationBus(State.modulation, ...)` so the modulation object reference stays stable. `computeModulationBus()` remains a compatibility helper for fresh-object callers, and transient reset zeros the existing modulation fields in place.
- Hot color conversion uses `hueToRgbInto()` with module-owned RGB tuples. `hueToRgb()` remains available as an allocating compatibility wrapper, but classic and temporal draw paths avoid new RGB arrays in per-frame loops. Temporal mechanism ring drawing receives numeric RGB components instead of a shared color array reference.
- `P5RendererBackend` skips redundant `fill()`, `stroke()`, and `strokeWeight()` calls by comparing numeric cached components. String keys are avoided in the draw-state cache, while `noFill()` and `noStroke()` still force the next matching fill or stroke call to reactivate p5 state.
- Expensive radial glow is limited to active playback and still respects `performanceMode`, green-screen chroma key, and transparent chroma key. Paused-loaded render targets run at `30 FPS`; no-audio idle targets run at `15 FPS`; playing targets run at `60 FPS`.
