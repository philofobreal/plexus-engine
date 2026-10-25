// Offline T11b validation. One exclusive JSON result; no source copies or model installation.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';
import { activityFixture, ACTIVITY_KINDS, ACTIVITY_TUPLES, entryFixture, ENTRY_KINDS } from '../../../tests/fixtures/music-activity-corpus.mjs';
import { renderPitchFixture } from '../../../tests/fixtures/pitch-candidate-corpus.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const bytes = samples => Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
const load = createLoader({}, { Float32Array, Float64Array, Uint32Array, Int32Array });
const { MusicActivity } = load('analyzer/MusicActivity.ts');
const { FeatureExtractor } = load('analyzer/FeatureExtractor.ts');
const { normalizeAcousticActivity } = load('types/musicEvents.ts');
function activity(samples, fs, hop = 1024) {
    const a = new MusicActivity(samples, fs, hop);
    new FeatureExtractor(samples, fs, hop).process(undefined, (s, r, i) => a.observe(s, r, i));
    const result = a.finish(); assert.ok(normalizeAcousticActivity(result, result.clock)); return result;
}
function timing(proposals, truth, tolerance) {
    const used = new Set(), errors = [];
    for (const t of truth) {
        let at = -1, distance = Infinity;
        proposals.forEach((p, i) => { if (!used.has(i) && Math.abs(p - t) < distance) { at = i; distance = Math.abs(p - t); } });
        if (at >= 0 && distance <= tolerance) { used.add(at); errors.push(proposals[at] - t); }
    }
    return { proposed: proposals.length, reference: truth.length, matched: used.size, errorsSeconds: errors };
}
function median(values) { return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]; }

export async function measureMusicActivity(audioDir) {
    const sources = ['src/analyzer/MusicActivity.ts', 'src/analyzer/FeatureExtractor.ts', 'src/analyzer/analyzeAudio.ts',
        'src/types/musicEvents.ts', 'tests/fixtures/music-activity-corpus.mjs', 'research/analyzer-lab/diagnostics/measure-music-activity.mjs'];
    const sourceHashes = Object.fromEntries(sources.map(p => [p, hash(readFileSync(p))]));
    const authored = [];
    for (const [split, tuples] of Object.entries(ACTIVITY_TUPLES)) for (const tuple of tuples) for (const kind of ACTIVITY_KINDS) {
        const f = activityFixture(kind, tuple), r = activity(f.samples, f.sampleRate);
        const measured = timing(r.attacks.map(a => a.time), f.attacks, 1024 / f.sampleRate + .004);
        authored.push({ split, kind, tuple, identity: hash(bytes(f.samples)), toleranceSeconds: 1024 / f.sampleRate + .004, ...measured });
    }
    // Exact synthetic PCM, original dual-provider periodicity agreement. This is a cross-tab,
    // not onset/offset truth: periodicity votes cannot establish note/source identity.
    const entryControls = [];
    for (const [split, tuples] of Object.entries(ACTIVITY_TUPLES)) for (const tuple of tuples) for (const kind of ENTRY_KINDS) {
        const f = entryFixture(kind, tuple), hop = split === 'development' ? 512 : 1024, r = activity(f.samples, f.sampleRate, hop);
        const candidates = r.spectralEntries.candidates;
        entryControls.push({ split, kind, tuple, hopSize: hop, pcmSha256: hash(bytes(f.samples)), durationSeconds: f.samples.length / f.sampleRate, coverage: f.coverage,
            toleranceSeconds: hop / f.sampleRate + .004, ...timing(candidates.map(c => c.time), f.attacks, hop / f.sampleRate + .004),
            legacyEnergyAttacks: r.attacks.length, candidates });
    }
    const periodicity = [];
    for (const split of ['development', 'transfer']) {
        const path = `research/analyzer-lab/fixtures/an04b-${split === 'transfer' ? 'transfer-frozen' : 'development-01'}.json`, prior = JSON.parse(readFileSync(path));
        for (const c of prior.cases) {
            const f = renderPitchFixture(c.spec); assert.equal(f.identity.pcmSha256, c.identity.pcmSha256);
            const r = activity(f.samples, f.spec.sampleRate);
            periodicity.push({ split, kind: c.spec.kind, referenceSha256: hash(readFileSync(path)), pcmSha256: f.identity.pcmSha256,
                dualProviderPairs: c.provider.pairs.length, textures: [...new Set(r.dominance.map(d => d.texture))],
                attacks: r.attacks.length, groundTruth: null, accuracy: null });
        }
    }
    const prior = JSON.parse(readFileSync('research/analyzer-lab/fixtures/an03f-dual-prodigy-01.json'));
    async function bundledAnalyzer(mode) {
        const bundle = await rolldown({ input: 'src/analyzer/analyzeAudio.ts', plugins: mode === 'legacy' ? [{
            name: 'legacy-no-activity', resolveId(id) { if (id === './MusicActivity') return '\0legacy'; },
            load(id) { if (id === '\0legacy') return 'export class MusicActivity { observe() {} finish() { return undefined; } }'; }
        }] : mode === 't11b' ? [{ name: 'retained-t11b-activity', load(id) {
            if (id.replaceAll('\\', '/').endsWith('/analyzer/MusicActivity.ts')) return { code: execFileSync('git', ['show', 'a1a0eaa63f143f9fa374d9c03f89a18f2c4dddb5:src/analyzer/MusicActivity.ts'], { encoding: 'utf8', windowsHide: true }), moduleType: 'ts' };
        } }] : [] });
        try {
            const result = await bundle.generate({ format: 'esm' });
            const module = await import('data:text/javascript;base64,' + Buffer.from(result.output[0].code).toString('base64'));
            return module.analyzeAudio;
        } finally { await bundle.close(); }
    }
    const current = await bundledAnalyzer('current'), legacy = await bundledAnalyzer('legacy'), t11b = await bundledAnalyzer('t11b');
    const { assessAcousticOnsets } = load('semantics/acousticEvidence.ts');
    const recorded = [];
    for (const file of readdirSync(audioDir).filter(f => /\.mp3$/i.test(f)).sort()) {
        const path = join(audioDir, file), references = prior.rows.filter(r => r.file === file || r.absolutePath.endsWith(file));
        assert.ok(references.length, 'Unrecognized recording');
        const fs = references[0].track.sampleRate;
        const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-af', 'pan=mono|c0=c0', '-ar', String(fs), '-f', 'f32le', 'pipe:1'], { maxBuffer: 256 * 1024 ** 2 });
        const samples = new Float32Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
        const decoded = hash(pcm), input = { samples, sampleRate: fs };
        console.log(JSON.stringify({ file, phase: 'full-analysis-parity', seconds: samples.length / fs }));
        const old = legacy(input), fresh = current(input), layer = fresh.trackAnalysis.musicActivity;
        assert.ok(normalizeAcousticActivity(layer, layer.clock));
        const previousLayer = t11b(input).trackAnalysis.musicActivity, coreLayer = { ...layer }; delete coreLayer.spectralEntries;
        assert.deepEqual(coreLayer, previousLayer, 'Entire T11b evidence remains exact');
        delete fresh.trackAnalysis.musicActivity; delete old.trackAnalysis.musicActivity;
        assert.deepEqual(fresh, old, 'Every legacy numeric/event/chart input stays exact');
        const comparisons = references.map(r => {
            const context = samples.subarray(r.contextStartSample, r.contextEndSample), identity = hash(bytes(context));
            if (identity !== r.excerptWithContextPcmSha256) return { fraction: r.fraction, status: 'decoder-pcm-mismatch', expected: r.excerptWithContextPcmSha256, actual: identity, accuracy: null };
            const a = activity(context, fs), offset = r.contextStartSample / fs;
            const candidates = a.attacks.filter(c => c.time + offset >= r.excerptStartSample / fs && c.time + offset < r.excerptEndSample / fs)
                .map(c => ({ sampleIndex: c.sampleIndex, time: c.time, supportStartSample: c.supportSamples[0], supportEndSample: c.supportSamples[1], endpointAmbiguous: false }));
            const id = { pcmSha256: identity, sampleRate: fs, sampleCount: context.length, timelineOffsetSeconds: offset };
            const assessed = assessAcousticOnsets(candidates, r.strictReference.acceptedReferences.map(ref => ({ ...ref, identity: id })), id);
            return { fraction: r.fraction, status: 'exact-pcm', candidates: candidates.length, references: r.strictReference.acceptedReferences.length,
                dualQualified: assessed.events.filter(e => e.reference !== null).length, accuracy: null };
        });
        // Alternating warm paired runs, 20 s excerpt; elapsed wall time includes all analyzer DSP.
        const excerpt = samples.slice(Math.round(samples.length * .45), Math.round(samples.length * .45) + 20 * fs);
        const request = { samples: excerpt, sampleRate: fs }, milliseconds = { t11b: [], t11c: [] };
        t11b(request); current(request);
        for (let i = 0; i < 5; i++) for (const key of i % 2 ? ['t11c', 't11b'] : ['t11b', 't11c']) {
            const start = performance.now(); (key === 't11b' ? t11b : current)(request); milliseconds[key].push(performance.now() - start);
        }
        recorded.push({ file, fileSha256: hash(readFileSync(path)), decodedPcmSha256: decoded, sampleRate: fs, sampleCount: samples.length,
            legacyExact: true, t11bExact: true, spectralEntries: layer.spectralEntries.candidates.length, activity: layer.activity.length, attacks: layer.attacks.length, dominance: layer.dominance.length,
            payloadBytes: Buffer.byteLength(JSON.stringify(layer)), comparisons, milliseconds,
            medianOverheadPercent: (median(milliseconds.t11c) / median(milliseconds.t11b) - 1) * 100,
            groundTruth: null, accuracy: null });
        console.log(JSON.stringify(recorded.at(-1)));
    }
    for (const [p, digest] of Object.entries(sourceHashes)) assert.equal(hash(readFileSync(p)), digest, 'Source changed during measurement');
    return { protocol: 't11c-tonal-carrier-entry-1', node: process.version, decoder: execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0],
        sourceHashScope: 'delivery files only; full unchanged dependencies belong to the source commit', sourceHashes, analyzerExecution: 'Vite dependency rolldown ESM bundles; no VM wrapper in CPU comparison', authored, entryControls, periodicity, recorded, modelRerun: false, recordedGroundTruth: null,
        noteSourceVocalRecognition: 'unsupported', performanceScope: 'offline Node elapsed analyzer wall time, not process CPU time, browser frame rate or physical Quest' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    if (process.argv.length !== 6 || process.argv[2] !== '--audio-dir' || process.argv[4] !== '--output')
        throw new Error('Use --audio-dir DIRECTORY --output NEW_JSON');
    // Reserve exclusive destination before expensive work; never overwrite retained evidence.
    const fd = (await import('node:fs')).openSync(process.argv[5], 'wx');
    try { writeFileSync(fd, JSON.stringify(await measureMusicActivity(process.argv[3]), null, 2) + '\n'); }
    finally { (await import('node:fs')).closeSync(fd); }
}
