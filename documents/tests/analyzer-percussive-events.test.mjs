import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const SRC_ROOT = join(process.cwd(), 'src');
const SAMPLE_RATE = 44_100;
const HOP = 1024;

function createSrcLoader() {
  const moduleCache = new Map();

  function resolvePath(request, parentPath) {
    if (!request.startsWith('.')) throw new Error(`Unsupported import in test loader: ${request}`);
    const base = normalize(join(dirname(parentPath), request));
    if (base.endsWith('.ts')) return base;
    try {
      readFileSync(`${base}.ts`, 'utf8');
      return `${base}.ts`;
    } catch {
      return join(base, 'index.ts');
    }
  }

  function load(filePath) {
    if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;

    const source = readFileSync(filePath, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022
      }
    }).outputText;

    const module = { exports: {} };
    moduleCache.set(filePath, module);
    const context = vm.createContext({
      exports: module.exports,
      module,
      require: (request) => load(resolvePath(request, filePath)),
      Float32Array,
      Math,
      Number,
      Error
    });
    vm.runInContext(transpiled, context, { filename: filePath });
    return module.exports;
  }

  return (entryPath) => load(join(SRC_ROOT, entryPath));
}

function analyze(samples) {
  const { analyzeAudio } = createSrcLoader()('analyzer/analyzeAudio.ts');
  return analyzeAudio({
    samples,
    sampleRate: SAMPLE_RATE,
    options: { hopSize: HOP, requestId: 9001 }
  });
}

function sustainedBassBuffer(durationSec, { fadeInSec = 0.75, amplitude = 0.62 } = {}) {
  const samples = new Float32Array(Math.round(durationSec * SAMPLE_RATE));
  for (let i = 0; i < samples.length; i++) {
    const time = i / SAMPLE_RATE;
    const fade = Math.min(1, time / fadeInSec);
    samples[i] = Math.sin(2 * Math.PI * 80 * time) * amplitude * fade;
  }
  return samples;
}

function emptyBuffer(durationSec) {
  return new Float32Array(Math.round(durationSec * SAMPLE_RATE));
}

function softClip(samples) {
  for (let i = 0; i < samples.length; i++) samples[i] = Math.tanh(samples[i]);
  return samples;
}

function beatTimes({ bpm, durationSec, offsetSec = 0 }) {
  const beats = [];
  const beatSec = 60 / bpm;
  for (let time = offsetSec; time < durationSec - beatSec * 0.25; time += beatSec) {
    beats.push(Number(time.toFixed(6)));
  }
  return beats;
}

function addSidechainedRollingBass(samples, bpm, { frequency = 58, amplitude = 0.58, offsetSec = 0, releaseSec = 0.22 } = {}) {
  const beatSec = 60 / bpm;
  const duckSec = Math.min(0.055, beatSec * 0.18);
  for (let i = 0; i < samples.length; i++) {
    const time = i / SAMPLE_RATE;
    const phase = ((time - offsetSec) % beatSec + beatSec) % beatSec;
    let duck = 1 - Math.exp(-phase / releaseSec);
    if (phase > beatSec - duckSec) {
      const ramp = (beatSec - phase) / duckSec;
      duck = Math.min(duck, ramp * ramp * (3 - 2 * ramp));
    }
    const tone = Math.sin(2 * Math.PI * frequency * time) * 0.78
      + Math.sin(2 * Math.PI * frequency * 2 * time) * 0.22;
    samples[i] += tone * amplitude * (0.18 + duck * 0.82);
  }
}

function addOffbeatBassline(samples, bpm, { frequency = 82, amplitude = 0.62, offsetSec = 0.25 } = {}) {
  const beatSec = 60 / bpm;
  const noteLength = beatSec * 0.44;
  for (let time = offsetSec + beatSec * 0.5; time < samples.length / SAMPLE_RATE; time += beatSec) {
    const start = Math.round(time * SAMPLE_RATE);
    const length = Math.round(noteLength * SAMPLE_RATE);
    for (let i = 0; i < length && start + i < samples.length; i++) {
      const t = (start + i) / SAMPLE_RATE;
      const attack = Math.min(1, i / Math.round(0.16 * SAMPLE_RATE));
      const release = Math.min(1, (length - i) / Math.round(0.09 * SAMPLE_RATE));
      samples[start + i] += Math.sin(2 * Math.PI * frequency * t) * amplitude * attack * release;
    }
  }
}

function addKickBurst(samples, timeSec, { frequency = 78, amplitude = 0.95, decaySec = 0.09 } = {}) {
  const start = Math.round(timeSec * SAMPLE_RATE);
  const length = Math.round(decaySec * 3 * SAMPLE_RATE);
  for (let i = 0; i < length && start + i < samples.length; i++) {
    const time = (start + i) / SAMPLE_RATE;
    const attack = Math.min(1, i / 24);
    const decay = Math.exp(-i / (decaySec * SAMPLE_RATE));
    samples[start + i] += Math.sin(2 * Math.PI * frequency * time) * amplitude * attack * decay;
  }
}

function addTechnoRumbleKick(samples, timeSec) {
  addKickBurst(samples, timeSec, { frequency: 72, amplitude: 1.05, decaySec: 0.08 });
  const start = Math.round((timeSec + 0.035) * SAMPLE_RATE);
  const length = Math.round(0.45 * SAMPLE_RATE);
  for (let i = 0; i < length && start + i < samples.length; i++) {
    const t = (start + i) / SAMPLE_RATE;
    const env = Math.exp(-i / (0.28 * SAMPLE_RATE));
    samples[start + i] += Math.sin(2 * Math.PI * 46 * t) * 0.42 * env;
  }
}

function addHighNoiseBurst(samples, timeSec, { amplitude = 0.78, durationSec = 0.035 } = {}) {
  const start = Math.round(timeSec * SAMPLE_RATE);
  const length = Math.round(durationSec * SAMPLE_RATE);
  let seed = 19;
  for (let i = 0; i < length && start + i < samples.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = (seed / 0xffffffff) * 2 - 1;
    const env = Math.exp(-i / (durationSec * SAMPLE_RATE * 0.45));
    samples[start + i] += noise * amplitude * env;
  }
}

function nearestEvent(events, timeSec) {
  let best = null;
  let bestDistance = Infinity;
  for (const event of events) {
    const distance = Math.abs(event.time - timeSec);
    if (distance < bestDistance) {
      best = event;
      bestDistance = distance;
    }
  }
  return { event: best, distance: bestDistance };
}

function coverage(events, expectedTimes, toleranceSec) {
  let matched = 0;
  for (const expected of expectedTimes) {
    if (events.some(event => Math.abs(event.time - expected) <= toleranceSec)) matched++;
  }
  return expectedTimes.length > 0 ? matched / expectedTimes.length : 1;
}

function assertHitCoverage(events, expectedTimes, minimumCoverage, label) {
  const actual = coverage(events, expectedTimes, 0.095);
  assert.ok(
    actual >= minimumCoverage,
    `${label}: expected coverage >= ${minimumCoverage}, got ${actual}; events=${events.map(event => event.time.toFixed(3)).join(',')}`
  );
}

test('sustained 80Hz bass does not continuously generate BeatEvents', () => {
  const result = analyze(sustainedBassBuffer(6));

  assert.ok(result.events.length <= 1, `expected no continuous bass BeatEvents, got ${result.events.length}`);
});

test('short low-frequency kick attack generates a BeatEvent near the transient', () => {
  const samples = new Float32Array(Math.round(4 * SAMPLE_RATE));
  addKickBurst(samples, 1.5);

  const result = analyze(samples);
  const nearest = nearestEvent(result.events, 1.5);

  assert.ok(nearest.event, 'expected a kick BeatEvent');
  assert.ok(nearest.distance <= 0.08, `expected kick event near attack, got distance ${nearest.distance}`);
  assert.equal(nearest.event.type, 1, 'kick remains public BeatEvent type 1');
});

test('high-mid percussion transient generates an fx or dense BeatEvent', () => {
  const samples = new Float32Array(Math.round(4 * SAMPLE_RATE));
  addHighNoiseBurst(samples, 1.25);

  const result = analyze(samples);
  const nearest = nearestEvent(result.events, 1.25);

  assert.ok(nearest.event, 'expected a high transient BeatEvent');
  assert.ok(nearest.distance <= 0.08, `expected high transient event near attack, got distance ${nearest.distance}`);
  assert.ok([2, 3].includes(nearest.event.type), `expected dense/fx type, got ${nearest.event.type}`);
});

test('bass plus sharp attack is accepted but bass sustain is rejected', () => {
  const sustained = sustainedBassBuffer(6, { fadeInSec: 1.2, amplitude: 0.55 });
  const sustainedOnly = analyze(sustained.slice());
  assert.ok(sustainedOnly.events.length <= 1, `sustain-only bass leaked ${sustainedOnly.events.length} events`);

  const withKick = sustained.slice();
  addKickBurst(withKick, 3.0, { amplitude: 0.82 });
  const result = analyze(withKick);
  const nearest = nearestEvent(result.events, 3.0);
  const unrelated = result.events.filter(event => Math.abs(event.time - 3.0) > 0.18);

  assert.ok(nearest.event, 'expected bass attack BeatEvent');
  assert.ok(nearest.distance <= 0.08, `expected bass attack near 3.0s, got distance ${nearest.distance}`);
  assert.ok(unrelated.length <= 1, `sustained bass should not create extra BeatEvents, got ${unrelated.length}`);
});

test('rolling sidechained bass without drums does not behave like BeatEvents', () => {
  const samples = emptyBuffer(6);
  addSidechainedRollingBass(samples, 128, { offsetSec: 0.2 });
  softClip(samples);

  const result = analyze(samples);

  assert.ok(result.events.length <= 2, `sidechained rolling bass leaked ${result.events.length} BeatEvents`);
});

test('four-on-floor kick plus bass rumble keeps kick timing coverage', () => {
  const bpm = 128;
  const durationSec = 6;
  const offsetSec = 0.22;
  const samples = emptyBuffer(durationSec);
  addSidechainedRollingBass(samples, bpm, { offsetSec, amplitude: 0.24, frequency: 54 });
  const expected = beatTimes({ bpm, durationSec, offsetSec });
  for (const time of expected) addTechnoRumbleKick(samples, time);
  softClip(samples);

  const result = analyze(samples);

  assertHitCoverage(result.events, expected, 0.82, 'four-on-floor rumble kick');
  assert.ok(result.events.length <= expected.length + 3, `rumble tail created too many events: ${result.events.length}`);
});

test('DnB break with ghost hits keeps main drum timing and accepts some ghost transients', () => {
  const bpm = 176;
  const durationSec = 6;
  const offsetSec = 0.12;
  const beatSec = 60 / bpm;
  const sixteenth = beatSec / 4;
  const samples = emptyBuffer(durationSec);
  const mainHits = [];
  const ghostHits = [];
  for (let barStart = offsetSec; barStart < durationSec - beatSec; barStart += beatSec * 4) {
    for (const slot of [0, 4, 12]) {
      const time = barStart + slot * sixteenth;
      mainHits.push(time);
      if (slot === 0) addKickBurst(samples, time, { frequency: 80, amplitude: 0.9, decaySec: 0.07 });
      else addHighNoiseBurst(samples, time, { amplitude: 0.55, durationSec: 0.05 });
    }
    for (const slot of [6, 10, 14]) {
      const time = barStart + slot * sixteenth;
      ghostHits.push(time);
      if (slot === 10) addKickBurst(samples, time, { frequency: 92, amplitude: 0.5, decaySec: 0.045 });
      else addHighNoiseBurst(samples, time, { amplitude: 0.34, durationSec: 0.035 });
    }
  }
  softClip(samples);

  const result = analyze(samples);

  assertHitCoverage(result.events, mainHits, 0.78, 'DnB main hits');
  assert.ok(coverage(result.events, ghostHits, 0.095) >= 0.35, 'expected at least some DnB ghost hits to survive');
});

test('offbeat bassline without drums is not promoted to drum BeatEvents', () => {
  const samples = emptyBuffer(6);
  addOffbeatBassline(samples, 124);
  softClip(samples);

  const result = analyze(samples);

  assert.ok(result.events.length <= 3, `offbeat bassline leaked ${result.events.length} BeatEvents`);
});

test('techno rumble kick accepts kick attacks but not rumble tails', () => {
  const bpm = 140;
  const durationSec = 6;
  const offsetSec = 0.16;
  const samples = emptyBuffer(durationSec);
  const expected = beatTimes({ bpm, durationSec, offsetSec });
  for (const time of expected) addTechnoRumbleKick(samples, time);
  softClip(samples);

  const result = analyze(samples);

  assertHitCoverage(result.events, expected, 0.82, 'techno rumble kick');
  assert.ok(result.events.length <= expected.length + 2, `rumble tails created too many events: ${result.events.length}`);
});
