import type { TrackAnalysis } from '../types';

// Musical evidence for automatic automation placement (ADR-005 publication gate).
// Pure and offline: reads only already-published TrackAnalysis cues, novelty peaks, boundary
// candidates and feature frames. It runs no DSP and never invents a cue; the automation layer
// consumes these anchors and only decides where a proposal is published.

export interface CueEvidenceAnchor { time: number; kind: 'cue' | 'novelty' | 'boundary'; confidence: number }
export interface CueContext { before: number; after: number; contrast: number; peak: number }

const finite = (n: number) => Number.isFinite(n);

/** Compare both sides of a proposed cut using immutable, already-published features. No new DSP. */
export function cueContext(analysis: TrackAnalysis, time: number): CueContext {
    const frames = analysis.features ?? [];
    if (!finite(time) || !frames.length || !(analysis.duration > 0)) return { before: 0, after: 0, contrast: 0, peak: 0 };
    const at = (t: number) => Math.max(0, Math.min(frames.length - 1, Math.floor(t / analysis.duration * frames.length)));
    const mean = (start: number, end: number) => {
        const values = [0, 0, 0, 0, 0, 0];
        const a = at(start), b = Math.max(a, at(end));
        for (let i = a; i <= b; i++) {
            const f = frames[i];
            [f.density, f.fx, f.melody, f.vocal, f.brightness, f.tension].forEach((v, j) => values[j] += Number.isFinite(v) ? v : 0);
        }
        return values.map(v => v / (b - a + 1));
    };
    const before = mean(time - 0.5, time - 0.06), after = mean(time + 0.06, time + 0.5), center = mean(time - 0.04, time + 0.04);
    return { before: Math.max(...before), after: Math.max(...after),
        contrast: Math.max(...before.map((v, i) => Math.abs(v - after[i]))),
        peak: Math.max(...center.map((v, i) => v - Math.max(before[i], after[i]))) };
}

export function musicalCueAnchors(analysis: TrackAnalysis): CueEvidenceAnchor[] {
    const anchors: CueEvidenceAnchor[] = [];
    const hasFeatures = (analysis.features?.length ?? 0) > 0;
    // significantMoments is normally a subset of cues; skip entries whose gate inputs are identical.
    const seen = new Set<string>();
    for (const cue of [...(analysis.cues ?? []), ...(analysis.significantMoments ?? [])]) {
        // A percussive-onset cue has its transient evidence in the analyzer, even on a steady groove.
        const onset = cue.kind === 'impact' && !!cue.reasons?.includes('percussive-onset');
        const key = `${cue.time}|${cue.confidence}|${cue.intensity}|${onset}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!finite(cue.time) || cue.time < 0 || cue.time >= analysis.duration || !finite(cue.confidence) ||
            !finite(cue.intensity) || cue.confidence < 0.35 || cue.intensity < 0.12) continue;
        const context = cueContext(analysis, cue.time);
        if (hasFeatures && !onset && context.contrast < 0.035 && context.peak < 0.02) continue;
        anchors.push({ time: cue.time, kind: 'cue', confidence: cue.confidence });
    }
    for (const peak of analysis.noveltyPeaks ?? []) {
        const context = cueContext(analysis, peak.time);
        if (hasFeatures && context.contrast < 0.035 && context.peak < 0.02) continue;
        if (finite(peak.time) && peak.time > 0 && peak.time < analysis.duration && peak.value >= 0.3)
            anchors.push({ time: peak.time, kind: 'novelty', confidence: Math.min(1, peak.value) });
    }
    for (const boundary of analysis.boundaryCandidates ?? []) {
        if (!finite(boundary.time) || boundary.time <= 0 || boundary.time >= analysis.duration || boundary.confidence < 0.4) continue;
        if (hasFeatures && cueContext(analysis, boundary.time).contrast < 0.05) continue;
        anchors.push({ time: boundary.time, kind: 'boundary', confidence: boundary.confidence });
    }
    const sorted = anchors.sort((a, b) => a.time - b.time || b.confidence - a.confidence);
    return sorted.filter((a, i) => i === 0 || a.time !== sorted[i - 1].time);
}
