import type { AcousticEvidenceIdentity } from '../types/acousticEvidence';
import type { MusicalPartObservation, MusicalEntityOptions, MusicalEntityRegistry,
    MusicalEntityAssignment } from '../types/musicalEntities';

export const MUSICAL_ENTITY_DEFAULTS: Readonly<Required<MusicalEntityOptions>> = Object.freeze({
    sourceMaxDistance: .025, sourceAmbiguityMargin: .005,
    motifMaxRhythmError: .02, motifAmbiguityMargin: .005, maxObservations: 4096
});

const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const overlaps = (a: { startSample: number; endSample: number }, b: { startSample: number; endSample: number }) =>
    a.startSample < b.endSample && b.startSample < a.endSample;

/** First-anchor association with explicit abstention; no instrument/singer classification. */
export function trackMusicalEntities(observations: readonly MusicalPartObservation[],
    identity: AcousticEvidenceIdentity, requested: MusicalEntityOptions = {}): MusicalEntityRegistry {
    const options = { ...MUSICAL_ENTITY_DEFAULTS, ...requested };
    for (const key of ['sourceMaxDistance', 'sourceAmbiguityMargin', 'motifMaxRhythmError', 'motifAmbiguityMargin'] as const)
        if (!Number.isFinite(options[key]) || options[key] < 0 || options[key] > 1) throw new Error('Invalid tracking threshold');
    if (!Number.isSafeInteger(options.maxObservations) || options.maxObservations < 1 || options.maxObservations > 4096
        || observations.length > options.maxObservations) throw new Error('Observation budget exceeded or invalid');
    if (!/^[a-f0-9]{64}$/.test(identity.pcmSha256) || !Number.isSafeInteger(identity.sampleRate)
        || identity.sampleRate < 1000 || identity.sampleRate > 384000 || !Number.isSafeInteger(identity.sampleCount)
        || identity.sampleCount <= 0 || !Number.isFinite(identity.timelineOffsetSeconds) || identity.timelineOffsetSeconds < 0
        || !Number.isFinite(identity.timelineOffsetSeconds + identity.sampleCount / identity.sampleRate))
        throw new Error('Invalid musical entity PCM identity');
    const interval = (a: { startSample: number; endSample: number }, low: number, high: number) =>
        Number.isSafeInteger(a.startSample) && Number.isSafeInteger(a.endSample)
        && a.startSample >= low && a.endSample > a.startSample && a.endSample <= high;
    const ids = new Set<string>();
    for (const o of observations) {
        if (typeof o.id !== 'string' || !o.id || ids.has(o.id) || !interval(o, 0, identity.sampleCount)
            || !['isolated-candidate', 'unresolved-mixture'].includes(o.kind)
            || !['authored-symbolic', 'unqualified-estimate'].includes(o.notesOrigin)
            || !Array.isArray(o.notes) || o.notes.length > 64) throw new Error('Invalid or duplicate part observation');
        ids.add(o.id);
        const d = o.timbre;
        if (d && (d.space !== 'harmonic-amplitude-v1'
            || !interval({ startSample: d.supportStartSample, endSample: d.supportEndSample }, o.startSample, o.endSample)
            || !Number.isFinite(d.fundamentalHz) || d.fundamentalHz <= 0 || 8 * d.fundamentalHz >= .4 * identity.sampleRate
            || !Array.isArray(d.values) || d.values.length !== 8 || Array.from(d.values).some(x => !Number.isFinite(x) || x < 0)
            || Math.abs(d.values.reduce((a, b) => a + b, 0) - 1) > 1e-8)) throw new Error('Invalid harmonic descriptor');
        for (let i = 0; i < o.notes.length; i++) {
            const n = o.notes[i];
            if (!Number.isInteger(n.midi) || n.midi < 0 || n.midi > 127 || !interval(n, o.startSample, o.endSample)
                || (i > 0 && n.startSample < o.notes[i - 1].endSample)) throw new Error('Invalid monophonic phrase notes');
        }
    }
    const sorted = [...observations].sort((a, b) => a.startSample - b.startSample || a.endSample - b.endSample || lexical(a.id, b.id));
    const registry: MusicalEntityRegistry = { version: 1, algorithm: 'experimental-musical-entities-v1', identity: { ...identity },
        options: { ...options }, confidence: null, groundTruthStatus: false, consumerUse: 'diagnostic-only', xrScoring: 'ineligible',
        sources: [], musicalMotifs: [], assignments: [] };
    const sourceAnchors: MusicalPartObservation[] = [], motifAnchors: MusicalPartObservation[] = [];
    const sourceIntervals: MusicalPartObservation[][] = [];
    for (const o of sorted) {
        const a: MusicalEntityAssignment = { observationId: o.id, startSample: o.startSample, endSample: o.endSample,
            sourceId: null, sourceStatus: 'unavailable', sourceAlternatives: [], sourceDistance: null,
            motifId: null, motifStatus: 'unavailable', motifAlternatives: [], transpositionSemitones: null, durationScale: null,
            notesOrigin: o.notesOrigin, reasons: [] };
        if (o.kind === 'unresolved-mixture') a.reasons.push('unresolved-mixture');
        else {
            if (!o.timbre) a.reasons.push('missing-timbre');
            else {
                const candidates = sourceAnchors.map((anchor, index) => ({ index,
                    distance: cosineDistance(o.timbre!.values, anchor.timbre!.values) }))
                    .filter(c => c.distance <= options.sourceMaxDistance).sort((x, y) => x.distance - y.distance || x.index - y.index);
                if (!candidates.length) {
                    const id = `source-${registry.sources.length + 1}`;
                    registry.sources.push({ id, anchorObservationId: o.id, observationIds: [o.id] });
                    sourceAnchors.push(o); sourceIntervals.push([o]);
                    a.sourceId = id; a.sourceStatus = 'new';
                } else {
                    const best = candidates[0];
                    a.sourceDistance = best.distance;
                    const close = candidates.filter(c => c.distance - best.distance <= options.sourceAmbiguityMargin);
                    if (close.length > 1 || sourceIntervals[best.index].some(previous => overlaps(previous, o))) {
                        a.sourceStatus = 'ambiguous'; a.sourceAlternatives = close.map(c => registry.sources[c.index].id);
                        a.reasons.push(close.length > 1 ? 'similar-source-anchors' : 'overlapping-source-match');
                    } else {
                        a.sourceId = registry.sources[best.index].id; a.sourceStatus = 'continued';
                        registry.sources[best.index].observationIds.push(o.id); sourceIntervals[best.index].push(o);
                    }
                }
            }
            if (o.notes.length < 4) a.reasons.push('insufficient-phrase-notes');
            else {
                const candidates = motifAnchors.map((anchor, index) => ({ index, error: rhythmError(o, anchor) }))
                    .filter(c => c.error <= options.motifMaxRhythmError).sort((x, y) => x.error - y.error || x.index - y.index);
                if (!candidates.length) {
                    const id = `musical-motif-${registry.musicalMotifs.length + 1}`;
                    registry.musicalMotifs.push({ id, anchorObservationId: o.id, observationIds: [o.id] }); motifAnchors.push(o);
                    a.motifId = id; a.motifStatus = 'new'; a.transpositionSemitones = 0; a.durationScale = 1;
                } else {
                    const best = candidates[0], close = candidates.filter(c => c.error - best.error <= options.motifAmbiguityMargin);
                    if (close.length > 1) {
                        a.motifStatus = 'ambiguous'; a.motifAlternatives = close.map(c => registry.musicalMotifs[c.index].id);
                        a.reasons.push('similar-musical-motifs');
                    } else {
                        const anchor = motifAnchors[best.index];
                        a.motifId = registry.musicalMotifs[best.index].id; a.motifStatus = 'recurrence';
                        a.transpositionSemitones = o.notes[0].midi - anchor.notes[0].midi;
                        a.durationScale = phraseDuration(o) / phraseDuration(anchor);
                        registry.musicalMotifs[best.index].observationIds.push(o.id);
                    }
                }
            }
        }
        registry.assignments.push(a);
    }
    return registry;
}

function cosineDistance(a: number[], b: number[]): number {
    let dot = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
    return Math.max(0, Math.min(1, 1 - dot / Math.sqrt(aa * bb)));
}

const phraseDuration = (o: MusicalPartObservation) => o.notes.at(-1)!.endSample - o.notes[0].startSample;
function rhythmError(a: MusicalPartObservation, b: MusicalPartObservation): number {
    if (a.notes.length !== b.notes.length) return Infinity;
    const durationA = phraseDuration(a), durationB = phraseDuration(b);
    let error = 0;
    for (let i = 0; i < a.notes.length; i++) {
        const x = a.notes[i], y = b.notes[i];
        if (x.midi - a.notes[0].midi !== y.midi - b.notes[0].midi) return Infinity;
        error = Math.max(error, Math.abs((x.startSample - a.notes[0].startSample) / durationA - (y.startSample - b.notes[0].startSample) / durationB),
            Math.abs((x.endSample - x.startSample) / durationA - (y.endSample - y.startSample) / durationB));
    }
    return error;
}
