# ADR-002: Headless Analyzer Core

## Status

Accepted

## Date

2026-06-17

## Context

The offline analyzer logic was previously concentrated in `src/audio/analyzer.worker.ts`. That made the Web Worker boundary the effective owner of DSP, BPM/grid alignment, section analysis, dramaturgy, Spectral Pivot post-processing, and result assembly.

This coupling created several architectural limits:

- The same deterministic analysis pipeline could not run cleanly in Node.js without Worker APIs or worker mocks.
- Future deployment targets such as backend batch analysis, SaaS processing, or VST-adjacent tooling would need to duplicate or emulate the worker environment.
- Tests that needed analyzer behavior had to load a browser-worker-shaped module instead of a pure TypeScript API.
- The worker message contract and the music analysis implementation were too easy to change together.

The project requires deterministic output, stable worker protocol, no DSP/scoring/BPM threshold changes, and no AudioEngine public API changes.

## Decision

Extract the DSP and dramaturgy implementation into a pure, environment-agnostic analyzer core under `src/analyzer/`.

The analyzer core now owns:

- `analyzeAudio()` as the single orchestration pipeline.
- `FeatureExtractor` for Hann-windowed FFT features.
- `GridAligner` as the single authoritative timing engine: it runs `FeatureExtractor` onset envelope -> `TempoEstimator` -> half/double resolution -> `BeatTracker` -> bar/downbeat alignment, producing tempo candidates, the musical grid (`beats`, `barStarts`, `gridOffset`), and the unified `timingConfidence` plus the legacy tempo/grid/downbeat confidence fields.
- `TempoEstimator` for deterministic autocorrelation/comb-filter tempo estimation (70-185 BPM) over the onset envelope.
- `BeatTracker` for deterministic dynamic-programming beat tracking that extrapolates the musical grid through silent/breakdown regions.
- `SectionAnalyzer` for bar and section analysis, including energy-reactive fallback when both grid and BPM confidence are critically low.
- `DramaturgyBuilder` and `computeDramaturgyAnalysis()` for visual cues, recurring patterns, buildup confidence, tension trends, and dramaturgy data, and for beat events derived from the authoritative `GridAligner.beats` (extrapolated silent beats are suppressed as visual events).
- `normalizeTrackAnalysis()` and `EMPTY_TRACK_ANALYSIS` as canonical analysis normalization.
- Analyzer constants such as `ANALYSIS_ALGORITHM_VERSION` and the default hop size.

Keep `src/audio/analyzer.worker.ts` as a thin adapter. It reads `AnalysisRequest`, converts the transferred samples to `Float32Array`, calls `analyzeAudio()`, forwards progress callbacks as `analysis_progress`, posts `analysis_done`, and formats `analysis_error`.

Keep `AudioEngine` responsible for playback lifecycle, worker lifecycle, stale request rejection, runtime state reset, and deep-copy protections. Analyzer-owned normalization accepts injected context such as `fallbackBpm` instead of reading shared runtime state directly.

## Decisions Extended: Percussive BeatEvents

BeatEvent generation is part of the headless analyzer contract and remains offline/deterministic. `FeatureExtractor` exposes onset and sustain evidence (`onsetEnvT`, `percussiveT`, and `bassSustainT`) alongside the existing spectral features. `DramaturgyBuilder` derives accepted visual `BeatEvent` entries from the authoritative timing model gated by percussive onset/transient evidence. The authoritative grid may still span silent or weak regions, but extrapolated silent beats do not become visual events without local onset evidence.

Sustained low-frequency energy is suppressed unless it is paired with sharp attack/transient evidence. Bass-heavy transient material can still be accepted; bass is a helper signal, not a standalone trigger. `BeatEventClassifier` maps accepted events back to the public `1 | 2 | 3` visual-impact schema without claiming source or stem certainty.

No render-loop DSP is allowed for Beat Impulse. The renderer only consumes precomputed `BeatEvent[]`, sets `State.beatDecay` when an accepted event crosses the playhead, and lets that visual pulse decay.

## Consequences

Positive:

- Analyzer logic is reusable in browser, Node.js, backend, SaaS, and future VST-adjacent environments without Worker APIs.
- Deterministic output is preserved because the extracted classes and orchestration keep the existing math, thresholds, and ordering.
- Tests can execute `analyzeAudio()` directly in Node.js and still validate the worker adapter contract separately.
- The worker protocol is easier to protect because the worker no longer owns business logic.
- `AudioEngine` remains focused on Web Audio, worker invocation, stale-result protection, and runtime publication.
- Canonical `TrackAnalysis` normalization now lives with the analyzer domain while `AudioEngine` keeps memory-safety reset ownership.
- Tempo confidence and alternate tempo candidates can be validated in headless tests without browser-worker setup.
- Critically low-confidence material can publish conservative BPM/grid/downbeat evidence and use energy-reactive section boundaries instead of over-trusting a weak bar grid.

Tradeoffs:

- Analyzer changes now span several focused files instead of one monolithic worker file.
- Tests and governance must distinguish analyzer-core changes from worker-adapter changes.
- Any future dependency added under `src/analyzer/` must be compatible with browser and Node.js execution.
- Confidence fields are now part of the append-only analyzer contract; schema fixtures, normalizers, empty state, worker consumers, and mocks must be kept in sync.
- The low-transient evidence cap is intentionally conservative and kick/low-transient oriented. It should not be described as universal rhythm confidence for every genre or source type.

## Alternatives Considered

- **Keep analysis in the worker and improve tests around it:** Rejected because it preserves the Worker API dependency and blocks clean Node.js or backend execution.
- **Duplicate analyzer logic for Node.js:** Rejected because duplicated DSP and dramaturgy logic would risk output drift.
- **Move analysis into AudioEngine:** Rejected because playback lifecycle and analysis computation need separate ownership, and AudioEngine must not become the DSP owner.

## Implementation Note: Perceptual Spectrum

The headless analyzer output schema was extended with `AudioFrame.perceptualSpectrum: number[]`. This field is a 24-element array produced by `buildPerceptualSpectrum()` in `src/analyzer/analyzeAudio.ts` and is part of the offline analyzer output — not a realtime or render-loop computation.

The pipeline remains headless and environment-independent:

- `FeatureExtractor` accumulates `perceptualSpectrumT` and `perceptualSpectrumEffectiveBinCount` during the same FFT pass used for all other spectral features. No additional audio decoding or worker spawning is required.
- `analyzeAudio.buildPerceptualSpectrum()` applies track-relative normalization, effective-bin normalization, simplified inverse perceptual compensation, and low-band smoothing — all deterministic and environment-agnostic.
- The dashboard (`DashboardUI`) is a consumer only. It draws the precomputed values but does not analyze audio.

Schema compatibility requirements: `src/types/index.ts` `AudioFrame` interface, `tests/fixtures/analyzer/analysis-result.schema.json` `audioFrame` schema (now requires `perceptualSpectrum` as a 24-element array), `normalizeAnalysisResult`, and both `State.currentFrame` and `AudioEngine.clearAnalysisState()` fallback initializers must all be kept in sync when extending this field.

## Implementation References

- `src/analyzer/`
- `src/analyzer/analyzeAudio.ts`
- `src/analyzer/FeatureExtractor.ts`
- `src/analyzer/TempoEstimator.ts`
- `src/analyzer/BeatTracker.ts`
- `src/analyzer/GridAligner.ts`
- `src/analyzer/SectionAnalyzer.ts`
- `src/analyzer/DramaturgyBuilder.ts`
- `src/analyzer/normalizeAnalysisResult.ts`
- `src/audio/analyzer.worker.ts`
- `src/audio/AudioEngine.ts`
- `tests/analyzer-parity.test.mjs`
- `tests/analyzer-golden.test.mjs`
- `tests/analyzer-verification.test.mjs`
- `tests/analyzer-dsp.test.mjs`
- `tests/contracts.test.mjs`
- `tests/dramaturgy.test.mjs`
