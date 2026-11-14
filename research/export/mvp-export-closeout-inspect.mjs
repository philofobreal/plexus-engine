// Independent output inspection. Music and video artifacts stay on the local machine.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [track, directory] = process.argv.slice(2);
assert.ok(track && directory, 'Usage: node research/export/mvp-export-closeout-inspect.mjs TRACK RUN_DIRECTORY');
const out = path.resolve(directory);
const source = path.resolve(track);
const report = JSON.parse(await readFile(path.join(out, 'browser.json'), 'utf8'));
const read = (program, args, maxBuffer = 16 * 1024 * 1024) =>
    execFileSync(program, args, { windowsHide:true, maxBuffer, timeout:15 * 60_000 });
const ffmpeg = (args, maxBuffer) => read('ffmpeg', ['-v', 'error', '-xerror', '-nostdin', ...args], maxBuffer);
const ffprobe = args => JSON.parse(read('ffprobe', ['-v', 'error', '-of', 'json', ...args]));
async function sha256(file) {
    const hash = createHash('sha256');
    for await (const data of createReadStream(file)) hash.update(data);
    return hash.digest('hex');
}
const originalSeconds = Number(ffprobe(['-show_entries', 'format=duration', source]).format.duration);

// Compare one second of mono PCM with small timing shifts. Window reads are bounded.
function audioWindow(file, second, shifted = false) {
    const bytes = ffmpeg(['-i', file, '-ss', String(second - (shifted ? .05 : 0)), '-t', shifted ? '1.1' : '1',
        '-map', '0:a:0', '-ac', '1', '-ar', '8000', '-f', 's16le', '-']);
    return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
}
function correlateAudio(file, seconds) {
    return seconds.map(second => {
        const reference = audioWindow(source, second);
        const candidate = audioWindow(file, second, true);
        assert.equal(reference.length, 8000);
        assert.equal(candidate.length, 8800);
        let best = { correlation:-1, offsetMs:0 };
        let energy = 0;
        for (const value of reference) energy += value ** 2;
        for (let shift = 0; shift <= 800; shift += 2) {
            let sum = 0, candidateEnergy = 0;
            for (let i = 0; i < reference.length; i++) {
                const value = candidate[i + shift];
                sum += reference[i] * value;
                candidateEnergy += value ** 2;
            }
            const correlation = sum / Math.sqrt(energy * candidateEnergy);
            if (correlation > best.correlation) best = { correlation, offsetMs:(shift - 400) / 8 };
        }
        return { second, ...best };
    });
}

function motionWindows(file, fps) {
    const width = 192, height = 108, picture = width * height;
    return [[46, 62], [83, 94]].map(([start, end]) => {
        const pixels = ffmpeg(['-threads', '2', '-ss', String(start), '-i', file, '-t', String(end - start),
            '-an', '-vf', `scale=${width}:${height}:flags=area,format=gray`, '-f', 'rawvideo', '-'], 32 * 1024 * 1024);
        assert.equal(pixels.length, picture * (end - start) * fps);
        const bySecond = [];
        for (let second = start; second < end; second++) {
            let duplicatePairs = 0, exactTwoFrameReturns = 0, meanChange = 0, peakChange = 0;
            const first = (second - start) * fps;
            for (let frame = Math.max(1, first); frame < first + fps; frame++) {
                const offset = frame * picture;
                let difference = 0;
                for (let i = offset; i < offset + picture; i++) difference += Math.abs(pixels[i] - pixels[i - picture]);
                const average = difference / picture;
                if (!difference) duplicatePairs++;
                if (difference && frame > 1 && pixels.subarray(offset, offset + picture)
                    .equals(pixels.subarray(offset - 2 * picture, offset - picture))) exactTwoFrameReturns++;
                meanChange += average;
                peakChange = Math.max(peakChange, average);
            }
            bySecond.push({ second, duplicatePairs, exactTwoFrameReturns, peakChange,
                meanChange:meanChange / (first ? fps : fps - 1) });
        }
        return { start, end, bySecond };
    });
}

const rows = [];
for (const item of report.rows.filter(row => row.file)) {
    assert.match(item.file, /^(?:full|stop|retry)\.(?:mp4|webm)$/);
    const file = path.join(out, item.file);
    const streams = ffprobe(['-show_entries', 'stream=codec_type,codec_name,width,height,pix_fmt,channels,sample_rate,time_base,avg_frame_rate:format=duration,start_time', file]);
    const video = streams.streams.find(stream => stream.codec_type === 'video');
    const audio = streams.streams.find(stream => stream.codec_type === 'audio');
    const fps = Number(item.config.fps);
    const webm = item.config.format.startsWith('webm');
    const tenBit = ['mp4vp9', 'webm10'].includes(item.config.format);
    const [width, height] = item.config.res === '4K' ? [3840, 2160] : [1280, 720];
    assert.deepEqual([video.width, video.height], [width, height]);
    assert.equal(audio.codec_name, webm ? 'opus' : 'aac');
    assert.equal(audio.channels, 2);
    if (tenBit) assert.deepEqual([video.codec_name, video.pix_fmt], ['vp9', 'yuv420p10le']);
    else if (!webm) assert.equal(video.codec_name, 'h264');

    const frames = ffprobe(['-threads', '2', '-select_streams', 'v:0', '-show_frames',
        '-show_entries', 'frame=best_effort_timestamp_time,key_frame', file]).frames;
    const first = Number(frames[0].best_effort_timestamp_time);
    const maxClockError = frames.reduce((error, frame, i) =>
        Math.max(error, Math.abs(Number(frame.best_effort_timestamp_time) - first - i / fps)), 0);
    assert.ok(Math.abs(first) <= .01 && maxClockError <= .0011, 'Decoded frame clock mismatch');
    if (item.id === 'full') assert.ok(Math.abs(frames.length - originalSeconds * fps) <= 3, 'Full track ended early');
    else assert.ok(frames.length > fps && frames.length < originalSeconds * fps * .15, 'Stop did not save a bounded prefix');
    const duration = frames.length / fps;
    if (streams.format.duration !== undefined) {
        assert.ok(Math.abs(Number(streams.format.duration) - duration) <= .075, 'Container duration disagrees with the video');
    }
    const pcm = ffmpeg(['-i', file, '-map', '0:a:0', '-ac', '1', '-ar', '8000', '-f', 's16le', '-']);
    const audioDuration = pcm.length / 16000;
    assert.ok(Math.abs(audioDuration - duration) <= .075, 'Video and decoded audio endpoints disagree');
    const audioChecks = correlateAudio(file, item.id === 'full'
        ? [2, 47, 59, 85, 90, 205, Math.floor(duration) - 2] : [1, Math.floor(duration) - 2].filter(second => second >= 1));
    assert.ok(audioChecks.length && audioChecks.every(row => row.correlation >= .9 && Math.abs(row.offsetMs) <= 1000 / fps),
        'Audio against reference failed: ' + JSON.stringify(audioChecks));
    const motion = item.id === 'full' ? motionWindows(file, fps) : [];
    const row = { artifact:item.file, bytes:item.bytes, sha256:await sha256(file), format:streams.format,
        video, audio, fps, frames:frames.length, keys:frames.filter(frame => frame.key_frame).length,
        firstVideoSec:first, maxVideoClockErrorMs:1000 * maxClockError, videoDuration:duration, audioDuration, audioChecks, motion };
    rows.push(row);
    console.log(JSON.stringify({ artifact:row.artifact, frames:row.frames, duration, audioDuration, maxVideoClockErrorMs:row.maxVideoClockErrorMs, audioChecks }));
}
assert.ok(rows.length);
await writeFile(path.join(out, 'native.json'), JSON.stringify({ release:report.release, profile:report.profile,
    sourceSha256:await sha256(source), originalSeconds, rows,
    method:'Independent FFmpeg frame decode and clock, decoded PCM window correlation, and reduced luma comparisons. Motion measures exact repeated reduced images and overall variation, without a layer-specific source reference.' }, null, 2) + '\n', { flag:'wx' });
