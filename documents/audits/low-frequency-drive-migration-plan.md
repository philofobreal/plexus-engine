# Low Frequency Drive Migration Plan

## Scope

This plan originally audited the legacy `State.modulation.lowFrequencyDrive` and `VisualTuningConfig.particleBassTurn` names. The migration has since been implemented: canonical runtime names are now `State.modulation.densityDrive` and `VisualTuningConfig.particleActivityTurn`, with the visible tuning label `Activity Turn`.

## Current Trace

### Producer

`densityDrive` is produced in `src/config/visualTuning.ts` by `writeModulationBus()`. `computeModulationBus()` creates a fresh modulation object and delegates to the same writer, while the render loop calls `writeModulationBus(State.modulation, ...)` in place from `src/visuals/PlexusRenderer.ts`.

Current formula:

```ts
target.densityDrive = scaleUnit(
    frame.b * 0.62 +
    features.density * 0.24 +
    frame.e * 0.14,
    sensitivity
);
```

Inputs:

- `frame.b`: legacy `AudioFrame` field containing the smoothed density projection, not bass.
- `features.density`: canonical visual feature density signal from `TrackAnalysis.features[]`.
- `frame.e`: normalized RMS energy.
- `sensitivity`: `audioSensitivity`, applied through `scaleUnit()` and clamped to `0.0..1.0`.

### Runtime Consumers

| File | Consumer | Current usage |
|---|---|---|
| `src/visuals/ClassicPlexusEffect.ts` | `Particle.update(..., State.modulation.densityDrive, ...)` | Supplies the particle turn input currently named `bass` inside `Particle.update()`. |
| `src/visuals/ClassicPlexusEffect.ts` | `drawCenterDynamics()` | Expands radial glow radius and opacity. |
| `src/visuals/ClassicPlexusEffect.ts` | `drawPolygonalNetwork()` | Expands max line distance while playing. |
| `src/visuals/TemporalMusicEffect.ts` | `drawTemporalBackground()` | Expands temporal glow radius and opacity. |
| `src/visuals/TemporalMusicEffect.ts` | `updateTemporalParticles()` | Contributes to particle movement/turning blend. |
| `src/visuals/TemporalMusicEffect.ts` | `drawTemporalPolygonNetwork()` | Aliased locally as `density`; expands link distance, line/polygon limits, line alpha, polygon alpha, and node size. |
| `src/visuals/TemporalMusicEffect.ts` | `drawCenterMechanisms()` | Expands the first temporal mechanism ring radius. |
| `src/visuals/PlexusRenderer.ts` | `resetTransientVisualState()` | Resets the bus field to `0` in place on seek/stop/load transitions. |
| `src/audio/AudioEngine.ts` | reset path | Replaces `State.modulation` with an object containing `densityDrive: 0` during full audio reset. |
| `src/state/store.ts` | initial state | Initializes `emptyModulation.densityDrive` to `0`. |

### Type And Test References

| File | Reference |
|---|---|
| `src/types/index.ts` | `ModulationState.densityDrive: number` contract field. |
| `tests/modulation.test.mjs` | Expects normalized modulation bus output and reset behavior including `densityDrive`. |
| `tests/performance-optimizations.test.mjs` | Asserts `State.modulation.densityDrive = 0` in renderer reset. |
| `tests/contracts.test.mjs` | Indirectly covers modulation bus naming and docs. |

### Presets

`particleActivityTurn` appears in all shipped tuning preset payloads except the preset index:

| Preset | Current value |
|---|---|
| `public/visual-tuning-presets/default.json` | `0.1` |
| `public/visual-tuning-presets/temporal1.json` | `0.1` |
| `public/visual-tuning-presets/temporal2.json` | `0.1` |
| `public/visual-tuning-presets/temporal3.json` | `0.1` |
| `public/visual-tuning-presets/temporal4.json` | `0.1` |
| `public/visual-tuning-presets/temporal5.json` | `0.1` |

Because `normalizeVisualTuningConfig()` copies only keys present in `defaultVisualTuning`, renaming `particleActivityTurn` without compatibility handling would cause older preset files and copied configs to silently fall back to the default value.

### Tuning Controls And UI Labels

`particleActivityTurn` is defined in `src/config/visualTuning.ts`:

- default value: `0.1`
- control group: `Particles`
- label: `Activity Turn`
- range: `0..2`
- step: `0.01`

The control is rendered dynamically by `DashboardUI` from `visualTuningControls`. There is no separate hard-coded dashboard label for this tuning key in `src/main.ts`.

### Documentation References

| File | Reference |
|---|---|
| `documents/metrics/metrics-source-audit.md` | Documents `densityDrive` as `scaleUnit(frame.b * 0.62 + features.density * 0.24 + frame.e * 0.14, sensitivity)` and flags the name as misleading. |
| `documents/audits/metrics-audit-matrix.md` | Describes `State.modulation.densityDrive` as a density/energy-driven animation signal. |
| `documents/implementation/current-typescript-implementation.md` | Defines `densityDrive` as a density/energy-driven animation signal. |
| `documents/governance/metrics-and-modulation-governance.md` | Lists `densityDrive` as a modulation bus field. |
| `documents/acceptance-criteria/usage-acs.md` | Lists `densityDrive` as part of `State.modulation`. |
| `documents/acceptance-criteria/visual-tuning-presets-and-playback-ui-acs.md` | Requires modulation bus outputs, including `densityDrive`, to clamp to `0.0..1.0`. |
| `documents/adr/ADR-001-visual-tuning-presets-and-playback-ui.md` | Names `densityDrive` as one of the normalized musical-intent modulation signals. |
| `documents/product/plexus-system-documentation.md` | Mentions `densityDrive` in older product/system docs. |

## Semantic Meaning

`densityDrive` is not a low-frequency or bass-band signal. It is a renderer-facing animation drive composed mostly from density:

- 62% `AudioFrame.b`, which is now documented as density projection, not bass.
- 24% `VisualFeatureFrame.density`, the canonical density feature.
- 14% normalized energy.

The runtime meaning is best described as a density/energy-driven animation signal. It raises visual fullness, particle turn/movement, glow size/opacity, network connection distance, temporal network density, and temporal ring size.

## Why The Current Name Is Misleading

The name implies a low-frequency spectral band or bass-energy drive. The calculation does not primarily use raw low-band energy. `AudioFrame.b` is a legacy compatibility projection that carries smoothed density, and `features.density` is another density signal. Only the `BarAnalysis.bass` field remains a true low-band spectral ratio, and it is not part of this modulation formula.

The result is a naming mismatch:

- Developers may assume `densityDrive` should correlate with bass/sub content.
- Tuning users see `Activity Turn`, but the turn response is actually gated by density/energy/movement, not true bass.
- Future changes could accidentally reintroduce bass-band assumptions into a density-based visual path.

## Proposed Replacement Names

### `densityDrive`

Preferred replacement:

- `densityDrive`

Alternatives:

- `densityEnergyDrive`
- `motionDensity`
- `visualDensityDrive`
- `densityImpulse`

Recommendation: use `densityDrive` if renamed. It is short, matches the dominant formula inputs, and remains broad enough for current visual uses beyond network density.

### `particleActivityTurn`

Preferred replacement:

- `particleActivityTurn`

User-facing label:

- `Activity Turn`

Alternatives:

- `Particle Activity Turn`
- `Motion turn`
- `Reactive turn`

Recommendation implemented: `Activity Turn` is the user-facing label because the input that gates the turn is density/energy-driven rather than bass-specific. The internal key is now `particleActivityTurn`, with compatibility mapping for legacy preset/export payloads.

## `particleActivityTurn` Runtime Behavior

`Particle.update(energy, activity, beat, isPlaying)` receives a second parameter named `activity`. In Classic mode that argument is exactly `State.modulation.densityDrive`. In Temporal mode the argument is:

```ts
State.modulation.densityDrive * 0.35 +
State.modulation.kineticTension * 0.32 +
State.modulation.spectralChaos * 0.24
```

Inside `Particle.update()`, if that argument is greater than `0.4`, the particle heading is randomized by:

```ts
random(-particleActivityTurn, particleActivityTurn) * activity
```

Actual behavior:

- It controls the maximum random angular turn amount for particles.
- The turn is gated by a density/energy-driven signal in Classic mode.
- The turn is gated by a blended movement signal in Temporal mode.
- It is not controlled by raw bass or low-frequency spectral-band energy.

Modulation inputs:

- Classic: `macroMomentum` for speed, `densityDrive` for turn, `rhythmicImpulse` for beat speed.
- Temporal: `macroMomentum` plus pattern resonance for speed, a blend of `densityDrive`, `kineticTension`, and `spectralChaos` for turn, and rhythmic/cue/pattern impulse for beat speed.

`Activity Turn` is accurate for Classic mode and remains broad enough for Temporal mode's density/tension/chaos movement blend.

## Migration Impact

### `densityDrive` Runtime Migration

Affected runtime files:

- `src/types/index.ts`
- `src/state/store.ts`
- `src/config/visualTuning.ts`
- `src/audio/AudioEngine.ts`
- `src/visuals/PlexusRenderer.ts`
- `src/visuals/ClassicPlexusEffect.ts`
- `src/visuals/TemporalMusicEffect.ts`
- `tests/modulation.test.mjs`
- `tests/performance-optimizations.test.mjs`
- `tests/contracts.test.mjs`

Affected documentation:

- `documents/metrics/metrics-source-audit.md`
- `documents/audits/metrics-audit-matrix.md`
- `documents/implementation/current-typescript-implementation.md`
- `documents/governance/metrics-and-modulation-governance.md`
- `documents/acceptance-criteria/usage-acs.md`
- `documents/acceptance-criteria/visual-tuning-presets-and-playback-ui-acs.md`
- `documents/adr/ADR-001-visual-tuning-presets-and-playback-ui.md`
- `documents/product/plexus-system-documentation.md`

Runtime behavior remained identical: every runtime reference was mechanically renamed and the formula is unchanged. External code that imported the legacy `ModulationState.lowFrequencyDrive` field is source-breaking because no runtime alias is kept.

### `particleActivityTurn` Preset Migration

Affected runtime/config files:

- `src/types/index.ts`
- `src/config/visualTuning.ts`
- `src/visuals/Particle.ts`
- `public/visual-tuning-presets/default.json`
- `public/visual-tuning-presets/temporal1.json`
- `public/visual-tuning-presets/temporal2.json`
- `public/visual-tuning-presets/temporal3.json`
- `public/visual-tuning-presets/temporal4.json`
- `public/visual-tuning-presets/temporal5.json`
- tests covering tuning controls, preset normalization, copied config, and visual hot paths

Runtime behavior remained identical because the default value, preset values, control range, and particle formula are unchanged. Preset compatibility is handled by `normalizeVisualTuningConfig()`, which maps legacy `particleBassTurn` payload values into canonical `particleActivityTurn` when the canonical key is absent.

## Backward Compatibility Risks

`densityDrive` risks:

- It is part of the TypeScript `ModulationState` contract. The migration is source-breaking for any external code that still references the legacy field.
- It appears in governance, acceptance criteria, and product docs, so future partial renames would create documentation drift.
- No runtime alias is kept; `densityDrive` is canonical.

`particleActivityTurn` risks:

- It is now the persisted visual tuning key used by shipped presets and copy/export config flows.
- `normalizeVisualTuningConfig()` maps legacy `particleBassTurn` values to canonical `particleActivityTurn`.
- Keeping both keys in `VisualTuningConfig` was avoided; the compatibility bridge exists only at load/normalization time.

## Migration Options

### Implemented Option: Rename Now

The migration renamed legacy `lowFrequencyDrive` to `densityDrive` and legacy `particleBassTurn` to `particleActivityTurn`, updated the visible label to `Activity Turn`, updated shipped presets, docs, and tests, and added compatibility mapping for old tuning payloads.

Pros:

- Fixes semantic drift immediately.
- Aligns modulation, tuning, docs, and UI wording with current metric contract.
- Reduces future risk of bass-band assumptions.

Cons:

- Touches many runtime and test files.
- Requires compatibility alias/mapping decisions.
- Has higher regression risk because `densityDrive` is widely consumed in render paths.

### Rejected Option: Rename Later

Document the mismatch now, keep runtime fields stable, and schedule a dedicated semantic migration that includes aliases, tests, preset migration, and release notes.

Pros:

- Avoids behavior risk during current metrics cleanup.
- Allows a planned compatibility layer for tuning payloads.
- Keeps the current worker/schema guarantees intact.

Cons:

- Leaves misleading internal names in place temporarily.
- Requires continued tests/docs to prevent user-facing bass terminology from spreading.

### Rejected Option: Keep Legacy

Keep the legacy names indefinitely, while documenting their actual meanings.

Pros:

- No compatibility break.
- No runtime churn.

Cons:

- Preserves misleading names in core renderer code.
- Future maintainers may misread density as bass/low-frequency content.
- Conflicts with the recent dashboard and metric semantic cleanup.

## Recommendation

Implemented recommendation: **rename now with compatibility mapping**.

Reasoning:

The migration was performed as a dedicated compatibility change. `densityDrive` is now the canonical modulation field, `particleActivityTurn` is now the canonical tuning key, and old `particleBassTurn` payloads still load correctly.

Recommended migration shape:

1. `ModulationState` and render consumers use `densityDrive`.
2. Tuning config, controls, presets, and particles use `particleActivityTurn`.
3. The user-facing tuning label is `Activity Turn`.
4. `normalizeVisualTuningConfig()` maps legacy `particleBassTurn` to `particleActivityTurn`.
5. Formulas, default values, ranges, and renderer behavior are unchanged.
