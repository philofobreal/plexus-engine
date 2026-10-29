import type { ExportPreparationReport } from './ExportTypes';
import { WebMMuxer } from './WebMMuxer';

export interface ExportEncoderSettings {
    codec: string; width: number; height: number; framerate: number; bitrate: number;
    latencyMode: 'quality' | 'realtime'; bitrateMode?: 'constant' | 'variable';
}

/** WebM VP9 levels: picture size, luma sample rate, bitrate, max dimension. */
export function vp9ExportCodec(width: number, height: number, fps: number, bitrate: number): string {
    const levels = [[31, 983040, 36864000, 12000000, 2752], [40, 2228224, 83558400, 18000000, 4160],
        [41, 2228224, 160432128, 30000000, 4160], [50, 8912896, 311951360, 60000000, 8384],
        [51, 8912896, 588251136, 120000000, 8384]];
    if (![width, height, fps, bitrate].every(x => Number.isFinite(x) && x > 0)) throw new Error('Invalid encoder settings.');
    // Account for transform edge extension, not just visible image dimensions.
    const pixels = Math.ceil(width / 32) * 32 * Math.ceil(height / 32) * 32;
    const level = levels.find(([, picture, rate, bits, dim]) => pixels <= picture && pixels * fps <= rate && bitrate <= bits && Math.max(width, height) <= dim);
    if (!level) throw new Error('Output exceeds the supported export codec levels.');
    return `vp09.00.${level[0]}.08`;
}

/** Runs only in the dedicated export worker, before output-file creation.
 * No audio/analysis input is borrowed. Synthetic 3-frame trial is not a long-job guarantee.
 * env is explicit so real resource ownership and failure cleanup can be tested.
 */
export async function probeExportEncoding(config: ExportEncoderSettings, sampleRate: number, hasAudio: boolean,
    env: any = globalThis, timeoutMs = 10_000): Promise<{ config: ExportEncoderSettings; report: ExportPreparationReport }> {
    if (!env.VideoEncoder?.isConfigSupported || !env.OffscreenCanvas || !env.VideoFrame)
        throw new Error('Export preflight requires worker VideoEncoder configuration checks, OffscreenCanvas and VideoFrame.');
    const audioConfig = { codec: 'opus', sampleRate, numberOfChannels: 2 };
    if (hasAudio && (!env.AudioData || !env.AudioEncoder?.isConfigSupported
        || !(await env.AudioEncoder.isConfigSupported(audioConfig)).supported)) throw new Error('The selected stereo Opus audio configuration is not supported.');
    const preferred = vp9ExportCodec(config.width, config.height, config.framerate, config.bitrate);
    const reasons: string[] = [];
    for (const codec of [preferred, 'vp8']) {
        const selected = { ...config, codec };
        try {
            if (!(await env.VideoEncoder.isConfigSupported(selected)).supported) { reasons.push(`${codec}: unsupported configuration`); continue; }
        } catch (error) { reasons.push(`${codec}: configuration query failed (${String(error)})`); continue; }
        let video: any, audio: any, canvas: any, timer: ReturnType<typeof setTimeout> | undefined;
        let videoPackets = 0, audioPackets = 0, bytes = 0, audioConfigured = false, callbackError: Error | undefined;
        const chunks: Uint8Array[] = [];
        let rejectFailure!: (error: Error) => void;
        const failure = new Promise<never>((_, reject) => { rejectFailure = reject; });
        void failure.catch(() => undefined);
        const fail = (error: unknown) => { callbackError = error instanceof Error ? error : new Error(String(error)); rejectFailure(callbackError); };
        try {
            const muxer = new WebMMuxer({ width: config.width, height: config.height, fps: config.framerate,
                codecId: codec === 'vp8' ? 'V_VP8' : 'V_VP9', sampleRate, hasAudio,
                onChunk: chunk => { bytes += chunk.byteLength; if (bytes > 8 * 1024 * 1024) throw new Error('Probe output exceeded its 8 MiB bound.'); chunks.push(chunk); } });
            video = new env.VideoEncoder({ output: (chunk: any) => { try { videoPackets++; muxer.addVideoChunk(chunk); } catch (e) { fail(e); } }, error: fail });
            video.configure(selected);
            if (hasAudio) {
                audio = new env.AudioEncoder({ output: (chunk: any, metadata: any) => { try {
                    if (!audioConfigured) { muxer.setAudioConfig(metadata?.decoderConfig?.description); audioConfigured = true; }
                    audioPackets++; muxer.addAudioChunk(chunk);
                } catch (e) { fail(e); } }, error: fail });
                audio.configure(audioConfig);
            }
            canvas = new env.OffscreenCanvas(config.width, config.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Export probe could not create its output-size canvas.');
            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = ['#123456', '#654321', '#339955'][i]; ctx.fillRect(0, 0, config.width, config.height);
                const frame = new env.VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / config.framerate), duration: Math.round(1e6 / config.framerate) });
                try { video.encode(frame, { keyFrame: i === 0 }); } finally { frame.close(); }
            }
            if (audio) {
                const count = Math.floor(3 * sampleRate / config.framerate);
                const data = new env.AudioData({ format: 'f32-planar', sampleRate, numberOfFrames: count,
                    numberOfChannels: 2, timestamp: 0, data: new Float32Array(count * 2) });
                try { audio.encode(data); } finally { data.close(); }
                muxer.setAudioEndTime(count * 1e6 / sampleRate);
            }
            timer = setTimeout(() => fail(new Error('Export codec probe timed out.')), timeoutMs);
            await Promise.race([Promise.all([video.flush(), audio?.flush()]), failure]);
            if (callbackError) throw callbackError;
            if (videoPackets !== 3 || (hasAudio && !audioPackets)) throw new Error('Export codec probe produced no complete required media packet sequence.');
            muxer.finalize();
            if (!bytes || !chunks.length) throw new Error('Export codec probe produced no WebM output.');
            return { config: selected, report: { codec, width: config.width, height: config.height,
                fps: config.framerate, probeFrames: 3, probeBytes: bytes } };
        } catch (error) { reasons.push(`${codec}: ${error instanceof Error ? error.message : String(error)}`); }
        finally {
            if (timer !== undefined) clearTimeout(timer);
            for (const encoder of [video, audio]) try { encoder?.close(); } catch { /* Already closed after codec failure. */ }
            if (canvas) canvas.width = canvas.height = 1;
            chunks.length = 0;
        }
    }
    throw new Error(`Export preflight failed at ${config.width}x${config.height}/${config.framerate} fps. ${reasons.join('; ')}`);
}
