// Centralized provisional gameplay tuning constants (ADR-009). These are a first-pass
// tuning baseline, not final game design.

import type { RhythmHand } from './RhythmTypes';

export interface RhythmGameConfig {
    /** Lane count. The MVP uses three: left, center, right. */
    readonly laneCount: number;
    /** Seconds a note takes to travel from spawn to the hit plane. */
    readonly approachTimeSec: number;
    /** Symmetric timing window for a "perfect" grade, in seconds. */
    readonly perfectWindowSec: number;
    /** Symmetric timing window for a "good" grade, in seconds. */
    readonly goodWindowSec: number;
    /** Beyond this offset (either direction) a note can no longer be struck. */
    readonly missWindowSec: number;
    /** Spatial hit-detection radius around a note's target position, in meters. */
    readonly hitRadiusMeters: number;
    /** Minimum controller speed (m/s) required for a strike to register. */
    readonly minStrikeSpeedMps: number;
    /** Minimum in-plane blade travel speed (m/s) for a directional (arrow) cut. */
    readonly minCutSpeedMps: number;
    /** Half-angle of the accepted cone around an arrow direction, in degrees. */
    readonly cutConeDegrees: number;
    /** Minimum spacing between any two consecutive notes, in seconds. */
    readonly minGlobalNoteSpacingSec: number;
    /** Minimum spacing between two consecutive notes assigned the same hand. */
    readonly minSameHandSpacingSec: number;
    /** Notes below this normalized intensity [0,1] are dropped during chart construction. */
    readonly intensityFloor: number;
    /** Upper bound on notes considered "active" (visible/tracked) at once. */
    readonly maxActiveNotes: number;
    readonly maxHandTravelMps: number;
    readonly noteSpeedMps: number;
    readonly noteSizeMeters: number;
    readonly rowSpacingMeters: number;
    readonly resolvedNoteLifetimeSec: number;
}

export const DEFAULT_RHYTHM_GAME_CONFIG: RhythmGameConfig = {
    laneCount: 3,
    approachTimeSec: 2.0,
    perfectWindowSec: 0.08,
    goodWindowSec: 0.11,
    missWindowSec: 0.16,
    hitRadiusMeters: 0.22,
    minStrikeSpeedMps: 0.6,
    minCutSpeedMps: 0.2,
    cutConeDegrees: 50,
    minGlobalNoteSpacingSec: 0.25,
    minSameHandSpacingSec: 0.4,
    intensityFloor: 0.12,
    maxActiveNotes: 64,
    maxHandTravelMps: 1.2,
    noteSpeedMps: 4,
    noteSizeMeters: 0.32,
    rowSpacingMeters: 0.34,
    resolvedNoteLifetimeSec: 0.22
};

interface RhythmHandByLane {
    readonly lane: number;
    readonly hand: RhythmHand;
    readonly xOffsetMeters: number;
}

/** Lane -> world-space horizontal offset (meters) and required hand, MVP fixed layout. */
export const LANE_HAND: readonly RhythmHandByLane[] = [
    { lane: 0, hand: 'left', xOffsetMeters: -0.45 },
    { lane: 1, hand: 'either', xOffsetMeters: 0 },
    { lane: 2, hand: 'right', xOffsetMeters: 0.45 }
];
