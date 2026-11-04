import { WebMExporter } from '../../src/export/WebMExporter.ts';
import { State } from '../../src/state/store.ts';
import { installMp4StorageComparison } from './mp4-storage-comparison.mjs';
import { installMp4TrackAdmission } from './mp4-track-admission.mjs';

const FPS = 30, SR = 48000, FULL = 12, STOP = 6, CUE = 3;
const SHORT_CUES = [CUE];
const RAW_CAP = 96 * 1024 * 1024;
const sizes = { '720p': [1280, 720, 6_000_000], '1080p': [1920, 1080, 12_000_000], '4k': [3840, 2160, 28_000_000] };
const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
const output = document.querySelector('#result'), button = document.querySelector('#run');
const downloads = document.querySelector('#downloads'), downloadUrls = [];
const asset = name => new URL('./vendor/' + name, location.href).href;
const round = n => Math.round(n * 1000) / 1000;
const elapsed = start => Math.round(performance.now() - start);
const check = (ok, reason) => { if (!ok) throw Error(reason); };
let media, FFmpeg, liveWorkers = 0;

function setup(resolution) {
    [canvas.width, canvas.height] = sizes[resolution];
}
function draw(frame, cues = SHORT_CUES) {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#132b58'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
        ctx.fillStyle = i % 2 ? '#872957' : '#307ab1';
        ctx.fillRect((i * 127 + frame * (7 + i)) % (w * .9), h * (.1 + (i % 9) * .08), w * .03, h * .015);
    }
    ctx.fillStyle = cues.includes(frame) ? '#3ef08a' : '#132b58';
    ctx.fillRect(w * .4, h * .4, w * .2, h * .2);
}
function makeAudio() {
    const pcm = new AudioBuffer({ numberOfChannels: 2, length: SR * FULL / FPS, sampleRate: SR });
    for (let c = 0; c < 2; c++) {
        const samples = pcm.getChannelData(c);
        for (let i = 0; i < samples.length; i++) samples[i] = sampleAt(i, c);
    }
    return pcm;
}
function sampleAt(index, channel, cues = SHORT_CUES) {
    const t = index / SR, phase = t * FPS;
    const amplitude = cues.includes(Math.floor(phase)) && phase % 1 > .18 && phase % 1 < .82 ? .78 : .025;
    return amplitude * Math.sin(2 * Math.PI * (channel ? 1200 : 900) * t);
}
const pcm = makeAudio();
function wavFor(frames) {
    const count = frames * SR / FPS;
    const bytes = new ArrayBuffer(44 + count * 4), header = new DataView(bytes);
    for (const [offset, s] of [[0, 'RIFF'], [8, 'WAVEfmt '], [36, 'data']]) {
        [...s].forEach((char, i) => header.setUint8(offset + i, char.charCodeAt(0)));
    }
    header.setUint32(4, bytes.byteLength - 8, true);
    header.setUint32(16, 16, true); header.setUint16(20, 1, true);
    header.setUint16(22, 2, true); header.setUint32(24, SR, true);
    header.setUint32(28, SR * 4, true); header.setUint16(32, 4, true);
    header.setUint16(34, 16, true); header.setUint32(40, count * 4, true);
    const channels = [pcm.getChannelData(0), pcm.getChannelData(1)];
    for (let i = 0; i < count; i++) for (let c = 0; c < 2; c++) {
        header.setInt16(44 + (i * 2 + c) * 2, Math.round(channels[c][i] * 32767), true);
    }
    return new Blob([bytes], { type: 'audio/wav' });
}
async function compatible(resolution, scenario) {
    let frames = 0, resumed = 0, removed = 0;
    const p5 = {
        noLoop() {}, loop() { resumed++; },
        createGraphics() { return { elt: canvas, pixelDensity() {}, clear() {}, remove() { removed++; } }; },
        redraw() { draw(Math.round(State.exportTime * FPS)); },
    };
    const job = new WebMExporter(p5, canvas, { getAudioBuffer: () => pcm });
    State.duration = FULL / FPS;
    try {
        const blob = await job.startExport({ resolution, aspectRatio: '16:9', fps: FPS, watermark: false }, p => {
            if (p >= 1) return;
            frames++;
            if (scenario === 'stop' && frames === STOP) job.stopAndSave();
            if (scenario === 'cancel' && frames === 4) job.cancelExport();
        });
        return { blob, frames };
    } catch (error) {
        if (scenario === 'cancel' && frames === 4 && /cancelled/i.test(String(error))) {
            return { cancelled: true, frames };
        }
        throw error;
    } finally {
        check(resumed === 1 && removed === 1 && !State.isExporting, 'Compatible runtime cleanup failed');
    }
}
async function withDeadline(promise, ms, label) {
    let timer;
    try {
        return await Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error(label + ' timed out')), ms);
        })]);
    } finally { clearTimeout(timer); }
}
async function wasmExport(lane, scenario, width, height, bitrate) {
    const frames = scenario === 'stop' ? STOP : FULL;
    const rawBytes = width * height * 4 * frames;
    if (lane === 'direct' && rawBytes > RAW_CAP) return { unavailable: 'raw input exceeds fixture cap', rawBytes };
    const setupStart = performance.now();
    let video, inputName, captureMs;
    if (lane === 'hybrid') {
        const target = new media.BufferTarget();
        const writer = new media.Output({ format: new media.Mp4OutputFormat(), target });
        const source = new media.CanvasSource(canvas, { codec: 'avc', bitrate });
        writer.addVideoTrack(source, { frameRate: FPS });
        try {
            await writer.start();
            for (let frame = 0; frame < frames; frame++) {
                draw(frame);
                await source.add(frame / FPS, 1 / FPS);
            }
            source.close();
            await writer.finalize();
            video = new Blob([target.buffer], { type: 'video/mp4' });
        } catch (error) {
            if (writer.state === 'started' || writer.state === 'pending') await writer.cancel();
            throw error;
        }
        inputName = 'video.mp4';
    } else {
        const raw = new Uint8Array(rawBytes);
        const frameBytes = width * height * 4;
        for (let frame = 0; frame < frames; frame++) {
            draw(frame);
            raw.set(ctx.getImageData(0, 0, width, height).data, frame * frameBytes);
        }
        video = new Blob([raw]);
        inputName = 'frames.rgba';
    }
    const audio = wavFor(frames);
    captureMs = elapsed(setupStart);
    const ffmpeg = new FFmpeg(), log = [];
    let released = false;
    const release = () => {
        if (!released) { ffmpeg.terminate(); released = true; liveWorkers--; }
    };
    liveWorkers++;
    ffmpeg.on('log', ({ message }) => { if (log.push(message) > 24) log.shift(); });
    try {
        const started = performance.now();
        await withDeadline(ffmpeg.load({ coreURL: asset('core/ffmpeg-core.js'), wasmURL: asset('core/ffmpeg-core.wasm') }), 45_000, 'FFmpeg load');
        const loadMs = elapsed(started), mountStarted = performance.now();
        await ffmpeg.createDir('/input');
        check(await ffmpeg.mount('WORKERFS', { blobs: [
            { name: inputName, data: video }, { name: 'audio.wav', data: audio },
        ] }, '/input'), 'Pinned core does not support WORKERFS');
        const rawInput = ['-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${width}x${height}`, '-framerate', String(FPS)];
        const encoding = ['-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-b:v', String(bitrate)];
        const mountMs = elapsed(mountStarted), execStarted = performance.now();
        const run = ffmpeg.exec([
            ...(lane === 'direct' ? rawInput : []),
            '-i', '/input/' + inputName, '-i', '/input/audio.wav',
            '-map', '0:v:0', '-map', '1:a:0', ...(lane === 'direct' ? encoding : ['-c:v', 'copy']),
            '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '/out.mp4',
        ], 30_000);
        if (scenario === 'cancel') {
            // Wait for a log sent by the running worker before simulating Cancel.
            // A rejected caller-side AbortSignal alone does not stop synchronous WASM.
            let notifyStart;
            const startedExec = new Promise(resolve => { notifyStart = resolve; });
            ffmpeg.on('log', notifyStart);
            const settled = run.then(() => false, error => /FFmpeg\.terminate\(\)/.test(String(error)));
            await withDeadline(Promise.race([startedExec, settled.then(() => { throw Error('FFmpeg exited before Cancel'); })]), 3000, 'FFmpeg start log');
            release();
            check(await settled && !ffmpeg.loaded, 'Cancel did not terminate the active FFmpeg job');
            return { cancelled: true, frames, captureMs, loadMs, cancelPhase: 'ffmpeg-exec', cancelAfterDispatchMs: elapsed(execStarted) };
        }
        check(await withDeadline(run, 35_000, 'FFmpeg command') === 0, 'FFmpeg returned a nonzero status');
        const execMs = elapsed(execStarted), readStarted = performance.now();
        const bytes = await ffmpeg.readFile('/out.mp4');
        const blob = new Blob([bytes], { type: 'video/mp4' });
        const readMs = elapsed(readStarted);
        await ffmpeg.deleteFile('/out.mp4');
        await ffmpeg.unmount('/input');
        check((await ffmpeg.listDir('/input')).every(file => file.name === '.' || file.name === '..'), 'FFmpeg input still mounted');
        return { blob, frames, captureMs, loadMs, mountMs, execMs, readMs, inputBytes: video.size + audio.size,
            videoInputBytes: video.size, rawBytes: lane === 'direct' ? rawBytes : 0,
            rgbaReadbackFrameBytes: lane === 'direct' ? width * height * 4 : 0,
            outputTransferBytes: bytes.byteLength, intermediate: lane === 'hybrid' ? video : null };
    } catch (error) {
        throw Error(`${error}\n${log.join('\n')}`);
    } finally {
        release();
    }
}
const inputFor = blob => new media.Input({ formats: media.ALL_FORMATS, source: new media.BlobSource(blob) });
const sha = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
async function packets(track, hash = false) {
    const result = [];
    for await (const p of new media.EncodedPacketSink(track).packets()) {
        result.push({ pts: p.timestamp, duration: p.duration, ...(hash ? { sha: await sha(p.data) } : {}) });
    }
    return result.sort((a, b) => a.pts - b.pts);
}
async function verify(blob, frames, width, height, lane, intermediate) {
    const seconds = frames / FPS, input = inputFor(blob);
    const audioContext = new AudioContext({ sampleRate: SR });
    try {
        const v = await input.getPrimaryVideoTrack(), a = await input.getPrimaryAudioTrack();
        check(v?.codedWidth === width && v?.codedHeight === height && a?.numberOfChannels === 2 && a?.sampleRate === SR, 'Wrong track dimensions, channels or sample rate');
        check(lane === 'compatible' ? a.codec === 'opus' : v.codec === 'avc' && a.codec === 'aac', 'Wrong codecs');
        const vp = await packets(v, Boolean(intermediate));
        check(vp.length === frames && vp.every((p, i) => Math.abs(p.pts - i / FPS) <= .0011), 'Wrong frame count or discontinuous PTS');
        const videoEnd = vp.at(-1).pts + (vp.at(-1).duration || 1 / FPS);
        check(Math.abs(videoEnd - seconds) < .003, 'Video end mismatch');
        if (intermediate) {
            const source = inputFor(intermediate);
            try {
                const before = await packets(await source.getPrimaryVideoTrack(), true);
                check(before.length === vp.length && before.every((p, i) => p.sha === vp[i].sha && Math.abs(p.pts - vp[i].pts) < .001), 'Hybrid remux altered compressed video or its timestamps');
            } finally { source.dispose(); }
        }
        const sink = new media.CanvasSink(v);
        const sample = document.createElement('canvas');
        sample.width = sample.height = 1;
        const sc = sample.getContext('2d', { willReadFrequently: true });
        for (const frame of [0, CUE, frames - 1]) {
            const decoded = await sink.getCanvas((frame + .5) / FPS);
            check(decoded, 'Frame did not decode');
            sc.drawImage(decoded.canvas, width / 2, height / 2, 1, 1, 0, 0, 1, 1);
            const [r, g, b] = sc.getImageData(0, 0, 1, 1).data;
            check(frame === CUE ? g > r + 70 && g > b + 50 : b > g + 15, 'Decoded visual cue is wrong');
        }
        const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
        check(decoded.numberOfChannels === 2 && Math.abs(decoded.length - seconds * SR) <= 1024, 'Decoded audio end or channel count mismatch');
        const cueFrames = [0, 1].map(c => {
            const samples = decoded.getChannelData(c);
            const samplesPerFrame = SR / FPS;
            const energy = Array.from({ length: frames }, (_, i) => {
                let sum = 0;
                for (let n = i * samplesPerFrame; n < Math.min((i + 1) * samplesPerFrame, samples.length); n++) sum += samples[n] ** 2;
                return sum;
            });
            return energy.indexOf(Math.max(...energy));
        });
        check(cueFrames.every(frame => frame === CUE), 'Decoded audio cue does not match visual frame');
        return { codecs: [v.codec, a.codec], videoPackets: vp.length, videoEnd: round(videoEnd),
            decodedAudioSamples: decoded.length, audioEnd: round(decoded.duration), cueFrames, videoCopied: Boolean(intermediate) };
    } finally {
        input.dispose();
        await audioContext.close();
    }
}

button.disabled = false;
const storageButton = document.querySelector('#storage');
const trackButton = document.querySelector('#tracks');
installMp4StorageComparison({ button: storageButton, otherButtons: [button, trackButton], canvas, setup, draw, sizes,
    fps: FPS, sampleRate: SR, cue: CUE, sampleAt, asset });
installMp4TrackAdmission({ button: trackButton, otherButtons: [button, storageButton], asset });
button.onclick = async () => {
    button.disabled = true;
    storageButton.disabled = true;
    trackButton.disabled = true;
    downloads.replaceChildren();
    for (const url of downloadUrls.splice(0)) URL.revokeObjectURL(url);
    const report = { userAgent: navigator.userAgent, isolated: crossOriginIsolated, deviceMemoryHintGiB: navigator.deviceMemory ?? null,
        logicalProcessorsHint: navigator.hardwareConcurrency ?? null, maxRawInputBytes: RAW_CAP, results: [] };
    try {
        output.textContent = 'Loading local benchmark modules…';
        [{ FFmpeg }, media, report.assets] = await Promise.all([
            import(/* @vite-ignore */ asset('ffmpeg/index.js')),
            import(/* @vite-ignore */ asset('mediabunny.mjs')),
            fetch('/fixture-info.json').then(r => r.json()),
        ]);
        report.browserAacEncode = typeof AudioEncoder !== 'undefined' && (await AudioEncoder.isConfigSupported({
            codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 192000,
        })).supported;
        for (const [resolution, [w, h, bitrate]] of Object.entries(sizes)) {
            const avc = await media.canEncodeVideo('avc', { width: w, height: h, bitrate });
            for (const lane of ['compatible', 'hybrid', 'direct']) {
                // Cancel followed by Stop verifies a fresh retry after termination.
                const cases = resolution === '720p' ? ['full', 'cancel', 'stop'] : ['full'];
                for (const scenario of cases) {
                    output.textContent = `Running ${resolution} ${lane} ${scenario}…\n` + JSON.stringify(report, null, 2);
                    const entry = { resolution, lane, scenario };
                    report.results.push(entry);
                    if (lane === 'hybrid' && !avc) { entry.unavailable = 'Browser H.264 encoder not available for this size'; continue; }
                    try {
                        setup(resolution);
                        const start = performance.now();
                        const { blob, intermediate, ...metrics } = lane === 'compatible'
                            ? await compatible(resolution, scenario) : await wasmExport(lane, scenario, w, h, bitrate);
                        Object.assign(entry, metrics, { blobReadyMs: elapsed(start), bytes: blob?.size ?? 0 });
                        check(liveWorkers === 0, 'FFmpeg job leaked a worker');
                        if (metrics.unavailable) continue;
                        if (scenario === 'cancel') check(metrics.cancelled && !blob, 'Cancelled job produced output');
                        else {
                            check(blob && metrics.frames === (scenario === 'stop' ? STOP : FULL), 'Wrong submitted frame count');
                            entry.decoded = await withDeadline(verify(blob, metrics.frames, w, h, lane, intermediate), 20_000, 'Validation');
                            const item = document.createElement('li'), link = document.createElement('a');
                            link.href = URL.createObjectURL(blob);
                            downloadUrls.push(link.href);
                            link.download = `${resolution}-${lane}-${scenario}.${lane === 'compatible' ? 'webm' : 'mp4'}`;
                            link.textContent = link.download;
                            item.append(link); downloads.append(item);
                        }
                        entry.pass = true;
                    } catch (error) { entry.pass = false; entry.error = String(error); }
                }
            }
        }
        report.pass = report.results.every(r => r.pass || r.unavailable)
            && ['compatible', 'direct'].every(lane => report.results.some(r => r.lane === lane && r.scenario === 'stop' && r.pass));
    } catch (error) {
        report.pass = false;
        report.error = String(error);
    } finally {
        output.textContent = JSON.stringify(report, null, 2);
        button.disabled = false;
        storageButton.disabled = false;
        trackButton.disabled = false;
    }
};
