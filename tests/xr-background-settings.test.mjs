import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { fakeDocument, findAll } from './helpers/fake-dom.mjs';

const settingsModule = () => createLoader()('xr/XrBackgroundSettings.ts');

const AUTHORED_GRAIN = { amount: 0.5, detail: 1, bloom: 1, weave: 1, spiral: 0.04, arms: 0.5, density: 0.5 };
const AUTHORED_GRAIN_BOOSTS = { wormholeNebulaAmount: 0.5, wormholeNebulaDetail: 1, wormholeNebulaBloom: 1, wormholeNebulaWeave: 1, wormholeSpiral: 0.04, wormholeSpiralArms: 0.5, wormholeGrainDensity: 0.5 };
const AUTHORED_DEFAULTS = { wormhole: true, quality: 'ultra', rateHz: 36, lineStroke: 0.34, sharpness: 1, character: { intensity: 1, motion: 1, depth: 0.1, detail: 1 },
    grain: AUTHORED_GRAIN };
/** The pre-Addendum-T presentation, for tests about pacing rather than defaults. */
const BALANCED_24 = { wormhole: true, quality: 'balanced', rateHz: 24, lineStroke: 0.98, sharpness: 0.5, character: { intensity: 1, motion: 1, depth: 0.3, detail: 1 } };

test('background settings default to the authored values: Wormhole on, Ultra raster, 36 Hz, Line stroke 34, full sharpening', () => {
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
    assert.equal(normalizeBackgroundSettings({ lineStroke: Number.NaN }).lineStroke, 0.34, 'invalid -> the authored default');
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

test('the scene starts with the authored background: Ultra raster, 36 Hz on a whole frame phase, Line stroke 34', async () => {
    const { scene, sources, snapshot } = sceneHarness();
    await scene.setWormholeEnabled(true);
    const source = sources[0];
    assert.equal(JSON.stringify(source.options), JSON.stringify({ width: 1280, height: 720 }));
    scene.setDisplayFrameRate(72);
    assert.equal(JSON.stringify(source.presentations.at(-1)), JSON.stringify({ lineStroke: 0.34, maxFrameRateHz: 36, macros: AUTHORED_DEFAULTS.character,
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

test('Line stroke follows the MVP Advanced slider semantics and redraws even while steadily paused', async () => {
    const canvases = [];
    class Backend { constructor(width, height) { this.canvas = { width, height }; this.frameCount = 0; canvases.push(this); } background() {} }
    class Identity { constructor(state) { this.state = state; } syncPosition() {} setDepthCue() {} setDepthLayers() {} draw() {} }
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
    assert.equal(XR_WORMHOLE_BOOSTS.lineWeight, 0.34, 'the shared XR boosts are never mutated');
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
    assert.equal(visuals.map(d => d.id).join(), 'wormhole,noteDesign,quality,rateHz,lineStroke,sharpness');
    assert.equal(character.map(d => d.id).join(), 'intensity,motion,depth,detail');
    assert.equal(visuals.map(d => d.read(DEFAULT_XR_SETTINGS)).join(), 'on,shard,ultra,36,34,100');
    assert.equal(character.map(d => d.read(DEFAULT_XR_SETTINGS)).join(), '100,100,10,100', 'the XR host authored Visual character');
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
    assert.equal(detail.background.character.depth, 0.1, 'the other macros stay');
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
    assert.equal(material.map(d => d.read(DEFAULT_XR_SETTINGS)).join(), '50,100,100,100,4,50,50', 'the authored XR values');
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
