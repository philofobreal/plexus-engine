import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { fakeDocument, findAll } from './helpers/fake-dom.mjs';

const settingsModule = () => createLoader()('xr/XrBackgroundSettings.ts');

// Authored by the user on 2026-10-16.
const AUTHORED_GRAIN = { amount: 0.3, detail: 1, bloom: 1, weave: 1, spiral: 0.3, arms: 1, density: 1 };
const AUTHORED_GRAIN_BOOSTS = { wormholeNebulaAmount: 0.3, wormholeNebulaDetail: 1, wormholeNebulaBloom: 1, wormholeNebulaWeave: 1, wormholeSpiral: 0.3, wormholeSpiralArms: 1, wormholeGrainDensity: 1 };
const AUTHORED_DEFAULTS = { wormhole: true, quality: 'max', rateHz: 36, distanceMeters: 200, spatialField: 'particles', lineStroke: 0.3, sharpness: 1, character: { intensity: 1, motion: 1, depth: 0.3, detail: 1 },
    grain: AUTHORED_GRAIN };
/** The pre-Addendum-T presentation, for tests about pacing rather than defaults. */
const BALANCED_24 = { wormhole: true, quality: 'balanced', rateHz: 24, lineStroke: 0.98, sharpness: 0.5, character: { intensity: 1, motion: 1, depth: 0.3, detail: 1 } };

test('background settings default to the authored values: Wormhole on, Max raster, 36 Hz, 200 m, Line stroke 30, full sharpening', () => {
    const { DEFAULT_XR_BACKGROUND_SETTINGS, XR_BACKGROUND_RESOLUTION, normalizeBackgroundSettings } = settingsModule();
    const { XR_WORMHOLE_BOOSTS, XR_WORMHOLE_MACROS } = createLoader()('config/xrWormholeTuning.ts');
    assert.equal(JSON.stringify(DEFAULT_XR_BACKGROUND_SETTINGS), JSON.stringify(AUTHORED_DEFAULTS));
    assert.equal(DEFAULT_XR_BACKGROUND_SETTINGS.lineStroke, XR_WORMHOLE_BOOSTS.lineWeight, 'one authored Line stroke');
    assert.equal(JSON.stringify(DEFAULT_XR_BACKGROUND_SETTINGS.character), JSON.stringify(XR_WORMHOLE_MACROS), 'one authored Visual character');
    assert.equal(JSON.stringify(XR_BACKGROUND_RESOLUTION.ultra), JSON.stringify({ width: 1280, height: 720 }));
    assert.equal(JSON.stringify(XR_BACKGROUND_RESOLUTION.balanced), JSON.stringify({ width: 768, height: 432 }));
    assert.equal(JSON.stringify(normalizeBackgroundSettings({ quality: 'extreme', rateHz: 30, lineStroke: 'x' })), JSON.stringify(AUTHORED_DEFAULTS));
    assert.equal(normalizeBackgroundSettings({ wormhole: false }).wormhole, false, 'an explicit off is kept');
    assert.equal(normalizeBackgroundSettings({ lineStroke: 7 }).lineStroke, 1, 'clamped');
    assert.equal(normalizeBackgroundSettings({ lineStroke: -2 }).lineStroke, 0);
    assert.equal(normalizeBackgroundSettings({ lineStroke: Number.NaN }).lineStroke, 0.3, 'invalid -> the authored default');
});

test('frame divider lands every redraw on a whole display frame and never exceeds the requested rate', () => {
    const { backgroundFrameDivider } = settingsModule();
    assert.equal(backgroundFrameDivider(72, 24), 3);
    assert.equal(backgroundFrameDivider(72, 36), 2);
    assert.equal(backgroundFrameDivider(90, 24), 4);
    assert.equal(backgroundFrameDivider(60, 24), 3);
    assert.equal(backgroundFrameDivider(120, 36), 4);
    assert.equal(backgroundFrameDivider(0, 24), 1);
    assert.equal(backgroundFrameDivider(72, Number.NaN), 1);
});

function sceneHarness() {
    const context = { clearRect() {}, fillRect() {}, fillText() {}, measureText: () => ({ width: 0 }) };
    const load = createLoader({ three: THREE }, { document: { createElement: () => ({ getContext: () => context }) } });
    const sources = [];
    const scene = new (load('xr/scene/RhythmGameScene.ts').RhythmGameScene)(new THREE.Scene(), undefined, options => {
        const source = { options, presentations: [], renders: [], disposed: false, canvas: { width: options?.width ?? 1, height: options?.height ?? 1 },
            async prepare() {}, render(time, playing) { this.renders.push([time, playing]); return true; },
            setPresentation(p) { this.presentations.push({ ...p }); }, dispose() { this.disposed = true; } };
        sources.push(source);
        return source;
    });
    const snapshot = state => ({ state, score: 0, combo: 0, maxCombo: 0, hitCount: 0, missCount: 0, totalNotes: 0 });
    return { scene, sources, snapshot };
}

test('the scene starts with the authored background: Max raster, 36 Hz on a whole frame phase, Line stroke 30', async () => {
    const { scene, sources, snapshot } = sceneHarness();
    await scene.setWormholeEnabled(true);
    const source = sources[0];
    assert.equal(JSON.stringify(source.options), JSON.stringify({ width: 2560, height: 1440 }));
    scene.setDisplayFrameRate(72);
    assert.equal(JSON.stringify(source.presentations.at(-1)), JSON.stringify({ lineStroke: 0.3, maxFrameRateHz: 36, macros: AUTHORED_DEFAULTS.character,
        grainMaterial: AUTHORED_GRAIN_BOOSTS }));
    for (let i = 0; i < 72; i++) scene.update([], i / 72, snapshot('playing'), '');
    assert.equal(source.renders.length, 36, '72 Hz / divider 2');
    scene.dispose();
});

test('playing redraws are paced on a fixed headset frame phase; paused frames always reach the source', async () => {
    const { scene, sources, snapshot } = sceneHarness();
    await scene.setBackgroundSettings(BALANCED_24);
    await scene.setWormholeEnabled(true);
    const source = sources[0];
    assert.equal(JSON.stringify(source.options), JSON.stringify({ width: 768, height: 432 }));
    assert.equal(JSON.stringify(source.presentations.at(-1)), JSON.stringify({ lineStroke: 0.98, maxFrameRateHz: 20, macros: { intensity: 1, motion: 1, depth: 0.3, detail: 1 } }),
        'desktop 60 Hz / divider 3: the source learns the effective rate');
    scene.setDisplayFrameRate(72);
    assert.equal(JSON.stringify(source.presentations.at(-1)), JSON.stringify({ lineStroke: 0.98, maxFrameRateHz: 24, macros: { intensity: 1, motion: 1, depth: 0.3, detail: 1 } }));
    for (let i = 0; i < 72; i++) scene.update([], i / 72, snapshot('playing'), '');
    assert.equal(source.renders.length, 24);
    assert.ok(source.renders.every(([time], k) => Math.abs(time - k * 3 / 72) < 1e-9), 'every third frame, same phase');
    source.renders.length = 0;
    for (let i = 0; i < 5; i++) scene.update([], 1 + i, snapshot('paused'), '');
    assert.equal(source.renders.length, 5, 'pause/seek frames are never skipped by the pacing');
    await scene.setBackgroundSettings({ quality: 'balanced', rateHz: 36, lineStroke: 0.5 });
    assert.equal(sources.length, 1, 'rate and Line stroke apply in place');
    assert.equal(JSON.stringify(source.presentations.at(-1)), JSON.stringify({ lineStroke: 0.5, maxFrameRateHz: 36 }));
    source.renders.length = 0;
    for (let i = 0; i < 72; i++) scene.update([], 10 + i / 72, snapshot('playing'), '');
    assert.equal(source.renders.length, 36);
    scene.dispose();
});

test('a quality change rebuilds the single background plane at the new raster size and re-prepares it', async () => {
    const { scene, sources } = sceneHarness();
    await scene.setBackgroundSettings({ quality: 'high', rateHz: 24, lineStroke: 1 });
    assert.equal(sources.length, 0, 'no allocation while the background is off');
    await scene.setWormholeEnabled(true);
    assert.equal(JSON.stringify(sources[0].options), JSON.stringify({ width: 960, height: 540 }));
    const planes = scene.root.children.length;
    await scene.setBackgroundSettings({ quality: 'performance', rateHz: 24, lineStroke: 1 });
    assert.equal(sources.length, 2); assert.ok(sources[0].disposed);
    assert.equal(JSON.stringify(sources[1].options), JSON.stringify({ width: 640, height: 360 }));
    assert.equal(scene.root.children.length, planes, 'the old plane is replaced, not stacked');
    assert.equal(scene.root.children.at(-1).children.length, 0, 'one plane, no stereo layers');
    scene.dispose();
});

test('Crystal, Max and 4K rasters are offered and persisted; Max and 4K use mipmaps', async () => {
    const { XR_BACKGROUND_RESOLUTION, XR_BACKGROUND_QUALITIES, XR_BACKGROUND_MIPMAPPED, normalizeBackgroundSettings, DEFAULT_XR_BACKGROUND_SETTINGS } = settingsModule();
    assert.equal(JSON.stringify(XR_BACKGROUND_RESOLUTION.crystal), JSON.stringify({ width: 1920, height: 1080 }));
    assert.equal(JSON.stringify(XR_BACKGROUND_RESOLUTION.max), JSON.stringify({ width: 2560, height: 1440 }));
    assert.equal(JSON.stringify(XR_BACKGROUND_RESOLUTION['4k']), JSON.stringify({ width: 3840, height: 2160 }));
    assert.equal(XR_BACKGROUND_QUALITIES.join(), 'performance,balanced,high,ultra,crystal,max,4k');
    assert.equal([...XR_BACKGROUND_MIPMAPPED].join(), 'max,4k', 'dense rasters are minified off axis');
    for (const quality of ['crystal', 'max', '4k']) assert.equal(normalizeBackgroundSettings({ quality }).quality, quality, 'a saved choice survives');
    assert.equal(DEFAULT_XR_BACKGROUND_SETTINGS.quality, 'max');
    const { XR_SETTINGS, DEFAULT_XR_SETTINGS, changeScope } = createLoader()('xr/XrSettings.ts');
    const quality = XR_SETTINGS.find(d => d.id === 'quality');
    assert.equal(quality.choices.map(c => c.label).join(), 'Performance,Balanced,High,Ultra,Crystal,Max,4K');
    assert.match(quality.choices.at(-3).hint, /1920 x 1080/);
    assert.match(quality.choices.at(-2).hint, /2560 x 1440.*mipmapped/);
    assert.match(quality.choices.at(-1).hint, /3840 x 2160.*mipmapped/);
    const max = quality.write(DEFAULT_XR_SETTINGS, '4k');
    assert.equal(max.background.quality, '4k');
    assert.equal(changeScope(DEFAULT_XR_SETTINGS, max), 'presentation', 'no regeneration, no rewind');
    // Each change rebuilds the one plane; Max and 4K filter their textures through mipmaps.
    const { scene, sources } = sceneHarness();
    const planeMap = () => scene.root.children.find(c => c.material?.customProgramCacheKey?.() === 'wormhole-sharpen').material.map;
    await scene.setBackgroundSettings({ quality: 'ultra', rateHz: 24, lineStroke: 1, sharpness: 1 });
    await scene.setWormholeEnabled(true);
    assert.deepEqual([planeMap().generateMipmaps, planeMap().minFilter], [false, THREE.LinearFilter]);
    await scene.setBackgroundSettings({ quality: 'crystal', rateHz: 24, lineStroke: 1, sharpness: 1 });
    assert.equal(sources.length, 2); assert.ok(sources[0].disposed);
    assert.equal(JSON.stringify(sources[1].options), JSON.stringify({ width: 1920, height: 1080 }));
    assert.deepEqual([planeMap().generateMipmaps, planeMap().minFilter], [false, THREE.LinearFilter]);
    await scene.setBackgroundSettings({ quality: 'max', rateHz: 24, lineStroke: 1, sharpness: 1 });
    assert.equal(JSON.stringify(sources[2].options), JSON.stringify({ width: 2560, height: 1440 }));
    assert.deepEqual([planeMap().generateMipmaps, planeMap().minFilter], [true, THREE.LinearMipmapLinearFilter]);
    await scene.setBackgroundSettings({ quality: '4k', rateHz: 36, lineStroke: 1, sharpness: 1 });
    assert.equal(JSON.stringify(sources[3].options), JSON.stringify({ width: 3840, height: 2160 }));
    assert.ok(sources[2].disposed);
    assert.deepEqual([planeMap().generateMipmaps, planeMap().minFilter], [true, THREE.LinearMipmapLinearFilter]);
    scene.dispose();
});

test('adaptive pacing (opt-in) widens a late off-thread background to whole frames that fit, never above the requested rate', async () => {
    const { scene, sources, snapshot } = sceneHarness();
    await scene.setBackgroundSettings({ quality: 'ultra', rateHz: 36, lineStroke: 0.34, sharpness: 1 });
    await scene.setWormholeEnabled(true);
    scene.setDisplayFrameRate(72);
    const source = sources[0];
    const rendersOver = (from, frames) => { source.renders.length = 0; for (let i = 0; i < frames; i++) scene.update([], from + i / 72, snapshot('playing'), ''); return source.renders.length; };
    // Fixed pacing (the default): the requested divider whatever the latency.
    source.frameLatencyMs = 31;
    assert.equal(rendersOver(-2, 72), 36, 'fixed: a late frame simply waits for the next redraw');
    assert.equal(scene.backgroundPacedHz, 36);
    scene.setAdaptivePacing(true);
    source.frameLatencyMs = 0;
    assert.equal(rendersOver(0, 72), 36, '36 Hz while the latency is unknown');
    source.frameLatencyMs = 20;
    assert.equal(rendersOver(1, 72), 36, 'a frame that fits one 27.8 ms interval keeps 36 Hz');
    assert.equal(scene.backgroundPacedHz, 36);
    // 31 ms misses the 27.8 ms interval: instead of every second interval (18 Hz) the cadence widens to 3 frames.
    source.frameLatencyMs = 31;
    assert.equal(rendersOver(2, 72), 24);
    assert.equal(scene.backgroundPacedHz, 24); assert.equal(scene.backgroundLatencyMs, 31);
    source.frameLatencyMs = 50;
    assert.equal(rendersOver(3, 72), 18, '4 frames when 3 do not fit');
    // Narrowing needs a clear margin (no flapping around a boundary).
    source.frameLatencyMs = 39;
    assert.equal(rendersOver(4, 72), 18, '39 ms fits 41.7 ms only without headroom: stays at 4 frames');
    source.frameLatencyMs = 30;
    assert.equal(rendersOver(5, 72), 24);
    source.frameLatencyMs = 5;
    assert.equal(rendersOver(6, 72), 36, 'never faster than the requested 36 Hz');
    // A rate change restarts from the requested divider.
    source.frameLatencyMs = 31;
    await scene.setBackgroundSettings({ quality: 'ultra', rateHz: 24, lineStroke: 0.34, sharpness: 1 });
    assert.equal(rendersOver(7, 72), 24, '24 Hz requested: 31 ms already fits');
    // Switching back to fixed restores the requested divider at once.
    await scene.setBackgroundSettings({ quality: 'ultra', rateHz: 36, lineStroke: 0.34, sharpness: 1 });
    source.frameLatencyMs = 50;
    assert.equal(rendersOver(8, 72), 18);
    scene.setAdaptivePacing(false);
    assert.equal(rendersOver(9, 72), 36);
    scene.dispose();
});

test('Line stroke follows the MVP Advanced slider semantics and redraws even while steadily paused', async () => {
    const canvases = [];
    class Backend { constructor(width, height) { this.canvas = { width, height }; this.frameCount = 0; canvases.push(this); } background() {} }
    class Identity { constructor(state) { this.state = state; this.frameDrive = { travel: 0, travelRate: 0, hue: 0 }; } syncPosition() {} setDepthCue() {} setDepthLayers() {} draw() {} }
    const load = createLoader({
        './Canvas2DRendererBackend': { Canvas2DRendererBackend: Backend },
        './CosmicWormholeIdentity': { CosmicWormholeIdentity: Identity }
    }, { fetch: async () => ({ ok: true, json: async () => ({}) }) });
    const { WormholeCanvasSource } = load('visuals/WormholeCanvasSource.ts');
    const { resolveMetaTuning } = load('config/resolveMetaTuning.ts');
    const { XR_WORMHOLE_MACROS, XR_WORMHOLE_BOOSTS } = load('config/xrWormholeTuning.ts');
    const { cloneDefaultVisualTuning } = load('config/visualTuning.ts');
    const expected = fraction => resolveMetaTuning(cloneDefaultVisualTuning(), XR_WORMHOLE_MACROS,
        { ...XR_WORMHOLE_BOOSTS, lineWeight: fraction }, cloneDefaultVisualTuning()).lineWeight;
    const source = new WormholeCanvasSource({ width: 640, height: 360 });
    assert.equal(canvases[0].canvas.width, 640); assert.equal(canvases.length, 1, 'no extra stereo planes by default');
    await source.prepare(null);
    assert.equal(source.render(1, false), true);
    assert.equal(source.state.visualTuning.lineWeight, expected(XR_WORMHOLE_BOOSTS.lineWeight), 'the authored default stroke');
    assert.equal(source.render(1, false), false);
    source.setPresentation({ lineStroke: 0.5 });
    assert.equal(source.render(1, false), true, 'a stroke change reaches a paused canvas');
    assert.equal(source.state.visualTuning.lineWeight, expected(0.5));
    assert.equal(source.render(1, false), false);
    assert.equal(XR_WORMHOLE_BOOSTS.lineWeight, 0.3, 'the shared XR boosts are never mutated');
    const motion = () => source.state.visualTuning.wormholeSpeed;
    const before = motion();
    source.setPresentation({ macros: { intensity: 1, motion: 0, depth: 0.1, detail: 1 } });
    assert.equal(source.render(1, false), true, 'a Visual character change reaches a paused canvas');
    assert.ok(motion() < before, 'Motion lowers the Wormhole speed');
    assert.equal(XR_WORMHOLE_MACROS.motion, 1, 'the shared XR macros are never mutated');
    // Grain material (Addendum V): the MVP Advanced boost semantics, applied directly.
    const weave = () => source.state.visualTuning.wormholeNebulaWeave;
    const weaveBefore = weave();
    source.setPresentation({ grainMaterial: { wormholeNebulaWeave: 0, notAGrainKey: 1 } });
    assert.equal(source.render(1, false), true, 'a Grain material change reaches a paused canvas');
    assert.ok(weave() < weaveBefore || weaveBefore === 0, 'Material weave 0 removes the weave');
    assert.equal(weave(), 0);
    assert.equal(XR_WORMHOLE_BOOSTS.wormholeNebulaWeave, 1, 'the shared XR boosts are never mutated');
    assert.equal(source.render(1, false), false, 'unchanged values do not redraw');
    source.setPresentation({ grainMaterial: { wormholeNebulaWeave: 0 } });
    assert.equal(source.render(1, false), false);
    source.setPresentation({ maxFrameRateHz: 24 });
    let draws = 0;
    for (let i = 0; i <= 72; i++) if (source.render(2 + i / 72, true)) draws++;
    assert.ok(draws >= 24 && draws <= 25, `24 Hz cap: ${draws}`);
    source.dispose();
});

test('Visuals and Character settings are live presentation settings that never touch the game', () => {
    const { XR_SETTINGS, DEFAULT_XR_SETTINGS, changeScope } = createLoader()('xr/XrSettings.ts');
    const visuals = XR_SETTINGS.filter(d => d.section === 'background'), character = XR_SETTINGS.filter(d => d.section === 'character');
    assert.equal(visuals.map(d => d.id).join(), 'wormhole,noteDesign,quality,rateHz,distanceMeters,lineStroke,sharpness');
    assert.equal(character.map(d => d.id).join(), 'intensity,motion,depth,detail');
    assert.equal(visuals.map(d => d.read(DEFAULT_XR_SETTINGS)).join(), 'on,shard,max,36,200,30,100');
    assert.equal(character.map(d => d.read(DEFAULT_XR_SETTINGS)).join(), '100,100,30,100', 'the XR host authored Visual character');
    for (const descriptor of [...visuals, ...character]) {
        assert.equal(descriptor.scope, 'presentation', descriptor.id);
        const next = descriptor.kind === 'choice' ? descriptor.write(DEFAULT_XR_SETTINGS, descriptor.choices.at(-1).value === descriptor.read(DEFAULT_XR_SETTINGS)
            ? descriptor.choices[0].value : descriptor.choices.at(-1).value) : descriptor.write(DEFAULT_XR_SETTINGS, 40);
        assert.equal(changeScope(DEFAULT_XR_SETTINGS, next), 'presentation', descriptor.id);
        assert.equal(JSON.stringify(next.generation), JSON.stringify(DEFAULT_XR_SETTINGS.generation));
        assert.equal(JSON.stringify(next.play), JSON.stringify(DEFAULT_XR_SETTINGS.play));
    }
    const detail = character.find(d => d.id === 'detail').write(DEFAULT_XR_SETTINGS, 25);
    assert.equal(detail.background.character.detail, 0.25);
    assert.equal(detail.background.character.depth, 0.3, 'the other macros stay');
});

test('the Material tab holds the MVP Advanced Grain material sliders as live presentation settings', () => {
    const { XR_SETTINGS, XR_SETTING_SECTIONS, DEFAULT_XR_SETTINGS, changeScope } = createLoader()('xr/XrSettings.ts');
    const { ADVANCED_BOOST_GROUPS } = createLoader()('config/metaTuningBoost.ts');
    const { XR_GRAIN_MATERIAL_KEYS, grainMaterialBoosts } = settingsModule();
    assert.equal(XR_SETTING_SECTIONS.find(s => s.id === 'material').title, 'Material');
    const material = XR_SETTINGS.filter(d => d.section === 'material');
    assert.equal(material.map(d => d.label).join(), 'Grain material,Material detail,Material bloom,Material weave,Spiral twist,Spiral arms,Grain density',
        'the MVP panel labels, in its order');
    const mvpGroup = ADVANCED_BOOST_GROUPS.find(g => g.title === 'Grain material');
    assert.equal(Object.values(XR_GRAIN_MATERIAL_KEYS).join(), mvpGroup.keys.join(), 'exactly the MVP Grain material group');
    assert.equal(material.map(d => d.read(DEFAULT_XR_SETTINGS)).join(), '30,100,100,100,30,100,100', 'the authored XR values');
    for (const descriptor of material) {
        assert.equal(descriptor.scope, 'presentation'); assert.equal(descriptor.kind, 'range');
        assert.equal(descriptor.min, 0); assert.equal(descriptor.max, 100);
        assert.match(descriptor.hint, /50 is neutral/);
        const next = descriptor.write(DEFAULT_XR_SETTINGS, 20);
        assert.equal(changeScope(DEFAULT_XR_SETTINGS, next), 'presentation', descriptor.id);
        assert.equal(JSON.stringify(next.generation), JSON.stringify(DEFAULT_XR_SETTINGS.generation));
    }
    const weave = material.find(d => d.id === 'grainWeave').write(DEFAULT_XR_SETTINGS, 30);
    assert.equal(weave.background.grain.weave, 0.3);
    assert.equal(weave.background.grain.detail, 1, 'the other sliders stay');
    assert.equal(JSON.stringify(grainMaterialBoosts(weave.background.grain)), JSON.stringify({ ...AUTHORED_GRAIN_BOOSTS, wormholeNebulaWeave: 0.3 }));
});

test('Grain material sliders reach the Wormhole source in place', async () => {
    const { scene, sources } = sceneHarness();
    await scene.setWormholeEnabled(true);
    await scene.setBackgroundSettings({ ...AUTHORED_DEFAULTS, grain: { ...AUTHORED_GRAIN, detail: 0.25, weave: 0 } });
    assert.equal(JSON.stringify(sources[0].presentations.at(-1).grainMaterial),
        JSON.stringify({ ...AUTHORED_GRAIN_BOOSTS, wormholeNebulaDetail: 0.25, wormholeNebulaWeave: 0 }));
    assert.equal(sources.length, 1, 'applied in place');
    scene.dispose();
});

test('Visual character macros reach the Wormhole source and redraw a paused canvas', async () => {
    const { scene, sources } = sceneHarness();
    await scene.setWormholeEnabled(true);
    await scene.setBackgroundSettings({ ...AUTHORED_DEFAULTS, character: { intensity: 0.5, motion: 0.2, depth: 0.3, detail: 1 } });
    assert.equal(JSON.stringify(sources[0].presentations.at(-1).macros), JSON.stringify({ intensity: 0.5, motion: 0.2, depth: 0.3, detail: 1 }));
    assert.equal(sources.length, 1, 'applied in place');
    scene.dispose();
});

test('the XR composition root requests a single background plane at the scene-selected raster size', () => {
    const main = readFileSync(join(process.cwd(), 'src', 'xr', 'main.ts'), 'utf8');
    assert.doesNotMatch(main, /depthLayers\s*:\s*true/);
    assert.match(main, /width: options\?\.width, height: options\?\.height/);
});

test('Ultra rasterizes at 1280 x 720 and the plane sharpens its magnified texture on the GPU, live and halo-limited', async () => {
    const { scene, sources } = sceneHarness();
    await scene.setBackgroundSettings({ quality: 'ultra', rateHz: 24, lineStroke: 1, sharpness: 0.5 });
    await scene.setWormholeEnabled(true);
    assert.equal(JSON.stringify(sources[0].options), JSON.stringify({ width: 1280, height: 720 }));
    const plane = scene.root.children.find(c => c.material?.customProgramCacheKey?.() === 'wormhole-sharpen');
    assert.ok(plane, 'the background plane carries the sharpening shader');
    const shader = { uniforms: {}, fragmentShader: 'void main() {\n#include <map_fragment>\n}' };
    plane.material.onBeforeCompile(shader);
    assert.ok(!shader.fragmentShader.includes('#include <map_fragment>') && shader.fragmentShader.includes('clamp( c + uSharpen'));
    assert.ok(/^uniform float uSharpen;\nuniform vec2 uTexel;/.test(shader.fragmentShader));
    assert.ok(Math.abs(shader.uniforms.uSharpen.value - 0.75) < 1e-12, 'default 50% = gain 0.75');
    const canvas = sources[0].canvas;
    assert.ok(Math.abs(shader.uniforms.uTexel.value.x - 1 / canvas.width) < 1e-12 && Math.abs(shader.uniforms.uTexel.value.y - 1 / canvas.height) < 1e-12);
    await scene.setBackgroundSettings({ quality: 'ultra', rateHz: 24, lineStroke: 1, sharpness: 1 });
    assert.equal(sources.length, 1, 'sharpness applies in place');
    assert.ok(Math.abs(shader.uniforms.uSharpen.value - 1.5) < 1e-12, 'the compiled program sees the new gain');
    await scene.setBackgroundSettings({ quality: 'ultra', rateHz: 24, lineStroke: 1, sharpness: 0 });
    assert.equal(shader.uniforms.uSharpen.value, 0, 'off = the plain sample');
    scene.dispose();
});

// ---------------------------------------------------------------- Background distance
test('Background distance: 200 m by default, 40 / 100 / 200 m offered, anything else falls back', () => {
    const { normalizeBackgroundSettings, XR_BACKGROUND_DISTANCES } = settingsModule();
    const { XR_SETTINGS, DEFAULT_XR_SETTINGS, changeScope } = createLoader()('xr/XrSettings.ts');
    assert.deepEqual([...XR_BACKGROUND_DISTANCES], [40, 100, 200]);
    for (const value of [undefined, 0, 70, -100, Number.NaN, '100', null]) assert.equal(normalizeBackgroundSettings({ distanceMeters: value }).distanceMeters, 200, String(value));
    for (const value of [40, 100]) assert.equal(normalizeBackgroundSettings({ distanceMeters: value }).distanceMeters, value);
    const descriptor = XR_SETTINGS.find(d => d.id === 'distanceMeters');
    assert.equal(descriptor.section, 'background'); assert.equal(descriptor.scope, 'presentation');
    assert.equal(descriptor.choices.map(c => c.value).join(), '40,100,200');
    const far = descriptor.write(DEFAULT_XR_SETTINGS, '40');
    assert.equal(far.background.distanceMeters, 40, 'the menu string becomes the numeric distance');
    assert.equal(changeScope(DEFAULT_XR_SETTINGS, far), 'presentation', 'live: the chart and the session stay');
});

test('Spatial field: Particles by default, Off / Particles / Full offered live, anything else falls back', () => {
    const { normalizeBackgroundSettings, XR_SPATIAL_FIELD_SETTINGS } = settingsModule();
    const { XR_SETTINGS, DEFAULT_XR_SETTINGS, changeScope } = createLoader()('xr/XrSettings.ts');
    assert.deepEqual([...XR_SPATIAL_FIELD_SETTINGS], ['off', 'particles', 'full']);
    for (const value of [undefined, null, 'on', 1, true]) assert.equal(normalizeBackgroundSettings({ spatialField: value }).spatialField, 'particles', String(value));
    for (const value of ['off', 'full']) assert.equal(normalizeBackgroundSettings({ spatialField: value }).spatialField, value);
    const descriptor = XR_SETTINGS.find(d => d.id === 'spatialField');
    assert.equal(descriptor.section, 'system', 'beside the other headset-load switches'); assert.equal(descriptor.scope, 'presentation');
    assert.equal(descriptor.choices.map(c => c.value).join(), 'off,particles,full');
    const off = descriptor.write(DEFAULT_XR_SETTINGS, 'off');
    assert.equal(off.background.spatialField, 'off'); assert.equal(descriptor.read(off), 'off');
    assert.equal(changeScope(DEFAULT_XR_SETTINGS, off), 'presentation', 'live: the chart and the session stay');
});

test('a backdrop at any distance keeps its angular size; nearer stereo planes keep their own distances', () => {
    const load = createLoader({ three: THREE });
    const { WormholeBackdrop } = load('xr/scene/WormholeBackdrop.ts');
    const { SCENE_CONFIG } = load('xr/scene/SceneConfig.ts');
    const angle = backdrop => 2 * Math.atan(SCENE_CONFIG.backdropWidthMeters * backdrop.root.scale.x / 2 / -backdrop.root.position.z);
    const canvases = [{}, {}, {}];
    const backdrop = new WormholeBackdrop({ canvas: canvases[0], layers: canvases, async prepare() {}, render: () => true, dispose() {} });
    const reference = angle(backdrop);
    const layerWorld = () => {
        backdrop.root.updateMatrixWorld(true);
        return backdrop.root.children.map(child => {
            const position = new THREE.Vector3(), scale = new THREE.Vector3();
            child.matrixWorld.decompose(position, new THREE.Quaternion(), scale);
            return { z: Math.round(position.z * 1e6) / 1e6, scale: Math.round(scale.x * 1e9) / 1e9 };
        });
    };
    const layersAt40 = layerWorld();
    for (const distance of [100, 200, 40]) {
        backdrop.setDistance(distance);
        assert.equal(backdrop.distanceMeters, distance);
        assert.ok(Math.abs(angle(backdrop) - reference) < 1e-12, `${distance} m: same angles, same raster density`);
        assert.deepEqual(layerWorld(), layersAt40, `${distance} m: the 22 m and 12 m stereo planes do not move`);
    }
    backdrop.setDistance(Number.NaN); assert.equal(backdrop.distanceMeters, SCENE_CONFIG.backdropDistanceMeters);
    backdrop.dispose();
    // The camera sees the farthest plane's corners off axis.
    const maxScale = 200 / SCENE_CONFIG.backdropDistanceMeters;
    const corner = Math.hypot(200, maxScale * SCENE_CONFIG.backdropWidthMeters / 2, maxScale * SCENE_CONFIG.backdropHeightMeters / 2);
    assert.ok(SCENE_CONFIG.cameraFarMeters > corner, `far plane ${SCENE_CONFIG.cameraFarMeters} m beyond the ${corner.toFixed(0)} m corner`);
    assert.match(readFileSync(join(process.cwd(), 'src', 'xr', 'runtime', 'XrRuntime.ts'), 'utf8'), /SCENE_CONFIG\.cameraFarMeters/, 'the runtime camera uses it');
});

test('the scene applies the Background distance live to the plane and to the track aim', async () => {
    const { scene, sources, snapshot } = sceneHarness();
    assert.equal(scene.path.backdropDistanceMeters, 200, 'the default distance aims the track before any background exists');
    await scene.setWormholeEnabled(true);
    const backdrop = scene.wormhole;
    assert.equal(backdrop.distanceMeters, 200, 'a new plane starts at the chosen distance');
    const { normalizeBackgroundSettings } = settingsModule();
    const revision = scene.path.revision;
    await scene.setBackgroundSettings(normalizeBackgroundSettings({ distanceMeters: 40 }));
    assert.equal(backdrop.distanceMeters, 40); assert.equal(scene.path.backdropDistanceMeters, 40);
    assert.ok(scene.path.revision > revision, 'the track re-aims (notes and runway re-project)');
    assert.equal(sources.length, 1, 'no rebuild: the same plane and raster');
    scene.update([], 1, snapshot('paused'), '');
    await scene.setBackgroundSettings(normalizeBackgroundSettings({ distanceMeters: 200, quality: 'high' }));
    assert.equal(sources.length, 2); assert.equal(scene.wormhole.distanceMeters, 200, 'a rebuilt plane keeps the distance');
    scene.dispose();
});
