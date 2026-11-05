import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const production = process.argv.includes('--production');
const logs = path.resolve(production ? 'logs/mp4-motion/production' : 'logs/mp4-motion');
const run = (await readFile(path.join(logs, 'active-run.txt'), 'utf8')).trim();
assert.ok(run.startsWith(logs + path.sep) && path.basename(run).startsWith('run-'));
const report = JSON.parse(await readFile(path.join(run, 'motion.json'), 'utf8'));
const reference = await readFile(path.join(run, 'motion.gray'));
const referenceHash = createHash('sha256').update(reference).digest('hex');
assert.ok(report.pass && report.visible);
assert.deepEqual(report.rows.map(row => row.motionVariant), production ? ['production'] : ['current', 'webm', 'cbr', 'gop']);
const { fps } = report;
const { x, y, width, height, frames } = report.rows[0].region;
const pixels = width * height;
assert.equal(reference.length, pixels * frames);
assert.equal(frames, 14 * fps);
assert.ok(report.rows.every(row => row.referenceHash === referenceHash));

function decodeAudio(file) {
    return execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-nostdin', '-i', file,
        '-map', '0:a:0', '-ar', '48000', '-ac', '2', '-f', 's16le', '-'],
    { maxBuffer: 4 * 1024 * 1024, windowsHide: true, timeout: 60_000 });
}
const sourceAudio = decodeAudio(path.join(run, 'reference.wav'));
function verifyAudio(file) {
    const audio = decodeAudio(file);
    assert.ok(Math.abs(audio.length - sourceAudio.length) <= 2048 * 4);
    return [1, 7, 12].map(second => {
        let xx = 0, yy = 0, xy = 0;
        for (let offset = second * 192000; offset < second * 192000 + 96000; offset += 2) {
            const x = sourceAudio.readInt16LE(offset), y = audio.readInt16LE(offset);
            xx += x * x; yy += y * y; xy += x * y;
        }
        const correlation = xy / Math.sqrt(xx * yy);
        assert.ok(correlation > .9, 'Export audio differs from the source');
        return correlation;
    });
}

async function compare(file) {
    const { streams: [video], packets } = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=codec_name,width,height:packet=pts_time,size,flags', '-of', 'json', file]));
    assert.deepEqual([video.width, video.height], [3840, 2160]);
    assert.equal(packets.length, frames);
    const pts = packets.map(packet => Number(packet.pts_time)).sort((a, b) => a - b);
    assert.ok(pts.every((time, frame) => Math.abs(time - frame / fps) <= .00051));
    const decoder = spawn('ffmpeg', ['-v', 'error', '-xerror', '-nostdin', '-threads', '4', '-i', file,
        '-an', '-vf', `crop=${width}:${height}:${x}:${y},format=rgb24`, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let error = '';
    decoder.stderr.setEncoding('utf8').on('data', chunk => { error = (error + chunk).slice(-4000); });
    const exit = new Promise(resolve => {
        decoder.once('error', error => resolve(error));
        decoder.once('close', code => resolve(code));
    });
    const rgb = Buffer.alloc(pixels * 3);
    const previous = new Uint8Array(pixels);
    let offset = 0, index = 0;
    const details = [];
    for await (const chunk of decoder.stdout) {
        let consumed = 0;
        while (consumed < chunk.length) {
            const length = Math.min(rgb.length - offset, chunk.length - consumed);
            chunk.copy(rgb, offset, consumed, consumed + length);
            consumed += length;
            offset += length;
            if (offset !== rgb.length) continue;
            assert.ok(index < frames, 'Extra decoded frame');
            const base = index * pixels;
            let spatial = 0, temporal = 0, sourceMotion = 0, outputMotion = 0, sameDirection = 0;
            for (let i = 0, p = 0; i < pixels; i++, p += 3) {
                const luma = (54 * rgb[p] + 183 * rgb[p + 1] + 19 * rgb[p + 2] + 128) >> 8;
                spatial += Math.abs(luma - reference[base + i]);
                if (index) {
                    const sourceDelta = reference[base + i] - reference[base - pixels + i];
                    const outputDelta = luma - previous[i];
                    temporal += Math.abs(outputDelta - sourceDelta);
                    sourceMotion += Math.abs(sourceDelta);
                    outputMotion += Math.abs(outputDelta);
                    sameDirection += sourceDelta * outputDelta;
                }
                previous[i] = luma;
            }
            details.push({ frame: index, spatial: spatial / pixels, temporal: temporal / pixels,
                sourceMotion: sourceMotion / pixels, outputMotion: outputMotion / pixels, sameDirection });
            index++;
            offset = 0;
        }
    }
    const code = await exit;
    assert.equal(code, 0, String(error || code));
    assert.equal(offset, 0);
    assert.equal(details.length, frames);
    const average = (rows, name) => rows.reduce((sum, row) => sum + row[name], 0) / rows.length;
    const seconds = Array.from({ length: frames / fps }, (_, second) => {
        const start = second * fps, window = details.slice(start, start + fps);
        const videoBytes = packets.filter(packet => Math.round(Number(packet.pts_time) * fps) >= start
            && Math.round(Number(packet.pts_time) * fps) < start + fps).reduce((sum, packet) => sum + Number(packet.size), 0);
        return { second, videoBytes, spatial: average(window, 'spatial'), temporal: average(window, 'temporal'),
            boundary: window[0], tailSpatial: average(window.slice(-10), 'spatial') };
    });
    return { video, keyframes: packets.filter(packet => packet.flags.startsWith('K')).map(packet => Number(packet.pts_time)),
        spatial: average(details, 'spatial'), temporal: average(details.slice(1), 'temporal'),
        boundaryTemporal: average(seconds.slice(1).map(row => row.boundary), 'temporal'), seconds };
}

const variants = [];
for (const row of report.rows) {
    const file = path.join(run, row.artifact);
    const result = await compare(file);
    const keyInterval = row.motionVariant === 'gop' ? 2 : 1;
    assert.deepEqual(result.keyframes, Array.from({ length: 14 / keyInterval }, (_, i) => i * keyInterval));
    variants.push({ ...row, ...result, audioCorrelation: verifyAudio(file) });
}
await writeFile(path.join(run, 'motion-verification.json'), JSON.stringify({ referenceHash, fps, variants }, null, 2) + '\n');
console.log(JSON.stringify(variants.map(({ motionVariant, spatial, temporal, boundaryTemporal, keyframes, seconds }) => ({
    motionVariant, spatial, temporal, boundaryTemporal, keyframes,
    videoMegabitsPerSecond: seconds.reduce((sum, row) => sum + row.videoBytes * 8e-6, 0) / seconds.length,
}))));
