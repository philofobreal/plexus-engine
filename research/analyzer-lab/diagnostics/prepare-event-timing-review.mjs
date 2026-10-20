// Prepare a real-PCM review artifact; never fabricate human annotation or overwrite a result.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLoader } from '../../../tests/helpers/xr-loader.mjs';

export function prepareTimingReview(bytes, sampleRate, source = {}) {
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length % 4 !== 0) throw new Error('Expected nonempty f32le PCM');
    const samples = new Float32Array(bytes.length / 4);
    for (let i = 0; i < samples.length; i++) samples[i] = bytes.readFloatLE(i * 4);
    const { analyzeAudio } = createLoader({}, { Float32Array, Float64Array })('analyzer/analyzeAudio.ts');
    const baseline = analyzeAudio({ samples, sampleRate });
    const candidate = analyzeAudio({ samples, sampleRate, options: { eventTiming: 'local-band-v2' } });
    return { schemaVersion: 'event-timing-evaluation-input-v1',
        identity: { pcmSha256: createHash('sha256').update(bytes).digest('hex'), sampleRate, sampleCount: samples.length, channel: 0 },
        source, baseline: Array.from(baseline.events, e => ({ ...e })), candidate: Array.from(candidate.events, e => ({ ...e })),
        parameters: { baselineAlgorithmVersion: 7, candidateAlgorithm: candidate.trackAnalysis.eventTiming.algorithm,
            candidatePolicy: 'experimental-opt-in', clock: 'original-channel-0-f32le', annotationTimeOrigin: 'local-PCM-start' },
        candidateReport: candidate.trackAnalysis.eventTiming,
        annotation: { status: 'awaiting-human-review', annotator: '', eventType: 'audible-percussive-onset',
            onsets: [], completeIntervals: [], provenance: '' } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const args = process.argv.slice(2), flags = new Map();
        if (args.length !== 6) throw new Error('Use --pcm CHANNEL0.f32le --sample-rate RATE --output NEW_REVIEW_JSON');
        for (let i = 0; i < args.length; i += 2) {
            if (!['--pcm', '--sample-rate', '--output'].includes(args[i]) || flags.has(args[i]) || !args[i + 1])
                throw new Error('Invalid or duplicate review option');
            flags.set(args[i], args[i + 1]);
        }
        const pcmPath = resolve(flags.get('--pcm')), output = resolve(flags.get('--output'));
        const input = prepareTimingReview(readFileSync(pcmPath), Number(flags.get('--sample-rate')), { pcmPath,
            preparationSourceSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'), nodeVersion: process.version });
        writeFileSync(output, JSON.stringify(input, null, 2) + '\n', { flag: 'wx' });
        console.log(JSON.stringify({ output, status: input.annotation.status, events: input.baseline.length }));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}
