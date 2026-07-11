// Automation-only lower bound for large wormhole preset changes. This stays pure so the same
// plan and preset values produce the same effective morph timing during playback and export.
export const WORMHOLE_MORPH_FLOOR_CAP = 4.0;

const SPEED_DELTA_SECONDS = 0.15;
const BEND_DELTA_SECONDS = 1.6;

export function wormholeMorphDurationFloor(deltaSpeed: number, deltaBend: number): number {
    const speed = Number.isFinite(deltaSpeed) ? Math.abs(deltaSpeed) : 0;
    const bend = Number.isFinite(deltaBend) ? Math.abs(deltaBend) : 0;
    return Math.min(WORMHOLE_MORPH_FLOOR_CAP, Math.max(0, SPEED_DELTA_SECONDS * speed + BEND_DELTA_SECONDS * bend));
}
