// Historical measurement loader, not production timing or a musical oracle.
// JSON stdin: {root, pcmPath, sampleRate, baselineFeatureExtractor?}; stdout only.
import fs from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';

if (process.argv.includes('--help')) {
  console.log('JSON stdin: {root,pcmPath,sampleRate,baselineFeatureExtractor?}. Read-only TS analyzer replay; no file output.');
} else {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const request = JSON.parse(input);
  if (typeof request.root !== 'string' || typeof request.pcmPath !== 'string' ||
      !Number.isInteger(request.sampleRate) || request.sampleRate <= 0) {
    throw new Error('Explicit root, PCM path and positive integer sampleRate are required');
  }
  const root = resolve(request.root);
  const require = createRequire(join(root, 'package.json'));
  const ts = require('typescript');
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} };
    cache.set(path, module);
    let source = fs.readFileSync(path, 'utf8');
    if (request.baselineFeatureExtractor && path === join(root, 'src/analyzer/FeatureExtractor.ts')) {
      source = fs.readFileSync(resolve(request.baselineFeatureExtractor), 'utf8');
    }
    const code = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, Float32Array, Float64Array, Uint32Array, Math, Number,
      require: name => {
        if (!name.startsWith('.')) throw new Error(`Unsupported analyzer dependency: ${name}`);
        const base = resolve(dirname(path), name);
        return load(fs.existsSync(base) && base.endsWith('.ts') ? base : fs.existsSync(base + '.ts') ? base + '.ts' : join(base, 'index.ts'));
      },
    }, { filename: path });
    return module.exports;
  }
  const bytes = fs.readFileSync(resolve(request.pcmPath));
  if (bytes.byteLength === 0 || bytes.byteLength % 4 !== 0) throw new Error('PCM must be nonempty little-endian float32');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samples = Float32Array.from({ length: bytes.byteLength / 4 }, (_, index) => view.getFloat32(index * 4, true));
  const result = load(join(root, 'src/analyzer/analyzeAudio.ts')).analyzeAudio({ samples, sampleRate: request.sampleRate });
  process.stdout.write(JSON.stringify({ events: result.events, beats: result.beats, bpm: result.bpm,
    barStarts: result.barStarts, timingConfidence: result.timingConfidence,
    sourceAlgorithmVersion: load(join(root, 'src/analyzer/constants.ts')).ANALYSIS_ALGORITHM_VERSION,
    baselineFeatureExtractorSubstituted: Boolean(request.baselineFeatureExtractor),
    percussiveCues: result.trackAnalysis.cues.filter(cue => cue.reasons?.includes('percussive-onset')),
  }));
}
