# Visual Identities

This document records the active visual identity system in `src/visuals/`.

## Purpose

Visual identities are deep visual modules. Each identity hides its own color theory, movement dynamics, network or polygon rules, and performance tradeoffs behind the same small contract:

```ts
export interface VisualIdentity {
    readonly id: string;
    readonly name: string;
    draw(backend: VisualRendererBackend, particles: Particle[], shockwaves: Shockwave[]): void;
}
```

`PlexusRenderer` remains the render orchestrator. It synchronizes playback time, accepted analysis frames, beat and cue event indexes, modulation, visual tuning, and `VisualDirectorFSM` output. It does not contain mode-specific drawing branches. At the end of each draw cycle it calls:

```ts
const visualIdentity = styleRegistry.get(State.visualMode);
visualIdentity.draw(backend, particles, shockwaves);
```

## Registry

`src/visuals/StyleRegistry.ts` owns registered styles behind a private `Map`. Its public API is intentionally small:

- `register(identity: VisualIdentity): void`
- `get(id: string): VisualIdentity`
- `createDefaultStyleRegistry(): StyleRegistry`

Unknown style ids fall back to the `classic` identity. If `classic` itself has not been registered, `get()` throws because the application has been composed incorrectly.

`createDefaultStyleRegistry()` registers the current built-in identities:

- `classic`
- `temporal`
- `dark-techno`
- `organic-ambient`
- `cyberpunk`

There is no module-level writable global registry. The app composes a registry instance in `src/main.ts` and passes it to `startPlexusRenderer()`.

## Built-In Identities

### Classic

File: `src/visuals/ClassicPlexusEffect.ts`

The original Plexus look: particle network, central glow, beat shockwaves, polygon flashes, and deterministic LOW_DROP glitch offsets. Color buffers are private fields on the identity instance, not module-level writable arrays.

### Temporal

File: `src/visuals/TemporalMusicEffect.ts`

A track-aware identity that consumes `TrackAnalysis` sections, recurring patterns, visual features, cues, and modulation to drive background tone, network density, polygon color, central mechanism rings, and pattern resonance. It keeps color buffers inside the identity object and passes numeric RGB components to ring drawing.

### Dark Techno

File: `src/visuals/DarkTechnoIdentity.ts`

Strict monochrome industrial language. It uses sharp white/gray line work, sparse high-brightness strobe polygon flashes, and disables `radialGlow` entirely to preserve a raw digital dark aesthetic.

### Organic Ambient

File: `src/visuals/OrganicAmbientIdentity.ts`

Slow, fluid, fog-like identity. It avoids sharp network lines and instead draws pastel green, blue, and earth-tone radial glow layers around particles so they blend into a soft field.

### Cyberpunk

File: `src/visuals/CyberpunkIdentity.ts`

High-contrast neon magenta and cyan identity. It simulates chromatic aberration by drawing connections twice with small offsets and uses deterministic high-tension glitch offsets during buildup/drop pressure.

## UI And Presets

`State.visualMode` is a `VisualMode` union:

```ts
'classic' | 'temporal' | 'dark-techno' | 'organic-ambient' | 'cyberpunk'
```

The visual mode select in `src/main.ts` exposes all five values. `DashboardUI` validates mode ids through `isVisualMode()` before writing `State.visualMode`. Preset loading uses the same validation, so older presets without `visualMode` remain valid and newer presets that contain any registered built-in style update both `State.visualMode` and the select element.

## Render Boundary And Performance Rules

- Identities must draw only through `VisualRendererBackend`.
- Direct p5 drawing belongs in `P5RendererBackend`, `Particle`, `Shockwave`, or `PlexusRenderer` setup/lifecycle code.
- Do not allocate p5 vectors, particles, shockwaves, or unbounded persistent objects inside identity draw paths.
- Hot color conversion should use `hueToRgbInto()` with identity-owned RGB tuples.
- Random-looking glitch behavior must be deterministic from indexes, salts, playback phase, and modulation state; do not use nondeterministic randomness inside identity draw loops.

## Validation

`tests/styles-deterministic.test.mjs` creates a browser-free, p5-free deterministic render harness. It loads the TypeScript visual modules in a VM, uses a mock `VisualRendererBackend`, mock particles, and mock shockwaves, and simulates 60 frames for every built-in identity across five genre reference profiles:

- Peak Time Techno, 128 BPM
- Organic House / Ambient, 90 BPM
- IDM / Breakbeat, 140 BPM
- Industrial Techno, 150 BPM
- Cinematic Ambient, 70 BPM

The test asserts that no identity crashes in intro, buildup, drop, or break phases and that backend draw-call counts are deterministic across repeated runs.
