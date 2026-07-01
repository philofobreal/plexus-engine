import type { AutomationEnvelope, PerformanceAutomationPoint, TrackAnalysis, TrackSection, VisualFeatureFrame } from '../types';

export interface TransitionDynamicsProfile {
    energyDelta: number;
    energySlope: number;
    densityDelta: number;
    transientness: number;
    smoothness: number;
    localContrast: number;
    confidence: number;
}

export interface TransitionDynamicsInput {
    analysis?: TrackAnalysis;
    timeSec: number;
}

const NEUTRAL: TransitionDynamicsProfile = {
    energyDelta: 0, energySlope: 0, densityDelta: 0, transientness: 0,
    smoothness: 0.5, localContrast: 0.5, confidence: 0
};

// Pure projection of already-computed analysis. No DSP or runtime state is consulted here.
export function computeTransitionDynamicsProfile(input: TransitionDynamicsInput): TransitionDynamicsProfile {
    const analysis = input.analysis;
    if (!analysis || !analysis.sections?.length) return { ...NEUTRAL };
    const sections = analysis.sections;
    const index = sections.findIndex((section) => input.timeSec >= section.start && input.timeSec < section.end);
    const currentIndex = index >= 0 ? index : nearestSectionIndex(sections, input.timeSec);
    const current = sections[currentIndex];
    const previous = sections[Math.max(0, currentIndex - 1)];
    const duration = Math.max(0.25, current.end - current.start);
    const window = Math.max(0.5, Math.min(4, duration * 0.25));
    const boundaryWeight = clamp01(1 - Math.abs(input.timeSec - current.start) / window);
    const local = sampleLocalFeatures(analysis, input.timeSec, window);
    const sectionEnergyDelta = sectionEnergy(current) - sectionEnergy(previous);
    const sectionDensityDelta = sectionDensity(current) - sectionDensity(previous);
    const energyDelta = clampSigned(sectionEnergyDelta * boundaryWeight + local.energyDelta * (1 - boundaryWeight * 0.5));
    const densityDelta = clampSigned(sectionDensityDelta * boundaryWeight + local.densityDelta * (1 - boundaryWeight * 0.5));
    const transitionWindowSec = local.hasEvidence ? window * 2 : duration;
    const energySlope = clampSigned(energyDelta / Math.max(0.25, Math.min(transitionWindowSec, 8)));
    const novelty = maxNear(analysis.noveltyPeaks, input.timeSec, window, (point) => point.value);
    const cueTransient = maxNear(analysis.cues ?? analysis.significantMoments, input.timeSec, window,
        (cue) => cue.kind === 'impact' || cue.kind === 'fx' ? cue.intensity * cue.confidence : 0);
    const reasonTransient = current.reasons?.some((reason) => reason === 'high-transient' || reason === 'percussive-onset') ? 1 : 0;
    const transientness = clamp01(Math.max(novelty, cueTransient, reasonTransient, local.transientness));
    const localContrast = clamp01(Math.max(Math.abs(energyDelta), Math.abs(densityDelta), transientness));
    const smoothness = clamp01(1 - (Math.abs(energySlope) * 0.35 + Math.abs(densityDelta) * 0.25 + transientness * 0.4));
    const evidenceCount = 2 + (local.hasEvidence ? 1 : 0) + (analysis.noveltyPeaks?.length ? 1 : 0) + ((analysis.cues?.length || analysis.significantMoments?.length) ? 1 : 0);
    const confidence = clamp01((analysis.timingConfidence?.overall ?? 0.6) * 0.55 + evidenceCount / 4 * 0.45);
    return { energyDelta, energySlope, densityDelta, transientness, smoothness, localContrast, confidence };
}

export function adaptAutomationEnvelopeToDynamics(envelope: AutomationEnvelope, profile: TransitionDynamicsProfile): AutomationEnvelope {
    const total = envelope.attackSec + envelope.sustainSec + envelope.releaseSec + envelope.cooldownSec;
    if (!(total > 0) || profile.confidence <= 0) return { ...envelope };
    const soft = profile.smoothness * (1 - profile.localContrast);
    const aggressive = clamp01(Math.max(profile.localContrast, profile.transientness, Math.max(0, profile.energyDelta), Math.max(0, profile.densityDelta)));
    const influence = clamp01(profile.confidence);
    const multiplier = clamp(1 + soft * 0.65 * influence - aggressive * 0.45 * influence, 0.6, 1.55);
    const maxAttack = Math.max(0.1, envelope.attackSec + envelope.sustainSec * 0.65);
    const attack = clamp(envelope.attackSec * multiplier, Math.min(0.1, total), maxAttack);
    // Preserve release and cooldown breath; only the sustain pays for attack adaptation.
    const sustain = Math.max(0, total - attack - envelope.releaseSec - envelope.cooldownSec);
    return { attackSec: attack, sustainSec: sustain, releaseSec: envelope.releaseSec, cooldownSec: envelope.cooldownSec };
}

export function adaptMorphCurveToDynamics(
    curve: PerformanceAutomationPoint['morphCurve'],
    profile: TransitionDynamicsProfile
): PerformanceAutomationPoint['morphCurve'] {
    if (profile.confidence < 0.45) return curve;
    if (profile.smoothness > 0.72 && profile.localContrast < 0.35) return 'easeInOut';
    if (profile.localContrast > 0.78 && (profile.transientness > 0.65 || profile.energyDelta > 0.45)) return 'exponential';
    return curve;
}

function nearestSectionIndex(sections: TrackAnalysis['sections'], time: number): number {
    let best = 0;
    for (let i = 1; i < sections.length; i++) if (Math.abs(sections[i].start - time) < Math.abs(sections[best].start - time)) best = i;
    return best;
}
function sectionEnergy(section: Partial<TrackSection>): number {
    if (isFiniteNumber(section.energy)) return clamp01(section.energy);
    if (isFiniteNumber(section.avgRms)) return clamp01(section.avgRms);
    if (isFiniteNumber(section.peakRms)) return clamp01(section.peakRms);
    return 0;
}
function sectionDensity(section: Partial<TrackSection>): number {
    if (isFiniteNumber(section.density)) return clamp01(section.density);
    return section.dominantFeature === 'impact' || section.dominantFeature === 'fx' ? 0.75 : 0;
}
function sampleLocalFeatures(analysis: TrackAnalysis, timeSec: number, windowSec: number): { energyDelta: number; densityDelta: number; transientness: number; hasEvidence: boolean } {
    const features = analysis.features;
    const duration = finite(analysis.duration);
    if (!features?.length || !(duration > 0)) return { energyDelta: 0, densityDelta: 0, transientness: 0, hasEvidence: false };
    // Feature frames are uniformly spaced across the offline analysis duration. TrackAnalysis does
    // not carry sampleRate, so duration/frame-count is the canonical downstream time projection.
    const secondsPerFrame = duration / features.length;
    const center = clamp(Math.floor(timeSec / secondsPerFrame), 0, features.length - 1);
    const radius = Math.max(1, Math.round(windowSec / secondsPerFrame));
    const before = averageFeatures(features, Math.max(0, center - radius), center);
    const after = averageFeatures(features, center, Math.min(features.length, center + radius));
    const novelty = maxArrayRange(analysis.noveltyCurve, Math.max(0, center - radius), Math.min(features.length, center + radius));
    return {
        energyDelta: clampSigned(after.tension - before.tension),
        densityDelta: clampSigned(after.density - before.density),
        transientness: clamp01(Math.max(after.fx, novelty)),
        hasEvidence: true
    };
}
function averageFeatures(features: VisualFeatureFrame[], start: number, end: number): Pick<VisualFeatureFrame, 'density' | 'fx' | 'tension'> {
    let density = 0, fx = 0, tension = 0;
    const count = Math.max(1, end - start);
    for (let i = start; i < end; i++) {
        density += finite(features[i]?.density);
        fx += finite(features[i]?.fx);
        tension += finite(features[i]?.tension);
    }
    return { density: density / count, fx: fx / count, tension: tension / count };
}
function maxArrayRange(values: number[] | undefined, start: number, end: number): number {
    let max = 0;
    for (let i = start; i < end; i++) max = Math.max(max, finite(values?.[i]));
    return clamp01(max);
}
function maxNear<T extends { time: number }>(items: T[] | undefined, time: number, window: number, value: (item: T) => number): number {
    let max = 0;
    for (const item of items ?? []) if (Math.abs(item.time - time) <= window) max = Math.max(max, finite(value(item)));
    return clamp01(max);
}
function finite(value: number | undefined): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function isFiniteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function clampSigned(value: number): number { return clamp(value, -1, 1); }
function clamp01(value: number): number { return clamp(value, 0, 1); }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); }
