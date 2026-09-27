import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';

const context = { clearRect() {}, fillRect() {}, fillText() {}, measureText: text => ({ width: text.length * 12 }) };
const load = createLoader({ three: THREE }, { document: { createElement: () => ({ getContext: () => context }) } });
const { XrRunway, runwayPhase, runwayFloorAlpha, createRunwayPixels } = load('xr/scene/XrRunway.ts');
const { RhythmGameScene } = load('xr/scene/RhythmGameScene.ts');
const { SCENE_CONFIG } = load('xr/scene/SceneConfig.ts');
const { DEFAULT_RHYTHM_GAME_CONFIG: config } = load('gameplay/index.ts');
const idle = { state: 'playing', score: 0, combo: 0, maxCombo: 0, hitCount: 0, missCount: 0, totalNotes: 0 };

test('road phase is a pure, bounded function of song time that follows note travel', () => {
    const tile = SCENE_CONFIG.runwayTileLengthMeters;
    assert.equal(runwayPhase(0, config.noteSpeedMps), 0);
    for (const t of [0.013, 1.25, 7.77, 612.4]) {
        const phase = runwayPhase(t, config.noteSpeedMps);
        assert.ok(phase >= 0 && phase < 1);
        assert.equal(phase, runwayPhase(t, config.noteSpeedMps));
        // One tile of floor passes exactly when a note travels one tile length.
        assert.ok(Math.abs(runwayPhase(t + tile / config.noteSpeedMps, config.noteSpeedMps) - phase) < 1e-9
            || Math.abs(Math.abs(runwayPhase(t + tile / config.noteSpeedMps, config.noteSpeedMps) - phase) - 1) < 1e-9);
    }
    assert.ok(runwayPhase(-0.1, config.noteSpeedMps) >= 0);
    assert.equal(runwayPhase(Number.NaN, config.noteSpeedMps), 0);
});

test('same song time reproduces the same floor offset; seek backwards and pause do not accumulate', () => {
    const runway = new XrRunway(config);
    runway.update(3.3); const at33 = runway.texture.offset.y;
    runway.update(9.1); runway.update(12.6);
    runway.update(3.3); assert.equal(runway.texture.offset.y, at33); // seek backwards
    const fresh = new XrRunway(config); fresh.update(3.3); assert.equal(fresh.texture.offset.y, at33);
    // Paused: repeated frames at a frozen song time change nothing.
    for (let i = 0; i < 120; i++) assert.equal(runway.update(3.3), false);
    assert.equal(runway.texture.offset.y, at33);
    assert.equal(runway.phase, runwayPhase(3.3, config.noteSpeedMps));
    runway.dispose(); fresh.dispose();
});

test('road motion never uploads textures or moves gameplay/stage coordinates', () => {
    const world = new THREE.Scene(), scene = new RhythmGameScene(world);
    scene.placeForViewer(0.4, 1.7, -0.2, 0.3);
    const playfield = scene.playfield.matrixWorld.clone(), floor = scene.runway.floor.matrixWorld.clone();
    const toPlayfield = scene.getWorldToPlayfield(new THREE.Matrix4()).clone();
    const textureVersion = scene.runway.texture.version, gateMatrix = scene.runway.gate.matrix.clone();
    for (const t of [0, 0.5, 4.2, 1.1, 30, 0.5]) scene.update([], t, idle, 'Play');
    scene.root.updateMatrixWorld(true);
    assert.ok(scene.playfield.matrixWorld.equals(playfield));
    assert.ok(scene.runway.floor.matrixWorld.equals(floor));
    assert.ok(scene.runway.gate.matrix.equals(gateMatrix));
    assert.ok(scene.getWorldToPlayfield(new THREE.Matrix4()).equals(toPlayfield));
    assert.equal(scene.runway.texture.version, textureVersion);
    assert.equal(scene.runway.texture.offset.y, runwayPhase(0.5, config.noteSpeedMps));
    scene.dispose(); assert.equal(world.children.length, 0);
});

test('floor spans ahead/under/behind the player and dissolves toward the Wormhole', () => {
    const runway = new XrRunway(config);
    runway.floor.geometry.computeBoundingBox();
    const box = runway.floor.geometry.boundingBox;
    assert.equal(box.min.z, SCENE_CONFIG.runwayFrontZMeters); assert.equal(box.max.z, SCENE_CONFIG.runwayBackZMeters);
    assert.ok(runwayFloorAlpha(0) > 0.8);
    assert.ok(runwayFloorAlpha(SCENE_CONFIG.runwayFrontZMeters) < 1e-9);
    assert.ok(runwayFloorAlpha(SCENE_CONFIG.runwayBackZMeters) > 0.3);
    assert.equal(runway.texture.repeat.y, (SCENE_CONFIG.runwayBackZMeters - SCENE_CONFIG.runwayFrontZMeters) / SCENE_CONFIG.runwayTileLengthMeters);
    const pixels = createRunwayPixels(32, 16);
    assert.equal(pixels.length, 32 * 16 * 4); assert.deepEqual(pixels, createRunwayPixels(32, 16));
    runway.dispose();
});

test('dispose releases every runway geometry, material and texture exactly once', () => {
    const runway = new XrRunway(config);
    const parent = new THREE.Group(); parent.add(runway.floor, runway.linework, runway.gate);
    const counts = new Map();
    const track = resource => { counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1)); };
    for (const mesh of [runway.floor, runway.linework, runway.gate]) { track(mesh.geometry); track(mesh.material); }
    track(runway.texture);
    runway.dispose();
    assert.equal(parent.children.length, 0);
    for (const count of counts.values()) assert.equal(count, 1);
});
