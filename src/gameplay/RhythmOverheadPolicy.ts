// Overhead row for the Tall play space (ADR-009 Addendum M). Pure, deterministic re-voicing of a
// finished chart: a few targets on big musical moments move up to the overhead row (row 3) so the
// player really reaches up and chops down. Timing, hands, lanes and cuts never change -- only the
// row. The one exception is the mandatory rest: same-hand single targets inside it are left out
// (at most `MAX_REST_DROPS`, plus the one after them when cut parity would otherwise break), and only
// if the sequence after them still keeps parity and reach; everything else stays exactly what the
// score planner decided.
//
// A target is lifted only when the music justifies it and the body can do it comfortably:
// - big moment: a drop / peak scene or the top of a build (the Visual OS meaning of the scene, not
//   the texture the phrase developed into), an onset at or above its phrase's median on a beat (or
//   in the phrase's top quarter when the grid is unreliable). Any beat, not only beats 1 and 3: an
//   analyzer's downbeat can be a beat off, and the spacing rules below already keep it rare;
// - an overhead chop: a downward (or free) cut, never in the center lane (the incoming view);
// - rare: one bar between any two overhead moments, two bars for the same hand;
// - preparation and a mandatory rest: the same hand is free before it, and rests after it;
// - reachable: hand travel and row steps stay inside the difficulty's envelope. A cut carries the
//   blade one row along its direction (`OVERHEAD_STROKE_ROWS`): an upward cut just before ends high,
//   and the overhead chop itself ends a row lower, so the hand travels less than target to target.
//   After a long rest (`LONG_REST_SEC`, where the planner also resets cut parity) only travel counts.
// - both hands overhead together only on a horizontal accent pair at Hard and above.

import type { RhythmDifficultyProfile } from './RhythmGenerationProfile';
import { LANE_HAND } from './RhythmGameConfig';
import { CUT_VECTORS } from './RhythmChoreography';
import type { CutDirection, RhythmNote } from './RhythmTypes';

/** Row index of the overhead row (rows 0..2 are the standard low / middle / high rows). */
export const OVERHEAD_ROW = 3;
/** Free time the hand needs before an overhead target, in seconds (at least the same-hand floor). */
export const OVERHEAD_PREP_SEC = 0.5;
/** Mandatory rest of the same hand after an overhead target, in seconds (at least one beat). */
export const OVERHEAD_REST_SEC = 0.75;
/** Two-hand overhead accents need an onset in the phrase's top quarter. */
const ACCENT_QUANTILE = 0.75;
/** Beats between two overhead moments of the same hand, and of any hand. */
const HAND_SPACING_BEATS = 8;
const SPACING_BEATS = 4;
/** Same-hand targets that may be left out after one overhead target to make its rest. */
export const MAX_REST_DROPS = 2;
/** Same-hand gap after which the hand is free to reposition (the planner's parity reset). */
export const LONG_REST_SEC = 1.5;
/** Rows a directional cut carries the blade along its direction (the stroke itself). */
export const OVERHEAD_STROKE_ROWS = 1;

const DOWN_CUTS: ReadonlySet<CutDirection> = new Set(['down', 'down-left', 'down-right', 'any']);
const UP_CUTS: ReadonlySet<CutDirection> = new Set(['up', 'up-left', 'up-right']);

export interface OverheadContext {
    readonly demand: RhythmDifficultyProfile;
    readonly minSameHandSpacingSec: number;
    readonly maxHandTravelMps: number;
    readonly rowSpacingMeters: number;
    /** Trusted beat grid (strong-beat test) or not (intensity test only). */
    readonly reliable: boolean;
    /** Whether the scene at a song time is a big moment (drop / peak, or the top of a build). */
    bigScene(time: number): boolean;
    /** Position inside the bar in beats [0, 4) and the local beat length, both at a song time. */
    beatPhase(time: number): number;
    beatSec(time: number): number;
}

const xOf = (note: RhythmNote) => note.xOffsetMeters ?? LANE_HAND[note.lane].xOffsetMeters;
type Hand = 'left' | 'right';

/**
 * Rows the hand really travels between a same-hand neighbour and an overhead target: the row
 * difference, minus one stroke when the cut between them already moves the blade that way (an
 * upward cut before the target, the overhead's own downward chop after it).
 */
export function overheadMoveRows(neighbour: RhythmNote, overhead: RhythmNote, neighbourBefore: boolean): number {
    const carried = neighbourBefore
        ? neighbour.cutDirection !== undefined && UP_CUTS.has(neighbour.cutDirection)
        : overhead.cutDirection !== undefined && overhead.cutDirection !== 'any' && DOWN_CUTS.has(overhead.cutDirection);
    return Math.max(0, OVERHEAD_ROW - neighbour.row - (carried ? OVERHEAD_STROKE_ROWS : 0));
}

/** Per-phrase intensity quantiles of the chart's own targets (relative strength, analyzer-scale free). */
function phraseQuantiles(notes: readonly RhythmNote[]): Map<number, { median: number; accent: number }> {
    const byPhrase = new Map<number, number[]>();
    for (const note of notes) {
        const key = note.phrase ?? -1;
        const list = byPhrase.get(key);
        if (list) list.push(note.intensity); else byPhrase.set(key, [note.intensity]);
    }
    const out = new Map<number, { median: number; accent: number }>();
    for (const [key, list] of byPhrase) {
        list.sort((a, b) => a - b);
        out.set(key, { median: list[Math.floor(list.length / 2)], accent: list[Math.min(list.length - 1, Math.floor(list.length * ACCENT_QUANTILE))] });
    }
    return out;
}

/** Whether a note sits on a big musical moment (scene, relative onset strength, beat). */
function bigMoment(note: RhythmNote, context: OverheadContext, strength: { median: number; accent: number }): boolean {
    if (!context.bigScene(note.time) || note.intensity < strength.median) return false;
    if (!context.reliable) return note.intensity >= strength.accent;
    const phase = context.beatPhase(note.time);
    // On a beat, within the same tolerance the hand policy uses.
    return Math.abs(phase - Math.round(phase)) < 0.15;
}

/**
 * Returns a new chart with some targets moved to the overhead row; `notes` is never mutated and
 * equal input always yields an equal chart.
 */
export function liftOverheadTargets(notes: readonly RhythmNote[], context: OverheadContext): RhythmNote[] {
    const out = notes.slice();
    // Per-hand note order, so each candidate sees its previous and next same-hand target.
    const byHand: Record<Hand, number[]> = { left: [], right: [] };
    out.forEach((note, i) => { if (note.hand === 'left' || note.hand === 'right') byHand[note.hand].push(i); });
    const position = new Map<number, number>();
    for (const hand of ['left', 'right'] as const) byHand[hand].forEach((index, k) => position.set(index, k));
    const dropped = new Set<number>();
    /** Same-hand neighbour index `step` (-1 / +1) away, skipping targets already left out; -1 if none. */
    const neighbourOf = (hand: Hand, index: number, step: -1 | 1): number => {
        const list = byHand[hand];
        for (let k = position.get(index)! + step; k >= 0 && k < list.length; k += step) if (!dropped.has(list[k])) return list[k];
        return -1;
    };
    const strength = phraseQuantiles(notes);
    const lastOverhead: Record<Hand, number> = { left: -Infinity, right: -Infinity };
    let lastAny = -Infinity;
    /** The hand's move between a neighbour and the overhead target fits the difficulty's envelope. */
    const reachable = (neighbour: RhythmNote, overhead: RhythmNote, before: boolean): boolean => {
        const rows = overheadMoveRows(neighbour, overhead, before);
        const rested = Math.abs(overhead.time - neighbour.time) >= LONG_REST_SEC - 1e-9;
        return (rested || rows <= context.demand.maxRowStep) && Math.hypot(xOf(neighbour) - xOf(overhead), rows * context.rowSpacingMeters)
            <= Math.abs(overhead.time - neighbour.time) * context.maxHandTravelMps + 1e-9;
    };
    /** Cut parity between two same-hand targets (the planner's rule: no repeated direction within 1.5 s). */
    const parityOk = (a: RhythmNote, b: RhythmNote) => {
        if (!a.cutDirection || !b.cutDirection || a.cutDirection === 'any' || b.cutDirection === 'any' || Math.abs(b.time - a.time) >= 1.5) return true;
        const u = CUT_VECTORS[a.cutDirection], v = CUT_VECTORS[b.cutDirection];
        return u[0] * v[0] + u[1] * v[1] <= 0.1;
    };
    /**
     * Whether note `index` (hand `hand`) can physically go overhead: null when it cannot, otherwise
     * the same-hand targets to leave out for its mandatory rest (usually none).
     */
    const feasible = (index: number, hand: Hand): number[] | null => {
        const note = out[index];
        if (xOf(note) === 0 || !note.cutDirection || !DOWN_CUTS.has(note.cutDirection)) return null;
        const beat = context.beatSec(note.time);
        if (note.time - lastOverhead[hand] < HAND_SPACING_BEATS * beat - 1e-9) return null;
        const previous = neighbourOf(hand, index, -1);
        if (previous >= 0) {
            if (note.time - out[previous].time < Math.max(OVERHEAD_PREP_SEC, context.minSameHandSpacingSec) - 1e-9) return null;
            if (!reachable(out[previous], note, true)) return null;
        }
        const rest = Math.max(OVERHEAD_REST_SEC, beat, context.minSameHandSpacingSec);
        const drops: number[] = [];
        let next = neighbourOf(hand, index, 1);
        // Leave out single targets inside the rest, then the one after them if parity would break.
        while (next >= 0 && (out[next].time - note.time < rest - 1e-9 || (drops.length > 0 && !parityOk(note, out[next])))) {
            if (drops.length >= MAX_REST_DROPS || out[next].pairId || out[next].row === OVERHEAD_ROW) return null;
            drops.push(next);
            next = neighbourOf(hand, next, 1);
        }
        if (next >= 0 && !reachable(out[next], note, false)) return null;
        return drops;
    };
    const lift = (index: number, drops: readonly number[]) => {
        const note = out[index];
        for (const drop of drops) dropped.add(drop);
        out[index] = { ...note, row: OVERHEAD_ROW };
        lastOverhead[note.hand as Hand] = note.time;
        lastAny = note.time;
    };
    for (let i = 0; i < out.length; i++) {
        const note = out[i];
        if (note.hand !== 'left' && note.hand !== 'right') continue;
        const phraseStrength = strength.get(note.phrase ?? -1)!;
        if (!bigMoment(note, context, phraseStrength)) continue;
        if (note.time - lastAny < SPACING_BEATS * context.beatSec(note.time) - 1e-9) continue;
        if (note.pairId) {
            const partnerIndex = out[i + 1]?.pairId === note.pairId ? i + 1 : -1;
            if (partnerIndex < 0) continue; // only the first note of a pair decides for the pair
            const partner = out[partnerIndex];
            if (note.pairLayout === 'horizontal') {
                // Both hands overhead: a big accent at Hard and above only.
                if (context.demand.strictSequences && note.intensity >= phraseStrength.accent) {
                    const a = feasible(i, note.hand), b = a && feasible(partnerIndex, partner.hand as Hand);
                    if (a && b) { lift(i, a); lift(partnerIndex, b); }
                }
            } else if (context.demand.maxRowStep >= 2) {
                // Vertical / diagonal accents: the upper hand reaches overhead, the lower one stays.
                const upper = note.row === 2 ? i : partner.row === 2 ? partnerIndex : -1;
                const drops = upper >= 0 ? feasible(upper, out[upper].hand as Hand) : null;
                if (drops) lift(upper, drops);
            }
            i = partnerIndex;
            continue;
        }
        const drops = feasible(i, note.hand);
        if (drops) lift(i, drops);
    }
    return dropped.size ? out.filter((_, i) => !dropped.has(i)) : out;
}
