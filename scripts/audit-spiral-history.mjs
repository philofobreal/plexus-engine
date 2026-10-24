// T04b signed-channel reproduction. Run from the project root:
// node scripts/audit-spiral-history.mjs <retained-T04a-WormholeCanvasSource.ts> <output.json>
// The retained source is an input artifact, never rewritten. Current dependencies intentionally
// isolate the morph/history change; this is not a replay of an entire historical release bundle.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { createLoader } from '../tests/helpers/xr-loader.mjs';
const [retained, output] = process.argv.slice(2);
if (!retained || !output) throw Error('Expected retained source input and output JSON paths');
const bytes = readFileSync(retained);
const sha = b => createHash('sha256').update(b).digest('hex');
class Identity {
    constructor(state) { this.state = state; this.routeFocus = { x: 0, y: 0 }; this.frameDrive = { travel: 0, travelRate: 0, hue: 0 }; }
    setStageClock() {} setMaterialSink() {} setLineSink() {} setDepthCue() {} setDepthLayers() {} syncPosition() {}
    draw() { this.frameDrive.spiralTurns = this.state.visualTuning.wormholeSpiral * this.state.visualTuning.wormholeSpiralDirection; }
}
class Backend {
    constructor(w, h) { this.canvas = { width: w, height: h }; this.width = w; this.height = h; this.frameCount = 0; }
    background() {}
}
const stubs = { './CosmicWormholeIdentity': { CosmicWormholeIdentity: Identity }, './Canvas2DRendererBackend': { Canvas2DRendererBackend: Backend },
    '../config/featureFlags': { featureFlags: { semanticResolver: false, semanticChoreography: false } } };
const globals = { fetch: async () => ({ ok: true, json: async () => ({ visualMode: 'cosmic-wormhole', visualTuning: { wormholeSpiral: 2, transitionSpeed: .005 } }) }), performance: { now: () => 0 } };
const load = createLoader(stubs, globals);
const oldModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(bytes.toString('utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    .replaceAll('import.meta.env.BASE_URL', "'/plexus-engine/'"), { ...globals, module: oldModule, exports: oldModule.exports,
    require: request => {
        if (Object.hasOwn(stubs, request)) return stubs[request];
        const base = resolve('src/visuals', request);
        return load(existsSync(base + '.ts') ? base + '.ts' : base + '/index.ts');
    } }, { filename: retained });
const { createEmptyTrackAnalysis } = load('analyzer/normalizeAnalysisResult.ts');
async function run(Source, fps) {
    const points = [0, 2].map((time, i) => ({ id: 'p' + i, time, sectionId: 's', preset: 'fixed.json', confidence: 1, intensity: 1,
        reason: 'build', morphDurationSec: 2, morphCurve: 'linear', spiralDirection: i ? -1 : 1 }));
    const make = async () => {
        const source = new Source(); source.setPresentation({ macros: { intensity: .5, motion: .5, depth: .5, detail: .5 }, grainMaterial: { wormholeSpiral: .5 }, maxFrameRateHz: 120 });
        await source.prepare({ frames: [], events: [], sampleRate: 44100, hopSize: 1024, bpm: 120, duration: 10, trackAnalysis: createEmptyTrackAnalysis(),
            performancePlan: { version: 1, source: 'auto', points } }); return source;
    };
    const live = await make(); for (let frame = 0; frame <= 2.5 * fps; frame++) live.render(frame / fps, true, true);
    const liveValue = live.spatialFrame.spiralTurns;
    const direct = await make(); direct.render(2.5, false);
    live.render(8, false); live.render(2.5, false);
    const result = { fps, live: liveValue, directSeek: direct.spatialFrame.spiralTurns, backwardSeek: live.spatialFrame.spiralTurns };
    live.dispose(); direct.dispose(); return result;
}
const before = await run(oldModule.exports.WormholeCanvasSource, 30);
const { WormholeCanvasSource } = load('visuals/WormholeCanvasSource.ts');
const after = []; for (const fps of [24, 36, 60]) after.push(await run(WormholeCanvasSource, fps));
const maxError = Math.max(...after.flatMap(row => [Math.abs(row.live - row.directSeek), Math.abs(row.backwardSeek - row.directSeek)]));
const report = { task: 'T04b', songTime: 2.5, retainedSource: retained, retainedSha256: sha(bytes), currentSourceSha256: sha(readFileSync('src/visuals/WormholeCanvasSource.ts')),
    method: 'Actual source with recording identity; same immutable fixture, explicit song time, neutral gains. Retained source + current dependencies isolate the history bug; not full historical bundle/pixels.', before, after, maxError, pass: maxError < 1e-10 };
writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
