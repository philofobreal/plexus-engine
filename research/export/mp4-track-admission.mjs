import { checkMp4Storage, planMp4Storage } from './mp4-storage-admission.mjs';
import { finishOnDisk, removeScratch } from './mp4-storage-comparison.mjs';

const assert = (test, message) => { if (!test) throw Error(message); };
const elapsed = start => Math.round(performance.now() - start);
const AAC_BLOCK = 1024;
const MIB = 1024 * 1024;

async function stage(dir, id, ext, expected, limit) {
    assert(expected <= limit, 'Input exceeds its planned storage cap');
    const response = await fetch('/track-fixtures/' + id + '.' + ext);
    assert(response.ok && response.body, 'Missing generated track fixture');
    const handle = await dir.getFileHandle('source.' + ext, { create: true });
    const writer = await handle.createWritable();
    let bytes = 0, peakChunk = 0;
    await response.body.pipeTo(new WritableStream({
        async write(chunk) {
            bytes += chunk.byteLength;
            assert(bytes <= limit, 'Input exceeded its storage cap while staging');
            peakChunk = Math.max(peakChunk, chunk.byteLength);
            await writer.write(chunk);
        },
        close: () => writer.close(),
    })).catch(async error => {
        await writer.abort(error).catch(() => {});
        throw error;
    });
    const file = await handle.getFile();
    assert(file.size === expected && bytes === expected, 'Staged input size differs from the manifest');
    return { file, peakChunk };
}

async function validateOutput(media, mp4, video, wav, expected) {
    const read = blob => new media.Input({ formats: media.ALL_FORMATS, source: new media.BlobSource(blob) });
    const result = read(mp4), original = read(video);
    const ctx = new AudioContext({ sampleRate: expected.sampleRate });
    try {
        const picture = await result.getPrimaryVideoTrack(), sound = await result.getPrimaryAudioTrack();
        assert(picture?.codec === 'avc' && sound?.codec === 'aac' && sound.sampleRate === expected.sampleRate, 'Wrong output codecs or clock');
        const source = new media.EncodedPacketSink(await original.getPrimaryVideoTrack()).packets();
        let frames = 0, end = 0;
        try {
            for await (const packet of new media.EncodedPacketSink(picture).packets()) {
                const { done, value } = await source.next();
                assert(!done && packet.timestamp === value.timestamp
                    && Math.abs(packet.timestamp - frames / expected.fps) < .001
                    && packet.data.length === value.data.length
                    && packet.data.every((byte, i) => byte === value.data[i]), 'Video packet or timestamp changed at frame ' + frames);
                frames++;
                end = packet.timestamp + packet.duration;
            }
            assert((await source.next()).done && frames === expected.frames
                && Math.abs(end - frames / expected.fps) < .001, 'Video ended at an unexpected frame');
        } finally { await source.return(); }
        // Validation only, outside the measured export: decode exact AAC playback length.
        const pcm = await ctx.decodeAudioData(await mp4.arrayBuffer());
        assert(pcm.numberOfChannels === 2 && Math.abs(pcm.length - expected.samples) <= AAC_BLOCK, 'AAC playback endpoint mismatch');
        const header = new DataView(await wav.slice(0, 4096).arrayBuffer());
        let wavStart;
        for (let pos = 12; pos + 8 <= header.byteLength;) {
            if (header.getUint32(pos) === 0x64617461) { wavStart = pos + 8; break; } // "data"
            const size = header.getUint32(pos + 4, true);
            pos += 8 + size + (size % 2);
        }
        assert(wavStart, 'No PCM data chunk in normalized WAV');
        const n = expected.sampleRate;
        const audioWindows = [];
        for (const start of new Set([0, Math.floor((expected.samples - n) / 2), Math.max(0, expected.samples - 3 * n), expected.samples - n])) {
            const reference = new DataView(await wav.slice(wavStart + 4 * start, wavStart + 4 * (start + n)).arrayBuffer());
            audioWindows.push([0, 1].map(c => {
                const channel = pcm.getChannelData(c);
                let src = 0, dest = 0, dot = 0;
                for (let i = 0; i < n; i++) {
                    const a = reference.getInt16(4 * i + 2 * c, true) / 32768, b = channel[start + i] ?? 0;
                    src += a * a; dest += b * b; dot += a * b;
                }
                const sourceRms = Math.sqrt(src / n), outputRms = Math.sqrt(dest / n);
                const correlation = sourceRms >= .005 ? dot / Math.sqrt(src * dest) : null;
                assert(correlation === null ? outputRms < .01 : correlation >= .9, 'Decoded AAC does not match the source window');
                return { rms: Math.round(10000 * outputRms) / 10000, correlation: correlation === null ? null : Math.round(correlation * 1000) / 1000 };
            }));
        }
        assert(audioWindows.flat().some(w => w.correlation !== null), 'Reference output is silent');
        return { frames, end, audioSamples: pcm.length, audioDeltaSamples: pcm.length - expected.samples, audioWindows };
    } finally { result.dispose(); original.dispose(); await ctx.close(); }
}

export function installMp4TrackAdmission(options) {
    const { button, otherButtons, asset } = options;
    const output = document.querySelector('#track-result');
    button.disabled = false;
    button.onclick = async () => {
        for (const control of [button, ...otherButtons]) control.disabled = true;
        const report = { results: [] };
        try {
            const info = await fetch('/fixture-info.json').then(r => r.json());
            assert(info.tracksAvailable, 'Generate the local audio fixtures first.');
            const forceFull = new URLSearchParams(location.search).get('core') === 'full';
            report.core = !forceFull && info.reducedWasmBytes ? 'reduced' : 'full';
            report.wasmBytes = report.core === 'reduced' ? info.reducedWasmBytes : info.coreWasmBytes;
            const [media, tracks, root] = await Promise.all([
                import(/* @vite-ignore */ asset('mediabunny.mjs')),
                fetch('/track-fixtures/manifest.json').then(r => r.json()),
                navigator.storage.getDirectory(),
            ]);
            assert(Array.isArray(tracks) && tracks.length > 0 && tracks.length <= 5, 'Invalid local track manifest');
            for (const track of tracks) {
                assert(/^[1-5]$/.test(track.id), 'Invalid local track identifier');
                const row = { track: track.id };
                report.results.push(row);
                output.textContent = `Running full track ${track.id} with ${report.core} WASM…\n` + JSON.stringify(report, null, 2);
                const config = { ...track, sourceSamples: track.samples, waveHeaderBytes: 4096 };
                const plan = planMp4Storage({ ...config, videoBitrate: 6_000_000 });
                row.budget = plan;
                row.projected4k = planMp4Storage({ ...config, videoBitrate: 28_000_000 }).required;
                row.start = checkMp4Storage(plan, await navigator.storage.estimate());
                const constrained = checkMp4Storage(plan, { quota: 1024 * MIB, usage: 900 * MIB });
                const unknown = checkMp4Storage(plan, {});
                row.denials = [constrained.reason, unknown.reason];
                assert(!constrained.ok && !unknown.ok, 'Admission failed to reject constrained or unknown storage');
                assert(row.start.ok, 'Preflight refused local track: ' + row.start.reason);
                const name = 'plexus-t20a2b-' + crypto.randomUUID();
                const dir = await root.getDirectoryHandle(name, { create: true });
                try {
                    const start = performance.now();
                    const video = await stage(dir, track.id, 'mp4', track.videoBytes, plan.limits.video);
                    // Normalized FFmpeg WAV can contain ancillary RIFF chunks in addition to the minimal 44-byte header.
                    const wav = await stage(dir, track.id, 'wav', track.wavBytes, plan.limits.audio);
                    row.stageMs = elapsed(start);
                    row.inputBytes = [video.file.size, wav.file.size];
                    row.peakInputChunk = Math.max(video.peakChunk, wav.peakChunk);
                    row.finalize = checkMp4Storage(plan, await navigator.storage.estimate(), 'finalize');
                    assert(row.finalize.ok, 'Quota decreased before finalization: ' + row.finalize.reason);
                    const { file, type, ...metrics } = await finishOnDisk(options, dir, video.file, wav.file, 'full',
                        { limit: plan.limits.output, core: report.core, commandTimeout: 90_000 });
                    row.finishMs = elapsed(start);
                    row.worker = metrics;
                    row.decoded = await validateOutput(media, file, video.file, wav.file, track);
                    row.pass = true;
                } catch (error) { row.pass = false; row.error = String(error); }
                finally { await removeScratch(root, name); row.cleaned = true; }
            }
            report.pass = report.results.every(r => r.pass && r.cleaned);
        } catch (error) { report.pass = false; report.error = String(error); }
        finally {
            output.textContent = JSON.stringify(report, null, 2);
            for (const control of [button, ...otherButtons]) control.disabled = false;
        }
    };
}
