import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';

const wormhole = createLoader();
const identityModule = wormhole('visuals/CosmicWormholeIdentity.ts');
const { CosmicWormholeIdentity, wormholeNearLayerShare, wormholeFarLayerShare, wormholeDepthCueWeight, wormholeDepthCueAlpha,
    wormholeDepthCueHaze, WORMHOLE_LAYER_NEAR_EDGE, WORMHOLE_LAYER_FAR_EDGE } = identityModule;
const { State } = wormhole('state/store.ts');
const xr = createLoader({ three: THREE });
const { WormholeBackdrop, layerPlaneScale } = xr('xr/scene/WormholeBackdrop.ts');
const { SCENE_CONFIG } = xr('xr/scene/SceneConfig.ts');

/** Records every primitive call; mid/near layer recorders are smaller rasters. */
function recorder(width = 960, height = 540) {
    const calls = [];
    const record = name => (...args) => calls.push([name, ...args]);
    return { width, height, frameCount: 1, calls, beginFieldRaster: () => null, drawFieldRaster: record('drawFieldRaster'),
        background: record('background'), noStroke: record('noStroke'), noFill: record('noFill'), fill: record('fill'),
        stroke: record('stroke'), strokeWeight: record('strokeWeight'), line: record('line'), circle: record('circle'),
        triangle: record('triangle'), beginShape: record('beginShape'), vertex: record('vertex'), endShape: record('endShape'),
        radialGlow: record('radialGlow'), radialDim: record('radialDim'), compositeRingTint: record('compositeRingTint') };
}

function drawFrames(configure, frames = 45) {
    State.bpm = 128; State.playbackFade = 1; State.isPlaying = true;
    Object.assign(State.visualTuning, { wormholeNebulaAmount: 0, performanceMode: 0, wormholeStarfield: 1, wormholeGalaxy: 0.5 });
    Object.assign(State.targetTuning, { wormholeNebulaAmount: 0, performanceMode: 0, wormholeStarfield: 1, wormholeGalaxy: 0.5 });
    const identity = new CosmicWormholeIdentity();
    const far = recorder(), mid = recorder(768, 432), near = recorder(768, 432);
    configure(identity, mid, near);
    identity.syncPosition(6);
    for (let i = 0; i < frames; i++) { State.currentTime = 6 + i / 30; identity.draw(far, [], []); }
    return { far: far.calls, mid: mid.calls, near: near.calls };
}

test('layer shares partition every grain (sum 1), crossfade continuously and put each depth in its bucket', () => {
    let previous = null;
    for (let i = 0; i <= 1000; i++) {
        const t = i / 1000, near = wormholeNearLayerShare(t), far = wormholeFarLayerShare(t), mid = 1 - near - far;
        assert.ok(near >= 0 && far >= 0 && mid >= -1e-12, `shares at ${t}`);
        if (previous) for (const [a, b] of [[near, previous[0]], [mid, previous[1]], [far, previous[2]]]) assert.ok(Math.abs(a - b) < 0.05, 'no plane jump');
        previous = [near, mid, far];
    }
    assert.equal(wormholeNearLayerShare(0), 1); assert.equal(wormholeFarLayerShare(1), 1);
    const midpoint = (WORMHOLE_LAYER_NEAR_EDGE + WORMHOLE_LAYER_FAR_EDGE) / 2;
    assert.equal(1 - wormholeNearLayerShare(midpoint) - wormholeFarLayerShare(midpoint), 1);
});

test('depth cues: near strokes thicker, far strokes thinner/dimmer/hazier, and exact identity at zero', () => {
    for (const t of [0, 0.3, 0.7, 1]) {
        assert.equal(wormholeDepthCueWeight(t, 0), 1); assert.equal(wormholeDepthCueAlpha(t, 0), 1); assert.equal(wormholeDepthCueHaze(t, 0), 0);
    }
    assert.ok(wormholeDepthCueWeight(0, 1) > 1.4 && wormholeDepthCueWeight(1, 1) < 0.6);
    for (let t = 0.05; t <= 1; t += 0.05) {
        assert.ok(wormholeDepthCueWeight(t, 0.7) < wormholeDepthCueWeight(t - 0.05, 0.7));
        assert.ok(wormholeDepthCueAlpha(t, 0.7) <= wormholeDepthCueAlpha(t - 0.05, 0.7));
        assert.ok(wormholeDepthCueHaze(t, 0.7) >= wormholeDepthCueHaze(t - 0.05, 0.7));
    }
    assert.ok(wormholeDepthCueAlpha(1, 1) >= 0.55);
});

test('disabled cue and no layers keep the primitive stream byte-identical; enabled cue changes only grain strokes', () => {
    const legacy = drawFrames(() => {});
    const explicit = drawFrames(identity => { identity.setDepthCue(0); identity.setDepthLayers(null); });
    assert.equal(JSON.stringify(explicit.far), JSON.stringify(legacy.far));
    const cued = drawFrames(identity => identity.setDepthCue(0.7));
    assert.notEqual(JSON.stringify(cued.far), JSON.stringify(legacy.far));
    assert.equal(cued.far.filter(c => c[0] === 'line').length, legacy.far.filter(c => c[0] === 'line').length, 'same geometry, no extra lines');
    assert.equal(JSON.stringify(drawFrames(identity => identity.setDepthCue(0.7)).far), JSON.stringify(cued.far), 'deterministic');
});

test('layered output routes grains by depth with bounded crossfade duplicates; background stays on the far plane', () => {
    const single = drawFrames(() => {});
    const layered = drawFrames((identity, mid, near) => identity.setDepthLayers({ mid, near }));
    const lines = calls => calls.filter(c => c[0] === 'line').length;
    const total = lines(layered.far) + lines(layered.mid) + lines(layered.near);
    assert.ok(lines(layered.mid) > 0 && lines(layered.near) > 0, 'nearer planes receive grains');
    assert.ok(total >= lines(single.far) && total <= lines(single.far) * 1.3, `crossfade duplicates are bounded: ${total} vs ${lines(single.far)}`);
    for (const plane of [layered.mid, layered.near]) {
        assert.ok(plane.every(c => ['stroke', 'strokeWeight', 'line'].includes(c[0])), 'only grain strokes on nearer planes');
        for (const c of plane.filter(c => c[0] === 'line')) for (const v of c.slice(1, 5)) assert.ok(Number.isFinite(v));
    }
    assert.ok(layered.far.some(c => c[0] === 'background'), 'far plane keeps the background');
    const again = drawFrames((identity, mid, near) => identity.setDepthLayers({ mid, near }));
    assert.equal(JSON.stringify(again), JSON.stringify(layered), 'layer routing is deterministic');
});

test('stereo planes: identical angular composition, beyond the gameplay volume, ordered disparity, fixed count', () => {
    const distances = SCENE_CONFIG.backdropLayerDistancesMeters;
    assert.equal(distances.length, 3); assert.equal(distances[0], SCENE_CONFIG.backdropDistanceMeters);
    const angle = d => 2 * Math.atan(SCENE_CONFIG.backdropWidthMeters * layerPlaneScale(d) / 2 / d);
    for (const d of distances) assert.ok(Math.abs(angle(d) - angle(distances[0])) < 1e-12, 'same angular size from the eye');
    for (const d of distances.slice(1)) assert.ok(d > -SCENE_CONFIG.runwayFrontZMeters + 1, 'behind the runway and every target');
    const ipd = 0.063, disparity = d => 2 * Math.atan(ipd / 2 / d) * 180 / Math.PI;
    assert.ok(disparity(distances[2]) > disparity(distances[1]) && disparity(distances[1]) > disparity(distances[0]));
    assert.ok(disparity(distances[2]) - disparity(distances[0]) > 0.1, 'separation well above stereo acuity');
});

test('backdrop builds fixed planes from a layered source, uploads only changed frames and disposes everything', async () => {
    let changed = true;
    const canvases = [{}, {}, {}];
    const source = { canvas: canvases[0], layers: canvases, focalPoint: { x: 0.1, y: 0 }, async prepare() {}, render: () => changed, dispose() {} };
    const backdrop = new WormholeBackdrop(source);
    assert.equal(backdrop.layerCount, 3); assert.equal(backdrop.root.children.length, 2);
    await backdrop.prepare(null);
    const versions = () => [backdrop.root.material.map, ...backdrop.root.children.map(c => c.material.map)].map(t => t.version);
    const before = versions();
    backdrop.update(1, true); assert.deepEqual(versions(), before.map(v => v + 1));
    changed = false; backdrop.update(1.1, true); assert.deepEqual(versions(), before.map(v => v + 1));
    for (const child of backdrop.root.children) {
        assert.equal(child.material.blending, THREE.AdditiveBlending); assert.equal(child.material.depthWrite, false);
        const worldZ = backdrop.root.position.z + child.position.z;
        assert.ok(SCENE_CONFIG.backdropLayerDistancesMeters.includes(-worldZ));
    }
    backdrop.setEyeHeight(1.4); assert.equal(backdrop.root.position.y, 1.4);
    backdrop.root.visible = false; backdrop.update(2, true); assert.deepEqual(versions(), before.map(v => v + 1));
    const disposed = [];
    const track = r => r.addEventListener('dispose', () => disposed.push(r));
    track(backdrop.root.geometry); track(backdrop.root.material); track(backdrop.root.material.map);
    for (const child of backdrop.root.children) { track(child.geometry); track(child.material); track(child.material.map); }
    backdrop.dispose(); assert.equal(disposed.length, 9);
    const single = new WormholeBackdrop({ canvas: {}, async prepare() {}, render: () => true, dispose() {} });
    assert.equal(single.layerCount, 1); assert.equal(single.root.children.length, 0); single.dispose();
});
