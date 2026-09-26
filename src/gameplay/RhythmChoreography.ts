import type { AutomationSituation, MovementGesture, PerformanceAutomationMeta } from '../types';
import { DEFAULT_RHYTHM_GAME_CONFIG, type RhythmGameConfig } from './RhythmGameConfig';
import type { CutDirection, RhythmTexture } from './RhythmTypes';

export const CUT_VECTORS: Readonly<Record<Exclude<CutDirection, 'any'>, readonly [number, number]>> = {
    up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0],
    'up-left': [-Math.SQRT1_2, Math.SQRT1_2], 'up-right': [Math.SQRT1_2, Math.SQRT1_2],
    'down-left': [-Math.SQRT1_2, -Math.SQRT1_2], 'down-right': [Math.SQRT1_2, -Math.SQRT1_2]
};

// Typed against the Visual OS unions, so a vocabulary rename fails type checking instead of
// silently falling back to 'pulse'.
const BREATH_SITUATIONS: ReadonlySet<AutomationSituation> =
    new Set(['intro-establish', 'breakdown-long', 'transition-release', 'outro-dissolve']);
const IMPACT_SITUATIONS: ReadonlySet<AutomationSituation> =
    new Set(['drop-short', 'drop-long', 'drop-after-build', 'peak-sustain']);
const WEAVE_GESTURES: ReadonlySet<MovementGesture> = new Set(['orbit', 'ripple', 'swarm']);
const DRIVE_GESTURES: ReadonlySet<MovementGesture> = new Set(['drive', 'tunnel', 'slice', 'fragment']);

/** Texture FAMILY: translate published Visual OS meaning, never preset names or raw audio, into
 * motor vocabulary. */
export function rhythmTexture(meta?: PerformanceAutomationMeta): RhythmTexture {
    if (!meta) return 'pulse';
    const situation = meta.automationSituation;
    const gesture = meta.movementGesture;
    if (meta.variantRole === 'release' || meta.variantRole === 'sparse' || meta.globalArcRole === 'resolution' ||
        (situation !== undefined && BREATH_SITUATIONS.has(situation))) return 'breath';
    if (situation === 'buildup-ramp') return 'build';
    if (meta.variantRole === 'secondary' || gesture === 'echo') return 'echo';
    if (situation !== undefined && IMPACT_SITUATIONS.has(situation)) return 'impact';
    if ((gesture !== undefined && WEAVE_GESTURES.has(gesture)) || meta.motif === 'orbit-system') return 'weave';
    if ((gesture !== undefined && DRIVE_GESTURES.has(gesture)) || meta.motif === 'tunnel-drive') return 'drive';
    return 'pulse';
}

/** ENTRY texture inside the family chosen by `rhythmTexture`. Deliberately a separate mapping:
 * a gesture may enter on a different member of its family (e.g. fragment belongs to the drive
 * family but enters on its impact member when that family offers it). */
export const GESTURE_ENTRY_TEXTURE: Readonly<Partial<Record<MovementGesture, RhythmTexture>>> = {
    orbit: 'weave', ripple: 'echo', swarm: 'weave',
    drive: 'drive', tunnel: 'drive', slice: 'drive', fragment: 'impact', pulse: 'pulse',
    echo: 'echo', bloom: 'weave', expand: 'impact', collapse: 'breath', fade: 'breath', lock: 'pulse'
};

export function matchesCut(direction: CutDirection | undefined, dx: number, dy: number, sampleDeltaSec: number,
    config: RhythmGameConfig = DEFAULT_RHYTHM_GAME_CONFIG): boolean {
    if (!direction || direction === 'any') return true;
    const vector = CUT_VECTORS[direction];
    const length = Math.hypot(dx, dy);
    // Cone around the arrow, with a minimum amount of actual blade travel in the target plane.
    // Scale by the sample interval so 72/90/120 Hz headsets have the same threshold.
    // The note's incoming Z motion must never manufacture a directional cut.
    return length >= Math.max(0.00001, sampleDeltaSec * config.minCutSpeedMps) &&
        (dx * vector[0] + dy * vector[1]) / length >= Math.cos(config.cutConeDegrees * Math.PI / 180);
}
