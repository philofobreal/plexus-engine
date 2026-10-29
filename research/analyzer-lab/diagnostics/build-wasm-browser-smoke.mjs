// Reproduce the smoke against the actual built worker/asset, without Vite's dev module graph.
// After npm run build: node THIS_FILE NEW_HOST_DIRECTORY [LOCAL_MP3]
// Serve NEW_HOST_DIRECTORY on loopback, open /plexus-engine/analyzer-backend-smoke.html.
import fs from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const [outputArg, audio] = process.argv.slice(2);
if (!outputArg || process.argv.length > 4) throw Error('Expected NEW_HOST_DIRECTORY [LOCAL_MP3]');
const output = resolve(outputArg);
if (fs.existsSync(output)) throw Error('Exclusive new host directory required');
const site = join(output, 'plexus-engine'), assets = fs.readdirSync('dist/assets');
const worker = assets.find(p => /^analyzer\.worker-.*\.js$/.test(p)), wasm = assets.find(p => /^fft\.scalar-.*\.wasm$/.test(p));
if (!worker || !wasm) throw Error('Build production worker and WASM first');
fs.mkdirSync(output, { recursive: true }); fs.cpSync('dist', site, { recursive: true, errorOnExist: true });
let html = fs.readFileSync('tests/browser/analyzer-backend-smoke.html', 'utf8');
const replace = (from, to) => { if (html.split(from).length !== 2) throw Error('Fixture source changed: ' + from); html = html.replace(from, to); };
replace("import AnalyzerWorker from '../../src/audio/analyzer.worker.ts?worker';", `const workerURL='/plexus-engine/assets/${worker}';const AnalyzerWorker=class extends Worker{constructor(){super(workerURL)}};`);
replace("import workerURL from '../../src/audio/analyzer.worker.ts?worker&url';", '');
replace("import wasmURL from '../../src/analyzer/math/fft.scalar.wasm?url&no-inline';", `const wasmURL='/plexus-engine/assets/${wasm}';`);
replace("import {analyzeAudio} from '../../src/analyzer/analyzeAudio.ts';", '');
replace('analyzeAudio({samples,sampleRate,options:{requestId:0,algorithmVersion:7,phraseSize:8,rhythmOnsets:true}})', "(await run(samples,sampleRate,'typescript')).result");
let pcm;
if (audio) {
    pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', resolve(audio), '-af', 'pan=mono|c0=c0', '-ar', '44100', '-f', 'f32le', 'pipe:1'], { windowsHide: true, maxBuffer: 256 * 1024 ** 2 });
    fs.writeFileSync(join(site, 'input.f32le'), pcm, { flag: 'wx' });
    replace(" const file=document.querySelector('#file').files[0];check(file,'Choose a local audio file first');status.textContent='Decoding recording...';\n const context=new AudioContext();let decoded;try{decoded=await context.decodeAudioData(await file.arrayBuffer())}finally{await context.close()}\n const samples=decoded.getChannelData(0),sampleRate=decoded.sampleRate,observations=[];let expected;",
        ` const file={name:${JSON.stringify(basename(audio))}};status.textContent='Loading local reference PCM...';\n const samples=new Float32Array(await(await fetch('/plexus-engine/input.f32le')).arrayBuffer()),sampleRate=44100,decoded={duration:samples.length/sampleRate},observations=[];let expected;`);
}
fs.writeFileSync(join(site, 'analyzer-backend-smoke.html'), html, { flag: 'wx' });
const sha = b => createHash('sha256').update(b).digest('hex');
const receipt = { kind: 'T18 built-worker smoke host', worker, wasm, workerSha256: sha(fs.readFileSync('dist/assets/' + worker)), wasmSha256: sha(fs.readFileSync('dist/assets/' + wasm)),
    fixtureSha256: sha(fs.readFileSync('tests/browser/analyzer-backend-smoke.html')), generatedHtmlSha256: sha(Buffer.from(html)), pcmSha256: pcm ? sha(pcm) : null,
    note: 'Generated local validation host only; optional first-channel44.1kHz PCM is excluded from source control and deployment.' };
fs.writeFileSync(join(output, 'host-receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipt));
