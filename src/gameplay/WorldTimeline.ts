// Pure time lookups over a World Plan (ADR-010). Every function is a function of the plan and a
// canonical song time, so pausing freezes the world and a seek lands on the exact authored state
// without replaying frames. Allocation-free where called per frame (`characterAt` writes `out`).

import type { WorldCharacterMix, WorldEncounterStage, WorldEra, WorldPhase, WorldPlan } from './WorldTypes';

/** Mutable twin of `WorldCharacterMix` for per-frame output. */
export interface MutableWorldCharacter {
    industry: number;
    construction: number;
    lattice: number;
    flow: number;
    anomaly: number;
}

export const smoothstep01 = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Index of the last element whose `key` is <= time (-1 before the first). */
export function lastIndexAtOrBefore<T>(items: readonly T[], time: number, key: (item: T) => number): number {
    let lo = 0, hi = items.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (key(items[mid]) <= time) lo = mid + 1; else hi = mid; }
    return lo - 1;
}

export function phaseIndexAt(plan: WorldPlan, time: number): number {
    if (!plan.phases.length) return -1;
    return Math.max(0, lastIndexAtOrBefore(plan.phases, time, phase => phase.start));
}

export function phaseAt(plan: WorldPlan, time: number): WorldPhase | null {
    const index = phaseIndexAt(plan, time);
    return index < 0 ? null : plan.phases[index];
}

export function eraAt(plan: WorldPlan, time: number): WorldEra {
    const index = lastIndexAtOrBefore(plan.eras, time, era => era.start);
    return index < 0 ? 'localhost' : plan.eras[index].era;
}

function lerpMix(out: MutableWorldCharacter, a: WorldCharacterMix, b: WorldCharacterMix, t: number): MutableWorldCharacter {
    out.industry = a.industry + (b.industry - a.industry) * t;
    out.construction = a.construction + (b.construction - a.construction) * t;
    out.lattice = a.lattice + (b.lattice - a.lattice) * t;
    out.flow = a.flow + (b.flow - a.flow) * t;
    out.anomaly = a.anomaly + (b.anomaly - a.anomaly) * t;
    return out;
}

/**
 * Visual character at a song time: the current phase's target, crossfaded from the previous
 * phase's over the phase's transition (smoothstep). Before the first phase, the first target.
 */
export function characterAt(plan: WorldPlan, time: number, out: MutableWorldCharacter): MutableWorldCharacter {
    const index = phaseIndexAt(plan, time);
    if (index < 0) { out.industry = 0; out.construction = 0; out.lattice = 0; out.flow = 0; out.anomaly = 0; return out; }
    const phase = plan.phases[index];
    if (index === 0 || phase.transitionSec <= 0) return lerpMix(out, phase.character, phase.character, 0);
    const t = smoothstep01((time - phase.start) / phase.transitionSec);
    return lerpMix(out, plan.phases[index - 1].character, phase.character, t);
}

/** Encounter stage at a song time, or null outside the encounter (or without one). */
export function encounterStageAt(plan: WorldPlan, time: number): WorldEncounterStage | null {
    const e = plan.encounter;
    if (!e || !(time >= e.detectionStart) || time >= e.resolutionEnd) return null;
    return time < e.syncStart ? 'detection' : time < e.syncEnd ? 'synchronization' : 'resolution';
}
