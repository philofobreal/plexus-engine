# Offline WebM Export

This feature document records the current browser-native offline WebM export workflow.

## Feature Scope

Plexus Engine can export the current visual performance to a WebM file from the browser without FFmpeg, WASM, or server-side rendering. The export path is deterministic: the renderer reads an externally controlled timestamp from shared state, the p5 draw loop is manually advanced, and encoding plus muxing run in a dedicated worker.

Implemented capabilities:

- Export controls live in the timeline action bar: resolution, aspect ratio, `Export`, `Stop`, and `Cancel`.
- Supported resolutions are `720p`, `1080p`, and `4K`.
- Supported aspect ratios are `16:9`, `9:16`, and `1:1`.
- Export currently runs at fixed `60 FPS` from `DashboardUI.getExportConfig()`.
- Successful exports download as `plexus-visual.webm`.
- `Stop` finalizes and downloads a partial WebM from the frames encoded so far.
- `Cancel` aborts the export and discards the partial output.
- Object URLs created for download are revoked after a `1000ms` delay so the browser download queue can consume the Blob before the URL is released.

## Runtime Ownership

The export path is split across three modules:

- `src/ui/DashboardUI.ts` owns DOM controls, enabled/disabled states, progress labels, stop/cancel button visibility, download creation, and user-input lockout while export is active.
- `src/export/WebMExporter.ts` owns the main-thread offline frame loop, p5 canvas resize/restore, `State.isExporting`, `State.exportTime`, `VideoFrame` capture, planar audio slicing, metadata-card drawing, and worker message dispatch.
- `src/export/export.worker.ts` owns WebCodecs encoder lifecycle and byte-level WebM muxing.

`PlexusRenderer` does not poll export state and does not own p5 loop state during export. `WebMExporter.startExport()` calls `p5Instance.noLoop()`, and cleanup calls `p5Instance.loop()`.

## Time Decoupling

The render-time clock is detached from live playback during export:

```ts
let ct = State.isExporting ? State.exportTime : engine.getCurrentTime();
```

`WebMExporter` sets `State.isExporting = true`, initializes `State.exportTime = 0`, and advances `State.exportTime = i / fps` for each encoded frame. This lets the renderer reuse the normal visual pipeline while taking deterministic timestamps from the exporter.

Export is considered an active visual state:

- `State.playbackFade` ramps toward `1.0` when `State.isPlaying || State.isExporting`.
- `Particle.update()` treats `State.isExporting` as effective playback for particle speed.
- Drop anticipation and frame/feature publication run during export just as they do during playback.

## Frame Capture Ordering

The main-thread export loop captures the frame immediately after drawing and before yielding back to the browser:

1. Set `State.exportTime`.
2. Call `p5Instance.redraw()`.
3. Draw the metadata card/watermark onto the export canvas.
4. Create the `VideoFrame` from the canvas.
5. Yield with `await nextAnimationFrame()`.
6. Send the frame and optional audio payload to the worker.

This ordering is intentional. It guarantees the metadata card is included in the captured frame before any browser buffer swap, canvas clear, or UI task can intervene.

After `resizeCanvas(target.width, target.height)`, the exporter awaits one animation frame before the first render frame. This gives p5 and the browser time to settle the resized backing store.

## Metadata Card Watermark

`WebMExporter.drawMetadataCard(width, height)` draws a high-resolution visual identity card in the upper-left corner of every exported frame.

The card includes:

- rounded dark panel with subtle white border,
- audio-reactive cyan dot driven by `State.beatDecay`,
- `PLEXUS ENGINE` brand label,
- loaded track name from the UI status text, ellipsized when too long,
- optional `${State.bpm} BPM` cyan badge.

All card drawing happens inside `ctx.save()` / `ctx.restore()`, and transient shadow state is explicitly reset after the pulsing cyan dot.

## Audio Export

When `AudioEngine.getAudioBuffer()` returns an `AudioBuffer`, `WebMExporter` sends stereo planar `Float32Array` slices alongside each video frame.

For frame `i`, samples are copied as:

1. left channel samples for the frame interval,
2. right channel samples for the same interval.

Mono input duplicates the left channel into the right channel. The planar buffer is transferred to the worker with `audioPlanar.buffer`.

The worker attempts to initialize WebCodecs `AudioEncoder` with Opus:

```ts
{
  codec: 'opus',
  sampleRate,
  numberOfChannels: 2
}
```

If `AudioEncoder` or `AudioData` is unavailable, export continues in video-only mode and emits an audio warning message instead of failing the whole export.

## Worker And Muxing

`src/export/export.worker.ts` handles:

- `start_export`: configure `VideoEncoder`, optionally configure `AudioEncoder`, initialize `WebMMuxer`.
- `encode_frame`: encode a transferable `VideoFrame`, optionally encode `AudioData` from planar audio.
- `finalize_export`: flush encoders, finalize the WebM Blob, and post `export_done`.

`WebMMuxer` is dependency-free TypeScript. It writes EBML, Segment, Info, Tracks, Cluster, and SimpleBlock structures. Video uses track 1 (`0x81`) with VP8/VP9 codec IDs. Audio uses track 2 (`0x82`) with `A_OPUS`, Opus private header, sample rate, and two channels.

## UI Safety

While `State.isExporting` is true, Dashboard UI blocks playback and editing shortcuts that could mutate playback or drawing state during offline rendering:

- visual surface click,
- visual surface keydown,
- global envelope drawing keydown.

Playback controls, seek, upload, and export selectors are disabled during export. `Stop` and `Cancel` are shown only while export is active.

## Validation

Export behavior is covered by `tests/export-deterministic.test.mjs`:

- `WebMExporter` owns p5 `noLoop()` / `loop()` lifecycle.
- `PlexusRenderer` does not poll export loop state.
- resize-settle `requestAnimationFrame` happens before first redraw.
- metadata card text and BPM badge are drawn in a browser-free VM test.
- `stopAndSave()` finalizes and returns a partial WebM Blob.

Recommended validation after export changes:

```powershell
node node_modules/typescript/bin/tsc
node --test tests/*.test.mjs tests/ui/*.test.mjs
node node_modules/vite/bin/vite.js build
```
