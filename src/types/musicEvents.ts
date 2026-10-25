import type { BeatEvent } from './index';
import type { FeatureClock } from './featureClock';

export type AcousticTexture = 'tonal' | 'broadband' | 'mixed' | 'unknown';
/** Observed crossing of prefix-referenced short energy; not an isolated-source onset. */
export interface QuietOnset {
    algorithm: 'quiet-prefix-energy-v1'; sampleIndex: number;
    prefixSamples: [number, number]; supportSamples: [number, number];
    prefixPower: number; thresholdPower: number; crossingPower: number;
    decisionSample: number; // Full-track publication, not a streaming deadline.
}
export interface AcousticAttack {
    id: string;
    sampleIndex: number;
    observationFrame: number; // Frame that triggered the energy-rise candidate (localization can reach its predecessor).
    time: number;
    supportSamples: [number, number];
    familySupportSamples: [number, number];
    family: AcousticTexture; // Legacy ~60ms context texture, not the isolated attack spectrum.
    strengthRms: number; // AC RMS amplitude of the observed window, not normalized confidence.
    powerRatio: number;
    quietOnset?: QuietOnset;
}
export interface AcousticActivityLayer {
    algorithm: 'acoustic-activity-v1';
    source: 'analysis-pcm';
    clock: FeatureClock;
    confidence: null;
    consumerUse: 'signal-evidence-only';
    xrScoring: 'ineligible';
    capabilities: { attacks: 'energy-rise-candidates'; offsets: 'activity-boundaries'; sustain: 'activity-span';
        family: 'spectral-texture'; dominance: 'acoustic-texture'; noteIdentity: 'unsupported'; vocal: 'unsupported' };
    activity: {
        id: string; startSample: number; endSample: number;
        onsetSupportSamples: [number, number] | null;
        offsetSupportSamples: [number, number] | null;
        sustainSamples: [number, number] | null;
        leftCensored: boolean; rightCensored: boolean;
    }[];
    attacks: AcousticAttack[];
    dominance: { startSample: number; endSample: number; texture: AcousticTexture | 'silence'; decisionSample: number }[];
    attackChanges?: AttackChangeLayer;
    entryContexts?: EntryContextLayer;
    bandActivity?: EntryBandActivityLayer;
    spectralEntries?: SpectralEntryLayer; // Absent in T11b/legacy payloads.
}

/** Short-window positive spectral change, never a sound-family or source classifier.
 * v1 binds the legacy attack time; v2 prefers its qualified quietOnset, else legacy time.
 */
export interface AttackChangeLayer {
    algorithm: 'attack-local-excess-v1' | 'attack-local-excess-v2'; confidence: null;
    consumerUse: 'signal-evidence-only'; xrScoring: 'ineligible';
    scope: 'local-window-positive-spectrum'; sourceOwnership: 'unresolved'; publication: 'full-track-analysis';
    windowSize: number | null;
    records: {
        attackId: string; prefixSamples: [number, number] | null; bodySamples: [number, number] | null;
        decisionSample: number;
        status: 'measured' | 'below-floor' | 'file-boundary' | 'insufficient-resolution';
        positivePower: number | null; positivePowerFraction: number | null;
        peakBin: number | null; peakNeighborhoodFraction: number | null;
    }[];
}
/** Same bounded engineering window policy at producer and untrusted-payload boundary. */
export function attackChangeWindowSize(sampleRate: number, hopSize: number): number | null {
    const size = Math.min(512, hopSize, 2 ** Math.floor(Math.log2(.016 * sampleRate)));
    return size >= 128 && size / sampleRate >= .008 ? size : null;
}

export type EntryNeighborhood = 'occupied-neighborhood' | 'unoccupied-neighborhood' | 'uncertain';
/** Contract classification of two measured engineering values, never source/note identity. */
export function classifyEntryNeighborhood(prefixPower: number, ratio: number): EntryNeighborhood {
    if (prefixPower > 1e-10 && ratio >= .025) return 'occupied-neighborhood';
    if (prefixPower <= 1e-10 && ratio <= .0025) return 'unoccupied-neighborhood';
    return 'uncertain';
}
export interface EntryContextLayer {
    algorithm: 'entry-prefix-neighborhood-v1'; confidence: null;
    consumerUse: 'signal-evidence-only'; xrScoring: 'ineligible';
    scope: 'dominant-excess-neighborhood'; sourceOwnership: 'unresolved'; publication: 'full-track-analysis';
    records: {
        entryId: string; peakBin: number; prefixSamples: [number, number]; seedSamples: [number, number];
        decisionSample: number; // Full-track publication; seedSamples marks the actual measurement window.
        prefixPower: number; prefixToSeedPowerRatio: number; context: EntryNeighborhood;
    }[];
}

/** Activity in entry-frozen bins. Same-band overlap can outlive the original sound. */
export interface EntryBandActivityLayer {
    algorithm: 'entry-fixed-band-activity-v1'; confidence: null;
    consumerUse: 'signal-evidence-only'; xrScoring: 'ineligible';
    scope: 'frozen-frequency-mask'; sourceOwnership: 'unresolved';
    records: {
        entryId: string; startSample: number; bins: number[];
        maskSupportSamples: [number, number]; endSample: number | null;
        offsetSupportSamples: [number, number] | null; decisionSample: number;
        rightCensored: boolean; endReason: 'quiet-windows' | 'file-boundary' | 'budget-exceeded';
    }[];
}

export interface SpectralEntryLayer {
    algorithm: 'tonal-carrier-entry-v1';
    confidence: null;
    consumerUse: 'signal-evidence-only';
    xrScoring: 'ineligible';
    candidates: {
        id: string; sampleIndex: number; time: number; observationFrame: number;
        prefixSamples: [number, number]; supportSamples: [number, number];
        bodySamples: [number, number]; decisionSample: number; // Local body gate; final dedup/publication is retrospective.
        texture: AcousticTexture; // Positive spectral excess, not an instrument/source label.
        positivePowerFraction: number; carrierPowerRatio: number; // Engineering ratios, not probabilities.
        backgroundResidualFraction: number;
    }[];
}

/** A traceable projection of accepted visual hits, never a new acoustic detector. */
export interface TimedMusicEvent {
    id: string; // Stable within this analysis, not a cross-file source identity.
    acceptedEventIndex: number;
    sampleIndex: number;
    time: number;
    supportSamples: [number, number]; // Half-open observed feature window, clipped to real PCM.
    uncertaintySamples: [number, number]; // Engineering window bounds, not a confidence interval.
    phase: 'accepted-attack';
    family: 'transient'; // Type 3 can be an FX transient; do not claim instrument identity.
    strength: number; // Original engineering intensity, not probability.
    legacyType: BeatEvent['type'];
}

export interface MusicEventLayer {
    algorithm: 'accepted-visual-events-v1';
    source: 'accepted-visual';
    idScope: 'this-analysis';
    clock: FeatureClock;
    confidence: null;
    capabilities: { acousticOnset: 'unverified'; tonal: 'unsupported'; vocal: 'unsupported'; dominance: 'unknown' };
    events: TimedMusicEvent[];
}

/** No inference from melody/vocal scores, pitch changes, extrapolated beats or missing hits. */
export function projectAcceptedMusicEvents(events: readonly BeatEvent[], clock: FeatureClock): MusicEventLayer {
    if (!Number.isSafeInteger(clock.sampleRate) || clock.sampleRate < 1000 || clock.sampleRate > 384000
        || !Number.isSafeInteger(clock.sampleCount) || clock.sampleCount <= 0
        || !Number.isSafeInteger(clock.hopSize) || clock.hopSize < 4 || clock.hopSize > 65536
        || !Number.isInteger(Math.log2(clock.hopSize)) || clock.windowSize !== clock.hopSize
        || clock.originSample !== 0 || clock.timestamp !== 'window-start' || clock.tailPolicy !== 'zero-pad')
        throw new Error('Invalid music event clock');
    let previousTime = -1;
    const projected = events.map((event, index): TimedMusicEvent => {
        const sampleIndex = Math.round(event.time * clock.sampleRate);
        if (!Number.isFinite(event.time) || event.time <= previousTime || event.time < 0
            || event.time >= clock.sampleCount / clock.sampleRate || sampleIndex >= clock.sampleCount
            || Math.abs(event.time - sampleIndex / clock.sampleRate) > 1e-9
            || !Number.isFinite(event.intensity) || event.intensity < 0 || ![1, 2, 3].includes(event.type))
            throw new Error('Invalid accepted music event');
        previousTime = event.time;
        const start = Math.floor(sampleIndex / clock.hopSize) * clock.hopSize;
        const end = Math.min(clock.sampleCount, start + clock.windowSize);
        return { id: `accepted:${index}:${sampleIndex}`, acceptedEventIndex: index, sampleIndex, time: event.time,
            supportSamples: [start, end], uncertaintySamples: [start, end], phase: 'accepted-attack',
            family: 'transient', strength: event.intensity, legacyType: event.type };
    });
    return { algorithm: 'accepted-visual-events-v1', source: 'accepted-visual', idScope: 'this-analysis',
        clock: { ...clock }, confidence: null,
        capabilities: { acousticOnset: 'unverified', tonal: 'unsupported', vocal: 'unsupported', dominance: 'unknown' },
        events: projected };
}

/** Validate the entire sidecar and its association; malformed/unsupported layers fail closed. */
export function normalizeMusicEvents(value: MusicEventLayer | undefined, clock: FeatureClock | undefined,
    accepted?: readonly BeatEvent[]): MusicEventLayer | undefined {
    if (!value || !clock || value.algorithm !== 'accepted-visual-events-v1' || value.source !== 'accepted-visual'
        || value.idScope !== 'this-analysis' || value.confidence !== null || !Array.isArray(value.events)
        || !value.clock || Object.keys(clock).some(key => value.clock[key as keyof FeatureClock] !== clock[key as keyof FeatureClock])
        || value.capabilities?.acousticOnset !== 'unverified' || value.capabilities?.tonal !== 'unsupported'
        || value.capabilities?.vocal !== 'unsupported' || value.capabilities?.dominance !== 'unknown') return undefined;
    try {
        const result = projectAcceptedMusicEvents(accepted ?? value.events.map(e => ({ time: e.time, intensity: e.strength, type: e.legacyType })), clock);
        if (result.events.length !== value.events.length) return undefined;
        for (let i = 0; i < result.events.length; i++) {
            const a = result.events[i], b = value.events[i];
            if (!b || a.id !== b.id || a.acceptedEventIndex !== b.acceptedEventIndex || a.sampleIndex !== b.sampleIndex
                || a.time !== b.time || a.strength !== b.strength || a.legacyType !== b.legacyType
                || b.phase !== a.phase || b.family !== a.family
                || b.supportSamples?.length !== 2 || b.uncertaintySamples?.length !== 2
                || b.supportSamples[0] !== a.supportSamples[0] || b.supportSamples[1] !== a.supportSamples[1]
                || b.uncertaintySamples[0] !== a.uncertaintySamples[0] || b.uncertaintySamples[1] !== a.uncertaintySamples[1]) return undefined;
        }
        return result;
    } catch { return undefined; }
}

/** Fail closed on forged musical identity, invalid clocks, gaps and unbounded/overlapping records. */
export function normalizeAcousticActivity(value: AcousticActivityLayer | undefined, clock: FeatureClock | undefined): AcousticActivityLayer | undefined {
    if (!value || !clock || value.algorithm !== 'acoustic-activity-v1' || value.source !== 'analysis-pcm' || value.confidence !== null
        || value.consumerUse !== 'signal-evidence-only' || value.xrScoring !== 'ineligible'
        || !value.clock || Object.keys(clock).some(k => value.clock[k as keyof FeatureClock] !== clock[k as keyof FeatureClock])
        || !Array.isArray(value.activity) || !Array.isArray(value.attacks) || !Array.isArray(value.dominance)) return undefined;
    const capabilities: AcousticActivityLayer['capabilities'] = { attacks: 'energy-rise-candidates', offsets: 'activity-boundaries',
        sustain: 'activity-span', family: 'spectral-texture', dominance: 'acoustic-texture', noteIdentity: 'unsupported', vocal: 'unsupported' };
    if (Object.keys(capabilities).some(k => value.capabilities?.[k as keyof typeof capabilities] !== capabilities[k as keyof typeof capabilities])) return undefined;
    try {
        projectAcceptedMusicEvents([], clock); // Same strict original-PCM clock domain as T11a.
        const length = clock.sampleCount, bound = Math.ceil(length / clock.hopSize);
        if (value.activity.length > bound || value.attacks.length > bound || value.dominance.length > bound + 1 || !value.dominance.length) return undefined;
        const interval = (x: unknown): x is [number, number] => Array.isArray(x) && x.length === 2
            && Number.isSafeInteger(x[0]) && Number.isSafeInteger(x[1]) && x[0] >= 0 && x[0] < x[1] && x[1] <= length;
        const textures = ['tonal', 'broadband', 'mixed', 'unknown'];
        const textureAvailable = clock.hopSize >= 512 && clock.hopSize / clock.sampleRate >= .015;
        const pair = (a: [number, number] | null, b: [number, number] | null) =>
            a === null || b === null ? a === b : a.length === 2 && a[0] === b[0] && a[1] === b[1];
        for (let i = 0; i < value.activity.length; i++) {
            const a = value.activity[i];
            if (!a || !interval([a.startSample, a.endSample]) || a.id !== `activity:${a.startSample}`
                || (i > 0 && a.startSample < value.activity[i - 1].endSample)
                || a.leftCensored !== (a.startSample === 0) || typeof a.rightCensored !== 'boolean'
                || a.startSample % clock.hopSize !== 0
                || (!a.rightCensored && (a.endSample % clock.hopSize !== 0 || a.endSample + 2 * clock.hopSize > length))
                || (a.rightCensored && (a.endSample !== length || i !== value.activity.length - 1))
                || (a.leftCensored ? a.onsetSupportSamples !== null : !interval(a.onsetSupportSamples)
                    || a.onsetSupportSamples[0] > a.startSample || a.onsetSupportSamples[1] <= a.startSample)
                || (a.rightCensored ? a.offsetSupportSamples !== null : !interval(a.offsetSupportSamples)
                    || a.offsetSupportSamples[0] > a.endSample || a.offsetSupportSamples[1] < a.endSample)
                || !pair(a.onsetSupportSamples, a.leftCensored ? null : [Math.max(0, a.startSample - clock.hopSize), Math.min(length, a.startSample + clock.hopSize)])
                || !pair(a.offsetSupportSamples, a.rightCensored ? null : [Math.max(a.startSample, a.endSample - clock.hopSize), Math.min(length, a.endSample + clock.hopSize)])
                || !pair(a.sustainSamples, a.endSample - a.startSample >= Math.ceil(.12 * clock.sampleRate) ? [a.startSample, a.endSample] : null)) return undefined;
        }
        let spanIndex = 0;
        for (let i = 0; i < value.attacks.length; i++) {
            const a = value.attacks[i];
            if (a) while (spanIndex < value.activity.length && value.activity[spanIndex].endSample <= a.sampleIndex) spanIndex++;
            const frame = a?.observationFrame ?? 0, start = frame * clock.hopSize;
            if (!a || !Number.isSafeInteger(a.sampleIndex) || a.sampleIndex < 0 || a.sampleIndex >= length
                || !Number.isSafeInteger(frame) || frame <= 0 || frame >= bound
                || (i > 0 && frame <= value.attacks[i - 1].observationFrame)
                || a.sampleIndex < start - clock.hopSize || a.sampleIndex >= Math.min(length, start + clock.hopSize)
                || a.id !== `acoustic:${a.sampleIndex}` || a.time !== a.sampleIndex / clock.sampleRate
                || (i > 0 && a.sampleIndex - value.attacks[i - 1].sampleIndex < Math.ceil(.06 * clock.sampleRate)) || !interval(a.supportSamples)
                || a.supportSamples[0] > a.sampleIndex || a.supportSamples[1] <= a.sampleIndex
                || !interval(a.familySupportSamples) || !textures.includes(a.family) || (!textureAvailable && a.family !== 'unknown')
                || !pair(a.supportSamples, [Math.max(0, start - clock.hopSize - Math.max(1, Math.round(.002 * clock.sampleRate))), Math.min(length, start + clock.hopSize + Math.max(1, Math.round(.002 * clock.sampleRate)))])
                || !pair(a.familySupportSamples, [start, Math.min(length, (frame + Math.max(1, Math.ceil(.06 * clock.sampleRate / clock.hopSize)) + 1) * clock.hopSize)])
                || !Number.isFinite(a.strengthRms) || a.strengthRms < 0 || a.strengthRms > 8
                || !Number.isFinite(a.powerRatio) || a.powerRatio < 0
                || spanIndex >= value.activity.length || a.sampleIndex < value.activity[spanIndex].startSample) return undefined;
        }
        for (const a of value.attacks) if (a.quietOnset !== undefined) {
            const q = a.quietOnset, h = clock.hopSize, start = a.observationFrame * h;
            const radius = Math.max(1, Math.round(.002 * clock.sampleRate));
            if (!q || Object.keys(q).some(k => !['algorithm', 'sampleIndex', 'prefixSamples', 'supportSamples', 'prefixPower', 'thresholdPower', 'crossingPower', 'decisionSample'].includes(k))
                || q.algorithm !== 'quiet-prefix-energy-v1' || h < radius || start + h > length
                || !Number.isSafeInteger(q.sampleIndex) || q.sampleIndex < start || q.sampleIndex >= start + h
                || !pair(q.prefixSamples, [start - h, start])
                || !pair(q.supportSamples, [q.sampleIndex - radius + 1, q.sampleIndex + 1])
                || !Number.isFinite(q.prefixPower) || q.prefixPower < 0 || q.prefixPower > 1e-10
                || q.thresholdPower !== Math.max(1e-10, 4 * q.prefixPower)
                || !Number.isFinite(q.crossingPower) || q.crossingPower <= q.thresholdPower || q.crossingPower > 256
                || q.decisionSample !== length) return undefined;
        }
        for (let i = 0; i < value.dominance.length; i++) {
            const a = value.dominance[i];
            if (!a || !interval([a.startSample, a.endSample]) || ![...textures, 'silence'].includes(a.texture)
                || a.startSample !== (i ? value.dominance[i - 1].endSample : 0)
                || (i && a.texture === value.dominance[i - 1].texture)
                || (!textureAvailable && !['unknown', 'silence'].includes(a.texture))
                || a.startSample % clock.hopSize !== 0
                || (i === 0 && (a.texture !== 'unknown' || a.decisionSample !== 0))
                || (i > 0 && a.decisionSample !== Math.min(length, a.startSample + clock.hopSize))
                || (i === 1 && a.startSample < (Math.max(2, Math.ceil(.08 * clock.sampleRate / clock.hopSize)) - 1) * clock.hopSize)
                || (i > 1 && a.startSample - value.dominance[i - 1].startSample < .2 * clock.sampleRate)
                || (i === value.dominance.length - 1 && a.endSample !== length)) return undefined;
        }
        let attackChanges: AttackChangeLayer | undefined;
        if (value.attackChanges !== undefined) {
            const layer = value.attackChanges, size = attackChangeWindowSize(clock.sampleRate, clock.hopSize);
            if (!layer || !['attack-local-excess-v1', 'attack-local-excess-v2'].includes(layer.algorithm) || layer.confidence !== null
                || layer.consumerUse !== 'signal-evidence-only' || layer.xrScoring !== 'ineligible'
                || layer.scope !== 'local-window-positive-spectrum' || layer.sourceOwnership !== 'unresolved'
                || layer.publication !== 'full-track-analysis' || layer.windowSize !== size
                || !Array.isArray(layer.records) || layer.records.length !== value.attacks.length) return undefined;
            for (let i = 0; i < layer.records.length; i++) {
                const a = layer.records[i], attack = value.attacks[i];
                const anchor = layer.algorithm === 'attack-local-excess-v2' ? attack.quietOnset?.sampleIndex ?? attack.sampleIndex : attack.sampleIndex;
                const bodyStart = anchor - Math.ceil(.002 * clock.sampleRate);
                const prefixEnd = bodyStart - Math.ceil(.004 * clock.sampleRate);
                const boundary = size !== null && (prefixEnd - size < 0 || bodyStart + size > length);
                if (!a || a.attackId !== attack.id || a.decisionSample !== length) return undefined;
                if (size === null || boundary) {
                    if (a.status !== (size === null ? 'insufficient-resolution' : 'file-boundary')
                        || a.prefixSamples !== null || a.bodySamples !== null || a.positivePower !== null
                        || a.positivePowerFraction !== null || a.peakBin !== null || a.peakNeighborhoodFraction !== null) return undefined;
                } else {
                    if (!pair(a.prefixSamples, [prefixEnd - size, prefixEnd]) || !pair(a.bodySamples, [bodyStart, bodyStart + size])
                        || !Number.isFinite(a.positivePower) || a.positivePower! < 0
                        || !Number.isFinite(a.positivePowerFraction) || a.positivePowerFraction! < 0 || a.positivePowerFraction! > 1
                        || (a.positivePower === 0) !== (a.positivePowerFraction === 0)) return undefined;
                    if (a.positivePower! <= 1e-10) {
                        if (a.status !== 'below-floor' || a.peakBin !== null || a.peakNeighborhoodFraction !== null) return undefined;
                    } else if (a.status !== 'measured' || a.positivePowerFraction! <= 0
                        || !Number.isSafeInteger(a.peakBin) || a.peakBin! < 1 || a.peakBin! >= size / 2
                        || !Number.isFinite(a.peakNeighborhoodFraction) || a.peakNeighborhoodFraction! < 1 / (size / 2 - 1)
                        || a.peakNeighborhoodFraction! > 1) return undefined;
                }
            }
            attackChanges = { algorithm: layer.algorithm, confidence: null, consumerUse: 'signal-evidence-only', xrScoring: 'ineligible',
                scope: layer.scope, sourceOwnership: 'unresolved', publication: 'full-track-analysis', windowSize: size,
                records: layer.records.map(a => ({ attackId: a.attackId,
                    prefixSamples: a.prefixSamples && [...a.prefixSamples], bodySamples: a.bodySamples && [...a.bodySamples],
                    decisionSample: a.decisionSample, status: a.status, positivePower: a.positivePower,
                    positivePowerFraction: a.positivePowerFraction, peakBin: a.peakBin, peakNeighborhoodFraction: a.peakNeighborhoodFraction })) };
        }
        let spectralEntries: SpectralEntryLayer | undefined;
        if (value.spectralEntries !== undefined) {
            const layer = value.spectralEntries;
            if (!layer || layer.algorithm !== 'tonal-carrier-entry-v1' || layer.confidence !== null
                || layer.consumerUse !== 'signal-evidence-only' || layer.xrScoring !== 'ineligible'
                || !Array.isArray(layer.candidates) || layer.candidates.length > bound) return undefined;
            let activity = 0, energy = 0;
            for (let i = 0; i < layer.candidates.length; i++) {
                const a = layer.candidates[i], hop = clock.hopSize, fs = clock.sampleRate, frame = a?.observationFrame, anchor = frame * hop;
                if (!a || !textureAvailable || !Number.isSafeInteger(frame) || frame < 3 || (frame + 3) * hop > length
                    || !Number.isSafeInteger(a.sampleIndex) || a.sampleIndex < anchor - hop || a.sampleIndex >= anchor + hop
                    || a.id !== `entry:${a.sampleIndex}` || a.time !== a.sampleIndex / fs
                    || (i > 0 && (frame <= layer.candidates[i - 1].observationFrame || a.sampleIndex - layer.candidates[i - 1].sampleIndex < Math.ceil(.15 * fs)))
                    || !pair(a.prefixSamples, [(frame - 3) * hop, anchor - hop])
                    || !pair(a.bodySamples, [anchor, (frame + 3) * hop]) || a.decisionSample !== (frame + 3) * hop
                    || !pair(a.supportSamples, [(frame - 3) * hop, (frame + 3) * hop])
                    || !['tonal', 'broadband', 'mixed'].includes(a.texture)
                    || !Number.isFinite(a.positivePowerFraction) || a.positivePowerFraction < .005 || a.positivePowerFraction > 1
                    || !Number.isFinite(a.carrierPowerRatio) || a.carrierPowerRatio < .8
                    || !Number.isFinite(a.backgroundResidualFraction) || a.backgroundResidualFraction < 0 || a.backgroundResidualFraction > .05) return undefined;
                while (activity < value.activity.length && value.activity[activity].endSample <= a.sampleIndex) activity++;
                if (activity >= value.activity.length || a.sampleIndex < value.activity[activity].startSample) return undefined;
                const low = Math.min((frame - 3) * hop, a.sampleIndex - .06 * fs), high = Math.max((frame + 1) * hop, a.sampleIndex + .06 * fs);
                while (energy < value.attacks.length && value.attacks[energy].sampleIndex < low) energy++;
                if (energy < value.attacks.length && value.attacks[energy].sampleIndex <= high) return undefined;
            }
            spectralEntries = { algorithm: layer.algorithm, confidence: null, consumerUse: 'signal-evidence-only', xrScoring: 'ineligible',
                candidates: layer.candidates.map(a => ({ id: a.id, sampleIndex: a.sampleIndex, time: a.time, observationFrame: a.observationFrame,
                    prefixSamples: [...a.prefixSamples], supportSamples: [...a.supportSamples], texture: a.texture,
                    bodySamples: [...a.bodySamples], decisionSample: a.decisionSample,
                    positivePowerFraction: a.positivePowerFraction, carrierPowerRatio: a.carrierPowerRatio, backgroundResidualFraction: a.backgroundResidualFraction })) };
        }
        let entryContexts: EntryContextLayer | undefined;
        if (value.entryContexts !== undefined) {
            const layer = value.entryContexts, entries = spectralEntries?.candidates, hop = clock.hopSize;
            if (!layer || layer.algorithm !== 'entry-prefix-neighborhood-v1' || layer.confidence !== null
                || layer.consumerUse !== 'signal-evidence-only' || layer.xrScoring !== 'ineligible'
                || layer.scope !== 'dominant-excess-neighborhood' || layer.sourceOwnership !== 'unresolved' || layer.publication !== 'full-track-analysis'
                || !entries || !Array.isArray(layer.records) || layer.records.length !== entries.length) return undefined;
            for (let i = 0; i < entries.length; i++) {
                const a = layer.records[i], e = entries[i];
                if (!a || a.entryId !== e.id || !Number.isSafeInteger(a.peakBin) || a.peakBin < 1 || a.peakBin >= hop / 2
                    || !pair(a.prefixSamples, e.prefixSamples) || !pair(a.seedSamples, [e.bodySamples[0], e.bodySamples[0] + hop])
                    || a.decisionSample !== length || !Number.isFinite(a.prefixPower) || a.prefixPower < 0
                    || !Number.isFinite(a.prefixToSeedPowerRatio) || a.prefixToSeedPowerRatio < 0
                    || a.context !== classifyEntryNeighborhood(a.prefixPower, a.prefixToSeedPowerRatio)) return undefined;
            }
            entryContexts = { algorithm: layer.algorithm, confidence: null, consumerUse: 'signal-evidence-only', xrScoring: 'ineligible',
                scope: 'dominant-excess-neighborhood', sourceOwnership: 'unresolved', publication: 'full-track-analysis', records: layer.records.map(a => ({
                    entryId: a.entryId, peakBin: a.peakBin, prefixSamples: [...a.prefixSamples], seedSamples: [...a.seedSamples],
                    decisionSample: a.decisionSample, prefixPower: a.prefixPower, prefixToSeedPowerRatio: a.prefixToSeedPowerRatio, context: a.context })) };
        }
        let bandActivity: EntryBandActivityLayer | undefined;
        if (value.bandActivity !== undefined) {
            const layer = value.bandActivity, entries = spectralEntries?.candidates, hop = clock.hopSize;
            if (!layer || layer.algorithm !== 'entry-fixed-band-activity-v1' || layer.confidence !== null
                || layer.consumerUse !== 'signal-evidence-only' || layer.xrScoring !== 'ineligible'
                || layer.scope !== 'frozen-frequency-mask' || layer.sourceOwnership !== 'unresolved'
                || !entries || !Array.isArray(layer.records) || layer.records.length !== entries.length) return undefined;
            for (let i = 0; i < entries.length; i++) {
                const a = layer.records[i], e = entries[i], anchor = e.observationFrame * hop;
                if (!a || a.entryId !== e.id || a.startSample !== e.sampleIndex
                    || !pair(a.maskSupportSamples, [(e.observationFrame - 3) * hop, anchor + hop])
                    || !Array.isArray(a.bins) || a.bins.length > 18
                    || Array.from(a.bins).some((b, j) => !Number.isSafeInteger(b) || b < 1 || b >= hop / 2 || (j > 0 && b <= a.bins[j - 1]))) return undefined;
                if (a.endReason === 'budget-exceeded') {
                    if (a.bins.length || a.endSample !== null || a.offsetSupportSamples !== null
                        || a.rightCensored !== true || a.decisionSample !== e.decisionSample) return undefined;
                } else {
                    if (!a.bins.length || !Number.isSafeInteger(a.endSample) || a.endSample! <= a.startSample || a.endSample! > length) return undefined;
                    if (a.endReason === 'file-boundary') {
                        if (a.endSample !== length || a.offsetSupportSamples !== null || a.rightCensored !== true || a.decisionSample !== length) return undefined;
                    } else if (a.endReason === 'quiet-windows') {
                        const end = a.endSample!;
                        if (a.rightCensored !== false || end < anchor + hop || end % hop !== 0 || end + 2 * hop > length
                            || !pair(a.offsetSupportSamples, [Math.max(anchor, end - hop), end + 2 * hop])
                            || a.decisionSample !== Math.max(e.decisionSample, end + 2 * hop)) return undefined;
                    } else return undefined;
                }
            }
            bandActivity = { algorithm: layer.algorithm, confidence: null, consumerUse: 'signal-evidence-only', xrScoring: 'ineligible',
                scope: 'frozen-frequency-mask', sourceOwnership: 'unresolved', records: layer.records.map(a => ({
                    entryId: a.entryId, startSample: a.startSample, bins: [...a.bins], maskSupportSamples: [...a.maskSupportSamples],
                    endSample: a.endSample, offsetSupportSamples: a.offsetSupportSamples && [...a.offsetSupportSamples],
                    decisionSample: a.decisionSample, rightCensored: a.rightCensored, endReason: a.endReason })) };
        }
        if (entryContexts && bandActivity) for (let i = 0; i < entryContexts.records.length; i++) {
            const band = bandActivity.records[i];
            if (band.endReason !== 'budget-exceeded' && !band.bins.includes(entryContexts.records[i].peakBin)) return undefined;
        }
        return { algorithm: value.algorithm, source: 'analysis-pcm', clock: { ...clock }, confidence: null, consumerUse: 'signal-evidence-only', xrScoring: 'ineligible', capabilities,
            ...(spectralEntries ? { spectralEntries } : {}),
            ...(bandActivity ? { bandActivity } : {}),
            ...(entryContexts ? { entryContexts } : {}),
            ...(attackChanges ? { attackChanges } : {}),
            activity: value.activity.map(a => ({ id: a.id, startSample: a.startSample, endSample: a.endSample,
                onsetSupportSamples: a.onsetSupportSamples && [...a.onsetSupportSamples], offsetSupportSamples: a.offsetSupportSamples && [...a.offsetSupportSamples],
                sustainSamples: a.sustainSamples && [...a.sustainSamples], leftCensored: a.leftCensored, rightCensored: a.rightCensored })),
            attacks: value.attacks.map(a => ({ id: a.id, observationFrame: a.observationFrame, sampleIndex: a.sampleIndex, time: a.time, supportSamples: [...a.supportSamples],
                familySupportSamples: [...a.familySupportSamples], family: a.family, strengthRms: a.strengthRms, powerRatio: a.powerRatio,
                ...(a.quietOnset ? { quietOnset: { algorithm: a.quietOnset.algorithm, sampleIndex: a.quietOnset.sampleIndex,
                    prefixSamples: [...a.quietOnset.prefixSamples], supportSamples: [...a.quietOnset.supportSamples], prefixPower: a.quietOnset.prefixPower,
                    thresholdPower: a.quietOnset.thresholdPower, crossingPower: a.quietOnset.crossingPower, decisionSample: a.quietOnset.decisionSample } } : {}) })),
            dominance: value.dominance.map(a => ({ startSample: a.startSample, endSample: a.endSample, texture: a.texture, decisionSample: a.decisionSample })) };
    } catch { return undefined; }
}
