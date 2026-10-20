// Diagnostic VM-core timings, not browser/production or physical XR benchmarks.
// Parent: --output NEW_JSON. Children isolate RSS/high-water history between cases.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';
import { sha256 } from '../../../tests/fixtures/acoustic-onset-challenges.mjs';

const args = process.argv.slice(2), self = fileURLToPath(import.meta.url);
if (args[0] === '--child') {
    const seconds = Number(args[1]), method = args[2];
    if (args.length !== 3 || ![30, 180, 600].includes(seconds) || !['v1', 'v2'].includes(method)) throw new Error('Invalid child configuration');
    const fs = 16000, samples = Float32Array.from({length: fs * seconds}, (_, i) => .2 * Math.sin(2 * Math.PI * 110 * i / fs));
    for (let t = 1; t < seconds; t += 5) samples[Math.round(t * fs)] += .1;
    const pcmSha256 = sha256(Buffer.from(samples.buffer));
    const load = createLoader({}, {Float32Array, Float64Array});
    const extract = method === 'v1' ? load('analyzer/AcousticOnsets.ts').extractAcousticOnsets : load('analyzer/PredictiveOnsets.ts').extractPredictiveOnsets;
    const memoryBefore = process.memoryUsage(), start = performance.now();
    const result = extract(samples, fs);
    const durationMs = performance.now() - start, memoryAfter = process.memoryUsage();
    const maxRss = process.resourceUsage().maxRSS;
    console.log(JSON.stringify({seconds, method, sampleRate: fs, sampleCount: samples.length, pcmSha256,
        durationMs, memoryBefore, memoryAfter, maxRssKiB: maxRss > 0 ? maxRss : null,
        candidateCount: result.candidates.length, initialCandidateCount: result.candidates.filter(p => p.time < .1).length,
        laterCandidateCount: result.candidates.filter(p => p.time >= .1).length,
        expectedAddedHits: Math.ceil((seconds - 1) / 5), nodeVersion: process.version}));
} else {
    if (args.length !== 2 || args[0] !== '--output' || existsSync(args[1])) throw new Error('Use --output NEW_JSON');
    const cases = [];
    for (const [seconds, method] of [[30, 'v1'], [30, 'v2'], [180, 'v2'], [600, 'v2']]) {
        const child = spawnSync(process.execPath, [self, '--child', String(seconds), method], {encoding: 'utf8', windowsHide: true});
        if (child.status !== 0) throw new Error(child.stderr || `Profile child failed: ${child.status}`);
        cases.push(JSON.parse(child.stdout));
    }
    if (cases[0].pcmSha256 !== cases[1].pcmSha256) throw new Error('Profile comparison PCM mismatch');
    const paths = ['src/analyzer/PredictiveOnsets.ts', 'src/analyzer/AcousticOnsets.ts', 'src/analyzer/signalContract.ts', 'tests/helpers/xr-loader.mjs',
        'research/analyzer-lab/diagnostics/profile-predictive-onsets.mjs'];
    writeFileSync(args[1], JSON.stringify({scope: 'Single observation per condition, isolated child VM loader excluded from duration; not a production benchmark',
        sourceHashes: Object.fromEntries(paths.map(p => [p, sha256(readFileSync(p))])), cases,
        limitations: ['RSS includes Node/TypeScript VM loader; null high-water is unavailable on this platform.',
            'Before/after memory is not peak live DSP allocation; no controlled GC or replicated performance interval.',
            'V1 measured only at 30 s; no extrapolated long-track ratio.']}, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify({output: args[1], cases: cases.map(c => ({seconds: c.seconds, method: c.method, durationMs: c.durationMs, laterCandidateCount: c.laterCandidateCount}))}));
}
