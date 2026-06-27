import type {
    ChoreographyAction,
    ChoreographyFrame,
    DramaturgicalIntentPlan,
    GrammarOperator,
    IntentType,
    MotifPhrase,
    PatternSubdivision,
    TrackAnalysis,
    TransitionPhrase,
    VisualMotif,
    VisualChoreographyPlan
} from '../types';
import { applyEcho, applyOperators, sampleMotifGrammar, type ActionMap } from './PatternGrammar';
import { planMotifs } from './MotifPlanner';
import { planTransitions } from './TransitionPlanner';
import { findIntentForTime } from './IntentGenerator';

// ChoreographyEngine — turns dramaturgical intents into abstract, style-independent
// visual actions, then applies grammar operators (ADR-003). Pure, offline, deterministic:
// no p5/DOM/runtime state, no concrete tuning or style data. Run once per track.

// Base action vocabulary expressed by each intent, with relative intensities (0..1)
// that are later scaled by the intent's weight. Style translation happens downstream.
const INTENT_TO_ACTIONS: Record<IntentType, ActionMap> = {
    establish: { focus: 0.6, slow: 0.4 },
    anticipate: { densify: 0.7, accelerate: 0.5, orbit: 0.4 },
    compress: { collapse: 0.8, densify: 0.6, accelerate: 0.5 },
    expand: { expand: 0.9, scatter: 0.5 },
    release: { bloom: 1.0, scatter: 0.7, pulse: 0.8 },
    celebrate: { bloom: 0.9, pulse: 1.0, orbit: 0.6 },
    recover: { thin: 0.7, slow: 0.6, merge: 0.4 },
    contrast: { fragment: 0.8, freeze: 0.5 },
    return: { merge: 0.6, slow: 0.5, focus: 0.4 },
    sustain: { orbit: 0.5, pulse: 0.4 }
};

// Which grammar operators each intent activates. Kept deterministic and intent-driven so
// identical narratives always yield identical operator usage.
const INTENT_OPERATORS: Record<IntentType, GrammarOperator[]> = {
    establish: ['mirror'],
    anticipate: [],
    compress: [],
    expand: ['echo'],
    release: ['echo'],
    celebrate: ['echo'],
    recover: [],
    contrast: ['invert'],
    return: [],
    sustain: ['mirror']
};

export function processChoreography(intents: DramaturgicalIntentPlan, analysis?: TrackAnalysis): VisualChoreographyPlan {
    if (analysis) return processVisualScore(intents, analysis);
    const points = intents.points ?? [];
    const frames: ChoreographyFrame[] = [];

    for (const point of points) {
        const operators = INTENT_OPERATORS[point.intent] ?? [];
        const base = scaleActions(INTENT_TO_ACTIONS[point.intent] ?? {}, point.weight);
        const actions = applyOperators(base, operators);

        const primary: ChoreographyFrame = {
            time: point.time,
            actions,
            activeOperators: operators.filter(op => op !== 'echo')
        };
        frames.push(primary);

        // echo rings the gesture out into decreasing-intensity follow-ups after the event.
        if (operators.includes('echo')) {
            for (const echo of applyEcho(primary, point.duration * 0.5)) frames.push(echo);
        }
    }

    frames.sort((a, b) => a.time - b.time);
    return { version: 1, frames };
}

function processVisualScore(intents: DramaturgicalIntentPlan, analysis: TrackAnalysis): VisualChoreographyPlan {
    const motifs = planMotifs(analysis, intents);
    const transitions = planTransitions(motifs, analysis);
    const frames: ChoreographyFrame[] = [];

    for (let motifIndex = 0; motifIndex < motifs.length; motifIndex++) {
        const phrase = motifs[motifIndex];
        const point = findIntentForTime(phrase.startTime, intents.points ?? []);
        const baseActions = INTENT_TO_ACTIONS[point?.intent ?? 'sustain'];
        const spacing = subdivisionSeconds(phrase.subdivision, analysis, phrase.endTime - phrase.startTime);
        const phraseLength = Math.max(0, phrase.endTime - phrase.startTime);
        const sampleCount = phrase.subdivision === 'section' ? 1
            : Math.max(1, Math.min(32, Math.ceil(phraseLength / spacing)));
        const outgoingTransition = transitions.find(transition => transition.fromMotifId === phrase.id);

        for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
            const position = sampleCount === 1 ? 0 : sampleIndex / (sampleCount - 1);
            const grammar = sampleMotifGrammar(phrase, position, sampleIndex);
            const time = phrase.startTime + Math.min(phraseLength, sampleIndex * spacing);
            if (outgoingTransition
                && time >= outgoingTransition.startTime
                && time < outgoingTransition.startTime + outgoingTransition.duration) continue;
            const motifActions = MOTIF_TO_ACTIONS[phrase.motif];
            const combined = mergeActions(
                scaleActions(baseActions, (point?.weight ?? phrase.intensity) * grammar.intensity),
                scaleActions(motifActions, grammar.intensity)
            );
            if (phrase.operators.includes('echo')) combined.echo = Math.max(combined.echo ?? 0, grammar.intensity * 0.35);
            frames.push({
                time,
                actions: applyOperators(combined, phrase.operators),
                activeOperators: grammar.activeOperators,
                motifId: phrase.id,
                motif: phrase.motif,
                motifRole: phrase.role,
                subdivision: phrase.subdivision,
                motifIntensity: grammar.intensity,
                motifDensity: grammar.density,
                motifMotion: grammar.motion,
                novelty: phrase.novelty,
                phrasePosition: grammar.phrasePosition,
                rhythmicPhase: grammar.rhythmicPhase,
                variationSeed: phrase.variationSeed
            });
        }
    }

    // Explicit transition samples make progress meaningful even when motif sampling is
    // section-level. They carry the outgoing motif and never write runtime state directly.
    for (const transition of transitions) {
        const from = motifs.find(motif => motif.id === transition.fromMotifId);
        const to = motifs.find(motif => motif.id === transition.toMotifId);
        if (!from || !to) continue;
        const sampleCount = transitionSampleCount(transition, from, analysis);
        for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
            const progress = sampleIndex / (sampleCount - 1);
            frames.push(transitionFrame(from, to, transition, progress, sampleIndex));
        }
    }

    frames.sort((a, b) => a.time - b.time || ((a.transition?.progress ?? -1) - (b.transition?.progress ?? -1)));
    return { version: 1, frames, score: { version: 1, motifs, transitions } };
}

const MOTIF_TO_ACTIONS: Record<VisualMotif, ActionMap> = {
    'pulse-field': { pulse: 0.9, densify: 0.35 },
    'orbit-system': { orbit: 0.9, merge: 0.25 },
    'tunnel-drive': { accelerate: 0.8, focus: 0.5 },
    'network-bloom': { bloom: 1, expand: 0.6, densify: 0.45 },
    'fragment-cloud': { fragment: 0.9, scatter: 0.65 },
    'wave-ripple': { echo: 0.65, expand: 0.4, slow: 0.25 },
    'grid-scan': { focus: 0.65, pulse: 0.45, accelerate: 0.35 },
    'halo-focus': { focus: 0.9, merge: 0.35 },
    'swarm-motion': { scatter: 0.7, orbit: 0.65, accelerate: 0.45 },
    'void-minimal': { thin: 0.9, slow: 0.75, freeze: 0.3 }
};

function transitionFrame(from: MotifPhrase, to: MotifPhrase, transition: TransitionPhrase, progress: number, sampleIndex: number): ChoreographyFrame {
    const phrasePosition = clamp01((transition.startTime - from.startTime + transition.duration * progress)
        / Math.max(0.001, from.endTime - from.startTime));
    const fromGrammar = sampleMotifGrammar(from, phrasePosition, sampleIndex);
    const toGrammar = sampleMotifGrammar(to, 0, sampleIndex);
    const actions: ActionMap = transition.behavior === 'collapse-release'
        ? progress < 0.5 ? { collapse: 1 - progress * 2, thin: 0.7 } : { bloom: (progress - 0.5) * 2, pulse: progress }
        : transition.behavior === 'echo-out' ? { echo: 1 - progress, thin: progress }
            : transition.behavior === 'freeze-cut' || transition.behavior === 'snap' ? { freeze: 1 - progress, fragment: progress }
                : transition.behavior === 'dissolve' ? { thin: progress, scatter: progress * 0.5 }
                    : transition.behavior === 'phase-shift' ? { fragment: progress, orbit: 1 - progress }
                        : { merge: 1 - progress, expand: progress };
    return {
        time: transition.startTime + transition.duration * (progress === 1 ? 0.999999 : progress),
        actions,
        activeOperators: [...new Set([...fromGrammar.activeOperators, ...toGrammar.activeOperators])],
        motifId: from.id,
        motif: from.motif,
        motifRole: from.role,
        subdivision: from.subdivision,
        transition: {
            behavior: transition.behavior,
            progress,
            preserve: [...transition.preserve],
            fromMotif: from.motif,
            toMotif: to.motif
        },
        motifIntensity: lerp(fromGrammar.intensity, toGrammar.intensity, progress),
        motifDensity: lerp(fromGrammar.density, toGrammar.density, progress),
        motifMotion: lerp(fromGrammar.motion, toGrammar.motion, progress),
        novelty: lerp(from.novelty, to.novelty, progress),
        phrasePosition,
        rhythmicPhase: fromGrammar.rhythmicPhase,
        variationSeed: from.variationSeed
    };
}

function transitionSampleCount(transition: TransitionPhrase, from: MotifPhrase, analysis: TrackAnalysis): number {
    const phraseLength = Math.max(0.001, from.endTime - from.startTime);
    const subdivisionInterval = subdivisionSeconds(from.subdivision, analysis, phraseLength);
    // Long transitions need intermediate resolver targets even when the motif itself
    // uses a coarse bar/section subdivision. One second is the maximum transition step.
    const sampleInterval = Math.max(0.125, Math.min(1, subdivisionInterval));
    return Math.max(3, Math.min(16, Math.ceil(transition.duration / sampleInterval) + 1));
}

function subdivisionSeconds(subdivision: PatternSubdivision, analysis: TrackAnalysis, phraseLength: number): number {
    const beat = 60 / Math.max(40, analysis.tempo || analysis.bpm || 120);
    switch (subdivision) {
        case 'half-beat': return beat * 0.5;
        case 'beat': return beat;
        case 'bar': return beat * 4;
        case 'two-bars': return beat * 8;
        case 'four-bars': return beat * 16;
        case 'phrase': return Math.max(beat * 8, phraseLength / 2);
        case 'section': return Math.max(0.25, phraseLength);
    }
}

function mergeActions(a: ActionMap, b: ActionMap): ActionMap {
    const out: ActionMap = { ...a };
    for (const [action, value] of Object.entries(b)) {
        if (typeof value === 'number') out[action as ChoreographyAction] = clamp01((out[action as ChoreographyAction] ?? 0) + value);
    }
    return out;
}

function scaleActions(actions: ActionMap, weight: number): ActionMap {
    const w = clamp01(weight);
    const out: ActionMap = {};
    for (const [action, intensity] of Object.entries(actions)) {
        if (typeof intensity !== 'number') continue;
        const scaled = clamp01(intensity * w);
        if (scaled >= 0.01) out[action as ChoreographyAction] = scaled;
    }
    return out;
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function lerp(from: number, to: number, progress: number): number {
    return from + (to - from) * clamp01(progress);
}
