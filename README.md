# Plexus Engine

> **Plexus Engine: browser-based audio-reactive visual engine for musicians who want instant generative visuals from their own tracks.**

Plexus Engine is a browser-based generative visual instrument for electronic musicians, producers, DJs, and live performers.

Load your own audio, let the engine analyze the track, then perform with reactive visuals that follow the music’s energy, rhythm, structure, and movement.

**Live demo:** https://philofobreal.github.io/plexus-engine/

## What it is

Plexus Engine is not a classic VJ clip launcher and not a generic streamer overlay.

It is an audio-first visual engine built around the idea that a track has structure: intro, build, drop, break, peak, tension, density, melody, vocals, FX, and recurring patterns.

The goal is simple:

**Turn your own tracks into instant, expressive, performance-ready generative visuals.**

## Who it is for

Plexus Engine is made primarily for:

- electronic musicians
- producers
- DJs
- live act performers
- audiovisual artists
- creators who want fast music-reactive visuals without building a full VJ show from scratch

It is especially useful when you want a visual companion for your own music, a live stream, a performance recording, or an experimental audiovisual set.

## Core idea

Most VJ tools start from video clips.

Plexus Engine starts from the music.

When an audio file is loaded, the engine analyzes the track before playback. During playback, the visuals react to precomputed musical information instead of doing heavy audio analysis in the render loop.

That makes the system more stable for live use and allows the visuals to respond not only to loudness, but also to musical context.

## Current experience

You can currently:

- load a local audio file
- play, pause, seek, loop, or run once
- switch between visual modes
- use fullscreen presentation mode
- tune the look live
- load JSON visual presets
- copy/export visual tuning config
- reselect the same local media file to reload it after the file picker closes
- export browser-native WebM video with an embedded Plexus metadata card and optional Opus audio when supported
- view realtime music metrics such as energy, density, spectral melody-presence and vocal/formant heuristics, FX, beat impulse, dynamics, the header BPM badge, and a 24-band logarithmic Spectrum Balance visualization from the offline analyzer
- use presentation-oriented UI behavior where the chrome starts locked visible and can be unpinned into chrome auto-hide during performance
- inspect the timeline viewport with zoom, pan, scrub buffering, automation zone rendering, morph curve handles, and a cached waveform projection

## Visual modes

### Classic

The original Plexus look: particles, connected lines, central glow, beat shockwaves, and polygon flashes.

### Temporal

A more music-aware mode that uses full-track analysis to shape motion, density, color behavior, cue reactions, pattern resonance, and long-form tension.

### Dark Techno

A strict monochrome industrial mode with sharp white/gray line work and sparse strobe-like polygon flashes.

### Organic Ambient

A slow, fluid mode with soft pastel green, blue, and earth-tone glow fields instead of hard network lines.

### Cyberpunk

A high-contrast neon magenta/cyan mode with chromatic-aberration line offsets and deterministic glitch motion under high tension.

## Why it exists

The project explores a space between simple audio visualizers and complex professional VJ environments.

The aim is to keep the workflow immediate:

1. Load a track.
2. Choose or tune a visual style.
3. Perform, stream, capture, or iterate.

No timeline editing.  
No clip library management.  
No heavyweight desktop setup required.

## Product direction

The long-term direction is not to become another Resolume clone.

The stronger path is:

- instant visuals for musicians
- browser-native performance workflow
- shareable visual presets
- OBS / stream-friendly output
- live tuning and smooth preset morphing
- eventually MIDI / controller / BPM-sync workflows
- later: collaboration, controller mapping, and WebGPU-oriented rendering

## Tech stack

- Vite
- TypeScript
- p5.js
- Web Audio API
- Web Worker based offline analysis
- WebCodecs based offline WebM export worker
- static deployment via GitHub Pages

## Development

Inspect `package.json` and use the Node/npm-compatible package manager already available in your environment. Do not install dependencies solely for validation.

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Build:

```bash
npm run build
```

The current `deploy` script invokes Bun internally, so it is not a general Node/npm-compatible recommendation. Do not run it automatically in a Bun-free environment; migrating deployment to a Node-compatible script is a separate task.

If a declared script is absent or broken, use `npx`, a local `node_modules/.bin` executable, or a local package entrypoint with an available Node runtime. In Codex Desktop, discover the bundled Node path with the workspace dependency tool when needed, then run commands such as:

```powershell
& '<bundled-node>\node.exe' .\node_modules\typescript\bin\tsc
& '<bundled-node>\node.exe' .\node_modules\vite\bin\vite.js build
& '<bundled-node>\node.exe' --test tests\*.test.mjs tests\ui\*.test.mjs
```

Do not use a Bun-first strategy. Bun is an acceptable fallback only when it is the project's sole available, working runner; report any runtime or package-manager fallback used.

## Status

Early-stage prototype / experimental product direction.

The current focus is product identity, performance workflow, visual presets, and music-aware generative behavior rather than becoming a full professional VJ suite.

## License

No license has been declared yet.
