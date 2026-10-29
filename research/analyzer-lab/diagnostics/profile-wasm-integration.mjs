// T18 actual request-local production adapter, not T17's FFT class substitution.
// node .../profile-wasm-integration.mjs AUDIO_MP3 NEW_OUTPUT_JSON
import fs from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { prepareTree, sha, median, root } from '../candidates/wasm-fft/experiment.mjs';

const self = fileURLToPath(import.meta.url), binaryPath = resolve(root, 'src/analyzer/math/fft.scalar.wasm');
const read = p => fs.readFileSync(p);
async function child(url, pcmPath, mode) {
    const raw = read(pcmPath), samples = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
    const { runAnalysisWithBackend } = await import(url);
    const { createWasmFftKernelFactory } = await import(url.replace('/audio/AnalyzerBackendRunner.js', '/analyzer/math/WasmFftKernel.js'));
    const binary = read(binaryPath);
    const loader = async () => createWasmFftKernelFactory(new WebAssembly.Module(binary));
    const input = { samples, sampleRate: 44100, options: { rhythmOnsets: true } };
    await runAnalysisWithBackend(input, mode, loader);
    global.gc?.();
    const before = process.memoryUsage(), start = performance.now();
    const { result, backend } = await runAnalysisWithBackend(input, mode, loader);
    const elapsedMs = performance.now() - start;
    return { mode, elapsedMs, backend, outputSha256: sha(JSON.stringify(result)), pcmUnchanged: sha(Buffer.from(samples.buffer)) === sha(raw),
        before, after: process.memoryUsage(), maxRSSKiB: process.resourceUsage().maxRSS };
}
async function main() {
    if (process.argv[2] === '--child') { console.log(JSON.stringify(await child(...process.argv.slice(3)))); return; }
    if (process.argv.length !== 4) throw Error('Expected AUDIO_MP3 NEW_OUTPUT_JSON');
    const audio = resolve(process.argv[2]), output = resolve(process.argv[3]);
    if (fs.existsSync(output)) throw Error('Exclusive new output required');
    const toolHash = sha(read(self)), binaryHash = sha(read(binaryPath));
    const tree = prepareTree('reference', 'src/audio/AnalyzerBackendRunner.ts');
    const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', audio, '-af', 'pan=mono|c0=c0', '-ar', '44100', '-f', 'f32le', 'pipe:1'],
        { maxBuffer: 256 * 1024 ** 2, windowsHide: true });
    const pcmPath = resolve(tree.out, 'input.f32le'); fs.writeFileSync(pcmPath, pcm);
    const runs = [];
    for (let trial = 0; trial < 3; trial++) for (const mode of trial % 2 ? ['wasm', 'typescript'] : ['typescript', 'wasm']) {
        const r = JSON.parse(execFileSync(process.execPath, ['--expose-gc', self, '--child', tree.url, pcmPath, mode],
            { encoding: 'utf8', windowsHide: true, maxBuffer: 1024 ** 2 }));
        runs.push({ trial, ...r }); console.error(JSON.stringify({ trial, mode, ms: r.elapsedMs }));
    }
    for (const [p, h] of Object.entries(tree.hashes)) if (sha(read(resolve(root, p))) !== h) throw Error('Source changed: ' + p);
    if (sha(read(self)) !== toolHash || sha(read(binaryPath)) !== binaryHash) throw Error('Tool/kernel changed during measurement');
    const byMode = mode => runs.filter(r => r.mode === mode);
    const tsMedianMs = median(byMode('typescript').map(r => r.elapsedMs)), wasmMedianMs = median(byMode('wasm').map(r => r.elapsedMs));
    const parity = runs.every(r => r.pcmUnchanged && r.outputSha256 === runs[0].outputSha256 && r.backend.used === r.mode);
    if (!parity) throw Error('Production backend parity or selection failed');
    const receipt = { protocol: 'T18 production Runner + explicit factory; three alternating pairs/fresh processes; one warmup; XR onsets true; complete recording',
        node: process.version, v8: process.versions.v8, toolSha256: toolHash, wasmSha256: binaryHash, sourceHashes: tree.hashes,
        audioFile: audio, audioSha256: sha(read(audio)), pcmSha256: sha(pcm), sampleRate: 44100, durationSec: pcm.length / 4 / 44100,
        runs, tsMedianMs, wasmMedianMs, improvement: 1 - wasmMedianMs / tsMedianMs, parity,
        maxRSSRatio: Math.max(...byMode('wasm').map(r => r.maxRSSKiB)) / Math.max(...byMode('typescript').map(r => r.maxRSSKiB)),
        scope: 'Actual production numerical injection/retry adapter; WASM compile/instance/table copy inside timed request. Decode/ESM imports/result hashing outside. No HTTP/worker startup or physical Quest measurement.' };
    fs.mkdirSync(dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ tsMedianMs, wasmMedianMs, improvement: receipt.improvement, maxRSSRatio: receipt.maxRSSRatio, parity }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
