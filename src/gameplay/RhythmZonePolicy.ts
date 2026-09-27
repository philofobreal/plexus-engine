// Pure, deterministic zone preference for one single target (ADR-009). Decides whether a saber's
// target stays in its own half, moves to the shared center lane, or crosses into the other half.
// The user's Zones setting bounds what is allowed; musical context (texture energy, onset strength,
// movement gesture, phrase position) decides when it happens; Difficulty scales how often crossings
// are offered. Physical safety (the other hand resting, reach, center exclusivity) is enforced by
// the score planner, which walks this preference list and takes the first feasible zone.

import type { MovementGesture } from '../types';
import type { HandZones } from './RhythmGenerationProfile';
import { hash01 } from './RhythmHandPolicy';
import type { RhythmTexture } from './RhythmTypes';

export type TargetZone = 'own' | 'center' | 'cross';

/** How physically energetic a texture is; drives how much the space opens up. */
const TEXTURE_DRIVE: Record<RhythmTexture, number> = {
    breath: 0.15, echo: 0.45, pulse: 0.4, weave: 0.75, drive: 0.7, build: 0.4, impact: 1
};
/** Sweeping/fragmenting gestures invite crossings; locked/fading ones keep the halves apart. */
const CROSS_GESTURE: Partial<Record<MovementGesture, number>> = {
    slice: 1.4, fragment: 1.4, orbit: 1.4, swarm: 1.4, ripple: 1.3, lock: 0.4, pulse: 0.5, fade: 0.4, collapse: 0.4
};
/** Narrow-corridor gestures gather targets toward the center; expanding ones push them outward. */
const CENTER_GESTURE: Partial<Record<MovementGesture, number>> = {
    tunnel: 1.5, drive: 1.5, lock: 1.4, pulse: 1.2, expand: 0.6, bloom: 0.6
};

export interface ZoneContext {
    readonly zones: HandZones;
    /** Difficulty multiplier on crossing propensity. */
    readonly crossRate: number;
    readonly eventIndex: number;
    readonly texture: RhythmTexture;
    /** Normalized automation behaviour energy [0, 1]. */
    readonly energy: number;
    /** Onset at or above its phrase's median intensity. */
    readonly strong: boolean;
    readonly gesture?: MovementGesture;
    /** Beats since the active automation point began (a new scene first establishes itself). */
    readonly beatsIntoScene: number;
    /** Inside the last bar of the phrase (a fill). */
    readonly fill: boolean;
}

/** Musical drive in [0, 1]: texture energy, softened for weaker onsets. */
export function musicalDrive(texture: RhythmTexture, energy: number, strong: boolean): number {
    const base = texture === 'build' ? TEXTURE_DRIVE.build + 0.5 * Math.min(1, Math.max(0, energy)) : TEXTURE_DRIVE[texture];
    return Math.min(1, base) * (strong ? 1 : 0.55);
}

/** Crossing and center propensities for this onset (0 when the setting forbids them). */
export function zonePropensity(context: ZoneContext): { cross: number; center: number } {
    if (context.zones === 'split' || context.beatsIntoScene < 4) return { cross: 0, center: 0 };
    const drive = musicalDrive(context.texture, context.energy, context.strong);
    const gestureCross = context.gesture ? CROSS_GESTURE[context.gesture] ?? 1 : 1;
    const gestureCenter = context.gesture ? CENTER_GESTURE[context.gesture] ?? 1 : 1;
    const cross = context.zones === 'cross'
        ? Math.min(0.6, 0.3 * context.crossRate * drive * gestureCross * (context.fill ? 1.5 : 1)) : 0;
    const center = Math.min(0.5, 0.28 * gestureCenter * (0.5 + 0.5 * drive));
    return { cross, center };
}

/** Ordered zone preference; the planner falls back along it when a zone is physically unsafe. */
export function zonePreference(context: ZoneContext): readonly TargetZone[] {
    const { cross, center } = zonePropensity(context);
    if (cross === 0 && center === 0) return OWN;
    const roll = hash01(context.eventIndex, 7919);
    if (roll < cross) return CROSS_FIRST;
    if (roll < cross + center) return CENTER_FIRST;
    return OWN;
}

const OWN: readonly TargetZone[] = ['own'];
const CENTER_FIRST: readonly TargetZone[] = ['center', 'own'];
const CROSS_FIRST: readonly TargetZone[] = ['cross', 'center', 'own'];
