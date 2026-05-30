# Worker Immutability Audit

## Previous Behavior

`PlexusRenderer.publishCurrentAnalysisFrame()` assigned accepted worker result objects directly into render-facing state:

- `State.currentFrame = State.frames[frameIdx]`
- `State.currentFeatures = State.trackAnalysis.features[frameIdx]`

When playback was paused or stopped, `decayCurrentAnalysisFrame()` multiplied numeric fields on `State.currentFrame` and `State.currentFeatures` by `0.9`. Because those state fields could reference objects inside accepted worker output arrays, the renderer could mutate `State.frames[]` and `State.trackAnalysis.features[]`.

The playback-ended listener also wrote `State.currentFrame.state = 'IDLE'`, which had the same risk when `State.currentFrame` referenced an accepted worker frame.

## Violation Points

- `State.currentFrame` could alias an object from `State.frames`.
- `State.currentFeatures` could alias an object from `State.trackAnalysis.features`.
- `decayCurrentAnalysisFrame()` mutated `State.currentFrame` and `State.currentFeatures`.
- Playback end mutated `State.currentFrame.state`.

No worker schema or analysis algorithm changes were required. The violation was in renderer ownership of mutable live state.

## Fixes Implemented

- `publishCurrentAnalysisFrame()` now copies accepted worker frame values into the existing renderer-owned `State.currentFrame` object.
- `publishCurrentAnalysisFrame()` now copies accepted worker feature values into the existing renderer-owned `State.currentFeatures` object.
- `decayCurrentAnalysisFrame()` still mutates the render copies, preserving dashboard and visual behavior without touching accepted worker output arrays.
- A contract test now checks that renderer publication uses copy helpers and does not directly assign accepted worker frame/feature objects into mutable state.

## Residual Risks

- `State.frames`, `State.events`, and `State.trackAnalysis` are not deeply frozen at runtime. The current fix removes the known renderer mutation path, but future code could still mutate accepted worker result arrays unless guarded by tests or explicit immutable types.
- `AudioEngine.normalizeTrackAnalysis()` normalizes accepted track analysis by creating replacement bar and section objects, but it still passes through arrays such as `features`, `patterns`, `cues`, and `buildupConfidence` by reference. This is acceptable for the current fix because inspected consumers read them, but it is not a hard runtime immutability boundary.
- `State.currentFrame` and `State.currentFeatures` remain mutable by design as renderer-owned live copies. Their values should not be treated as source analysis truth.
