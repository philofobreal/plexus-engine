import { State } from '../state/store.ts';
import type {
    BarAnalysis,
    PerformanceAutomationPlan,
    PerformanceAutomationPoint,
    PerformanceAutomationReason,
    TrackAnalysis,
    TrackSection,
    VisualCueEvent
} from '../types';

const DROP_ANTICIPATION_SEC = 1.5;
const LONG_SECTION_SEC = 16.0;

type AutomationCandidate = {
    section: TrackSection;
    previousSection: TrackSection | null;
    sectionIndex: number;
    cue: VisualCueEvent | null;
    cueIndex: number;
    time: number;
    score: number;
};

export function generatePerformancePlan(
    trackAnalysis: TrackAnalysis,
    availablePresets: string[],
    duration: number
): PerformanceAutomationPlan {
    const presets = availablePresets.filter(Boolean);
    const minGap = clamp(duration / 30, 8.0, 32.0);
    const candidates = getAutomationCandidates(trackAnalysis, duration);
    const selectedCandidates = selectAutomationCandidates(candidates, minGap);
    const points = selectedCandidates
        .sort((a, b) => a.time - b.time)
        .map(candidate => candidate.cue
            ? createCuePoint(candidate.section, candidate.sectionIndex, { ...candidate.cue, time: candidate.time }, candidate.cueIndex, presets, duration)
            : createPoint(candidate.section, candidate.sectionIndex, candidate.time, presets, duration));

    return {
        version: 1,
        source: 'auto',
        points
    };
}

function getAutomationCandidates(trackAnalysis: TrackAnalysis, duration: number): AutomationCandidate[] {
    const candidates: AutomationCandidate[] = [];

    for (let i = 0; i < trackAnalysis.sections.length; i++) {
        const section = trackAnalysis.sections[i];
        const previousSection = trackAnalysis.sections[i - 1] ?? null;
        if (shouldCreateSectionPoint(section, previousSection, i)) {
            candidates.push({
                section,
                previousSection,
                sectionIndex: i,
                cue: null,
                cueIndex: -1,
                time: getAutomationTime(section, previousSection, duration, trackAnalysis.bars),
                score: i === 0 ? Number.POSITIVE_INFINITY : scoreTransition(section, previousSection)
            });
        }

        if (section.end - section.start > LONG_SECTION_SEC) {
            const cues = getSignificantCuesInSection(trackAnalysis, section);
            for (let cueIdx = 0; cueIdx < cues.length; cueIdx++) {
                candidates.push({
                    section,
                    previousSection,
                    sectionIndex: i,
                    cue: cues[cueIdx],
                    cueIndex: cueIdx,
                    time: clampTime(snapToNearestBar(cues[cueIdx].time, trackAnalysis.bars), duration),
                    score: scoreCue(section, previousSection, cues[cueIdx])
                });
            }
        }
    }

    return candidates;
}

function shouldCreateSectionPoint(section: TrackSection, previousSection: TrackSection | null, index: number): boolean {
    if (index === 0 || !previousSection) return true;
    if (section.label !== previousSection.label) return true;
    if (section.dominantFeature !== previousSection.dominantFeature) return true;
    if (Math.abs(section.energy - previousSection.energy) >= 0.15) return true;
    return Math.abs(section.avgRms - previousSection.avgRms) >= 0.12;
}

function scoreTransition(section: TrackSection, previousSection: TrackSection | null): number {
    let score = previousSection ? Math.abs(section.energy - previousSection.energy) * 1.5 : 0;
    if (section.label === 'drop' || section.label === 'break') score += 0.5;
    if (previousSection && section.dominantFeature !== previousSection.dominantFeature) score += 0.25;
    return score;
}

function scoreCue(section: TrackSection, previousSection: TrackSection | null, cue: VisualCueEvent): number {
    let score = scoreTransition(section, previousSection);
    if (cue.kind === 'break') score += 0.5;
    else if (cue.kind === 'impact') score += 0.35;
    score += clamp01(cue.confidence) * 0.15;
    return score;
}

function selectAutomationCandidates(candidates: AutomationCandidate[], minGap: number): AutomationCandidate[] {
    const selected: AutomationCandidate[] = [];
    const introCandidate = candidates.find(candidate => candidate.sectionIndex === 0 && candidate.cue === null);
    if (introCandidate) selected.push({ ...introCandidate, time: 0 });

    const primaryCandidates = candidates
        .filter(candidate => candidate !== introCandidate && candidate.cue === null)
        .sort((a, b) => b.score - a.score || a.time - b.time || a.sectionIndex - b.sectionIndex || a.cueIndex - b.cueIndex);

    for (const candidate of primaryCandidates) {
        const dynamicGap = isExtremeEnergyContrast(candidate) ? 3.0 : minGap;
        if (selected.every(point => Math.abs(point.time - candidate.time) >= dynamicGap)) {
            selected.push(candidate);
        }
    }

    const secondaryCandidates = candidates
        .filter(candidate => candidate.cue !== null)
        .sort((a, b) => b.score - a.score || a.time - b.time || a.sectionIndex - b.sectionIndex || a.cueIndex - b.cueIndex);

    for (const candidate of secondaryCandidates) {
        const dynamicGap = isExtremeEnergyContrast(candidate) ? 3.0 : minGap;
        if (selected.every(point => Math.abs(point.time - candidate.time) >= dynamicGap)) {
            selected.push(candidate);
        }
    }

    return selected;
}

function isExtremeEnergyContrast(candidate: AutomationCandidate): boolean {
    return Boolean(candidate.previousSection)
        && Math.abs(candidate.section.energy - candidate.previousSection!.energy) >= 0.35;
}

function createPoint(
    section: TrackSection,
    sectionIndex: number,
    time: number,
    presets: string[],
    duration: number
): PerformanceAutomationPoint {
    const clampedTime = clampTime(time, duration);
    const profile = getMorphProfile(section);
    return {
        id: `performance-${sectionIndex}-${normalizeIdPart(section.label)}-${formatTimeForId(clampedTime)}`,
        time: clampedTime,
        sectionId: getSectionId(section, sectionIndex),
        preset: choosePreset(section, presets),
        confidence: getSectionConfidence(section),
        intensity: getDefaultIntensity(),
        reason: getAutomationReason(section),
        morphDurationSec: profile.morphDurationSec,
        morphCurve: profile.morphCurve
    };
}

function createCuePoint(
    section: TrackSection,
    sectionIndex: number,
    cue: VisualCueEvent,
    cueIndex: number,
    presets: string[],
    duration: number
): PerformanceAutomationPoint {
    const point = createPoint(section, sectionIndex, cue.time, presets, duration);
    return {
        ...point,
        id: `performance-${sectionIndex}-${normalizeIdPart(cue.kind)}-cue-${cueIndex}-${formatTimeForId(point.time)}`,
        confidence: clamp01(Math.max(point.confidence, cue.confidence)),
        reason: cue.kind === 'break' ? 'break' : point.reason
    };
}

function getSignificantCuesInSection(trackAnalysis: TrackAnalysis, section: TrackSection): VisualCueEvent[] {
    const cues = trackAnalysis.significantMoments.length ? trackAnalysis.significantMoments : trackAnalysis.cues;
    return cues
        .filter(cue => isSignificantAutomationCue(cue) && cue.time >= section.start && cue.time <= section.end)
        .sort((a, b) => a.time - b.time);
}

function isSignificantAutomationCue(cue: VisualCueEvent): boolean {
    if (cue.kind === 'impact' || cue.kind === 'break') return true;
    return (cue.kind === 'melody' || cue.kind === 'vocal' || cue.kind === 'pattern' || cue.kind === 'fx')
        && (cue.intensity >= 0.75 || cue.confidence >= 0.75);
}

function getAutomationTime(section: TrackSection, previousSection: TrackSection | null, duration: number, bars: BarAnalysis[]): number {
    const sectionStart = clampTime(snapToNearestBar(section.start, bars), duration);
    if (section.label !== 'drop' && section.label !== 'peak') return sectionStart;

    const barIndex = bars.findIndex(bar => bar.start === sectionStart);
    if (barIndex > 0) return clampTime(bars[barIndex - 1].start, duration);

    const earliestTime = previousSection ? clampTime(snapToNearestBar(previousSection.start, bars), duration) : 0;
    return Math.max(earliestTime, sectionStart - DROP_ANTICIPATION_SEC);
}

function snapToNearestBar(time: number, bars: BarAnalysis[]): number {
    if (!bars.length) return time;
    let closest = bars[0];
    let closestDistance = Math.abs(closest.start - time);
    for (const bar of bars) {
        const distance = Math.abs(bar.start - time);
        if (distance < closestDistance) {
            closest = bar;
            closestDistance = distance;
        }
    }
    return closest.start;
}

function choosePreset(section: TrackSection, availablePresets: string[]): string {
    const fallback = getFallbackPreset(availablePresets);

    switch (section.label) {
        case 'intro':
        case 'outro':
            return findPreset(availablePresets, ['default', 'temporal2']) ?? fallback;
        case 'build':
            return findPreset(availablePresets, ['temporal1', 'temporal4']) ?? fallback;
        case 'drop':
            return findPreset(availablePresets, ['temporal3', 'temporal4']) ?? fallback;
        case 'break':
            return findPreset(availablePresets, ['temporal5']) ?? fallback;
        case 'peak':
            return findPreset(availablePresets, ['temporal4']) ?? fallback;
        default:
            return findPreset(availablePresets, getDominantFeaturePresetHints(section)) ?? fallback;
    }
}

function getDominantFeaturePresetHints(section: TrackSection): string[] {
    switch (section.dominantFeature) {
        case 'melody':
        case 'vocal':
            return ['temporal2', 'default'];
        case 'fx':
        case 'impact':
            return ['temporal3', 'temporal4'];
        case 'break':
            return ['temporal5'];
        case 'pattern':
            return ['temporal1', 'temporal4'];
        default:
            return ['default'];
    }
}

function findPreset(availablePresets: string[], hints: string[]): string | null {
    for (const hint of hints) {
        const match = availablePresets.find(preset => preset.toLowerCase().includes(hint));
        if (match) return match;
    }
    return null;
}

function getFallbackPreset(availablePresets: string[]): string {
    return availablePresets.find(preset => preset.toLowerCase() === 'default.json') ?? availablePresets[0] ?? 'default.json';
}

function getAutomationReason(section: TrackSection): PerformanceAutomationReason {
    switch (section.label) {
        case 'intro':
        case 'build':
        case 'drop':
        case 'break':
        case 'peak':
            return section.label;
        default:
            return section.dominantFeature === 'melody' || section.dominantFeature === 'vocal' ? 'harmonicShift' : 'manual';
    }
}

function getMorphProfile(section: TrackSection): Pick<PerformanceAutomationPoint, 'morphDurationSec' | 'morphCurve'> {
    switch (section.label) {
        case 'drop':
        case 'peak':
            return { morphDurationSec: 1.0, morphCurve: 'exponential' };
        case 'intro':
        case 'outro':
            return { morphDurationSec: 4.0, morphCurve: 'easeInOut' };
        case 'build':
        case 'break':
            return { morphDurationSec: 2.5, morphCurve: 'easeInOut' };
        default:
            return { morphDurationSec: 2.0, morphCurve: 'easeInOut' };
    }
}

function getSectionConfidence(section: TrackSection): number {
    const energyDensity = (section.energy + section.density) * 0.5;
    return clamp01(Math.max(0.5, energyDensity));
}

function getDefaultIntensity(): number {
    const sensitivity = State.visualTuning?.audioSensitivity;
    return Number.isFinite(sensitivity) ? sensitivity : 1.0;
}

function getSectionId(section: TrackSection, index: number): string {
    return `${index}:${normalizeIdPart(section.label)}:${formatTimeForId(section.start)}`;
}

function normalizeIdPart(value: string): string {
    return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'section';
}

function formatTimeForId(time: number): string {
    return time.toFixed(3).replace('.', '-');
}

function clampTime(time: number, duration: number): number {
    const maxTime = Number.isFinite(duration) && duration > 0 ? duration : Number.POSITIVE_INFINITY;
    return Math.max(0, Math.min(time, maxTime));
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
