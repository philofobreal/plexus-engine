// Write an existing deterministic analyzer fixture as mono PCM16 WAV for real browser smoke.
// Usage: node scripts/write-audio-smoke-fixture.mjs <new-output.wav> [fixture-id=house-128]
// Uses the existing signal unchanged. Never overwrites a file or a golden; not a music-accuracy
// benchmark, user track or production asset. Keep generated WAVs under ignored logs/.
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GOLDEN_FIXTURES, buildFixtureInput } from '../tests/fixtures/golden-fixtures.mjs';

const [path, id = 'house-128'] = process.argv.slice(2);
if (!path || !path.endsWith('.wav')) throw new Error('A new .wav output path is required');
const fixture = GOLDEN_FIXTURES.find(item => item.id === id);
if (!fixture) throw new Error(`Unknown fixture: ${id}`);
const { samples, sampleRate } = buildFixtureInput(fixture);
const bytes = Buffer.alloc(44 + samples.length * 2);
bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 2, 28);
bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36);
bytes.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++) bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
writeFileSync(path, bytes, { flag: 'wx' });
console.log(JSON.stringify({ path, fixture: id, durationSec: samples.length / sampleRate, sampleRate,
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }));
