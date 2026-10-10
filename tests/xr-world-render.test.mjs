// World Formation rendering integration (ADR-010, T03/T04/T06/T07/T09): bounded resources, one
// visual language across three characters, the readability volume, write-once instance data,
// seek-exact presentation, role halos, the status plate, the World setting and disposal.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { fakeDocument } from './helpers/fake-dom.mjs';

const doc = fakeDocument();
const load = createLoader({ three: THREE }, { document: doc });
const g = load('gameplay/index.ts');
const { XrWorld, WORLD_DETAIL, assemblyPoint } = load('xr/scene/XrWorld.ts');
const layout = load('xr/scene/XrWorldLayout.ts');
const { XrNoteHalos, HALO_BURST_SEC } = load('xr/scene/XrNoteHalos.ts');
const { XrWorldStatus } = load('xr/scene/XrWorldStatus.ts');
const { RhythmGameScene } = load('xr/scene/RhythmGameScene.ts');
const { formatWorldOutcome, menuLayout, DEFAULT_MENU_STATE } = load('xr/XrMenuModel.ts');
const { DEFAULT_XR_SETTINGS } = load('xr/XrSettings.ts');
const timeline = load('gameplay/WorldTimeline.ts');
const config = g.DEFAULT_RHYTHM_GAME_CONFIG;

function track() {
    const durationSec = 192, beat = 60 / 128, events = [];
    for (let t = 2; t < durationSec - 1; t += beat / 2) events.push({ time: +t.toFixed(4), intensity: 0.5 + 0.4 * Math.abs(Math.sin(t)), type: 1 });
    const beats = Array.from({ length: Math.floor(durationSec / beat) }, (_, i) => +(i * beat).toFixed(4));
    const sections = [[0, 16, 'intro', 0.25], [16, 56, 'verse', 0.55], [56, 72, 'build', 0.7], [72, 104, 'drop', 1], [104, 124, 'break', 0.3],
        [124, 156, 'drop', 0.95], [156, durationSec, 'outro', 0.3]].map(([start, end, label, energy]) => ({ start, end, label, energy }));
    const chart = g.buildRhythmChart({ durationSec, events, beats, barStarts: beats.filter((_, i) => i % 4 === 0), timingConfidence: 0.9 }, config, {});
    const cues = [{ time: 30.2, intensity: 0.9, confidence: 0.9, kind: 'impact' }, { time: 90.4, intensity: 0.9, confidence: 0.9, kind: 'impact' }];
    return { chart, plan: g.buildWorldPlan({ durationSec, chart, sections, cues, timingConfidence: 0.9 }), sections };
}

const uniformValues = world => {
    const u = world.uniforms;
    return JSON.stringify([u.uTime.value, u.uMix.value.toArray(), u.uField.value.toArray(), u.uGlobal.value.toArray(), u.uSurge.value.toArray(),
        u.uScan.value.toArray(), u.uReact.value.map(v => v.toArray())]);
};
const arrayOf = attribute => Array.from(attribute.array);

test('the world is bounded: fixed capacities, at most 10 draws, and nothing allocated per frame', () => {
    const world = new XrWorld();
    const { plan } = track();
    world.setPlan(plan);
    for (let t = 0; t < plan.durationSec; t += 3.7) world.update(t, null);
    assert.ok(world.drawCalls <= 10, `${world.drawCalls} draws`);
    const instances = [world.body, world.beams, world.nodes, world.seeders, world.drones, world.rings].reduce((n, m) => n + m.instanceMatrix.count, 0);
    assert.ok(instances <= 260, `${instances} instance slots`);
    assert.equal(world.flow.geometry.getAttribute('aFlowA').count, WORLD_DETAIL.full.flowPoints);
    const writes = world.planWrites;
    for (let i = 0; i < 50; i++) world.update(40 + i / 72, null);
    assert.equal(world.planWrites, writes, 'plan data is written once per plan');
    world.dispose();
});

test('state and seeder paths are written only on change, never per frame', () => {
    const world = new XrWorld(), { plan, chart } = track();
    world.setPlan(plan);
    const session = new g.WorldInteractionSession(); session.load(plan);
    const snapshot = session.getSnapshot();
    world.update(20, snapshot);
    const state = world.stateWrites, paths = world.pathWrites;
    for (let i = 0; i < 30; i++) world.update(20 + i / 72, snapshot);
    assert.equal(world.stateWrites, state, 'an unchanged snapshot writes nothing');
    assert.ok(world.pathWrites - paths <= 2, 'paths change only when a construction target does');
    session.onNoteResolved(chart[0], 'perfect', chart[0].time, false);
    world.update(21, session.getSnapshot());
    assert.equal(world.stateWrites, state + 1);
    world.dispose();
});

test('presentation is a pure function of song time: a seek lands on the exact state', () => {
    const { plan } = track();
    const a = new XrWorld(), b = new XrWorld();
    a.setPlan(plan); b.setPlan(plan);
    for (let frame = 0; frame <= 140 * 30; frame++) a.update(frame / 30, null);
    b.update(5, null); b.update(170, null); b.update(140, null);
    assert.equal(uniformValues(a), uniformValues(b));
    assert.deepEqual(arrayOf(a.seeders.geometry.getAttribute('aPathB')), arrayOf(b.seeders.geometry.getAttribute('aPathB')));
    assert.deepEqual(arrayOf(a.drones.instanceMatrix), arrayOf(b.drones.instanceMatrix));
    a.dispose(); b.dispose();
});

test('three characters share one world: industrial hall, information network, anomaly', () => {
    const { plan } = track();
    const out = { industry: 0, construction: 0, lattice: 0, flow: 0, anomaly: 0 };
    const dominant = t => { const c = { ...timeline.characterAt(plan, t, out) }; return Object.entries(c).sort((x, y) => y[1] - x[1])[0][0]; };
    assert.equal(dominant(10), 'industry');
    const network = plan.eras.find(e => e.era === 'network').start;
    assert.equal(dominant(network + 6), 'flow', 'the break reveals the Egis flow');
    assert.equal(dominant(plan.encounter.syncStart + 5), 'anomaly');
    // The same structures persist through every change of character (no level swap).
    const world = new XrWorld();
    world.setPlan(plan);
    const pylonsBefore = arrayOf(world.body.geometry.getAttribute('aPos'));
    world.update(10, null); world.update(network + 6, null); world.update(plan.encounter.syncStart + 5, null);
    assert.deepEqual(arrayOf(world.body.geometry.getAttribute('aPos')), pylonsBefore);
    world.dispose();
});

test('no world geometry or unit enters the targets readability volume', () => {
    const inside = (p, label) => assert.ok(!layout.insideReadabilityVolume(p.x, p.y, p.z), `${label} at ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`);
    const world = new XrWorld(), { plan } = track();
    world.setPlan(plan);
    // Static bodies: every corner of every module.
    const pos = world.body.geometry.getAttribute('aPos'), size = world.body.geometry.getAttribute('aSize');
    for (let i = 0; i < world.body.count; i++) for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) for (const sy of [0, 1]) {
        inside({ x: pos.getX(i) + sx * size.getX(i), y: pos.getY(i) + sy * size.getY(i), z: pos.getZ(i) + sz * size.getZ(i) }, `body ${i}`);
    }
    // Beams along their length, with their width.
    const from = world.beams.geometry.getAttribute('aFrom'), to = world.beams.geometry.getAttribute('aTo');
    for (let i = 0; i < world.beams.count; i++) for (let u = 0; u <= 1; u += 0.1) {
        const w = from.getW(i) * Math.SQRT1_2;
        const p = { x: from.getX(i) + (to.getX(i) - from.getX(i)) * u, y: from.getY(i) + (to.getY(i) - from.getY(i)) * u, z: from.getZ(i) + (to.getZ(i) - from.getZ(i)) * u };
        for (const dx of [-w, w]) inside({ ...p, x: p.x + dx }, `beam ${i}`);
    }
    for (let slot = 0; slot < 8; slot++) { inside(layout.latticeNode(slot), `node ${slot}`); for (let k = 0; k < 2; k++) inside(layout.latticeSatellite(slot, k), 'satellite'); }
    // The Fenom rings at every tilt: the lowest point of the largest ring.
    inside({ x: 0, y: layout.FENOM_CENTRE.y - layout.FENOM_RING_RADII.at(-1), z: layout.FENOM_CENTRE.z }, 'ring');
    // The flow disc's lowest point.
    inside({ x: 0, y: layout.FLOW_CENTRE.y - 0.8 - (layout.FLOW_OUTER_RADIUS * 1.05 + 0.9) * Math.sin(layout.FLOW_TILT), z: 0 }, 'flow');
    // Seeder paths: quadratic curves from material to every assembly point, with the lateral wiggle.
    for (const s of plan.structures.filter(x => ['pylon', 'conduit', 'rib'].includes(x.kind))) {
        const b = assemblyPoint(s), side = s.slot % 2 === 0 ? -1 : 1;
        for (let k = 0; k < layout.MATERIAL_NODES_PER_SIDE; k++) {
            const a = layout.materialNode(side, k), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
            for (let u = 0; u <= 1; u += 0.05) {
                const q = (p0, p1, p2) => (1 - u) ** 2 * p0 + 2 * u * (1 - u) * p1 + u * u * p2;
                const x = q(a.x, mid.x, b.x);
                inside({ x: x - Math.sign(x) * 0.16, y: q(a.y, mid.y, b.y), z: q(a.z, mid.z, b.z) }, `seeder path to ${s.id}`);
            }
        }
    }
    // Drones over the whole song (every role blend).
    const p = new THREE.Vector3(), m = new THREE.Matrix4();
    for (let t = 0; t < plan.durationSec; t += 0.25) {
        world.update(t, null);
        for (let i = 0; i < world.drones.count; i++) { world.drones.getMatrixAt(i, m); p.setFromMatrixPosition(m); inside(p, `drone ${i} at ${t}`); }
    }
    world.dispose();
});

test('reduced detail draws deterministic prefixes of the full world', () => {
    const { plan } = track();
    const full = new XrWorld('full'), reduced = new XrWorld('reduced');
    full.setPlan(plan); reduced.setPlan(plan);
    const t = plan.encounter.syncStart + 3;
    full.update(t, null); reduced.update(t, null);
    assert.ok(reduced.seeders.count < full.seeders.count);
    assert.ok(reduced.drones.count < full.drones.count);
    assert.ok(reduced.nodes.count < full.nodes.count);
    assert.equal(reduced.flow.geometry.drawRange.count, WORLD_DETAIL.reduced.flowPoints);
    for (const name of ['aSeed', 'aPathA', 'aPathB']) {
        const n = reduced.seeders.count * 4;
        assert.deepEqual(arrayOf(reduced.seeders.geometry.getAttribute(name)).slice(0, n), arrayOf(full.seeders.geometry.getAttribute(name)).slice(0, n),
            `${name}: the reduced units are the first units of the full set`);
    }
    assert.equal(uniformValues(full), uniformValues(reduced), 'the same world state');
    full.setDetail('reduced');
    assert.equal(full.seeders.count, reduced.seeders.count);
    full.dispose(); reduced.dispose();
});

test('disposal releases every geometry, material and texture of the world, the halos and the status plate', () => {
    const disposed = new Set(), owned = new Set();
    const watch = resource => { owned.add(resource); resource.addEventListener('dispose', () => disposed.add(resource)); };
    const scene = new THREE.Scene();
    const game = new RhythmGameScene(scene, config);
    game.setWorldPlan(track().plan);
    for (const root of [game.world.root, game.halos.mesh, game.worldStatus.mesh]) root.traverse(o => { if (o.geometry) watch(o.geometry); if (o.material) watch(o.material); if (o.material?.map) watch(o.material.map); });
    game.dispose();
    assert.ok(owned.size >= 24);
    for (const resource of owned) assert.ok(disposed.has(resource), `${resource.type} disposed`);
    assert.equal(game.world.root.parent, null);
});

test('the World setting: Off is the original game, Reduced and Full show the world', () => {
    const scene = new THREE.Scene(), game = new RhythmGameScene(scene, config);
    const { plan, chart } = track();
    game.setWorldPlan(plan);
    const session = new g.RhythmGameSession(config), world = new g.WorldInteractionSession();
    session.setResolutionObserver(world); session.loadChart(chart); world.load(plan); session.start();
    const role = plan.roles[0];
    const update = t => game.update(session.getActiveNotes(t), t, session.getSnapshot(), '', world.getSnapshot());
    game.setWorldMode('off');
    update(role.time - 0.5);
    assert.equal(game.world.root.visible, false);
    assert.equal(game.world.drawCalls, 0);
    assert.equal(game.halos.mesh.visible, false);
    assert.equal(game.worldStatus.mesh.visible, false);
    game.setWorldMode('reduced');
    update(role.time - 0.5);
    assert.equal(game.world.detailLevel, 'reduced');
    assert.ok(game.world.root.visible && game.halos.mesh.visible && game.worldStatus.mesh.visible);
    assert.ok(game.halos.mesh.count >= 1, 'the approaching special note carries its halo');
    game.setWorldMode('full');
    assert.equal(game.world.detailLevel, 'full');
    game.dispose();
});

test('halos mark exactly the role notes, keep the notes untouched and burst at the strike point', () => {
    const { plan, chart } = track();
    const halos = new XrNoteHalos(config.noteSizeMeters);
    halos.setPlan(plan);
    const session = new g.RhythmGameSession(config);
    session.loadChart(chart); session.start();
    const role = plan.roles.find(r => r.role === 'energy');
    const note = chart.find(n => n.id === role.noteId);
    const before = JSON.stringify(note);
    halos.update(session.getActiveNotes(role.time - 1), role.time - 1, config);
    const pendingCount = halos.mesh.count;
    const roleIds = new Set(plan.roles.map(r => r.noteId));
    const active = session.getActiveNotes(role.time - 1).filter(e => roleIds.has(e.note.id) && e.status === 'pending').length;
    assert.equal(pendingCount, active, 'one halo per pending role note in view');
    const writes = halos.writes;
    halos.update(session.getActiveNotes(role.time - 0.99), role.time - 0.99, config);
    assert.equal(halos.writes, writes, 'travel is the GPU\'s: no rewrite while nothing changes');
    // Hit: the halo freezes at the hit time and bursts, then disappears.
    const entry = session.getActiveNotes(role.time).find(e => e.note.id === role.noteId);
    entry.status = 'hit'; entry.judgement = 'perfect'; entry.resolvedAt = role.time;
    halos.update(session.getActiveNotes(role.time + 0.1), role.time + 0.1, config);
    const style = halos.mesh.geometry.getAttribute('aHaloStyle');
    const modes = Array.from({ length: halos.mesh.count }, (_, i) => style.getW(i));
    assert.ok(modes.includes(1), 'a burst instance');
    halos.update(session.getActiveNotes(role.time + HALO_BURST_SEC + 0.1), role.time + HALO_BURST_SEC + 0.1, config);
    assert.ok(Array.from({ length: halos.mesh.count }, (_, i) => style.getW(i)).every(mode => mode !== 1), 'the burst expires');
    assert.equal(JSON.stringify(note), before, 'the note is never restyled or moved');
    assert.ok(halos.mesh.instanceMatrix.count <= 16);
    halos.dispose();
});

test('the status plate shows era, objective and bars, redrawing only on change', () => {
    const status = new XrWorldStatus(doc);
    status.update(null);
    assert.equal(status.mesh.visible, false);
    const view = { title: 'SEEDER CONSTRUCTION', line: 'Gold energy targets 2/9 - formation 61%', role: 'energy', formation: 0.612, coherence: 0.704 };
    status.update(view);
    assert.equal(status.mesh.visible, true);
    assert.equal(status.redraws, 1);
    status.update({ ...view, formation: 0.6149 });
    assert.equal(status.redraws, 1, 'the same whole percent: no redraw');
    status.update({ ...view, coherence: 0.72 });
    assert.equal(status.redraws, 2);
    const texts = status.mesh.material.map.image.context.calls.filter(c => c[0] === 'fillText').map(c => c[1]);
    for (const expected of ['SEEDER CONSTRUCTION', 'FORMATION', 'COHERENCE', '61%', '72%']) assert.ok(texts.includes(expected), expected);
    status.dispose();
});

test('the results screen adds one world line under the unchanged rhythm result', () => {
    const outcome = { outcome: 'stabilized', title: 'Field stabilized', formation: 0.861, coherence: 0.78, stability: 0.9, anchorsHit: 5, anchorsTotal: 5 };
    const line = formatWorldOutcome(outcome);
    assert.equal(line, 'Field stabilized - formation 86% - coherence 78% - anchors 5/5');
    assert.equal(formatWorldOutcome({ ...outcome, outcome: 'formed', title: 'World formed', stability: null }), 'World formed - formation 86% - coherence 78%');
    const results = { rank: 'S', accuracy: 0.91, score: 1000, maxCombo: 30, hits: 90, misses: 10, flawlessSections: 2, sections: 5 };
    const context = world => ({ settings: DEFAULT_XR_SETTINGS, sessionState: 'finished', trackTitle: 'Song', busy: false, canStart: true, status: '',
        results: world ? { ...results, world } : results, input: 'vr' });
    const plain = menuLayout({ ...DEFAULT_MENU_STATE, screen: 'results' }, context(null));
    const withWorld = menuLayout({ ...DEFAULT_MENU_STATE, screen: 'results' }, context(line));
    assert.ok(withWorld.texts.some(t => t.text === line));
    assert.ok(!plain.texts.some(t => t.text === line));
    for (const text of plain.texts) assert.ok(withWorld.texts.some(t => t.text === text.text && t.y === text.y), `"${text.text}" unchanged`);
    const lowest = Math.max(...withWorld.items.map(i => i.y + i.h));
    assert.ok(lowest <= 704, 'the buttons still fit the panel');
});

test('a drone answers each achievement, and drones stay clear of the targets during a played run', () => {
    const { plan, chart } = track();
    const world = new XrWorld(), session = new g.WorldInteractionSession();
    world.setPlan(plan); session.load(plan);
    const roles = new Map(plan.roles.map(r => [r.noteId, r]));
    const p = new THREE.Vector3(), m = new THREE.Matrix4();
    let answered = 0;
    for (const note of chart) {
        session.onNoteResolved(note, 'perfect', note.time, false);
        const role = roles.get(note.id);
        for (const dt of [0, 0.5, 1.0]) {
            world.update(note.time + dt, session.getSnapshot());
            for (let i = 0; i < world.drones.count; i++) {
                world.drones.getMatrixAt(i, m); p.setFromMatrixPosition(m);
                assert.ok(!layout.insideReadabilityVolume(p.x, p.y, p.z), `drone ${i} at ${note.time + dt}`);
            }
        }
        if (role && role.structure >= 0 && (role.role === 'energy' || role.role === 'signal')) {
            // Half a second after the hit, one drone is near the activated structure.
            world.update(note.time + 0.6, session.getSnapshot());
            const anchor = layout.structureAnchor(plan.structures[role.structure].kind, plan.structures[role.structure].slot);
            let nearest = Infinity;
            for (let i = 0; i < world.drones.count; i++) { world.drones.getMatrixAt(i, m); p.setFromMatrixPosition(m); nearest = Math.min(nearest, Math.hypot(p.x - anchor.x, p.z - anchor.z)); }
            if (nearest < 3) answered++;
        }
    }
    assert.ok(answered >= 3, `${answered} achievements answered by a drone`);
    world.dispose();
});
