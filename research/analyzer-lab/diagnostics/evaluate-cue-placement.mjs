// Reproduce the shipped cue publication on exact PCM, or replay one immutable analysis.
// Models/audio/large captures remain local. Run from the repository root; never overwrites.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';

const [mode, input, output] = process.argv.slice(2);
if (!['--recording', '--capture'].includes(mode) || !input || !output || fs.existsSync(output))
    throw Error('Expected --recording AUDIO NEW.json or --capture PRIOR.json NEW.json');
const hash = value => createHash('sha256').update(value).digest('hex');
let capture;
if (mode === '--recording') {
    const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', input, '-af', 'pan=mono|c0=c0', '-ar', '44100', '-f', 'f32le', 'pipe:1'],
        { maxBuffer: 256 * 1024 ** 2, windowsHide: true });
    const samples = new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
    if (!samples.length || !samples.every(Number.isFinite)) throw Error('Invalid PCM');
    const { rolldown } = await import('rolldown');
    const bundle = await rolldown({ input: 'src/analyzer/analyzeAudio.ts' });
    let result;
    try {
        const code = (await bundle.generate({ format: 'esm' })).output[0].code;
        const { analyzeAudio } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
        result = analyzeAudio({ samples, sampleRate: 44100 });
    } finally { await bundle.close(); }
    const { interpretTrackStructure } = createLoader()('analyzer/TrackStructure.ts');
    capture = { recording: input, pcmSha256: hash(pcm), sampleRate: 44100,
        analysis: interpretTrackStructure(result.trackAnalysis, result.events) };
} else capture = JSON.parse(fs.readFileSync(input, 'utf8'));
if (!/^[a-f0-9]{64}$/.test(capture.pcmSha256 ?? '') || !Number.isFinite(capture.analysis?.duration)
    || capture.analysis.duration <= 0 || !Array.isArray(capture.analysis.features)) throw Error('Invalid analysis capture');
const analysisSha256 = hash(JSON.stringify(capture.analysis));
const { generateVisualOsPerformancePlan } = createLoader()('automation/visualOsPlanLoader.ts');
const performancePlan = await generateVisualOsPerformancePlan(capture.analysis, { duration: capture.analysis.duration,
    stylePackId: 'cosmic-wormhole', activityLevel: 'active', variantMode: 'expressive',
    stylePacksFile: JSON.parse(fs.readFileSync('public/visual-tuning-presets/style-packs.json')) });
if (!performancePlan?.points.length) throw Error('Shipped Visual OS failed; no silent legacy fallback');
if (hash(JSON.stringify(capture.analysis)) !== analysisSha256) throw Error('Analysis was mutated');
const { duration, sections, beats, barStarts } = capture.analysis;
const report = { ...capture, analysisSha256,
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(),
    implementationHashes: ['src/automation/alignAutomationToCues.ts', 'src/semantics/cueEvidence.ts', 'src/semantics/automationCueRoles.ts']
        .map(path => ({ path, sha256: hash(fs.readFileSync(path)) })),
    source: { durationSec: duration, sections, beats, barStarts, performancePlan } };
fs.writeFileSync(output, JSON.stringify(report) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, pcmSha256: capture.pcmSha256, analysisSha256, points: performancePlan.points.length,
    entries: performancePlan.points.filter(p => p.cuePlacement?.role === 'scene-entry').length }));
