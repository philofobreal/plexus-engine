# ADR-004: Visual Score DSL and Semantic Integration

## Status

Proposed - runtime consumer implemented behind a disabled feature flag

## Context

Plexus Engine needs a representation for long-term visual choreography that is deterministic, style-independent, and decoupled from raw audio analysis.

## Decision

- **DSL format:** Object-driven, JSON-serializable, and time-based (`timeSec`).
- **Pure output semantics:** `SemanticResolver.resolve()` is deterministic and has no external side effects. Mutation of its private cursor is allowed only as an indexed lookup cache and must never affect the resolved value for the same plan and `timeSec`.
- **External payload validation:** `SemanticResolver.setPlan()` MUST validate and snapshot the complete external plan shape. Only version `1.0` is accepted. Missing arrays, malformed frames, non-finite values, invalid enum members, and plans above `100000` frames reject the plan atomically and leave the resolver inactive.
- **Adapter pattern:** `SemanticRuntimeAdapter` is the exclusive ADR-004 authority that writes to `State.targetTuning`.
- **Interpolation:** Numeric actions and motion parameters are linearly interpolated between frames unless the transition is `CUT`.
- **Frame lifetime:** A frame is active in `[timeSec, timeSec + durationSec)`, capped by the next frame's `timeSec`. Gaps have no active ADR-004 frame, and the last frame does not hold beyond its declared duration.
- **Transition window:** A non-`CUT` transition progresses from the current frame toward the next frame over `transition.durationSec`, measured from the current frame's `timeSec`. Once complete, the resolved next values are sustained only for the remainder of the current frame's active lifetime.
- **Discrete transition policy:** During an incomplete non-`CUT` transition, mapper input uses the current frame's `narrativeState` and `primaryPattern`. At progress `1`, these discrete fields switch to the next frame together with the fully resolved numeric target. A `CUT` switches only at the next frame boundary.
- **CUT boundary:** A `CUT` holds the current frame without interpolation and switches when the next frame's `timeSec` becomes active.
- **Zero-default policy:** Missing actions in a frame are resolved as `0.0`.
- **Clamp policy:** Every value written to `State.targetTuning` is clamped to the corresponding `visualTuningControls` bounds.
- **Ownership reset:** The adapter rematerializes every tuning key it has claimed as `base[key] + (delta[key] ?? 0)` on each update. Missing deltas, inactive frame gaps, expired final frames, and plan removal restore those keys to base instead of retaining stale values.
- **Invalid-time policy:** `NaN` or infinity passed as `timeSec` returns `null`; resolution never throws for invalid time.
- **Authority:** `SemanticResolver` owns deterministic output resolution with an internal cursor cache; `SemanticRuntimeAdapter` owns the state-write boundary.
- **Separation:** `VisualDirectorFSM` owns fast modulation. `SemanticResolver` owns pure time-based `VisualScorePlan` resolution. Narrative intent remains producer-side and is not implemented in this phase.

The active ADR-003 motif pipeline remains available alongside ADR-004. Its `Motif*` contracts distinguish motif-based plans from ADR-004 time-based frames. It does not change the ADR-004 DSL or permit the new resolver to write to modulation or director output.

## Implementation Notes

**Note:** This PR implements the ADR-004 runtime consumer and state-write boundary. No default producer (analyzer stage) is included in this phase. `TrackAnalysis.externalVisualScorePlan` is an optional pass-through slot for an imported plan and is never populated by the analyzer core. The system falls back to ADR-003 or legacy automation if no external plan is provided.
