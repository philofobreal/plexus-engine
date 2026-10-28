import type { TrackAnalysis, TrackSectionLabel } from '../types';
import { featureFrameStepSeconds, normalizeFeatureClock } from '../types/featureClock.ts';

// Musical evidence for automatic automation placement (ADR-005 publication gate).
// Pure and offline: reads only already-published TrackAnalysis cues, novelty peaks, boundary
// candidates and feature frames. It runs no DSP and never invents a cue; the automation layer
// consumes these anchors and only decides where a proposal is published.

export type CueAnchorRole = 'attack' | 'release' | 'structure' | 'melody' | 'vocal' | 'fx' | `section:${TrackSectionLabel}`;
export interface CueEvidenceAnchor {
    time: number; kind: 'cue' | 'novelty' | 'boundary'; confidence: number; roles?: CueAnchorRole[];
    roleEvidence?: Partial<Record<CueAnchorRole, { kind: 'cue' | 'novelty' | 'boundary'; confidence: number }>>;
}
export interface CueContext { before: number; after: number; contrast: number; peak: number }

const finite = (n: number) => Number.isFinite(n);

/** Sustained multifeature contrast across a cut, distinct from a single transient peak.
 * Two post-cut windows must keep the same change against the pre-cut texture. The second
 * largest channel change requires more than one projection, not independent source identity.
 * Exact feature-clock coverage is required for crossing an estimated scene boundary.
 */
export function sustainedCueContrast(analysis: TrackAnalysis, time: number, beat: number): number | undefined {
    const clock = normalizeFeatureClock(analysis);
    if (!clock || !finite(time) || !finite(beat) || beat < 0.2 || beat > 1.5
        || time - 2 * beat < 0 || time + 2 * beat >= analysis.duration) return undefined;
    const step = clock.hopSize / clock.sampleRate;
    const mean = (start: number, end: number): number[] | undefined => {
        const a = Math.ceil(start / step), b = Math.floor(end / step);
        if (b - a < 2) return undefined;
        const sum = [0, 0, 0, 0, 0, 0];
        for (let i = a; i <= b; i++) {
            const f = analysis.features[i];
            if (!f) return undefined;
            const values = [f.density, f.fx, f.melody, f.vocal, f.brightness, f.tension];
            if (values.some(v => !finite(v) || v < 0 || v > 1)) return undefined;
            values.forEach((v, j) => sum[j] += v);
        }
        return sum.map(v => v / (b - a + 1));
    };
    const before = mean(time - 2 * beat, time - 0.25 * beat);
    const early = mean(time + 0.25 * beat, time + beat), late = mean(time + beat, time + 2 * beat);
    if (!before || !early || !late) return undefined;
    const changes = before.map((v, i) => {
        const a = early[i] - v, b = late[i] - v;
        return a * b > 0 ? Math.min(Math.abs(a), Math.abs(b)) : 0;
    });
    return changes.sort((a, b) => b - a)[1];
}

/** Compare both sides of a proposed cut using immutable, already-published features. No new DSP. */
export function cueContext(analysis: TrackAnalysis, time: number): CueContext {
    const frames = analysis.features ?? [];
    if (!finite(time) || !frames.length || !(analysis.duration > 0)) return { before: 0, after: 0, contrast: 0, peak: 0 };
    const frameStep = featureFrameStepSeconds(analysis);
    const at = (t: number) => Math.max(0, Math.min(frames.length - 1, Math.floor(t / frameStep)));
    const mean = (start: number, end: number) => {
        const values = [0, 0, 0, 0, 0, 0];
        const a = at(start), b = Math.max(a, at(end));
        for (let i = a; i <= b; i++) {
            const f = frames[i];
            if (!f) return undefined;
            [f.density, f.fx, f.melody, f.vocal, f.brightness, f.tension].forEach((v, j) => values[j] += Number.isFinite(v) ? v : 0);
        }
        return values.map(v => v / (b - a + 1));
    };
    const before = mean(time - 0.5, time - 0.06), after = mean(time + 0.06, time + 0.5), center = mean(time - 0.04, time + 0.04);
    if (!before || !after || !center) return { before: 0, after: 0, contrast: 0, peak: 0 };
    return { before: Math.max(...before), after: Math.max(...after),
        contrast: Math.max(...before.map((v, i) => Math.abs(v - after[i]))),
        peak: Math.max(...center.map((v, i) => v - Math.max(before[i], after[i]))) };
}

export function musicalCueAnchors(analysis: TrackAnalysis, preserveRoles = false): CueEvidenceAnchor[] {
    const anchors: CueEvidenceAnchor[] = [];
    const hasFeatures = (analysis.features?.length ?? 0) > 0;
    // significantMoments is normally a subset of cues; skip entries whose gate inputs are identical.
    const seen = new Set<string>();
    for (const cue of [...(analysis.cues ?? []), ...(analysis.significantMoments ?? [])]) {
        // A percussive-onset cue has its transient evidence in the analyzer, even on a steady groove.
        const onset = cue.kind === 'impact' && !!cue.reasons?.includes('percussive-onset');
        const key = `${cue.time}|${cue.confidence}|${cue.intensity}|${onset}${preserveRoles ? `|${cue.kind}` : ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!finite(cue.time) || cue.time < 0 || cue.time >= analysis.duration || !finite(cue.confidence) ||
            !finite(cue.intensity) || cue.confidence < 0.35 || cue.intensity < 0.12) continue;
        const context = cueContext(analysis, cue.time);
        if (hasFeatures && !onset && context.contrast < 0.035 && context.peak < 0.02) continue;
        anchors.push({ time: cue.time, kind: 'cue', confidence: cue.confidence,
            ...(preserveRoles ? { roles: [cue.kind === 'impact' ? 'attack' : cue.kind === 'break' ? 'release'
                : cue.kind === 'pattern' ? 'structure' : cue.kind] as CueAnchorRole[] } : {}) });
    }
    for (const peak of analysis.noveltyPeaks ?? []) {
        const context = cueContext(analysis, peak.time);
        if (hasFeatures && context.contrast < 0.035 && context.peak < 0.02) continue;
        if (finite(peak.time) && peak.time > 0 && peak.time < analysis.duration && peak.value >= 0.3)
            anchors.push({ time: peak.time, kind: 'novelty', confidence: Math.min(1, peak.value),
                ...(preserveRoles ? { roles: ['structure'] as CueAnchorRole[] } : {}) });
    }
    for (const boundary of analysis.boundaryCandidates ?? []) {
        if (!finite(boundary.time) || boundary.time <= 0 || boundary.time >= analysis.duration || boundary.confidence < 0.4) continue;
        if (hasFeatures && cueContext(analysis, boundary.time).contrast < 0.05) continue;
        const section = analysis.sections?.find(s => Math.abs(s.start - boundary.time) <= featureFrameStepSeconds(analysis));
        anchors.push({ time: boundary.time, kind: 'boundary', confidence: boundary.confidence,
            ...(preserveRoles ? { roles: ['structure', ...(section ? [`section:${section.label}` as CueAnchorRole] : [])] as CueAnchorRole[] } : {}) });
    }
    const sorted = anchors.sort((a, b) => a.time - b.time || b.confidence - a.confidence);
    if (!preserveRoles) return sorted.filter((a, i) => i === 0 || a.time !== sorted[i - 1].time);
    const grouped: CueEvidenceAnchor[] = [];
    for (const anchor of sorted) {
        const prior = grouped.at(-1);
        if (prior?.time === anchor.time) {
            prior.roles = [...new Set([...(prior.roles ?? []), ...(anchor.roles ?? [])])].sort();
            for (const role of anchor.roles ?? []) {
                const old = prior.roleEvidence![role];
                if (!old || anchor.confidence > old.confidence
                    || (anchor.confidence === old.confidence && anchor.kind < old.kind))
                    prior.roleEvidence![role] = { kind: anchor.kind, confidence: anchor.confidence };
            }
        } else grouped.push({ ...anchor, roles: [...(anchor.roles ?? [])],
            roleEvidence: Object.fromEntries((anchor.roles ?? []).map(role => [role, { kind: anchor.kind, confidence: anchor.confidence }])) });
    }
    return grouped;
}
