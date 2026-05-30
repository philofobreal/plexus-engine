# Metrics Audit Matrix

This document audits the current Plexus Engine metric chain:

```text
analyzer.worker.ts
→ AudioFrame / TrackAnalysis
→ State
→ DashboardUI
→ State.modulation
→ visual renderers
```

## Summary

The current system is architecturally sound but semantically overloaded.

The main issue is not that the worker necessarily computes bad values. The problem is that several fields are displayed or consumed under names that no longer match their actual meaning.

The highest-risk area is:

```text
AudioFrame.b / AudioFrame.m / AudioFrame.t
```

These are render-facing projections, but the dashboard may still present them through legacy Bass/Mid/Treble language.

## Audit Matrix

| Field | Layer | Owner | Current meaning | Current consumer | Risk | Proposed action |
|---|---|---|---|---|---|---|
| `AudioFrame.e` | AudioFrame | worker | normalized RMS energy | dashboard, renderer, modulation | Low | Keep as `Energy` |
| `AudioFrame.b` | AudioFrame | worker | smoothed density projection | dashboard legacy Bass, renderer | High | Rename UI label to `Density`; keep field as compatibility only |
| `AudioFrame.m` | AudioFrame | worker | smoothed melody-presence projection | dashboard legacy Mid, renderer | High | Rename UI label to `Melody Presence`; document as projection |
| `AudioFrame.t` | AudioFrame | worker | smoothed FX-presence projection | dashboard legacy Treble, renderer | High | Rename UI label to `FX Presence`; document as projection |
| `AudioFrame.state` | AudioFrame | worker | macro dynamic state: IDLE/HIGH/LOW/LOW_DROP/LOW_OVERLOAD | dashboard, renderer | Medium | Keep; improve tooltip and block-state docs |
| `AudioFrame.eRatio` | AudioFrame | worker | block-level relative energy ratio | dashboard dynamics, dramaturgy | Medium | Keep; expose as `Block Energy Ratio` only in debug/advanced UI |
| `BeatEvent.time` | Event | worker | accepted beat/impact timestamp | renderer event index | Low | Keep |
| `BeatEvent.intensity` | Event | worker | peak strength / event intensity | shockwaves, modulation | Medium | Keep; document normalization range |
| `BeatEvent.type` | Event | worker | classified hit type from fx/density context | shockwaves | Medium | Keep; avoid naming as actual kick/snare/hat unless confidence improves |
| `VisualFeatureFrame.melody` | TrackAnalysis | worker | canonical melody feature | temporal renderer, dashboard | Medium | Make canonical melody metric |
| `VisualFeatureFrame.vocal` | TrackAnalysis | worker | vocal/formant-like feature | temporal renderer, dashboard | Medium | Keep; document as heuristic, not stem separation |
| `VisualFeatureFrame.fx` | TrackAnalysis | worker | FX/noise/transient feature | temporal renderer, dashboard | Medium | Make canonical FX metric |
| `VisualFeatureFrame.density` | TrackAnalysis | worker | canonical musical density feature | temporal renderer, timeline | Medium | Make canonical density metric |
| `VisualFeatureFrame.brightness` | TrackAnalysis | worker | high-frequency/brightness pressure | modulation, temporal renderer | Medium | Keep; dashboard optional |
| `VisualFeatureFrame.tension` | TrackAnalysis | worker | musical pressure/tension estimate | buildup, modulation | Medium | Keep; dashboard optional |
| `TrackAnalysis.bars[].energy` | TrackAnalysis | worker | bar-level energy | timeline | Low | Keep |
| `TrackAnalysis.bars[].density` | TrackAnalysis | worker | bar-level density | timeline | Low | Keep |
| `TrackAnalysis.bars[].bass` | TrackAnalysis | worker | bar-level low-band ratio | timeline tooltip | Medium | Keep only if explicitly documented as spectral band ratio |
| `TrackAnalysis.bars[].mid` | TrackAnalysis | worker | bar-level mid-band ratio | timeline tooltip | Medium | Keep only if explicitly documented as spectral band ratio |
| `TrackAnalysis.bars[].treble` | TrackAnalysis | worker | bar-level high-band ratio | timeline tooltip | Medium | Keep only if explicitly documented as spectral band ratio |
| `TrackAnalysis.buildupConfidence[]` | TrackAnalysis | worker | rising pressure confidence | timeline, modulation | Low | Keep |
| `TrackAnalysis.tensionTrends` | TrackAnalysis | worker | long-form rising/falling/stable tension segments | timeline | Low | Keep |
| `State.modulation.kineticTension` | Modulation | visuals | visual tension control signal | renderer | Medium | Keep; do not show as musical metric |
| `State.modulation.lowFrequencyDrive` | Modulation | visuals | density/energy/low-drive animation signal | renderer | Medium | Keep; avoid user-facing name unless debug |
| `State.modulation.spectralChaos` | Modulation | visuals | brightness/fx/chaos animation signal | renderer | Medium | Keep; debug only |
| `State.modulation.rhythmicImpulse` | Modulation | visuals | beat/cue impulse decay | renderer | Low | Keep |
| `State.modulation.macroMomentum` | Modulation | visuals | long-form/block momentum | renderer | Medium | Keep; debug only |
| Dashboard `Bass` | UI | DashboardUI | currently displays `AudioFrame.b` | user-facing metrics | Critical | Rename to `Density` |
| Dashboard `Mid` | UI | DashboardUI | currently displays `AudioFrame.m` | user-facing metrics | Critical | Rename to `Melody Presence` |
| Dashboard `Treble` | UI | DashboardUI | currently displays `AudioFrame.t` | user-facing metrics | Critical | Rename to `FX Presence` |
| Dashboard `Melody` | UI | DashboardUI | likely feature-frame melody | user-facing metrics | Medium | Ensure source is `VisualFeatureFrame.melody` |
| Dashboard `Vocal` | UI | DashboardUI | feature-frame vocal | user-facing metrics | Medium | Keep but mark as heuristic |
| Dashboard `FX` | UI | DashboardUI | feature-frame fx | user-facing metrics | Medium | Keep; distinguish from `AudioFrame.t` projection |
| Dashboard `Beat Hit` | UI/render transient | visuals/UI | transient beat decay, not worker scalar | user-facing metrics | Medium | Rename to `Beat Impulse` or add tooltip |
| Dashboard `Progress` | UI/playback | AudioEngine/UI | currentTime / duration | user-facing metrics | Low | Keep |
| Dashboard `Music Block & Dynamics` | UI | worker/UI | state + eRatio | user-facing metrics | Medium | Rename to `Dynamics State` or add tooltip |

## Immediate Findings

### 1. Bass/Mid/Treble labels are misleading

They are the most urgent fix.

They look like spectral bands, but in the current accepted contract they display density, melody-presence, and fx-presence projections.

### 2. Beat types are overnamed

Type 1/2/3 are currently classification outputs from smoothed fx/density context. They should not be confidently described as kick/snare/hi-hat unless the detector becomes instrument-specific.

Preferred labels:

- Type 1: impact
- Type 2: dense impact
- Type 3: fx/transient impact

### 3. `AudioFrame` and `VisualFeatureFrame` overlap

`AudioFrame.m/t` and `VisualFeatureFrame.melody/fx` are related but not identical in contract terms.

Refactor direction:

- keep `AudioFrame` as a compact legacy/render compatibility frame
- make `TrackAnalysis.features[]` the canonical musical-feature layer

### 4. `State.modulation` must stay renderer-facing

The modulation bus should remain an animation abstraction, not a metrics source.

## Recommended UI Renames

| Current label | New label | Reason |
|---|---|---|
| Bass | Density | matches `AudioFrame.b` meaning |
| Mid | Melody Presence | matches `AudioFrame.m` meaning |
| Treble | FX Presence | matches `AudioFrame.t` meaning |
| Beat Hit | Beat Impulse | clarifies transient/decay nature |
| Music Block & Dynamics | Dynamics State | shorter and clearer |

## Recommended Code Refactor Order

1. Update Dashboard labels only.
2. Add metric tooltips/source metadata.
3. Add contract tests for label-to-source mapping.
4. Mark `AudioFrame.b/m/t` as legacy projections in docs/comments.
5. Prefer `TrackAnalysis.features[]` for canonical musical dashboard metrics.
6. Only after UI/docs are stable, consider renaming internal fields.

## Test Requirements

Add tests for:

- dashboard label mapping
- `AudioFrame.b/m/t` semantic documentation
- `audioSensitivity` not mutating analyzer output
- modulation values clamped to `0.0..1.0`
- beat type labels not claiming instrument certainty

## Decision

Do not change analyzer math first.

First fix semantics, ownership, labels, and tests.

After that, evaluate whether the actual metric calculations are inaccurate.
