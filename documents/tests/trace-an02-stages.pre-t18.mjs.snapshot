// Exact-source, observation-only instrumentation. Reject drift instead of tracing another kernel.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';
import { sha256 } from '../../../tests/fixtures/acoustic-onset-challenges.mjs';

export const KERNEL_SHA256 = 'eba437661861f0d14d411246e6f6f093059f3e085a1cff8da65e9c39c3458491';

export function instrumentSource(source) {
    if (sha256(source) !== KERNEL_SHA256) throw new Error('Unreviewed acoustic kernel identity');
    const replace = (needle, replacement) => {
        if (source.split(needle).length !== 2) throw new Error('Instrumentation anchor is not unique');
        source = source.replace(needle, replacement);
    };
    replace('const center = frame * hopSize;', 'trace.peaks.push(frame); const center = frame * hopSize;');
    const gate = 'if (after < 1e-12 || after < 2 * Math.max(before, 1e-12) || (incomplete && before > 1e-12)) continue;';
    replace(gate, `const floorRejected = after < 1e-12;
        const relativeRejected = after < 2 * Math.max(before, 1e-12);
        const endpointRejected = incomplete && before > 1e-12;
        trace.refined.push({frame, sampleIndex: index, time: index / sampleRate,
            strength: smoothed[frame], before, after, floorRejected, relativeRejected, endpointRejected});
        if (floorRejected || relativeRejected || endpointRejected) continue;`);
    replace('candidates.sort((a, b)', 'trace.gated = candidates.map(c => ({...c})); candidates.sort((a, b)');
    return source;
}

export function createStageTracer() {
    const source = instrumentSource(readFileSync('src/analyzer/AcousticOnsets.ts', 'utf8'));
    const code = ts.transpileModule(source, {compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
    const trace = {}, module = {exports: {}}, load = createLoader({}, {Float32Array, Float64Array});
    const dependencies = {
        './math/FFT': load('analyzer/math/FFT.ts'), './math/SpectralFlatness': load('analyzer/math/SpectralFlatness.ts'),
        './signalContract': load('analyzer/signalContract.ts'), './TemporalSmoother': load('analyzer/TemporalSmoother.ts')
    };
    vm.runInNewContext(code, {module, exports: module.exports, trace, Float32Array, Float64Array,
        require: name => { if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected dependency ${name}`); return dependencies[name]; }});
    return (samples, sampleRate) => {
        trace.peaks = []; trace.refined = []; trace.gated = [];
        const output = module.exports.extractAcousticOnsets(samples, sampleRate);
        // Host arrays avoid retaining VM prototypes in the diagnostic transport.
        return {output, peaks: [...trace.peaks], refined: Array.from(trace.refined, c => ({...c})), gated: Array.from(trace.gated, c => ({...c}))};
    };
}

// Descending-strength greedy NMS, not a global optimum or an integrated algorithm.
export function strengthOrderedNms(proposals, separation) {
    if (!Number.isInteger(separation) || separation < 1) throw new Error('Invalid separation');
    if (proposals.some(p => !Number.isInteger(p.sampleIndex) || p.sampleIndex < 0 || !Number.isFinite(p.strength) || p.strength <= 0))
        throw new Error('Invalid proposal');
    const ordered = proposals.map((p, originalIndex) => ({...p, originalIndex}))
        .sort((a, b) => b.strength - a.strength || a.sampleIndex - b.sampleIndex || a.originalIndex - b.originalIndex);
    const selected = [];
    for (const proposal of ordered) if (selected.every(p => Math.abs(p.sampleIndex - proposal.sampleIndex) >= separation)) selected.push(proposal);
    return selected.sort((a, b) => a.sampleIndex - b.sampleIndex).map(({originalIndex, ...p}) => p);
}
