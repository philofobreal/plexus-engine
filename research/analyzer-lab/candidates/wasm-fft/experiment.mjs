// Offline T17 experiment. Never imported by the product.
import fs from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { Session } from 'node:inspector';
import ts from 'typescript';
import { makeWasmFFT } from './adapter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const root = resolve(here, '../../../..');
const cache = join(root, 'research/analyzer-lab/.cache');
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const wasmBytes = () => fs.readFileSync(join(here, 'fft.scalar.wasm'));
const exclusiveJSON = (path, value) => {
    fs.mkdirSync(dirname(path), { recursive: true });
    fs.writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
};

// Native ESM in a single V8 realm. Do not use the VM fixture loader for timings.
export function prepareTree(mode = 'reference', entry = 'src/analyzer/analyzeAudio.ts') {
    if (!['reference', 'resident', 'copy'].includes(mode)) throw Error('Invalid mode');
    fs.mkdirSync(cache, { recursive: true });
    const out = fs.mkdtempSync(join(cache, 't17-esm-'));
    const hashes = {};
    const seen = new Set();
    const compile = file => {
        if (seen.has(file)) return;
        seen.add(file);
        const source = fs.readFileSync(join(root, file), 'utf8');
        hashes[file] = sha(fs.readFileSync(join(root, file)));
        let code = ts.transpileModule(source, { compilerOptions: {
            target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
        }}).outputText;
        code = code.replace(/((?:from\s*|import\s*)['"])(\.{1,2}\/[^'"]+)(['"])/g, (_, a, spec, b) => {
            const base = resolve(root, dirname(file), spec);
            const dependency = [base + '.ts', join(base, 'index.ts')].find(fs.existsSync);
            if (!dependency) throw Error('Unresolved native ESM import: ' + spec + ' in ' + file);
            const dep = relative(root, dependency).replaceAll('\\', '/');
            compile(dep);
            let target = relative(dirname(file), dep).replaceAll('\\', '/').replace(/\.ts$/, '.js');
            if (!target.startsWith('.')) target = './' + target;
            return a + target + b;
        });
        const target = join(out, file.replace(/\.ts$/, '.js'));
        fs.mkdirSync(dirname(target), { recursive: true });
        if (mode !== 'reference' && file === 'src/analyzer/math/FFT.ts') {
            fs.writeFileSync(target.replace('FFT.js', 'FFT-reference.js'), code);
            fs.writeFileSync(join(out, 'adapter.mjs'), fs.readFileSync(join(here, 'adapter.mjs')));
            code = `import {FFT as ReferenceFFT, createHannWindow} from './FFT-reference.js';
import {makeWasmFFT} from '../../../adapter.mjs';
const module = new WebAssembly.Module(new Uint8Array(${JSON.stringify([...wasmBytes()])}));
export const FFT = makeWasmFFT(ReferenceFFT, module, ${JSON.stringify(mode)});
export {createHannWindow};\n`;
        }
        fs.writeFileSync(target, code);
    };
    compile(entry);
    return { out, hashes, url: pathToFileURL(join(out, entry.replace(/\.ts$/, '.js'))).href };
}

function provenance() {
    return { sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch,
        typescript: ts.version, prototype: Object.fromEntries(['README.md', 'fft.scalar.wat', 'fft.scalar.wasm', 'adapter.mjs', 'experiment.mjs', 'browser.mjs']
            .map(p => [p, sha(fs.readFileSync(join(here, p)))])) };
}

async function kernel() {
    const tree = prepareTree('reference', 'src/analyzer/math/FFT.ts');
    const { FFT } = await import(tree.url);
    const bytes = wasmBytes(), cold = [];
    for (let i = 0; i < 20; i++) {
        const t = performance.now();
        const module = new WebAssembly.Module(bytes);
        new (makeWasmFFT(FFT, module))(1024);
        cold.push(performance.now() - t);
    }
    const module = new WebAssembly.Module(bytes), timings = {};
    for (const size of [1024, 4096, 16384]) {
        timings[size] = {};
        const input = Float32Array.from({ length: size }, (_, i) => Math.sin(i * .37) * .4 + Math.cos(i * .017) * .1);
        let expected;
        for (const [name, Constructor] of [['reference', FFT], ['resident', makeWasmFFT(FFT, module)], ['copy', makeWasmFFT(FFT, module, 'copy')]]) {
            const fft = new Constructor(size), runs = [];
            for (let trial = -1; trial < 5; trial++) {
                const t = performance.now();
                for (let n = 0; n < 200; n++) { fft.setWindowedSamples(input, 0); fft.transform(); }
                const elapsed = performance.now() - t;
                if (trial >= 0) runs.push(elapsed / 200);
            }
            const hash = sha(Buffer.concat([Buffer.from(fft.re.buffer, fft.re.byteOffset, fft.re.byteLength), Buffer.from(fft.im.buffer, fft.im.byteOffset, fft.im.byteLength)]));
            if (expected && expected !== hash) throw Error('Kernel parity failed');
            expected = hash;
            timings[size][name] = { medianMs: median(runs), runsMs: runs, outputSha256: hash,
                privateWasmBytes: name === 'reference' ? 0 : fft.memory.buffer.byteLength };
        }
    }
    return { ...provenance(), bytes: bytes.length, gzipBytes: gzipSync(bytes).length,
        coldCompileInstantiate1024Ms: cold, coldMedianMs: median(cold), timings, sourceHashes: tree.hashes };
}

async function measureChild(treeURL, pcmPath, profilePath) {
    const raw = fs.readFileSync(pcmPath);
    const samples = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
    const t = performance.now();
    const { analyzeAudio } = await import(treeURL);
    const importMs = performance.now() - t;
    const input = { samples, sampleRate: 44100, options: { rhythmOnsets: true } };
    analyzeAudio(input); // warm up full path in this isolated process
    global.gc?.();
    const memoryBefore = process.memoryUsage();
    let session;
    const post = (name, params = {}) => new Promise((yes, no) => session.post(name, params, (e, r) => e ? no(e) : yes(r)));
    if (profilePath) {
        session = new Session(); session.connect();
        await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 1000 }); await post('Profiler.start');
    }
    const start = performance.now();
    const result = analyzeAudio(input);
    const elapsedMs = performance.now() - start;
    const memoryAfter = process.memoryUsage(), maxRSSKiB = process.resourceUsage().maxRSS;
    if (session) {
        const { profile } = await post('Profiler.stop');
        exclusiveJSON(profilePath, profile); session.disconnect();
    }
    return { elapsedMs, importMs, resultSha256: sha(JSON.stringify(result)), pcmUnchanged: sha(Buffer.from(samples.buffer)) === sha(raw),
        memoryBefore, memoryAfter, maxRSSKiB };
}

async function recording(audio, output) {
    if (fs.existsSync(output)) throw Error('Exclusive new output required');
    const startProvenance = provenance();
    const trees = Object.fromEntries(['reference', 'resident'].map(mode => [mode, prepareTree(mode)]));
    const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', audio, '-af', 'pan=mono|c0=c0', '-ar', '44100', '-f', 'f32le', 'pipe:1'],
        { maxBuffer: 256 * 1024 ** 2, windowsHide: true });
    const pcmPath = join(trees.reference.out, 'input.f32le'); fs.writeFileSync(pcmPath, pcm);
    const runs = [], sourceHashes = trees.reference.hashes;
    for (let trial = 0; trial < 3; trial++) {
        for (const mode of trial % 2 ? ['resident', 'reference'] : ['reference', 'resident']) {
            const args = ['--expose-gc', fileURLToPath(import.meta.url), 'child', trees[mode].url, pcmPath];
            const value = JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 1024 ** 2, windowsHide: true }));
            runs.push({ trial, mode, ...value });
            console.error(JSON.stringify({ trial, mode, elapsedMs: value.elapsedMs }));
        }
    }
    const profilePath = output + '.cpuprofile.json';
    execFileSync(process.execPath, ['--expose-gc', fileURLToPath(import.meta.url), 'child', trees.reference.url, pcmPath, profilePath],
        { windowsHide: true, maxBuffer: 1024 ** 2 });
    for (const [path, hash] of Object.entries(sourceHashes)) if (sha(fs.readFileSync(join(root, path))) !== hash) throw Error('Source changed during measurement');
    for (const [path, hash] of Object.entries(startProvenance.prototype)) if (sha(fs.readFileSync(join(here, path))) !== hash) throw Error('Prototype changed during measurement');
    const referenceMs = median(runs.filter(r => r.mode === 'reference').map(r => r.elapsedMs));
    const residentMs = median(runs.filter(r => r.mode === 'resident').map(r => r.elapsedMs));
    const maxRSS = mode => Math.max(...runs.filter(r => r.mode === mode).map(r => r.maxRSSKiB));
    const parity = runs.every(r => r.pcmUnchanged && r.resultSha256 === runs[0].resultSha256);
    const profile = JSON.parse(fs.readFileSync(profilePath));
    const counts = new Map(), nodes = new Map(profile.nodes.map(n => [n.id, n]));
    for (const id of profile.samples ?? []) {
        const f = nodes.get(id)?.callFrame;
        const key = (f?.url?.split('/src/')[1] ?? f?.url ?? '') + ':' + f?.functionName;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const receipt = { ...startProvenance, protocol: 'T17 scalar exact FFT / XR full path / three alternating paired trials / fresh processes',
        audioFile: audio, audioSha256: sha(fs.readFileSync(audio)), pcmSha256: sha(pcm), durationSec: pcm.length / 4 / 44100,
        sampleRate: 44100, sourceHashes, runs, referenceMedianMs: referenceMs, residentMedianMs: residentMs,
        improvement: 1 - residentMs / referenceMs, maxRSSRatio: maxRSS('resident') / maxRSS('reference'), parity,
        cpuSampleCount: profile.samples?.length, cpuTop: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 35),
        quest3: 'not measured; no physical device available', rawProfilePath: profilePath };
    exclusiveJSON(output, receipt);
    console.log(JSON.stringify({ referenceMs, residentMs, improvement: receipt.improvement, parity, maxRSSRatio: receipt.maxRSSRatio }));
}

async function main() {
    const [command, ...args] = process.argv.slice(2);
    if (command === 'build') {
        const compilerPackage = JSON.parse(fs.readFileSync(join(cache, 't17-toolchain/node_modules/wabt/package.json')));
        if (compilerPackage.version !== '1.0.39') throw Error('Pinned WABT 1.0.39 required');
        const { default: init } = await import(pathToFileURL(join(cache, 't17-toolchain/node_modules/wabt/index.js')).href);
        const wabt = await init();
        const module = wabt.parseWat('fft.scalar.wat', fs.readFileSync(join(here, 'fft.scalar.wat'), 'utf8'), { simd: false, threads: false });
        try { module.resolveNames(); module.validate(); fs.writeFileSync(join(here, 'fft.scalar.wasm'), module.toBinary({ canonicalize_lebs: true }).buffer); }
        finally { module.destroy(); }
    } else if (command === 'browser' && args.length === 2) {
        const output = resolve(args[1]);
        if (fs.existsSync(output)) throw Error('Exclusive new browser page required');
        const trees = Object.fromEntries(['reference', 'resident'].map(mode => [mode, prepareTree(mode)]));
        const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', resolve(args[0]), '-af', 'pan=mono|c0=c0', '-ar', '44100', '-f', 'f32le', 'pipe:1'],
            { maxBuffer: 256 * 1024 ** 2, windowsHide: true });
        const url = path => '/plexus-engine/' + relative(root, path).replaceAll('\\', '/');
        const pcmPath = join(trees.reference.out, 'input.f32le'); fs.writeFileSync(pcmPath, pcm);
        const config = { trees: Object.fromEntries(Object.entries(trees).map(([mode, tree]) => [mode, url(fileURLToPath(tree.url))])), pcmURL: url(pcmPath) };
        fs.mkdirSync(dirname(output), { recursive: true });
        fs.writeFileSync(output, `<!doctype html><meta charset="utf-8"><title>T17 WASM feasibility</title>
<h1>T17 desktop browser benchmark</h1><p>Research only; no player settings change.</p><button>Run full recording</button><p id="status">Ready</p><pre id="result"></pre>
<script type="module">import {runBrowserExperiment} from '${url(join(here, 'browser.mjs'))}';
document.querySelector('button').onclick=async()=>{document.querySelector('button').disabled=true;try{
const result=await runBrowserExperiment(${JSON.stringify(config)},s=>document.querySelector('#status').textContent=s);
document.querySelector('#result').textContent=JSON.stringify(result,null,2);document.querySelector('#status').textContent='Complete';
}catch(e){document.querySelector('#status').textContent='Failed: '+e.message;}};</script>`, { flag: 'wx' });
        exclusiveJSON(output + '.sources.json', { ...provenance(), sourceHashes: trees.reference.hashes, pcmSha256: sha(pcm), config,
            browserRunnerSha256: sha(fs.readFileSync(join(here, 'browser.mjs'))) });
    } else if (command === 'kernel' && args.length === 1) exclusiveJSON(resolve(args[0]), await kernel());
    else if (command === 'recording' && args.length === 2) await recording(resolve(args[0]), resolve(args[1]));
    else if (command === 'child' && [2, 3].includes(args.length)) console.log(JSON.stringify(await measureChild(...args)));
    else throw Error('Expected build | kernel NEW_JSON | recording AUDIO NEW_JSON | child TREE_URL PCM [PROFILE]');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
