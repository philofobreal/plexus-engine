// Desktop qualification runner. Serves only loopback and stores fixture output in logs.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { build } from 'vite';

const [mode, source] = process.argv.slice(2);
const profiling = mode === 'profile';
const pacing = mode === 'pacing' || mode === 'verify-pacing';
const logs = path.resolve(pacing ? 'logs/t20b2' : profiling ? 'logs/t20b1' : 'logs/t20a3a');
const production = path.resolve('dist');
const allowed = /^(?:benchmark\.json|mp4-profile\.json|(?:long|4k)\.(?:mp4|webm)|real-track\.mp4|pacing\.json|pacing-(?:(?:720p|4k)-(?:display|cooperative)-[1-3]|stop)\.mp4)$/;
const fixtureRoute = '/plexus-engine/research/export/mvp-export-qualification.html';
const maxBytes = 128 * 1024 * 1024;
const tool = (name, args) => execFileSync(name, args, { windowsHide: true, encoding: 'utf8', timeout: 180_000 });
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const activeRun = path.join(logs, 'active-run.txt');

async function serve(source) {
    if (pacing && !source) throw Error('Supply the reference MP3 for the pacing comparison.');
    await mkdir(logs, { recursive: true });
    const fixture = path.join(logs, 'site'), output = path.join(logs, 'run-' + randomUUID());
    await mkdir(output, { recursive: true });
    await stat(path.join(production, 'mvp/index.html'));
    const clipSeconds = pacing ? 4 : 60;
    if (source) {
        // One real excerpt exercises the actual MVP renderer. Never put it in public/ or dist/.
        const reference = path.join(output, 'reference.wav');
        tool('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', '60', '-i', path.resolve(source),
            '-t', String(clipSeconds), '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', reference]);
        const samples = tool('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
            '-show_entries', 'stream=duration_ts', '-of', 'default=nw=1:nk=1', reference]);
        assert.equal(Number(samples.trim()), clipSeconds * 48000, 'The reference excerpt is incomplete.');
    }
    await build({
        configFile: false, base: '/plexus-engine/', publicDir: false,
        plugins: pacing ? [{
            name: 'mvp-qualification-bridge',
            transform(code, id) {
                if (!id.replaceAll('\\', '/').endsWith('/src/ui/mvp/main.ts')) return;
                return code + '\nimport { installPacingBridge } from "../../../research/export/mvp-pacing-bridge.mjs";\n'
                    + 'installPacingBridge(ui, engine);\n';
            },
        }] : [],
        build: { outDir: fixture, emptyOutDir: false, assetsDir: 'qual-assets',
            rollupOptions: { input: ['research/export/mvp-export-qualification.html', ...(pacing ? ['mvp/index.html'] : [])] } },
    });
    const port = pacing ? 5214 : profiling ? 5213 : 5211, origin = `http://127.0.0.1:${port}`;
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm',
        '.json': 'application/json', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };
    const server = createServer(async (req, res) => {
        let temp;
        try {
            const url = new URL(req.url, origin);
            if (req.method === 'POST' && req.headers.origin === origin && url.pathname.startsWith('/qualification/output/')) {
                const name = url.pathname.slice('/qualification/output/'.length);
                if (!allowed.test(name) || Number(req.headers['content-length']) > maxBytes) { res.writeHead(400).end(); return; }
                temp = path.join(output, '.incoming-' + randomUUID());
                let bytes = 0;
                await pipeline(req, new Transform({
                    transform(chunk, _, done) {
                        bytes += chunk.length;
                        if (bytes > maxBytes) done(new Error('Fixture output exceeded the local cap.'));
                        else done(null, chunk);
                    },
                }), createWriteStream(temp, { flags: 'wx' }));
                if (!bytes) throw Error('Empty fixture output');
                await rename(temp, path.join(output, name)); temp = undefined;
                res.writeHead(201).end(); return;
            }
            if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
            let file;
            if (url.pathname === '/qualification/reference.wav' && source) file = path.join(output, 'reference.wav');
            else {
                if (!url.pathname.startsWith('/plexus-engine/')) { res.writeHead(404).end(); return; }
                const relative = decodeURIComponent(url.pathname.slice('/plexus-engine/'.length));
                const isPacingMvp = pacing && (relative === 'mvp/' || relative === 'mvp/index.html');
                const root = url.pathname === fixtureRoute || relative.startsWith('qual-assets/') || isPacingMvp ? fixture : production;
                file = path.resolve(root, relative.endsWith('/') || !relative ? relative + 'index.html' : relative);
                if (!file.startsWith(root + path.sep)) { res.writeHead(404).end(); return; }
            }
            const info = await stat(file);
            if (!info.isFile()) { res.writeHead(404).end(); return; }
            res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
                'Content-Length': info.size, 'Cache-Control': url.pathname === '/qualification/reference.wav' ? 'no-store' : 'no-cache' });
            if (req.method === 'HEAD') res.end();
            else createReadStream(file).on('error', () => res.destroy()).pipe(res);
        } catch {
            if (temp) await rm(temp, { force: true });
            if (!res.headersSent) res.writeHead(404).end();
            else res.destroy();
        }
    });
    await writeFile(activeRun, output + '\n');
    server.listen(port, '127.0.0.1', () => console.log(origin + fixtureRoute + (pacing ? '?pacing' : '')));
}

async function decodedSamples(file) {
    const proc = spawn('ffmpeg', ['-v', 'error', '-xerror', '-nostdin', '-i', file, '-map', '0:a:0', '-c:a', 'pcm_s16le', '-f', 's16le', '-'],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let bytes = 0, errorText = '';
    proc.stdout.on('data', data => { bytes += data.length; });
    proc.stderr.on('data', data => { errorText = (errorText + data).slice(-4000); });
    await new Promise((resolve, reject) => {
        proc.on('error', reject);
        proc.on('close', code => code === 0 ? resolve() : reject(Error(errorText)));
    });
    return bytes / 4;
}
function nativeAudioWindow(file, second, seconds = 1) {
    return execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-nostdin', '-i', file, '-ss', String(second), '-t', String(seconds),
        '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', '-f', 's16le', '-'],
    { windowsHide: true, timeout: 30_000 });
}
function compareRealAudio(reference, exportFile, times = [3, 30, 56], seconds = 1) {
    return times.map(second => {
        const a = nativeAudioWindow(reference, second, seconds), b = nativeAudioWindow(exportFile, second, seconds);
        assert.equal(a.length, seconds * 96000);
        assert.equal(b.length, a.length);
        let aa = 0, bb = 0, ab = 0;
        for (let offset = 0; offset < a.length; offset += 2) {
            const x = a.readInt16LE(offset), y = b.readInt16LE(offset);
            aa += x * x; bb += y * y; ab += x * y;
        }
        const correlation = ab / Math.sqrt(aa * bb);
        assert.ok(correlation > .9, `Native audio at ${second}s differs from the reference: ${correlation}`);
        return { second, correlation: Number(correlation.toFixed(4)) };
    });
}

async function verifyPacing() {
    const root = (await readFile(activeRun, 'utf8')).trim();
    assert.ok(root.startsWith(logs + path.sep) && path.basename(root).startsWith('run-'));
    const report = await readJson(path.join(root, 'pacing.json'));
    assert.equal(report.pass, true);
    assert.equal(report.rows.length, 14);
    assert.equal(report.fps, 60);
    const native = [];
    for (const row of report.rows.filter(row => row.artifact)) {
        assert.match(row.artifact, allowed);
        const file = path.join(root, row.artifact);
        const video = JSON.parse(tool('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_frames',
            '-show_entries', 'stream=codec_name,width,height:frame=best_effort_timestamp_time', '-of', 'json', file]));
        const audio = JSON.parse(tool('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
            '-show_entries', 'stream=codec_name,channels,sample_rate', '-of', 'json', file])).streams[0];
        const [width, height] = row.resolution === '4K' ? [3840, 2160] : [1280, 720];
        assert.deepEqual(video.streams[0], { codec_name: 'h264', width, height });
        assert.deepEqual(audio, { codec_name: 'aac', sample_rate: '48000', channels: 2 });
        assert.equal(video.frames.length, row.frames);
        assert.ok(video.frames.every((frame, index) => Math.abs(Number(frame.best_effort_timestamp_time) - index / 60) < .00001));
        const samples = await decodedSamples(file);
        assert.ok(Math.abs(samples - row.frames * 800) <= 2048, `${row.artifact}: AAC endpoint`);
        const audioWindows = compareRealAudio(path.join(root, 'reference.wav'), file, row.command ? [.25] : [.25, 2.75], .5);
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(file)) hash.update(chunk);
        native.push({ artifact: row.artifact, frames: row.frames, samples, audioWindows, sha256: hash.digest('hex') });
    }
    const hashes = new Map(native.map(row => [row.artifact, row.sha256]));
    function compareVideo(left, right) {
        if (hashes.get(left) === hashes.get(right)) return { exactFile: true, ssim: 1 };
        const result = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-filter_complex_threads', '1',
            '-i', path.join(root, left), '-i', path.join(root, right),
            '-filter_complex', '[0:v]scale=320:180[a];[1:v]scale=320:180[b];[a][b]ssim',
            '-an', '-f', 'null', '-'], { windowsHide: true, encoding: 'utf8', timeout: 180_000, stdio: ['ignore', 'ignore', 'pipe'] });
        if (result.error || result.status !== 0) throw result.error ?? Error(result.stderr);
        const score = Number(result.stderr.match(/SSIM .*?All:([\d.]+)/)?.[1]);
        assert.ok(score > 0 && score <= 1, 'Missing frame similarity score');
        return { exactFile: false, ssim: score };
    }
    const visual = ['720p', '4k'].map(resolution => ({
        resolution,
        displayRepeat: [2, 3].map(run => compareVideo(`pacing-${resolution}-display-1.mp4`, `pacing-${resolution}-display-${run}.mp4`)),
        matched: [1, 2, 3].map(run => compareVideo(`pacing-${resolution}-display-${run}.mp4`, `pacing-${resolution}-cooperative-${run}.mp4`)),
    }));
    const referenceSha256 = createHash('sha256').update(await readFile(path.join(root, 'reference.wav'))).digest('hex');
    await writeFile(path.join(root, 'pacing-verification.json'), JSON.stringify({ ...report, referenceSha256, native, visual }, null, 2) + '\n');
    console.log(JSON.stringify({ files: native.length, visual }));
}
async function verify() {
    const root = (await readFile(activeRun, 'utf8')).trim();
    assert.ok(root.startsWith(logs + path.sep) && path.basename(root).startsWith('run-'));
    const benchmark = await readJson(path.join(root, 'benchmark.json'));
    assert.equal(benchmark.pass, true);
    const native = [];
    const real = path.join(root, 'real-track.mp4');
    const expected = benchmark.rows.filter(r => r.artifact).map(r => [r.artifact, r.frames, r.width, r.height]);
    if (await stat(real).then(() => true, e => e.code !== 'ENOENT' ? Promise.reject(e) : false)) expected.push(['real-track.mp4', 3600, 1280, 720]);
    for (const [name, frames, width, height] of expected) {
        assert.match(name, allowed);
        const file = path.join(root, name);
        const info = JSON.parse(tool('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames',
            '-show_entries', 'stream=codec_name,width,height,nb_read_frames,avg_frame_rate', '-of', 'json', file])).streams[0];
        const audio = JSON.parse(tool('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
            '-show_entries', 'stream=codec_name,channels,sample_rate', '-of', 'json', file])).streams[0];
        assert.equal(Number(info.nb_read_frames), frames, name);
        assert.deepEqual([info.width, info.height], [width, height], name);
        if (name.endsWith('.mp4')) assert.deepEqual([info.codec_name, audio.codec_name], ['h264', 'aac']);
        else { assert.match(info.codec_name, /^vp[89]$/); assert.equal(audio.codec_name, 'opus'); }
        assert.equal(audio.channels, 2);
        assert.equal(Number(audio.sample_rate), 48000);
        const samples = await decodedSamples(file);
        assert.ok(Math.abs(samples - frames * 800) <= 2048, `${name}: decoded native AAC/Opus endpoint`);
        const sought = tool('ffmpeg', ['-v', 'error', '-xerror', '-nostdin', '-ss', String(frames / 60 - .4), '-i', file,
            '-map', '0:v:0', '-frames:v', '1', '-f', 'framemd5', '-']);
        assert.match(sought, /^0,.*[a-f\d]{32}\s*$/m, `${name}: native seek near the end`);
        const audioWindows = name === 'real-track.mp4' ? compareRealAudio(path.join(root, 'reference.wav'), file) : undefined;
        const bytes = await stat(file);
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(file)) hash.update(chunk);
        native.push({ name, frames, width, height, codecs: [info.codec_name, audio.codec_name], samples,
            seekNearEnd: true, audioWindows, bytes: bytes.size, sha256: hash.digest('hex') });
    }
    const version = tool('ffmpeg', ['-version']).split(/\r?\n/)[0];
    const result = { ...benchmark, native, version };
    await writeFile(path.join(root, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ native, version }));
}

if (mode === 'serve') await serve(source);
else if (mode === 'profile') await serve();
else if (mode === 'pacing') await serve(source);
else if (mode === 'verify') await verify();
else if (mode === 'verify-pacing') await verifyPacing();
else throw Error('Use: node research/export/mvp-export-qualification.mjs serve [reference MP3] | profile | verify | pacing <reference MP3> | verify-pacing');
