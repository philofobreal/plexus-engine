import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { noteMatrixAt } from './helpers/xr-note-motion.mjs';
import { glslTrackOffset, renderedPositions } from './helpers/xr-track-bend.mjs';

const context = { clearRect() {}, fillRect() {}, fillText() {}, measureText: text => ({ width: text.length * 12 }) };
const load = createLoader({ three: THREE }, { document: { createElement: () => ({ getContext: () => context }) } });
const { XrTrackPath, trackBendAmplitude, trackBendWeight, TRACK_BEND_GLSL, TRACK_BEND_VERTEX_STATEMENT } = load('xr/scene/XrTrackPath.ts');
const { XrRunway } = load('xr/scene/XrRunway.ts');
const { RhythmNoteField } = load('xr/scene/RhythmNoteField.ts');
const { RhythmGameScene } = load('xr/scene/RhythmGameScene.ts');
const { SCENE_CONFIG, DEFAULT_STAGE_LAYOUT } = load('xr/scene/SceneConfig.ts');
const { resolvePlayProfile } = load('xr/XrPlayProfile.ts');
const { desktopStrikeForRay } = load('xr/DesktopInputAdapter.ts');
const { notePosition, judgeStrike, DEFAULT_RHYTHM_GAME_CONFIG: config } = load('gameplay/index.ts');

const FAR_PLAYFIELD_Z = -8; // spawn distance: 2 s at 4 m/s
const pathWith = (x, y) => { const path = new XrTrackPath(); path.setFocus(x, y); return path; };
const far = (path, x = 0.45, y = 0.34) => path.projectPlayfieldPoint({ x, y, z: FAR_PLAYFIELD_Z });
/** What the GPU draws: the static floor geometry bent by the runway's `uTrackBend` uniform. */
const floorPositions = runway => Array.from(renderedPositions(runway.floor.geometry, runway.bendUniform.value));
const idle = { state: 'paused', score: 0, combo: 0, maxCombo: 0, hitCount: 0, missCount: 0, totalNotes: 0 };
const pending = note => ({ note, status: 'pending', judgement: null });

test('zero Wormhole displacement keeps the exact straight baseline', () => {
    const path = pathWith(0, 0), runway = new XrRunway(config), before = floorPositions(runway);
    assert.equal(path.amplitudeX, 0); assert.equal(path.amplitudeY, 0);
    assert.deepEqual(far(path), { x: 0.45, y: 0.34, z: FAR_PLAYFIELD_Z });
    runway.applyPath(path); assert.deepEqual(floorPositions(runway), before);
    runway.dispose();
});

test('positive/negative X and Y focus bend the far track in the matching direction', () => {
    for (const [fx, fy, axis, sign] of [[0.3, 0, 'x', 1], [-0.3, 0, 'x', -1], [0, 0.3, 'y', 1], [0, -0.3, 'y', -1]]) {
        const base = { x: 0.45, y: 0.34 }, bent = far(pathWith(fx, fy));
        assert.equal(Math.sign(bent[axis] - base[axis]), sign, `${fx},${fy}`);
        const other = axis === 'x' ? 'y' : 'x';
        assert.equal(bent[other], base[other]);
    }
    // Symmetric: mirrored focus mirrors the displacement exactly.
    assert.equal(far(pathWith(0.3, 0)).x - 0.45, -(far(pathWith(-0.3, 0)).x - 0.45));
});

test('combined X/Y is deterministic and the same state always yields the same projection', () => {
    assert.deepEqual(far(pathWith(0.21, -0.17)), far(pathWith(0.21, -0.17)));
    const path = new XrTrackPath(), runway = new XrRunway(config);
    path.setFocus(0.21, -0.17); runway.applyPath(path); const first = floorPositions(runway), firstNote = far(path);
    path.setFocus(-0.4, 0.5); runway.applyPath(path);
    path.setFocus(0.21, -0.17); runway.applyPath(path);
    assert.deepEqual(floorPositions(runway), first); assert.deepEqual(far(path), firstNote);
    assert.equal(path.setFocus(0.21, -0.17), false, 'unchanged focus is not a new revision');
    runway.dispose();
});

test('hit plane, gate, lanes and rows never move; only the far zone bends', () => {
    const path = pathWith(1.5, -1.5), runway = new XrRunway(config);
    const gate = Array.from(runway.gate.geometry.getAttribute('position').array);
    const straightFloor = floorPositions(runway);
    runway.applyPath(path);
    assert.deepEqual(Array.from(runway.gate.geometry.getAttribute('position').array), gate);
    // Every canonical point within reach (and the whole timing window) stays exactly in place.
    const reachLimit = SCENE_CONFIG.trackBendStartMeters - SCENE_CONFIG.playfieldForwardMeters;
    for (let z = 2; z >= -reachLimit; z -= 0.05) for (const x of [-0.45, 0, 0.45]) for (const y of [-0.34, 0, 0.34]) {
        assert.deepEqual(path.projectPlayfieldPoint({ x, y, z }), { x, y, z });
    }
    const floor = floorPositions(runway);
    for (let i = 0; i < floor.length; i += 3) {
        if (-straightFloor[i + 2] <= SCENE_CONFIG.trackBendStartMeters) {
            assert.equal(floor[i], straightFloor[i]); assert.equal(floor[i + 1], straightFloor[i + 1]);
        }
    }
    // The bend is a shear: lanes keep their spacing and rows their height difference at any depth.
    const left = far(path, -0.45, 0), right = far(path, 0.45, 0), high = far(path, 0, 0.34), low = far(path, 0, -0.34);
    assert.ok(Math.abs(right.x - left.x - 0.9) < 1e-12); assert.ok(Math.abs(high.y - low.y - 0.68) < 1e-12);
    assert.equal(trackBendWeight(-SCENE_CONFIG.trackBendStartMeters), 0);
    runway.dispose();
});

test('far-end displacement saturates inside bounded limits and road length is unchanged', () => {
    for (const focus of [-1e9, -3, -1, 1, 3, 1e9]) {
        const path = pathWith(focus, focus);
        assert.ok(Math.abs(path.amplitudeX) <= SCENE_CONFIG.trackMaxLateralBendMeters);
        assert.ok(Math.abs(path.amplitudeY) <= SCENE_CONFIG.trackMaxVerticalBendMeters);
        const runway = new XrRunway(config); runway.applyPath(path);
        const box = new THREE.Box3().setFromArray(floorPositions(runway));
        assert.equal(box.min.z, SCENE_CONFIG.runwayFrontZMeters); assert.equal(box.max.z, SCENE_CONFIG.runwayBackZMeters);
        assert.ok(Math.max(Math.abs(box.max.x), Math.abs(box.min.x)) <= SCENE_CONFIG.runwayWidthMeters / 2 + SCENE_CONFIG.trackMaxLateralBendMeters + 1e-6);
        runway.dispose();
    }
    assert.equal(pathWith(Number.NaN, Infinity).amplitudeX, 0);
    // Unsaturated, the far-end tangent aims at the focal point on the backdrop.
    const small = trackBendAmplitude(0.01, SCENE_CONFIG.backdropWidthMeters / 2, SCENE_CONFIG.trackMaxLateralBendMeters);
    const end = -SCENE_CONFIG.runwayFrontZMeters, length = end - SCENE_CONFIG.trackBendStartMeters;
    const aimedSlope = (0.01 * SCENE_CONFIG.backdropWidthMeters / 2 - small) / (SCENE_CONFIG.backdropDistanceMeters - end);
    assert.ok(Math.abs(2 * small / length - aimedSlope) / aimedSlope < 1e-3); // tanh is ~linear here
});

test('rendered targets, desktop picking and XR strike judging share the one path projection', () => {
    const path = pathWith(0.35, 0.25);
    const note = { id: 'far', time: 5, lane: 2, row: 2, hand: 'right', cutDirection: 'down' };
    const canonical = time => notePosition(note, time, new THREE.Vector3());
    const field = new RhythmNoteField(); field.update([pending(note)], 3, config, path);
    const matrix = noteMatrixAt(field, 'mesh', 0); // the shader's placement through the shared track bend
    const rendered = new THREE.Vector3().setFromMatrixPosition(matrix);
    const expected = path.projectPlayfieldPoint(canonical(3));
    assert.ok(rendered.distanceTo(expected) < 1e-6); // float32 instance data and uniforms
    assert.ok(rendered.x > canonical(3).x, 'far target visibly follows the bend');
    assert.ok(path.unprojectPlayfieldPoint(expected.clone()).distanceTo(canonical(3)) < 1e-12);
    // Desktop ray aimed at the rendered (bent) target selects it and reports the canonical position.
    const origin = new THREE.Vector3(0, 0.5, 3.5);
    const strike = desktopStrikeForRay(new THREE.Ray(origin, expected.clone().sub(origin).normalize()), [pending(note)], 3, 'right', path);
    assert.equal(strike.desktopTargetId, 'far');
    assert.ok(new THREE.Vector3().copy(strike.position).distanceTo(canonical(3)) < 1e-9);
    // VR strike samples are un-projected through the same path before judging.
    const free = { ...note, cutDirection: 'any' };
    const attempt = { songTime: 5, hand: 'right', speed: 2, position: path.projectPlayfieldPoint(notePosition(free, 5, new THREE.Vector3())) };
    path.unprojectStrike(attempt);
    assert.ok(judgeStrike(attempt, [pending(free)]));
    field.dispose();
    // No other XR module carries its own copy of the curve.
    const xrFiles = [];
    const walk = dir => { for (const e of readdirSync(dir, { withFileTypes: true })) { if (e.isDirectory()) walk(join(dir, e.name)); else xrFiles.push(join(dir, e.name)); } };
    walk(join(process.cwd(), 'src', 'xr'));
    for (const file of xrFiles.filter(f => !f.endsWith('XrTrackPath.ts') && !f.endsWith('SceneConfig.ts'))) {
        assert.doesNotMatch(readFileSync(file, 'utf8'), /trackMax(Lateral|Vertical)BendMeters|AIM_GAIN|trackBendAmplitude|vec2 xrTrackPathOffset|uTrackBend\.xy/, file);
    }
    assert.match(readFileSync(join(process.cwd(), 'src', 'xr', 'XrAppController.ts'), 'utf8'), /path\.unprojectStrike\(attempt\)/);
});

test('scene follows the authoritative source focal point; seeking backwards does not accumulate curvature', async () => {
    const focusAt = time => ({ x: Math.sin(time) * 0.3, y: Math.cos(time * 0.7) * 0.2 });
    const makeScene = () => {
        const source = { canvas: {}, focalPoint: { x: 0, y: 0 }, async prepare() {},
            render(time) { Object.assign(source.focalPoint, focusAt(time)); return true; }, dispose() {} };
        return new RhythmGameScene(new THREE.Scene(), undefined, () => source);
    };
    const scene = makeScene(); await scene.setWormholeEnabled(true);
    for (const t of [1, 4.5, 9, 12]) scene.update([], t, idle, '');
    scene.update([], 2.25, idle, ''); // seek backwards
    const fresh = makeScene(); await fresh.setWormholeEnabled(true); fresh.update([], 2.25, idle, '');
    assert.equal(scene.path.amplitudeX, fresh.path.amplitudeX); assert.equal(scene.path.amplitudeY, fresh.path.amplitudeY);
    assert.deepEqual(floorPositions(scene.runway), floorPositions(fresh.runway));
    assert.equal(scene.path.focusX, focusAt(2.25).x);
    // Disabling the Wormhole returns the track to straight.
    await scene.setWormholeEnabled(false); scene.update([], 2.25, idle, '');
    assert.equal(scene.path.amplitudeX, 0);
    // A stationary path does not re-upload floor vertices.
    const version = scene.runway.floor.geometry.getAttribute('position').version;
    for (let i = 0; i < 30; i++) scene.update([], 2.25, idle, '');
    assert.equal(scene.runway.floor.geometry.getAttribute('position').version, version);
    scene.dispose(); fresh.dispose();
});

// ---------------------------------------------------------------- GPU runway bend (static geometry)
const fakeCompile = material => {
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader };
    material.onBeforeCompile(shader, null);
    return shader;
};

test('the GLSL twin is the CPU bend operation for operation, and the runway materials install it', () => {
    // The float32 mirror in tests/helpers/xr-track-bend.mjs follows exactly this text.
    assert.match(TRACK_BEND_GLSL, /uniform vec4 uTrackBend;/);
    assert.match(TRACK_BEND_GLSL, /float u = clamp\( \( -rootZ - uTrackBend\.z \) \/ \( uTrackBend\.w - uTrackBend\.z \), 0\.0, 1\.0 \);/);
    assert.match(TRACK_BEND_GLSL, /return uTrackBend\.xy \* \( u \* u \);/);
    const runway = new XrRunway(config);
    for (const mesh of [runway.floor, runway.linework]) {
        const shader = fakeCompile(mesh.material);
        assert.equal(shader.uniforms.uTrackBend, runway.bendUniform, `${mesh.name}: live shared uniform`);
        assert.ok(shader.vertexShader.startsWith(TRACK_BEND_GLSL));
        assert.ok(shader.vertexShader.includes(`#include <begin_vertex>\n\t${TRACK_BEND_VERTEX_STATEMENT}`), mesh.name);
        assert.equal(mesh.material.customProgramCacheKey(), 'xr-track-bend');
        assert.equal(mesh.position.lengthSq(), 0, 'object space is stage-root space');
    }
    // The hit gate lives in playfield space and never bends.
    assert.equal(runway.gate.material.onBeforeCompile.toString().includes('uTrackBend'), false);
    // Floor texture and blending are untouched by the bend.
    assert.equal(runway.floor.material.map, runway.texture);
    assert.equal(runway.linework.material.blending, THREE.AdditiveBlending);
    runway.dispose();
});

test('GPU bend matches CPU path samples at every runway vertex; the straight zone is exact', () => {
    const hyper = resolvePlayProfile({ noteSpeed: 'hyper' }).stage;
    for (const layout of [DEFAULT_STAGE_LAYOUT, hyper]) for (const [fx, fy] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.4], [0, -0.4], [0.21, -0.17], [1e9, -1e9]]) {
        const path = new XrTrackPath(); path.setLayout(layout); path.setFocus(fx, fy);
        const runway = new XrRunway(config, layout); runway.applyPath(path);
        const offset = { x: 0, y: 0 };
        let farX = 0, farY = 0;
        for (const geometry of [runway.floor.geometry, runway.linework.geometry]) {
            const base = geometry.getAttribute('position').array, rendered = renderedPositions(geometry, runway.bendUniform.value);
            for (let i = 0; i < base.length; i += 3) {
                const z = base[i + 2];
                assert.equal(rendered[i + 2], z, 'z (road length) is unchanged');
                if (-z <= SCENE_CONFIG.trackBendStartMeters) {
                    assert.equal(rendered[i], base[i]); assert.equal(rendered[i + 1], base[i + 1]);
                    continue;
                }
                path.offsetAtRootZ(z, offset);
                assert.ok(Math.abs(rendered[i] - (base[i] + offset.x)) < 1e-5, `${fx},${fy} x at z=${z}`);
                assert.ok(Math.abs(rendered[i + 1] - (base[i + 1] + offset.y)) < 1e-5, `${fx},${fy} y at z=${z}`);
                farX = Math.max(farX, Math.abs(rendered[i] - base[i])); farY = Math.max(farY, Math.abs(rendered[i + 1] - base[i + 1]));
            }
        }
        // Far end reaches the CPU amplitude: horizontal, vertical, zero and saturated.
        assert.ok(Math.abs(farX - Math.abs(path.amplitudeX)) < 1e-5 && Math.abs(farY - Math.abs(path.amplitudeY)) < 1e-5, `${fx},${fy}`);
        assert.ok(farX <= SCENE_CONFIG.trackMaxLateralBendMeters + 1e-6 && farY <= SCENE_CONFIG.trackMaxVerticalBendMeters + 1e-6);
        if (fx === 0 && fy === 0) assert.equal(farX + farY, 0, 'zero focus is the exact straight track');
        assert.equal(runway.bendUniform.value.w, path.bendEndMeters, 'the far end follows the runway length');
        runway.dispose();
    }
});

test('a changing path is a uniform update: runway vertex buffers are never rewritten or re-uploaded', () => {
    const runway = new XrRunway(config), path = new XrTrackPath();
    const attributes = [runway.floor.geometry, runway.linework.geometry].flatMap(g => [g.getAttribute('position'), g.getAttribute('color')]);
    const versions = attributes.map(a => a.version), arrays = attributes.map(a => Array.from(a.array));
    for (const a of attributes) assert.equal(a.usage, THREE.StaticDrawUsage);
    for (let i = 0; i < 50; i++) {
        path.setFocus(Math.sin(i) * 0.4, Math.cos(i * 0.7) * 0.3);
        assert.equal(runway.applyPath(path), true);
        assert.equal(runway.applyPath(path), false, 'same revision does nothing');
        assert.deepEqual({ x: runway.bendUniform.value.x, y: runway.bendUniform.value.y }, { x: path.amplitudeX, y: path.amplitudeY });
    }
    assert.deepEqual(attributes.map(a => a.version), versions);
    assert.deepEqual(attributes.map(a => Array.from(a.array)), arrays);
    runway.dispose();
});

test('XR strike un-projection maps every rendered (GPU-bent) far point back onto its canonical point', () => {
    const path = pathWith(0.35, -0.25), runway = new XrRunway(config); runway.applyPath(path);
    const forward = SCENE_CONFIG.playfieldForwardMeters;
    const base = runway.linework.geometry.getAttribute('position').array;
    const rendered = renderedPositions(runway.linework.geometry, runway.bendUniform.value);
    let checked = 0;
    for (let i = 0; i < base.length; i += 3) {
        // Root space -> playfield space is a pure z shift (the playfield sits `forward` ahead of the root).
        const point = { x: rendered[i], y: rendered[i + 1], z: rendered[i + 2] + forward };
        path.unprojectPlayfieldPoint(point);
        assert.ok(Math.abs(point.x - base[i]) < 1e-5 && Math.abs(point.y - base[i + 1]) < 1e-5, `z=${base[i + 2]}`);
        const projected = path.projectPlayfieldPoint({ x: base[i], y: base[i + 1], z: base[i + 2] + forward });
        assert.ok(Math.abs(projected.x - rendered[i]) < 1e-5 && Math.abs(projected.y - rendered[i + 1]) < 1e-5);
        if (-base[i + 2] > SCENE_CONFIG.trackBendStartMeters) checked++;
    }
    assert.ok(checked > 100);
    // The float32 mirror of the shader and the CPU agree on the far end itself.
    const end = glslTrackOffset(runway.bendUniform.value, SCENE_CONFIG.runwayFrontZMeters);
    assert.ok(Math.abs(end.x - path.amplitudeX) < 1e-6 && Math.abs(end.y - path.amplitudeY) < 1e-6);
    runway.dispose();
});

test('Wormhole identity publishes a finite, deterministic route focus: centered when straight, displaced when bent', () => {
    const wormhole = createLoader();
    const { CosmicWormholeIdentity } = wormhole('visuals/CosmicWormholeIdentity.ts');
    const { State } = wormhole('state/store.ts');
    const backend = () => ({ width: 960, height: 540, frameCount: 1, beginFieldRaster() { return null; }, drawFieldRaster() {},
        background() {}, noStroke() {}, noFill() {}, fill() {}, stroke() {}, strokeWeight() {}, line() {}, circle() {}, triangle() {},
        beginShape() {}, vertex() {}, endShape() {}, radialGlow() {}, radialDim() {}, compositeRingTint() {} });
    State.bpm = 128; State.playbackFade = 1; State.isPlaying = true;
    const run = (bendH, bendV) => {
        const tuning = { wormholePathBend: bendH, wormholePathBendVertical: bendV, performanceMode: 0 };
        Object.assign(State.visualTuning, tuning); Object.assign(State.targetTuning, tuning);
        const identity = new CosmicWormholeIdentity(); identity.syncPosition(4);
        const series = [];
        for (let i = 0; i <= 90; i++) { State.currentTime = 4 + i / 30; identity.draw(backend(), [], []); series.push({ ...identity.routeFocus }); }
        return series;
    };
    const straight = run(0, 0);
    assert.ok(straight.every(f => Math.abs(f.x) < 1e-9 && Math.abs(f.y) < 1e-9), JSON.stringify(straight.at(-1)));
    const bent = run(1, 1), again = run(1, 1);
    assert.deepEqual(bent, again);
    assert.ok(bent.every(f => Number.isFinite(f.x) && Number.isFinite(f.y)));
    assert.ok(bent.some(f => Math.abs(f.x) > 1e-3) && bent.some(f => Math.abs(f.y) > 1e-3), JSON.stringify(bent.at(-1)));
});
