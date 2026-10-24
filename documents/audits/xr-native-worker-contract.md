# T06c2: canvas-free native geometry worker

Single integration owner: this chat. Owners: shared transport types, visuals worker/source adapter,
XR consumer wakeups/diagnostics and composition. User accepted T06c after reporting Quest native
main-thread stutter. No audio/analyzer/judge changes, no new artistic setting or dependency.

Before implementation: use the same private native source in a module Worker; keep all Three/GPU
work in XR. Capability does not depend on OffscreenCanvas. Prefer worker automatically; retain
native main-thread fallback for unsupported/startup/error/timeout cases. Existing technical
`xrBackgroundThread=main` forces main for A/B; no new switch or storage schema. Hybrid stays default.

Independent protocol v1, not the raster v1/exact v2 channel. Every operation identifies preparation
generation and request serial; render also identifies presentation revision, continuity epoch,
caller song time, playing and host-classified continuity. Restart/terminate on prepare, dispose,
failure and fallback. Analysis/seed/presentation are structured-cloned, never transferred or mutated.

Backpressure: one render in flight plus one latest desired request, overwritten instead of queued.
Pause/seek/presentation changes invalidate pending/older results. A stale response cannot clear a
newer request. One fixed 437760-byte transferable worker output buffer; worker retains its own
native simulation packet. Main copies only active ranges into one of two fixed host banks, then
returns the transferred buffer exactly once before dispatching the next request. The worker never
writes a leased buffer. Main banks alternate pending/presented ownership, preserving the borrowed
frame until the next accepted render/prepare/dispose. Focal/spatial companions switch with that
frame, never independently at message arrival. Empty/unchanged responses acknowledge the request.

Bounded startup/render deadlines (15 s / 5 s) terminate a stuck worker and prepare the retained
native main-thread fallback; failure and execution location are visible in diagnostics. Worker
results wake a paused/idle desktop renderer without doing geometry work in the callback. This is
preview sampling, not an exact offline sampler; no lead/extrapolated song clock is introduced.

Preserve full authored producer geometry in this slice. Quality still caps consumer instances/fill;
dropping producer neighbours would change preset character and is deferred until measured policy.
Worker moves CPU cost, not GPU fill/upload cost. Validate transfer ownership, cloning, coalescing,
out-of-order/stale identity, seek/pause/settings, restart/disposal/deadline/fallback and real local vs
worker packet/pixel parity, plus a desktop CPU profile. Physical Quest frame pacing remains manual;
no device speedup guarantee. Deploy and stop for feedback before T06d stars or another task.
