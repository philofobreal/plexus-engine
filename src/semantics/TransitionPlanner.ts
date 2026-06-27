import type { MotifPhrase, TrackAnalysis, TransitionBehavior, TransitionPhrase } from '../types';

export function planTransitions(motifs: MotifPhrase[], analysis: TrackAnalysis): TransitionPhrase[] {
    const transitions: TransitionPhrase[] = [];
    const confidence = timingConfidence(analysis);
    const beatSec = 60 / Math.max(40, finite(analysis.tempo || analysis.bpm) || 120);

    for (let index = 1; index < motifs.length; index++) {
        const from = motifs[index - 1];
        const to = motifs[index];
        const fromSection = sectionAt(analysis, from.startTime);
        const toSection = sectionAt(analysis, to.startTime);
        const similar = from.motif === to.motif || to.role === 'memory';
        let behavior: TransitionBehavior;

        if (confidence < 0.45) behavior = from.motif === to.motif ? 'morph' : 'handoff';
        else if (fromSection === 'build' && (toSection === 'drop' || toSection === 'peak')) behavior = 'collapse-release';
        else if ((fromSection === 'drop' || fromSection === 'peak') && toSection === 'break') behavior = to.novelty > 0.55 ? 'dissolve' : 'echo-out';
        else if (fromSection === 'intro' && toSection === 'verse') behavior = 'morph';
        else if (similar) behavior = 'overlay';
        else if (to.novelty > 0.82) behavior = (to.endTime - to.startTime) < beatSec * 2 ? 'snap' : 'freeze-cut';
        else if (to.motif === 'fragment-cloud' || to.motif === 'grid-scan') behavior = 'phase-shift';
        else behavior = 'morph';

        const baseDuration = behavior === 'snap' ? beatSec * 0.25
            : behavior === 'freeze-cut' ? beatSec * 0.5
            : beatSec * (confidence < 0.45 ? 8 : behavior === 'handoff' ? 4 : 2);
        const requestedDuration = clamp(baseDuration, 0.2, confidence < 0.45 ? 8 : 4);
        const boundary = to.startTime;
        const startTime = Math.max(from.startTime, boundary - requestedDuration);
        const duration = Math.max(0.001, boundary - startTime);
        transitions.push({
            fromMotifId: from.id,
            toMotifId: to.id,
            startTime,
            duration,
            behavior,
            curve: behavior === 'snap' || behavior === 'freeze-cut' ? 'snap'
                : behavior === 'collapse-release' ? 'exponential' : 'easeInOut',
            preserve: similar ? ['rhythmPhase', 'density', 'motion']
                : behavior === 'collapse-release' ? ['rhythmPhase']
                    : behavior === 'morph' || behavior === 'handoff' ? ['color', 'spatialAxis'] : []
        });
    }
    return transitions;
}

function sectionAt(analysis: TrackAnalysis, time: number): string {
    return analysis.sections?.find(section => time >= section.start && time < section.end)?.label ?? '';
}

function timingConfidence(analysis: TrackAnalysis): number {
    return clamp(analysis.timingConfidence?.overall ?? analysis.tempoConfidence ?? analysis.gridConfidence ?? 0, 0, 1);
}

function finite(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, finite(value)));
}
