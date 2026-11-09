import { diagnosticFailure, publishExportDiagnostic, type ExportCodecDiagnostic, type ExportDiagnosticObserver } from './ExportDiagnostics';
import type { ExportPreparationReport } from './ExportTypes';
import { WebMMuxer } from './WebMMuxer';

export interface ExportEncoderSettings {
    codec: string; width: number; height: number; framerate: number; bitrate: number;
    latencyMode: 'quality' | 'realtime'; bitrateMode?: 'constant' | 'variable';
}

// Level, padded luma picture/rate, average bitrate, dimension, four-picture bits.
const vp9KnownLevels = [0,10,11,20,21,30,31,40,41,50,51,52,60,61,62];
const vp9Levels = [[31,983040,36864000,12000000,2752,10000000],
    [40,2228224,83558400,18000000,4160,16000000],
    [41,2228224,160432128,30000000,4160,18000000],
    [50,8912896,311951360,60000000,8384,36000000],
    [51,8912896,588251136,120000000,8384,46000000]] as const;

/** WebM VP9 levels: picture size, luma sample rate, bitrate, max dimension. */
export function vp9ExportCodec(width: number, height: number, fps: number, bitrate: number, bitDepth: 8 | 10 = 8): string {
    if (![width, height, fps, bitrate].every(x => Number.isFinite(x) && x > 0)) throw new Error('Invalid encoder settings.');
    // Account for transform edge extension, not just visible image dimensions.
    const pixels = Math.ceil(width / 32) * 32 * Math.ceil(height / 32) * 32;
    const level = vp9Levels.find(([, picture, rate, bits, dim]) => pixels <= picture && pixels * fps <= rate && bitrate <= bits && Math.max(width, height) <= dim);
    if (!level) throw new Error('Output exceeds the supported export codec levels.');
    return bitDepth === 10 ? `vp09.02.${level[0]}.10` : `vp09.00.${level[0]}.08`;
}

/** Preserve explicit native levels; unknown native metadata uses the measured floor. */
export function readVp9ExportLevel(codec?: string): number {
    if (codec === undefined) return 0;
    const parts = typeof codec === 'string' ? codec.split('.') : [];
    if (![4,9].includes(parts.length) || parts[0] !== 'vp09' || parts[1] !== '02' || parts[3] !== '10'
        || !parts.slice(1).every(p=>/^\d{2}$/.test(p))
        || !vp9KnownLevels.includes(Number(parts[2]))) throw Error('Invalid native VP9 level metadata.');
    return Number(parts[2]);
}

/** FFmpeg stream-copy must receive a level: its fallback can ignore frame rate.
 * Input bitrate includes the observed complete prefix; bursts can raise the floor.
 * This declares bounded stream properties, not a full VP9 bitstream certification.
 */
export function mp4Vp9LevelArgs({width,height,fps,bitrate,nativeLevel=0,maxFourBytes=0}: {
    width:number;height:number;fps:number;bitrate:number;nativeLevel?:number;maxFourBytes?:number;
}): string[] {
    if (!Number.isSafeInteger(nativeLevel) || !vp9KnownLevels.includes(nativeLevel) || !Number.isSafeInteger(maxFourBytes) || maxFourBytes<0
        || !Number.isSafeInteger(maxFourBytes*8)) throw Error('Invalid VP9 stream bounds.');
    const minimum=Number(vp9ExportCodec(width,height,fps,bitrate,10).split('.')[2]);
    const chosen=vp9Levels.find(([level,,,,,cpb])=>level>=Math.max(minimum,nativeLevel)&&maxFourBytes*8<=cpb);
    if (!chosen) throw Error('VP9 stream exceeds the supported export levels.');
    return ['-level:v',String(chosen[0])];
}

/** Runs only in the dedicated export worker. Diagnostics observe the existing gates:
 * an explicit 10-bit selection still requires its successful encode/decode trial.
 * Support queries do not allocate output frames. Both video queries are measured
 * before a 10-bit rejection, so an encoder limitation is not hidden by a decoder gate.
 */
export async function probeExportEncoding({ webmBitDepth, ...config }: ExportEncoderSettings & { webmBitDepth?: 10 }, sampleRate: number, hasAudio: boolean,
    env: any = globalThis, timeoutMs = 10_000, observe?: ExportDiagnosticObserver): Promise<{ config: ExportEncoderSettings; report: ExportPreparationReport }> {
    const highPrecision = webmBitDepth === 10;
    const base: ExportCodecDiagnostic = { version:1, codec:config.codec, width:config.width,height:config.height,
        fps:config.framerate,bitrate:config.bitrate,bitDepth:highPrecision?10:8,stage:'api',
        encoder:'not-checked',decoder:highPrecision?'not-checked':'not-required',encodedFrames:0,decodedFrames:0 };
    const emit = (d: ExportCodecDiagnostic) => publishExportDiagnostic(observe,d);
    if (!env.VideoEncoder?.isConfigSupported || !env.OffscreenCanvas || !env.VideoFrame) {
        base.encoder = env.VideoEncoder?.isConfigSupported ? 'not-checked' : 'unavailable';
        const error = new Error('Export preflight requires worker VideoEncoder configuration checks, OffscreenCanvas and VideoFrame.');
        emit(diagnosticFailure(base,error)); throw error;
    }
    const preferred = vp9ExportCodec(config.width, config.height, config.framerate, config.bitrate, highPrecision ? 10 : 8);
    base.codec = preferred;
    const audioConfig = { codec: 'opus', sampleRate, numberOfChannels: 2 };
    try {
        if (hasAudio && (!env.AudioData || !env.AudioEncoder?.isConfigSupported
            || !(await env.AudioEncoder.isConfigSupported(audioConfig)).supported)) throw new Error('The selected stereo Opus audio configuration is not supported.');
    } catch(error) { emit(diagnosticFailure({...base,stage:'audio-query'},error)); throw error; }
    const reasons: string[] = [];
    for (const codec of highPrecision ? [preferred] : [preferred, 'vp8']) {
        const selected = { ...config, codec }, diagnostic: ExportCodecDiagnostic = {...base,codec,stage:'encoder-query'};
        let queryError: unknown;
        try { diagnostic.encoder = (await env.VideoEncoder.isConfigSupported(selected)).supported ? 'supported' : 'unsupported'; }
        catch (error) { diagnostic.encoder = 'error'; queryError = error; }
        let decoderQueryError: unknown;
        if (highPrecision) {
            diagnostic.stage = 'decoder-query';
            if (!env.VideoDecoder?.isConfigSupported) diagnostic.decoder = 'unavailable';
            else try { diagnostic.decoder = (await env.VideoDecoder.isConfigSupported({codec:preferred,codedWidth:config.width,codedHeight:config.height})).supported ? 'supported' : 'unsupported'; }
            catch(error) { diagnostic.decoder = 'error'; decoderQueryError = error; }
            if (diagnostic.decoder !== 'supported') {
                const error = decoderQueryError ?? new Error('10-bit VP9 decoding is unavailable at the selected resolution. Choose WebM for 8-bit export.');
                emit(diagnosticFailure(diagnostic,error)); throw error;
            }
        }
        diagnostic.stage = 'encoder-query';
        if (diagnostic.encoder !== 'supported') {
            const reason = queryError ? `configuration query failed (${String(queryError)})` : 'unsupported configuration';
            reasons.push(`${codec}: ${reason}`); emit(diagnosticFailure(diagnostic,queryError ?? new Error(reason))); continue;
        }
        emit(diagnostic);
        let video: any, decoder: any, audio: any, canvas: any, timer: ReturnType<typeof setTimeout> | undefined;
        let videoPackets = 0, decodedFrames = 0, audioPackets = 0, bytes = 0, audioConfigured = false, callbackError: Error | undefined;
        const chunks: Uint8Array[] = [];
        let rejectFailure!: (error: Error) => void;
        const failure = new Promise<never>((_, reject) => { rejectFailure = reject; });
        void failure.catch(() => undefined);
        const fail = (error: unknown) => { callbackError = error instanceof Error ? error : new Error(String(error)); rejectFailure(callbackError); };
        try {
            diagnostic.stage = 'container';
            const muxer = new WebMMuxer({ width: config.width, height: config.height, fps: config.framerate,
                codecId: codec === 'vp8' ? 'V_VP8' : 'V_VP9', sampleRate, hasAudio,
                onChunk: chunk => { bytes += chunk.byteLength; if (bytes > 8 * 1024 * 1024) throw new Error('Probe output exceeded its 8 MiB bound.'); chunks.push(chunk); } });
            if (highPrecision) {
                diagnostic.stage = 'decode';
                decoder = new env.VideoDecoder({
                    output: (frame: VideoFrame) => { frame.close(); decodedFrames++; },
                    error: (e: unknown) => { diagnostic.stage='decode'; fail(e); },
                });
                decoder.configure({codec:preferred,codedWidth:config.width,codedHeight:config.height});
            }
            diagnostic.stage = 'encode';
            video = new env.VideoEncoder({ output: (chunk: any) => { try {
                videoPackets++; muxer.addVideoChunk(chunk); decoder?.decode(chunk);
            } catch (e) { fail(e); } }, error: (e: unknown) => { diagnostic.stage='encode'; fail(e); } });
            video.configure(selected);
            if (hasAudio) {
                audio = new env.AudioEncoder({ output: (chunk: any, metadata: any) => { try {
                    if (!audioConfigured) { muxer.setAudioConfig(metadata?.decoderConfig?.description); audioConfigured = true; }
                    audioPackets++; muxer.addAudioChunk(chunk);
                } catch (e) { fail(e); } }, error: (e: unknown) => { diagnostic.stage='audio-encode'; fail(e); } });
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
            await Promise.race([Promise.all([video.flush().then(() => decoder?.flush()), audio?.flush()]), failure]);
            if (callbackError) throw callbackError;
            if (videoPackets !== 3 || (hasAudio && !audioPackets)) {
                diagnostic.stage = videoPackets !== 3 ? 'encode' : 'audio-encode';
                throw new Error('Export codec probe produced no complete required media packet sequence.');
            }
            if (highPrecision && decodedFrames !== videoPackets) { diagnostic.stage='decode'; throw new Error('10-bit VP9 could not decode the complete video probe.'); }
            diagnostic.stage='container';muxer.finalize();
            if (!bytes || !chunks.length) throw new Error('Export codec probe produced no WebM output.');
            emit({...diagnostic,stage:'complete',encodedFrames:videoPackets,decodedFrames});
            return { config: selected, report: { codec, width: config.width, height: config.height,
                fps: config.framerate, probeFrames: 3, probeBytes: bytes } };
        } catch (error) { emit(diagnosticFailure({...diagnostic,encodedFrames:videoPackets,decodedFrames},error)); reasons.push(`${codec}: ${error instanceof Error ? error.message : String(error)}`); }
        finally {
            if (timer !== undefined) clearTimeout(timer);
            for (const codec of [video, decoder, audio]) try { codec?.close(); } catch { /* Already closed after codec failure. */ }
            if (canvas) canvas.width = canvas.height = 1;
            chunks.length = 0;
        }
    }
    const fallback = highPrecision ? ' Choose WebM for 8-bit export.' : '';
    throw new Error(`Export preflight failed at ${config.width}x${config.height}/${config.framerate} fps. ${reasons.join('; ')}${fallback}`);
}
