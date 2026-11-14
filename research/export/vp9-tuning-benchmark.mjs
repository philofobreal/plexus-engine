// Local WH-06e experiment. Output stays under ignored logs; no browser assets are installed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { encodeVp9Probe, vp9Probe } from './vp9-10bit-probe.worker.mjs';
import { evaluateEncodedStats, QUALITY_POLICY } from './wormhole-quality.mjs';

const { width, height, fps, frames } = vp9Probe;
const lumaSamples = width * height;
const pictureBytes = lumaSamples * 3;
const clipBytes = pictureBytes * frames;
const hashes = {
    manifest: '548d3c3322be3356ef9233438f59b463a10f5531b6ea8390afce3fa7b44d6aee',
    scalar: 'a64f6d0f7be179a509177a6c79784fc05364e5aa1c54cf40579906095f4c03cb',
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const ffmpeg = (args, cwd, maxBuffer = 1024 * 1024) =>
    execFileSync('ffmpeg', ['-v', 'error', '-nostdin', ...args], { cwd, windowsHide: true, maxBuffer, timeout: 120_000 });
const profiles = [
    { name: 'lossless-good', realtime: 0, quantizer: 0 },
    { name: 'lossless-realtime', realtime: 1, quantizer: 0 },
    { name: 'q4-good', realtime: 0, quantizer: 4 },
    { name: 'q4-realtime', realtime: 1, quantizer: 4 },
];

const rawInput = filename => ['-f', 'rawvideo', '-pixel_format', 'yuv420p10le',
    '-video_size', width + 'x' + height, '-framerate', String(fps), '-i', filename];

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    assert.equal(sorted.length, 3);
    return sorted[1];
}

function copyPicture(core, clip, index) {
    let offset = index * pictureBytes;
    for (let plane = 0; plane < 3; plane++) {
        const rowBytes = plane === 0 ? width * 2 : width;
        const rows = plane === 0 ? height : height / 2;
        const pointer = core._probe_plane(plane);
        const stride = core._probe_stride(plane);
        assert.ok(pointer > 0 && stride >= rowBytes && pointer + (rows - 1) * stride + rowBytes <= core.HEAPU8.length);
        for (let row = 0; row < rows; row++) {
            const start = pointer + row * stride;
            core.HEAPU8.set(clip.subarray(offset, offset + rowBytes), start);
            offset += rowBytes;
        }
    }
    return 0;
}

function pictureChecks(reference, decoded) {
    assert.equal(reference.length, clipBytes);
    assert.equal(decoded.length, clipBytes);
    const original = new Uint16Array(reference.buffer, reference.byteOffset, clipBytes / 2);
    const candidate = new Uint16Array(decoded.buffer, decoded.byteOffset, clipBytes / 2);
    const { darkLumaCeiling, tileSize, maxDarkTileMeanError, maxTemporalError } = QUALITY_POLICY;
    let worstDarkTile = 0;
    let worstTemporal = 0;
    const ids = [];
    // Luma code values on the same scale as the RGBA quality limits.
    const darkLimit = 64 + 876 * darkLumaCeiling / 255;
    for (let frame = 0; frame < frames; frame++) {
        const base = frame * pictureBytes / 2;
        let id = 0;
        for (let bit = 0; bit < 6; bit++) {
            if (candidate[base + 16 * width + bit * 32 + 16] > 502) id |= 1 << bit;
        }
        ids.push(id);
        let temporalError = 0;
        for (let y = 0; y < height; y += tileSize) {
            for (let x = 0; x < width; x += tileSize) {
                let darkError = 0;
                let darkCount = 0;
                for (let dy = 0; dy < tileSize; dy++) {
                    let i = base + (y + dy) * width + x;
                    for (let dx = 0; dx < tileSize; dx++, i++) {
                        const error = candidate[i] - original[i];
                        if (original[i] <= darkLimit) {
                            darkError += error;
                            darkCount++;
                        }
                        if (frame) {
                            const previous = i - pictureBytes / 2;
                            temporalError += Math.abs(error - (candidate[previous] - original[previous]));
                        }
                    }
                }
                if (darkCount) worstDarkTile = Math.max(worstDarkTile, Math.abs(darkError / darkCount) * 255 / 876);
            }
        }
        worstTemporal = Math.max(worstTemporal, temporalError * 255 / (876 * lumaSamples));
    }
    return { ids, worstDarkTile, worstTemporal,
        pass: worstDarkTile <= maxDarkTileMeanError && worstTemporal <= maxTemporalError };
}

async function evaluate(out, name, reference, expectedId) {
    const file = path.join(out, name + '.mp4');
    const referenceFile = path.join(out, reference.name + '.yuv');
    const video = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,pix_fmt,avg_frame_rate:packet=pts_time,duration_time,flags',
        '-show_packets', '-show_streams', '-of', 'json', file], { windowsHide: true, timeout: 30_000 }));
    assert.equal(video.streams.length, 1);
    const stream = video.streams[0];
    assert.deepEqual([stream.width, stream.height, stream.pix_fmt, stream.avg_frame_rate],
        [width, height, 'yuv420p10le', '30/1']);
    assert.equal(video.packets.length, frames);
    video.packets.forEach((packet, index) => {
        assert.ok(packet.flags.includes('K'));
        assert.ok(Math.abs(Number(packet.pts_time) - index / fps) < 1e-6);
        assert.ok(Math.abs(Number(packet.duration_time) - 1 / fps) < 1e-6);
    });
    const decoded = ffmpeg(['-threads', '2', '-i', file, '-an', '-pix_fmt', 'yuv420p10le',
        '-f', 'rawvideo', '-'], out, clipBytes + pictureBytes);
    const checks = pictureChecks(reference.bytes, decoded);
    checks.frameOrderPass = checks.ids.every((id, i) => id === expectedId + i);

    const ssimFile = name + '-ssim.txt';
    const psnrFile = name + '-psnr.txt';
    const rgb = 'scale=in_range=tv:in_color_matrix=bt709,format=gbrp16le,settb=AVTB,setpts=N/(30*TB)';
    const filter = `[0:v]${rgb},split[a][c];[1:v]${rgb},split[b][d];[a][b]ssim=stats_file=${ssimFile}[s];[c][d]psnr=stats_file=${psnrFile}[p]`;
    ffmpeg([...rawInput(referenceFile), '-threads', '2', '-i', file, '-filter_complex_threads', '2',
        '-filter_complex', filter, '-map', '[s]', '-map', '[p]', '-an', '-f', 'null', '-'], out);
    const fidelity = evaluateEncodedStats(await readFile(path.join(out, ssimFile), 'utf8'),
        await readFile(path.join(out, psnrFile), 'utf8'), frames);
    return { checks, fidelity, decodedSha256: sha256(decoded), bitExact: decoded.equals(reference.bytes) };
}

async function benchmark(sourcePath, corePath, outputPath) {
    const source = path.resolve(sourcePath);
    const coreDir = path.resolve(corePath);
    const out = path.resolve(outputPath);
    assert.ok(path.relative(path.resolve('logs'), out).split(path.sep)[0].startsWith('wh06e-'));
    await mkdir(out);
    const sourceManifest = await readFile(path.join(source, 'source-frames.json'));
    assert.equal(sha256(sourceManifest), hashes.manifest);
    const start = 18;
    const clip = JSON.parse(sourceManifest).sources.find(row => row.name === 'export-002.mp4');
    assert.equal(clip.fps, fps);
    const archivedFrames = clip.frames.slice(start, start + frames);
    assert.equal(archivedFrames.length, frames);
    for (const [index, frame] of archivedFrames.entries()) {
        const expectedName = 'source-export-002-' + String(start + index).padStart(3, '0') + '.png';
        assert.equal(frame.name, expectedName);
        assert.equal(sha256(await readFile(path.join(source, frame.name))), frame.sha256);
    }
    const wormhole = ffmpeg(['-framerate', String(fps), '-start_number', String(start), '-i',
        path.join(source, 'source-export-002-%03d.png'), '-vf', 'scale=out_range=tv:out_color_matrix=bt709',
        '-frames:v', String(frames), '-pix_fmt', 'yuv420p10le', '-f', 'rawvideo', '-'], out, clipBytes + pictureBytes);
    assert.equal(wormhole.length, clipBytes);

    const scalarDir = path.resolve('public/export/libvpx-1.17.0');
    const scalar = await readFile(path.join(scalarDir, 'vp9-10bit-probe.wasm'));
    assert.equal(sha256(scalar), hashes.scalar);
    const { default: createScalar } = await import(pathToFileURL(path.join(scalarDir, 'vp9-10bit-probe.mjs')));
    const control = await encodeVp9Probe(await createScalar({ wasmBinary: scalar }));
    await writeFile(path.join(out, 'shipped-scalar.mp4'), Buffer.from(control.buffer), { flag: 'wx' });
    const synthetic = ffmpeg(['-threads', '2', '-i', 'shipped-scalar.mp4', '-an',
        '-pix_fmt', 'yuv420p10le', '-f', 'rawvideo', '-'], out, clipBytes + pictureBytes);
    assert.equal(sha256(synthetic), '6bed43471dca408ee9e11bcc0c270217e1f38ace4680bd87226c56a48b80dbb8');
    const tuned = await readFile(path.join(coreDir, 'vp9-10bit-probe.wasm'));
    const { default: createCore } = await import(pathToFileURL(path.join(coreDir, 'vp9-10bit-probe.mjs')));
    const rows = [];
    // Reuse initialized modules across jobs, with fresh libvpx state each time.
    const core = await createCore({ wasmBinary: tuned });
    assert.equal(core._probe_open_profile(2, 0), -6);
    assert.equal(core._probe_open_profile(0, 64), -6);
    const sources = [
        { name: 'synthetic', bytes: synthetic, firstId: 1 },
        { name: 'wormhole', bytes: wormhole, firstId: start + 1 },
    ];
    for (const reference of sources) {
        await writeFile(path.join(out, reference.name + '.yuv'), reference.bytes, { flag: 'wx' });
        const fill = reference.name === 'wormhole' ? (module, index) => copyPicture(module, reference.bytes, index) : undefined;
        for (const profile of profiles) {
            const { buffer, stats } = await encodeVp9Probe(core, { fill, tuning: profile });
            const name = reference.name + '-' + profile.name;
            await writeFile(path.join(out, name + '.mp4'), Buffer.from(buffer), { flag: 'wx' });
            const result = await evaluate(out, name, reference, reference.firstId);
            if (profile.quantizer === 0) assert.ok(result.bitExact, name + ' lossless encoding changed the source');
            assert.ok(result.checks.frameOrderPass, name + ' frame order');
            const qualityPass = result.checks.pass && result.fidelity.pass;
            const row = { source: reference.name, profile, stats, qualityPass, result, mp4Sha256: sha256(Buffer.from(buffer)) };
            rows.push(row);
            console.log(JSON.stringify({ name, totalMs: stats.totalMs, ratePass: stats.sampledRatePass, qualityPass,
                bitExact: result.bitExact, minSsim: result.fidelity.minSsim, minPsnrDb: result.fidelity.minPsnrDb }));
        }
    }
    const comparison = [];
    const reference = profiles[0], candidate = profiles[3];
    // Alternate order. Keep FFmpeg analysis and module startup outside this measurement.
    for (const pair of [[reference, candidate], [candidate, reference], [reference, candidate]]) {
        for (const profile of pair) {
            const { stats } = await encodeVp9Probe(core, {
                fill: (module, index) => copyPicture(module, wormhole, index),
                tuning: profile,
            });
            const prior = rows.find(row => row.source === 'wormhole' && row.profile === profile);
            assert.equal(stats.encodedBytes, prior.stats.encodedBytes);
            comparison.push({ profile: profile.name, totalMs: stats.totalMs, encodeMs: stats.encodeMs });
        }
    }
    const medianMs = name => median(comparison.filter(row => row.profile === name).map(row => row.totalMs));
    const referenceMedianMs = medianMs(reference.name);
    const candidateMedianMs = medianMs(candidate.name);
    const durationDecreasePct = 100 * (1 - candidateMedianMs / referenceMedianMs);
    console.log(JSON.stringify({ referenceMedianMs, candidateMedianMs, durationDecreasePct }));
    await writeFile(path.join(out, 'benchmark.json'), JSON.stringify({
        source, archiveStart: start, archivedFrames, profiles,
        coreSha256: sha256(tuned), shippedControl: { stats: control.stats, sha256: hashes.scalar },
        sourceSha256: Object.fromEntries(sources.map(item => [item.name, sha256(item.bytes)])),
        rows, speed: { comparison, referenceMedianMs, candidateMedianMs, durationDecreasePct },
    }, null, 2) + '\n', { flag: 'wx' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const [source, core, output] = process.argv.slice(2);
    if (!source || !core || !output) throw Error('Usage: node research/export/vp9-tuning-benchmark.mjs ARCHIVED_RUN TUNING_CORE NEW_LOG_DIRECTORY');
    await benchmark(source, core, output);
}
