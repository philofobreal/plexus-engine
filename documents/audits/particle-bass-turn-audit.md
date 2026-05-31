# Particle Activity Turn Audit

This audit records the migration from the legacy `particleBassTurn` tuning key to canonical `particleActivityTurn`. Runtime behavior, formulas, ranges, and default values are unchanged.

## Current Behavior

`particleActivityTurn` is a visual tuning key in `VisualTuningConfig`.

Definition:

- Type contract: `src/types/index.ts`, `VisualTuningConfig.particleActivityTurn: number`
- Default value: `src/config/visualTuning.ts`, `particleActivityTurn: 0.1`
- Tuning control: `src/config/visualTuning.ts`, label `Activity Turn`, group `Particles`, range `0..2`, step `0.01`
- UI rendering: `src/ui/DashboardUI.ts` dynamically renders the tuning row from `visualTuningControls`
- Runtime consumer: `src/visuals/Particle.ts`

Runtime effect:

```ts
if (activity > 0.4) {
    let heading = this.vel.heading() + this.p.random(-State.visualTuning.particleActivityTurn, State.visualTuning.particleActivityTurn) * activity;
    this.vel.set(this.p.cos(heading), this.p.sin(heading));
}
```

Actual behavior:

- It scales the maximum random angular turn applied to a particle's velocity heading.
- It only applies when the second `Particle.update()` argument is greater than `0.4`.
- It does not affect particle speed directly.
- It does not read audio data directly.
- It does not read low-frequency or bass-band data directly.
- It is a tuning multiplier for reactive particle rotation/steering.

Renderer call sites:

| Renderer | Call | Meaning |
|---|---|---|
| `ClassicPlexusEffect` | `pt.update(State.modulation.macroMomentum, State.modulation.densityDrive, State.modulation.rhythmicImpulse, State.isPlaying)` | `particleActivityTurn` scales random turn gated by `densityDrive`. |
| `TemporalMusicEffect` | `pt.update(energy, movement, impulse, State.isPlaying)` | `particleActivityTurn` scales random turn gated by `movement`, a blended modulation signal. |

Presets:

| Preset | Key | Value |
|---|---|---:|
| `public/visual-tuning-presets/default.json` | `particleActivityTurn` | `0.1` |
| `public/visual-tuning-presets/temporal1.json` | `particleActivityTurn` | `0.1` |
| `public/visual-tuning-presets/temporal2.json` | `particleActivityTurn` | `0.1` |
| `public/visual-tuning-presets/temporal3.json` | `particleActivityTurn` | `0.1` |
| `public/visual-tuning-presets/temporal4.json` | `particleActivityTurn` | `0.1` |
| `public/visual-tuning-presets/temporal5.json` | `particleActivityTurn` | `0.1` |

`index.json` is only the preset manifest and does not contain tuning values.

## Signal Sources

`particleActivityTurn` is not itself a signal source. It is a tuning multiplier. The signal that gates the turn comes from the second argument of `Particle.update(energy, activity, beat, isPlaying)`.

### Classic Mode

Classic call:

```ts
pt.update(
    State.modulation.macroMomentum,
    State.modulation.densityDrive,
    State.modulation.rhythmicImpulse,
    State.isPlaying
);
```

Turn gate source:

- `State.modulation.densityDrive`

`densityDrive` formula:

```ts
scaleUnit(
    frame.b * 0.62 +
    features.density * 0.24 +
    frame.e * 0.14,
    sensitivity
)
```

Actual source meanings:

- `frame.b`: legacy density projection, not bass.
- `features.density`: canonical density feature.
- `frame.e`: normalized RMS energy.
- `audioSensitivity`: scalar.

Classic conclusion:

- The turn is density/energy-driven.
- Bass is not a genuine source.
- The only "bass" association is the stale name `frame.b`, but `AudioFrame.b` is documented as density projection.

### Temporal Mode

Temporal call:

```ts
let energy = State.modulation.macroMomentum * 0.55 + resonance.strength * 0.18;
let movement = State.modulation.densityDrive * 0.35 + State.modulation.kineticTension * 0.32 + State.modulation.spectralChaos * 0.24;
let impulse = Math.max(State.modulation.rhythmicImpulse * 0.65, State.cueDecay * 0.45, resonance.strength * 0.35);
for (let pt of particles) pt.update(energy, movement, impulse, State.isPlaying);
```

Turn gate source:

- `movement`

`movement` inputs:

| Input | Weight | Meaning |
|---|---:|---|
| `densityDrive` | `0.35` | Density/energy-driven fullness signal. |
| `kineticTension` | `0.32` | Vocal/melody/tension/cue pressure signal. |
| `spectralChaos` | `0.24` | FX/brightness/high-transient signal. |

Temporal conclusion:

- The turn is a composite activity/movement response.
- Density/energy is the largest single component through `densityDrive`, but not the only source.
- Bass is not a genuine source.

### Related Modulation Dependencies

| Modulation signal | Formula | Relation to particle turn |
|---|---|---|
| `densityDrive` | `frame.b * 0.62 + features.density * 0.24 + frame.e * 0.14`, scaled and clamped | Classic turn gate; largest component of Temporal movement. |
| `kineticTension` | `features.vocal * 0.28 + features.melody * 0.22 + features.tension * 0.32 + cueDecay * 0.18`, plus dramaturgy boost | Temporal movement component. |
| `spectralChaos` | `frame.t * 0.42 + features.fx * 0.36 + features.brightness * 0.22`, scaled and clamped | Temporal movement component. |
| `macroMomentum` | `frame.eRatio * 0.58 + frame.e * 0.24 + features.density * 0.18`, with buildup minimum | Particle speed input, not turn gate. |
| `rhythmicImpulse` | `max(beatDecay, cueDecay * 0.65)`, scaled and clamped | Particle speed impulse input, not turn gate. |

## Naming Accuracy

`particleActivityTurn` is semantically correct for the current runtime behavior.

Reasons:

1. The key controls angular turn amplitude gated by visual activity, not bass.
2. The runtime gate is `densityDrive` in Classic mode, and `densityDrive` is density/energy-driven.
3. The runtime gate is a composite movement signal in Temporal mode.
4. No call path uses `BarAnalysis.bass` or any true low-frequency spectral-band ratio.
5. The visible tuning label `Activity Turn` correctly sets the expectation that dense/full/activity-heavy passages increase particle turn.

Actual user expectation from the former legacy label:

- Users would expect the slider to control how much bass/sub/low-frequency content makes particles turn.

Actual behavior:

- The slider controls how strongly particles randomize direction when the visual activity gate is high.
- In Classic mode, that gate is mostly density plus some energy.
- In Temporal mode, that gate is density/energy plus tension and FX/brightness pressure.

Alternative names:

| Candidate | Accuracy | Notes |
|---|---|---|
| `Particle Activity Turn` | High | Best for Classic mode and aligns with `densityDrive`'s dominant source. Slightly under-describes Temporal's tension/chaos blend. |
| `Activity Turn` | High | Best cross-mode user-facing description; covers density, tension, chaos, and movement without implying a raw metric. |
| `Motion Turn` | Medium | Describes visual behavior but is vague and may overlap with particle speed controls. |
| `Density Rotation` | Medium | Source is mostly right for Classic, but "rotation" may imply orbiting or continuous spinning rather than randomized heading changes. |
| `Composite Turn` | Low | Technically true in Temporal mode but too abstract for users and not descriptive of the visual result. |

## Migration Risk

Runtime risk:

- Low if only the user-facing label changes.
- Medium if the TypeScript field is renamed, because `Particle.ts`, `VisualTuningConfig`, defaults, presets, tuning controls, and tests must change together.

Preset compatibility risk:

- High for an internal key rename without compatibility mapping.
- Every shipped preset now stores `particleActivityTurn`.
- `copyVisualConfig()` exports `State.targetTuning`, so user-copied configs also persist `particleActivityTurn`.
- `normalizeVisualTuningConfig()` maps legacy `particleBassTurn` values into `particleActivityTurn` when the canonical key is absent.

Documentation/test risk:

- Existing audits already document the semantic mismatch.
- Tests currently cover tuning/preset normalization broadly, not this term specifically.
- Tests cover old-key compatibility for legacy `particleBassTurn` payloads.

Implemented migration posture:

1. Rename the field in a dedicated compatibility migration.
2. Preserve old preset key support.
3. Keep runtime formula and behavior unchanged.
4. Update the UI label and docs in the same change.
5. Add tests proving `{ particleBassTurn: x }` maps to the new key.

## Recommended Future Name

Current user-facing label: **Activity Turn**.

Reasoning:

- It best matches both Classic and Temporal behavior.
- It does not imply raw bass, low-frequency spectral energy, or a pure density metric.
- It describes what the user experiences: particles turn more when the visual activity signal is high.
- It avoids confusing "rotation" with orbital/spinning behavior.

Current internal field name: `particleActivityTurn`.

If the project wants stricter alignment with the metrics vocabulary and accepts that Temporal mode is slightly broader than density, `particleActivityTurn` / `Particle Activity Turn` is the second-best option. It is more source-specific for Classic mode, but `Activity Turn` is the more accurate cross-mode label.
