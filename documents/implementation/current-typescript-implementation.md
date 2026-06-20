# Current TypeScript Implementation

This document records the active `plexus-engine/` implementation and clarifies older V0.2 prototype wording.

## Runtime Architecture

The maintained app is a Vite + TypeScript project, not a single-file HTML prototype.

1. **Composition:** `src/main.ts` builds the DOM shell and wires subsystem instances.
2. **Audio orchestration:** `src/audio/AudioEngine.ts` owns decode, source-node lifecycle, playback timing, seek/end reset, worker request ids, stale-result rejection, and worker termination.
3. **Offline analysis:** `src/analyzer/` owns deterministic, environment-independent DSP analysis and exposes headless `analyzeAudio()`. `src/audio/analyzer.worker.ts` is only the Web Worker adapter that communicates through typed worker messages.
4. **Shared contracts:** `src/types/index.ts` defines audio frames, beat events, visual track analysis, analysis requests, success messages, progress messages, and error messages.
5. **Shared runtime state:** `src/state/store.ts` stores accepted analysis results, visual feature state, the abstract modulation bus, live visual tuning, target visual tuning, and render-facing state.
6. **UI facade:** `src/ui/DashboardUI.ts` is now a coordinator rather than a monolithic DOM binding class. It owns cross-cutting UI orchestration, timeline interaction state, dashboard projection, preset/performance-plan handoff, media-loader progress handoff, and calls into `AudioEngine`, shared `State`, timeline modules, and export workflows.
7. **UI controllers:** `src/ui/controllers/PlaybackController.ts`, `src/ui/controllers/TuningController.ts`, and `src/ui/controllers/ExportController.ts` own their specific DOM element bindings, input listeners, enable/disable state, labels, and small UI state. They delegate intent back to `DashboardUI` through callback interfaces; they do not own audio playback, analysis, preset normalization, or export encoding.
8. **Visual rendering:** `src/visuals/` owns p5 rendering, particle lifecycle, shockwave lifecycle, beat-event consumption, visual cue consumption, visual identity registration, and effect-mode delegation. `PlexusRenderer.ts` adapts p5 through `P5RendererBackend` and delegates drawing to the current `VisualIdentity` from `StyleRegistry`. Built-in identities draw through `VisualRendererBackend`.
9. **Visual director:** `src/visuals/VisualDirectorFSM.ts` is the deep state-control module for render-time music dramaturgy. It owns dynamic thresholds, LOW-state dampening, drop anticipation, buildup boost, glitch decay, hysteresis, and transition cooldown behavior.
10. **Offline export:** `src/export/WebMExporter.ts` owns the main-thread offline export loop and `src/export/export.worker.ts` owns WebCodecs encoding plus pure TypeScript WebM muxing.

## Worker Contract

The accepted worker success payload is:

```ts
{
  type: 'analysis_done',
  requestId: number,
  bpm: number,
  bpmConfidence: number,
  gridConfidence: number,
  downbeatConfidence: number,
  tempoCandidates: TempoCandidate[],
  adaptiveThreshold: number,
  frames: AudioFrame[],
  events: BeatEvent[],
  hopSize: number,
  beats: number[],
  barStarts: number[],
  timingConfidence: TimingConfidence,
  trackAnalysis: TrackAnalysis
}
```

`beats`, `barStarts`, and `timingConfidence` are the authoritative musical timing model mirrored at the root for direct worker consumers. The same model is carried on the nested `trackAnalysis` (`tempo`, `tempoConfidence`, `beats`, `beatConfidence`, `barStarts`, `alternativeTempos`, `timingConfidence`). These are public contract fields; extending them is a single-owner schema task that must update `src/types`, `tests/fixtures/analyzer/analysis-result.schema.json`, `normalizeAnalysisResult`, and the empty-template fallbacks in `src/state/store.ts` together. No downstream module may compute an independent beat grid.

The accepted worker failure payload is:

```ts
{
  type: 'analysis_error',
  requestId: number,
  errorCode: string,
  message: string
}
```

The worker may also emit non-terminal progress telemetry while the FFT pass is running:

```ts
{
  type: 'analysis_progress',
  requestId: number,
  progress: number,
  stage: string
}
```

`progress` is normalized `0.0..1.0` inside the analyzer core. The current `FeatureExtractor.process()` reports only when progress has advanced by at least `0.02`, so the main thread receives bounded progress updates during heavy FFT work instead of a single terminal result. The worker adapter forwards the core progress callback as `analysis_progress`; `stage` is currently `Analyzing music...`.

`requestId` is required so stale worker results cannot overwrite newer loads. `AudioEngine.loadFile()` checks the id before accepting progress, success, or error messages. `hopSize` is part of the runtime contract because render synchronization derives frame indexes from playback time, sample rate, and hop size.

`AudioEngine` exposes the telemetry to UI code through `onProgress(progress, stage)`. Native decode reports `0.1` with `Decoding audio...`; worker progress is mapped into the `0.2..1.0` range with `0.2 + workerProgress * 0.8`. `DashboardUI` assigns this callback and delegates visual projection to `PlaybackController.updateProgress()`, which updates `#media-loader-text` and the width of `#media-loader-bar`. The progress bar therefore reflects decode plus real worker telemetry for audio and supported video loads; it is not driven by an estimated timer.

`trackAnalysis` is the offline visual-music layer. It contains bar-level dynamics, section-level structure, recurring temporal patterns, visual cue events, significant moments, per-frame feature vectors for melody, vocal, fx, density, brightness, and tension, plus dramaturgical `buildupConfidence`, `spectralPivot`, and `tensionTrends`. `VisualFeatureFrame.melody` remains the internal/canonical melody feature signal for track analysis, cues, modulation, and temporal rendering; the dashboard-facing melody metric is Melody Presence from the canonical `AudioFrame.melodyProj` projection. Effects should read these precomputed values from shared state during playback instead of running analysis in the render loop.

Tempo analysis now publishes confidence metadata on both the root `AnalysisResult` and `trackAnalysis`: `bpmConfidence`, `gridConfidence`, `downbeatConfidence`, and `tempoCandidates`. `TempoCandidate` carries `bpm`, `score`, `intervalSec`, `peakCount`, `isHalfTime`, and `isDoubleTime`. When candidates exist, the public root `bpm` is the same value as `tempoCandidates[0].bpm`; downstream consumers must not infer a different top candidate from the old scalar alone.

The analyzer also publishes an authoritative musical timing model. The root carries `beats` (beat times in seconds), `barStarts` (downbeat times in seconds), and `timingConfidence` (`{ tempo, beat, grid, overall }`, each `0..1`). The nested `trackAnalysis` carries the full model: `tempo`, `tempoConfidence`, `beats`, `beatConfidence`, `barStarts`, `alternativeTempos`, and `timingConfidence`. This grid is the single source of timing truth; `DramaturgyBuilder` beat events and any downstream bar/beat consumer read from it rather than recomputing a grid.

The headless analyzer derives these values from a fixed 1024-sample FFT pipeline in `src/analyzer/`. `analyzeAudio()` is the single orchestration implementation and now follows an explicit `SpectralCalibration -> Extractor -> Normalizer -> Classifier -> Smoother` pipeline before section and dramaturgy analysis:

- `SpectralCalibration`: performs deterministic signal-integrity calibration before feature extraction. It first runs a fast RMS/flux array scan to select candidate calibration windows, then runs target FFT analysis only on those bounded windows. It estimates track-level spectral centers within safety ranges, emits `SpectralCalibrationConfidence` and `SpectralCalibrationMusicalProfile`, and falls back to default Hz bands for silence or low-confidence material.
- `FeatureExtractor`: performs Hann-windowed FFT analysis and produces per-frame RMS, spectral flux, Hz-based band ratios, centroid, flatness, pitch confidence, Zero Crossing Rate, 85% spectral rolloff, spectral crest, typical maxima, onset envelope, percussive onset score, and bass-sustain evidence.
- `FeatureNormalizer`: converts raw `Float32Array` signals such as RMS and spectral flux to normalized vectors using the same typical-maximum percentile strategy as the legacy analyzer.
- `FeatureClassifier`: maps normalized low-level DSP vectors into semantic music scores for melody, vocal, fx, density, brightness, and tension. FX scoring uses Zero Crossing Rate, flatness, rolloff, brilliance, air energy, and low spectral stability from calibration. Melody scoring is a tonal mid-band concentration heuristic boosted by high spectral stability. Vocal scoring is strictly a mid/presence dominance heuristic and is penalized when calibration reports low `signalToNoise`. The optional musical profile gives small track-level hints such as `lowEnd`, `tonal`, `vocalLike`, `noisyHighs`, `transientRich`, and `midBody`; these hints bias the same deterministic heuristics but do not become a separate source-classification layer. These metrics are deterministic spectral heuristics, not AI/ML stem separation.
- `TemporalSmoother`: applies EMA smoothing to the classifier scores with the analyzer's established alpha values before frame objects are assembled.
- `GridAligner`: the single authoritative timing engine. It runs onset envelope -> `TempoEstimator` (autocorrelation/comb tempo candidates) -> half/double resolution -> `BeatTracker` (dynamic-programming beat tracking) -> bar/downbeat alignment. It publishes ordered tempo candidates, the musical grid (`beats`, `barStarts`, `gridOffset`), `tempo`/`alternativeTempos`, the unified `timingConfidence` (`tempo`/`beat`/`grid`/`overall`), and the legacy BPM/grid/downbeat confidence.
- `TempoEstimator`: deterministic autocorrelation/comb-filter tempo estimation over the onset envelope (70-185 BPM) with a perceptual prior, emitting ranked `{ bpm, confidence }` candidates.
- `BeatTracker`: deterministic Ellis-style dynamic-programming beat tracking. It extrapolates the musical grid through silent/breakdown regions so timing stays continuous; those extrapolated silent beats are kept in the grid but suppressed as visual events.
- `SectionAnalyzer`: converts feature and grid data into `BarAnalysis` and `TrackSection` structures, adaptive energy threshold, RMS statistics, dominant feature, and evidence-based section labels. It uses BPM-aligned four-beat windows by default; only critically low grid and BPM confidence switches to energy-reactive time windows and boundaries instead of trusting a weak bar length.
- `BeatEventClassifier`: classifies an accepted percussive visual event into an internal semantic hit kind using percussive score, attack/transient evidence, Zero Crossing Rate, rolloff, high-band context, and low-band attack support, then maps it back to the public `1 | 2 | 3` schema. Bass is a helper only when paired with sharp attack/percussive evidence.
- `DramaturgyBuilder`: emits `BeatEvent`, `VisualCueEvent`, and recurring `MusicPattern` outputs. Beat events are derived from the authoritative `GridAligner.beats` plus percussive onset/transient evidence from `FeatureExtractor`, not an independent raw-flux peak-picker; a beat whose local onset evidence is negligible (an extrapolated silent/breakdown beat) is suppressed as a visual event so the renderer is not flooded with phantom flashes, while the grid itself still spans the silence. A conservative fallback may accept isolated percussive peaks when grid evidence is absent. `VisualCueEvent` and `MusicPattern` use fuzzy vector similarity for grouping.

`src/analyzer/analyzeAudio.ts` builds the analysis objects, applies Spectral Pivot post-processing, assembles `TrackAnalysis`, and returns the `AnalysisResult`. `self.onmessage` in `src/audio/analyzer.worker.ts` is only the worker boundary: it reads `AnalysisRequest`, calls `analyzeAudio()`, forwards progress, and posts the typed success or error payload. No DSP, scoring, threshold, or dramaturgy logic should live in the worker adapter.

Calibration is intentionally bounded. `collectCalibrationWindowStarts()` scans samples with cheap RMS and flux-style array math to find points of interest: transients, high-energy windows, and stable noise-floor candidates. The calibration FFT pass then analyzes only the selected starts, capped by `maxWindows`, so long files do not trigger unbounded FFT work. Adaptive centers are clamped to the predefined safety ranges for sub, bass, lowMid, mid, presence, brilliance, and air, and adaptive bands are rejected in favor of static defaults if they would overlap, collapse, exceed Nyquist, or come from low `confidence.overall`.

`SpectralCalibrationConfidence` measures signal quality rather than musical source class. `overall` is general calibration reliability, `signalToNoise` is peak contrast against the estimated noise floor, `spectralStability` is consistency of frequency distribution across selected windows, and `dynamicRangeConfidence` is RMS variation across calibration windows. Silence returns zero for all fields. `FeatureClassifier` consumes these fields only to harden spectral heuristics: low `signalToNoise` suppresses vocal-like mid/presence false positives, low `spectralStability` can raise FX when high-frequency bands are active, and high `spectralStability` can support melody presence when mid bands are concentrated.

`SpectralCalibrationMusicalProfile` is a lightweight calibration companion, not a user-facing classifier. It summarizes broad evidence for low-end weight, tonal material, vocal-like mid/presence body, noisy highs, transient richness, and mid-body content. `FeatureClassifier` uses the profile only as small bias terms on melody, vocal, and FX heuristics.

`GridAligner` confidence values are evidence-capped where the evidence actually applies. `bpmConfidence` combines the autocorrelation tempo salience and beat-to-onset alignment, then caps the result by onset-count evidence and a low/kick-transient support cap. The cap is intentionally named narrowly in code: it measures support from RMS rise and low-band/bass content, so it should not be read as universal rhythm confidence for bass-light material (it is what keeps quasi-periodic non-percussive material such as speech from reading as a confident tempo). `gridConfidence` is based on beat-to-onset match ratio and timing error, weighted by tempo confidence and held down by sparse evidence; it is not multiplied by low-end transient loudness, but it also cannot drift too far above weak BPM evidence. `downbeatConfidence` is capped by both `gridConfidence` and `bpmConfidence * 1.2`, so a weak tempo/grid cannot publish a strong downbeat. Half/double resolution uses phase-invariant onset concentration, beat coverage (a true tempo populates most beats while its double leaves every other beat empty), and a kick-vs-snare downbeat score; a fast-tempo preference resolves toward the actual beat rate (e.g. drum & bass at ~174-185, not its ~87 half-time feel) only when the fast grid is genuinely fully covered. Aliases such as 85/170 or 88/176 are annotated, and a clearly dominant candidate remains first.

Each frame is Hann-windowed before the FFT, then `FeatureExtractor` calculates spectral flux, relative Hz-band magnitude ratios, spectral centroid, spectral flatness, Zero Crossing Rate, 85% spectral rolloff, spectral crest, onset envelope, percussive onset score, bass-sustain evidence, and the 24-band perceptual spectrum. The perceptual spectrum pipeline: `createLogBandBoundaries()` computes 25 logarithmically spaced Hz boundaries from `PERCEPTUAL_SPECTRUM_MIN_HZ = 20` to `PERCEPTUAL_SPECTRUM_MAX_HZ = 16000` using `PERCEPTUAL_SPECTRUM_BAND_COUNT = 24`. During FFT analysis, `addPerceptualSpectrumBinEnergy()` distributes each bin's `mag * mag` power across overlapping log bands weighted by `overlap / binWidth`. `computePerceptualSpectrumEffectiveBinCount()` pre-computes the total overlap-weighted bin contribution per band so low/sub bands are not sparse simply because few 1024-sample FFT bins land there. The frame-level band value is `sqrt(power / max(effectiveBinCount, 1e-3))`, stored in `perceptualSpectrumT[band][frame]`. `FeatureClassifier` combines these low-level features into semantic projections: high ZCR/flatness/rolloff favors FX, strong crest plus low flatness favors melody presence, and low-mid/mid/presence balance with low ZCR favors vocal-like mid/presence dominance. Vocal is not lyric or singer detection; FX is transient/high-frequency presence, not an effects bus. None of these metrics are AI/ML stem separators. The render-facing `AudioFrame` values remain schema-compatible semantic projections: `e` is normalized RMS energy, `densityProj` is smoothed spectral-flux density, `melodyProj` is smoothed tonal melody presence, `fxProj` is smoothed FX/noise/transient pressure, and `perceptualSpectrum` is the precomputed 24-band logarithmic spectral balance array from `buildPerceptualSpectrum()` in `analyzeAudio.ts`. `buildPerceptualSpectrum()` normalizes each band against a track-relative baseline (p88/p98 of the per-band distribution), applies a soft shape, and applies a simplified inverse perceptual compensation: bass/sub bands are visually lifted, presence is modestly controlled, and extreme high frequencies are very gently attenuated. The first six low bands receive very light adjacent smoothing to improve readability. `buildPerceptualSpectrum()` runs once after feature extraction — it is not called in the render loop and does not perform realtime FFT.

`perceptualSpectrum` pipeline: `FeatureExtractor.perceptualSpectrumT/perceptualSpectrumEffectiveBinCount` → `analyzeAudio.buildPerceptualSpectrum()` → `AudioFrame.perceptualSpectrum` → `PlexusRenderer.copyAudioFrame()` copies array reference into `State.currentFrame.perceptualSpectrum` → `DashboardUI.drawPerceptualSpectrum()` renders a 24-column monochrome canvas. No DSP runs in the render loop or in `DashboardUI` for this metric.

Beat Impulse follows this offline pipeline: `FeatureExtractor -> onset/percussive/sustain evidence -> GridAligner authoritative beats -> DramaturgyBuilder accepted BeatEvents -> BeatEventClassifier visual type -> PlexusRenderer State.beatDecay -> Dashboard Beat Impulse / visuals`. Beat events are emitted near the authoritative `GridAligner.beats` when percussive onset/transient evidence passes the adaptive gate; silent/extrapolated beats are suppressed as visual events. Sustained or rolling low-frequency energy alone must not continuously generate `BeatEvent` entries. Bass-heavy transient material remains eligible when a sharp attack/percussive onset is present. Public types remain visual impact categories: type 1 is the default spectral-flux hit legacy label, type 2 is dense impact hit, and type 3 is fx/high-transient hit.

The export worker is separate from the analyzer worker. It accepts:

- `start_export`: width, height, fps, sample rate, optional bitrate and codec, and audio availability.
- `encode_frame`: transferable `VideoFrame`, timestamp, and optional transferable stereo planar `Float32Array` audio payload.
- `finalize_export`: flush encoders and return `{ type: 'export_done', blob }`.

It uses WebCodecs `VideoEncoder` with VP9 by default (`vp09.00.10.08`) and optional VP8. Default bitrate scales from lower-resolution exports through roughly 6 Mbps at 1080p and 20 Mbps at 4K. When audio is available and the browser supports it, the worker configures `AudioEncoder` with Opus, source sample rate, and two channels. Missing `AudioEncoder` or `AudioData` is non-fatal: the worker posts an audio warning and continues video-only.

Rather than accumulating encoded chunks in memory, the worker writes directly to disk using the Origin Private File System API (`navigator.storage.getDirectory()`). Each muxed chunk is written synchronously via `FileSystemSyncAccessHandle` and immediately discarded from RAM. Upon `finalize_export` the completed file is retrieved as a native `Blob` via `fileHandle.getFile()` without any in-memory reassembly. The worker also continuously reports its current `encodeQueueSize` to the main thread via `queue_update` messages; the main thread uses this value to enforce strict backpressure (`while (workerQueueDepth >= 2) await sleep(1)`), preventing OOM crashes on memory-constrained devices.

`WebMMuxer` is local to `src/export/export.worker.ts`. It writes EBML header, Segment, Info, Tracks, Clusters, and SimpleBlock elements without external packages. Video track number is 1; audio track number is 2 with `A_OPUS` metadata and an OpusHead private header.

Bar analysis is normally derived from BPM-aligned four-beat windows. `SectionAnalyzer` uses fixed-duration analysis windows and energy-reactive section boundaries only when both `gridConfidence < 0.15` and `bpmConfidence < 0.20`, so normal music is not pushed into fallback merely because the low-end transient profile is weak. Each `BarAnalysis` entry stores `start`, `end`, `energy`, `density`, `avgRms`, `peakRms`, BarAnalysis bass/mid/treble spectral-band ratios, macro `HIGH`/`LOW` state, and dominant feature. `TrackSection` entries also carry `avgRms` and `peakRms`, and their `start`/`end` times come from the computed section boundary indexes. `normalizeTrackAnalysis()` in `src/analyzer/normalizeAnalysisResult.ts` backfills these fields for older analysis payloads or presets that do not yet contain the expanded contract.

`SectionAnalyzer` no longer assigns labels through a single rigid threshold chain. For every candidate label (`intro`, `verse`, `build`, `drop`, `break`, `peak`, `outro`) it computes a normalized weighted confidence score from average section energy, previous section energy, density, bass/density context, tension, dominant feature, and first/last-section position. The highest score wins when it clears the confidence floor; otherwise the section falls back to `verse`. This keeps segmentation deterministic while making labels less brittle across genres and mastering differences.

Recurring temporal patterns are detected by fuzzy section similarity rather than exact section-signature strings. For each section longer than one bar, `DramaturgyBuilder` compares energy, density, and dominant feature against existing pattern group centroids with a Euclidean distance function. Sections below the deterministic match threshold join the closest group and update its centroid; otherwise a new group is started. Groups with at least two sections become `MusicPattern` entries, preserving stable output order by first occurrence.

The dramaturgy engine builds a normalized pressure curve from `feature.tension * 0.34 + feature.density * 0.28 + frame.e * 0.22 + frame.eRatio * 0.16`. A rolling comparison between recent and previous pressure windows produces `buildupConfidence`; section-like trend segments publish rising, falling, or stable directions. Spectral Pivot is an offline post-process that boosts melody, vocal, fx, and tension only when `sE > 0.04`, `eRatio < 0.55`, and buildup or `LOW_DROP` tension is present. Below the `sE <= 0.04` noise gate, delicate features, `AudioFrame.melodyProj`, `AudioFrame.fxProj`, and `spectralPivot` are forced to exact zero.

`PlexusRenderer` now delegates render-time macro decisions to `VisualDirectorFSM`. The director reads the accepted frame copy, current feature copy, `buildupConfidence`, `spectralPivot`, tuning, modulation bus, and optional future frame for drop anticipation. It writes a `DirectorOutput` snapshot into `State.directorOutput`:

- `state`: `IDLE`, `INTRO_BREAK`, `BUILDUP`, `DROP`, or `GLITCH_LOW_DROP`.
- `centripetalOrbit`: normalized buildup orbit force used by particles.
- `glitchIntensity`: exponentially decaying LOW_DROP glitch envelope.
- `invertBackground`: background inversion flag; currently false to avoid full-screen strobe behavior.

During `GLITCH_LOW_DROP`, `glitchIntensity` starts at `1.0` and decays with `Math.exp(-elapsed * 4.0)`. Classic, temporal, and cyberpunk glitch-style drawing derives coordinate offsets from deterministic index/salt/phase formulas instead of random jitter. The offset is deterministic for the same particle indexes, salt, and rotation phase, so export output remains reproducible.

## Memory Management And State Reset

`AudioEngine.clearAnalysisState()` resets accepted analysis state before new loads, errors, and cancellation paths. `State.currentFrame` is reset with `perceptualSpectrum: new Array(24).fill(0)` so the spectrum canvas does not show stale data from a previous track. `State.frames` and `State.events` are replaced with fresh empty arrays, and `State.trackAnalysis` is reset with a deep-copy serialization of the empty `TrackAnalysis` template:

```ts
State.trackAnalysis = JSON.parse(JSON.stringify(EMPTY_TRACK_ANALYSIS));
```

The deep copy is intentional. The empty analysis template contains nested arrays and objects, including `tensionTrends`, so assigning the template by reference would allow reference pollution between track loads. Each reset must create an isolated `TrackAnalysis` object graph before the next worker result is accepted. Accepted worker results still pass through analyzer-owned `normalizeTrackAnalysis()` before publication so older or partial payloads receive deterministic defaults for expanded bar, section, spectral pivot, trend, feature-hop, grid-offset, confidence, and tempo-candidate fields. Legacy payloads without confidence metadata normalize to confidence `0` and `tempoCandidates: []`. `AudioEngine` owns the deep-copy protection and runtime reset, while `src/analyzer/` owns the canonical analysis shape.

## Modulation Bus And Morphing

`State.modulation` is the render-facing music abstraction:

- `kineticTension`: vocal, melody, tension, cue, and dramaturgy pressure.
- `densityDrive`: density/energy-driven animation signal.
- `spectralChaos`: fx, brightness, and high transient pressure.
- `rhythmicImpulse`: beat and cue decay impulses.
- `macroMomentum`: block-level energy and long-form momentum.

`computeModulationBus(frame, features, beatDecay, cueDecay, tuning)` clamps every output to `0.0..1.0` after applying `audioSensitivity`. It remains the compatibility API for callers that need a fresh object. The render loop uses `writeModulationBus(State.modulation, frame, features, beatDecay, cueDecay, tuning)` instead, so `State.modulation` keeps a stable object reference and draw-time updates do not allocate a new modulation object each frame. Transient reset follows the same rule: `resetTransientVisualState()` zeros the existing `State.modulation` fields in place instead of assigning a replacement object.

Dashboard Beat Impulse is `State.beatDecay` from consumed accepted `BeatEvent[]`. It is a decaying visual pulse, not BPM, raw bass, raw beat strength, or drum stem detection.

`State.visualTuning` is the live interpolated tuning. `State.targetTuning` is the selected destination. Presets and sliders write to `targetTuning`; `PlexusRenderer.draw()` calls `applyTuningMorph()` before frame publication so numeric tuning values move toward their targets without overshooting. Automation point intensity values from `State.editedPerformancePlan` (or `State.performancePlan` when no user edits exist) temporarily replace the live `audioSensitivity` for the active point's morph zone during the current draw frame; the original global sensitivity is restored before the frame ends. `State.sectionOverrides` is fully removed. Tuning normalization and morphing iterate a module-level `visualTuningKeys` list instead of rebuilding `Object.keys(defaultVisualTuning)` in hot paths. This keeps preset changes stage-safe during live playback.

## Visual Identities

The renderer supports five selectable visual identities through `State.visualMode`:

- `classic`: preserves the original Plexus particle network, center glow, beat shockwaves, and polygon flash behavior.
- `temporal`: keeps the same particle and shockwave primitives but re-composes them around full-track analysis. It does not draw pattern detections as bar-aligned labels and avoids unrelated decorative wave/ellipse motifs. Instead, `trackAnalysis` continuously modulates polygon color, movement, density, connection sensitivity, background tone, and central mechanism rings for beat, melody, vocal, fx, and pattern resonance.
- `dark-techno`: strict monochrome industrial style with sharp white/gray line work, sparse high-brightness strobe polygon flashes, and no radial glow usage.
- `organic-ambient`: slow, fluid, pastel green/blue/earth-tone style that avoids sharp network lines and draws soft particle glow fields instead.
- `cyberpunk`: high-contrast neon magenta/cyan style with chromatic-aberration line offsets and deterministic high-tension glitch coordinate shifts.

The common contract is `src/visuals/VisualIdentity.ts`. `src/visuals/StyleRegistry.ts` keeps identities in a private `Map`, exposes `register()` and `get()`, and provides `createDefaultStyleRegistry()` for application composition. Unknown style ids fall back to `classic`; missing `classic` registration is treated as a composition error.

Mode selection belongs to UI projection. `src/main.ts` exposes all five style ids in `#visual-mode`, and `DashboardUI` validates selected/preset-loaded ids before writing `State.visualMode`. Presets remain backward-compatible: missing or unknown `visualMode` fields do not break loading, while known style ids update both shared state and the select element.

`src/visuals/PlexusRenderer.ts` only synchronizes playback/analysis state and delegates to the selected identity; no audio analysis may run in a visual identity.

## Visual Tuning And Playback UI

The active implementation includes a metadata-driven visual tuning panel, JSON preset loading and copy export, surface-level playback controls, fullscreen presentation mode, OBS-oriented presentation URL mode, loop/once playback, responsive metrics, media-load progress overlay, and idle-hiding UI chrome. The old monolithic `DashboardUI` surface has been split into a facade plus focused controllers: `PlaybackController` owns file/play/seek/loop/fullscreen/surface-key bindings, media-loader visibility/progress projection, `TuningController` owns tuning controls, preset selectors, visual mode selection, metrics toggle, copy feedback, and tuning-panel dragging, and `ExportController` owns export capability projection, export selectors, progress labels, stop/cancel buttons, and active export UI state. `DashboardUI` remains the coordinator that translates controller callbacks into `AudioEngine`, `State`, preset, timeline, and exporter operations. A single visual-surface click pins or unpins the chrome after the double-click detection window, while double-click remains the play/pause gesture. Unpinning through that intentional background click uses a fast `400ms` hide delay; ordinary inactivity, hover leave, and focus-out paths continue to use the standard `2600ms` delay.

Application boot uses a separate `#app-loader` overlay for FOUC protection. `src/main.ts` captures `bootStart` before composing the DOM shell, then waits for both renderer initialization and a minimum-delay promise. The delay promise uses `Math.max(0, 800 - (Date.now() - bootStart))`, so the loader remains visible for at least `800ms` from boot start even when JavaScript initialization completes faster. After `Promise.all([appReadyPromise, minDelayPromise])`, the loader receives `.fade-out` and is removed on `transitionend`.

For stream output, `chromaKeyMode` selects normal, green, or transparent background clearing. `performanceMode` disables radial-gradient glow work and chroma-key modes also skip those expensive glow paths. Expensive radial glow also requires `State.isPlaying`, so paused and idle views keep their static visual state without rebuilding radial gradients. `PlexusRenderer` lowers the p5 frame-rate target by playback state: playing runs at `60 FPS`, paused with a loaded track runs at `30 FPS`, and no-audio idle runs at `15 FPS`. The frame-rate call is issued only when the target changes, and this policy does not alter audio playback or offline analysis behavior. `?presentation=true` sets `State.uiVisible` to `false` and hides the UI chrome automatically.

The seek chrome includes an interactive dramaturgy timeline canvas. It does not perform analysis at runtime. `DashboardUI.drawDramaturgyTimeline()` projects precomputed `TrackAnalysis` data into layered canvas bands: section blocks use label-specific colors, `drawTimelineGridlines()` draws BPM-derived bar boundaries, `drawTimelineRms()` draws bar-level RMS/peak pressure, `buildupConfidence` is drawn as a cyan tension wave, `spectralPivot` active regions are drawn as a magenta dotted overlay, `tensionTrends.segments` are drawn as rising/falling/stable guide strokes, and selected cue kinds (`impact`, `break`) appear as labeled markers. Per-section sensitivity lines map vertical position to `0.1..4.0` and overridden values are labeled `S:x.xx`. The configured `dropAnticipation` window is shown as a magenta suspense gradient to the right of the playhead. The canvas is HDPI-aware and redraws through `requestTimelineDraw()` when user interaction can arrive faster than animation frames. `updateDashboard()` does not imply a timeline redraw; it calls `requestDashboardTimelineDraw()`, which redraws only when the analysis reference, canvas size, zoom, scroll, scrub state, or visible playhead position changes. The playhead threshold is one visible pixel, computed as `viewport.duration / Math.max(1, rect.width)`.

Timeline scrubbing is intentionally separated from audio seeking. `DashboardUI` owns `private scrubTime: number | null`; pointer or seekbar drag calls `setScrubTime()`, updates the visible time label, updates the seekbar value, and redraws the playhead in yellow without touching the Web Audio source graph. `commitScrubTime()` is called when the interaction ends (`pointerup`, `pointercancel`, `change`, or touch-end paths). Only that commit performs the single final `AudioEngine.seek(targetTime)` call. `updateDashboard()` also respects this state: while `scrubTime` is non-null, playback time does not overwrite the user's in-progress scrub position.

The top-right timeline control opens a fullscreen inspection overlay rather than performing a small height toggle. Overlay mode applies `.timeline-overlay-active` to the `.seek-container`, `.is-fullscreen-overlay` to `.timeline-wrapper`, and `body.timeline-overlay-open` to the page. The two-level structure makes the full seek container the fixed viewport shell while the wrapper becomes the absolute drawing surface. Closing the overlay restores the previous bottom placement and the last manually expanded height. The resize handle remains available outside overlay mode for compact-to-expanded manual inspection.

The timeline action bar also contains the offline WebM export controls. `#export-resolution` selects `720p`, `1080p`, or `4K`; `#export-aspect` selects `16:9`, `9:16`, or `1:1`; `#export-video-btn` starts export after analysis; `#stop-export-btn` finalizes a partial WebM; and `#cancel-export-btn` aborts without saving. Export progress is shown on the export button label. The active file name from `#status-text` becomes the exported metadata-card track name.

When a video backplate is active, `DashboardUI` keeps the muted video synchronized to audio clock events and performs lightweight reactive updates from the dashboard tick. The reactive path clamps `video.playbackRate` to `0.5..2.0` from `macroMomentum` and `rhythmicImpulse`, resets it to `1.0` on pause/stop/clear/export-start, and skips rate modulation while `State.isExporting`. The same path samples the current video frame through a 4x4 offscreen canvas and stores averaged RGB in `State.videoDominantColor`.

Performance plan preset selection is semantic. `GeneratorOptions.presetMetadata` carries preloaded JSON payloads, and `choosePreset()` ranks available presets by tuning/dramaturgy features before using legacy filename hints. High-energy drop/peak sections favor high particle/beat energy and low `dropDampening`; build sections favor `buildupIntensity` and temporal motion parameters; break/intro sections favor restrained energy and `breakRestraint`; vocal/melody/fx dominant sections add feature-specific boosts. Custom filenames work if their metadata matches the section.

During export, `DashboardUI` disables playback, seek, upload, and export selectors, then ignores canvas click, canvas keydown, and the global drawing shortcut while `State.isExporting` is true. This prevents playback or envelope state changes from racing the offline frame loop.

Zoom and pan are local UI viewport transforms. `timelineZoomLevel` is clamped from `1` to `16`; `timelineScrollOffsetTime` stores the visible window start in seconds. The visible duration is `State.duration / timelineZoomLevel`, time-to-x mapping is `((time - viewport.start) / viewport.duration) * width`, and x-to-time mapping is `viewport.start + (x / width) * viewport.duration`. Wheel zoom keeps the cursor's time stable by recalculating `timelineScrollOffsetTime` after the zoom change. Normal left drag always scrubs/seeks; Shift-drag or middle-button drag pans. During playback, `followTimelinePlayhead()` recenters the viewport when the playhead leaves the `15%..75%` visible range.

Timeline hover uses a DOM tooltip instead of canvas text. `#timeline-tooltip` is positioned next to the pointer and reports the hovered time, zoom, section, bar state, RMS, BarAnalysis bass/mid/treble spectral-band ratios, buildup pressure, tension trend, and nearby cue where available. Analyzer internals such as BPM/grid/downbeat confidence and alternate tempo candidates are appended only when `featureFlags.analyzerDebugOverlay` is enabled; the default user UI does not expose those debug values. Keeping the tooltip in HTML avoids redrawing text-heavy canvas overlays on every pointer move.

Auto-generated performance automation points may include `analysisConfidence` and `timingMode`. `timingMode: 'bar-aligned'` means the point was scheduled against the analyzed bar grid; `timingMode: 'energy-reactive'` means both grid and BPM confidence were critically low, so the generator avoided strict beat snapping. `analysisConfidence` scales the point confidence from the accepted BPM/grid evidence and lets consumers treat low-confidence automation more loosely.

## Performance Notes

The renderer still uses offline preprocessing for music analysis. Playback-time dramaturgy access remains an indexed lookup over `State.trackAnalysis.buildupConfidence`.

Recent hot-path optimizations:

- `PlexusRenderer.draw()` no longer recalculates event and cue indexes with `findIndex()` from the paused/stopped draw path. That O(N) search was worst near the end of long tracks because each frame had to scan most or all event arrays. Index synchronization now happens through `syncEventIndex(time)`, registered once with `AudioEngine.addPositionChangedListener()`, so the scan runs only on real position changes such as seek, stop, or load reset.
- Timeline and seekbar scrubbing no longer rebuild Web Audio source nodes on every pointer or input event. The UI buffers the drag target in `scrubTime`, redraws visual feedback through `requestAnimationFrame`, and commits one final `AudioEngine.seek()` when the gesture ends.
- `Particle.update()` now checks boundary distance with squared distance, uses vector normalization for center pull, and updates position with direct component math (`pos.x += vel.x * speed`, `pos.y += vel.y * speed`) instead of allocating through `p5.Vector.mult()`.
- `P5RendererBackend` caches fill color, stroke color, and stroke weight so repeated identical p5 state changes are skipped. The cache compares numeric RGBA components (`lastFillR/G/B/A`, `lastStrokeR/G/B/A`) instead of allocating string keys. It still tracks `noStroke()` and `noFill()` activation state so a later identical stroke/fill call re-enables drawing correctly.
- Hot render paths should use `hueToRgbInto(target, hue, saturation, lightness)` with caller-owned RGB tuples. `hueToRgb()` remains a compatibility wrapper for non-hot callers. Visual identity color buffers are identity-owned private fields rather than unmanaged module-level writable state. Temporal mechanism rings pass numeric `colorR/colorG/colorB` components across the `drawMechanismRing()` boundary to avoid shared array reference hazards.
- `writeModulationBus()` updates the existing `State.modulation` object in the render loop. `computeModulationBus()` remains available when a fresh modulation object is required outside that hot path.
- Classic and temporal radial glow now require both `State.isPlaying` and `shouldUseExpensiveGlow(State.visualTuning)`, so paused, idle, performance-mode, chroma, and transparent-background paths avoid radial gradient construction.
- Dark Techno intentionally never calls `radialGlow`. Organic Ambient intentionally uses radial glow as its primary fog field and should therefore be evaluated with performance mode/chroma constraints in render smoke checks.
- `DashboardUI.updateDashboard()` no longer causes an unconditional dramaturgy timeline redraw. Timeline redraw is throttled to visible changes in analysis, size, zoom, scroll, scrub state, or playhead movement of at least one visible pixel.
- Playback remains render/main-thread limited during draw. `TrackAnalysis` is still produced offline by the worker and read during playback as accepted precomputed state; the cleanup reduces allocation, garbage collection, Canvas state churn, and paused/idle render load rather than moving analysis work.
- UI chrome intentionally separates fast user-requested hide feedback (`400ms` after background unpin) from passive idle hiding (`2600ms`) so normal interaction stays forgiving while explicit hide feels immediate.
- Offline export captures frames immediately after p5 redraw plus metadata-card drawing and before yielding to `requestAnimationFrame`. This protects the watermark from browser buffer swaps or canvas clears. The exporter still yields after capture so the UI can update progress and respond to stop/cancel.
- Object URLs for exported WebM downloads are revoked after a `1000ms` timeout rather than synchronously after link removal, giving the browser download queue time to claim the Blob.

Validation for these rendering and UI performance contracts should include TypeScript checking, Vite build, Node tests, and `git diff --check`. On Windows setups where package-manager shims such as `npm` are not on `PATH`, use the local `node_modules` entrypoints through the Codex bundled Node executable and report the exact fallback commands. The current Vite production build may still report a non-fatal chunk-size warning.

Detailed documentation:

- Feature record: `documents/features/visual-tuning-presets-and-playback-ui.md`
- Offline export record: `documents/features/offline-webm-export.md`
- Visual identity record: `documents/features/visual-identities.md`
- Acceptance criteria: `documents/acceptance-criteria/visual-tuning-presets-and-playback-ui-acs.md`
- Architecture decision: `documents/adr/ADR-001-visual-tuning-presets-and-playback-ui.md`

## AC Clarifications

- **AC 1.2 - Loading state:** Selecting a new file must stop playback, invalidate previous analysis, terminate any active worker, disable `Play` and `Seek`, reset visible playback position to `0:00`, and re-enable controls only after an accepted analysis result.
- **AC 1.3 / VT-7 - End state:** In `Loop` mode, natural track end resets the current source and immediately starts playback from `0:00`. In `Once` mode, natural track end resets playback time, seek bar, `Play` label, active strategy text, beat decay, dense impact flash, cue decay, and visual event indexes.
- **AC 1.4 - Seek:** Finished seeking must use the audio engine `seek()` path so playback offset, visible time, paused time, source-node lifecycle, and visual beat-event index are aligned in one transition. In-progress pointer or slider dragging must use `scrubTime` and must not call `seek()` repeatedly.
- **AC 1.5 - Decode failure UI:** Browser-level audio decode or file-load failures must leave `Play` and `Seek` disabled, re-enable file selection, and show a file-load error in the dashboard.
- **AC 3.6 - Beat event classification:** Beat type classification is part of the analyzer contract: `DramaturgyBuilder` accepts visual beat events from percussive onset/transient evidence near the authoritative grid, with sustained bass rejection; `BeatEventClassifier` then maps accepted events back to the public schema. Type 1 keeps the legacy `default spectral-flux hit` label for the default visual impact category, type 2 is `dense impact hit`, and type 3 is `fx/high-transient hit`. These labels are visual semantics, not instrument certainty.
- **AC 5.2 - Analyzer bands:** The current worker uses Hann-windowed FFT spectral features rather than the older IIR crossover wording from the prototype.
- **AC 5.4 - Worker output:** The worker success payload includes `type`, `requestId`, `bpm`, `adaptiveThreshold`, `frames`, `events`, `hopSize`, and `trackAnalysis`. The worker may also emit typed failure payloads with `type`, `requestId`, `errorCode`, and `message`.
- **AC 8.1 - Worker and source cleanup:** New file loads must terminate superseded workers and ignore stale worker messages. Audio samples sent to the worker must be an explicit copy when playback still depends on the decoded `AudioBuffer`.
