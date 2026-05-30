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

### Layer 1 — Raw Analysis

Owner: `src/audio/analyzer.worker.ts`

Examples:

- RMS
- spectral flux
- spectral centroid
- spectral flatness
- relative band magnitudes

These values are DSP implementation details. They may feed projections, but they should not be treated as user-facing musical truth.

### Layer 2 — Musical Features

Owner: `TrackAnalysis` / worker output contract

Examples:

- density
- melody
- vocal
- fx
- brightness
- tension
- buildup confidence
- sections
- cues
- recurring patterns

These values are the canonical musical interpretation layer.

Dashboard metrics should primarily use this layer when the displayed label describes a musical concept.

### Layer 3 — Render Projections

Owner: visual runtime / `State.modulation`

Examples:

- kineticTension
- lowFrequencyDrive
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
- FX Presence
- Energy
- Vocal
- Tension
- Buildup

The dashboard now uses the preferred labels above. The internal `AudioFrame.b/m/t` fields remain only as explicitly documented legacy compatibility projections in code, docs, and tests.

## Ownership Rules

Worker owns:

- raw DSP measurements
- normalized worker output generation
- deterministic analysis results

`TrackAnalysis` owns:

- musical interpretation
- section/bar/cue/pattern context
- feature-frame meaning

`State.modulation` owns:

- renderer-facing control signals
- sensitivity-scaled animation intent

UI owns:

- metric presentation
- labels
- dashboard grouping
- tooltips

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
AudioFrame.b
source: worker spectral/context features
meaning: smoothed density projection
consumer: dashboard Density metric, renderer compatibility
status: legacy projection, not canonical bass
```

## Duplication Rules

A musical concept may have one canonical definition and multiple projections.

Allowed:

- canonical: `TrackAnalysis.features[i].melody`
- projection: `AudioFrame.m` as legacy render-facing melody presence

Forbidden:

- `AudioFrame.m`
- `VisualFeatureFrame.melody`
- `DashboardMelody`
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

## Modulation Bus Rules

`State.modulation` is not a dashboard source of truth.

It may be displayed only in debug views.

Production metrics should not show modulation-bus values unless the label clearly says that the value is visual modulation, not musical analysis.

## Current Risk Areas

The following remain compatibility or audit areas:

1. `AudioFrame.b`
2. `AudioFrame.m`
3. `AudioFrame.t`
4. historical references to dashboard `Bass/Mid/Treble` labels in older docs or acceptance notes
5. duplication between `AudioFrame.m/t` and `VisualFeatureFrame.melody/fx`
6. use of `bass/mid/treble` inside `BarAnalysis`
7. mapping from musical features into `State.modulation`

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
