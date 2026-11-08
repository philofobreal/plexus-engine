import { diagnosticFailure, publishExportDiagnostic, type ExportCodecDiagnostic } from './ExportDiagnostics';
import { Mp4OutputFormat, NullTarget, Output, StreamTarget, VideoSample, VideoSampleSource } from 'mediabunny';
import { validMp4ExportStorageName } from './ExportStorageLease';
import { checkMp4Storage, planMp4Storage } from './Mp4StorageAdmission';
import { readMp4AvcLevel, selectMp4AvcEncoding, selectMp4AvcLevel } from './Mp4AvcLevel';
import { probeExportEncoding, vp9ExportCodec } from './ExportPreparation';
import type { EncodeFrameRequest, ExportWorkerRequest, ExportWorkerResponse, StartExportRequest } from './ExportTypes';

type Access = { write(data: Uint8Array, options: { at: number }): number; flush(): void; close(): void };
type DiskFile = FileSystemFileHandle & { createSyncAccessHandle(): Promise<Access> };
type Plan = Extract<ReturnType<typeof planMp4Storage>, { ok: true }>;
type Core = {
    FS: {
        mkdir(path: string): void; mount(fs: unknown, options: unknown, path: string): void; unmount(path: string): void;
        filesystems: { WORKERFS: unknown }; makedev(major: number, minor: number): number;
        registerDevice(dev: number, ops: { open(stream: { seekable: boolean }): void;
            write(stream: unknown, data: Uint8Array, start: number, length: number): number }): void;
        mkdev(path: string, mode: number, dev: number): void; ErrnoError: new (errno: number) => Error;
    };
    setLogger(logger: (data: { message: string }) => void): void;
    setProgress(progress: () => void): void; setTimeout(ms: number): void; exec(...args: string[]): void; ret: number;
};
const scope = self as unknown as {
    onmessage: ((event: MessageEvent<ExportWorkerRequest>) => void) | null;
    postMessage(message: ExportWorkerResponse, transfer?: Transferable[]): void;
};
const audioRates = new Set([8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000, 64000, 88200, 96000]);
const coreBase = new URL(import.meta.env.BASE_URL + 'export/ffmpeg-5.1.10/', self.location.origin);
const mp4Error = (reason: string) => new Error(reason + ' Choose WebM or try different export settings.');
async function loadCore(): Promise<Core> {
    const revision = '?revision=430d6a106127';
    const js = new URL('ffmpeg-core.js' + revision, coreBase).href;
    const wasmURL = new URL('ffmpeg-core.wasm' + revision, coreBase).href;
    try {
        const { default: createCore } = await import(/* @vite-ignore */ js);
        return await createCore({ mainScriptUrlOrBlob: js + '#' + btoa(JSON.stringify({ wasmURL })) });
    } catch { throw mp4Error('The MP4 encoder could not be loaded.'); }
}
function wavHeader(sampleRate: number, samples: number) {
    const bytes = new Uint8Array(44), header = new DataView(bytes.buffer);
    for (const [offset, value] of [[0, 'RIFF'], [8, 'WAVEfmt '], [36, 'data']] as const) {
        for (let i = 0; i < value.length; i++) header.setUint8(offset + i, value.charCodeAt(i));
    }
    for (const [offset, value] of [[4, samples * 4 + 36], [16, 16], [24, sampleRate], [28, sampleRate * 4], [40, samples * 4]]) header.setUint32(offset, value, true);
    for (const [offset, value] of [[20, 1], [22, 2], [32, 4], [34, 16]]) header.setUint16(offset, value, true);
    return bytes;
}
function write(handle: Access, data: Uint8Array, at: number, limit: number) {
    if (at + data.byteLength > limit) throw mp4Error('The MP4 job exceeded its storage budget.');
    if (handle.write(data, { at }) !== data.byteLength) throw mp4Error('An MP4 storage write was incomplete.');
}
async function requireStorage(plan: Plan, phase: 'start' | 'finalize') {
    const decision = checkMp4Storage(plan, await navigator.storage.estimate().catch(() => undefined), phase);
    if (decision.ok) return;
    if (decision.reason === 'insufficient-origin-storage' && 'required' in decision) {
        const gb = (bytes: number) => (bytes / 1e9).toFixed(2) + ' GB';
        throw mp4Error(`MP4 needs about ${gb(decision.required)} of browser storage; about ${gb(decision.available)} is available after reserve.`);
    }
    throw mp4Error('The browser could not estimate temporary storage for MP4.');
}
async function openAccess(dir: FileSystemDirectoryHandle, name: string) {
    const file = await dir.getFileHandle(name, { create: true }) as DiskFile;
    if (typeof file.createSyncAccessHandle !== 'function') throw mp4Error('Browser-local MP4 file writing is unavailable.');
    return { file, access: await file.createSyncAccessHandle() };
}
async function probeMp4Video(width: number, height: number, fps: number, encoding: ConstructorParameters<typeof VideoSampleSource>[0]) {
    const probe = new Output({ format: new Mp4OutputFormat(), target: new NullTarget() });
    let packets = 0;
    let emittedLevel: number | undefined;
    const diagnostic: ExportCodecDiagnostic = { version:1,codec:encoding.fullCodecString ?? encoding.codec,
        width,height,fps,bitrate:typeof encoding.bitrate === 'number' ? encoding.bitrate : 0,
        bitDepth:encoding.codec === 'vp9' ? 10 : 8,stage:'encode',encoder:'not-checked',decoder:'not-required',encodedFrames:0,decodedFrames:0 };
    const emit = (d: ExportCodecDiagnostic) => publishExportDiagnostic(report=>scope.postMessage({type:'export_diagnostic',report}),d);
    let canvas: OffscreenCanvas | undefined;
    const source = new VideoSampleSource({ ...encoding, onEncodedPacket: (_packet, metadata) => {
        packets++;
        if (metadata?.decoderConfig?.codec) diagnostic.emittedCodec = metadata.decoderConfig.codec;
        if (metadata?.decoderConfig) emittedLevel = readMp4AvcLevel(metadata.decoderConfig.description);
    } });
    probe.addVideoTrack(source, { frameRate: fps });
    try {
        await probe.start();
        canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw Error('Probe canvas unavailable');
        ctx.fillRect(0, 0, width, height);
        const sample = new VideoSample(canvas, { timestamp: 0, duration: 1 / fps });
        try { await source.add(sample); } finally { sample.close(); }
        source.close(); await probe.finalize();
        if (packets !== 1) throw Error('Probe produced no usable frame');
        emit({...diagnostic,stage:'complete',encoder:'supported',encodedFrames:packets});
    } catch (error) {
        emit(diagnosticFailure({...diagnostic,encodedFrames:packets},error));
        if (probe.state === 'started' || probe.state === 'pending') await probe.cancel().catch(() => {});
        const codec = encoding.codec === 'avc' ? 'H.264' : 'VP9';
        throw mp4Error(`${codec} encoding is unavailable at this resolution and frame rate.`);
    } finally {
        if (canvas) canvas.width = canvas.height = 1;
    }
    return emittedLevel;
}
function finalizeMp4(core: Core, video: File, wav: File, access: Access, plan: Plan) {
    const fs = core.FS, messages: string[] = [];
    let offset = 0, failure: unknown;
    core.setLogger(({ message }) => { if (messages.push(message) > 10) messages.shift(); });
    core.setProgress(() => {});
    fs.mkdir('/input');
    fs.mount(fs.filesystems.WORKERFS, { blobs: [{ name: 'video.mp4', data: video }, { name: 'audio.wav', data: wav }] }, '/input');
    try {
        const dev = fs.makedev(72, 0);
        fs.registerDevice(dev, {
            open(stream) { stream.seekable = false; },
            write(_stream, buffer, start, length) {
                try { write(access, buffer.subarray(start, start + length), offset, plan.limits.output); }
                catch (error) { failure = error; throw new fs.ErrnoError(29); }
                offset += length;
                return length;
            },
        });
        fs.mkdev('/dev/plexus-out', 0o222, dev);
        core.setTimeout(Math.min(870_000, Math.max(65_000, plan.seconds * 1000 + 10_000)));
        core.exec('-i', '/input/video.mp4', '-i', '/input/audio.wav', '-map', '0:v:0', '-map', '1:a:0',
            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-f', 'mp4', '-avoid_negative_ts', 'disabled', '-use_editlist', '1',
            '-movflags', '+delay_moov+default_base_moof+frag_keyframe', '-frag_duration', '1000000', '-flush_packets', '1', '/dev/plexus-out');
        if (failure) throw failure;
        if (core.ret !== 0 || offset === 0) {
            console.warn('FFmpeg MP4 finalization:', messages.join('\n'));
            throw mp4Error('FFmpeg could not finalize the MP4.');
        }
    } finally { fs.unmount('/input'); }
}

async function start(request: StartExportRequest) {
    const timings = request.profile ? {
        storageAdmission: 0, codecProbe: 0, coreLoad: 0, stagingSetup: 0,
        videoSubmit: 0, pcmStage: 0, videoFlush: 0, prepareMux: 0, ffmpegFinalize: 0, resultCleanup: 0, workerTotal: 0,
    } : undefined;
    const started = timings ? performance.now() : 0;
    let mark = started;
    function measure(stage: keyof NonNullable<typeof timings>) {
        if (!timings) return;
        const end = performance.now();
        timings[stage] += end - mark;
        mark = end;
    }
    if (!request.storageFile || !validMp4ExportStorageName(request.storageFile)
        || typeof navigator.storage?.getDirectory !== 'function' || typeof navigator.storage?.estimate !== 'function') {
        throw mp4Error('Browser-local storage is unavailable.');
    }
    if (!request.hasAudio || !audioRates.has(request.sampleRate)) throw mp4Error('The source audio is unavailable or uses an unsupported sample rate.');
    const { width, height, fps, sampleRate, sourceSamples = 0 } = request;
    const area = width * height;
    const ultraHd = area >= 3840 * 2160;
    const highPrecision = request.mp4VideoCodec === 'vp9-10bit';
    const rates = highPrecision
        ? { ultraHd: 64_000_000, fullHd: 14_000_000, hd: 8_000_000 }
        : { ultraHd: 40_000_000, fullHd: 12_000_000, hd: 6_000_000 };
    const bitrate = ultraHd ? rates.ultraHd : area >= 1920 * 1080 ? rates.fullHd : rates.hd;
    const makePlan = (frames: number) => {
        const plan = planMp4Storage({ frames, fps, sampleRate, sourceSamples, videoBitrate: bitrate });
        if (!plan.ok) throw mp4Error('This audio or duration does not fit the MP4 export budget.');
        return plan;
    };
    const budget = makePlan(request.frames ?? 0);
    await requireStorage(budget, 'start');
    measure('storageAdmission');
    let level: number | undefined;
    let encoding: ConstructorParameters<typeof VideoSampleSource>[0];
    if (highPrecision) {
        const fullCodecString = vp9ExportCodec(width, height, fps, bitrate, 10);
        await probeExportEncoding({ codec: fullCodecString, width, height, framerate: fps, bitrate,
            latencyMode: 'quality', bitrateMode: 'constant', webmBitDepth: 10 }, sampleRate, false, globalThis, 10_000, report => scope.postMessage({type:'export_diagnostic',report}));
        // Independent VP9 pictures preserve brief details: WH-06b's frame-ID probe
        // caught temporal remnants with the former inter-frame profile (same valid input).
        encoding = { codec: 'vp9', fullCodecString, bitrate, keyFrameInterval: 0,
            latencyMode: 'quality', bitrateMode: 'constant' };
        await probeMp4Video(width, height, fps, encoding);
    } else {
        level = selectMp4AvcLevel(width, height, fps, bitrate);
        if (level === undefined) throw mp4Error('H.264 cannot represent this resolution and frame rate.');
        const preferred: ConstructorParameters<typeof VideoSampleSource>[0] = {
            codec: 'avc', bitrate, keyFrameInterval: 1, latencyMode: 'quality',
            fullCodecString: `avc1.6400${level.toString(16)}`,
            ...(ultraHd ? { bitrateMode: 'constant' } : {}),
        };
        encoding = await selectMp4AvcEncoding(preferred, level, candidate => probeMp4Video(width, height, fps, candidate));
    }
    measure('codecProbe');
    const core = await loadCore();
    measure('coreLoad');
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(request.storageFile, { create: true });
    let videoAccess: Access | undefined, waveAccess: Access | undefined, writer: Output | undefined;
    const close = async () => {
        if (writer?.state === 'started' || writer?.state === 'pending') await writer.cancel().catch(() => {});
        for (const access of [videoAccess, waveAccess]) try { access?.close(); } catch { /* Already closed. */ }
    };
    try {
        const video = await openAccess(dir, 'video.mp4');
        videoAccess = video.access;
        const wave = await openAccess(dir, 'audio.wav');
        waveAccess = wave.access;
        write(wave.access, wavHeader(sampleRate, 0), 0, budget.limits.audio);
        const pcm = new Uint8Array(Math.ceil(sampleRate / fps) * 4), view = new DataView(pcm.buffer);
        let videoBytes = 0, frames = 0, samples = 0;
        const target = new StreamTarget(new WritableStream({
            write(chunk) {
                write(video.access, chunk.data, chunk.position, budget.limits.video);
                videoBytes = Math.max(videoBytes, chunk.position + chunk.data.byteLength);
            },
        }), { chunked: true, chunkSize: 256 * 1024 });
        const output = writer = new Output({ format: new Mp4OutputFormat({ fastStart: 'fragmented', minimumFragmentDuration: 1 }), target });
        let warnedAboutLevel = false;
        const picture = new VideoSampleSource({ ...encoding, onEncodedPacket: (_packet, metadata) => {
            if (level === undefined || warnedAboutLevel || !metadata?.decoderConfig) return;
            const actual = readMp4AvcLevel(metadata.decoderConfig.description);
            if (actual === undefined || actual >= level) return;
            warnedAboutLevel = true;
            console.warn(`MP4 encoder declared H.264 level_idc ${actual} for ${width}×${height} at ${fps} fps (requested ${level}).`);
        } });
        output.addVideoTrack(picture, { frameRate: fps });
        await output.start();
        measure('stagingSetup');
        return {
            close,
            async add({ bitmap, timestampUs, audioPlanar, audioSampleCount = 0 }: EncodeFrameRequest) {
                if (timings) mark = performance.now();
                try {
                    if (frames >= budget.frames || timestampUs !== Math.round(frames * 1e6 / fps)) throw mp4Error('MP4 received an unexpected frame timestamp.');
                    const end = Math.min(sourceSamples, Math.floor((frames + 1) * sampleRate / fps));
                    if (audioSampleCount !== end - samples || (audioSampleCount > 0 && (!audioPlanar || audioPlanar.length !== audioSampleCount * 2))) {
                        throw mp4Error('MP4 received a noncontiguous audio segment.');
                    }
                    const sample = new VideoSample(bitmap, { timestamp: frames / fps, duration: 1 / fps });
                    try { await picture.add(sample); } finally { sample.close(); }
                    measure('videoSubmit');
                    if (audioPlanar && audioSampleCount > 0) {
                        for (let i = 0; i < audioSampleCount; i++) for (let c = 0; c < 2; c++) {
                            view.setInt16((i * 2 + c) * 2, Math.round(Math.max(-1, Math.min(1, audioPlanar[c * audioSampleCount + i])) * 32767), true);
                        }
                        write(wave.access, pcm.subarray(0, audioSampleCount * 4), 44 + samples * 4, budget.limits.audio);
                    }
                    measure('pcmStage');
                    samples = end; frames++;
                    scope.postMessage({ type: 'frame_encoded', timestampUs, ...(audioPlanar ? { audioBuffer: audioPlanar } : {}) },
                        audioPlanar ? [audioPlanar.buffer as ArrayBuffer] : []);
                    scope.postMessage({ type: 'queue_update', size: 0 });
                } finally { bitmap.close(); }
            },
            async finish() {
                if (timings) mark = performance.now();
                const plan = makePlan(frames);
                if (samples !== plan.samples) throw mp4Error('MP4 could not finalize the captured audio prefix.');
                picture.close(); await output.finalize();
                measure('videoFlush');
                write(wave.access, wavHeader(sampleRate, samples), 0, plan.limits.audio);
                wave.access.flush(); wave.access.close(); waveAccess = undefined;
                video.access.flush(); video.access.close(); videoAccess = undefined;
                await requireStorage(plan, 'finalize');
                const videoFile = await video.file.getFile(), wav = await wave.file.getFile();
                if (!videoBytes || videoFile.size !== videoBytes || wav.size !== plan.limits.audio) throw mp4Error('MP4 input files are incomplete.');
                const final = await openAccess(dir, 'plexus-visual.mp4');
                measure('prepareMux');
                try { finalizeMp4(core, videoFile, wav, final.access, plan); final.access.flush(); }
                finally { final.access.close(); }
                measure('ffmpegFinalize');
                const blob = await final.file.getFile();
                await dir.removeEntry('video.mp4'); await dir.removeEntry('audio.wav');
                measure('resultCleanup');
                if (timings) timings.workerTotal = mark - started;
                return { blob, ...(timings ? { timings } : {}) };
            },
        };
    } catch (error) { await close(); throw error; }
}

let job: Awaited<ReturnType<typeof start>> | undefined, failed = false, commands = Promise.resolve();
scope.onmessage = ({ data }) => {
    commands = commands.then(async () => {
        if (failed) { if (data.type === 'encode_frame') data.bitmap.close(); return; }
        try {
            if (data.type === 'start_export') {
                if (job) throw new Error('An MP4 job is already running.');
                job = await start(data); scope.postMessage({ type: 'export_ready' });
            } else if (data.type === 'encode_frame' && job) await job.add(data);
            else if (data.type === 'finalize_export' && job) scope.postMessage({ type: 'export_done', ...await job.finish() });
            else if (data.type === 'encode_frame') data.bitmap.close();
        } catch (error) {
            failed = true;
            await job?.close();
            const message = error instanceof DOMException && error.name === 'QuotaExceededError'
                ? mp4Error('Browser storage ran out while exporting.').message : error instanceof Error ? error.message : String(error);
            scope.postMessage({ type: 'export_error', message });
        }
    });
};
