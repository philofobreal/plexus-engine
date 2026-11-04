const MIB = 1024 * 1024;
const MAX_WAV_PAYLOAD = 0xffffffff - 36;
const invalid = (reason: string) => ({ ok: false as const, reason });

/** A deliberately conservative OPFS job budget, independent of RAM hints.
 * The caps are enforced on writes; a bitrate request is not a size guarantee.
 */
export function planMp4Storage({ frames, fps, sampleRate, sourceSamples, videoBitrate, audioBitrate = 192_000, waveHeaderBytes = 44 }: {
    frames: number; fps: number; sampleRate: number; sourceSamples: number; videoBitrate: number;
    audioBitrate?: number; waveHeaderBytes?: number;
}) {
    if (![frames, sampleRate, sourceSamples, videoBitrate, audioBitrate, waveHeaderBytes].every(Number.isSafeInteger)
        || frames <= 0 || fps <= 0 || !Number.isFinite(fps) || sampleRate <= 0 || sourceSamples <= 0
        || videoBitrate <= 0 || audioBitrate <= 0 || waveHeaderBytes < 44) return invalid('invalid-export-clock');
    const seconds = frames / fps;
    const samples = Math.min(sourceSamples, Math.floor(seconds * sampleRate));
    if (samples <= 0 || samples * 4 + waveHeaderBytes - 44 > MAX_WAV_PAYLOAD) return invalid('wav-size-limit');

    const video = Math.ceil(seconds * videoBitrate * 1.5 / 8) + 2 * MIB;
    const audio = waveHeaderBytes + samples * 4;
    const output = video + Math.ceil(seconds * audioBitrate * 1.5 / 8) + 2 * MIB;
    const required = video + audio + output;
    if (![video, audio, output, required].every(Number.isSafeInteger)) return invalid('invalid-export-size');
    return { ok: true as const, frames, seconds, samples, limits: { video, audio, output }, required };
}

/** estimate() reports a coarse per-origin quota, not reservable bytes or physical free disk. */
export function checkMp4Storage(plan: ReturnType<typeof planMp4Storage>, estimate: StorageEstimate | undefined, phase = 'start') {
    if (!plan.ok) return plan;
    if (!['start', 'finalize'].includes(phase)) return invalid('invalid-admission-phase');
    const quota = estimate?.quota, usage = estimate?.usage;
    if (typeof quota !== 'number' || !Number.isFinite(quota) || quota <= 0
        || typeof usage !== 'number' || !Number.isFinite(usage) || usage < 0) return invalid('storage-estimate-unavailable');
    const reserve = Math.min(256 * MIB, Math.max(64 * MIB, Math.ceil(quota / 10)));
    const available = Math.max(0, Math.floor(quota - usage - reserve));
    const required = phase === 'start' ? plan.required : plan.limits.output;
    return { ok: required <= available, reason: required <= available ? null : 'insufficient-origin-storage',
        reserve, available, required, phase };
}
