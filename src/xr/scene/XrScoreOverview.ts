// Structure + score overview data for the start-frame song map and the floor progress ring
// (ADR-009 Addendum K). Pure: built once per chart from the scoring plan, then projected from
// canonical song time and the session snapshot. Pausing freezes it, seeking lands on the exact state.

import type { SectionResult } from '../../gameplay';
import type { TrackSectionLabel } from '../../types';
import { SECTION_STYLE } from './XrSectionCallout';

export interface ScoreOverviewSection {
    readonly start: number;
    readonly end: number;
    readonly label: TrackSectionLabel | null;
    readonly title: string;
    /** Display colour (section palette; neutral when the track has no sections). */
    readonly color: number;
    readonly weight: number;
    readonly noteCount: number;
}

export interface ScoreOverview {
    readonly sections: readonly ScoreOverviewSection[];
    readonly durationSec: number;
}

/** The subset of a scoring plan the overview needs. */
export interface ScoreOverviewSource {
    readonly sections: readonly { readonly start: number; readonly end: number; readonly label: TrackSectionLabel | null;
        readonly weight: number; readonly noteCount: number }[];
}

export const NEUTRAL_SECTION_COLOR = 0x8fe6ff;
export const FLAWLESS_COLOR = 0xffd35c;
/** How long a section-complete flash stays on the song map, in seconds. */
export const SECTION_FLASH_SEC = 2.5;

export function buildScoreOverview(plan: ScoreOverviewSource, durationSec: number): ScoreOverview {
    const totals = new Map<TrackSectionLabel, number>(), seen = new Map<TrackSectionLabel, number>();
    for (const s of plan.sections) if (s.label) totals.set(s.label, (totals.get(s.label) ?? 0) + 1);
    const lastEnd = plan.sections.reduce((max, s) => Math.max(max, s.end), 0);
    const sections = plan.sections.map(s => {
        if (!s.label) return { start: s.start, end: s.end, label: null, title: 'TRACK', color: NEUTRAL_SECTION_COLOR, weight: s.weight, noteCount: s.noteCount };
        const occurrence = (seen.get(s.label) ?? 0) + 1;
        seen.set(s.label, occurrence);
        const name = SECTION_STYLE[s.label].name;
        return { start: s.start, end: s.end, label: s.label, title: (totals.get(s.label) ?? 0) > 1 ? `${name} ${occurrence}` : name,
            color: SECTION_STYLE[s.label].color, weight: s.weight, noteCount: s.noteCount };
    });
    return { sections, durationSec: durationSec > 0 && Number.isFinite(durationSec) ? durationSec : Math.max(1, lastEnd) };
}

export type SectionOutcome = 'pending' | 'missed' | 'clean' | 'flawless';

/** Outcome of a section once all its notes resolved ('pending' before, or when it has none). */
export function sectionOutcome(section: ScoreOverviewSection, result: SectionResult | undefined): SectionOutcome {
    if (!result || result.completedAt === null || section.noteCount === 0) return 'pending';
    if (result.misses > 0) return 'missed';
    return result.perfects === section.noteCount ? 'flawless' : 'clean';
}

/** Section accuracy in [0, 1]: perfect = 1, good = 0.5, miss = 0. */
export function sectionAccuracy(section: ScoreOverviewSection, result: SectionResult | undefined): number {
    if (!result || section.noteCount === 0) return 0;
    return Math.min(1, (result.perfects + 0.5 * (result.hits - result.perfects)) / section.noteCount);
}

export interface SectionFlash {
    index: number;
    kind: 'clear' | 'flawless';
    bonus: number;
    /** Seconds since the section completed. */
    age: number;
}

/** Mutable, caller-owned projection (no allocation per frame). */
export interface OverviewState {
    /** Section playing now (-1 before the first one). */
    current: number;
    /** Song progress in [0, 1]. */
    progress: number;
    /** The current section has no miss so far. */
    flawless: boolean;
    flash: SectionFlash;
    hasFlash: boolean;
}

export function createOverviewState(): OverviewState {
    return { current: -1, progress: 0, flawless: true, flash: { index: -1, kind: 'clear', bonus: 0, age: 0 }, hasFlash: false };
}

export function overviewStateAt(overview: ScoreOverview, results: readonly SectionResult[] | undefined, songTime: number,
    out: OverviewState): OverviewState {
    const time = Number.isFinite(songTime) ? songTime : 0;
    out.progress = Math.min(1, Math.max(0, time / overview.durationSec));
    out.current = -1;
    for (let i = 0; i < overview.sections.length && overview.sections[i].start <= time; i++) out.current = i;
    out.flawless = out.current < 0 || (results?.[out.current]?.misses ?? 0) === 0;
    out.hasFlash = false;
    if (results) for (let i = results.length - 1; i >= 0; i--) {
        const result = results[i];
        if (result.completedAt === null || result.bonus <= 0) continue;
        const age = time - result.completedAt;
        if (age < 0 || age >= SECTION_FLASH_SEC) continue;
        out.hasFlash = true;
        out.flash.index = i; out.flash.age = age; out.flash.bonus = result.bonus;
        out.flash.kind = sectionOutcome(overview.sections[i], result) === 'flawless' ? 'flawless' : 'clear';
        break;
    }
    return out;
}

/** "2400" -> "2 400" (thin, language-neutral grouping). */
export function formatPoints(points: number): string {
    return String(Math.round(points)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
