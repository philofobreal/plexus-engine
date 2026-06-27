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
- Export is strictly WebCodecs-only and does not use MediaRecorder fallbacks, guaranteeing deterministic, high-quality encoding results across all supported platforms.
- When a video file is loaded, export composites the original video frames as the background layer, draws the p5 generative visual layer over it, and optionally draws the metadata card on top.

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

## Memory Safety and Backpressure

The main-thread export loop enforces hard backpressure against the hardware encoder to prevent Out-Of-Memory crashes, particularly on mobile devices.

The worker posts `queue_update` telemetry messages whenever the WebCodecs encoder's internal queue depth changes. The main thread tracks this value as `workerQueueDepth` and blocks further p5 rendering with a hard spin-lock:

```ts
while (workerQueueDepth >= 2) {
  await sleep(1);
}
```

This loop yields to the browser event loop every iteration (`sleep(1)`), which serves two purposes: it prevents the tab from freezing under encoder backpressure, and it keeps the STOP button responsive so the user can abort immediately at any point during a long export.

Additionally, the main loop yields `sleep(1)` every 2 frames unconditionally, ensuring the browser event loop is serviced regularly even when the encoder is keeping up.

## Frame Capture Ordering

The main-thread export loop captures the frame immediately after drawing and before yielding back to the browser:

1. Set `State.exportTime`.
2. If a video backplate is active, set `video.currentTime = State.exportTime` and wait for the browser to expose the requested frame.
3. Call `p5Instance.redraw()` to draw the transparent p5 visual layer.
4. Composite video background, p5 overlay, and optional metadata card into the capture canvas.
5. Create the `VideoFrame` from the composited canvas.
6. Yield with `await nextAnimationFrame()`.
7. Send the frame and optional audio payload to the worker.

This ordering is intentional. When the watermark is enabled, it guarantees the metadata card is included in the captured frame before any browser buffer swap, canvas clear, or UI task can intervene.

After `resizeCanvas(target.width, target.height)`, the exporter awaits one animation frame before the first render frame. This gives p5 and the browser time to settle the resized backing store.

## Video Background Composition

Video background export is deterministic and remains subordinate to the offline export clock. The exporter does not play the `<video>` element during export. For every frame it seeks the muted element to `State.exportTime`, awaits `seeked` when a seek is required, and waits for `loadeddata` when the browser has not yet made current frame data available. The export loop does not advance until the requested video frame is ready.

The compositing order is:

1. draw the decoded video frame into the export canvas using contain-style centering,
2. draw the p5 graphics canvas over it,
3. draw the optional metadata card/watermark last.

When no video backplate is loaded, export keeps the original p5-only capture path.

## Metadata Card Watermark

`WebMExporter.drawMetadataCard(width, height)` draws a high-resolution visual identity card in the upper-left corner of exported frames when the UI `#export-watermark` checkbox is enabled. The checkbox is off by default, so exports omit the Plexus metadata card unless the user explicitly opts in.

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

When the `Hero` visual mode is active and `heroBeepMode > 0`, the exporter also reads the corresponding `HeroMetronome` stem buffer and mixes the exact sample slice for the exported frame into `audioPlanar`. The mixed beep is scaled by `heroBeepVolume` and clamped to `[-1.0, 1.0]` before the planar buffer is transferred.

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

- `start_export`: configure `VideoEncoder`, optionally configure `AudioEncoder`, initialize `WebMMuxer`, and open an OPFS file via `FileSystemSyncAccessHandle`.
- `encode_frame`: encode a transferable `VideoFrame`, optionally encode `AudioData` from planar audio, and write each completed muxer chunk synchronously to disk.
- `finalize_export`: flush encoders, finalize the WebM container, close the sync handle, retrieve the completed file as a native `Blob` via `getFile()`, and post `export_done`.

### Video encoding quality policy

`WebMExporter` and `WebCodecsBackend` are orchestration facades; the worker owns the effective `VideoEncoder` configuration and every `encoder.encode()` call. The worker configures video with `latencyMode: 'quality'` and `bitrateMode: 'constant'`.

Every export starts with a forced keyframe. Subsequent keyframes are forced once per second: the interval is `max(1, round(framerate))` submitted frames, so it is 60 frames at 60 FPS and 30 frames at 30 FPS. The submitted-frame counter is reset for each `start_export`. A `VideoFrame` remains open through `encoder.encode(frame, { keyFrame })` and is closed in the existing `finally` block immediately afterward.

An explicit finite, positive `StartExportRequest.bitrate` remains authoritative and is rounded to an integer; zero, negative, non-finite, or missing values use the fallback. The worker applies the resolution-based CBR tiers at 75% of each nominal pixel threshold so 4K-like crops and browser-rounded dimensions do not fall into a much lower tier:

| Resolution/pixel threshold | Default bitrate |
| --- | ---: |
| Below 75% of 1280x720 | Pixel-scaled from 8 Mbps, with a 2 Mbps minimum |
| At least 75% of 1280x720 | 8 Mbps |
| At least 75% of 1920x1080 | 14 Mbps |
| At least 75% of 3840x2160 | 40 Mbps |

The higher floors are intentional for dark or mostly static generative imagery, where lower bitrate encoding can produce unstable blocks or gradients. Dithering is not part of the normal export path because it would weaken pixel determinism. It may only be considered as a fallback after real-browser validation shows artifacts remain with forced keyframes, constant bitrate mode, and the higher bitrate policy.

Encoded WebM chunks are written synchronously and directly to disk using the Origin Private File System (OPFS) `FileSystemSyncAccessHandle` API. Each chunk is discarded from RAM immediately after the write, eliminating the accumulation of large in-memory Blobs that previously caused OOM crashes on long exports or low-memory devices. At the end of export the final file is retrieved natively via `fileHandle.getFile()` without any in-memory reassembly.

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
- the encoder receives quality latency mode, constant bitrate mode, and the 8/14/40 Mbps resolution policy.
- a valid explicit bitrate overrides the resolution fallback.
- frame zero and each one-second boundary are forced keyframes at both 30 and 60 FPS.

Recommended validation after export changes:

```powershell
& '<bundled-node>\node.exe' .\node_modules\typescript\bin\tsc
& '<bundled-node>\node.exe' --test tests\*.test.mjs tests\ui\*.test.mjs
& '<bundled-node>\node.exe' .\node_modules\vite\bin\vite.js build
```

Use this bundled Node form when Bun is unavailable on PATH. If Bun is available, the equivalent project-level commands remain `bun run test` and `bun run build`.
