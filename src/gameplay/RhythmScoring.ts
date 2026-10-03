// Dramaturgy-weighted scoring (ADR-009 Addendum J). Pure and deterministic: a scoring plan is built
// once per chart from the chart itself and the analyzer's published sections (plain data); the
// session applies it hit by hit.
//
// - Every note belongs to the section that contains its time. A section's weight in [1, 2] mixes
//   its dramaturgical role (label) and the measured physical demand of its targets, half and half.
// - A hit earns grade points (perfect 100, good 50) x combo multiplier (1/2/4/8) x section weight.
// - A section finished without a miss earns a clear bonus; finished all-perfect, a second one.
// - The maximum score assumes every note perfect, so accuracy = score / maximum.
// Without published sections there is no dramaturgy to reward: one section, weight 1, no bonuses.

import type { TrackSectionLabel } from '../types';
import type { JudgementGrade, RhythmNote } from './RhythmTypes';

/** The subset of an analyzer `TrackSection` scoring needs. */
export interface ScoringSectionSource {
    readonly start: number;
    readonly end: number;
    readonly label: TrackSectionLabel;
}

export interface SectionScoreProfile {
    readonly index: number;
    readonly start: number;
    readonly end: number;
    readonly label: TrackSectionLabel | null;
    /** Dramaturgical role in [0, 1]. */
    readonly labelFactor: number;
    /** Physical demand of this section's targets relative to the track's most demanding one, [0, 1]. */
    readonly demand: number;
    /** Score multiplier in [1, 2]. */
    readonly weight: number;
    readonly noteCount: number;
    /** Bonus for finishing without a miss (0 when bonuses are off). */
    readonly clearBonus: number;
    /** Additional bonus for finishing all-perfect. */
    readonly flawlessBonus: number;
}

export interface RhythmScoringPlan {
    readonly sections: readonly SectionScoreProfile[];
    /** Section index of every chart note, in chart order. */
    readonly noteSection: Int32Array;
    /** Score with every note perfect (multiplier progression and all bonuses included). */
    readonly maxScore: number;
    readonly bonuses: boolean;
}

export const GRADE_POINTS: Readonly<Record<JudgementGrade, number>> = { perfect: 100, good: 50 };
/** Dramaturgical weight of each analyzer label: releases 0, development low, climaxes high. */
export const SECTION_LABEL_FACTOR: Readonly<Record<TrackSectionLabel, number>> = {
    intro: 0, verse: 0.2, build: 0.4, drop: 0.8, break: 0, peak: 1, outro: 0
};
export const MULTIPLIER_TIERS: readonly number[] = [1, 2, 4, 8];
/** Consecutive hits needed at a tier to reach the next one. */
export const MULTIPLIER_STEPS: readonly number[] = [2, 4, 8];
export const CLEAR_BONUS_SHARE = 0.25;
export const FLAWLESS_BONUS_SHARE = 0.25;

/** Combo multiplier state: a tier plus progress toward the next one. */
export interface MultiplierState { tier: number; progress: number }

export function createMultiplierState(): MultiplierState { return { tier: 0, progress: 0 }; }

export function multiplierOf(state: MultiplierState): number { return MULTIPLIER_TIERS[state.tier]; }

/** A hit at the current tier counts toward the next one. */
export function advanceMultiplier(state: MultiplierState): void {
    if (state.tier >= MULTIPLIER_STEPS.length) return;
    if (++state.progress >= MULTIPLIER_STEPS[state.tier]) { state.tier++; state.progress = 0; }
}

/** A miss drops one tier and restarts its progress. */
export function dropMultiplier(state: MultiplierState): void {
    state.tier = Math.max(0, state.tier - 1);
    state.progress = 0;
}

export function hitPoints(grade: JudgementGrade, multiplier: number, weight: number): number {
    return Math.round(GRADE_POINTS[grade] * multiplier * weight);
}

const finite = (value: number) => Number.isFinite(value);

/** Raw physical demand of a set of notes: density scaled by how much of it is hard to play. */
function rawDemand(notes: readonly RhythmNote[], durationSec: number): number {
    if (!notes.length || !(durationSec > 0)) return 0;
    let arrows = 0, pairs = 0, crossings = 0, jumps = 0;
    const lastRow: Partial<Record<string, number>> = {};
    for (const note of notes) {
        if (note.cutDirection && note.cutDirection !== 'any') arrows++;
        if (note.pairId) pairs++;
        const x = note.xOffsetMeters ?? 0;
        if ((note.hand === 'left' && x > 0.05) || (note.hand === 'right' && x < -0.05)) crossings++;
        const previous = lastRow[note.hand];
        if (previous !== undefined && Math.abs(note.row - previous) >= 2) jumps++;
        lastRow[note.hand] = note.row;
    }
    const n = notes.length;
    return (n / durationSec) * (1 + 0.5 * (arrows / n) + 0.5 * (pairs / n) + 0.5 * (crossings / n) + 0.5 * (jumps / n));
}

/**
 * Builds the scoring plan for a chart. Sections are sorted and sanitized; notes outside every
 * section join the nearest earlier one (or the first). Pure: same chart + sections, same plan.
 */
export function buildScoringPlan(chart: readonly RhythmNote[], sectionSources: readonly ScoringSectionSource[] = []): RhythmScoringPlan {
    const valid = sectionSources.filter(s => s && finite(s.start) && finite(s.end) && s.end > s.start && s.label in SECTION_LABEL_FACTOR)
        .slice().sort((a, b) => a.start - b.start);
    const bonuses = valid.length > 0;
    const spans = bonuses ? valid : [{ start: chart[0]?.time ?? 0, end: (chart.at(-1)?.time ?? 0) + 1, label: null }];
    const noteSection = new Int32Array(chart.length);
    const members: RhythmNote[][] = spans.map(() => []);
    let cursor = 0;
    chart.forEach((note, i) => {
        while (cursor + 1 < spans.length && spans[cursor + 1].start <= note.time) cursor++;
        noteSection[i] = cursor;
        members[cursor].push(note);
    });
    const raw = spans.map((span, i) => rawDemand(members[i], span.end - span.start));
    const peak = Math.max(0, ...raw);
    const sections: SectionScoreProfile[] = spans.map((span, i) => {
        const labelFactor = span.label ? SECTION_LABEL_FACTOR[span.label] : 0;
        const demand = bonuses && peak > 0 ? raw[i] / peak : 0;
        const weight = bonuses ? 1 + 0.5 * labelFactor + 0.5 * demand : 1;
        const base = GRADE_POINTS.perfect * members[i].length;
        return Object.freeze({ index: i, start: span.start, end: span.end, label: span.label, labelFactor, demand, weight,
            noteCount: members[i].length,
            clearBonus: bonuses ? Math.round(base * CLEAR_BONUS_SHARE * weight) : 0,
            flawlessBonus: bonuses ? Math.round(base * FLAWLESS_BONUS_SHARE * weight) : 0 });
    });
    // Maximum: every note perfect, in chart order, through the multiplier progression.
    const multiplier = createMultiplierState();
    let maxScore = 0;
    for (let i = 0; i < chart.length; i++) {
        maxScore += hitPoints('perfect', multiplierOf(multiplier), sections[noteSection[i]].weight);
        advanceMultiplier(multiplier);
    }
    for (const section of sections) maxScore += section.clearBonus + section.flawlessBonus;
    return Object.freeze({ sections: Object.freeze(sections), noteSection, maxScore, bonuses });
}

export type ScoreRank = 'SS' | 'S' | 'A' | 'B' | 'C';

/** Rank for an accuracy in [0, 1]. */
export function scoreRank(accuracy: number): ScoreRank {
    if (!(accuracy >= 0)) return 'C';
    if (accuracy >= 0.95) return 'SS';
    if (accuracy >= 0.9) return 'S';
    if (accuracy >= 0.8) return 'A';
    if (accuracy >= 0.65) return 'B';
    return 'C';
}
