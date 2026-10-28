# Worker Communication

This document extends `../../AGENTS.md`. If there is a conflict, `AGENTS.md` is authoritative.

T16 informational spectrum: the resolved MVP host-frame request may carry optional normalized
`musicDisplay` preferences (mode/size/opacity). Default Off omits the field and preserves the old
packet shape; omission resets a previously enabled worker display. Analysis/spectrum frames still
cross only in the existing generation-checked prepare publication. The worker merely forwards
preferences; the identity owns the bounded display pass. Embedded v1 preview/v2 exact requests
reuse the existing presentation message. No new transfer buffers, analysis result fields or second
clock are added. Display-only changes redraw while paused without snapping tuning or replaying cues.

## Boundary Contract

Worker input and output are public contracts. Keep them typed and versionable.

Current analysis request fields:

- `requestId`.
- `algorithmVersion`.
- `samples` as an `ArrayBuffer`.
- `sampleRate`.
- Optional `eventTiming`: `local-band-v1` or `local-band-v2`. Absence preserves default event timing.
  The current v2 publishes `accepted-frame-band-timing-v2-dc1`; historical v2 reports remain readable.
- Optional boolean `rhythmOnsets`: XR requests an additional percussive chart pool. Absence/false
  preserves default analysis; explicit experimental event retiming retains its legacy source.

Current analysis success message fields:

- `type: 'analysis_done'`.
- `requestId`.
- `bpm`.
- `bpmConfidence`.
- `gridConfidence`.
- `downbeatConfidence`.
- `tempoCandidates`.
- `adaptiveThreshold`.
- `frames`.
- `events`.
- `hopSize`.
- `beats` — authoritative beat times (seconds), the single timing source for downstream consumers.
- `barStarts` — authoritative downbeat (bar start) times (seconds).
- `timingConfidence` — unified `{ tempo, beat, grid, overall }` confidence model, each in `[0, 1]`.
- `trackAnalysis`.
- Optional nested `trackAnalysis.rhythmOnsets`: percussive-pool-v1, exact feature clock and ordered
  frame-peak events, retaining every legacy hit. It adds chart choices before visual proximity
  suppression, without changing the legacy event/cue/grid arrays or promoting raw research
  candidates. Runtime normalization checks clock, frames, types/intensities and legacy inclusion.
  The JSON schema is additive; renderer-worker preparation omits this unused chart-only field.
  [Consumer ownership and limits](../adr/ADR-009-xr-rhythm-game-host.md#addendum-bg---t12d-percussive-chart-source-and-independent-density-budget-2026-10-28).
- Optional nested `trackAnalysis.eventTiming`: algorithm/policy identity, original PCM clock and
  per-accepted-event status/time/sample-support provenance. It localizes existing events only;
  beats, bars and the playback clock retain their original ownership. The strict result schema
  describes its shape; runtime normalization additionally binds it to the published events/clock.

Optional nested `trackAnalysis.musicEvents` projects accepted visual events with local IDs,
original song times/sample positions, accepted-event associations and real feature-window support.
Current analyzer output includes it; legacy payloads may omit it. Confidence is explicitly null,
tonal/vocal recognition is unsupported and dominance unknown. Normalization checks the actual
clock and accepted-event association; it never invents acoustic note onsets or an independent grid.
See [T11a scope](../features/music-events.md) and the strict result schema.

Optional nested `trackAnalysis.musicActivity` is the independent `acoustic-activity-v1`
signal-evidence layer. It carries AC activity spans/censored boundaries, energy-rise candidates
and aggregated spectral-texture intervals on the original PCM clock. It has null confidence,
unsupported note/vocal identity and explicit chart-scoring ineligibility. Normalization binds
support, frame resolution, intervals and capability identity; legacy omission remains valid.
This once-per-load result does not add per-frame render packets or alter accepted hits/grid.
See [T11b scope and limits](../features/music-events.md#t11b--acoustic-activity-evidence-2026-10-25).

T11c optionally extends that layer with `spectralEntries` (`tonal-carrier-entry-v1`): quiet
spectral additions over a stable retained carrier, explicit pre-fit/body/full sample support and
local body-gate time. Final dedup/publication remains retrospective; that gate is not an online
availability promise. It remains raw, scoring-ineligible evidence. Legacy omission is valid; the
normalizer rejects incomplete support, forged scope/ratios, invalid association and duplicates.
No top-level request/result fields, accepted hits, playback clock or render packets change.

T11d optionally adds `musicActivity.bandActivity` (`entry-fixed-band-activity-v1`), associated
one-to-one with accepted spectral-entry IDs. It measures frozen frequency-mask activity, with
unresolved source ownership, null confidence and scoring ineligibility. Closed records include
two full quiet-window observations and their local confirmation-gate time; final entry association
remains retrospective. File tails are right-censored,
and bounded-monitor saturation explicitly returns an unavailable end. The normalizer validates
association, bins, support and censoring and clones publication. Old payloads may omit it.
It adds no render-time packets, playback DSP, chart consumer or player control. See
[T11d scope and limits](../features/music-events.md#t11d---entry-frozen-band-activity-2026-10-25).

T11e optionally adds `musicActivity.entryContexts` (`entry-prefix-neighborhood-v1`), one record
per final spectral-entry ID. Its dominant-excess neighborhood scope, unresolved ownership, null
confidence and scoring ineligibility are explicit. Only the two clean pre-search windows inform
prefix power; separate seed support and bin identify the actual measurement. Publication is
`full-track-analysis`, with decision time at real PCM length: inherited T11c/d local body/quiet
gates do not imply irrevocable online availability of an associated entry. Strict normalization
binds classification, clocks and optional band-bin cross-association. Legacy omission stays valid.
This offline signal evidence neither removes raw candidates nor changes playback/render packets.
[T11e scope and publication limit](../features/music-events.md#t11e---dominant-excess-neighborhood-context-2026-10-25).

The authoritative musical timing model (`tempo`, `tempoConfidence`, `beats`, `beatConfidence`,
`barStarts`, `alternativeTempos`, `timingConfidence`) is carried on the nested `TrackAnalysis`
as well, and `beats` / `barStarts` / `timingConfidence` are mirrored at the root for direct
worker consumers. These are public-contract fields: extending them is a single-owner schema
task. `tests/fixtures/analyzer/analysis-result.schema.json` is the authoritative shape and
must be updated together with `src/types`, `normalizeAnalysisResult`, and the empty-template
fallbacks in `state/store`. No downstream module may compute an independent beat grid; all
beat/bar timing must be read from this model.

Current failure message fields:

- `type: 'analysis_error'`.
- `requestId`.
- `errorCode`.
- `message`.

## Wormhole Render Worker (XR background)

`src/visuals/wormholeRender.worker.ts` is a long-lived *render* worker, not a one-shot compute job
(ADR-009 Addendum G). Its typed contract lives in `src/types/WormholeWorkerProtocol.ts` (protocol
version 1 preview; separately negotiated exact version 2 is described below):

- Requests: `init` (protocol, raster size, depth cue, optional `profile` for diagnostics,
  optional `externalMaterial` for the host-rendered grain material, ADR-009 Addendum W, and with it
  optional `externalLines` for host-drawn grain trail lines, Addendum AA, and optional
  `softwareRaster` for a software (CPU) Canvas2D raster, Addendum AE, and optional `webglRaster` for
  a WebGL2 raster, Addendum AF),
  `prepare` (generation, analysis snapshot), `prepare-plan` (generation, performance plan),
  `render` (generation, time, playing, optional `continuous`), `presentation` (Line stroke, rate cap, optional Visual
  character macros, ADR-009 Addendum R; optional Grain material boosts, Addendum V), `dispose`. Optional presentation fields are additive and
  keep protocol version 1; removing or reinterpreting a field requires a version bump.
- Responses: `prepared` (generation, optional `raster`: `webgl` or `canvas2d`, what rasterizes the
  frames, Addendum AF) / `prepare-error` (generation), `frame` (generation, time, transferred
  `ImageBitmap`, focal point, raster ms, optional `stages` -- per-stage ms, only when `init`
  asked to profile; ADR-009 Addendum U; optional `material` -- the frame's grain carriers, only
  with `externalMaterial`, a Float32Array viewing exactly `count` records of a pooled buffer
  transferred with the bitmap; Addendum W), `unchanged` (generation), `failure` (message).
- Trail lines (additive `init.externalLines` and frame field `lines`, still protocol version 1):
  with external material, a frame's grain trail strokes travel as a `GrainLineFrame` whose data views
  the same pooled buffer right after the carriers. It is transferred and returned with them, and
  the host reads it only while that frame is shown.
- Carrier buffer pool (additive request `release-material`, still protocol version 1): the host
  transfers a frame's carrier buffer back once the next frame replaces it, or when the frame is
  stale or discarded. Each buffer is in exactly one place (worker pool, host, or in transit); the
  worker writes only pooled buffers, keeps at most three and allocates (with headroom) only when
  none fits. After dispose or a failure the host drops buffers instead of posting them.
- Spatial state (additive frame field `spatial`, still protocol version 1; ADR-009 Addendum AC): a frame
  may carry its `WormholeSpatialFrame`, plain numbers that are structured-cloned and not
  transferred. The host adopts it only when it presents that frame, never a pending frame's, so the
  XR spatial field and the focal point always describe the image on screen.
- Continuity (additive `render.continuous`, still protocol version 1; ADR-009 Addendum AB): the proxy
  sets it when a playing request continues uninterrupted playback from the previous one: host song
  time advanced by about the wall-clock time elapsed (within 0.1 s) and by at most 1 s
  (`isContinuousPlaybackStep` in `src/types/CanvasVisualSource.ts`). The worker passes it to
  `WormholeCanvasSource.render` as a boolean, and the source then morphs and integrates its route
  through the step instead of resynchronizing it like a seek. A continuous request never asks for
  an earlier time than the previous request, whatever the lead calibration does. The wall clock
  only classifies the step; the requested time always comes from the song clock.
- Plan updates (additive request `prepare-plan`, still protocol version 1): the worker keeps its
  copy of the last `prepare` analysis. When a new snapshot differs from the one last sent in full
  only in its `performancePlan` (Activity / Variation regenerated the plan over the same
  publication), the proxy sends the plan alone, and the worker re-prepares its source from the
  kept copy with that plan. This avoids re-cloning the per-hop analysis (~23-36 ms of
  main-thread `postMessage` for a 5-minute track on a desktop CPU; ~0.1 ms for the plan). Any
  other difference, a `null` preparation or a `prepare` that failed to post sends the analysis in
  full again. A worker without a kept analysis answers `prepare-error`.
- Identification: every `prepare` / `prepare-plan` starts a new generation; the proxy drops (and
  closes) frames and answers from older generations, so a superseded preparation can never
  overwrite a newer one.
- Copy vs transfer: the analysis snapshot is structured-cloned (copied) because the host keeps
  using its immutable publication, and neither side mutates its copy; frame bitmaps are
  transferred to the host, which consumes each exactly once or closes it.
- Backpressure: at most one `render` is in flight; the host never queues frames.
- No `SharedArrayBuffer`: it would require cross-origin isolation (COOP/COEP headers on every
  deployment) and an atomic ownership protocol. The transferable carrier pool and plan-only updates
  remove the measured allocation and copy costs without them (decision of 2026-10-05).
- Termination: the worker lives as long as its background plane. It is terminated on dispose
  (background off is a pause, not a dispose; quality changes and page teardown dispose), and
  immediately on any worker failure. This is the render-worker reading of the AGENTS.md rule
  "terminate on success, error, cancellation and superseded load": each rebuild supersedes and
  terminates the previous worker.
- The worker must remain free of DOM, `State`, UI, audio and XR modules; it renders only the plan
  it is given and fetches only that plan's preset assets.

## Exact Wormhole capability (T05c)

`WormholeExactWorkerSource` is an offline adapter separate from the live preview proxy.
Its protocol v2 `init` supplies a `contextId` and optional copied host `contextSeed`; the worker
answers `capabilities` with protocol 2, that context and sampler `fixed-song-60-v1`. Preparation
must not succeed without that handshake. The existing v1 preview contract remains supported;
v1 frames or `unchanged` must never be relabelled as exact results.

`render-exact` carries `WormholeFrameIdentity`: contextId, generation, requestSerial, frameIndex,
fps and songTime = frameIndex/fps. `exact-frame` echoes it around the bitmap/focal/material/line/
spatial payload; `exact-error` echoes it with the failure. No preview lead or cadence applies.
All companions describe the same requested endpoint. Stale results are closed and returned,
and cannot clear or settle a newer request. At most one request or one result lease may exist
per exact context. Idempotent `release-exact` returns its shared material/line buffer only with
the matching identity. The worker does not write a leased buffer or render another exact frame
until released; the existing carrier pool still retains at most three returned buffers.

The adapter rejects on unsupported capability, preparation failure, supersession, cancellation,
render error or deadline. Cancellation/disposal/fatal error terminate its worker. A local exact
adapter is an explicit composition fallback and copies only valid carrier records into its one
lease. Neither adapter uses the live preview canvas. The canonical sampler replays private state
from song zero at fixed 60 Hz plus an exact fractional endpoint; it performs no analysis/planning
or per-request fetch. Replay cost is linear in song time; full export performance is a T19 gate.
See [ADR-011](../adr/ADR-011-shared-wormhole-frame-context.md) for the delivery limits.

## Analyzer Worker Structure

`src/audio/analyzer.worker.ts` keeps the worker boundary as a typed message contract, but the analysis implementation is no longer a monolithic `onmessage` function. The message handler is a thin boundary shell that forwards samples into `analyzeAudio()`, relays progress, and posts a typed success or failure payload. The analyzer core now runs as a data-oriented pipeline:

`SpectralCalibration -> FeatureExtractor -> GridAligner (TempoEstimator -> BeatTracker) -> FeatureNormalizer -> FeatureClassifier -> TemporalSmoother -> SectionAnalyzer -> DramaturgyBuilder / BeatEventClassifier -> SpectralPivot`.

Internal ownership:

- `SpectralCalibration` owns deterministic track-level pre-pass estimation of Hz band centers and safety-clamped band ranges, with default-band fallback for low-confidence input.
- `FeatureExtractor` owns sample-window processing, Hann-windowed FFT execution, RMS, spectral flux, Hz-based band ratios, centroid, flatness, pitch-confidence, Zero Crossing Rate, spectral rolloff, spectral crest arrays, and typical RMS/flux maxima.
- `GridAligner` is the single authoritative timing engine. It owns the onset-envelope-driven pipeline `TempoEstimator -> half/double resolution -> BeatTracker -> bar/downbeat alignment`, producing the legacy fields (BPM, tempo candidates, beat/bar length, `gridOffset`, BPM/grid/downbeat confidence) and the new model (`beats`, `barStarts`, `tempo`, `alternativeTempos`, unified `timingConfidence`). Half/double resolution uses three orthogonal cues: phase-invariant onset concentration, beat coverage (a true tempo populates most beats; its double leaves every other beat empty), and a kick-vs-snare downbeat score. A fast-tempo preference resolves toward the actual beat rate (e.g. drum & bass at ~174, not its 87 half-time feel) only when the fast grid is fully covered.
- `TempoEstimator` owns deterministic local autocorrelation/comb-filter tempo estimation (70-185 BPM): fixed 12-second windows / 6-second hop, locally normalized evidence, isolated-attack rejection and candidate consensus. `GridAligner` builds the tempo envelope from locally normalized raw band flux and resolves metric ambiguity on accepted active spans; silent track duration must not set beat coverage. Window evidence is internal DSP data, not a worker payload addition. See [Local percussive tempo estimation](../features/analyzer-local-tempo.md) for thresholds, limits and algorithm-version-3 behavior.
- `BeatTracker` owns Ellis-style dynamic-programming beat tracking. It intentionally extrapolates the grid through silent/breakdown regions to keep musical timing continuous.
- `FeatureNormalizer` owns allocation of normalized `Float32Array` views from raw analyzer arrays and precomputed typical maxima. It must not sort or recompute percentiles in the orchestration path.
- `LowFrequencyExtractor` owns fixed 20-60/60-180 Hz long-window body and positive-flux
  analysis, shared normalization/noise floors and offline clock-aligned smoothing. Version 4
  adds `subEnergy`, `bassEnergy`, `subFlux`, `bassFlux` to current AudioFrames and the worker
  schema. `normalizeAudioFrame` supplies bounded zero defaults for legacy/malformed values.
  This pass must not feed a second beat detector or repurpose display-spectrum normalization.
  See [Sub and bass response](../features/analyzer-low-frequency.md) for costs and limits.
- `FeatureClassifier` owns semantic frame scoring for melody, vocal, FX, density, brightness, and tension from normalized vectors and extracted DSP features such as ZCR, spectral crest, flatness, rolloff, and Hz band ratios. Melody and vocal are spectral heuristics, not stem separation.
- `TemporalSmoother` owns EMA smoothing for classifier outputs and starts from the first input value to avoid artificial fade-in at track start.
- `SectionAnalyzer` owns bar-block aggregation, adaptive threshold calculation, `BarAnalysis` output, section splitting, critically low tempo/grid energy-reactive boundary fallback, evidence-based section-label scoring, section RMS fields, and dominant-feature selection.
- `DramaturgyBuilder` owns visual cue emission, significant musical moment candidates, and recurring `MusicPattern` grouping from deterministic fuzzy section similarity.
- `BeatEventClassifier` owns accepted percussive event classification and the mapping from internal semantic hit kinds to the public `1 | 2 | 3` beat-event type contract. Visual beat `events` are derived from the authoritative `GridAligner.beats` gated by percussive onset/transient evidence from `FeatureExtractor`, not an independent raw-flux or bass peak-picker. Beats that the DP tracker extrapolated through silence carry no transient and must be suppressed as visual events (the grid still spans the silence), so breakdowns do not flood the renderer with phantom beat flashes. Sustained low-frequency energy alone must not continuously generate BeatEvents; bass may contribute only when paired with sharp attack/percussive onset evidence.
- `SpectralPivot` owns the offline buildup/LOW_DROP compensation pass and the absolute `sE <= 0.04` noise gate that zeroes delicate feature projections.

The worker must remain dependency-free from DOM, p5, `AudioEngine`, UI, renderer modules, and shared mutable runtime state. New analysis behavior should be added to the owning class above or to a similarly focused worker-internal class, not by growing the message handler.

Tempo confidence is part of the worker result contract, not UI-only metadata. Root `AnalysisResult` and nested `TrackAnalysis` payloads must both carry `bpmConfidence`, `gridConfidence`, `downbeatConfidence`, and `tempoCandidates`. If candidates exist, root `bpm` must equal `tempoCandidates[0].bpm`. Normalization for legacy or partial payloads must provide deterministic fallbacks: confidence values default to `0` and `tempoCandidates` defaults to an empty array.

The confidence fields are evidence signals with explicit limits. `bpmConfidence` must not be raised merely because the grid was derived from that same BPM estimate. Downbeat confidence must be capped by weak BPM/grid evidence. The current low-transient evidence cap is intentionally named and documented as kick-transient evidence; do not treat it as a universal rhythm-confidence measure for bass-light material, and do not apply it as a multiplier to timing-only grid confidence.

## Race Prevention

Every load creates a new current request id. A worker response may update state only when its request id equals the current request id.

When a new file is selected:

- Stop playback.
- Invalidate the previous request id.
- Terminate any active worker.
- Clear or quarantine old analysis results until the new result is accepted.
- Reset `State.trackAnalysis` from a fresh deep copy of the empty analysis template. Do not assign the empty template object by reference; nested arrays and objects must not be shared between track loads.

Stale success and stale failure messages must be ignored after worker cleanup.

`AudioEngine.clearAnalysisState()` currently enforces reset isolation with deep-copy serialization:

```ts
State.trackAnalysis = JSON.parse(JSON.stringify(EMPTY_TRACK_ANALYSIS));
```

This is part of the memory-management contract. The empty `TrackAnalysis` object graph contains nested structures, including trend data, and reusing those object references can pollute later loads or make stale state appear current.

## Transfer And Copy Policy

Choose one intentionally:

- Copy sample data before posting to the worker when playback still depends on the source buffer.
- Transfer sample data only when the sender no longer needs the transferred buffer.

Do not pass `getChannelData(0).buffer` as a transferable unless playback safety has been proven and documented.

When the playback path still needs the decoded `AudioBuffer`, the default implementation policy is:

- Allocate a new `Float32Array` with the same length as the source channel.
- Copy channel data with `analysisSamples.set(channelData)`.
- Transfer only `analysisSamples.buffer` to the worker.
- Keep the decoded `AudioBuffer` owned by `AudioEngine` for playback.

## Deterministic Output

For the same input samples, sample rate, and algorithm version, worker output must be deterministic. Avoid nondeterministic time, random values, shared mutable globals, and environment-dependent thresholds.

When recurring temporal patterns are emitted, they must be derived from deterministic full-track features. The current implementation groups sections by Euclidean distance over energy, density, and dominant-feature evidence rather than exact string signatures. Pattern ids must be stable for one accepted worker result and must be referenced by cue events through optional `patternId` fields.

Tempo candidates must also be deterministic over the 70-185 BPM range. Half/double-time resolution may reorder only close-score aliases such as 85/170, 64/128, or 88/176; it must not hide a clearly dominant candidate. The fast-tempo preference only applies when the faster grid is genuinely fully covered, so a true slow track (e.g. 70 BPM, whose 140 double leaves every other beat empty) stays slow, while drum & bass at 174-185 locks the full beat rate instead of its half-time feel. Negative fixtures such as ambient, noise, spoken material, random clicks, and sparse one- or two-onset input should keep BPM/grid/downbeat confidence low.

## Termination And Errors

Workers must terminate on:

- Successful accepted result.
- Analysis error.
- User cancellation or superseded load.
- Component teardown.

Worker errors must restore UI control state through the audio/UI boundary and must not leave playback controls permanently disabled.

If worker errors, stale worker messages, or cancellation paths are changed, add or update a targeted regression test covering the boundary contract.

## Canvas-free native preview worker (T06c2)

Native geometry has its own protocol v1 in `WormholeNativeWorkerProtocol`, independent of raster
preview v1 and exact v2. `WormholeNativeWorkerSource` prefers a module worker without requiring
OffscreenCanvas. The worker calls the unchanged private native producer; Three/GPU stays in XR.
Analysis/seed/presentation are copied; only one fixed output ArrayBuffer is transferred. The host
copies active ranges into alternating pending/presented banks, returns the lease once, then sends
the latest next request. Never write a leased buffer or detach a displayed bank.

One render in flight plus one overwritten desired request. Match generation, serial, presentation
revision, continuity epoch and song time; seek/pause/settings invalidate old pending work. Adopt
focal/spatial companions with the displayed frame. Host wall time only classifies continuity;
caller song time owns geometry. This channel adds no lead or exact-replay claim.

Terminate/restart on prepare, failure and dispose. Startup/render deadlines trigger the retained
main-thread native fallback, exposed in diagnostics. Background off pauses requests and keeps the
idle worker; quality/mode rebuild and teardown dispose it. Existing technical main-thread debug
URL applies; no new player setting. See [contract](../audits/xr-native-worker-contract.md).

T06d additive native v1 cosmos: optional cosmosCount and cosmosBuffer appear together; fixed 308352 bytes (4818 segments). Original bank size/layout remains unchanged. Validate the pair before adoption, copy both active ranges into one pending bank, then return both buffers under the same request lease even when matching work is stale. Missing extension means zero cosmic instances. Partial presentation.cosmos merges and invalidates pending work through the existing revision. See [cosmic contract](../audits/xr-native-cosmos-contract.md).

T06e additive native v1 wall: optional wallCount/wallBuffer must appear together; fixed 204800 bytes (3200 records, 16 floats). It shares the original request lease with primary and cosmos. Validate pair/count/size, copy active ranges into the same pending main bank, then return every leased buffer once, including stale work. Off omits the wall pair and clears instances. Wall presentation revisions use existing latest-request/stale guards; original primary/cosmos byte sizes and exact/raster protocol stay unchanged. See [wall contract](../audits/xr-native-wall-contract.md).

## MVP resolved-frame preview worker

The opt-in `offscreen` renderer (fresh MVP default) uses `WormholeHostFrame` and
`wormholeHostRender.worker.ts`. It reuses the XR identity, WebGL/Canvas2D backends and
OffscreenCanvas → transferable ImageBitmap approach. It does not run the XR plan adapter:
the MVP remains the single preset/semantic/director/gain owner and sends already resolved
controls plus the authoritative song time. Identity geometry, material accumulation/weave,
resolve, pixel conversion, raster and bitmap creation all execute inside the worker.

An immutable analysis publication is structured-cloned once per load; ordinary frames carry
only small resolved input records. No playback buffer is transferred. One render may be in
flight, with no queued render backlog. Playing requests are capped at 30 Hz, backing long edge
960 (Reduced 640). Every seek/reset, load or incompatible resize invalidates generations and
closes the shown bitmap; stale replies are closed. A settled paused frame is not requested again.
Prepare/render have 15 s failure deadlines. Errors/messageerror/timeouts terminate the worker
and use Compatible until the user changes the renderer or recreates the host. Worker WebGL
unavailability uses Offscreen Canvas2D; other failures use the main compatible path.

The p5 host composites one bitmap and runs the existing PostFX seam once. Export bypasses this
asynchronous preview entirely, uses the full-resolution synchronous Compatible renderer and
releases the preview worker. Switching away/removing the renderer also terminates it. This is
live-preview infrastructure, not T19 isolated export or a guarantee of headset frame rate.


## T11f additive attack-local change evidence

`trackAnalysis.musicActivity.attackChanges` is optional and does not change the worker request
or root event/chart contract. Algorithm `attack-local-excess-v1` measures two real PCM windows
per accepted legacy energy attack with one reusable <=512 FFT. Full-track publication, exact
attack-ID/order/count binding, deterministic clock-derived supports and explicit boundary/
resolution/below-floor statuses are validated by `normalizeAcousticActivity` before adoption.

Continuous positive spectral power, fraction and strongest-bin neighborhood share are engineering
measurements, never source ownership, percussive/tonal recognition, confidence or scoring input.
The inherited `attack.family` remains a longer context texture. No quiet-entry coverage or onset
localization correction is implied. No renderer consumes or recomputes these transforms; the
payload is cloned once with the analyzer result to the main host. The four MVP/XR render-worker
proxies omit the unused `musicActivity` tree only in prepare messages through
`projectRenderWorkerAnalysis`; authoritative host analysis, cache keys, plan-only updates and
main fallback input stay intact. Render-frame messages do not carry this evidence.
See the [T11f contract](../features/music-events.md#t11f---attack-local-positive-spectral-change-2026-10-25).


## T11g optional quiet-prefix crossing

`musicActivity.attacks[].quietOnset` is an optional, attack-associated engineering measurement,
algorithm `quiet-prefix-energy-v1`. Complete quiet prefix and full triggering frame are required;
the initial short prefix window must also be below threshold. Prefix-mean trailing energy yields
the first above-threshold sample and its exact observed support. Publication remains full-track.
The normalizer validates clock/support/threshold/ranges and rejects unknown keys, then explicitly
clones permitted fields. Parent null confidence/signal-only/scoring-ineligible policy applies.
No legacy time/chart change, new sound-family claim, FFT or render message is introduced. Missing
measurement is unavailable evidence; support is not a physical-onset confidence interval.
See the [T11g contract](../features/music-events.md#t11g---quiet-prefix-energy-crossing-2026-10-25).


## T11h short-spectrum versioned anchoring

The producer emits `musicActivity.attackChanges.algorithm = attack-local-excess-v2`, preferring
the existing qualified `quietOnset.sampleIndex` for short-spectrum support, otherwise using the
legacy attack sample. IDs still associate to historical attacks. Unavailable support at the
selected anchor abstains; it never silently reanchors. Normalization first validates the quiet
measurement, then binds v2 support to that selected sample. Legacy `attack-local-excess-v1`
always uses the legacy sample and remains accepted by normalization and the strict result schema.
No new field, message, chart eligibility, player switch or render-time processing is added.
See [T11h contract](../features/music-events.md#t11h---crossing-anchored-short-spectral-change-2026-10-25).


T11i quiet-carrier qualification lives only in the analyzer-lab diagnostic runner. Its research
records are not part of TrackAnalysis, requests, responses or render prepare messages. A
synthetic qualification gate does not authorize chart promotion or transport-schema expansion.
Current browser publication and render projection remain T11h unchanged; see the
[T11i research scope](../features/music-events.md#t11i---frozen-quiet-carrier-qualification-study-2026-10-25).
