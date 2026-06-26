import type {
    MusicalNarrativePlan,
    NarrativeSegment,
    NarrativeType,
    TensionTrends,
    TrackAnalysis,
    TrackSection,
    TrackSectionLabel
} from '../types';

// NarrativeEngine — turns the analyzer's physical TrackSection list into a
// style-independent musical narrative (ADR-003). Pure, offline, deterministic:
// it depends only on TrackAnalysis and must never import p5, DOM, or runtime state.
// Run once per track (or on timeline edit), not in the render loop.

// A drop/break shorter than this that is immediately followed by another build
// reads as a false climax (fake-drop) rather than a real release.
const FAKE_DROP_MAX_SEC = 6.0;

// A rising tension trend at/above this end value upgrades a steady groove to mounting tension.
const RISING_TENSION_END_VALUE = 0.55;

const LABEL_TO_NARRATIVE: Record<TrackSectionLabel, NarrativeType> = {
    intro: 'intro',
    verse: 'groove',
    build: 'build',
    drop: 'release',
    break: 'breakdown',
    peak: 'peak',
    outro: 'outro'
};

const NARRATIVE_BASE_INTENSITY: Record<NarrativeType, number> = {
    intro: 0.20,
    groove: 0.45,
    tension: 0.60,
    build: 0.70,
    'fake-drop': 0.50,
    release: 0.85,
    peak: 1.00,
    breakdown: 0.30,
    outro: 0.20
};

export function buildNarrative(analysis: TrackAnalysis): MusicalNarrativePlan {
    const sections = analysis.sections ?? [];
    const tensionTrends = analysis.tensionTrends;
    const segments: NarrativeSegment[] = [];

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const next = sections[i + 1];
        let type = LABEL_TO_NARRATIVE[section.label] ?? 'groove';

        // Refinement 1 — fake-drop: a brief drop/break that immediately rebuilds is a
        // false climax, not the real release.
        if ((section.label === 'drop' || section.label === 'break')
            && next && next.label === 'build'
            && (section.end - section.start) < FAKE_DROP_MAX_SEC) {
            type = 'fake-drop';
        }

        // Refinement 2 — tension: a groove riding a strongly rising tension trend reads
        // as mounting tension rather than a steady groove.
        if (section.label === 'verse' && isRisingTension(tensionTrends, section)) {
            type = 'tension';
        }

        segments.push({
            id: `narrative-${i}-${type}`,
            startTime: section.start,
            endTime: section.end,
            type,
            intensity: segmentIntensity(type, section)
        });
    }

    return { version: 1, segments };
}

function isRisingTension(trends: TensionTrends | undefined, section: TrackSection): boolean {
    if (!trends || trends.segments.length === 0) return false;
    const mid = (section.start + section.end) / 2;
    const trend = trends.segments.find(s => mid >= s.start && mid <= s.end);
    if (!trend) return false;
    return trend.direction === 'rising' && trend.endValue >= RISING_TENSION_END_VALUE;
}

function segmentIntensity(type: NarrativeType, section: TrackSection): number {
    const base = NARRATIVE_BASE_INTENSITY[type] ?? 0.5;
    return clamp01(base * 0.5 + section.energy * 0.35 + section.density * 0.15);
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
