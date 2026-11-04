import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const [outputRoot, ...files] = process.argv.slice(2);
if (!outputRoot || !files.length) {
    throw new Error('Usage: node research/export/ffmpeg-baseline.mjs <output-dir> <stereo-webm> [...]');
}

const run = (binary, args) => execFileSync(binary, args, { windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
const ffmpeg = args => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args]);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inspect = file => {
    const metadata = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_entries',
        'stream=codec_name,codec_type,width,height,start_time,duration,nb_read_frames,sample_rate,channels:format=duration,size',
        '-of', 'json', file]));
    const decoded = ffmpeg(['-i', file, '-map', '0:v:0', '-an', '-f', 'streamhash', '-']);
    const audio = ffmpeg(['-i', file, '-map', '0:a:0', '-f', 's16le', '-']);
    const sound = metadata.streams.find(stream => stream.codec_type === 'audio');
    return { ...metadata, decodedVideoSha256: decoded.toString().trim().split('=')[1],
        pcmSha256: hash(audio), pcmSamplesPerChannel: audio.length / (2 * sound.channels) };
};
const modes = [
    { name: 'webm-copy', ext: 'webm', flags: ['-c', 'copy'] },
    { name: 'mp4-copy', ext: 'mp4', flags: ['-c', 'copy', '-movflags', '+faststart'] },
    { name: 'mp4-h264-aac', ext: 'mp4', flags: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'] }
];

mkdirSync(outputRoot, { recursive: true });
const resultDir = mkdtempSync(join(resolve(outputRoot), 'native-'));
const version = run('ffmpeg', ['-version']).toString().split(/\r?\n/)[0];
const results = files.map((input, index) => {
    const file = resolve(input);
    const source = inspect(file);
    const outputs = modes.map(({ name, ext, flags }) => {
        const milliseconds = [];
        let target;
        for (let pass = 0; pass < 3; pass++) {
            target = join(resultDir, `${index + 1}-${name}-${pass + 1}.${ext}`);
            const start = performance.now();
            ffmpeg(['-i', file, '-map', '0:v:0', '-map', '0:a:0', ...flags, target]);
            milliseconds.push(Math.round(performance.now() - start));
        }
        const output = inspect(target);
        if (Number(output.streams.find(stream => stream.codec_type === 'video').nb_read_frames)
            !== Number(source.streams.find(stream => stream.codec_type === 'video').nb_read_frames)) {
            throw new Error(`Frame count changed in ${name}: ${file}`);
        }
        return { name, milliseconds, medianMilliseconds: [...milliseconds].sort((a, b) => a - b)[1],
            videoPixelsMatch: output.decodedVideoSha256 === source.decodedVideoSha256,
            pcmMatches: output.pcmSha256 === source.pcmSha256, ...output };
    });
    return { file: basename(file), source, outputs };
});

const receipt = join(resultDir, 'result.json');
writeFileSync(receipt, JSON.stringify({ version, results }, null, 2) + '\n');
console.log(receipt);
