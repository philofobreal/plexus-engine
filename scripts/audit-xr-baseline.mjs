// T00 read-only baseline audit. Run from the project root with Node/npm dependencies installed.
// Usage: node scripts/audit-xr-baseline.mjs <source-export.md> <output.json>
// Reuses existing deterministic fixtures and loader; never rewrites goldens or application state.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { createLoader } from '../tests/helpers/xr-loader.mjs';
import { GOLDEN_FIXTURES, buildFixtureInput } from '../tests/fixtures/golden-fixtures.mjs';

const [exportPath, outputPath] = process.argv.slice(2);
if (!exportPath || !outputPath) throw new Error('Expected source-export.md and output.json arguments');
const normalize = text => text.replaceAll('\r\n', '\n').replace(/\n+$/, '');
const hash = text => createHash('sha256').update(text).digest('hex');
const exported = normalize(readFileSync(exportPath, 'utf8'));
const files = ['AGENTS.md', 'package.json', 'vite.config.ts',
    'src/audio/AudioEngine.ts', 'src/audio/analyzer.worker.ts', 'src/analyzer/analyzeAudio.ts',
    'src/gameplay/RhythmChartBuilder.ts', 'src/gameplay/RhythmScorePlanner.ts', 'src/gameplay/RhythmGameSession.ts',
    'src/xr/XrAppController.ts', 'src/xr/scene/RhythmGameScene.ts', 'src/xr/XrBackgroundSettings.ts',
    'src/visuals/PlexusRenderer.ts', 'src/visuals/WormholeCanvasSource.ts', 'src/visuals/WebGLRendererBackend.ts',
    'src/export/WebCodecsBackend.ts', 'src/ui/mvp/MvpVisualController.ts'];
const comparison = files.map(file => {
    const heading = `\n## ${file}\n`;
    const section = exported.indexOf(heading);
    if (section < 0) return { file, status: 'missing-in-export' };
    const opening = /\n(`{3,})[^\n]*\n/g;
    opening.lastIndex = section + heading.length;
    const match = opening.exec(exported);
    if (!match) throw new Error(`No source fence for ${file}`);
    const begin = opening.lastIndex;
    const end = exported.indexOf(`\n${match[1]}\n`, begin);
    if (end < 0) throw new Error(`Unterminated source fence for ${file}`);
    const previous = normalize(exported.slice(begin, end));
    const current = normalize(readFileSync(file, 'utf8'));
    return { file, status: previous === current ? 'equal' : 'different',
        exportedSha256: hash(previous), checkoutSha256: hash(current) };
});

const load = createLoader();
const { buildRhythmChart, RhythmGameSession } = load('gameplay/index.ts');
const { analyzeAudio } = load('analyzer/analyzeAudio.ts');
const { ANALYSIS_ALGORITHM_VERSION } = load('analyzer/constants.ts');
function stats(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const quantile = p => sorted[Math.ceil(p * sorted.length) - 1];
    return { samples: values.length, p50Ms: quantile(0.5), p95Ms: quantile(0.95), p99Ms: quantile(0.99) };
}
function time(run) {
    const start = performance.now();
    const value = run();
    return { value, ms: performance.now() - start };
}
const charts = [];
for (const [name, step, settings] of [
    ['sparse-normal-standard', 0.75, { difficulty: 'normal', playSpace: 'standard' }],
    ['dense-ultra-tall', 0.125, { difficulty: 'ultra', playSpace: 'tall' }]
]) {
    const events = Array.from({ length: Math.floor(300 / step) }, (_, i) =>
        ({ time: i * step, intensity: 0.4 + (i % 7) * 0.08, type: 1 }));
    const source = { events, durationSec: 300, beats: events.map(e => e.time), timingConfidence: 0.9 };
    const run = () => buildRhythmChart(source, undefined, settings);
    const cold = time(run);
    for (let i = 0; i < 5; i++) run();
    const samples = Array.from({ length: 30 }, () => time(run));
    const serialized = JSON.stringify(cold.value);
    const session = new RhythmGameSession();
    const scoring = Array.from({ length: 30 }, () => time(() => session.loadChart(cold.value)).ms);
    charts.push({ name, durationSec: 300, inputEvents: events.length, noteCount: cold.value.length,
        coldMs: cold.ms, warm: stats(samples.map(x => x.ms)), scoringLoad: stats(scoring),
        deterministic: samples.every(x => JSON.stringify(x.value) === serialized), chartSha256: hash(serialized) });
}
const analyzer = [];
for (const id of ['house-128', 'dnb-176', 'breakdown-124']) {
    const fixture = GOLDEN_FIXTURES.find(f => f.id === id);
    if (!fixture) throw new Error(`Missing fixture ${id}`);
    const input = buildFixtureInput(fixture);
    input.options.algorithmVersion = ANALYSIS_ALGORITHM_VERSION;
    const cold = time(() => analyzeAudio(input));
    const samples = Array.from({ length: 10 }, () => time(() => analyzeAudio(input)));
    const serialized = JSON.stringify(cold.value);
    analyzer.push({ id, sampleRate: input.sampleRate, sampleCount: input.samples.length,
        durationSec: input.samples.length / input.sampleRate, algorithmVersion: ANALYSIS_ALGORITHM_VERSION,
        coldMs: cold.ms, warm: stats(samples.map(x => x.ms)), events: cold.value.events.length,
        deterministic: samples.every(x => JSON.stringify(x.value) === serialized), outputSha256: hash(serialized) });
}
const report = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    runtime: process.version, platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model, logicalCpus: os.availableParallelism(),
    method: 'Node process; TS loader and fixture synthesis excluded from measured calls; first call then 30 chart / 10 analyzer warm calls; no CI performance assertions',
    sourceExportSha256: hash(readFileSync(exportPath)), comparison, charts, analyzer,
    unmeasured: ['browser render/GPU/worker/compositor', 'real-track analysis', 'live export', 'Quest 3', 'peak memory'] };
writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ comparison: comparison.map(x => [x.file, x.status]), charts, analyzer }, null, 2));
