import type { BeatEvent } from './index';
import type { FeatureClock } from './featureClock';

export type AcousticTexture = 'tonal' | 'broadband' | 'mixed' | 'unknown';
export interface AcousticAttack {
    id: string;
    sampleIndex: number;
    observationFrame: number; // Frame that triggered the energy-rise candidate (localization can reach its predecessor).
    time: number;
    supportSamples: [number, number];
    familySupportSamples: [number, number];
    family: AcousticTexture;
    strengthRms: number; // AC RMS amplitude of the observed window, not normalized confidence.
    powerRatio: number;
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
    spectralEntries?: SpectralEntryLayer; // Absent in T11b/legacy payloads.
}

export interface SpectralEntryLayer {
    algorithm: 'tonal-carrier-entry-v1';
    confidence: null;
    consumerUse: 'signal-evidence-only';
    xrScoring: 'ineligible';
    candidates: {
        id: string; sampleIndex: number; time: number; observationFrame: number;
        prefixSamples: [number, number]; supportSamples: [number, number];
        bodySamples: [number, number]; decisionSample: number;
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
        return { algorithm: value.algorithm, source: 'analysis-pcm', clock: { ...clock }, confidence: null, consumerUse: 'signal-evidence-only', xrScoring: 'ineligible', capabilities,
            ...(spectralEntries ? { spectralEntries } : {}),
            activity: value.activity.map(a => ({ id: a.id, startSample: a.startSample, endSample: a.endSample,
                onsetSupportSamples: a.onsetSupportSamples && [...a.onsetSupportSamples], offsetSupportSamples: a.offsetSupportSamples && [...a.offsetSupportSamples],
                sustainSamples: a.sustainSamples && [...a.sustainSamples], leftCensored: a.leftCensored, rightCensored: a.rightCensored })),
            attacks: value.attacks.map(a => ({ id: a.id, observationFrame: a.observationFrame, sampleIndex: a.sampleIndex, time: a.time, supportSamples: [...a.supportSamples],
                familySupportSamples: [...a.familySupportSamples], family: a.family, strengthRms: a.strengthRms, powerRatio: a.powerRatio })),
            dominance: value.dominance.map(a => ({ startSample: a.startSample, endSample: a.endSample, texture: a.texture, decisionSample: a.decisionSample })) };
    } catch { return undefined; }
}
