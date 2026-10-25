// Offline cumulative T11b/c/d/e/f/g/h/i validation. One exclusive JSON result; no source copies or model installation.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';
import { activityFixture, ACTIVITY_KINDS, ACTIVITY_TUPLES, entryFixture, ENTRY_KINDS, bandFixture, BAND_KINDS, contextFixture, CONTEXT_SPECS, attackChangeFixture, ATTACK_CHANGE_KINDS, ATTACK_CHANGE_PHASES, QUIET_TONAL_STUDY, quietTonalFixture } from '../../../tests/fixtures/music-activity-corpus.mjs';
import { renderPitchFixture } from '../../../tests/fixtures/pitch-candidate-corpus.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const bytes = samples => Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
const load = createLoader({}, { Float32Array, Float64Array, Uint32Array, Int32Array });
const { MusicActivity } = load('analyzer/MusicActivity.ts');
const { FeatureExtractor } = load('analyzer/FeatureExtractor.ts');
const { normalizeAcousticActivity } = load('types/musicEvents.ts');
const { FFT } = load('analyzer/math/FFT.ts');
const { validateAnalysisSamples } = load('analyzer/signalContract.ts');
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

// Research only: frozen before transfer. None of this module is imported by browser code.
export const QUIET_TONAL_POLICY = Object.freeze({
    algorithm: 'quiet-carrier-fit-v1', predecessor: 'quiet-carrier-context-v0',
    positiveFraction: .75, peakFraction: .8, minimumPeakBin: 2,
    supportSeconds: .08, fitSeconds: .002, maximumFitResidual: .05,
    minimumRelativePower: .25, maximumRelativePower: 4,
    sourceOwnership: 'unresolved', confidence: null, xrScoring: 'ineligible'
});

/** Affine AR(2) sinusoid residual on a complete short interval, never a source classifier. */
function carrierFit(samples, start, size, fs, spectralSize, peak) {
    let meanX = 0, meanY = 0, mean = 0;
    for (let n = 0; n < size; n++) mean += samples[start + n];
    mean /= size;
    for (let n = 2; n < size; n++) { meanX += samples[start + n - 1]; meanY += samples[start + n] + samples[start + n - 2]; }
    meanX /= size - 2; meanY /= size - 2;
    let variance = 0, covariance = 0, power = 0;
    for (let n = 0; n < size; n++) power += (samples[start + n] - mean) ** 2;
    for (let n = 2; n < size; n++) {
        const x = samples[start + n - 1] - meanX, y = samples[start + n] + samples[start + n - 2] - meanY;
        variance += x * x; covariance += x * y;
    }
    if (power / size <= 1e-10 || variance / (size - 2) <= 1e-10) return { pass: false, residual: null };
    const coefficient = covariance / variance, intercept = meanY - coefficient * meanX;
    if (Math.abs(coefficient) > 2) return { pass: false, residual: null };
    let error = 0;
    for (let n = 2; n < size; n++) error += (samples[start + n] + samples[start + n - 2] - coefficient * samples[start + n - 1] - intercept) ** 2;
    const residual = error / power, estimatedBin = Math.acos(coefficient / 2) * spectralSize / (2 * Math.PI);
    return { pass: residual <= QUIET_TONAL_POLICY.maximumFitResidual && Math.abs(estimatedBin - peak) <= 1,
        residual, estimatedFrequency: estimatedBin * fs / spectralSize };
}

/** Caller supplies matching PCM/analysis. Clock validation is not a proof of PCM identity. */
export function qualifyQuietTonalActivity(samples, layer, algorithm = QUIET_TONAL_POLICY.algorithm) {
    if (![QUIET_TONAL_POLICY.algorithm, QUIET_TONAL_POLICY.predecessor].includes(algorithm)) throw new Error('Unknown qualification policy');
    validateAnalysisSamples(samples);
    if (!layer || samples.length !== layer.clock?.sampleCount || !normalizeAcousticActivity(layer, layer.clock)) throw new Error('Invalid qualification input');
    const { sampleRate: fs, sampleCount: length } = layer.clock, size = layer.attackChanges?.windowSize;
    const fitSize = Math.max(16, Math.round(QUIET_TONAL_POLICY.fitSeconds * fs));
    let fft, windowSum = 0, windowPower = 0;
    const records = layer.attacks.map((a, index) => {
        const q = a.quietOnset, c = layer.attackChanges?.records[index];
        const r = { attackId: a.id, sampleIndex: q?.sampleIndex ?? null, verdict: 'abstain', reason: 'no-quiet-crossing',
            earlyFitSamples: null, earlyResidual: null, carrierFitSamples: null, persistenceSamples: null, requiredEndSample: null, frozenPeakBin: null, windows: 0, decisionSample: length };
        if (!q) return r;
        r.reason = 'unavailable-local-spectrum';
        if (layer.attackChanges?.algorithm !== 'attack-local-excess-v2' || !size || c?.status !== 'measured') return r;
        r.reason = 'local-spectrum-not-narrow';
        if (c.positivePowerFraction < QUIET_TONAL_POLICY.positiveFraction || c.peakNeighborhoodFraction < QUIET_TONAL_POLICY.peakFraction || c.peakBin < QUIET_TONAL_POLICY.minimumPeakBin) return r;
        const targetEnd = q.sampleIndex + Math.ceil(QUIET_TONAL_POLICY.supportSeconds * fs);
        const firstEnd = c.bodySamples[1], windows = Math.ceil((targetEnd - firstEnd) / size);
        const end = firstEnd + windows * size;
        r.reason = 'incomplete-persistence'; r.requiredEndSample = end; r.frozenPeakBin = c.peakBin;
        if (end > length || q.sampleIndex + fitSize > length) return r;
        if (algorithm === QUIET_TONAL_POLICY.algorithm) {
            r.earlyFitSamples = [q.sampleIndex, q.sampleIndex + fitSize];
            // The same frozen initial spectral neighborhood is used for every fit, never a later peak.
            for (let start = q.sampleIndex; start < targetEnd; start += fitSize) {
                if (start + fitSize > length) return r;
                r.carrierFitSamples = [q.sampleIndex, start + fitSize];
                const fit = carrierFit(samples, start, fitSize, fs, size, c.peakBin);
                if (start === q.sampleIndex) r.earlyResidual = fit.residual;
                if (!fit.pass) { r.reason = start === q.sampleIndex ? 'initial-carrier-unproven' : 'carrier-interrupted'; return r; }
            }
        }
        if (!fft) { fft = new FFT(size); for (const w of fft.window) { windowSum += w; windowPower += w * w; } }
        r.persistenceSamples = [c.bodySamples[0], firstEnd]; r.reason = 'fixed-band-not-persistent';
        for (let start = firstEnd; start < end; start += size) {
            let mean = 0;
            for (let n = 0; n < size; n++) mean += samples[start + n] * fft.window[n];
            mean /= windowSum;
            for (let n = 0; n < size; n++) { fft.re[n] = (samples[start + n] - mean) * fft.window[n]; fft.im[n] = 0; }
            fft.transform(); r.persistenceSamples[1] = start + size; let total = 0, band = 0;
            for (let k = 1; k < size / 2; k++) {
                const power = fft.re[k] ** 2 + fft.im[k] ** 2; total += power;
                if (Math.abs(k - c.peakBin) <= 1) band += power;
            }
            r.windows++;
            const relative = 2 * band / (size * windowPower * c.positivePower);
            if (total <= 0 || band / total < QUIET_TONAL_POLICY.peakFraction
                || relative < QUIET_TONAL_POLICY.minimumRelativePower || relative > QUIET_TONAL_POLICY.maximumRelativePower) return r;
        }
        r.verdict = 'qualified'; r.reason = 'observed-quiet-carrier'; return r;
    });
    return { algorithm, status: 'research-only', sourceOwnership: 'unresolved', confidence: null, xrScoring: 'ineligible', records };
}

function eventScore(proposals, references, tolerance, fs) {
    const used = new Set(), errorsSamples = [];
    for (const sample of proposals) {
        let at = -1, distance = Infinity;
        references.forEach((ref, i) => { if (!used.has(i) && Math.abs(sample - ref) < distance) { at = i; distance = Math.abs(sample - ref); } });
        if (at >= 0 && distance <= tolerance) { used.add(at); errorsSamples.push(sample - references[at]); }
    }
    const tp = used.size, fp = proposals.length - tp, fn = references.length - tp;
    return { tp, fp, fn, errorsSamples, errorsSeconds: errorsSamples.map(n => n / fs) };
}
function qualificationSummary(rows, algorithm) {
    const cells = rows.map(r => r.results[algorithm]);
    const tp = cells.reduce((s, r) => s + r.tp, 0), fp = cells.reduce((s, r) => s + r.fp, 0), fn = cells.reduce((s, r) => s + r.fn, 0);
    const errors = cells.flatMap(r => r.errorsSeconds).sort((a, b) => a - b), abs = errors.map(Math.abs).sort((a, b) => a - b);
    const qualified = cells.reduce((s, r) => s + r.qualified, 0), attacks = rows.reduce((s, r) => s + r.rawAttacks, 0);
    const totalSeconds = rows.reduce((s, r) => s + r.sampleCount / r.sampleRate, 0);
    return { cases: rows.length, tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null,
        f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null, qualified, rawAttacks: attacks,
        abstentionFraction: attacks ? 1 - qualified / attacks : null, falsePositivesPerMinute: fp / (totalSeconds / 60),
        signedBiasSeconds: errors.length ? errors.reduce((s, x) => s + x, 0) / errors.length : null,
        p50AbsoluteSeconds: abs.length ? abs[Math.floor((abs.length - 1) * .5)] : null,
        p95AbsoluteSeconds: abs.length ? abs[Math.floor((abs.length - 1) * .95)] : null };
}
export function measureQuietTonalQualification(splits = ['development', 'transfer']) {
    if (!Array.isArray(splits) || !splits.length || new Set(splits).size !== splits.length) throw new Error('Invalid qualification splits');
    const rows = [];
    for (const split of splits) {
        if (!Object.hasOwn(QUIET_TONAL_STUDY.tuples, split)) throw new Error('Unknown qualification split');
        for (const tuple of QUIET_TONAL_STUDY.tuples[split]) for (const phase of QUIET_TONAL_STUDY.phases[split])
            for (const gain of QUIET_TONAL_STUDY.gains) for (const kind of QUIET_TONAL_STUDY.kinds) {
                const f = quietTonalFixture(kind, tuple, phase, gain), layer = activity(f.samples, f.sampleRate, tuple.hop), results = {};
                for (const algorithm of [QUIET_TONAL_POLICY.predecessor, QUIET_TONAL_POLICY.algorithm]) {
                    const result = qualifyQuietTonalActivity(f.samples, layer, algorithm), qualified = result.records.filter(r => r.verdict === 'qualified').map(r => r.sampleIndex);
                    results[algorithm] = { ...eventScore(qualified, f.qualificationStarts, Math.ceil(QUIET_TONAL_STUDY.toleranceSeconds * f.sampleRate), f.sampleRate),
                        qualified: qualified.length, records: result.records,
                        physicalTonalCoverage: eventScore(qualified, f.tonalStarts, Math.ceil(QUIET_TONAL_STUDY.toleranceSeconds * f.sampleRate), f.sampleRate) };
                }
                rows.push({ split, kind, tuple, phase, gain, stratum: f.stratum, sampleCount: f.samples.length, sampleRate: f.sampleRate,
                    pcmSha256: hash(bytes(f.samples)), latentHandoffSamples: f.latentHandoffSamples, qualificationReferences: f.qualificationStarts, physicalTonalStarts: f.tonalStarts, rawAttacks: layer.attacks.length, results });
            }
    }
    const summaries = {};
    for (const split of splits) {
        const selected = rows.filter(r => r.split === split);
        summaries[split] = {};
        for (const algorithm of [QUIET_TONAL_POLICY.predecessor, QUIET_TONAL_POLICY.algorithm]) {
            const clean = qualificationSummary(selected.filter(r => r.stratum === 'clean-positive'), algorithm);
            const protectedRows = selected.filter(r => r.stratum.startsWith('protected'));
            const protectedResult = qualificationSummary(protectedRows, algorithm);
            summaries[split][algorithm] = { overall: qualificationSummary(selected, algorithm), clean, protected: protectedResult,
                ambiguity: qualificationSummary(selected.filter(r => r.stratum === 'source-ambiguity'), algorithm),
                byKind: Object.fromEntries(QUIET_TONAL_STUDY.kinds.map(kind => [kind, qualificationSummary(selected.filter(r => r.kind === kind), algorithm)])),
                gatePassed: clean.recall >= QUIET_TONAL_STUDY.cleanRecallMinimum && protectedResult.fp <= QUIET_TONAL_STUDY.protectedFalsePositivesMaximum };
        }
    }
    return { protocol: QUIET_TONAL_STUDY.protocol, policy: QUIET_TONAL_POLICY, acceptance: { cleanRecallMinimum: .95, protectedFalsePositivesMaximum: 0 },
        groundTruth: 'authored signal only', productionPromotion: false, modelRerun: false, rows, summaries };
}

export async function measureMusicActivity(audioDir) {
    const sources = ['src/analyzer/MusicActivity.ts', 'src/analyzer/FeatureExtractor.ts', 'src/analyzer/analyzeAudio.ts',
        'src/types/musicEvents.ts', 'src/types/CanvasVisualSource.ts', 'src/visuals/WormholeHostWorkerSource.ts',
        'src/visuals/WormholeWorkerSource.ts', 'src/visuals/WormholeNativeWorkerSource.ts', 'src/visuals/WormholeExactWorkerSource.ts',
        'tests/fixtures/music-activity-corpus.mjs', 'research/analyzer-lab/diagnostics/measure-music-activity.mjs'];
    const sourceHashes = Object.fromEntries(sources.map(p => [p, hash(readFileSync(p))]));
    const quietTonalStudy = measureQuietTonalQualification();
    const authored = [];
    for (const [split, tuples] of Object.entries(ACTIVITY_TUPLES)) for (const tuple of tuples) for (const kind of ACTIVITY_KINDS) {
        const f = activityFixture(kind, tuple), r = activity(f.samples, f.sampleRate);
        const measured = timing(r.attacks.map(a => a.time), f.attacks, 1024 / f.sampleRate + .004);
        authored.push({ split, kind, tuple, identity: hash(bytes(f.samples)), toleranceSeconds: 1024 / f.sampleRate + .004, ...measured, attackChanges: r.attackChanges });
    }
    // Exact synthetic PCM, original dual-provider periodicity agreement. This is a cross-tab,
    // not onset/offset truth: periodicity votes cannot establish note/source identity.
    const entryControls = [];
    for (const [split, tuples] of Object.entries(ACTIVITY_TUPLES)) for (const tuple of tuples) for (const kind of ENTRY_KINDS) {
        const f = entryFixture(kind, tuple), hop = split === 'development' ? 512 : 1024, r = activity(f.samples, f.sampleRate, hop);
        const candidates = r.spectralEntries.candidates;
        entryControls.push({ split, kind, tuple, hopSize: hop, pcmSha256: hash(bytes(f.samples)), durationSeconds: f.samples.length / f.sampleRate, coverage: f.coverage,
            toleranceSeconds: hop / f.sampleRate + .004, ...timing(candidates.map(c => c.time), f.attacks, hop / f.sampleRate + .004),
            legacyEnergyAttacks: r.attacks.length, candidates, bandActivity: r.bandActivity.records, entryContexts: r.entryContexts.records,
            releaseTruthSeconds: kind === 'repeat-soft-tone' ? [.95, 1.65] : kind === 'soft-tone' ? [1.2] : kind === 'soft-noise-hit' ? [.76] : [] });
    }
    const bandControls = [];
    for (const [split, tuples] of Object.entries(ACTIVITY_TUPLES)) for (const tuple of tuples) for (const kind of BAND_KINDS) {
        const hop = split === 'development' ? 512 : 1024, f = bandFixture(kind, tuple, hop), r = activity(f.samples, f.sampleRate, hop);
        const first = r.bandActivity.records[0];
        assert.ok(first && Math.abs(first.startSample / f.sampleRate - .7) <= hop / f.sampleRate + .004);
        bandControls.push({ split, kind, tuple, hopSize: hop, pcmSha256: hash(bytes(f.samples)), sampleCount: f.samples.length,
            sourceEndSeconds: f.sourceEnd, bandReferenceSeconds: f.expectedBandEnd,
            referenceScope: 'authored fixed-band support; no source offset truth for overlap/glide/fade/censored input',
            entries: r.spectralEntries.candidates.length, records: r.bandActivity.records, entryContexts: r.entryContexts.records,
            firstErrorSeconds: f.expectedBandEnd === null || first.endSample === null ? null : first.endSample / f.sampleRate - f.expectedBandEnd,
            supportContainsReference: f.expectedBandEnd === null || first.offsetSupportSamples === null ? null
                : first.offsetSupportSamples[0] <= f.expectedBandEnd * f.sampleRate && first.offsetSupportSamples[1] >= f.expectedBandEnd * f.sampleRate });
    }
    const contextControls = [];
    for (const [split, tuples] of Object.entries(ACTIVITY_TUPLES)) for (const tuple of tuples) for (const spec of CONTEXT_SPECS[split]) {
        const hop = split === 'development' ? 512 : 1024, f = contextFixture(spec, tuple, hop), r = activity(f.samples, f.sampleRate, hop);
        contextControls.push({ split, spec, tuple, hopSize: hop, pcmSha256: hash(bytes(f.samples)), sampleCount: f.samples.length,
            physicalAttacksSeconds: f.attacks, rawEntries: r.spectralEntries.candidates, contexts: r.entryContexts.records,
            contextTruthScope: 'measured dominant-bin neighborhood only; occupied does not imply false attack, unoccupied does not imply new source',
            sourceAccuracy: null });
    }
    const attackChangeControls = [];
    for (const [split, tuples] of Object.entries(ACTIVITY_TUPLES)) for (const tuple of tuples) for (const phase of ATTACK_CHANGE_PHASES) {
        const hop = split === 'development' ? 512 : 1024, first = new Map();
        for (const kind of ATTACK_CHANGE_KINDS) {
            const f = attackChangeFixture(kind, tuple, hop, phase), r = activity(f.samples, f.sampleRate, hop), record = r.attackChanges.records[0];
            assert.ok(record); assert.equal(record.status, 'measured');
            const quiet = r.attacks[0].quietOnset;
            assert.ok(quiet); assert.ok(quiet.sampleIndex >= f.startSample && quiet.sampleIndex - f.startSample <= Math.ceil(.002 * f.sampleRate));
            let comparison = null;
            if (!kind.includes('-late-')) first.set(kind, record);
            else {
                const base = first.get(kind.split('-')[0]);
                comparison = base.attackId === record.attackId ? 'same-anchor-exact' : 'legacy-anchor-retargeted';
                if (comparison === 'same-anchor-exact') assert.deepEqual(record, base);
                const { attackId: ignoredCurrentId, ...currentMeasurement } = record;
                const { attackId: ignoredBaseId, ...baseMeasurement } = base;
                assert.deepEqual(currentMeasurement, baseMeasurement, 'All late controls preserve the initial short measurement in v2');
            }
            attackChangeControls.push({ split, tuple, phase, kind, hopSize: hop, pcmSha256: hash(bytes(f.samples)),
                physicalStartSample: f.startSample, laterStartSample: f.laterSample, comparison,
                anchorErrorSamples: r.attacks[0].sampleIndex - f.startSample, legacyFamily: r.attacks[0].family,
                measurement: record, quietOnset: r.attacks[0].quietOnset ?? null, recognitionAccuracy: null });
        }
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
        }] : ['t11b', 't11c', 't11d', 't11e', 't11f', 't11g', 't11h'].includes(mode) ? [{ name: 'retained-activity', load(id) {
            if (id.replaceAll('\\', '/').endsWith('/analyzer/MusicActivity.ts')) return { code: execFileSync('git', ['show', ({ t11b: 'a1a0eaa63f143f9fa374d9c03f89a18f2c4dddb5', t11c: '485ddd0dea789b7d79938ece6d36ea2e80c23e08', t11d: '4fb6ba2e5f0d52c4ef0008aa75e3e4aab9b1a369', t11e: 'ca974e94123eead17dea79f21789ac2f6d2d1f43', t11f: 'd3ec168a39674b480b498ff9f6d5d378eb8e1d3b', t11g: '8f6f39296881c01736c253b7987dc4dfb6314356', t11h: '3ce402b58d77ea935b0d1dce7c6b49bc79a0d1f7' })[mode] + ':src/analyzer/MusicActivity.ts'], { encoding: 'utf8', windowsHide: true }), moduleType: 'ts' };
        } }] : [] });
        try {
            const result = await bundle.generate({ format: 'esm' });
            const module = await import('data:text/javascript;base64,' + Buffer.from(result.output[0].code).toString('base64'));
            return module.analyzeAudio;
        } finally { await bundle.close(); }
    }
    const current = await bundledAnalyzer('current'), legacy = await bundledAnalyzer('legacy'), t11b = await bundledAnalyzer('t11b'), t11c = await bundledAnalyzer('t11c'), t11d = await bundledAnalyzer('t11d'), t11e = await bundledAnalyzer('t11e'), t11f = await bundledAnalyzer('t11f'), t11g = await bundledAnalyzer('t11g'), t11h = await bundledAnalyzer('t11h');
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
        assert.deepEqual(fresh, t11h(input), 'Entire T11h production analysis remains exact; qualification is research only');
        const qualificationStart = performance.now(), qualification = qualifyQuietTonalActivity(samples, layer);
        const researchQualification = { algorithm: qualification.algorithm, status: qualification.status,
            quietCandidates: qualification.records.filter(r => r.sampleIndex !== null),
            noQuietCrossingCount: qualification.records.filter(r => r.sampleIndex === null).length,
            qualified: qualification.records.filter(r => r.verdict === 'qualified').length,
            diagnosticElapsedMs: performance.now() - qualificationStart, groundTruth: null, precision: null, recall: null };
        const retainedG = t11g(input).trackAnalysis.musicActivity;
        const changedShortMeasurements = layer.attackChanges.records.flatMap((r, i) => {
            const before = retainedG.attackChanges.records[i];
            if (JSON.stringify(r) === JSON.stringify(before)) return [];
            assert.ok(layer.attacks[i].quietOnset, 'Only qualified crossings can change v1 measurements');
            return [{ attackId: r.attackId, before, after: r }];
        });
        assert.deepEqual({ ...layer, attackChanges: retainedG.attackChanges }, retainedG, 'Every T11g field except the versioned short measurements remains exact');
        const previousLayer = t11b(input).trackAnalysis.musicActivity, coreLayer = { ...layer, attacks: layer.attacks.map(({ quietOnset, ...a }) => a) };
        coreLayer.attackChanges = retainedG.attackChanges;
        assert.deepEqual(coreLayer, t11f(input).trackAnalysis.musicActivity, 'Entire T11f evidence remains exact');
        delete coreLayer.attackChanges;
        assert.deepEqual(coreLayer, t11e(input).trackAnalysis.musicActivity, 'Entire T11e evidence remains exact');
        delete coreLayer.entryContexts;
        assert.deepEqual(coreLayer, t11d(input).trackAnalysis.musicActivity, 'Entire T11d evidence remains exact');
        delete coreLayer.bandActivity;
        const previousEntryLayer = t11c(input).trackAnalysis.musicActivity;
        assert.deepEqual(coreLayer, previousEntryLayer, 'Entire T11c evidence remains exact');
        delete coreLayer.spectralEntries;
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
        const request = { samples: excerpt, sampleRate: fs }, milliseconds = { t11g: [], t11h: [] };
        t11g(request); current(request);
        for (let i = 0; i < 5; i++) for (const key of i % 2 ? ['t11h', 't11g'] : ['t11g', 't11h']) {
            const start = performance.now(); (key === 't11g' ? t11g : current)(request); milliseconds[key].push(performance.now() - start);
        }
        recorded.push({ file, fileSha256: hash(readFileSync(path)), decodedPcmSha256: decoded, sampleRate: fs, sampleCount: samples.length,
            t11hEntireResultExact: true, researchQualification, legacyExact: true, t11bExact: true, t11cExact: true, t11dExact: true, t11eExact: true, t11fExact: 'except versioned attackChanges', t11gExact: 'except versioned attackChanges', changedShortMeasurements, quietOnsets: layer.attacks.filter(a => a.quietOnset).length,
            attackChanges: Object.fromEntries(['measured', 'below-floor', 'file-boundary', 'insufficient-resolution'].map(status => [status, layer.attackChanges.records.filter(r => r.status === status).length])),
            attackChangePayloadBytes: Buffer.byteLength(JSON.stringify(layer.attackChanges)),
            contexts: Object.fromEntries(['occupied-neighborhood', 'unoccupied-neighborhood', 'uncertain'].map(context => [context, layer.entryContexts.records.filter(r => r.context === context).length])),
            contextPayloadBytes: Buffer.byteLength(JSON.stringify(layer.entryContexts)),
            bandActivity: Object.fromEntries(['quiet-windows', 'file-boundary', 'budget-exceeded'].map(reason => [reason, layer.bandActivity.records.filter(r => r.endReason === reason).length])),
            bandPayloadBytes: Buffer.byteLength(JSON.stringify(layer.bandActivity)), spectralEntries: layer.spectralEntries.candidates.length, activity: layer.activity.length, attacks: layer.attacks.length, dominance: layer.dominance.length,
            payloadBytes: Buffer.byteLength(JSON.stringify(layer)), comparisons, milliseconds,
            medianOverheadPercent: (median(milliseconds.t11h) / median(milliseconds.t11g) - 1) * 100,
            groundTruth: null, accuracy: null });
        console.log(JSON.stringify(recorded.at(-1)));
    }
    for (const [p, digest] of Object.entries(sourceHashes)) assert.equal(hash(readFileSync(p)), digest, 'Source changed during measurement');
    return { protocol: 't11i-quiet-carrier-qualification-1', node: process.version, decoder: execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0],
        sourceHashScope: 'delivery files only; full unchanged dependencies belong to the source commit', sourceHashes, quietTonalStudy, analyzerExecution: 'Vite dependency rolldown ESM bundles; no VM wrapper in elapsed-time comparison', authored, entryControls, bandControls, contextControls, attackChangeControls, periodicity, recorded, modelRerun: false, recordedGroundTruth: null,
        noteSourceVocalRecognition: 'unsupported', performanceScope: 'retained T11g/h offline elapsed comparison only; T11i changes no production DSP; not CPU/FPS/Quest or a T11i overhead measurement' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    if (process.argv.length !== 6 || process.argv[2] !== '--audio-dir' || process.argv[4] !== '--output')
        throw new Error('Use --audio-dir DIRECTORY --output NEW_JSON');
    // Reserve exclusive destination before expensive work; never overwrite retained evidence.
    const fd = (await import('node:fs')).openSync(process.argv[5], 'wx');
    try { writeFileSync(fd, JSON.stringify(await measureMusicActivity(process.argv[3]), null, 2) + '\n'); }
    finally { (await import('node:fs')).closeSync(fd); }
}
