// XR Wormhole spatial field: one Points draw over fixed deterministic seeds, placed in real XR depth
// around the route by the shared track path, moving by the 2D grains' own law. Each particle is
// released on the image's emergence circle (tangent BACKDROP_TAN_PER_HEIGHT x tubeSpread) at a release
// distance d0 and sits at d0 x u, where u is the grains' normalized depth (falling by one per horizon of
// travel), so it appears exactly where and as fast as the grains, accelerating toward the edges. The GPU
// placement is mirrored here (`particleAt`), operation for operation with the vertex shader.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { glslTrackOffsetExtended } from './helpers/xr-track-bend.mjs';

const context = { clearRect() {}, fillRect() {}, fillText() {}, measureText: () => ({ width: 0 }) };
const load = createLoader({ three: THREE }, { document: { createElement: () => ({ getContext: () => context }) } });
const field = load('xr/scene/XrWormholeSpatialField.ts');
const { XrWormholeSpatialField, createSpatialFieldSeeds, SPATIAL_FIELD_PARTICLES, SPATIAL_FIELD_BEHIND_METERS, SPATIAL_FIELD_MIN_RADIUS_METERS,
    SPATIAL_FIELD_MAX_RADIUS_METERS, SPATIAL_FIELD_RENDER_ORDER, SPATIAL_FLOW_RADIANS, BACKDROP_TAN_PER_HEIGHT, SPATIAL_FIELD_MAX_SPEED_MPS,
    SPATIAL_STREAK_EXPOSURE_SEC, SPATIAL_MAX_STREAK_METERS, SPATIAL_MAX_STREAK_PX, SPATIAL_MOTION_GLSL, spatialEmergenceTangent,
    spatialFieldEmergeRange, spatialRelease, SPATIAL_FIELD_MIN_EMERGE_METERS } = field;
const { XrSpatialFlights } = load('xr/scene/XrSpatialFlights.ts');
const { XrTrackPath, TRACK_BEND_EXTENDED_GLSL } = load('xr/scene/XrTrackPath.ts');
const { SCENE_CONFIG, START_FRAME_HALF_WIDTH_METERS } = load('xr/scene/SceneConfig.ts');
const { RhythmGameScene } = load('xr/scene/RhythmGameScene.ts');
const { normalizeBackgroundSettings } = load('xr/XrBackgroundSettings.ts');
const { DEFAULT_RHYTHM_GAME_CONFIG: config } = load('gameplay/index.ts');
const { wormholeGrainFlowAngle } = load('visuals/WormholeGrainField.ts');

const spatial = (over = {}) => ({ time: 10, travel: 3.2, travelRate: 0.5, tubeSpread: 0.1, amount: 1, density: 1, radius: 0.5, depth: 0.5,
    spiralTurns: 0, turbulence: 0, streak: 0, wisp: 0, hue: 210, pulse: 0, impact: 0, ...over });
const uniformsOf = f => JSON.stringify(Object.fromEntries(Object.entries(f.uniforms).map(([k, v]) => [k, v.value])));
const attr = (f, name) => f.points.geometry.getAttribute(name).array;
const releaseOf = f => Array.from(attr(f, 'aRelease'));
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fround = Math.fround;

/** Mirror of `xrSpatialPoint(release, angleSeed, u)` (stage-root meters). */
function spatialPoint(uniforms, release, angleSeed, u) {
    const rootZ = -release[0] * u;
    const progress = Math.min(1, Math.max(0, 1 - u));
    const angle = -(angleSeed * 2 * Math.PI + (release[2] + uniforms.uTwist.value) * progress);
    const offset = glslTrackOffsetExtended(uniforms.uTrackBend.value, rootZ, uniforms.uTrackFarAim.value);
    const center = { x: offset.x, y: uniforms.uCenterY.value + offset.y };
    return { x: center.x + release[1] * Math.cos(angle), y: center.y + release[1] * Math.sin(angle), z: rootZ, center, angle, radius: release[1] };
}

/** Mirror of the vertex shader for particle `i`: placement, depth u and opacity. */
function particleAt(f, i) {
    const pos = attr(f, 'position'), seed = attr(f, 'aSeed'), rel = attr(f, 'aRelease'), u = f.uniforms;
    const release = [rel[i * 4], rel[i * 4 + 1], rel[i * 4 + 2], rel[i * 4 + 3]];
    const depth = attr(f, 'aDepth')[i];
    const p = spatialPoint(u, release, pos[i * 3], depth);
    const fade = (1 - smoothstep(0.88, 1, depth)) * (1 - smoothstep(1, SPATIAL_FIELD_BEHIND_METERS, p.z));
    const far = Math.min(1, Math.max(0, -p.z / u.uFarRef.value)) ** 1.5;
    const alpha = 0.6 * release[3] * fade * u.uAmount.value * (0.6 + 0.4 * seed[i * 2 + 1]) * (1 - 0.35 * far)
        * (1 - 1 * (1 - u.uDepth.value) * far) * (1 + 0.25 * u.uPulse.value);
    return { ...p, u: depth, release, far, fade, alpha, shown: release[3] === 1 };
}

const all = f => Array.from({ length: SPATIAL_FIELD_PARTICLES }, (_, i) => particleAt(f, i));

test('one Points draw over a fixed, deterministic seed geometry; complete disposal', () => {
    const a = new XrWormholeSpatialField(), b = new XrWormholeSpatialField();
    assert.ok(a.points instanceof THREE.Points);
    assert.equal(a.points.geometry.getAttribute('position').count, SPATIAL_FIELD_PARTICLES);
    assert.ok(SPATIAL_FIELD_PARTICLES >= 48 && SPATIAL_FIELD_PARTICLES <= 96, 'a sparse field');
    for (const name of ['position', 'aSeed']) {
        assert.deepEqual(Array.from(attr(a, name)), Array.from(attr(b, name)), `${name}: same seeds`);
        assert.ok(Array.from(attr(a, name)).every(v => v >= 0 && v < 1), `${name} in [0, 1)`);
    }
    assert.deepEqual(Array.from(createSpatialFieldSeeds().position), Array.from(attr(a, 'position')));
    assert.ok(Array.from(createSpatialFieldSeeds().flow).every(v => Math.abs(v) >= 0.6 && Math.abs(v) <= 1), 'signed flow rates');
    for (const name of ['aRelease', 'aDepth']) assert.equal(a.points.geometry.getAttribute(name).usage, THREE.DynamicDrawUsage, `${name} is written`);
    const material = a.points.material;
    assert.ok(material instanceof THREE.ShaderMaterial);
    assert.equal(material.transparent, true); assert.equal(material.depthWrite, false); assert.equal(material.depthTest, true, 'opaque targets occlude it');
    assert.equal(material.blending, THREE.AdditiveBlending);
    assert.ok(SPATIAL_FIELD_RENDER_ORDER > -98 && SPATIAL_FIELD_RENDER_ORDER < -10, 'after the backdrop planes, before the stage');
    assert.equal(a.points.renderOrder, SPATIAL_FIELD_RENDER_ORDER);
    assert.equal(a.points.visible, false, 'hidden until a Wormhole frame arrives');
    const disposed = [];
    a.points.geometry.addEventListener('dispose', () => disposed.push('geometry'));
    material.addEventListener('dispose', () => disposed.push('material'));
    a.wisps.mesh.geometry.addEventListener('dispose', () => disposed.push('wisp geometry'));
    a.wisps.mesh.material.addEventListener('dispose', () => disposed.push('wisp material'));
    assert.deepEqual(a.root.children, [a.wisps.mesh, a.points], 'one group: wisps then particles, nothing else');
    const parent = new THREE.Group(); parent.add(a.root);
    a.dispose();
    assert.deepEqual(disposed, ['geometry', 'material', 'wisp geometry', 'wisp material']); assert.equal(a.root.parent, null);
    b.dispose();
});

test('the source draws no randomness or wall clock, moves by no wave, and bends only through the shared track path', () => {
    for (const file of ['XrWormholeSpatialField', 'XrSpatialFlights', 'XrWormholeWisps']) {
        assert.doesNotMatch(readFileSync(`src/xr/scene/${file}.ts`, 'utf8'), /Math\.random|Date\.now|performance\.now|frameCount/, file);
    }
    const shader = new XrWormholeSpatialField().points.material.vertexShader;
    assert.ok(SPATIAL_MOTION_GLSL.startsWith(TRACK_BEND_EXTENDED_GLSL), 'the shared GLSL path, verbatim');
    assert.ok(shader.startsWith(SPATIAL_MOTION_GLSL), 'one motion law for particles and wisps');
    assert.match(SPATIAL_MOTION_GLSL, /xrTrackPathOffsetExtended\( rootZ \)/);
    assert.equal(shader.split('u * u').length, TRACK_BEND_EXTENDED_GLSL.split('u * u').length, 'no curve of its own');
    const motion = SPATIAL_MOTION_GLSL.slice(TRACK_BEND_EXTENDED_GLSL.length);
    assert.equal(motion.split('sin(').length - 1, 1, 'one sine: the circle around the route, never a wobble wave');
    assert.equal(shader.slice(SPATIAL_MOTION_GLSL.length).split('sin(').length - 1, 0);
    assert.match(motion, /release\.y \* vec2\( cos\( angle \), sin\( angle \) \)/);
    const source = readFileSync('src/xr/scene/XrWormholeSpatialField.ts', 'utf8');
    const imports = [...new Set([...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(m => m[1]))].sort();
    assert.deepEqual(imports, ['../../types/WormholeSpatialFrame', './XrFrameSignal', './XrSpatialFlights', './XrTrackPath', './XrWormholeWisps', 'three']);
});

test('the seed buffers are never touched; a release is written only when a particle starts a new flight', () => {
    const f = new XrWormholeSpatialField(), path = new XrTrackPath();
    const versions = () => ['position', 'aSeed'].map(n => f.points.geometry.getAttribute(n).version);
    const before = versions(), geometry = f.points.geometry, release = f.points.geometry.getAttribute('aRelease');
    f.update(10, spatial({ time: 10, travel: 3 }), path);
    let uploads = release.version, flights = 0, previous = Array.from(f.particleDepths);
    for (let i = 1; i < 200; i++) {
        const t = 10 + i / 72;
        path.setFocus(Math.sin(i) * 0.3, 0); f.update(t, spatial({ time: t, travel: 3 + (t - 10) * 0.5, spiralTurns: i % 2, turbulence: (i + 1) % 2 }), path);
        const now = Array.from(f.particleDepths);
        if (now.some((v, k) => v > previous[k])) flights++;
        previous = now;
    }
    assert.deepEqual(versions(), before); assert.equal(f.points.geometry, geometry);
    assert.ok(release.version - uploads <= flights, `${release.version - uploads} uploads for ${flights} frames with a new flight`);
    assert.ok(flights > 0 && flights < 100, 'a few particles per second start a flight, not every frame');
    uploads = release.version; f.update(10 + 199 / 72, spatial({ time: 10 + 199 / 72, travel: 3 + 199 / 72 * 0.5 }), path);
    assert.equal(release.version, uploads, 'pause: no release');
    f.dispose();
});

test('flights follow the grains\' normalized depth: u falls by one per horizon of travel, each flight from 1 to past the player', () => {
    const flights = new XrSpatialFlights([0, 0.25, 0.5, 0.75]), spans = [];
    flights.advance(10, true, i => { spans.push(i); return 1.2; });
    assert.ok(Array.from(flights.u).every((u, i) => Math.abs(u - [1, 0.7, 0.4, 0.1][i]) < 1e-12), 'a fresh start spreads them along their flights');
    flights.advance(10.1, false, () => { throw new Error('no release'); });
    assert.ok(Array.from(flights.u).every((u, i) => Math.abs(u - ([1, 0.7, 0.4, 0.1][i] - 0.1)) < 1e-12), 'one tenth of a horizon: u falls by a tenth');
    const released = [];
    flights.advance(10.5, false, i => { released.push(i); return 1.2; });
    assert.deepEqual(released, [3], 'only the flight that ended starts again');
    assert.ok(Math.abs(flights.u[3] - (1 - (10.5 - (10 - 0.9 + 1.2)))) < 1e-12, 'released exactly where the old flight ended');
    // A far jump restarts instead of looping; non-finite spans fall back to one horizon.
    flights.advance(1000, false, () => Number.NaN);
    assert.ok(Array.from(flights.u).every(u => u <= 1 && u > -1));
});

test('particles are born on the image\'s emergence circle and accelerate toward the edges exactly like the 2D grains', () => {
    // A 2D grain at normalized depth u appears tubeSpread / u canvas heights from the vanishing point;
    // a canvas height spans BACKDROP_TAN_PER_HEIGHT of tangent. A particle at distance d0 u, radius r = tan0 d0, appears tan0 / u.
    for (const tubeSpread of [0.03, 0.1, 0.25]) {
        const f = new XrWormholeSpatialField(), path = new XrTrackPath();
        path.setBackdropDistance(200);
        const tan0 = spatialEmergenceTangent(tubeSpread);
        assert.ok(Math.abs(tan0 - BACKDROP_TAN_PER_HEIGHT * tubeSpread) < 1e-15);
        f.update(10, spatial({ time: 10, tubeSpread, travel: 3 }), path);
        let shown = 0;
        for (const p of all(f)) {
            if (!p.shown) continue;
            shown++;
            assert.ok(Math.abs(p.release[1] / p.release[0] - tan0) < 1e-5 * tan0, 'released on the circle');
            if (p.u > 0.05) {
                const imageTan = BACKDROP_TAN_PER_HEIGHT * tubeSpread / p.u;
                assert.ok(Math.abs(p.radius / -p.z - imageTan) < 1e-4 * imageTan, `on the grains' own cone at u ${p.u.toFixed(3)}`);
            }
        }
        assert.ok(shown > SPATIAL_FIELD_PARTICLES / 2, `${tubeSpread}: most particles shown (${shown})`);
        // Over a flight, the angle from the route grows ever faster (1 / u): the edge acceleration.
        const i = all(f).findIndex(p => p.shown && p.u > 0.8);
        const tangents = [];
        for (let k = 1; k <= 30; k++) { f.update(10 + k / 72, spatial({ time: 10 + k / 72, tubeSpread, travel: 3 + k * 0.02, travelRate: 0.02 * 72 }), path); tangents.push(particleAt(f, i).radius / -particleAt(f, i).z); }
        const steps = tangents.slice(1).map((t, k) => t - tangents[k]);
        assert.ok(steps.every((s, k) => k === 0 || s > steps[k - 1]), 'each step outward is larger than the last');
        f.dispose();
    }
});

test('the emergence circle follows the Wormhole\'s radius changes: new flights take the new circle, flights under way keep theirs', () => {
    const f = new XrWormholeSpatialField(), path = new XrTrackPath();
    const a = spatial({ time: 10, travel: 3.2, tubeSpread: 0.06, density: 1 });
    f.update(10, a, path);
    const before = releaseOf(f), depthsA = Array.from(f.particleDepths);
    for (let k = 1; k < 64; k++) f.update(10 + k / 72, spatial({ ...a, time: 10 + k / 72, travel: 3.2 + 0.5 * k / 72 }), path);
    const settled = releaseOf(f);
    const b = spatial({ time: 10.9, travel: 3.65, tubeSpread: 0.2, turbulence: 1, density: 0.3 });
    f.update(10.9, b, path);
    const after = releaseOf(f), depthsB = Array.from(f.particleDepths), seeds = createSpatialFieldSeeds();
    let renewed = 0;
    for (let i = 0; i < SPATIAL_FIELD_PARTICLES; i++) {
        const slot = after.slice(i * 4, i * 4 + 4);
        if (depthsB[i] <= depthsA[i]) { assert.deepEqual(slot, before.slice(i * 4, i * 4 + 4), `particle ${i} keeps its flight`); continue; }
        if (settled.slice(i * 4, i * 4 + 4).join() === slot.join()) continue; // released earlier, under frame a
        renewed++;
        assert.ok(Math.abs(slot[1] / slot[0] - spatialEmergenceTangent(0.2)) < 1e-5, 'on the new, wider circle');
        assert.ok(Math.abs(slot[2] - SPATIAL_FLOW_RADIANS * seeds.flow[i]) < 1e-5, 'its own new current');
        assert.equal(slot[3], attr(f, 'aSeed')[i * 2] <= 0.3 ? 1 : 0, 'the new occupancy');
    }
    assert.ok(renewed >= 1 && renewed < SPATIAL_FIELD_PARTICLES / 3, `${renewed} particles started a new flight under frame b`);
    f.dispose();
});

test('releases: within the emerge range, outside the clearance, under the comfort cap where possible, hidden only when impossible', () => {
    const out = { distance: 0, radius: 0, shown: false };
    for (const [backdrop, range] of [[40, [12, 32]], [100, [25, 80]], [200, [50, 160]]]) {
        assert.deepEqual([...spatialFieldEmergeRange(backdrop)], range);
        assert.ok(range[1] < backdrop, 'in front of the backdrop plane');
    }
    assert.deepEqual([...spatialFieldEmergeRange(Number.NaN)], [12, 32], 'the reference plane');
    assert.ok(SPATIAL_FIELD_MIN_EMERGE_METERS >= 12, 'never born on the runway');
    const range = spatialFieldEmergeRange(200);
    for (const tan of [0.03, 0.09, 0.25, 0.6]) for (const rate of [0, 0.2, 0.5, 1, 3]) for (const q of [0, 0.5, 0.999]) {
        spatialRelease(q, tan, range, rate, SPATIAL_FIELD_MIN_RADIUS_METERS, SPATIAL_FIELD_MAX_RADIUS_METERS, out);
        assert.ok(out.shown);
        assert.ok(out.distance >= range[0] - 1e-9 && out.distance <= range[1] + 1e-9, 'in range');
        assert.ok(Math.abs(out.radius - tan * out.distance) < 1e-9, 'on the circle');
        assert.ok(out.radius >= SPATIAL_FIELD_MIN_RADIUS_METERS - 1e-9, 'outside the clearance');
        const low = Math.max(range[0], SPATIAL_FIELD_MIN_RADIUS_METERS / tan);
        if (rate > 0) assert.ok(out.distance * rate <= Math.max(SPATIAL_FIELD_MAX_SPEED_MPS, low * rate) + 1e-9, 'the comfort cap yields only to the clearance');
    }
    // A tunnel too narrow for the clearance within range: hidden, never inside the corridor.
    spatialRelease(0.5, 0.01, range, 0.5, SPATIAL_FIELD_MIN_RADIUS_METERS, SPATIAL_FIELD_MAX_RADIUS_METERS, out);
    assert.equal(out.shown, false);
    for (const bad of [Number.NaN, 0, -1]) assert.equal(spatialRelease(0.5, bad, range, 1, 2.4, 16, out).shown, false);
    assert.ok(spatialRelease(Number.NaN, 0.1, range, Number.NaN, 2.4, 16, out).shown && Number.isFinite(out.distance));
});

test('the field follows the shared route; its release distances follow the Background distance', () => {
    const f = new XrWormholeSpatialField(), path = new XrTrackPath();
    path.setFocus(0.35, -0.2); f.setCenterHeight(1.1);
    f.update(10, spatial(), path);
    assert.deepEqual({ ...f.uniforms.uTrackBend.value }, path.writeBendUniform({ x: 0, y: 0, z: 0, w: 0 }), 'the path\'s own uniform');
    assert.deepEqual({ ...f.uniforms.uTrackFarAim.value }, path.writeFarAimUniform({ x: 0, y: 0, z: 0, w: 0 }), 'and its far aim');
    const cpu = { x: 0, y: 0 };
    for (const p of all(f)) {
        path.offsetAtRootZExtended(p.z, cpu);
        assert.ok(Math.abs(p.center.x - cpu.x) < 1e-4 && Math.abs(p.center.y - 1.1 - cpu.y) < 1e-4, `centered on the path at ${p.z}`);
        if (p.z >= 0) assert.ok(Math.abs(p.center.x) < 1e-9 && Math.abs(p.center.y - 1.1) < 1e-9, 'straight beside and behind the player');
    }
    for (const distance of [40, 100, 200]) {
        path.setBackdropDistance(distance); f.update(10, spatial(), path);
        const range = spatialFieldEmergeRange(distance);
        assert.equal(f.uniforms.uFarRef.value, range[1]);
        for (const p of all(f)) assert.ok(p.release[0] >= range[0] - 1e-4 && p.release[0] <= range[1] + 1e-4, `${distance} m: released in range`);
    }
    f.dispose();
});

test('the field centers on the Wormhole\'s vanishing point even where the runway\'s bend saturates (left, right, up, down)', () => {
    for (const distance of [40, 100, 200]) for (const [fx, fy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [0.8, -0.9]]) {
        const f = new XrWormholeSpatialField(), path = new XrTrackPath();
        path.setBackdropDistance(distance); path.setFocus(fx, fy); f.setCenterHeight(1.2);
        f.update(10, spatial({ tubeSpread: 0.15 }), path);
        // The focal point on the scaled plane, from the route center line.
        const scale = distance / SCENE_CONFIG.backdropDistanceMeters;
        const focal = { x: fx * scale * SCENE_CONFIG.backdropWidthMeters / 2, y: fy * scale * SCENE_CONFIG.backdropHeightMeters / 2 };
        const atPlane = glslTrackOffsetExtended(f.uniforms.uTrackBend.value, -distance, f.uniforms.uTrackFarAim.value);
        assert.ok(Math.hypot(atPlane.x - focal.x, atPlane.y - focal.y) < 1e-3 * Math.max(1, Math.hypot(focal.x, focal.y)), `${distance} m, focus ${fx},${fy}: reaches the focal point`);
        // Every shown particle sits on the image's circle around the route center at its depth: the
        // same direction from the player as the 2D vanishing point, scaled by u.
        const tan0 = spatialEmergenceTangent(0.15);
        // At 40 m the runway's own (comfort-bounded) bend spans half the way, so the turn toward the focal point shows from 100 m on.
        for (const p of all(f).filter(q => distance >= 100 && q.shown && q.u > 0.6 && -q.z > 0.4 * distance)) {
            const dx = p.x - p.center.x, dy = p.y - p.center.y;
            assert.ok(Math.abs(Math.hypot(dx, dy) / -p.z - tan0 / p.u) < 1e-3 * tan0 / p.u, 'on the circle around the vanishing direction');
            const toward = { x: p.center.x / -p.z, y: (p.center.y - 1.2) / -p.z }, vanishing = { x: focal.x / distance, y: focal.y / distance };
            // Like the 2D tunnel's centre line, the centre turns toward the vanishing point with depth: the same direction, most of the way there.
            const along = (toward.x * vanishing.x + toward.y * vanishing.y) / Math.hypot(vanishing.x, vanishing.y) ** 2;
            const across = Math.abs(toward.x * vanishing.y - toward.y * vanishing.x) / Math.hypot(vanishing.x, vanishing.y);
            assert.ok(along > 0.35 && along < 1.05 && across < 0.05 * Math.hypot(vanishing.x, vanishing.y),
                `toward the vanishing point (${toward.x.toFixed(2)},${toward.y.toFixed(2)} vs ${vanishing.x.toFixed(2)},${vanishing.y.toFixed(2)})`);
        }
        f.dispose();
    }
});

test('no particle ever enters the player\'s space, the hit plane or the note corridor, even as it passes by', () => {
    const f = new XrWormholeSpatialField(), path = new XrTrackPath();
    const eye = SCENE_CONFIG.defaultEyeHeightMeters, middleHeight = eye - SCENE_CONFIG.hitHeightBelowEyesMeters;
    f.setCenterHeight(middleHeight);
    const corridor = Math.hypot(START_FRAME_HALF_WIDTH_METERS + config.noteSizeMeters / 2, 1.2 + config.noteSizeMeters / 2);
    const rails = Math.hypot(SCENE_CONFIG.runwayWidthMeters / 2, middleHeight);
    assert.ok(SPATIAL_FIELD_MIN_RADIUS_METERS > corridor + 0.5 && SPATIAL_FIELD_MIN_RADIUS_METERS > rails + 0.2,
        `clearance ${SPATIAL_FIELD_MIN_RADIUS_METERS} m vs corridor ${corridor.toFixed(2)} m, rails ${rails.toFixed(2)} m`);
    let nearest = Infinity;
    for (const [fx, fy] of [[0, 0], [0.6, 0.4], [-0.6, -0.4]]) {
        path.setFocus(fx, fy);
        for (let step = 0; step < 50; step++) {
            // Every extreme, each a seek (every particle released from it).
            f.update(step * 2, spatial({ time: step * 2, travel: step * 0.37, tubeSpread: [0.01, 0.05, 0.2, 0.6][step % 4], spiralTurns: step % 3,
                turbulence: (step % 4) / 3, travelRate: [0.1, 0.5, 2][step % 3] }), path);
            for (const p of all(f)) {
                if (!p.shown) continue;
                assert.ok(p.z >= -f.uniforms.uFarRef.value - 1e-3 && p.z <= SPATIAL_FIELD_BEHIND_METERS + 1e-3);
                assert.ok(Math.hypot(p.x - p.center.x, p.y - p.center.y) >= SPATIAL_FIELD_MIN_RADIUS_METERS - 1e-4);
                if (Math.abs(p.z) < 1) nearest = Math.min(nearest, Math.hypot(p.x, p.y - eye));
            }
        }
    }
    assert.ok(nearest > 1.8, `passes the eyes at ${nearest.toFixed(2)} m or more`);
    f.dispose();
});

test('a particle flies all the way past the player: visible from its emergence until it is behind them', () => {
    const f = new XrWormholeSpatialField(), path = new XrTrackPath(), i = 5;
    f.update(0, spatial({ time: 0, travel: 0, travelRate: 0.5 }), path);
    const samples = [];
    for (let k = 0; k <= 72 * 8; k++) {
        const t = k / 72; f.update(t, spatial({ time: t, travel: t * 0.5, travelRate: 0.5 }), path);
        samples.push(particleAt(f, i));
    }
    const wraps = samples.slice(1).filter((p, k) => p.u > samples[k].u).length;
    assert.ok(wraps >= 1 && wraps <= 5, `${wraps} releases in 8 s`);
    const passing = samples.filter(p => p.z > -0.5 && p.z < 0.5);
    assert.ok(passing.length > 0 && passing.every(p => p.fade === 1 && p.alpha > 0.1), 'fully shown while beside the player');
    assert.ok(samples.filter(p => p.z > -20 && p.z < -2).every(p => p.fade === 1), 'no early fade in front of the player');
    assert.ok(samples.filter(p => p.z >= SPATIAL_FIELD_BEHIND_METERS - 1e-3).every(p => p.alpha < 1e-6), 'gone once well behind');
    f.dispose();
});

test('the spiral turns the way the image turns: the live spiral turns of the frame, clockwise on screen with forward progress', () => {
    // Straight route on the view axis: a projected particle's screen angle is its angle around the route.
    const f = new XrWormholeSpatialField(), path = new XrTrackPath();
    const camera = new THREE.PerspectiveCamera(90, 1, 0.05, 600); camera.position.set(0, 1.3, 0); camera.updateMatrixWorld(true);
    f.setCenterHeight(1.3);
    const turns = 0.8;
    f.update(10, spatial({ time: 10, travel: 3, spiralTurns: turns }), path);
    assert.ok(Math.abs(f.uniforms.uTwist.value - 2 * Math.PI * turns) < 1e-12, 'the frame\'s own turns');
    const character = { flowPhase: 0, flowRate: 0, flowDirection: 1 };
    let checked = 0;
    for (let i = 0; i < SPATIAL_FIELD_PARTICLES; i++) {
        const p = particleAt(f, i);
        if (!p.shown || p.u < 0.2) continue;
        // The image: the same grain one horizon step later, in canvas angles (y down).
        const later = spatialPoint(f.uniforms, p.release, attr(f, 'position')[i * 3], p.u - 0.05);
        const canvasAngle = q => { const v = new THREE.Vector3(q.x, q.y, q.z).project(camera); return Math.atan2(-v.y, v.x); };
        const delta = Math.atan2(Math.sin(canvasAngle(later) - canvasAngle(p)), Math.cos(canvasAngle(later) - canvasAngle(p)));
        const image = wormholeGrainFlowAngle(character, p.u - 0.05, 0, 0, 0, turns) - wormholeGrainFlowAngle(character, p.u, 0, 0, 0, turns);
        assert.ok(image > 0 && Math.abs(delta - image) < 1e-4, `particle ${i}: ${delta.toFixed(4)} rad on screen, the image ${image.toFixed(4)}`);
        checked++;
    }
    assert.ok(checked > 20);
    // Live, like the image: a spiral morph (0.8 -> 0 turns over 0.5 s, 36 Hz background frames) turns the
    // particles in flight smoothly at headset rate, never in background-frame steps.
    const twists = [];
    for (let k = 1; k <= 54; k++) {
        const t = 10 + k / 72, frameTime = 10 + Math.floor(k / 2) / 36, turnsAt = Math.max(0, 0.8 - 1.6 * (frameTime - 10));
        f.update(t, spatial({ time: frameTime, travel: 3, spiralTurns: turnsAt }), path);
        twists.push(f.uniforms.uTwist.value);
    }
    const steps = twists.slice(1).map((v, k) => v - twists[k]).slice(2, 30);
    assert.ok(steps.every(d => d < 0) && Math.min(...steps) > 2.5 * Math.max(...steps), 'every display frame turns a little, never a jump');
    assert.ok(twists.at(-1) < 1e-9, 'settles on the new spiral');
    f.dispose();
});

test('particles in flight never sway with the music: release and distance from the route are fixed per flight', () => {
    const f = new XrWormholeSpatialField(), path = new XrTrackPath();
    f.setCenterHeight(1.1);
    const tracks = Array.from({ length: SPATIAL_FIELD_PARTICLES }, () => []);
    for (let k = 0; k <= 72 * 6; k++) {
        const t = k / 72;
        // The music flips every geometry parameter every frame.
        f.update(t, spatial({ time: t, travel: t * 0.6, travelRate: 0.6, tubeSpread: [0.05, 0.2][k % 2], turbulence: (k + 1) % 2, radius: (k % 3) / 2, density: 1 }), path);
        for (let i = 0; i < SPATIAL_FIELD_PARTICLES; i++) tracks[i].push(particleAt(f, i));
    }
    let checked = 0;
    for (const track of tracks) {
        for (let k = 1; k < track.length; k++) {
            const a = track[k - 1], b = track[k];
            if (b.u > a.u) continue; // released again
            assert.deepEqual(b.release, a.release, 'one release per flight');
            assert.ok(b.z > a.z, 'always approaching');
            checked++;
        }
    }
    assert.ok(checked > SPATIAL_FIELD_PARTICLES * 300);
    f.dispose();
});

test('travel follows song time smoothly between background frames: pause freezes it, a seek reproduces it, it never steps back', () => {
    const f = new XrWormholeSpatialField(), path = new XrTrackPath();
    let previous = null, worst = 0;
    for (let k = 0; k < 72 * 4; k++) {
        const t = 10 + k / 72, frameTime = 10 + Math.floor(k / 2) / 36;
        const travel = 3 + (frameTime - 10) * 0.5 + 0.02 * Math.sin(frameTime * 7);
        f.update(t, spatial({ time: frameTime, travel, travelRate: 0.5 * (k % 4 < 2 ? 1.3 : 0.7) }), path);
        const u = Array.from(f.particleDepths);
        if (previous) u.forEach((v, i) => { if (v <= previous[i]) { const step = previous[i] - v; worst = Math.max(worst, step); } });
        if (previous) assert.ok(u.every((v, i) => v <= previous[i] + 1e-12 || v > 0.5), 'never backward (except a new flight)');
        previous = u;
    }
    assert.ok(worst < 4 * 0.5 / 72, `no jumps: largest step ${worst.toFixed(4)} horizons`);
    const frame = spatial({ time: 20, travel: 8, travelRate: 0.5, spiralTurns: 0.4, turbulence: 0.6 });
    f.update(20.05, frame, path); f.update(20.1, frame, path);
    const paused = uniformsOf(f) + releaseOf(f) + Array.from(f.particleDepths); f.update(20.1, frame, path); f.update(20.1, frame, path);
    assert.equal(uniformsOf(f) + releaseOf(f) + Array.from(f.particleDepths), paused, 'pause: identical every frame');
    f.update(20.3, frame, path); const held = Array.from(f.particleDepths); f.update(20.5, frame, path);
    assert.deepEqual(Array.from(f.particleDepths), held, 'a stale frame holds instead of racing ahead');
    // A seek back releases every particle from the current frame: the same as a fresh field there.
    f.update(12, spatial({ time: 12, travel: 4, travelRate: 0.5 }), path);
    const g = new XrWormholeSpatialField(); g.update(12, spatial({ time: 12, travel: 4, travelRate: 0.5 }), path);
    assert.equal(uniformsOf(g), uniformsOf(f)); assert.deepEqual(releaseOf(g), releaseOf(f));
    assert.deepEqual(Array.from(g.particleDepths), Array.from(f.particleDepths));
    // A restart: song time starts over while the old playthrough's last frame is still shown, then
    // the first new frame arrives with the travel started over. The flow restarts from it (as a fresh
    // field there) and keeps flowing, instead of holding the old, larger travel.
    const r = new XrWormholeSpatialField();
    for (let k = 0; k <= 72; k++) r.update(30 + k / 72, spatial({ time: 30 + Math.floor(k / 3) / 24, travel: 15 + Math.floor(k / 3) / 48, travelRate: 0.5 }), path);
    const stale = spatial({ time: 31, travel: 15.5, travelRate: 0.5 });
    for (let k = 0; k < 6; k++) r.update(k / 72, stale, path);
    const first = spatial({ time: 0.05, travel: 0.025, travelRate: 0.5 });
    r.update(6 / 72, first, path);
    const restarted = new XrWormholeSpatialField(); restarted.update(6 / 72, first, path);
    assert.deepEqual(Array.from(r.particleDepths), Array.from(restarted.particleDepths), 'restarted from the new frame');
    assert.deepEqual(releaseOf(r), releaseOf(restarted));
    let flowing = Array.from(r.particleDepths);
    for (let k = 7; k < 72; k++) {
        const frameTime = 0.05 + Math.floor((k - 6) / 3) / 24;
        r.update(k / 72, spatial({ time: frameTime, travel: frameTime / 2, travelRate: 0.5 }), path);
        const now = Array.from(r.particleDepths);
        assert.ok(now.some((v, i) => v < flowing[i]), `flows after the restart (display frame ${k})`);
        flowing = now;
    }
    // The same without a frame-time hint: a travel drop beyond any extrapolation overshoot restarts too.
    const d = new XrWormholeSpatialField();
    d.update(5, spatial({ time: 5, travel: 20, travelRate: 0.5 }), path);
    d.update(5 + 1 / 72, spatial({ time: 5 + 1 / 72, travel: 2, travelRate: 0.5 }), path);
    const dropped = new XrWormholeSpatialField(); dropped.update(5 + 1 / 72, spatial({ time: 5 + 1 / 72, travel: 2, travelRate: 0.5 }), path);
    assert.deepEqual(Array.from(d.particleDepths), Array.from(dropped.particleDepths), 'a large travel drop starts over');
    r.dispose(); restarted.dispose(); d.dispose(); dropped.dispose();
    // A long song's travel stays exact: u is computed in double precision on the CPU.
    const h = new XrWormholeSpatialField(); h.update(600, spatial({ time: 600, travel: 4321.123456, travelRate: 1 }), path);
    h.update(600 + 1 / 72, spatial({ time: 600, travel: 4321.123456, travelRate: 1 }), path);
    const step = Array.from(h.particleDepths).map((u, i) => u);
    assert.ok(step.every(u => u <= 1 && u > -1), 'bounded depths after a long song');
    f.dispose(); g.dispose(); h.dispose();
});

test('hidden without a usable Wormhole state or when switched off; non-finite inputs fail safe', () => {
    const f = new XrWormholeSpatialField(), path = new XrTrackPath();
    f.update(1, spatial(), path); assert.equal(f.points.visible, true);
    f.update(1, null, path); assert.equal(f.points.visible, false, 'no background frame');
    f.update(1, spatial(), path); f.update(1, spatial({ amount: 0 }), path); assert.equal(f.points.visible, false, 'no presence');
    f.update(Number.NaN, spatial(), path); assert.equal(f.points.visible, false, 'no song time');
    f.update(1, spatial({ travel: Number.NaN }), path); assert.equal(f.points.visible, false, 'no travel');
    f.update(1, spatial({ time: Number.NaN, hue: Number.NaN, radius: Number.NaN, density: Number.NaN, spiralTurns: Number.NaN, turbulence: Number.NaN,
        tubeSpread: Number.NaN, travelRate: Number.NaN }), path);
    assert.equal(f.points.visible, true);
    for (const value of Object.values(JSON.parse(uniformsOf(f)))) {
        for (const n of typeof value === 'number' ? [value] : Object.values(value)) assert.ok(Number.isFinite(n), uniformsOf(f));
    }
    assert.ok(releaseOf(f).every(Number.isFinite) && Array.from(f.particleDepths).every(Number.isFinite));
    assert.ok(all(f).every(p => !p.shown), 'no circle: nothing shown');
    f.setCenterHeight(Number.NaN); assert.ok(Number.isFinite(f.uniforms.uCenterY.value));
    f.setMode('off'); assert.equal(f.mode, 'off'); assert.equal(f.points.visible, false);
    f.update(1, spatial({ wisp: 1 }), path); assert.equal(f.points.visible, false, 'switched off: no draw at all');
    assert.equal(f.wisps.mesh.visible, false);
    f.setMode('particles'); f.update(1, spatial({ wisp: 1 }), path);
    assert.equal(f.points.visible, true); assert.equal(f.wisps.mesh.visible, false, 'particles only: no wisp draw');
    f.setMode('full'); f.update(1, spatial({ wisp: 1 }), path); assert.equal(f.wisps.mesh.visible, true);
    f.setMode('bogus'); assert.equal(f.mode, 'full');
    f.dispose();
});

test('density gates how many particles a flight releases; a wider tunnel releases on a wider circle', () => {
    const shown = density => { const f = new XrWormholeSpatialField(); f.update(1, spatial({ density }), new XrTrackPath());
        const n = all(f).filter(p => p.shown).length; f.dispose(); return n; };
    assert.equal(shown(1), SPATIAL_FIELD_PARTICLES);
    const sparse = shown(0.35), half = shown(0.5);
    assert.ok(Math.abs(sparse - 0.35 * SPATIAL_FIELD_PARTICLES) <= 2 && Math.abs(half - 0.5 * SPATIAL_FIELD_PARTICLES) <= 2, `${sparse}, ${half}`);
    const angle = tubeSpread => { const f = new XrWormholeSpatialField(), path = new XrTrackPath(); path.setBackdropDistance(200);
        f.update(1, spatial({ tubeSpread }), path); const p = all(f).find(q => q.shown); f.dispose(); return p.release[1] / p.release[0]; };
    assert.ok(angle(0.25) > angle(0.05) * 4, 'the circle widens with the tube');
});

function sceneHarness() {
    const sources = [];
    const scene = new RhythmGameScene(new THREE.Scene(), undefined, options => {
        const source = { options, canvas: { width: 64, height: 36 }, focalPoint: { x: 0.2, y: 0 }, spatialFrame: spatial({ time: 1 }),
            async prepare() {}, render: () => true, setPresentation() {}, dispose() {} };
        sources.push(source);
        return source;
    });
    const snapshot = { state: 'playing', score: 0, combo: 0, maxCombo: 0, hitCount: 0, missCount: 0, totalNotes: 0 };
    return { scene, sources, snapshot };
}

test('the scene owns one decorative field in stage-root space, shown only with the Wormhole', async () => {
    const { scene, sources, snapshot } = sceneHarness();
    const f = scene.spatialField;
    assert.equal(f.root.parent, scene.root, 'beside the floor, never under the playfield');
    assert.ok(!scene.playfield.getObjectById(f.points.id) && !scene.playfield.getObjectById(f.wisps.mesh.id));
    assert.ok(f.root.position.equals(new THREE.Vector3()) && f.root.quaternion.equals(new THREE.Quaternion()) && f.root.scale.equals(new THREE.Vector3(1, 1, 1)),
        'identity transform: stage-root space');
    scene.update([], 1, snapshot, '');
    assert.equal(f.points.visible, false, 'no Wormhole: no field');
    await scene.setWormholeEnabled(true);
    scene.update([], 1, snapshot, '');
    assert.equal(f.points.visible, true);
    assert.deepEqual({ ...f.uniforms.uTrackBend.value }, scene.path.writeBendUniform({ x: 0, y: 0, z: 0, w: 0 }), 'the same path as the runway');
    assert.ok(Math.abs(f.uniforms.uCenterY.value - scene.playfield.position.y) < 1e-12, 'centered on the playfield rows');
    assert.equal(f.uniforms.uFarRef.value, spatialFieldEmergeRange(200)[1], 'the default 200 m background');
    sources[0].spatialFrame = null; scene.update([], 1.1, snapshot, '');
    assert.equal(f.points.visible, false, 'a frame without spatial state hides it');
    sources[0].spatialFrame = spatial({ time: 1.1 }); scene.update([], 1.1, snapshot, '');
    await scene.setBackgroundSettings(normalizeBackgroundSettings({ spatialField: 'off' }));
    scene.update([], 1.15, snapshot, ''); assert.equal(f.points.visible, false, 'switched off');
    await scene.setBackgroundSettings(normalizeBackgroundSettings({ spatialField: 'particles' }));
    scene.update([], 1.16, snapshot, ''); assert.equal(f.points.visible, true); assert.equal(f.wisps.mesh.visible, false);
    await scene.setBackgroundSettings(normalizeBackgroundSettings({}));
    assert.equal(f.mode, 'particles', 'the default');
    await scene.setWormholeEnabled(false);
    scene.update([], 1.2, snapshot, '');
    assert.equal(f.points.visible, false, 'background off: field off');
    const disposed = [];
    f.points.geometry.addEventListener('dispose', () => disposed.push('geometry'));
    scene.dispose();
    assert.deepEqual(disposed, ['geometry']);
});

// ---------------------------------------------------------------- frame values continued at headset rate
const { XrFrameSignal, FRAME_SIGNAL_MAX_LEAD_SEC, FRAME_SIGNAL_BLEND_SEC } = load('xr/scene/XrFrameSignal.ts');

test('a frame value is continued along its slope to the song time drawn and crossfades into the next frame', () => {
    for (const wobble of [0, 0.01]) {
        const signal = new XrFrameSignal();
        let previous = null, worst = 0, smallest = Infinity, largest = 0;
        for (let k = 0; k < 72 * 2; k++) {
            const t = k / 72, frame = Math.floor(k / 2), frameTime = frame / 36 + (frame % 2 ? 0.004 : -0.003);
            const v = signal.sample(t, frameTime, frameTime + wobble * Math.sin(frameTime * 40));
            if (previous !== null && k > 24) {
                const step = (v - previous) * 72;
                worst = Math.max(worst, Math.abs(step - 1)); smallest = Math.min(smallest, step); largest = Math.max(largest, step);
            }
            previous = v;
        }
        if (wobble === 0) assert.ok(worst < 0.02, `a steady value moves exactly at its rate every display frame (worst ${worst.toFixed(3)})`);
        else assert.ok(smallest > 0 && largest < 2.5, `a wobbling value never stops, steps back or jumps (${smallest.toFixed(2)}..${largest.toFixed(2)} x rate)`);
    }
    const rated = new XrFrameSignal();
    assert.equal(rated.sample(5, 5, 2, 3), 2);
    assert.ok(Math.abs(rated.sample(5.05, 5, 2, 3) - 2.15) < 1e-12);
    assert.ok(Math.abs(rated.sample(9, 5, 2, 3) - (2 + 3 * FRAME_SIGNAL_MAX_LEAD_SEC)) < 1e-12);
    const paused = rated.sample(9, 5, 2, 3); assert.equal(rated.sample(9, 5, 2, 3), paused);
    assert.equal(rated.sample(1, 1, 7, 0), 7, 'a step back is a seek: no blend from the old trajectory');
    // A restart: song time runs on from 0 under the old playthrough's stale frame, then an older
    // frame arrives: shown as is, not blended from the stale trajectory.
    const restart = new XrFrameSignal();
    restart.sample(30, 30, 15, 0.5); restart.sample(0, 30, 15, 0.5); restart.sample(0.03, 30, 15, 0.5);
    assert.ok(Math.abs(restart.sample(0.04, 0.02, 0.01, 0.5) - 0.02) < 1e-12, 'an older frame starts over');
    const blend = new XrFrameSignal();
    blend.sample(0, 0, 0, 1); const before = blend.sample(0.05, 0, 0, 1);
    const arrival = blend.sample(0.05, 0.04, 0.2, 1);
    assert.ok(Math.abs(arrival - before) < 1e-12, 'no jump when the next frame arrives');
    assert.ok(Math.abs(blend.sample(0.05 + FRAME_SIGNAL_BLEND_SEC, 0.04, 0.2, 1) - (0.2 + 0.01 + FRAME_SIGNAL_BLEND_SEC)) < 1e-12);
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) assert.ok(Number.isFinite(new XrFrameSignal().sample(bad, 0, 1)));
    assert.equal(new XrFrameSignal().sample(1, 1, Number.NaN), 0);
    assert.doesNotMatch(readFileSync('src/xr/scene/XrFrameSignal.ts', 'utf8'), /Date\.now|performance\.now|Math\.random/, 'song time only');
});

test('the runway bend follows the displayed focus at headset rate, not in background-frame steps', async () => {
    const { scene, sources, snapshot } = sceneHarness();
    await scene.setWormholeEnabled(true);
    const xs = [];
    for (let k = 0; k < 72; k++) {
        const t = 1 + k / 72, frameTime = 1 + Math.floor(k / 2) / 36;
        sources[0].focalPoint = { x: 0.1 + 0.3 * (frameTime - 1), y: 0 };
        sources[0].spatialFrame = spatial({ time: frameTime });
        scene.update([], t, snapshot, '');
        xs.push(scene.path.focusX);
    }
    const steps = xs.slice(10).map((x, i) => x - xs[9 + i]);
    assert.ok(steps.every(d => d > 0), 'the focus moves on every display frame (no held frames)');
    assert.ok(Math.max(...steps) < 2.5 * Math.min(...steps), `even steps: ${Math.min(...steps).toFixed(5)}..${Math.max(...steps).toFixed(5)}`);
    const revision = scene.path.revision; scene.update([], 1 + 71 / 72, snapshot, '');
    assert.equal(scene.path.revision, revision);
    scene.dispose();
});

test('core + halo material: one analytic sprite in the Wormhole\'s own colours, bounded, softer and hazier with depth', () => {
    const f = new XrWormholeSpatialField(), path = new XrTrackPath();
    const { fragmentShader, vertexShader } = f.points.material;
    assert.doesNotMatch(fragmentShader, /texture2D|sampler2D/, 'analytic: no texture fetch');
    assert.match(fragmentShader, /exp\( -r2 \* mix\( 20\.0, 9\.0, vFar \) \)/, 'crisp near core, softer far core');
    assert.match(fragmentShader, /halo \*= halo \* halo;/);
    assert.match(vertexShader, /uPixelScale \/ depth,\s+2\.5, 22\.0 \)/, 'bounded dot: no giant near billboards');
    assert.match(vertexShader, /gl_PointSize = shown > 0\.0 && clipHead\.w > 0\.1 \? side : 0\.0;/, 'nothing behind the eye');
    const shade = (r2, far) => ({ core: Math.exp(-r2 * (20 + (9 - 20) * far)), halo: Math.max(1 - r2, 0) ** 3 * 0.5 });
    assert.equal(shade(1, 0).halo, 0); assert.ok(shade(1, 1).core < 2e-4, 'nothing visible at the edge');
    assert.ok(shade(0, 0).core === 1 && shade(0, 0).halo === 0.5, 'bright core over a softer halo');
    assert.ok(shade(0.05, 1).core > shade(0.05, 0).core, 'far cores are wider (softer)');
    f.update(1, spatial({ red: 0.9, green: 0.2, blue: 0.6, hazeRed: 96 / 255, hazeGreen: 108 / 255, hazeBlue: 160 / 255 }), path);
    const srgb = color => { const c = color.clone(); c.convertLinearToSRGB(); return [c.r, c.g, c.b]; };
    const halo = srgb(f.uniforms.uHalo.value), core = srgb(f.uniforms.uCore.value), haze = srgb(f.uniforms.uHaze.value);
    for (const [a, b] of [[halo, [0.9, 0.2, 0.6]], [haze, [96 / 255, 108 / 255, 160 / 255]]]) a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-4, `${a} vs ${b}`));
    core.forEach((v, i) => assert.ok(v >= halo[i] && v <= 1, 'the core is the same colour, whitened'));
    assert.ok(core[0] - core[1] < halo[0] - halo[1], 'whitening reduces the colour spread, keeps the hue order');
    f.dispose();
});

test('dramaturgy at release: each particle keeps its own flow current; depth keeps far particles; transients lift brightness', () => {
    const released = over => { const f = new XrWormholeSpatialField(); f.update(1, spatial(over), new XrTrackPath()); return f; };
    const seeds = createSpatialFieldSeeds();
    const straight = released({}), flowing = released({ turbulence: 1 });
    for (let i = 0; i < SPATIAL_FIELD_PARTICLES; i++) {
        assert.ok(attr(straight, 'aRelease')[i * 4 + 2] === 0, 'no turbulence: no current of its own');
        assert.ok(Math.abs(attr(flowing, 'aRelease')[i * 4 + 2] - SPATIAL_FLOW_RADIANS * seeds.flow[i]) < 1e-5, 'its own current');
        assert.equal(particleAt(flowing, i).z, particleAt(straight, i).z, 'a current never moves a particle in depth');
        assert.equal(particleAt(flowing, i).radius, particleAt(straight, i).radius, 'nor radially');
    }
    assert.ok(seeds.flow.some(v => v < 0) && seeds.flow.some(v => v > 0), 'currents in both directions: never one rotating plate');
    const farAlpha = f => all(f).filter(p => p.far > 0.5).reduce((s, p) => s + p.alpha, 0);
    const nearAlpha = f => all(f).filter(p => p.far < 0.05).reduce((s, p) => s + p.alpha, 0);
    const deep = released({ depth: 0.9 }), shallow = released({ depth: 0.2 });
    assert.ok(farAlpha(deep) > farAlpha(shallow) * 1.5, 'a deep Wormhole keeps its far particles, a shallow one fades them');
    assert.ok(Math.abs(nearAlpha(deep) - nearAlpha(shallow)) < 0.05 * nearAlpha(deep) + 1e-9, 'near particles stay (almost) the same either way');
    const lit = released({ pulse: 1, impact: 1 }); assert.equal(lit.uniforms.uPulse.value, 1);
    const half = released({ pulse: 0.5, impact: 0 }); assert.ok(Math.abs(half.uniforms.uPulse.value - 0.3) < 1e-12);
    assert.match(lit.points.material.vertexShader, /\( 1\.0 \+ 0\.25 \* uPulse \)/, 'a transient lifts brightness by at most a quarter');
    for (const f of [straight, flowing, deep, shallow, lit, half]) f.dispose();
});

// ---------------------------------------------------------------- streaks: the same particles, stretched along their own motion
test('streaks are as long as the 2D grain trails: continuity x 1/24 s of travel, bounded in meters and on screen', () => {
    assert.ok(Math.abs(SPATIAL_STREAK_EXPOSURE_SEC - 2 / 24) < 1e-12, 'streak = continuity / 2; the 2D trail spans continuity x 1/24 s');
    const f = new XrWormholeSpatialField(), path = new XrTrackPath();
    f.update(1, spatial({ streak: 0.4, travelRate: 0.8 }), path);
    assert.ok(Math.abs(f.uniforms.uTrailDu.value - 0.4 * SPATIAL_STREAK_EXPOSURE_SEC * 0.8) < 1e-12, 'the exposure in horizons of travel');
    f.update(1, spatial({ streak: 0.4, travelRate: 0 }), path); assert.equal(f.uniforms.uTrailDu.value, 0, 'at rest: a point');
    const shader = f.points.material.vertexShader;
    assert.ok(shader.includes(`min( uTrailDu, ${SPATIAL_MAX_STREAK_METERS.toFixed(2)} / max( aRelease.x, 1.0 ) )`), 'bounded in meters');
    assert.match(shader, new RegExp(`trailPx > ${SPATIAL_MAX_STREAK_PX.toFixed(1)}`), 'bounded on screen');
    assert.equal(shader.split('xrSpatialPoint( aRelease, position.x,').length - 1, 2, 'one placement law, for the head and for the tail');
    f.dispose();
});

test('streak orientation comes from the particle\'s own projected motion: head nearer, outward from the vanishing point', () => {
    const f = new XrWormholeSpatialField(), path = new XrTrackPath();
    const camera = new THREE.PerspectiveCamera(90, 1, 0.05, 600); camera.position.set(0, 1.65, 0); camera.updateMatrixWorld(true);
    f.setCenterHeight(1.65);
    f.update(1, spatial({ streak: 1, travelRate: 1, spiralTurns: 0.3, turbulence: 0.5 }), path);
    const du = f.uniforms.uTrailDu.value;
    assert.ok(du > 0);
    let checked = 0;
    for (let i = 0; i < SPATIAL_FIELD_PARTICLES; i++) {
        const p = particleAt(f, i);
        if (!p.shown) continue;
        const tail = spatialPoint(f.uniforms, p.release, attr(f, 'position')[i * 3], Math.min(p.u + Math.min(du, SPATIAL_MAX_STREAK_METERS / p.release[0]), 1));
        assert.ok(p.z >= tail.z, 'the head is nearer the player than the tail');
        if (p.z > -3 || p.u > 0.99) continue;
        const h = new THREE.Vector3(p.x, p.y, p.z).project(camera), tl = new THREE.Vector3(tail.x, tail.y, tail.z).project(camera);
        if (Math.abs(h.x) > 1 || Math.abs(h.y) > 1) continue;
        assert.ok(Math.hypot(h.x, h.y) >= Math.hypot(tl.x, tl.y) - 1e-9, `particle ${i} streaks outward`);
        checked++;
    }
    assert.ok(checked > 10);
    assert.doesNotMatch(f.points.material.fragmentShader, /uRotation|random|hash/, 'no screen-space rotation of its own');
    f.dispose();
});

test('the streak sprite: a capsule that always fits its sprite, a bright head and a fading tail; still particles stay round', () => {
    const shade = (cx, cy, h, rd) => {
        const along = Math.min(h, Math.max(-h, cx));
        const qx = (cx - along) / Math.max(rd, 0.001), qy = cy / Math.max(rd, 0.001);
        const r2 = qx * qx + qy * qy;
        const taper = h > 0 ? 0.3 + 0.7 * (0.5 + 0.5 * along / h) : 1;
        return (Math.exp(-r2 * 20) + Math.max(1 - r2, 0) ** 3 * 0.5) * taper;
    };
    for (const [x, y] of [[0, 0], [0.3, 0.2], [-0.7, 0.1]]) {
        const r2 = x * x + y * y;
        assert.ok(Math.abs(shade(x, y, 0, 1) - (Math.exp(-r2 * 20) + Math.max(1 - r2, 0) ** 3 * 0.5)) < 1e-12);
    }
    for (const [trailPx, dotPx] of [[0, 10], [10, 10], [40, 4], [40, 22]]) {
        const side = dotPx + trailPx, h = trailPx / side, rd = dotPx / side;
        assert.ok(Math.abs(h + rd - 1) < 1e-12, 'the capsule spans the sprite exactly');
        for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.ok(shade(x, y, h, rd) < 1e-3, `edge ${x},${y} dark for ${trailPx}/${dotPx}`);
        if (h > 0) assert.ok(shade(h, 0, h, rd) > shade(-h, 0, h, rd) * 2, 'head brighter than tail');
    }
    assert.ok(SPATIAL_MAX_STREAK_PX + 22 <= 64, 'largest sprite stays small (no screen-filling bars)');
});

// ---------------------------------------------------------------- wisps: the Nebula's soft volume, carried by the same tunnel
const wispsModule = load('xr/scene/XrWormholeWisps.ts');
const { SPATIAL_WISPS, WISP_RADIUS_RANGE_METERS, WISP_HALF_SIZE_RANGE_METERS, WISP_CLEARANCE_METERS, WISP_END_METERS, WISP_DISSOLVE_METERS,
    WISP_RENDER_ORDER, WISP_ELONGATION, createWispSeeds } = wispsModule;
const wispAttr = (f, name) => f.wisps.mesh.geometry.getAttribute(name).array;

/** Mirror of the wisp vertex shader's center and fade for wisp `k`. */
function wispAt(f, k) {
    const rel = wispAttr(f, 'aWispRelease'), u = wispAttr(f, 'aWispDepth')[k], seed = wispAttr(f, 'aWisp');
    const release = [rel[k * 4], rel[k * 4 + 1], rel[k * 4 + 2], rel[k * 4 + 3]];
    const c = spatialPoint(f.wisps.uniforms, release, seed[k * 4], u);
    const fade = (1 - smoothstep(0.8, 1, u)) * smoothstep(WISP_END_METERS, WISP_END_METERS + WISP_DISSOLVE_METERS, -c.z) * smoothstep(-2, 0, c.y);
    return { ...c, u, release, fade, shown: release[3] === 1 };
}

test('wisps: one instanced draw of a few soft quads that shares the field\'s path, motion, spiral, colours and center', () => {
    const f = new XrWormholeSpatialField(), w = f.wisps;
    assert.ok(w.mesh.geometry instanceof THREE.InstancedBufferGeometry);
    assert.equal(w.mesh.geometry.instanceCount, SPATIAL_WISPS);
    assert.ok(SPATIAL_WISPS >= 3 && SPATIAL_WISPS <= 8);
    assert.equal(w.mesh.geometry.getAttribute('position').count, 4, 'one quad, instanced');
    const m = w.mesh.material;
    assert.ok(m.transparent && !m.depthWrite && m.depthTest && m.blending === THREE.AdditiveBlending);
    assert.ok(WISP_RENDER_ORDER > -98 && WISP_RENDER_ORDER < SPATIAL_FIELD_RENDER_ORDER, 'behind the particles, in front of the backdrop');
    for (const name of ['uTrackBend', 'uTrackFarAim', 'uCenterY', 'uTwist', 'uHalo', 'uHaze']) assert.equal(w.uniforms[name], f.uniforms[name], `${name}: the field's own uniform`);
    assert.ok(m.vertexShader.startsWith(SPATIAL_MOTION_GLSL), 'the particles\' own motion law');
    assert.doesNotMatch(m.fragmentShader, /texture2D|sampler2D/, 'analytic breakup, no noise texture');
    assert.ok((m.fragmentShader.match(/sin\( p\./g) ?? []).length <= 2, 'at most two breakup waves: no multi-octave noise');
    assert.deepEqual(Array.from(createWispSeeds().wisp), Array.from(w.mesh.geometry.getAttribute('aWisp').array), 'deterministic seeds');
    assert.equal(w.mesh.visible, false);
    f.dispose();
});

test('wisps fly with the tunnel: born on the emergence circle, approaching with the travel, dissolving before the player', () => {
    const f = new XrWormholeSpatialField(), path = new XrTrackPath();
    path.setBackdropDistance(200); f.setCenterHeight(1.2);
    const tracks = Array.from({ length: SPATIAL_WISPS }, () => []);
    for (let k = 0; k <= 72 * 10; k++) {
        const t = k / 72;
        f.update(t, spatial({ time: t, travel: t * 0.3, travelRate: 0.3, wisp: 1, tubeSpread: 0.12 }), path);
        for (let w = 0; w < SPATIAL_WISPS; w++) tracks[w].push(wispAt(f, w));
    }
    let moved = 0, releases = 0;
    for (const track of tracks) {
        for (let k = 1; k < track.length; k++) {
            const a = track[k - 1], b = track[k];
            if (b.u > a.u) { releases++; continue; }
            if (!b.shown) continue;
            assert.ok(b.z > a.z, 'always approaching (never standing still)');
            moved++;
        }
        for (const p of track.filter(q => q.shown)) {
            assert.ok(Math.abs(p.release[1] / p.release[0] - spatialEmergenceTangent(0.12)) < 1e-5, 'released on the circle');
            assert.ok(p.release[1] >= WISP_RADIUS_RANGE_METERS[0] - 1e-4, 'outside the particles\' clearance');
            if (-p.z <= WISP_END_METERS + 1e-3) assert.equal(p.fade, 0, 'gone before it reaches the player');
        }
    }
    assert.ok(moved > SPATIAL_WISPS * 300 && releases >= SPATIAL_WISPS, `${moved} moving frames, ${releases} releases`);
    // The same travel after a seek gives the same wisps; pause holds them.
    const g = new XrWormholeSpatialField(); g.setCenterHeight(1.2);
    const frame = spatial({ time: 5, travel: 1.5, travelRate: 0.3, wisp: 1, tubeSpread: 0.12 });
    f.update(5, frame, path); g.update(5, frame, path);
    assert.deepEqual(Array.from(wispAttr(f, 'aWispDepth')), Array.from(wispAttr(g, 'aWispDepth')));
    assert.deepEqual(Array.from(wispAttr(f, 'aWispRelease')), Array.from(wispAttr(g, 'aWispRelease')));
    f.dispose(); g.dispose();
});

test('wisps appear only as the Wormhole\'s soft-volume tendency calls for them, continuously, and fade fully out', () => {
    const f = new XrWormholeSpatialField(), path = new XrTrackPath();
    f.update(1, spatial({ wisp: 0 }), path); assert.equal(f.wisps.mesh.visible, true); assert.equal(f.wisps.uniforms.uWispCount.value, 0);
    f.update(1, spatial({ wisp: 0.001 }), path); assert.equal(f.wisps.uniforms.uWispCount.value, 0, 'a negligible tendency is none');
    assert.match(f.wisps.mesh.material.vertexShader, /float halfSize = shown > 0.0 \?/, 'a hidden wisp has no area');
    f.update(1, spatial({ wisp: 0.45 }), path);
    assert.equal(f.wisps.mesh.visible, true); assert.ok(Math.abs(f.wisps.uniforms.uWispCount.value - 0.45 * SPATIAL_WISPS) < 1e-12);
    f.update(1, spatial({ wisp: 0.89 }), path); assert.ok(f.wisps.uniforms.uWispCount.value > 7);
    f.update(1, spatial({ wisp: 0.5, amount: 0.5 }), path); assert.equal(f.wisps.uniforms.uWispPresence.value, 0.5, 'follows the field presence');
    f.update(1, spatial({ wisp: 0.5, amount: 0 }), path); assert.equal(f.wisps.mesh.visible, false);
    f.update(1, spatial({ wisp: 0.5 }), path); f.update(1, null, path); assert.equal(f.wisps.mesh.visible, false, 'no background: no wisps');
    f.update(1, spatial({ wisp: Number.NaN }), path); assert.equal(f.wisps.uniforms.uWispCount.value, 0);
    assert.match(f.wisps.mesh.material.vertexShader, /clamp\( uWispCount - aWisp\.w, 0\.0, 1\.0 \)/);
    assert.ok(WISP_CLEARANCE_METERS >= SPATIAL_FIELD_MIN_RADIUS_METERS - 1e-12, 'no part of a wisp nearer the route than the particles');
    assert.ok(WISP_HALF_SIZE_RANGE_METERS[1] <= 2, 'small soft bodies');
    assert.match(f.wisps.mesh.material.vertexShader, /smoothstep\( -2\.0, 0\.0, center\.y \)/, 'never shown under the runway floor');
    f.dispose();
});

test('wisp material: a low-contrast elongated soft body that ends inside its quad, toward the Wormhole haze', () => {
    const f = new XrWormholeSpatialField();
    const { vertexShader, fragmentShader } = f.wisps.mesh.material;
    assert.match(vertexShader, /vAlpha = 0\.12 \* shown/, 'low peak opacity');
    assert.match(fragmentShader, /mix\( uHalo, uHaze, 0\.45 \)/, 'the Wormhole\'s colours, toward its haze');
    const body = (x, y) => Math.max(1 - x * x - y * y, 0) ** 2;
    for (const [x, y] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]]) assert.equal(body(x, y), 0);
    assert.equal(body(0, 0), 1);
    assert.ok(vertexShader.includes('vec2 local = vec2( position.x / 1.60, position.y );'));
    assert.ok(vertexShader.includes('mat2( cos( a ), -sin( a ), sin( a ), cos( a ) ) * local * halfSize'));
    assert.match(fragmentShader, /vec2 p = vUv;/);
    // The quad is the body's own box: the same body as an unrotated unit quad turned and stretched in the fragment.
    const previous = (vx, vy, a) => { const px = (Math.cos(a) * vx - Math.sin(a) * vy) * WISP_ELONGATION, py = Math.sin(a) * vx + Math.cos(a) * vy; return Math.max(1 - px * px - py * py, 0) ** 2; };
    for (let a = 0; a < Math.PI * 2; a += 0.37) for (let i = 0; i < 40; i++) {
        const bx = ((i * 0.618) % 1) * 2 - 1, by = ((i * 0.382 + 0.1) % 1) * 2 - 1;
        const lx = bx / WISP_ELONGATION, vx = Math.cos(a) * lx + Math.sin(a) * by, vy = -Math.sin(a) * lx + Math.cos(a) * by;
        assert.ok(Math.abs(previous(vx, vy, a) - body(bx, by)) < 1e-12, 'the same body');
    }
    assert.ok(Math.abs(4 / WISP_ELONGATION / 4 - 0.625) < 1e-12, 'a 37.5% smaller fill');
    f.dispose();
});
