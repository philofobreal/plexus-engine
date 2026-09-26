// One spatial contract for both rendering and judging, in meters relative to the hit plane.
import { DEFAULT_RHYTHM_GAME_CONFIG, LANE_HAND, type RhythmGameConfig } from './RhythmGameConfig';
import type { RhythmNote, Vector3Like } from './RhythmTypes';

export function notePosition(note: RhythmNote, songTime: number, target: Vector3Like,
    config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG): Vector3Like {
    target.x = note.xOffsetMeters ?? (LANE_HAND[note.lane] ?? LANE_HAND[1]).xOffsetMeters;
    target.y = ((note.row ?? 1) - 1) * config.rowSpacingMeters;
    // Continue through the hit plane; never pin overdue blocks in front of the player.
    target.z = (songTime - note.time) * config.noteSpeedMps;
    return target;
}
