// Research-only Node bridge. Uses the repository's existing TypeScript package
// and the same CommonJS/vm loading strategy as analyzer-parity.test.mjs.
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const analyzerRoot = join(root, 'src/analyzer');
const cache = new Map();
function load(file) {
  const boundary = relative(analyzerRoot, file);
  if (boundary.startsWith('..') || isAbsolute(boundary)) throw new Error(`Forbidden runtime import: ${file}`);
  if (cache.has(file)) return cache.get(file).exports;
  const source = readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  cache.set(file, module);
  vm.runInNewContext(code, {
    module, exports: module.exports, Float32Array, Math, Number, Error,
    require(request) {
      if (!request.startsWith('.')) throw new Error(`Forbidden external import: ${request}`);
      const base = resolve(dirname(file), request);
      let target = base.endsWith('.ts') ? base : `${base}.ts`;
      try { statSync(target); } catch { target = join(base, 'index.ts'); }
      return load(target);
    }
  }, { filename: file });
  return module.exports;
}

try {
  if (process.argv.includes('--doctor')) {
    const { ANALYSIS_ALGORITHM_VERSION } = load(join(analyzerRoot, 'constants.ts'));
    const { analyzeAudio } = load(join(analyzerRoot, 'analyzeAudio.ts'));
    if (typeof analyzeAudio !== 'function') throw new Error('Missing analyzeAudio');
    process.stdout.write(JSON.stringify({ node: process.version, typescript: ts.version,
      algorithmVersion: ANALYSIS_ALGORITHM_VERSION }));
  } else {
    // Single request JSON on stdin: {pcmPath,sampleRate,options}. PCM is mono f32le.
    const input = JSON.parse(readFileSync(0, 'utf8'));
    if (!Number.isInteger(input.sampleRate) || input.sampleRate <= 0) throw new Error('Invalid sample rate');
    const options = input.options || {};
    for (const key of Object.keys(options)) {
      if (!['hopSize', 'requestId', 'algorithmVersion', 'phraseSize'].includes(key)) throw new Error(`Unknown analyzer option: ${key}`);
      if (!Number.isInteger(options[key]) || options[key] < (key === 'requestId' ? 0 : 1)) throw new Error(`Invalid analyzer option: ${key}`);
    }
    const bytes = readFileSync(input.pcmPath);
    if (bytes.length === 0 || bytes.length % 4) throw new Error('Invalid Float32 PCM byte length');
    const samples = new Float32Array(bytes.length / 4);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = bytes.readFloatLE(i * 4);
      if (!Number.isFinite(samples[i])) throw new Error('Non-finite PCM');
    }
    const { analyzeAudio } = load(join(analyzerRoot, 'analyzeAudio.ts'));
    process.stdout.write(JSON.stringify(analyzeAudio({ samples, sampleRate: input.sampleRate, options })));
  }
} catch (error) {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
}
