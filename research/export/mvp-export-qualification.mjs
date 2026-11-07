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
const parallel = mode === 'parallel' || mode === 'verify-parallel';
const pacing = mode === 'pacing' || mode === 'verify-pacing';
const raster = mode === 'raster' || mode === 'verify-raster';
const renderProfiling = mode === 'render' || mode === 'verify-render' || raster;
const exactWorker = mode === 'worker' || mode === 'verify-worker';
const precision = mode === 'integrity-precision' || mode === 'verify-integrity-precision';
const integrity = mode === 'integrity' || mode === 'verify-integrity' || precision;
const productionMotion = mode === 'motion-production';
const motion = mode === 'motion' || productionMotion;
const realMvp = pacing || renderProfiling || exactWorker || motion || parallel;
const logs = path.resolve(parallel ? 'logs/t20c1-parallel-material' : raster ? 'logs/t20b5-raster' : productionMotion ? 'logs/mp4-motion/production' : motion ? 'logs/mp4-motion' : precision ? 'logs/mp4-precision-integrity' : integrity ? 'logs/t20b5-integrity' : exactWorker ? 'logs/t20b4' : renderProfiling ? 'logs/t20b3' : pacing ? 'logs/t20b2' : profiling ? 'logs/t20b1' : 'logs/t20a3a');
const production = path.resolve('dist');
const allowed = /^(?:benchmark\.json|mp4-profile\.json|(?:long|4k)\.(?:mp4|webm)|real-track\.mp4|pacing\.json|pacing-(?:(?:720p|4k)-(?:display|cooperative)-[1-3]|stop)\.mp4|render\.json|render-(?:720p|4k)-(?:control|[1-3])\.mp4|worker\.json|worker-(?:(?:720p|4k)-(?:display|exact)-[1-3]|stop)\.mp4|integrity\.json|integrity-(?:720p|1080p|4k)\.mp4|motion\.(?:json|gray|webm)|motion-(?:current|cbr|gop|production)\.mp4)$/;
const fixtureRoute = '/plexus-engine/research/export/mvp-export-qualification.html';
const rasterArtifact = /^(?:raster\.json|raster-(?:720p|4k)-(?:control|candidate)-[1-3]\.mp4)$/;
const parallelArtifact = /^(?:parallel\.json|parallel-(?:(?:720p|4k)-(?:control|candidate)-[1-3]|stop)\.mp4)$/;
const maxBytes = 128 * 1024 * 1024;
const tool = (name, args) => execFileSync(name, args, { windowsHide: true, encoding: 'utf8', timeout: 180_000 });
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const activeRun = path.join(logs, 'active-run.txt');

function markRenderer(code) {
    code = code.replaceAll('\r\n', '\n');
    const boundaries = {
        identity: '            workerUsed = false;',
        postFx: '            postFxPipeline.render(p as unknown as PostFxSurfaceHost, ct);',
        tail: '            if (!workerUsed && workerRaster) { workerRaster.dispose(); workerRaster = null; }',
    };
    for (const [name, line] of Object.entries(boundaries)) {
        const anchor = '\n' + line + '\n';
        const start = code.indexOf(anchor);
        assert.ok(start >= 0 && start === code.lastIndexOf(anchor), `Renderer profile boundary changed: ${name}`);
        code = code.replace(anchor, `\n            window.plexusRenderProbe?.('${name}');\n${line}\n`);
    }
    return code;
}

// Research build only. The pixel calculations and write order stay intact.
function experimentRaster(code) {
    const replace = (before, after) => {
        assert.equal(code.split(before).length, 2, 'Raster comparison boundary changed');
        code = code.replace(before, after);
    };
    replace('const depositScratch =', `const tighterSupport = new URLSearchParams(location.search).has('rasterCandidate');
const depositScratch =`);
    replace('    const minX = Math.max(0, Math.floor(Math.min(tailX, headX) - radius));', `    let scanRadius = radius;
    if (tighterSupport) {
        // Beyond the core, the halo alone must clear the shape gate.
        // Keep the full core and a conservative margin around the halo cutoff.
        const haloCutoff = (1 - 0.99 * Math.cbrt(negligible / haloGain)) / invRadiusSq;
        scanRadius = Math.sqrt(Math.min(radiusSq, Math.max(coreRadius * coreRadius, haloCutoff)));
    }
    const minX = Math.max(0, Math.floor(Math.min(tailX, headX) - scanRadius));`);
    for (const bound of ['Math.ceil(Math.max(tailX, headX) + radius)', 'Math.floor(Math.min(tailY, headY) - radius)',
        'Math.ceil(Math.max(tailY, headY) + radius)', 'radius / Math.abs(normalX) : 0']) {
        replace(bound, bound.replace('radius', 'scanRadius'));
    }
    return code;
}

function wireExactRaster(code) {
    code = code.replaceAll('\r\n', '\n');
    const draw = '        p.draw = () => {';
    const identity = '            workerUsed = false;\n            if (compositor) {';
    for (const anchor of [draw, identity]) {
        const start = code.indexOf(anchor);
        assert.ok(start >= 0 && start === code.lastIndexOf(anchor), 'Exact raster fixture boundary changed');
    }
    return code.replace(draw, '        p.draw = async () => {').replace(identity, `            workerUsed = false;
            if (State.isExporting && window.plexusExactRaster) {
                const identity = styleRegistry.get(State.visualMode);
                activeRaster = await window.plexusExactRaster.draw(State, backend, identity.depthCueStrength ?? 0,
                    options?.previewQuality?.musicDisplay, featureFlags.wormholeSkybox);
            } else if (compositor) {`);
}

function wireParallelMaterial(code) {
    code = code.replaceAll('\r\n', '\n');
    const draw = '        p.draw = () => {';
    const seam = '            workerUsed = false;\n            if (compositor) {';
    for (const anchor of [draw, seam]) assert.equal(code.split(anchor).length, 2, 'Parallel material boundary changed');
    return code.replace(draw, '        p.draw = async () => {').replace(seam, `            workerUsed = false;
            if (State.isExporting && window.plexusParallelMaterial) {
                await window.plexusParallelMaterial.draw(State, backend, styleRegistry.get(State.visualMode), () => {
                    if (compositor) identityTransitionController.draw(ct, backend, compositor, styleRegistry, particles, shockwaves, drawIdentity);
                    else drawIdentity(styleRegistry.get(State.visualMode), backend, particles, shockwaves, { timeSec: ct, advanceSharedSimulation: true });
                });
            } else if (compositor) {`);
}

function experimentEncoding(code, id) {
    if (!id.replaceAll('\\', '/').endsWith('/src/export/mp4-export.worker.ts')) return;
    const edit = (before, after) => {
        assert.equal(code.split(before).length, 2, 'Motion comparison encoder boundary changed');
        code = code.replace(before, after);
    };
    edit('const highPrecision = request.mp4VideoCodec', `const variant = (request as StartExportRequest & { motionVariant?: string }).motionVariant;
    const highPrecision = request.mp4VideoCodec`);
    edit('ultraHd: 40_000_000', "ultraHd: variant === 'current' ? 28_000_000 : 40_000_000");
    edit("codec: 'avc', bitrate, keyFrameInterval: 1,", "codec: 'avc', bitrate, keyFrameInterval: variant === 'gop' ? 2 : 1,");
    edit("...(ultraHd ? { bitrateMode: 'constant' } : {}),",
        "...(ultraHd && variant !== 'current' ? { bitrateMode: 'constant' } : {}),");
    return code;
}

async function serve(source) {
    if (realMvp && !source) throw Error('Supply the reference MP3 for the real MVP benchmark.');
    await mkdir(logs, { recursive: true });
    const fixture = path.join(logs, 'site'), output = path.join(logs, 'run-' + randomUUID());
    await mkdir(output, { recursive: true });
    await stat(path.join(production, 'mvp/index.html'));
    const clipSeconds = motion ? 14 : realMvp ? 4 : 60;
    if (source) {
        // One real excerpt exercises the actual MVP renderer. Never put it in public/ or dist/.
        const reference = path.join(output, 'reference.wav');
        tool('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-ss', motion ? '46' : '60', '-i', path.resolve(source),
            '-t', String(clipSeconds), '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', reference]);
        const samples = tool('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
            '-show_entries', 'stream=duration_ts', '-of', 'default=nw=1:nk=1', reference]);
        assert.equal(Number(samples.trim()), clipSeconds * 48000, 'The reference excerpt is incomplete.');
    }
    const built = await build({
        configFile: false, base: '/plexus-engine/', publicDir: false,
        ...(motion && !productionMotion ? { worker: { plugins: () => [{ name: 'mp4-motion-encoding', enforce: 'pre', transform: experimentEncoding }] } } : {}),
        plugins: realMvp ? [{
            name: 'mvp-qualification-bridge',
            enforce: 'pre',
            transform(code, id) {
                const module = id.replaceAll('\\', '/');
                if (raster && module.endsWith('/src/visuals/wormholeGrainMaterialRaster.ts')) return experimentRaster(code);
                if (renderProfiling && module.endsWith('/src/visuals/PlexusRenderer.ts')) return markRenderer(code);
                if (exactWorker && module.endsWith('/src/visuals/PlexusRenderer.ts')) return wireExactRaster(code);
                if (parallel && module.endsWith('/src/visuals/PlexusRenderer.ts')) return wireParallelMaterial(code);
                if (!module.endsWith('/src/ui/mvp/main.ts')) return;
                return code + '\nimport { installPacingBridge } from "../../../research/export/mvp-pacing-bridge.mjs";\n'
                    + `installPacingBridge(ui, engine, ${exactWorker}, ${parallel});\n`;
            },
        }] : [],
        build: { outDir: fixture, emptyOutDir: false, assetsDir: 'qual-assets',
            rollupOptions: { input: ['research/export/mvp-export-qualification.html', ...(realMvp ? ['mvp/index.html'] : [])] } },
    });
    if (parallel) {
        const bundles = (Array.isArray(built) ? built : [built]).flatMap(result => result.output);
        const manifest = {
            mode, baseCommit: tool('git', ['rev-parse', 'HEAD']).trim(),
            dirty: Boolean(tool('git', ['status', '--porcelain']).trim()),
            referenceSha256: createHash('sha256').update(await readFile(path.join(output, 'reference.wav'))).digest('hex'),
            bundles: await Promise.all(bundles.map(async entry => ({ path: entry.fileName,
                sha256: createHash('sha256').update(await readFile(path.join(fixture, entry.fileName))).digest('hex') }))),
        };
        await writeFile(path.join(output, 'build.json'), JSON.stringify(manifest, null, 2) + '\n');
    }
    const port = parallel ? 5237 : raster ? 5220 : productionMotion ? 5219 : motion ? 5218 : precision ? 5232 : integrity ? 5217 : exactWorker ? 5216 : renderProfiling ? 5215 : pacing ? 5214 : profiling ? 5213 : 5211;
    const origin = `http://127.0.0.1:${port}`;
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm',
        '.json': 'application/json', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };
    const server = createServer(async (req, res) => {
        let temp;
        try {
            const url = new URL(req.url, origin);
            if (req.method === 'POST' && req.headers.origin === origin && url.pathname.startsWith('/qualification/output/')) {
                const name = url.pathname.slice('/qualification/output/'.length);
                if (!(parallel ? parallelArtifact : raster ? rasterArtifact : allowed).test(name) || Number(req.headers['content-length']) > maxBytes) { res.writeHead(400).end(); return; }
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
                const isFixtureMvp = realMvp && (relative === 'mvp/' || relative === 'mvp/index.html');
                const root = url.pathname === fixtureRoute || relative.startsWith('qual-assets/') || isFixtureMvp ? fixture : production;
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
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', resolve);
    });
    await writeFile(activeRun, output + '\n');
    console.log(origin + fixtureRoute + (parallel ? '?parallel' : raster ? '?raster' : productionMotion ? '?motion&production' : motion ? '?motion' : precision ? '?integrity&precision' : integrity ? '?integrity' : exactWorker ? '?worker' : renderProfiling ? '?render' : pacing ? '?pacing' : ''));
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
    const receipt = parallel ? 'parallel' : raster ? 'raster' : exactWorker ? 'worker' : renderProfiling ? 'render' : 'pacing';
    const report = await readJson(path.join(root, receipt + '.json'));
    assert.equal(report.pass, true);
    assert.equal(report.rows.length, parallel ? 10 : renderProfiling ? 8 : 14);
    assert.equal(report.fps, 60);
    const native = [];
    for (const row of report.rows.filter(row => row.artifact)) {
        assert.match(row.artifact, parallel ? parallelArtifact : raster ? rasterArtifact : allowed);
        const file = path.join(root, row.artifact);
        const video = JSON.parse(tool('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_frames',
            '-show_entries', 'stream=codec_name,width,height:frame=best_effort_timestamp_time', '-of', 'json', file]));
        const audio = JSON.parse(tool('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
            '-show_entries', 'stream=codec_name,channels,sample_rate', '-of', 'json', file])).streams[0];
        const [width, height] = row.resolution === '4K' ? [3840, 2160] : [1280, 720];
        assert.deepEqual(video.streams[0], { codec_name: parallel ? 'vp9' : 'h264', width, height });
        if (parallel) {
            const format = tool('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt', '-of', 'csv=p=0', file]).trim();
            assert.equal(format, 'yuv420p10le');
        }
        assert.deepEqual(audio, { codec_name: 'aac', sample_rate: '48000', channels: 2 });
        assert.equal(video.frames.length, row.frames);
        assert.ok(video.frames.every((frame, index) => Math.abs(Number(frame.best_effort_timestamp_time) - index / 60) < .00001));
        const samples = await decodedSamples(file);
        assert.ok(Math.abs(samples - row.frames * 800) <= 2048, `${row.artifact}: AAC endpoint`);
        const audioWindows = compareRealAudio(path.join(root, 'reference.wav'), file, row.command ? [.25] : [.25, 2.75], .5);
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(file)) hash.update(chunk);
        const videoHash = parallel ? tool('ffmpeg', ['-v', 'error', '-xerror', '-i', file,
            '-map', '0:v:0', '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).trim() : undefined;
        native.push({ artifact: row.artifact, frames: row.frames, samples, audioWindows, sha256: hash.digest('hex'), videoHash });
    }
    const hashes = new Map(native.map(row => [row.artifact, row.sha256]));
    const videoHashes = new Map(native.map(row => [row.artifact, row.videoHash]));
    function compareVideo(left, right) {
        assert.ok(hashes.has(left) && hashes.has(right), 'Missing matched export');
        if (parallel && videoHashes.get(left) === videoHashes.get(right))
            return { exactFile: hashes.get(left) === hashes.get(right), exactVideo: true, ssim: 1 };
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
    const visual = ['720p', '4k'].map(resolution => parallel ? {
        resolution,
        matched: (resolution === '4k' ? [1, 2, 3] : [1]).map(run =>
            compareVideo(`parallel-${resolution}-control-${run}.mp4`, `parallel-${resolution}-candidate-${run}.mp4`)),
    } : raster ? {
        resolution,
        matched: (resolution === '4k' ? [1, 2, 3] : [1]).map(run =>
            compareVideo(`raster-${resolution}-control-${run}.mp4`, `raster-${resolution}-candidate-${run}.mp4`)),
    } : renderProfiling ? {
        resolution,
        matched: [1, 2, 3].map(run => compareVideo(`render-${resolution}-control.mp4`, `render-${resolution}-${run}.mp4`)),
    } : exactWorker ? {
        resolution,
        displayRepeat: [2, 3].map(run => compareVideo(`worker-${resolution}-display-1.mp4`, `worker-${resolution}-display-${run}.mp4`)),
        matched: [1, 2, 3].map(run => compareVideo(`worker-${resolution}-display-${run}.mp4`, `worker-${resolution}-exact-${run}.mp4`)),
    } : {
        resolution,
        displayRepeat: [2, 3].map(run => compareVideo(`pacing-${resolution}-display-1.mp4`, `pacing-${resolution}-display-${run}.mp4`)),
        matched: [1, 2, 3].map(run => compareVideo(`pacing-${resolution}-display-${run}.mp4`, `pacing-${resolution}-cooperative-${run}.mp4`)),
    });
    const referenceSha256 = createHash('sha256').update(await readFile(path.join(root, 'reference.wav'))).digest('hex');
    if (renderProfiling) assert.ok(visual.every(row => row.matched.every(pair => pair.exactFile)), 'Profiling changed the exported MP4');
    const qualification = parallel ? visual.map(({ resolution, matched }) => {
        const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
        const runs = variant => report.rows.filter(row => row.artifact?.startsWith(`parallel-${resolution}-${variant}-`));
        const controlMs = median(runs('control').map(row => row.elapsed));
        const candidates = runs('candidate');
        const candidateMs = median(candidates.map(row => row.elapsed));
        assert.ok(matched.every(pair => pair.exactVideo), 'Parallel material changed encoded frame content');
        const gain = 1 - candidateMs / controlMs;
        return { resolution, pairs: matched.length, controlMs, candidateMs, gain,
            tileRoundTripMs: median(candidates.map(row => row.parallelFrames.reduce((sum, f) => sum + f.roundTripMs, 0))),
            resolveAndPresentMs: median(candidates.map(row => row.parallelFrames.reduce((sum, f) => sum + f.resolveAndPresentMs, 0))),
            maxFrameTransferBytes: Math.max(...candidates.flatMap(row => row.parallelFrames.map(f => f.transferredBytes))),
            passesSpeedGate: resolution === '4k' && gain >= .15,
            guardWithinFivePercent: resolution === '720p' ? gain >= -.05 : undefined };
    }) : raster ? visual.map(({ resolution, matched }) => {
        const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
        const stats = variant => {
            const rows = report.rows.filter(row => row.artifact.startsWith(`raster-${resolution}-${variant}-`));
            assert.equal(rows.length, matched.length);
            return {
                jobMs: median(rows.map(row => row.elapsed)),
                carrierMs: median(rows.map(row => row.renderFrames.reduce((sum, frame) =>
                    sum + frame.wormholeMs.grains + frame.wormholeMs.weave, 0))),
            };
        };
        const control = stats('control'), candidate = stats('candidate');
        const gain = 1 - candidate.jobMs / control.jobMs;
        return { resolution, pairs: matched.length, control, candidate, gain,
            passesSpeedGate: resolution === '4k' && gain >= .15 };
    }) : exactWorker ? visual.map(({ resolution, matched }) => {
        const runs = variant => report.rows.filter(row => row.artifact?.startsWith(`worker-${resolution}-${variant}-`));
        const median = values => {
            assert.equal(values.length, 3);
            return values.sort((a, b) => a - b)[1];
        };
        const workerRuns = runs('exact');
        const displayMs = median(runs('display').map(row => row.elapsed));
        const workerMs = median(workerRuns.map(row => row.elapsed));
        const rasterMs = Object.fromEntries(['renderMs', 'roundTripMs', 'presentMs'].map(stage => [stage,
            median(workerRuns.map(row => row.workerFrames.reduce((sum, frame) => sum + frame[stage], 0)))]));
        const rasterKinds = [...new Set(workerRuns.flatMap(row => row.workerFrames.map(frame => frame.raster)))];
        const speedGain = 1 - workerMs / displayMs;
        const minSsim = Math.min(...matched.map(pair => pair.ssim));
        return { resolution, displayMs, workerMs, rasterKinds, rasterMs, speedGain, minSsim,
            speedGate: speedGain >= .15, similarityGate: minSsim >= .98 };
    }) : undefined;
    await writeFile(path.join(root, receipt + '-verification.json'),
        JSON.stringify({ ...report, referenceSha256, native, visual, qualification }, null, 2) + '\n');
    console.log(JSON.stringify({ files: native.length, visual, qualification }));
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

async function verifyIntegrity() {
    const root = (await readFile(activeRun, 'utf8')).trim();
    assert.ok(root.startsWith(logs + path.sep) && path.basename(root).startsWith('run-'));
    const report = await readJson(path.join(root, 'integrity.json'));
    assert.equal(report.pass, true);
    const expected = [
        ['integrity-720p.mp4', 1280, 720, 32, 120],
        ['integrity-1080p.mp4', 1920, 1080, 42, 120],
        ['integrity-4k.mp4', 3840, 2160, 52, 720],
    ];
    assert.deepEqual(report.rows.map(row => row.artifact), expected.map(row => row[0]));
    const native = [];
    for (const [name, width, height, minimumLevel, count] of expected) {
        const file = path.join(root, name);
        const { streams: [stream], packets } = JSON.parse(tool('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_name,width,height,level,pix_fmt:packet=pts_time,dts_time,flags', '-of', 'json', file]));
        assert.deepEqual([stream.codec_name, stream.width, stream.height], [precision ? 'vp9' : 'h264', width, height]);
        if (precision) assert.equal(stream.pix_fmt, 'yuv420p10le');
        else assert.ok(stream.level >= minimumLevel, `${name}: H.264 level ${stream.level}`);
        assert.equal(packets.length, count);
        const pts = packets.map(packet => Number(packet.pts_time)).sort((a, b) => a - b);
        assert.ok(pts.every((time, index) => Math.abs(time - index / 60) < .00001));
        assert.ok(packets.every((packet, index) => Number.isFinite(Number(packet.dts_time))
            && (index === 0 || Number(packet.dts_time) > Number(packets[index - 1].dts_time))));
        const keyframes = packets.filter(packet => packet.flags.startsWith('K')).map(packet => Number(packet.pts_time));
        assert.deepEqual(keyframes, Array.from({ length: count / 60 }, (_, index) => index));
        const codes = execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-nostdin', '-threads', '4', '-i', file,
            '-an', '-vf', 'crop=192:16:0:0,scale=12:1:flags=area,format=gray', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'],
        { windowsHide: true, timeout: 180_000 });
        assert.equal(codes.length, count * 12);
        for (let frame = 0; frame < count; frame++) {
            let decoded = 0;
            for (let bit = 0; bit < 12; bit++) if (codes[frame * 12 + bit] >= 128) decoded |= 1 << bit;
            assert.equal(decoded, frame, `${name}: decoded marker at frame ${frame}`);
        }
        native.push({ name, count, ...(precision ? { codec: stream.codec_name, pixelFormat: stream.pix_fmt } : { level: stream.level }), keyframes });
    }
    await writeFile(path.join(root, 'integrity-verification.json'), JSON.stringify({ ...report, native }, null, 2) + '\n');
    console.log(JSON.stringify(native));
}

if (mode === 'serve') await serve(source);
else if (mode === 'profile') await serve();
else if (mode === 'pacing') await serve(source);
else if (mode === 'render' || mode === 'raster') await serve(source);
else if (mode === 'worker') await serve(source);
else if (mode === 'parallel') await serve(source);
else if (mode === 'integrity' || mode === 'integrity-precision') await serve();
else if (motion) await serve(source);
else if (mode === 'verify') await verify();
else if (mode === 'verify-pacing' || mode === 'verify-render' || mode === 'verify-worker' || mode === 'verify-raster' || mode === 'verify-parallel') await verifyPacing();
else if (mode === 'verify-integrity' || mode === 'verify-integrity-precision') await verifyIntegrity();
else throw Error('Use: node research/export/mvp-export-qualification.mjs serve [reference MP3] | profile | verify | pacing <reference MP3> | verify-pacing | render <reference MP3> | verify-render | raster <reference MP3> | verify-raster | worker <reference MP3> | verify-worker | parallel <reference MP3> | verify-parallel | integrity | verify-integrity | integrity-precision | verify-integrity-precision | motion <reference MP3> | motion-production <reference MP3>');
