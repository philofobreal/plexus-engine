import type { ExportConfig } from './ExportTypes';
import type { ExportAudioSource, ExportRenderInput, ExportRenderSnapshot } from '../types/ExportRenderJob';

/** Admission estimate for owned buffers, not a browser/process peak-RAM guarantee. */
export const EXPORT_SNAPSHOT_BUDGET_BYTES = 2048 * 1024 * 1024;

/** Auto is a bounded application policy, NOT detected available physical RAM. */
export function exportMemoryBudget(config: ExportConfig): number {
    const mib = config.memoryLimitMiB ?? 2048;
    if (![512, 1024, 2048].includes(mib)) throw new Error('Invalid export memory planning limit.');
    return mib * 1024 * 1024;
}

function dataBytes(value: unknown, seen = new WeakSet<object>()): number {
    if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('Export snapshot contains a non-finite number.'); return 8; }
    if (typeof value === 'string') return 2 * value.length + 16;
    if (value === null || value === undefined || typeof value === 'boolean') return 8;
    if (typeof value !== 'object' || ArrayBuffer.isView(value)
        || (!Array.isArray(value) && Object.prototype.toString.call(value) !== '[object Object]')) throw new Error('Export snapshot must contain plain data.');
    if (seen.has(value)) throw new Error('Export snapshot contains a cycle.');
    seen.add(value);
    let size = 32, slots = 0;
    // Avoid a whole entries-array; validate extra array properties too, as before.
    for (const key in value) if (Object.hasOwn(value, key)) {
        size += 16 + key.length * 2 + dataBytes((value as Record<string, unknown>)[key], seen);
        if (Array.isArray(value) && Number.isInteger(+key) && +key >= 0 && String(+key) === key && +key < value.length) slots++;
    }
    if (Array.isArray(value)) size += (value.length - slots) * 8;
    seen.delete(value); return size;
}
/** Same JSON-data normalization as the old round trip, without its whole-input string.
 * Already validated acyclic input may share immutable subtrees; copy each only once.
 */
function copyData<T>(value: T, copies = new Map<object, unknown>()): T {
    if (!value || typeof value !== 'object') return (typeof value === 'number' && value === 0 ? 0 : value) as T;
    if (copies.has(value)) return copies.get(value) as T;
    const out: any = Array.isArray(value) ? new Array(value.length) : {};
    copies.set(value, out);
    if (Array.isArray(value)) for (let i = 0; i < value.length; i++) out[i] = value[i] === undefined ? null : copyData(value[i], copies);
    else for (const key of Object.keys(value)) {
        const item = (value as Record<string, unknown>)[key];
        if (item === undefined) continue;
        if (key === '__proto__') Object.defineProperty(out, key, { value: copyData(item, copies), enumerable: true, writable: true, configurable: true });
        else out[key] = copyData(item, copies);
    }
    return out;
}
function freeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        if (Array.isArray(value)) for (const item of value) freeze(item);
        else for (const key of Object.keys(value)) freeze((value as Record<string, unknown>)[key]);
        Object.freeze(value);
    }
    return value;
}
async function digest(value: unknown): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
}

/** Captures every mutable control synchronously before hashing awaits; owns one PCM copy/channel. */
export async function captureExportSnapshot(input: ExportRenderInput, audio: ExportAudioSource,
    config: ExportConfig, signal: AbortSignal, budgetBytes = exportMemoryBudget(config)) {
    config = { ...config };
    const check = () => { if (signal.aborted) throw new Error('Export cancelled.'); };
    check();
    if (!input || !/^[a-f0-9]{64}$/.test(input.audioContentId)) throw new Error('Wait for the track content identity before isolated export.');
    if (!audio || !Number.isInteger(audio.length) || audio.length <= 0 || !Number.isFinite(audio.sampleRate) || audio.sampleRate <= 0
        || ![1, 2].includes(audio.numberOfChannels)) throw new Error('Isolated export requires valid mono/stereo PCM.');
    if (input.seed.version !== 1 || input.analysis.sampleRate !== audio.sampleRate || !Number.isFinite(input.analysis.duration)
        || !Number.isInteger(input.analysis.hopSize) || input.analysis.hopSize <= 0
        || input.analysis.trackAnalysis.duration !== input.analysis.duration
        || input.analysis.trackAnalysis.featureHopSize !== input.analysis.hopSize
        || Math.abs(input.analysis.duration - audio.length / audio.sampleRate) > 1 / audio.sampleRate + 1e-6)
        throw new Error('Export analysis and audio clocks do not match.');
    if (config.fps !== 30 && config.fps !== 60) throw new Error('Isolated Wormhole export supports 30 or 60 fps.');
    if (!['720p', '1080p', '4K'].includes(config.resolution) || !['16:9', '9:16', '1:1'].includes(config.aspectRatio)) throw new Error('Invalid export dimensions.');
    const base = config.resolution === '720p' ? 720 : config.resolution === '1080p' ? 1080 : 2160;
    const width = config.aspectRatio === '16:9' ? Math.round(base * 16 / 9) : base;
    const height = config.aspectRatio === '9:16' ? Math.round(base * 16 / 9) : base;
    const pcmBytes = audio.length * audio.numberOfChannels * 4;
    // Source, output, lazy post snapshot and two admitted bitmap surfaces + encoder headroom.
    const estimatedBytes = pcmBytes + dataBytes(input) * 2 + width * height * 4 * 5 + 64 * 1024 * 1024;
    if (!Number.isSafeInteger(estimatedBytes) || !Number.isSafeInteger(budgetBytes) || budgetBytes <= 0 || estimatedBytes > budgetBytes)
        throw new Error(`Estimated export working set: ${Math.ceil(estimatedBytes / 1048576)} MiB; admission budget: ${Math.round(budgetBytes / 1048576)} MiB. This is an application planning limit, not detected free RAM. Choose a larger Export memory limit, lower resolution or Compatible rendering.`);
    const copied: ExportRenderInput = copyData(input);
    const required = new Set(copied.analysis.performancePlan.points.map(p => p.preset));
    for (const name of required) if (!copied.presets[name] || typeof copied.presets[name] !== 'object') throw new Error(`Missing frozen export preset: ${name}`);
    let channels: Float32Array[] | null = [];
    try {
        for (let channel = 0; channel < audio.numberOfChannels; channel++) {
            check(); const source = audio.getChannelData(channel);
            if (!(source instanceof Float32Array) || source.length !== audio.length) throw new Error('Invalid export PCM channel.');
            const copy = source.slice();
            for (const value of copy) if (!Number.isFinite(value)) throw new Error('Export PCM contains a non-finite sample.');
            channels.push(copy);
        }
        const length = audio.length, sampleRate = audio.sampleRate, numberOfChannels = audio.numberOfChannels;
        const ownedAudio: ExportAudioSource = Object.freeze({ length, sampleRate, numberOfChannels,
            getChannelData(channel: number) {
                if (!channels || !Number.isInteger(channel) || !channels[channel]) throw new Error('Export PCM lease is unavailable.');
                return channels[channel];
            } });
        const analysisId = await digest(copied.analysis); check();
        const presetIds: Record<string, string> = {};
        for (const name of required) { presetIds[name] = await digest(copied.presets[name]); check(); }
        const snapshot: ExportRenderSnapshot = freeze({ version: 1, audioContentId: copied.audioContentId, analysisId,
            presetIds, input: copied, width, height, fps: config.fps, estimatedBytes, budgetBytes,
            output: { resolution: config.resolution, aspectRatio: config.aspectRatio, fps: config.fps,
                watermark: config.watermark === true, trackName: config.trackName || 'Plexus Performance' } });
        return { snapshot, audio: ownedAudio, dispose() { channels = null; } };
    } catch (error) { channels = null; throw error; }
}
