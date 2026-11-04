import FileOutputWorker from './ffmpeg-file-output.worker.mjs?worker';

const MIB = 1024 * 1024, CAP = 24 * MIB;
const roundMs = t => Math.round(performance.now() - t);
const assert = (condition, message) => { if (!condition) throw Error(message); };

function waveHeader(sampleRate, sampleCount) {
    const header = new DataView(new ArrayBuffer(44));
    const size = sampleCount * 4;
    for (const [offset, value] of [[0, 'RIFF'], [8, 'WAVEfmt '], [36, 'data']]) {
        for (let i = 0; i < value.length; i++) header.setUint8(offset + i, value.charCodeAt(i));
    }
    for (const [offset, value] of [[4, size + 36], [16, 16], [24, sampleRate], [28, sampleRate * 4], [40, size]]) header.setUint32(offset, value, true);
    for (const [offset, value] of [[20, 1], [22, 2], [32, 4], [34, 16]]) header.setUint16(offset, value, true);
    return header;
}

async function stageInput(media, options, dir, resolution, frames, cues, browserAudio) {
    const { canvas, setup, draw, sizes, fps, sampleRate, sampleAt } = options;
    const video = await dir.getFileHandle('video.mp4', { create: true });
    const videoWriter = await video.createWritable();
    let wav, waveWriter, writer;
    let largestVideoWrite = 0, writtenVideo = 0;
    const samplesPerFrame = sampleRate / fps;
    assert(Number.isInteger(samplesPerFrame), 'The fixture requires an integer number of samples per frame');
    const samples = new DataView(new ArrayBuffer(samplesPerFrame * 4));
    try {
        if (!browserAudio) {
            wav = await dir.getFileHandle('input.wav', { create: true });
            waveWriter = await wav.createWritable();
            assert(44 + frames * samples.byteLength <= CAP, 'WAV budget exceeded');
            await waveWriter.write(waveHeader(sampleRate, frames * samplesPerFrame));
        }
        setup(resolution);
        const target = new media.StreamTarget(new WritableStream({
            async write(chunk) {
                const end = chunk.position + chunk.data.byteLength;
                assert(end <= CAP, 'Video staging budget exceeded');
                await videoWriter.write(chunk);
                largestVideoWrite = Math.max(largestVideoWrite, chunk.data.byteLength);
                writtenVideo = Math.max(writtenVideo, end);
            },
            close: () => videoWriter.close(),
            abort: reason => videoWriter.abort(reason),
        }), { chunked: true, chunkSize: 256 * 1024 });
        writer = new media.Output({ format: new media.Mp4OutputFormat({ fastStart: 'fragmented', minimumFragmentDuration: 1 }), target });
        const picture = new media.CanvasSource(canvas, { codec: 'avc', bitrate: sizes[resolution][2], keyFrameInterval: 1 });
        writer.addVideoTrack(picture, { frameRate: fps });
        const sound = browserAudio ? new media.AudioSampleSource({ codec: 'aac', bitrate: 192_000 }) : null;
        if (sound) writer.addAudioTrack(sound);
        await writer.start();
        for (let frame = 0; frame < frames; frame++) {
            draw(frame, cues);
            await picture.add(frame / fps, 1 / fps);
            const start = frame * samplesPerFrame;
            for (let i = 0; i < samplesPerFrame; i++) for (let c = 0; c < 2; c++) {
                samples.setInt16((i * 2 + c) * 2, Math.round(sampleAt(start + i, c, cues) * 32767), true);
            }
            if (sound) {
                const audio = new media.AudioSample({ data: samples, format: 's16', numberOfChannels: 2,
                    sampleRate, timestamp: start / sampleRate });
                try { await sound.add(audio); } finally { audio.close(); }
            } else await waveWriter.write(samples);
        }
        picture.close(); sound?.close();
        await writer.finalize();
        await waveWriter?.close();
        const videoFile = await video.getFile();
        assert(videoFile.size === writtenVideo && videoFile.size > 0, 'Video file size does not match the staged writes');
        return { video: videoFile, wav: wav && await wav.getFile(), largestVideoWrite, pcmSliceBytes: samples.byteLength };
    } catch (error) {
        if (writer && ['started', 'pending'].includes(writer.state)) await writer.cancel().catch(() => {});
        await Promise.allSettled([videoWriter.abort(error), waveWriter?.abort(error)]);
        throw error;
    }
}

async function finishOnDisk(options, dir, video, wav, scenario) {
    const output = await dir.getFileHandle('final.mp4', { create: true });
    const worker = new FileOutputWorker();
    let timer;
    try {
        const metrics = await new Promise((resolve, reject) => {
            timer = setTimeout(() => reject(Error('FFmpeg file worker timed out')), 55_000);
            worker.onmessage = ({ data }) => {
                if (data.type === 'writing' && scenario === 'cancel') {
                    worker.terminate();
                    resolve({ cancelled: true });
                } else if (data.type === 'error') reject(Error(data.error));
                else if (data.type === 'result') resolve(data);
            };
            worker.onerror = event => reject(Error(event.message));
            worker.postMessage({ coreURL: options.asset('core/ffmpeg-core.js'), wasmURL: options.asset('core/ffmpeg-core.wasm'),
                video, wav, output, limit: scenario === 'cap' ? 16 : CAP });
        });
        if (metrics.cancelled) return metrics;
        const file = await output.getFile();
        assert(file.size === metrics.bytes, 'Output size does not match the worker writes');
        return { ...metrics, file };
    } finally {
        clearTimeout(timer);
        worker.terminate();
    }
}

async function verify(media, options, file, resolution, frames, cues, intermediate) {
    const { fps, sampleRate, sizes } = options;
    const [width, height] = sizes[resolution];
    const makeInput = f => new media.Input({ formats: media.ALL_FORMATS, source: new media.BlobSource(f) });
    const input = makeInput(file), original = intermediate ? makeInput(intermediate) : null;
    const ctx = new AudioContext({ sampleRate });
    try {
        const picture = await input.getPrimaryVideoTrack(), sound = await input.getPrimaryAudioTrack();
        assert(picture?.codec === 'avc' && picture.codedWidth === width && picture.codedHeight === height
            && sound?.codec === 'aac' && sound.sampleRate === sampleRate && sound.numberOfChannels === 2, 'Wrong MP4 track metadata');
        const payload = new media.EncodedPacketSink(picture);
        const source = original && new media.EncodedPacketSink(await original.getPrimaryVideoTrack());
        const sourcePackets = source && source.packets();
        let first = Infinity, end = 0, count = 0;
        const seen = new Set();
        try {
            for await (const packet of payload.packets()) {
                first = Math.min(first, packet.timestamp);
                end = Math.max(end, packet.timestamp + packet.duration);
                const index = Math.round(packet.timestamp * fps);
                assert(!seen.has(index) && index >= 0 && index < frames && Math.abs(packet.timestamp - index / fps) < .001,
                    `Video packet clock discontinuity: packet ${count} at ${packet.timestamp}s`);
                seen.add(index); count++;
                if (sourcePackets) {
                    const { value, done } = await sourcePackets.next();
                    assert(!done && Math.abs(packet.timestamp - value.timestamp) < .001 && packet.data.length === value.data.length
                        && packet.data.every((byte, i) => byte === value.data[i]), 'FFmpeg changed a video packet');
                }
            }
            assert(!sourcePackets || (await sourcePackets.next()).done, 'FFmpeg dropped a video packet');
        } finally { await sourcePackets?.return(); }
        assert(count === frames && first === 0 && Math.abs(end - frames / fps) < .003, 'Video endpoint mismatch');
        const audio = await ctx.decodeAudioData(await file.arrayBuffer());
        assert(audio.numberOfChannels === 2 && Math.abs(audio.length - frames * sampleRate / fps) <= 2048, 'AAC endpoint outside two AAC blocks');
        // Cross-check decoded picture and audio near the start, middle and end.
        const sink = new media.CanvasSink(picture);
        const pixel = new OffscreenCanvas(1, 1).getContext('2d');
        const cueOffsetsMs = [];
        for (const cue of cues) {
            const frame = await sink.getCanvas((cue + .5) / fps);
            assert(frame, 'Visual cue could not be decoded');
            pixel.drawImage(frame.canvas, width / 2, height / 2, 1, 1, 0, 0, 1, 1);
            const [r, g, b] = pixel.getImageData(0, 0, 1, 1).data;
            assert(g > r + 70 && g > b + 50, 'Wrong visual cue frame');
            cueOffsetsMs.push([0, 1].map(c => {
                const samples = audio.getChannelData(c), step = sampleRate / 1000;
                let weighted = 0, total = 0;
                const firstSample = Math.floor(Math.max(0, cue - 2) * sampleRate / fps);
                for (let i = firstSample; i + step <= Math.min(samples.length, (cue + 3) * sampleRate / fps); i += step) {
                    let energy = 0;
                    for (let j = 0; j < step; j++) energy += samples[i + j] ** 2;
                    if (energy > step * .025) { weighted += (i + step / 2) * energy; total += energy; }
                }
                assert(total > 0, 'No audio cue detected');
                return Math.round(1000 * (weighted / total / sampleRate - (cue + .5) / fps));
            }));
        }
        return { count, videoSeconds: end, audioSamples: audio.length, cueOffsetsMs,
            syncWithin10Ms: cueOffsetsMs.flat().every(x => Math.abs(x) <= 10), videoCopied: Boolean(original) };
    } finally {
        input.dispose(); original?.dispose(); await ctx.close();
    }
}

async function removeScratch(root, name) {
    const deadline = performance.now() + 2000;
    for (;;) {
        try { await root.removeEntry(name, { recursive: true }); break; }
        catch (error) {
            // A terminated worker's access handle may still be closing in the storage process.
            if (error.name !== 'NoModificationAllowedError' || performance.now() >= deadline) throw error;
            await new Promise(resolve => setTimeout(resolve, 25));
        }
    }
    await root.getDirectoryHandle(name).then(
        () => { throw Error('Scratch export survived cleanup'); },
        error => { if (error.name !== 'NotFoundError') throw error; },
    );
}

export function installMp4StorageComparison(options) {
    const { button, otherButton, asset } = options;
    const status = document.querySelector('#storage-result');
    const downloads = document.querySelector('#storage-downloads'), urls = [];
    button.disabled = false;
    button.onclick = async () => {
        button.disabled = otherButton.disabled = true;
        downloads.replaceChildren();
        for (const url of urls.splice(0)) URL.revokeObjectURL(url);
        const report = { results: [], perFileCap: CAP, userAgent: navigator.userAgent };
        try {
            status.textContent = 'Opening local scratch storage…';
            const media = await import(/* @vite-ignore */ asset('mediabunny.mjs'));
            const root = await navigator.storage.getDirectory();
            const cases = [
                ['720p', 12, 'full'], ['4k', 12, 'full'], ['720p', 360, 'long'],
                ['720p', 6, 'stop'], ['720p', 120, 'cancel'], ['720p', 12, 'cap'], ['720p', 12, 'retry'],
            ];
            for (const [resolution, frames, scenario] of cases) {
                for (const lane of scenario === 'full' || scenario === 'long' ? ['browser', 'ffmpeg'] : ['ffmpeg']) {
                    status.textContent = `Running ${resolution} ${lane} ${scenario}…\n` + JSON.stringify(report, null, 2);
                    const entry = { resolution, frames, scenario, lane };
                    report.results.push(entry);
                    const cues = frames > 60 ? [options.cue, Math.floor(frames / 2), frames - 3] : [options.cue];
                    const name = 'plexus-t20a2-' + crypto.randomUUID();
                    const dir = await root.getDirectoryHandle(name, { create: true });
                    try {
                        const t = performance.now();
                        const { video, wav, largestVideoWrite, pcmSliceBytes } = await stageInput(media, options, dir, resolution, frames, cues, lane === 'browser');
                        Object.assign(entry, { stagingMs: roundMs(t), videoBytes: video.size, wavBytes: wav?.size ?? 0, largestVideoWrite, pcmSliceBytes });
                        const { file, type, ...details } = lane === 'ffmpeg'
                            ? await finishOnDisk(options, dir, video, wav, scenario) : { file: video, bytes: video.size };
                        Object.assign(entry, details, { finishedMs: roundMs(t) });
                        if (scenario === 'cancel') assert(details.cancelled && !file, 'Cancelled job returned a file');
                        else {
                            assert(file && scenario !== 'cap', 'Expected file admission result did not occur');
                            entry.decoded = await verify(media, options, file, resolution, frames, cues, lane === 'ffmpeg' ? video : null);
                            if (resolution === '4k' && scenario === 'full' && entry.decoded.syncWithin10Ms && file.size < MIB) {
                                // Copy only short demo clips, after timing, so the scratch file can be deleted.
                                const item = document.createElement('li'), link = document.createElement('a');
                                link.href = URL.createObjectURL(new Blob([await file.arrayBuffer()], { type: 'video/mp4' }));
                                urls.push(link.href);
                                link.download = link.textContent = `4k-${lane}-disk.mp4`;
                                item.append(link); downloads.append(item);
                            }
                        }
                        entry.pass = true;
                    } catch (error) {
                        if (scenario === 'cap' && String(error).includes('Final MP4 byte limit exceeded')) {
                            entry.pass = true; entry.limitRejected = true;
                        } else { entry.pass = false; entry.error = String(error); }
                    } finally {
                        // Cancellation terminates the worker before removing its scratch tree.
                        await removeScratch(root, name);
                        entry.cleaned = true;
                    }
                }
            }
            report.syncPass = report.results.filter(r => r.decoded).every(r => r.decoded.syncWithin10Ms);
            report.pass = report.syncPass && report.results.every(r => r.pass && r.cleaned);
        } catch (error) { report.pass = false; report.error = String(error); }
        finally {
            status.textContent = JSON.stringify(report, null, 2);
            button.disabled = otherButton.disabled = false;
        }
    };
}
