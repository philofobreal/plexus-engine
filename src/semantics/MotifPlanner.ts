import type {
    DramaturgicalIntentPlan,
    GrammarOperator,
    MotifPhrase,
    MotifRole,
    PatternSubdivision,
    TrackAnalysis,
    TrackSection,
    VisualMotif
} from '../types';
import { findIntentForTime } from './IntentGenerator';

// Pure, offline Visual Score planning. Selection is deliberately based only on
// analyzer/intent data and stable hashes; no runtime randomness or style data.

const LABEL_MOTIFS: Record<TrackSection['label'], VisualMotif[]> = {
    intro: ['void-minimal', 'halo-focus'],
    verse: ['pulse-field', 'orbit-system', 'halo-focus', 'wave-ripple'],
    build: ['orbit-system', 'grid-scan', 'swarm-motion'],
    drop: ['network-bloom', 'tunnel-drive', 'pulse-field'],
    break: ['wave-ripple', 'void-minimal'],
    peak: ['network-bloom', 'tunnel-drive', 'pulse-field'],
    outro: ['void-minimal', 'wave-ripple']
};

export function planMotifs(analysis: TrackAnalysis, intents: DramaturgicalIntentPlan): MotifPhrase[] {
    const sections = analysis.sections ?? [];
    const phrases: MotifPhrase[] = [];
    let unchangedRun = 0;

    for (let index = 0; index < sections.length; index++) {
        const section = sections[index];
        const previousSection = sections[index - 1];
        const previous = phrases[index - 1];
        const novelty = sectionNovelty(analysis, section);
        const similar = !!previousSection && isSimilar(section, previousSection);
        const chaotic = section.density > 0.82 && (section.dominantFeature === 'fx' || novelty > 0.75);
        const releaseFatigue = previous?.motif === 'network-bloom'
            && (previousSection?.label === 'drop' || previousSection?.label === 'peak')
            && (section.label === 'drop' || section.label === 'peak');
        const seed = stableHash(scoreIdentity(analysis, section, index));
        const candidates = motifCandidates(section, chaotic).filter(motif => !releaseFatigue || motif !== 'network-bloom');

        let motif: VisualMotif;
        if (previous && similar && !releaseFatigue && novelty < 0.62 && unchangedRun < 2) {
            motif = previous.motif;
            unchangedRun++;
        } else {
            motif = pickContrasting(candidates, previous?.motif, seed, novelty >= 0.62 || section.label !== previousSection?.label);
            unchangedRun = motif === previous?.motif ? unchangedRun + 1 : 0;
        }

        const intent = findIntentForTime(section.start, intents.points ?? []);
        const role = motifRole(section, previous?.motif === motif, novelty);
        const intensity = clamp01(intent?.weight ?? section.energy);
        const density = clamp01(chaotic ? section.density * 0.72 : section.density);
        const motion = clamp01(chaotic ? section.energy * 0.65 : section.energy * 0.65 + section.density * 0.35);

        phrases.push({
            id: `motif-${index}-${motif}-${seed.toString(36)}`,
            motif,
            role,
            startTime: finite(section.start),
            endTime: Math.max(finite(section.start), finite(section.end)),
            subdivision: selectSubdivision(analysis, seed),
            intensity,
            density,
            motion,
            novelty,
            variationSeed: seed,
            operators: selectOperators(section, motif, novelty, index)
        });
    }
    return phrases;
}

export function selectSubdivision(analysis: TrackAnalysis, seed = 0): PatternSubdivision {
    const confidence = timingConfidence(analysis);
    if (confidence < 0.35) return 'section';
    if (confidence < 0.55) return 'phrase';
    const bpm = finite(analysis.tempo || analysis.bpm);
    if (bpm >= 160) return seed % 3 === 0 ? 'two-bars' : 'bar';
    if (bpm >= 120) return seed % 2 === 0 ? 'beat' : 'bar';
    if (bpm < 100) return seed % 3 === 0 ? 'bar' : 'half-beat';
    return seed % 2 === 0 ? 'beat' : 'bar';
}

export function stableHash(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function motifCandidates(section: TrackSection, chaotic: boolean): VisualMotif[] {
    if (chaotic) return ['halo-focus', 'pulse-field', 'orbit-system'];
    if (section.dominantFeature === 'fx') return ['fragment-cloud', 'grid-scan'];
    if (section.dominantFeature === 'melody' || section.dominantFeature === 'vocal') {
        return ['halo-focus', 'wave-ripple', ...LABEL_MOTIFS[section.label]];
    }
    if (section.label === 'build' && section.energy > 0.78) return ['swarm-motion', 'grid-scan', 'orbit-system'];
    if (section.label === 'drop' && section.density < 0.55) return ['pulse-field', 'tunnel-drive'];
    return LABEL_MOTIFS[section.label] ?? ['pulse-field'];
}

function pickContrasting(candidates: VisualMotif[], previous: VisualMotif | undefined, seed: number, force: boolean): VisualMotif {
    const ordered = force && candidates.length > 1 ? candidates.filter(candidate => candidate !== previous) : candidates;
    const pool = ordered.length ? ordered : candidates;
    return pool[seed % pool.length] ?? 'void-minimal';
}

function motifRole(section: TrackSection, reused: boolean, novelty: number): MotifRole {
    if (reused) return 'memory';
    if (section.label === 'drop' || section.label === 'peak') return 'release';
    if (section.label === 'build') return 'tension';
    if (novelty > 0.7 || section.dominantFeature === 'fx') return 'accent';
    if (section.dominantFeature === 'melody' || section.dominantFeature === 'vocal') return 'counterpoint';
    return 'foundation';
}

function selectOperators(section: TrackSection, motif: VisualMotif, novelty: number, index: number): GrammarOperator[] {
    if (section.label === 'build') return ['grow', 'cascade'];
    if (section.label === 'drop' || section.label === 'peak') return ['repeat', 'echo'];
    if (section.label === 'break' || section.label === 'outro') return ['shrink', 'mirror'];
    if (section.dominantFeature === 'melody' || section.dominantFeature === 'vocal') return ['call-response'];
    if (section.dominantFeature === 'fx' || novelty > 0.72) return ['alternate', 'cascade'];
    return motif === 'pulse-field' || index % 2 === 0 ? ['repeat'] : ['mirror'];
}

function sectionNovelty(analysis: TrackAnalysis, section: TrackSection): number {
    const peaks = analysis.noveltyPeaks ?? [];
    let peak = 0;
    for (const point of peaks) {
        if (point.time >= section.start && point.time < section.end) peak = Math.max(peak, finite(point.value));
    }
    for (const moment of analysis.significantMoments ?? []) {
        if (moment.time >= section.start && moment.time < section.end) peak = Math.max(peak, finite(moment.intensity) * finite(moment.confidence));
    }
    return clamp01(peak);
}

function isSimilar(a: TrackSection, b: TrackSection): boolean {
    return a.label === b.label
        || (Math.abs(a.energy - b.energy) < 0.14
            && Math.abs(a.density - b.density) < 0.14
            && a.dominantFeature === b.dominantFeature);
}

function timingConfidence(analysis: TrackAnalysis): number {
    return clamp01(analysis.timingConfidence?.overall
        ?? analysis.tempoConfidence
        ?? analysis.gridConfidence
        ?? analysis.bpmConfidence
        ?? 0);
}

function scoreIdentity(analysis: TrackAnalysis, section: TrackSection, index: number): string {
    return [analysis.duration, analysis.tempo || analysis.bpm, index, section.start, section.end,
        section.label, section.energy, section.density, section.dominantFeature].join('|');
}

function finite(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, finite(value)));
}
