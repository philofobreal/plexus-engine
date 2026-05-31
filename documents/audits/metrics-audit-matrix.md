# Metrics Audit Matrix

This document audits the current Plexus Engine metric chain:

```text
analyzer.worker.ts
-> AudioFrame / TrackAnalysis
-> State
-> DashboardUI
-> State.modulation
-> visual renderers
```

## Summary

The current system is architecturally sound. Earlier semantic drift around dashboard labels and beat-event names has been corrected in the active UI and type contracts.

The remaining issue is compatibility naming: several internal fields keep short legacy names for schema stability while documentation and user-facing labels now describe their actual meaning.

The highest-risk area is:

```text
AudioFrame.b / AudioFrame.m / AudioFrame.t
```

These are render-facing legacy compatibility projections. The dashboard now labels them as Density, Melody Presence, and FX Presence.

## Audit Matrix

| Field | Layer | Owner | Current meaning | Current consumer | Risk | Proposed action |
|---|---|---|---|---|---|---|
| `AudioFrame.e` | AudioFrame | worker | normalized RMS energy | dashboard, renderer, modulation | Low | Keep as `Energy` |
| `AudioFrame.b` | AudioFrame | worker | smoothed density projection | dashboard Density, renderer | Medium | Keep field as documented legacy compatibility projection |
| `AudioFrame.m` | AudioFrame | worker | smoothed melody-presence projection | dashboard Melody Presence, renderer | Medium | Keep field as documented legacy compatibility projection |
| `AudioFrame.t` | AudioFrame | worker | smoothed FX-presence projection | dashboard FX Presence, renderer | Medium | Keep field as documented legacy compatibility projection |
| `AudioFrame.state` | AudioFrame | worker | macro dynamic state: IDLE/HIGH/LOW/LOW_DROP/LOW_OVERLOAD | dashboard, renderer | Medium | Keep; improve tooltip and block-state docs |
| `AudioFrame.eRatio` | AudioFrame | worker | block-level relative energy ratio | dashboard dynamics, dramaturgy | Medium | Keep; expose as `Block Energy Ratio` only in debug/advanced UI |
| `BeatEvent.time` | Event | worker | accepted beat/impact timestamp | renderer event index | Low | Keep |
| `BeatEvent.intensity` | Event | worker | peak strength / event intensity | shockwaves, modulation | Medium | Keep; document normalization range |
| `BeatEvent.type` | Event | worker | classified hit type from fx/density context | shockwaves | Low | Keep semantic labels: default spectral-flux hit, dense impact hit, fx/high-transient hit |
| `VisualFeatureFrame.melody` | TrackAnalysis | worker | canonical melody feature | temporal renderer, cues, modulation | Medium | Keep as internal/canonical feature signal |
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
| `State.modulation.densityDrive` | Modulation | visuals | density/energy-driven animation signal | renderer | Medium | Keep; avoid user-facing name unless debug |
| `State.modulation.spectralChaos` | Modulation | visuals | brightness/fx/chaos animation signal | renderer | Medium | Keep; debug only |
| `State.modulation.rhythmicImpulse` | Modulation | visuals | beat/cue impulse decay | renderer | Low | Keep |
| `State.modulation.macroMomentum` | Modulation | visuals | long-form/block momentum | renderer | Medium | Keep; debug only |
| Dashboard `Density` | UI | DashboardUI | displays `AudioFrame.b` | user-facing metrics | Low | Keep |
| Dashboard `Melody Presence` | UI | DashboardUI | displays `AudioFrame.m` | user-facing metrics | Low | Keep |
| Dashboard `FX Presence` | UI | DashboardUI | displays `AudioFrame.t` | user-facing metrics | Low | Keep |
| Dashboard `Vocal` | UI | DashboardUI | feature-frame vocal | user-facing metrics | Medium | Keep but mark as heuristic |
| Dashboard `FX` | UI | DashboardUI | feature-frame fx | user-facing metrics | Medium | Keep; distinguish from `AudioFrame.t` projection |
| Dashboard `Beat Impulse` | UI/render transient | visuals/UI | transient beat decay, not worker scalar | user-facing metrics | Low | Keep |
| Dashboard `Progress` | UI/playback | AudioEngine/UI | currentTime / duration | user-facing metrics | Low | Keep |
| Dashboard `Dynamics State` | UI | worker/UI | state + eRatio | user-facing metrics | Low | Keep |

## Immediate Findings

### 1. Dashboard projection labels are fixed

The dashboard now uses Density, Melody Presence, and FX Presence for `AudioFrame.b/m/t`.

### 2. Beat type labels are resolved

Type 1/2/3 are classification outputs from smoothed fx/density context. They are documented as default spectral-flux hit, dense impact hit, and fx/high-transient hit.

Preferred labels:

- Type 1: impact
- Type 2: dense impact
- Type 3: fx/transient impact

### 3. `AudioFrame` and `VisualFeatureFrame` overlap

`AudioFrame.m/t` and `VisualFeatureFrame.melody/fx` are related but not identical in contract terms. Melody Presence is the dashboard-facing melody metric; `VisualFeatureFrame.melody` remains internal/canonical for track analysis, cues, modulation, and temporal rendering.

Refactor direction:

- keep `AudioFrame` as a compact legacy/render compatibility frame
- make `TrackAnalysis.features[]` the canonical musical-feature layer

### 4. `State.modulation` must stay renderer-facing

The modulation bus should remain an animation abstraction, not a metrics source.

## Current UI Labels

The active dashboard labels, in source order, are BPM, Dynamics State, Energy, Density, Melody Presence, FX Presence, Vocal, FX, Beat Impulse, and Progress. The previous duplicate Melody card has been removed.

## Remaining Refactor Order

1. Add metric tooltips/source metadata if richer UI explanation is needed.
2. Prefer `TrackAnalysis.features[]` for canonical musical dashboard metrics where practical.
3. Only after UI/docs are stable, consider renaming internal fields.

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
