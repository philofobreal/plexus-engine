# Low Frequency Drive Semantic Audit

This audit traces the migrated `State.modulation.densityDrive` signal and related modulation/tuning signals across runtime code, presets, UI wiring, documentation, and tests. Runtime behavior and formulas remain unchanged from the former low-frequency-named signal.

Reviewed first:

- `documents/audits/low-frequency-drive-migration-plan.md`
- `documents/governance/metrics-and-modulation-governance.md`
- `documents/metrics/metrics-source-audit.md`
- `documents/implementation/current-typescript-implementation.md`

## Current Formula

Producer:

- File: `src/config/visualTuning.ts`
- Function: `writeModulationBus(target, frame, features, beatDecay, cueDecay, tuning)`
- Fresh-object wrapper: `computeModulationBus(...)`, which delegates to `writeModulationBus(...)`
- Render-loop caller: `src/visuals/PlexusRenderer.ts`

Formula:

```ts
target.densityDrive = scaleUnit(
    frame.b * 0.62 +
    features.density * 0.24 +
    frame.e * 0.14,
    sensitivity
);
```

Where:

- `scaleUnit(value, sensitivity)` returns `clamp01(value * sensitivity)`.
- `sensitivity` is `audioSensitivity` from `VisualTuningConfig`, defaulting to `1` if invalid.
- Output range is clamped to `0.0..1.0`.

Actual inputs:

| Input | Source | Weight | Actual meaning | Low-frequency involvement |
|---|---:|---:|---|---|
| `frame.b` | `AudioFrame.b` | `0.62` | Legacy compatibility field containing the smoothed density projection. It is not bass. | No direct low-frequency content. |
| `features.density` | `VisualFeatureFrame.density` | `0.24` | Canonical visual density feature, derived from the same smoothed spectral-flux density path. | No direct low-frequency content. |
| `frame.e` | `AudioFrame.e` | `0.14` | Normalized RMS energy. | Broadband energy, not low-frequency-specific. |
| `audioSensitivity` | `VisualTuningConfig.audioSensitivity` | multiplier | User tuning scalar. | None. |

Conclusion: density is the dominant source. `frame.b` and `features.density` account for `0.86` of the weighted formula, and `frame.b` is explicitly documented as density projection, not bass. Low frequencies are not genuinely involved in the published modulation formula except indirectly through any effect that low-band-heavy music may have on broadband energy or spectral flux.

## Runtime Meaning

`densityDrive` is a renderer-facing animation control signal. It is not a raw DSP metric, not a true low-frequency band, and not a dashboard source of truth.

Runtime meaning:

- A density/energy-driven fullness signal.
- A control for visual expansion, particle turning/movement, glow size/opacity, network reach, temporal network density, node size, polygon density, and the first temporal mechanism ring size.
- A compact animation drive that answers "how active/full should the visual field feel?" more than "how much bass is present?"

Related modulation signals:

| Signal | Formula source | Runtime meaning | Relationship to `densityDrive` |
|---|---|---|---|
| `kineticTension` | `features.vocal * 0.28 + features.melody * 0.22 + features.tension * 0.32 + cueDecay * 0.18`, then dramaturgy boost | Vocal/melody/tension/cue pressure for motion, glow, line weight, and temporal rings. | Orthogonal pressure signal; blended with `densityDrive` in Temporal particle movement/background. |
| `densityDrive` | `frame.b * 0.62 + features.density * 0.24 + frame.e * 0.14` | Density/energy-driven visual fullness and motion drive. | Misnamed; density is dominant. |
| `spectralChaos` | `frame.t * 0.42 + features.fx * 0.36 + features.brightness * 0.22` | FX/brightness/high-transient control signal. | Blended with `densityDrive` and `kineticTension` for Temporal particle movement. |
| `rhythmicImpulse` | `max(beatDecay, cueDecay * 0.65)` | Beat/cue impulse decay. | Often layered with `densityDrive` for line alpha, nodes, rings, and particle impulse. |
| `macroMomentum` | `frame.eRatio * 0.58 + frame.e * 0.24 + features.density * 0.18`, then buildup minimum | Block-relative energy and long-form momentum. | Used as particle speed/section fallback; related by energy/density inputs but not a duplicate. |

## Consumer Inventory

| Usage | File/function | Runtime purpose | Actual inputs at usage | Low frequencies genuinely involved? | Density/energy dominant? |
|---|---|---|---|---|---|
| Type contract | `src/types/index.ts`, `ModulationState.densityDrive` | Declares stable modulation-bus field. | None at runtime; structural type. | No. | Yes by producer formula. |
| Initial state | `src/state/store.ts`, `emptyModulation.densityDrive = 0` | Initializes modulation bus. | Zero default. | No. | Not applicable until produced. |
| Full analysis reset | `src/audio/AudioEngine.ts`, `clearAnalysisState()` | Replaces `State.modulation` with zeroed object on load/reset. | Zero default. | No. | Not applicable until produced. |
| Render transient reset | `src/visuals/PlexusRenderer.ts`, `resetTransientVisualState()` | Zeros the existing modulation field in place on seek/end/reset. | Zero default. | No. | Not applicable until produced. |
| Render-loop publication | `src/visuals/PlexusRenderer.ts`, `p.draw()` | Writes the current modulation bus from render-copy frame/features and tuning before effects draw. | `State.currentFrame`, `State.currentFeatures`, `State.beatDecay`, `State.cueDecay`, `State.visualTuning`. | No direct low-frequency source. | Yes. |
| Classic particle update input | `src/visuals/ClassicPlexusEffect.ts`, `pt.update(macroMomentum, densityDrive, rhythmicImpulse, isPlaying)` | Supplies the second `Particle.update()` argument named `bass`, which gates random turn. | Produced `densityDrive`. | No. The local parameter name is stale. | Yes. |
| Classic center glow radius | `src/visuals/ClassicPlexusEffect.ts`, `drawCenterDynamics()` | Expands radial glow radius: `0.3 + densityDrive * 0.3`. | Produced `densityDrive`; `circleSize` tuning. | No. | Yes. |
| Classic center glow alpha | `src/visuals/ClassicPlexusEffect.ts`, `drawCenterDynamics()` | Increases glow opacity: `0.3 + densityDrive * 0.4`. | Produced `densityDrive`; `circleBackgroundAlpha` tuning. | No. | Yes. |
| Classic network reach | `src/visuals/ClassicPlexusEffect.ts`, `drawPolygonalNetwork()` | Expands max connection distance while playing: `130 + densityDrive * 50`. | Produced `densityDrive`; `lineDistance` tuning. | No. | Yes. |
| Temporal background glow radius | `src/visuals/TemporalMusicEffect.ts`, `drawTemporalBackground()` | Expands glow radius with `densityDrive * 0.16` plus kinetic tension. | Produced `densityDrive`, `kineticTension`, `circleSize`. | No. | Partly. Density/energy is one of two main inputs. |
| Temporal background glow alpha | `src/visuals/TemporalMusicEffect.ts`, `drawTemporalBackground()` | Increases glow opacity with `densityDrive * 0.22` plus pattern resonance. | Produced `densityDrive`, pattern resonance, `circleBackgroundAlpha`. | No. | Partly. |
| Temporal particle movement | `src/visuals/TemporalMusicEffect.ts`, `updateTemporalParticles()` | Builds `movement = densityDrive * 0.35 + kineticTension * 0.32 + spectralChaos * 0.24`, passed to particle turn gate. | `densityDrive`, `kineticTension`, `spectralChaos`. | No direct low-frequency source. | Density/energy is the largest single component but not sole dominant source. |
| Temporal network density alias | `src/visuals/TemporalMusicEffect.ts`, `let density = State.modulation.densityDrive` | Treats the signal as network density/fullness. | Produced `densityDrive`. | No. | Yes. |
| Temporal network reach | `src/visuals/TemporalMusicEffect.ts`, `drawTemporalPolygonNetwork()` | Expands max connection distance; formula effectively uses densityDrive twice because `density` aliases it. | Produced `densityDrive`, pattern resonance, `temporalNetworkDistance`. | No. | Yes. |
| Temporal line limit | `src/visuals/TemporalMusicEffect.ts`, `lineLimit = 4 + floor(density * 3 + resonance * 2)` | Allows more links in dense/full sections. | `density` alias of `densityDrive`, pattern resonance. | No. | Yes. |
| Temporal polygon limit | `src/visuals/TemporalMusicEffect.ts`, `polyLimit = 1 + floor(max(density, denseImpactFlash) * 2)` | Allows more polygons from fullness/dense impact flash. | `density` alias, `denseImpactFlash`. | No. | Partly; dense impact can dominate. |
| Temporal line alpha | `src/visuals/TemporalMusicEffect.ts`, line alpha formula | Raises line alpha as density/fullness rises. | `density` alias, pattern resonance, rhythmic impulse. | No. | Partly. |
| Temporal polygon alpha | `src/visuals/TemporalMusicEffect.ts`, polygon alpha formula | Raises polygon fill alpha with density/fullness and pattern resonance. | `density` alias, resonance, dense impact flash, tuning. | No. | Partly. |
| Temporal node alpha/size | `src/visuals/TemporalMusicEffect.ts`, connected node draw | Increases node opacity and radius with density/fullness. | `density` alias and rhythmic impulse. | No. | Yes for size; partly for alpha. |
| Temporal mechanism ring radius | `src/visuals/TemporalMusicEffect.ts`, first `drawMechanismRing()` | Expands base mechanism ring radius: `24 + densityDrive * 46 + rhythmicImpulse * 32`. | Produced `densityDrive`, rhythmic impulse, `temporalRingSize`. | No. | Partly. |
| Particle turn control | `src/visuals/Particle.ts`, `particleActivityTurn` | Scales random heading variation when the second update argument is above `0.4`. | Classic: `densityDrive`; Temporal: movement blend. | No. | Classic yes; Temporal partly. |
| UI tuning generation | `src/ui/DashboardUI.ts`, `initVisualTuningControls()` | Renders slider labels and values from `visualTuningControls`. | `particleActivityTurn` label currently `Activity Turn`. | No. Label implies yes incorrectly. | The control affects density/movement-driven turn. |
| UI tuning input | `src/ui/DashboardUI.ts`, tuning input listener | Writes slider value into `State.targetTuning[key]`. | Numeric tuning value. | No. | Not a source metric. |
| Preset loading | `src/ui/DashboardUI.ts`, `loadVisualPreset()` | Normalizes preset JSON and assigns to `State.targetTuning`. | Preset `visualTuning` payload. | No. | Preserves existing `particleActivityTurn` values. |
| Preset export | `src/ui/DashboardUI.ts`, `copyVisualConfig()` | Exports `State.targetTuning`, including `particleActivityTurn`. | Current target tuning object. | No. | Compatibility concern. |

## Preset Dependencies

Preset system:

- Files live in `public/visual-tuning-presets/`.
- `index.json` lists preset files.
- `DashboardUI.loadVisualPresetList()` loads `index.json`.
- `DashboardUI.loadVisualPreset(fileName)` fetches a preset and applies `Object.assign(State.targetTuning, normalizeVisualTuningConfig(payload))`.
- `normalizeVisualTuningConfig()` accepts either raw tuning objects or `{ visualTuning: ... }`.
- Unknown keys are ignored.
- Missing keys fall back to `defaultVisualTuning`.

`particleActivityTurn` dependencies:

| Preset | Contains `particleActivityTurn` | Value | Compatibility note |
|---|---:|---:|---|
| `default.json` | Yes | `0.1` | Baseline persisted key. |
| `temporal1.json` | Yes | `0.1` | Temporal preset persisted key. |
| `temporal2.json` | Yes | `0.1` | Temporal preset persisted key. |
| `temporal3.json` | Yes | `0.1` | Temporal preset persisted key. |
| `temporal4.json` | Yes | `0.1` | Temporal preset persisted key. |
| `temporal5.json` | Yes | `0.1` | Temporal preset persisted key. |
| `index.json` | No | N/A | Manifest only. |

`densityDrive` itself does not appear in preset JSON. The preset dependency is indirect through `particleActivityTurn`, `particleEnergySpeed`, `particleBeatSpeed`, `lineDistance`, `circleSize`, `circleBackgroundAlpha`, `temporalNetworkDistance`, and `temporalRingSize`, all of which scale visual responses that consume `densityDrive`.

Backward compatibility issue:

- Renaming `particleActivityTurn` without compatibility mapping would silently drop old preset/export values because `normalizeVisualTuningConfig()` only copies keys present in `defaultVisualTuning`.
- Renaming `densityDrive` is not a preset data migration, but it is a TypeScript/source API migration for `ModulationState` and all render consumers.

## Naming Accuracy Assessment

`densityDrive` is semantically accurate for the current formula.

Reasons:

1. The dominant input is density.
2. `AudioFrame.b` no longer means bass. It is a legacy compatibility field containing a density projection.
3. `features.density` is the second-largest input and is canonical density.
4. `frame.e` is broadband normalized energy, not low-frequency energy.
5. True low-frequency spectral-band data exists only as `BarAnalysis.bass` for timeline/tooltip contexts and is not consumed by `writeModulationBus()`.

Accuracy by phrase:

| Name fragment | Accuracy | Notes |
|---|---|---|
| `lowFrequency` | Poor legacy wording | No true low-band ratio is used in the formula. |
| `Drive` | Good | The field drives render behavior rather than representing a displayed metric. |
| `Bass` legacy wording | Poor | The particle turn gate is density/movement-driven, not bass-driven. |
| `density` alias in Temporal effect | Good | Temporal code already treats `densityDrive` as network density. |

Related modulation signal naming:

- `kineticTension`: mostly accurate as a composite pressure/movement signal; not a raw tension metric.
- `spectralChaos`: mostly accurate for FX/high-transient/brightness animation control.
- `rhythmicImpulse`: accurate for beat/cue decay impulses.
- `macroMomentum`: mostly accurate for block energy and long-form momentum.
- `densityDrive`: resolved; the current name matches the dominant density source.

## Migration Risk Assessment

Runtime risk:

- High touch count in visual render paths, but formulas can remain identical.
- Classic and Temporal effects both consume the field directly.
- `Particle.update()` now uses an `activity` parameter name, and `particleActivityTurn` has the visible label `Activity Turn`.
- Tests assert the current field name, reset behavior, and legacy preset-key compatibility.

API/schema risk:

- `ModulationState.densityDrive` is a TypeScript contract field.
- `particleActivityTurn` is a persisted tuning key and exported preset field.
- Worker schemas are not affected because `densityDrive` is not worker output.
- Existing copied configs may still contain legacy `particleBassTurn`; normalization maps that value to `particleActivityTurn`.

Documentation risk:

- Active docs now use `densityDrive` and `particleActivityTurn`.
- Product docs mention `densityDrive` as a modulation bus field.
- A future partial rename would create drift unless all docs, tests, presets, and UI control labels change together.

Implemented migration shape:

1. Keep formulas unchanged.
2. Rename legacy `ModulationState.lowFrequencyDrive` and all render consumers to `densityDrive`.
3. Rename legacy `particleBassTurn` to `particleActivityTurn` with compatibility mapping from old preset/export payloads.
4. Update UI label to `Activity Turn`.
5. Update tests to assert formulas/behavior are unchanged and old preset key compatibility is preserved.
6. Update docs in the same migration.

## Candidate Names

### Ranking

1. `densityDrive`
2. `energyDensityDrive`
3. `activityDrive`
4. `motionDrive`
5. `compositeDrive`

### 1. `densityDrive`

Best fit.

Justification:

- Matches the dominant formula sources: `frame.b` density projection plus `features.density`.
- Aligns with existing dashboard terminology: Density.
- Aligns with Temporal effect local semantics, where the signal is already assigned to `density`.
- Keeps the useful `Drive` suffix for renderer-facing animation intent.
- Short enough for code and docs.

Weakness:

- It under-emphasizes the 14% energy component, but density is clearly dominant.

### 2. `energyDensityDrive`

Accurate but heavier.

Justification:

- Explicitly names both meaningful source categories.
- Avoids implying a pure density signal.
- Good for documentation precision.

Weakness:

- Longer and less ergonomic.
- The source order is actually density first and energy second; `densityEnergyDrive` would be more formula-faithful, but the requested candidate is `energyDensityDrive`.

### 3. `activityDrive`

Acceptable broad semantic name.

Justification:

- Describes visual activity/fullness rather than source DSP category.
- Works across Classic and Temporal consumers, including glow, particles, network reach, and rings.
- Avoids overcommitting to density in Temporal particle movement where the value is blended with tension and chaos before particle turn.

Weakness:

- Less traceable to the actual formula.
- "Activity" could overlap with `rhythmicImpulse`, `macroMomentum`, or general visual motion.

### 4. `motionDrive`

Too narrow.

Justification:

- Fits particle movement and some expansion behavior.
- Less precise than `densityDrive` because it describes visual behavior but not the dominant formula input.

Weakness:

- The signal also drives glow radius/opacity, network density, node size, polygon density, and ring radius, not only motion.
- Could be confused with particle speed controls.

### 5. `compositeDrive`

Technically true but semantically weak.

Justification:

- The signal is a composite of multiple inputs.
- Avoids inaccurate bass/low-frequency claims.

Weakness:

- Says almost nothing about actual runtime meaning.
- All modulation bus fields are composites, so the name does not distinguish this one.
- Poor for UI/docs because users and maintainers still need to learn what it drives.

## Final Assessment

`densityDrive` is the canonical internal name for a density/energy-driven animation signal. Low frequencies are not genuinely involved in the current formula. Density is the dominant source, energy is a secondary contributor, and the signal's consumers use it as visual fullness/activity rather than bass.

Best replacement name: `densityDrive`.

Migration posture: implemented. The coordinated migration addressed `densityDrive`, `particleActivityTurn`, preset normalization, UI control labels, tests, and documentation while keeping formulas unchanged.
