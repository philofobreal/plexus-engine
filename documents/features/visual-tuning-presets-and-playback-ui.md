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

The `Wormhole` control group drives the `cosmic-wormhole` identity: `wormholeRadius`, `wormholeDepth`, and `wormholeSpeed` shape the tube geometry and forward velocity; `wormholeWarp` controls the dust spiral twist; `wormholeCurve` is a `0..1` master for the event-driven tunnel curvature that can force a straight tube regardless of preset content; `wormholeRing` blends the dust depth between a natural dispersed spread and concentric rings; and `wormholeStarfield` and `wormholeGalaxy` are general, preset-independent masters for the background star density and the deep galaxy parallax layer. Because the bundled presets do not write the two background masters, they stay global across preset changes.

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
- Presets may include a `visualMode` field. Known built-in values (`classic`, `temporal`, `dark-techno`, `organic-ambient`, `cyberpunk`, `cosmic-wormhole`, and `hero` when its feature flag is enabled) update both `State.visualMode` and the visual mode select. Missing or unknown mode values are ignored so older or external presets do not break loading.
- Preset loading does not show transient success messages that would resize or shift the panel.
- The `Copy config` button exports the current tuning state as preset-compatible JSON with a `version` field and a `visualTuning` payload.
- Copy feedback is intentionally transient and confined to the tuning panel status area so it does not shift layout. Preset-load failures may use the same status area for short-lived diagnostic text.

Preset JSON can be stored either as the raw tuning object or under a `visualTuning` property. Invalid or unknown fields are ignored.

Performance-plan preset assignment is semantic when preset metadata is available. `GeneratorOptions.presetMetadata` receives the preloaded JSON payloads from `State.preloadedPresets`, and the generator scores tuning/dramaturgy values such as `particleEnergySpeed`, `particleBeatSpeed`, `dropDampening`, `buildupIntensity`, `breakRestraint`, `vocalHighlight`, and `fxChaos` against the target section. File-name hints remain a fallback for sparse or legacy metadata, but custom preset names work when their parameter profile matches the section.

Generated automation points may carry `analysisConfidence` and `timingMode`. `timingMode: 'bar-aligned'` means the generator uses the analyzed bar grid. When grid and BPM confidence are both critically low, the generator uses section-start `boundaryCandidates`: `timingMode: 'novelty'` means a sparse novelty peak anchored the start boundary, while `timingMode: 'energy-reactive'` means raw energy fallback timing was used. Point confidence is scaled by analyzer timing confidence so low-confidence schedules remain editable and visually inspectable without pretending to be precise bar-grid events.

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
- After a file picker `change` event, `PlaybackController` clears the upload input value so the same local audio or video file can be selected again for reload. This does not change `AudioEngine` playback ownership.

Single click no longer pauses playback. Pause follows the same double-click behavior as play.

## Track Dramaturgy Timeline

The seekbar area includes a professional inspection timeline for precomputed `TrackAnalysis` data. It is a UI projection layer only; it does not run DSP or music analysis while drawing.

Implemented capabilities:

- `drawTimelineGridlines()` draws BPM-derived four-beat bar boundaries.
- Section blocks, bar RMS/peak pressure, the `buildupConfidence` curve, `tensionTrends`, significant cue markers, and the playhead are drawn as separate canvas layers.
- `TrackAnalysis.bars` provides bar index, `HIGH`/`LOW` state, RMS, bass, mid, treble, density, energy, and dominant-feature values for timeline visualization.
- If analyzer grid and BPM confidence are both critically low, the upstream sectioning may come from energy-reactive time windows rather than strict BPM bars. The timeline still renders the accepted `TrackAnalysis.bars` and `TrackSection` payload; it must not re-run sectioning or infer confidence on its own.
- The top resize handle lets the user manually change timeline height outside overlay mode; height changes use a throttled redraw path and preserve HDPI canvas sharpness.
- The top-right timeline control opens a fullscreen overlay. The `.seek-container` receives `.timeline-overlay-active`, the `.timeline-wrapper` receives `.is-fullscreen-overlay`, and `body` receives `.timeline-overlay-open`, so the timeline fills the viewport while unrelated chrome is hidden.
- Hovering the canvas shows the DOM-based `#timeline-tooltip` with time, zoom, section, bar, RMS and BarAnalysis bass/mid/treble spectral-band ratios, buildup, trend, and nearby cue information. BPM/grid/downbeat confidence, alternate tempo candidates, section/cue `reasons`, and the novelty debug overlay are appended or drawn only when `featureFlags.analyzerDebugOverlay` is enabled, so analyzer internals stay out of the default user-facing tooltip.
- Mouse wheel zooms the timeline viewport around the pointer. The canonical visible viewport is described by shared `State.pan` and `State.duration / State.zoom`, with `DashboardUI` translating normalized gesture input into those state values. Max zoom is dynamic and shared with `TimelineCanvas`: `max(16, duration / 5.0)`, preserving at least about five visible seconds.
- Normal left click or drag always scrubs/seeks, including in zoomed view. Shift-drag or middle-button drag pans the viewport.
- While playing in zoomed view, the viewport follows the playhead when the playhead leaves the `15%..75%` range of the visible timeline.
- Timeline generator controls include a Strategy selector and `Generate` button. When `Strict Alternating` is selected, a context-sensitive Strict Mode settings row appears for choosing 4 presets, the Bars/Preset interval, and Morph duration.
- `Copy Dramaturgy` and `Load Dramaturgy` buttons transfer the current performance-automation plan (the dramaturgy state) through the clipboard. Serialization and validation live in the DOM-free `src/automation/dramaturgyTransfer.ts` module: `serializeDramaturgyPlan()` writes a tagged JSON envelope, and `parseDramaturgyPlan()` accepts a tagged envelope, a bare plan, or a full `Copy config` payload that embeds a `performancePlan`, then validates and normalizes it (points sorted by time, unknown fields stripped, confidence clamped) or returns a precise error message. Load is non-destructive until confirmed: it requires clipboard text (with a manual-paste fallback when the Clipboard API is unavailable), reports parse/validation errors in the timeline status line, asks for overwrite confirmation, then applies the plan as `State.editedPerformancePlan`/`State.performancePlan`, preloads referenced presets, and redraws the timeline. Copy uses the same write/fallback path as `Copy config`.
- Automation zones remain visible when only partly inside the timeline viewport. Morph curve geometry uses unclipped x coordinates and canvas clipping; curve segment count starts at `15` and increases with curve width. Preset colors mark the automation zone, morph curve, intensity line, and sensitivity handle state, and the zone after the morph curve is dimmed.
- The waveform is a precomputed `Float32Array` waveform cache owned by `TimelineCanvas`, targeting `80 Hz` buckets and capped at `500000` points. Deep zoom samples it with linear interpolation. It is a cached waveform projection, not runtime audio analysis.

Scrubbing is buffered for performance. Pointer and slider drag update `private scrubTime: number | null`, the visible time label, the seekbar value, and a yellow playhead. The Web Audio graph is not rebuilt during drag. `commitScrubTime()` performs one final `AudioEngine.seek()` call when the interaction ends.

Dashboard refresh does not automatically redraw the timeline canvas. `updateDashboard()` asks `requestDashboardTimelineDraw()` to decide whether a redraw is visible. Redraw is allowed when `TrackAnalysis` changes, the canvas size changes, `State.zoom` or `State.pan` changes, scrub state changes, or the playhead has moved by at least one visible pixel. This keeps frequent dashboard text updates from repainting dense timeline layers unnecessarily.

## Offline WebM Export

The timeline action bar includes a compact export workflow for creating WebM renders of the current visual performance.

Implemented capabilities:

- Resolution selector: `720p`, `1080p`, `4K`.
- Aspect selector: `16:9`, `9:16`, `1:1`.
- `Export` starts a fixed-60-FPS offline render.
- `Stop` finalizes and downloads a partial WebM from the frames encoded so far.
- `Cancel` aborts and discards the partial output.
- Export progress is displayed on the export button as a percentage.
- Successful output downloads as `plexus-visual.webm`.
- The exported video contains a top-left Plexus metadata card with brand label, track name, BPM badge, and beat-reactive cyan pulse.
- When browser WebCodecs audio support is available, the export worker writes an Opus audio track from the loaded `AudioBuffer`; otherwise the export remains video-only.

Export disables playback and editing interactions while active. Canvas click, canvas keyboard controls, and global envelope-drawing shortcuts return immediately when `State.isExporting` is true.

Download URLs are revoked after a short delay rather than immediately after synthetic link click, because some browsers need time to enqueue the Blob resource.

## Metrics And Chrome

The dashboard chrome was simplified for performance use and VJ-style presentation.

Implemented capabilities:

- The top panel shows the loaded audio file name and a compact BPM header badge.
- Analysis-completion details such as sample count, section count, or cue count are not shown in the header.
- BPM is shown as a BPM header badge instead of a metric card.
- The dashboard metric labels are `Density`, `Melody Presence`, `Vocal`, `FX`, and `Beat Impulse`; BPM moved to the header badge, progress moved to the seekbar time display, and fx-presence duplication is covered by the canonical `VisualFeatureFrame.fx` metric.
- `AudioFrame.densityProj`, `AudioFrame.melodyProj`, and `AudioFrame.fxProj` remain canonical projections, not raw crossover bands. `AudioFrame.fxProj` remains available to the modulation bus but is no longer a separate dashboard card.
- The metrics panel can be expanded or collapsed from a compact control above the seekbar.
- The metrics grid uses the original card-style layout and responds to viewport width.
- The cue metric card was removed.
- `Dynamics State` occupies one grid unit and its bar is labeled `Section Energy`.
- The seekbar is a minimal rectangular full-width control aligned with the metrics visual style.
- The top controls, bottom playback section, and open panels fade out after user inactivity.
- The dashboard starts locked visible; chrome auto-hide starts only after the user unpins the chrome from the visual surface.
- Pointer, keyboard, touch, and mouse activity reveal the chrome again.
- Hovering or focusing visible chrome keeps it visible.
- The cursor is hidden while the chrome is in the idle-hidden state.
- Explicit unpin uses a fast `400ms` hide delay. Ordinary inactivity, hover leave, and focus-out use about `1400ms`, and hover-triggered timer expiry reschedules instead of hiding.

## Reactive Video Backplate

When a supported video file is loaded, `DashboardUI` owns a muted `<video>` backplate behind the p5 canvas. Normal play, pause, seek, stop, loop, and clear paths keep it synchronized to the `AudioEngine` master clock. During non-export playback, the video playback rate is modulated from `State.modulation.macroMomentum` and `State.modulation.rhythmicImpulse`, clamped to `0.5x..2.0x`; reset paths restore `1.0x`, and export mode skips playback-rate modulation.

The same UI path samples the current video frame through a 4x4 offscreen canvas and writes averaged RGB values into `State.videoDominantColor`. This keeps future visual identities able to consume video color context without full-resolution frame reads in the dashboard loop.

## Implementation Notes

The feature is split across these runtime layers:

- `src/config/visualTuning.ts`: defaults, control metadata, preset normalization, audio-sensitivity helpers.
- `src/types/index.ts`: persisted tuning and playback state contracts.
- `src/state/store.ts`: shared runtime state for tuning, performance automation plans, visual mode, playback loop mode, `videoDominantColor`, timeline viewport (`State.zoom` / `State.pan`), and chrome behavior.
- `src/ui/DashboardUI.ts`: facade/orchestrator for preset loading, metadata-aware performance-plan handoff, reactive video backplate sampling/playback-rate modulation, metrics projection, timeline interaction state, `State` writes, `AudioEngine` handoff, and controller coordination. It coordinates the controller and timeline submodules instead of directly owning every DOM binding, raw gesture normalization, or canvas drawing path.
- `src/ui/controllers/PlaybackController.ts`: focused playback DOM controller for upload, play/stop, center-surface playback, seekbar drag state, loop, fullscreen, canvas click/double-click, keyboard shortcuts, time labels, BPM badge, and playback enable/disable state.
- `src/ui/controllers/TuningController.ts`: focused tuning DOM controller for metadata-driven tuning controls, preset selectors, visual mode selection, metrics toggle, copy feedback, and tuning-panel dragging.
- `src/ui/controllers/ExportController.ts`: focused export DOM controller for export selectors, capability warnings, progress labels, stop/cancel controls, and active export UI state.
- `src/automation/dramaturgyTransfer.ts`: DOM-free serialization, validation, and normalization for copying and loading a performance-automation plan through the clipboard. Covered by `tests/dramaturgy-transfer.test.mjs`.
- `src/ui/GestureEngine.ts`: generic deep input-normalization module for mouse, wheel, pointer-like drag, hover, double-click, touch, and pinch zoom input. It emits normalized semantic callbacks and has no knowledge of playback, sections, presets, or rendering.
- `src/ui/TimelineCanvas.ts`: declarative timeline renderer. It consumes `RenderState`, owns HDPI canvas sizing, section/cue/playhead drawing, sensitivity and preset labels, spectral overlays, and waveform offscreen caching.
- `src/export/WebMExporter.ts`: deep main-thread export module. It owns offline time stepping, p5 loop suppression, canvas resize/restore, metadata card drawing, `VideoFrame` capture, audio slicing, stop/cancel behavior, and worker dispatch.
- `src/export/export.worker.ts`: dependency-free WebCodecs and WebM muxing worker. It owns VP8/VP9 video encoding, optional Opus audio encoding, and EBML/WebM byte layout.
- `src/audio/AudioEngine.ts`: loop-on-end playback behavior.
- `src/visuals/`: render usage of tuning values, background color, and sensitivity-scaled audio data.
- `src/visuals/VisualIdentity.ts` and `src/visuals/StyleRegistry.ts`: the visual style contract and registry/factory used by the renderer and UI-selected mode state.

## Analysis And Error Handling Details

Browser-level file loading and `AudioContext.decodeAudioData` failures are surfaced through the dashboard as file-load errors. In that state playback and seek remain disabled, while file selection is re-enabled so the user can choose another track.

Beat events are accepted near the authoritative musical grid (`GridAligner.beats`) when percussive onset/transient evidence is present; extrapolated silent/breakdown beats are suppressed as visual events. Sustained low-frequency energy alone must not continuously generate BeatEvents, while bass-heavy transients remain eligible when paired with sharp local attack. Each accepted event is typed by `BeatEventClassifier` from the accepted peak context:

- Type 3 is the `fx/high-transient hit`, for high-ZCR or high-rolloff/high-band transients.
- Type 2 is the `dense impact hit`, for dense accepted visual impacts that are not high-transient.
- Type 1 is the `default spectral-flux hit`, used as the default visual impact category.

The analyzer publishes `BarAnalysis` entries, RMS fields on `TrackSection`, and tempo confidence metadata on `TrackAnalysis`. Normal tracks remain BPM-aligned; only critically low grid and BPM confidence can make section boundaries energy-reactive. Older payloads are normalized by `AudioEngine.normalizeTrackAnalysis()` so missing bar/RMS/confidence/candidate fields fall back safely instead of breaking the UI.

## Performance Details

Two interaction hot paths are explicitly guarded:

- The paused/stopped p5 draw path does not run `findIndex()` over event or cue arrays each frame. Beat and cue indexes are synchronized through `AudioEngine.addPositionChangedListener(syncEventIndex)`, so linear scans happen only on actual position changes.
- Seekbar and timeline drag do not call `AudioEngine.seek()` repeatedly. Timeline drag input is normalized by `GestureEngine`; `DashboardUI` updates `scrubTime` and redraws visual feedback through `TimelineCanvas` via `requestTimelineDraw()`, then commits one audio seek when the gesture ends.
- The render loop writes modulation through `writeModulationBus(State.modulation, ...)` so the modulation object reference stays stable. `computeModulationBus()` remains a compatibility helper for fresh-object callers, and transient reset zeros the existing modulation fields in place.
- Hot color conversion uses `hueToRgbInto()` with identity-owned RGB tuples. `hueToRgb()` remains available as an allocating compatibility wrapper, but visual identity draw paths avoid new RGB arrays in per-frame loops where practical. Temporal mechanism ring drawing receives numeric RGB components instead of a shared color array reference.
- Browser-free visual identity regression coverage lives in `tests/styles-deterministic.test.mjs`. It renders every registered built-in style through a mock backend over five genre reference profiles and verifies no crashes plus deterministic draw-call counts.
- `P5RendererBackend` skips redundant `fill()`, `stroke()`, and `strokeWeight()` calls by comparing numeric cached components. String keys are avoided in the draw-state cache, while `noFill()` and `noStroke()` still force the next matching fill or stroke call to reactivate p5 state.
- Expensive radial glow is limited to active playback and still respects `performanceMode`, green-screen chroma key, and transparent chroma key. Paused-loaded render targets run at `30 FPS`; no-audio idle targets run at `15 FPS`; playing targets run at `60 FPS`.
