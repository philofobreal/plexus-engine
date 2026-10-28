// Full-song oracle disagreement study. No production consumer or ground-truth promotion.
// node research/analyzer-lab/diagnostics/compare-full-structure.mjs --manifest INPUT.json --output NEW.json
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

/** Ordered one-to-one match: maximize cardinality, then minimize absolute distance.
 * Starts/ends are excluded by the caller. No greedy reuse of one boundary for two targets.
 */
export function matchBoundaries(a, b, toleranceSec) {
    if (!Number.isFinite(toleranceSec) || toleranceSec < 0 || [a, b].some(xs => !Array.isArray(xs)
        || !Array.from(xs).every((x, i) => Number.isFinite(x) && x >= 0 && (!i || x > xs[i - 1]))))
        throw Error('Expected strictly increasing finite boundaries and nonnegative tolerance');
    const width = b.length + 1, size = (a.length + 1) * width;
    if (size > 2e6) throw Error('Boundary comparison exceeds bounded research matrix');
    const counts = new Uint32Array(size), costs = new Float64Array(size), moves = new Uint8Array(size);
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
        const k = i * width + j, up = k - width, left = k - 1, diagonal = up - 1;
        let best = up, move = 1;
        if (counts[left] > counts[best] || counts[left] === counts[best] && costs[left] < costs[best]) { best = left; move = 2; }
        counts[k] = counts[best]; costs[k] = costs[best]; moves[k] = move;
        const distance = Math.abs(a[i - 1] - b[j - 1]);
        if (distance <= toleranceSec + 1e-9 && (counts[diagonal] + 1 > counts[k]
            || counts[diagonal] + 1 === counts[k] && costs[diagonal] + distance < costs[k])) {
            counts[k] = counts[diagonal] + 1; costs[k] = costs[diagonal] + distance; moves[k] = 3;
        }
    }
    const pairs = [];
    let i = a.length, j = b.length;
    while (i && j) {
        const move = moves[i * width + j];
        if (move === 3) { pairs.push({a: i - 1, b: j - 1, signedDeltaSec: b[j - 1] - a[i - 1]}); i--; j--; }
        else if (move === 1) i--; else j--;
    }
    pairs.reverse();
    const usedA = new Set(pairs.map(p => p.a)), usedB = new Set(pairs.map(p => p.b));
    const precision = a.length ? pairs.length / a.length : null, recall = b.length ? pairs.length / b.length : null;
    return {toleranceSec, countA: a.length, countB: b.length, matched: pairs.length,
        agreementPrecision: precision, agreementRecall: recall,
        agreementF1: precision === null || recall === null ? null : precision + recall ? 2 * precision * recall / (precision + recall) : 0,
        pairs, unmatchedA: a.filter((_, k) => !usedA.has(k)), unmatchedB: b.filter((_, k) => !usedB.has(k))};
}

function sectionsFor(sections, duration, endpointToleranceSec) {
    if (!Array.isArray(sections) || !sections.length || !Array.from(sections).every((s, i) => s
        && Number.isFinite(s.start) && Number.isFinite(s.end) && s.start >= 0 && s.start < duration && s.end > s.start
        && typeof s.label === 'string' && s.label.length && (!i || Math.abs(s.start - sections[i - 1].end) <= 1e-5))
        || sections[0].start !== 0 || Math.abs(sections.at(-1).end - duration) > endpointToleranceSec)
        throw Error('Prediction must cover the full song contiguously on the original clock');
    return sections.map((s, i) => ({start: s.start, end: i === sections.length - 1 ? duration : s.end, label: s.label}));
}
function boundaries(sections, changesOnly = false) {
    return sections.slice(1).filter((s, i) => !changesOnly || s.label !== sections[i].label).map(s => s.start);
}
function labelsOverTime(a, b, comparable) {
    let i = 0, j = 0, exactSeconds = 0, comparableSeconds = 0, unknownSeconds = 0;
    const disagreements = [];
    while (i < a.length && j < b.length) {
        const x = a[i], y = b[j], start = Math.max(x.start, y.start), end = Math.min(x.end, y.end);
        if (end > start) {
            if (comparable.has(x.label) && comparable.has(y.label)) {
                comparableSeconds += end - start;
                if (x.label === y.label) exactSeconds += end - start;
                else disagreements.push({start, end, a: x.label, b: y.label});
            } else unknownSeconds += end - start;
        }
        if (x.end <= y.end) i++;
        if (y.end <= x.end) j++;
    }
    return {exactSeconds, comparableSeconds, unknownSeconds, disagreements,
        exactFractionOnComparableSupport: comparableSeconds ? exactSeconds / comparableSeconds : null};
}

export function compareStructures(source, predictions) {
    if (!source || !Number.isFinite(source.durationSec) || source.durationSec <= 0
        || !/^[a-f0-9]{64}$/.test(source.pcmSha256)) throw Error('Need full song duration and decoded PCM identity');
    const own = sectionsFor(source.sections, source.durationSec, 1e-5), families = new Set();
    if (!Array.isArray(predictions)) throw Error('Need external predictions');
    const oracles = Array.from(predictions, p => {
        if (!p || typeof p.family !== 'string' || !p.family || families.has(p.family)) throw Error('One vote per distinct external model family');
        families.add(p.family);
        if (p.status !== 'complete' || p.pcmSha256 !== source.pcmSha256 || !Number.isFinite(p.durationSec)
            || Math.abs(p.durationSec - source.durationSec) > 1 / 44100)
            throw Error('External prediction is failed, partial or from different PCM');
        return {...p, sections: sectionsFor(p.segments, source.durationSec, .25)};
    });
    if (oracles.length !== 2) throw Error('This study requires exactly two distinct external families');
    const tolerancesSec = [.5, 1, 3], ownBounds = boundaries(own), ownChanges = boundaries(own, true);
    const comparisons = oracles.map(p => ({family: p.family, sections: p.sections,
        rawEndpointDeltaSec: p.segments.at(-1).end - source.durationSec,
        allBoundaries: tolerancesSec.map(t => matchBoundaries(ownBounds, boundaries(p.sections), t)),
        labelChanges: tolerancesSec.map(t => matchBoundaries(ownChanges, boundaries(p.sections, true), t)),
        // Literal spellings only, not a shared ontology. Never map chorus/bridge to drop/build/break.
        literalLabelAgreement: labelsOverTime(own, p.sections, new Set(['intro', 'outro', 'verse', 'break']))}));
    const external = tolerancesSec.map(t => matchBoundaries(boundaries(oracles[0].sections), boundaries(oracles[1].sections), t));
    const consensusToleranceSec = 1;
    const agreement = external.find(x => x.toleranceSec === consensusToleranceSec);
    const a = boundaries(oracles[0].sections), b = boundaries(oracles[1].sections);
    const consensusFor = (a, b, pairs) => pairs.map(p => ({time: (a[p.a] + b[p.b]) / 2,
        contributors: [{family: oracles[0].family, time: a[p.a]}, {family: oracles[1].family, time: b[p.b]}],
        diameterSec: Math.abs(p.signedDeltaSec), confidence: null, evidenceType: 'pseudo_label', groundTruthStatus: false}));
    const consensus = consensusFor(a, b, agreement.pairs);
    const functionA = boundaries(oracles[0].sections, true), functionB = boundaries(oracles[1].sections, true);
    const externalFunctionAgreement = tolerancesSec.map(t => matchBoundaries(functionA, functionB, t));
    const functionalConsensus = consensusFor(functionA, functionB,
        externalFunctionAgreement.find(x => x.toleranceSec === consensusToleranceSec).pairs);
    const metricalAgreement = oracles.map(p => ({family: p.family,
        beats: Array.isArray(source.beats) && Array.isArray(p.beats)
            ? [.07, .15].map(t => matchBoundaries(source.beats, p.beats, t)) : null,
        downbeats: Array.isArray(source.barStarts) && Array.isArray(p.downbeats)
            ? [.15, .5].map(t => matchBoundaries(source.barStarts, p.downbeats, t)) : null,
        scope: 'Supplemental single-provider grid agreement; unsupported capability is null, not empty evidence'}));
    let automationSceneEntries = null;
    if (source.performancePlan !== undefined) {
        if (!Array.isArray(source.performancePlan?.points)) throw Error('Malformed automation plan');
        const entries = source.performancePlan.points.filter(p => p.cuePlacement?.role === 'scene-entry'
            && p.reason !== 'manual' && p.time > 0 && p.time < source.durationSec);
        const times = field => {
            const values = entries.map(field);
            if (values.some(x => !Number.isFinite(x) || x < 0 || x >= source.durationSec)) return null;
            return [...new Set(values)].sort((a, b) => a - b);
        };
        const published = times(p => p.time), planned = times(p => p.cueAnchor?.plannedTime);
        const reference = consensus.map(c => c.time);
        const functions = functionalConsensus.map(c => c.time);
        automationSceneEntries = {points: entries.length, planned, published,
            plannedAgreement: planned ? tolerancesSec.map(t => matchBoundaries(planned, reference, t)) : null,
            publishedAgreement: published ? tolerancesSec.map(t => matchBoundaries(published, reference, t)) : null,
            plannedFunctionAgreement: planned ? tolerancesSec.map(t => matchBoundaries(planned, functions, t)) : null,
            publishedFunctionAgreement: published ? tolerancesSec.map(t => matchBoundaries(published, functions, t)) : null,
            scope: 'Generated scene-entry cohort only; internal structure/evolution cues are not macrosection targets. Numeric cue time, not perceptual particle arrival.'};
    }
    return {version: 1, durationSec: source.durationSec, pcmSha256: source.pcmSha256,
        groundTruthStatus: false, sourceSections: own, sourceBoundaryCount: ownBounds.length,
        sourceFunctionChangeCount: ownChanges.length, tolerancesSec, comparisons,
        externalAgreement: external, externalLiteralLabels: labelsOverTime(oracles[0].sections, oracles[1].sections,
            new Set(oracles.flatMap(p => p.sections.map(s => s.label)))),
        consensusToleranceSec, consensus, externalFunctionAgreement, functionalConsensus, metricalAgreement, automationSceneEntries,
        sourceVsConsensus: tolerancesSec.map(t => matchBoundaries(ownBounds, consensus.map(c => c.time), t)),
        sourceFunctionVsConsensus: tolerancesSec.map(t => matchBoundaries(ownChanges, functionalConsensus.map(c => c.time), t)),
        limitations: ['agreement is not accuracy', 'no ground truth or calibrated confidence',
            'matched-only time errors do not describe unmatched boundaries',
            'allinone ensemble folds are one family', 'shared genre/dataset and related boundary-decoder bias may remain',
            'drop/peak/build taxonomy has no automatic chorus/bridge correspondence',
            'no runtime or clock modification']};
}

function main() {
    const arg = name => process.argv[process.argv.indexOf(name) + 1];
    if (!process.argv.includes('--manifest') || !process.argv.includes('--output')) throw Error('Need --manifest INPUT --output NEW');
    const manifest = JSON.parse(fs.readFileSync(arg('--manifest'), 'utf8'));
    const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
    const results = manifest.recordings.map(recording => {
        const capture = read(recording.capture);
        const predictions = recording.oracles.map(o => {
            const report = read(o.path), track = report.tracks[o.index];
            return {...track, family: report.family, status: report.status === 'complete' ? track.status : 'failed'};
        });
        return {name: recording.name, ...compareStructures({pcmSha256: capture.pcmSha256,
            durationSec: capture.source.durationSec, sections: capture.source.sections,
            beats: capture.source.beats, barStarts: capture.source.barStarts,
            performancePlan: capture.source.performancePlan}, predictions)};
    });
    const paths = [...new Set(manifest.recordings.flatMap(r => [r.capture, ...r.oracles.map(o => o.path)]))];
    const hashes = paths.map(path => ({path, sha256: createHash('sha256').update(fs.readFileSync(path)).digest('hex')}));
    const observerSha256 = createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex');
    fs.writeFileSync(arg('--output'), JSON.stringify({observerSha256, manifest, hashes, results}, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify(results.map(r => ({name: r.name, sections: r.sourceSections.length,
        oracleSections: r.comparisons.map(x => [x.family, x.sections.length]),
        sharedExternalBoundaries: r.consensus.length, sourceVsConsensus: r.sourceVsConsensus.map(x => ({t: x.toleranceSec, matched: x.matched, own: x.countA, external: x.countB}))}))));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
