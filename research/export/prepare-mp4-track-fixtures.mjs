// Local only: generate bounded research fixtures from explicitly selected tracks.
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const input = process.argv[2];
if (!input) throw Error('Pass a local directory containing one to five MP3 reference tracks.');
const files = readdirSync(input, { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.mp3$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));
if (files.length < 1 || files.length > 5) throw Error('Select one to five MP3 reference tracks.');
const root = path.resolve('logs/t20a2b/tracks');
mkdirSync(root, { recursive: true });
const FPS = 30, SR = 48000, MAX_SECONDS = 900;
const run = (exe, args) => execFileSync(exe, args, { windowsHide: true, encoding: 'utf8' });
const ffmpeg = (...args) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args]);
const probe = (file, args) => JSON.parse(run('ffprobe', ['-v', 'error', ...args, '-of', 'json', file]));
const seed = path.join(root, 'seed.mp4');
ffmpeg('-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30', '-t', '2',
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-g', '60', '-bf', '0', '-b:v', '600k', seed);
const tracks = [];
for (const [i, entry] of files.entries()) {
    const source = path.resolve(input, entry.name);
    const measured = probe(source, ['-show_entries', 'format=duration']);
    if (!(Number(measured.format?.duration) > 0 && Number(measured.format.duration) <= MAX_SECONDS)) {
        throw Error('Fixture duration must be positive and at most 15 minutes.');
    }
    const id = String(i + 1), temp = path.join(root, id + '-decoded.tmp.wav');
    const wav = path.join(root, id + '.wav'), video = path.join(root, id + '.mp4');
    try {
        ffmpeg('-i', source, '-map', '0:a:0', '-ar', String(SR), '-ac', '2', '-c:a', 'pcm_s16le', temp);
        const decoded = Number(probe(temp, ['-select_streams', 'a:0', '-show_entries', 'stream=duration_ts']).streams?.[0]?.duration_ts);
        if (!Number.isSafeInteger(decoded) || decoded < SR || decoded > MAX_SECONDS * SR) throw Error('Unexpected decoded length');
        const frames = Math.floor(decoded * FPS / SR), samples = frames * SR / FPS;
        ffmpeg('-i', temp, '-af', 'atrim=end_sample=' + samples, '-c:a', 'pcm_s16le', wav);
        ffmpeg('-stream_loop', '-1', '-i', seed, '-frames:v', String(frames), '-c:v', 'copy',
            '-movflags', '+frag_keyframe+empty_moov+default_base_moof', video);
        const vp = probe(video, ['-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets,duration']).streams[0];
        const ap = probe(wav, ['-select_streams', 'a:0', '-show_entries', 'stream=duration_ts']).streams[0];
        if (Number(vp.nb_read_packets) !== frames || Math.abs(Number(vp.duration) - frames / FPS) > .001
            || Number(ap.duration_ts) !== samples) throw Error('Fixture is not on the requested frame/sample clock');
        tracks.push({ id, frames, samples, fps: FPS, sampleRate: SR, videoBytes: statSync(video).size, wavBytes: statSync(wav).size });
    } finally { rmSync(temp, { force: true }); }
}
writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(tracks, null, 2) + '\n');
console.log(JSON.stringify(tracks));
