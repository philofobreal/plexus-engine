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
- `GridAligner` for BPM and bar-grid alignment.
- `SectionAnalyzer` for bar and section analysis.
- `DramaturgyBuilder` and `computeDramaturgyAnalysis()` for beat events, visual cues, recurring patterns, buildup confidence, tension trends, and dramaturgy data.
- `normalizeTrackAnalysis()` and `EMPTY_TRACK_ANALYSIS` as canonical analysis normalization.
- Analyzer constants such as `ANALYSIS_ALGORITHM_VERSION` and the default hop size.

Keep `src/audio/analyzer.worker.ts` as a thin adapter. It reads `AnalysisRequest`, converts the transferred samples to `Float32Array`, calls `analyzeAudio()`, forwards progress callbacks as `analysis_progress`, posts `analysis_done`, and formats `analysis_error`.

Keep `AudioEngine` responsible for playback lifecycle, worker lifecycle, stale request rejection, runtime state reset, and deep-copy protections. Analyzer-owned normalization accepts injected context such as `fallbackBpm` instead of reading shared runtime state directly.

## Consequences

Positive:

- Analyzer logic is reusable in browser, Node.js, backend, SaaS, and future VST-adjacent environments without Worker APIs.
- Deterministic output is preserved because the extracted classes and orchestration keep the existing math, thresholds, and ordering.
- Tests can execute `analyzeAudio()` directly in Node.js and still validate the worker adapter contract separately.
- The worker protocol is easier to protect because the worker no longer owns business logic.
- `AudioEngine` remains focused on Web Audio, worker invocation, stale-result protection, and runtime publication.
- Canonical `TrackAnalysis` normalization now lives with the analyzer domain while `AudioEngine` keeps memory-safety reset ownership.

Tradeoffs:

- Analyzer changes now span several focused files instead of one monolithic worker file.
- Tests and governance must distinguish analyzer-core changes from worker-adapter changes.
- Any future dependency added under `src/analyzer/` must be compatible with browser and Node.js execution.

## Alternatives Considered

- **Keep analysis in the worker and improve tests around it:** Rejected because it preserves the Worker API dependency and blocks clean Node.js or backend execution.
- **Duplicate analyzer logic for Node.js:** Rejected because duplicated DSP and dramaturgy logic would risk output drift.
- **Move analysis into AudioEngine:** Rejected because playback lifecycle and analysis computation need separate ownership, and AudioEngine must not become the DSP owner.

## Implementation References

- `src/analyzer/`
- `src/analyzer/analyzeAudio.ts`
- `src/analyzer/FeatureExtractor.ts`
- `src/analyzer/GridAligner.ts`
- `src/analyzer/SectionAnalyzer.ts`
- `src/analyzer/DramaturgyBuilder.ts`
- `src/analyzer/normalizeAnalysisResult.ts`
- `src/audio/analyzer.worker.ts`
- `src/audio/AudioEngine.ts`
- `tests/analyzer-parity.test.mjs`
- `tests/contracts.test.mjs`
- `tests/dramaturgy.test.mjs`

