# Metrics And Modulation Governance

This document extends `AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

## Purpose

Prevent semantic drift between:

- offline worker analysis
- `AudioFrame`
- `TrackAnalysis`
- dashboard metrics
- `State.modulation`
- visual renderer behavior

A metric must have one canonical meaning.

A metric may have multiple consumers.

A metric must not have multiple meanings.

## Metric Layers

### Layer 1 - Raw Analysis

Owner: `src/audio/analyzer.worker.ts`

Examples:

- RMS
- spectral flux
- spectral centroid
- spectral flatness
- relative band magnitudes

These values are DSP implementation details. They may feed projections, but they should not be treated as user-facing musical truth.

### Layer 2 - Musical Features

Owner: `TrackAnalysis` / worker output contract

Examples:

- density
- melody
- vocal
- fx
- brightness
- tension
- buildup confidence
- BPM, grid, and downbeat confidence
- tempo candidates
- sections
- cues
- recurring patterns

These values are the canonical musical interpretation layer.

Dashboard metrics should primarily use this layer when the displayed label describes a musical concept.

Tempo confidence fields are analyzer evidence, not user-facing certainty labels. They may be shown in a gated analyzer debug overlay, used by sectioning, or used to scale automation confidence, but they should not become default metric cards without a product-level UX decision.

### Layer 3 - Render Projections

Owner: visual runtime / `State.modulation`

Examples:

- kineticTension
- densityDrive
- spectralChaos
- rhythmicImpulse
- macroMomentum

These values are animation control signals. They are not raw DSP values and not canonical musical facts.

## Naming Rules

Dashboard labels must describe the actual metric source.

Forbidden:

- `Bass` when displaying density
- `Mid` when displaying melody presence
- `Treble` when displaying FX presence

Preferred:

- Density
- Melody Presence
- FX
- Energy
- Vocal
- Tension
- Buildup

The dashboard now uses the preferred labels above. The internal `AudioFrame.densityProj/melodyProj/fxProj` fields remain only as explicitly documented canonical projections in code, docs, and tests; `AudioFrame.fxProj` is not projected as a separate dashboard card.

## Ownership Rules

Worker owns:

- raw DSP measurements
- normalized worker output generation
- deterministic analysis results
- tempo candidates and BPM/grid/downbeat confidence

`TrackAnalysis` owns:

- musical interpretation
- section/bar/cue/pattern context
- feature-frame meaning
- nested tempo confidence metadata for accepted analysis payloads

`State.modulation` owns:

- renderer-facing control signals
- sensitivity-scaled animation intent

UI owns:

- metric presentation
- labels
- dashboard grouping
- tooltips
- gating analyzer debug metadata behind explicit feature flags

Renderer owns:

- visual behavior driven by already accepted state

No subsystem may redefine the semantic meaning of a metric owned by another subsystem.

## Projection Rules

A projection must declare:

- source field
- target field
- transform
- owner
- intended consumer

Example:

```text
AudioFrame.densityProj
source: worker spectral/context features
meaning: smoothed density projection
consumer: dashboard Density metric, renderer compatibility
status: canonical render-facing density projection, not bass
```

## Duplication Rules

A musical concept may have one canonical definition and multiple projections.

Allowed:

- canonical: `TrackAnalysis.features[i].melody`
- projection: `AudioFrame.melodyProj` as canonical render-facing melody presence
- dashboard: Melody Presence, sourced from `AudioFrame.melodyProj`

Forbidden:

- `AudioFrame.melodyProj`
- `VisualFeatureFrame.melody`
- duplicate dashboard `Melody`
- renderer-local melody score

all carrying different meanings without declared ownership.

## Dashboard Rules

Every dashboard metric must have:

1. visible label
2. source field
3. source owner
4. semantic meaning
5. update cadence
6. intended user meaning
7. fallback behavior

If any of these are missing, the metric is provisional.

## Beat Impulse And BeatEvent Semantics

Beat Impulse documentation must describe `State.beatDecay` as a decaying visual pulse from consumed accepted percussive `BeatEvent` entries. It must not describe Beat Impulse as BPM, raw bass, raw beat strength, or instrument/stem detection.

`BeatEvent` documentation must preserve the public visual schema (`time`, `intensity`, `type: 1 | 2 | 3`) while making clear that accepted events are percussive/transient visual events from offline analyzer evidence. Bass may contribute only when paired with sharp attack/percussive onset evidence; sustained or rolling bass alone must not be documented as a beat trigger. Future BeatEvent schema or classifier changes must preserve visual semantics and must not claim source separation or instrument certainty without a separate product and architecture decision.

## Modulation Bus Rules

`State.modulation` is not a dashboard source of truth.

It may be displayed only in debug views.

Production metrics should not show modulation-bus values unless the label clearly says that the value is visual modulation, not musical analysis.

## Dashboard Visualization Rules

Dashboard metrics that visualize spectral data must follow these rules:

- Source data must come from a precomputed `AudioFrame` field or `TrackAnalysis` field.
- `DashboardUI` must not create `AnalyserNode`, call `getByteFrequencyData()`, or perform any realtime FFT work.
- New spectral visualization fields added to `AudioFrame` must be part of the offline worker/analyzer output and documented in the worker contract.
- `AudioFrame` schema extensions require updating `src/types/index.ts`, `tests/fixtures/analyzer/analysis-result.schema.json`, `normalizeAnalysisResult`, and the empty-frame fallbacks in `src/state/store.ts` and `AudioEngine.clearAnalysisState()`.

`AudioFrame.perceptualSpectrum` is the reference implementation of these rules: it is computed once in `analyzeAudio.buildPerceptualSpectrum()` and consumed only by `DashboardUI.drawPerceptualSpectrum()`. It is a dashboard-only visualization and is not used as a modulation source.

## Current Risk Areas

The following remain compatibility or audit areas:

1. historical references to dashboard `Bass/Mid/Treble` labels in older docs or acceptance notes
2. overlap between `AudioFrame.melodyProj/fxProj` and `VisualFeatureFrame.melody/fx`; Melody Presence is the dashboard-facing melody metric, while `VisualFeatureFrame.melody` remains internal/canonical
3. use of `bass/mid/treble` inside `BarAnalysis`, where the names still mean raw spectral-band ratios for timeline/debug context
4. mapping from musical features into `State.modulation`
5. future consumers of `State.videoDominantColor`, which is currently a sampled video-context signal and not a musical metric

## Refactor Rule

Before changing metrics behavior, create or update a metrics audit table covering:

- source
- owner
- formula
- semantic meaning
- dashboard label
- renderer usage
- stability status
- proposed action
