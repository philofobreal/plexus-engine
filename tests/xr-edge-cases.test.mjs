// Edge-case coverage for the XR redesign: HUD, targets, scene geometry, runway, track path, command
// drawer, chart generation settings, section callout and Wormhole depth output.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { noteColorAt } from './helpers/xr-note-motion.mjs';
import { fakeDocument, findAll } from './helpers/fake-dom.mjs';
import { renderedPositions } from './helpers/xr-track-bend.mjs';

const doc = fakeDocument();
const load = createLoader({ three: THREE }, { document: doc });
const { XrHud } = load('xr/scene/XrHud.ts');
const { RhythmNoteField, createTargetGeometry } = load('xr/scene/RhythmNoteField.ts');
const { mergeColoredParts, floorArc, floorTick, boxAt } = load('xr/scene/SceneGeometry.ts');
const { XrRunway, runwayPhase } = load('xr/scene/XrRunway.ts');
const { XrTrackPath } = load('xr/scene/XrTrackPath.ts');
const { WormholeBackdrop } = load('xr/scene/WormholeBackdrop.ts');
const { XrCommandDrawer } = load('xr/XrCommandDrawer.ts');
const { buildSectionTimeline, sectionCueAt, createCueState, XrSectionCallout } = load('xr/scene/XrSectionCallout.ts');
const { SCENE_CONFIG } = load('xr/scene/SceneConfig.ts');
const { buildRhythmChart, judgeStrike, notePosition, DEFAULT_RHYTHM_GAME_CONFIG: config, DIFFICULTIES, HAND_ZONES, HAND_PATTERNS } = load('gameplay/index.ts');
const { difficultyProfile } = load('gameplay/RhythmGenerationProfile.ts');

const snapshot = (over = {}) => ({ state: 'playing', score: 0, combo: 0, maxCombo: 0, hitCount: 0, missCount: 0, totalNotes: 0, ...over });
const pending = note => ({ note, status: 'pending', judgement: null });
const note = (over = {}) => ({ id: 'n', time: 5, lane: 0, row: 1, hand: 'left', cutDirection: 'down', ...over });

// ---------------------------------------------------------------- HUD
test('HUD redraws only when displayed values change, shrinks huge scores and caps instruction lines', () => {
    const hud = new XrHud(), ctx = hud.mesh.material.map.image.getContext('2d');
    const clears = () => ctx.calls.filter(c => c[0] === 'clearRect').length;
    const base = clears(), version = hud.mesh.material.map.version;
    for (let i = 0; i < 50; i++) hud.update(snapshot({ score: 10 }), 'Cut along arrows.');
    assert.equal(clears(), base + 1, 'one redraw for one change');
    hud.update(snapshot({ score: 10, maxCombo: 99, hitCount: 3 }), 'Cut along arrows.');
    assert.equal(clears(), base + 1, 'fields the HUD does not show never trigger a redraw');
    assert.equal(hud.mesh.material.map.version, version + 1);
    ctx.calls.length = 0;
    hud.update(snapshot({ score: 123456789 }), 'word '.repeat(80).trim());
    const scoreCall = ctx.calls.find(c => c[0] === 'fillText' && c[1] === '123456789');
    assert.match(scoreCall[4], /76px/, 'a score too wide for the frame switches to the smaller face');
    const instructionLines = ctx.calls.filter(c => c[0] === 'fillText' && /28px/.test(c[4]));
    assert.ok(instructionLines.length >= 1 && instructionLines.length <= 2, `instruction capped to two lines (${instructionLines.length})`);
    hud.update(snapshot({ state: 'mystery-state' }), '');
    assert.ok(ctx.calls.some(c => c[0] === 'fillText' && c[1] === 'MYSTERY-STATE'), 'unknown states still render a label');
    const disposed = [];
    for (const r of [hud.mesh.geometry, hud.mesh.material, hud.mesh.material.map]) r.addEventListener('dispose', () => disposed.push(r));
    hud.dispose(); assert.equal(disposed.length, 3);
});

// ---------------------------------------------------------------- targets
test('note field: capacity overflow, resolved lifetime, hit/miss/pair colours and free-cut glyphs', () => {
    const field = new RhythmNoteField();
    const many = Array.from({ length: config.maxActiveNotes + 40 }, (_, i) => pending(note({ id: `n${i}`, time: 5 + i * 0.01 })));
    field.update(many, 4); assert.equal(field.mesh.count, config.maxActiveNotes, 'fixed capacity, no overflow');
    field.update([], 4); assert.equal(field.mesh.count, 0); assert.equal(field.arrows.count, 0); assert.equal(field.markers.count, 0);
    const color = new THREE.Color();
    const hit = { note: note({ id: 'hit' }), status: 'hit', resolvedAt: 5, judgement: 'perfect' };
    field.update([hit], 5 + config.resolvedNoteLifetimeSec / 2);
    assert.equal(field.mesh.count, 0, 'struck targets leave the field: the slice effect splits them (Addendum Q)');
    const missed = { note: note({ id: 'miss', pairId: 'p' }), status: 'missed', resolvedAt: 5.2, judgement: 'miss' };
    field.update([missed, pending(note({ id: 'pair', pairId: 'p', hand: 'right', lane: 2 })), pending(note({ id: 'free', cutDirection: 'any' }))], 5.1);
    noteColorAt(field, 'mesh', 0, color); assert.ok(color.r < 0.1 && color.b < 0.1, 'missed targets turn dark');
    noteColorAt(field, 'arrows', 0, color); assert.ok(color.r < 0.2 && Math.abs(color.r - color.b) < 0.1, 'missed glyph is grey even when paired');
    noteColorAt(field, 'arrows', 1, color); assert.ok(color.r > color.b, 'paired glyph is gold');
    assert.equal(field.markers.count, 1, "'any' notes use the dot/ring glyph");
    field.dispose();
    for (const size of [0.2, 0.32, 0.5]) {
        const g = createTargetGeometry(size); g.computeBoundingBox();
        const s = g.boundingBox.getSize(new THREE.Vector3());
        for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(s[axis] - size) < 1e-6, `${size} ${axis}`);
        assert.ok(g.getAttribute('color').array.every(v => v >= 0 && v <= 1));
        g.dispose();
    }
});

// ---------------------------------------------------------------- scene geometry
test('merged geometry: indexed and non-indexed parts, shading, disposal of inputs, empty input and upward floor faces', () => {
    const indexed = new THREE.BoxGeometry(1, 1, 1), flat = boxAt(1, 1, 1, 2, 0, 0);
    const disposed = [];
    for (const g of [indexed, flat]) g.addEventListener('dispose', () => disposed.push(g));
    const merged = mergeColoredParts([{ geometry: indexed, color: 0xff0000 }, { geometry: flat, color: 0x00ff00, shade: () => 0.5 }]);
    assert.equal(merged.getAttribute('position').count, 36 + 36);
    assert.equal(disposed.length, 2, 'inputs are released');
    const colors = merged.getAttribute('color');
    assert.equal(colors.getX(0), 1); assert.equal(colors.getY(40), 0.5);
    assert.ok(merged.boundingSphere && merged.boundingSphere.radius > 0);
    const empty = mergeColoredParts([]); assert.equal(empty.getAttribute('position').count, 0); empty.dispose();
    for (const g of [floorArc(0.3, 0.35, 0, 90, 0.01), floorTick(0.4, 0.45, 90, 0.02, 0.01)]) {
        const p = g.getAttribute('position');
        for (let i = 0; i < p.count; i++) assert.ok(Math.abs(p.getY(i) - 0.01) < 1e-9, 'lies on the floor plane');
        const a = new THREE.Vector3().fromBufferAttribute(p, 0), b = new THREE.Vector3().fromBufferAttribute(p, 1), c = new THREE.Vector3().fromBufferAttribute(p, 2);
        if (!g.index) assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).y > 0, 'faces up');
        g.dispose();
    }
    const forward = floorTick(0.4, 0.45, 90, 0.02, 0), p = forward.getAttribute('position');
    let z = 0; for (let i = 0; i < p.count; i++) z += p.getZ(i);
    assert.ok(z / p.count < -0.3, '90 degrees points forward (-Z)');
    forward.dispose(); merged.dispose();
});

// ---------------------------------------------------------------- runway
test('runway ignores non-finite time, handles negative time and zero speed, and bends only far vertices once per revision', () => {
    const runway = new XrRunway(config);
    runway.update(3); const offset = runway.texture.offset.y;
    for (const bad of [Number.NaN, Infinity, -Infinity]) assert.equal(runway.update(bad), false);
    assert.equal(runway.texture.offset.y, offset);
    for (const t of [-0.5, -1000.25]) { const phase = runwayPhase(t, 4); assert.ok(phase >= 0 && phase < 1); }
    assert.equal(runwayPhase(12.3, 0), 0); assert.equal(runwayPhase(12.3, 4, 0), 0);
    const path = new XrTrackPath(); path.setFocus(0.3, 0.2);
    assert.equal(runway.applyPath(path), true); assert.equal(runway.applyPath(path), false, 'unchanged revision does no work');
    const straight = new XrRunway(config);
    // Rendered = static geometry bent on the GPU by the runway's track uniform.
    const floorA = renderedPositions(runway.floor.geometry, runway.bendUniform.value);
    const floorB = renderedPositions(straight.floor.geometry, straight.bendUniform.value);
    let moved = 0;
    for (let i = 0; i < floorA.length; i += 3) {
        if (floorA[i] === floorB[i] && floorA[i + 1] === floorB[i + 1]) continue;
        moved++;
        assert.ok(-floorA[i + 2] > SCENE_CONFIG.trackBendStartMeters, 'only beyond the straight zone');
    }
    assert.ok(moved > 0);
    assert.ok(runway.bendableVertexCount > 0 && runway.bendableVertexCount < floorA.length / 3 + runway.linework.geometry.getAttribute('position').count);
    runway.dispose(); straight.dispose();
});

// ---------------------------------------------------------------- track path + backdrop focal
test('track path tolerates partial strike attempts and non-finite input; backdrop reports no focus until shown', async () => {
    const path = new XrTrackPath(); path.setFocus(0.4, -0.3);
    const attempt = { songTime: 5, hand: 'left', speed: 2, position: { x: 0.1, y: 0.2, z: -0.3 } };
    path.unprojectStrike(attempt); assert.deepEqual({ ...attempt.position }, { x: 0.1, y: 0.2, z: -0.3 }, 'inside reach: unchanged');
    const nan = path.projectPlayfieldPoint({ x: 0, y: 0, z: Number.NaN });
    assert.ok(Number.isNaN(nan.x) || nan.x === 0);
    assert.equal(judgeStrike({ songTime: 5, hand: 'left', speed: 2, position: { x: Number.NaN, y: 0, z: 0 } }, [pending(note())]), null, 'judge rejects non-finite samples');
    assert.equal(path.setFocus(Number.NaN, Number.NaN), true); assert.equal(path.amplitudeX, 0); assert.equal(path.setFocus(0, 0), false);
    const source = { canvas: {}, focalPoint: { x: 0.2, y: 0.1 }, async prepare() {}, render: () => true, dispose() {} };
    const backdrop = new WormholeBackdrop(source);
    assert.equal(backdrop.focalPoint, null, 'not prepared yet');
    await backdrop.prepare(null); assert.equal(backdrop.focalPoint.x, 0.2);
    backdrop.root.visible = false; assert.equal(backdrop.focalPoint, null, 'hidden');
    backdrop.setEyeHeight(Number.NaN); assert.equal(backdrop.root.position.y, SCENE_CONFIG.backdropCenterYMeters);
    backdrop.dispose();
});

// ---------------------------------------------------------------- command drawer
test('the track panel survives double dispose', () => {
    const d = new XrCommandDrawer(fakeDocument());
    d.dispose(); d.dispose();
});

// ---------------------------------------------------------------- chart generation
test('chart generation rejects malformed input and keeps every invariant on hostile, dense and long inputs', () => {
    for (const durationSec of [0, -5, Number.NaN, Infinity * 0]) assert.equal(buildRhythmChart({ events: [{ time: 3, intensity: 1, type: 1 }], durationSec, beats: [] }).length, 0);
    const hostile = [
        { time: Number.NaN, intensity: 1, type: 1 }, { time: -3, intensity: 1, type: 1 }, { time: Infinity, intensity: 1, type: 1 },
        { time: 1, intensity: 1, type: 1 }, // before the approach window
        { time: 5, intensity: Number.NaN, type: 1 }, { time: 6, intensity: 0.01, type: 1 }, // unusable intensity
        { time: 999, intensity: 1, type: 2 }, // after the end
        ...Array.from({ length: 60 }, (_, i) => ({ time: 20 - i * 0.25, intensity: 0.4 + (i % 5) * 0.12, type: (i % 3) + 1 })), // unsorted
        { time: 10, intensity: 0.9, type: 2 }, { time: 10, intensity: 0.8, type: 1 } // duplicates
    ];
    const plan = { version: 1, source: 'auto', points: [
        { id: 'late', time: 12, preset: 'x.json', sectionId: 's', confidence: 1, intensity: 2, reason: 'drop', morphDurationSec: 1, morphCurve: 'linear', meta: { automationSituation: 'drop-long' } },
        { id: 'bad', time: Number.NaN, preset: 'x.json', sectionId: 's', confidence: 1, intensity: 1, reason: 'build', morphDurationSec: 1, morphCurve: 'linear' },
        { id: 'early', time: 0, preset: 'x.json', sectionId: 's', confidence: 1, intensity: 1, reason: 'intro', morphDurationSec: 1, morphCurve: 'linear' }] };
    const valid = new Set(hostile.filter(e => Number.isFinite(e.time) && e.time >= config.approachTimeSec && e.time <= 30
        && Number.isFinite(e.intensity) && e.intensity >= config.intensityFloor).map(e => e.time));
    for (const difficulty of DIFFICULTIES) for (const zones of HAND_ZONES) for (const handPattern of HAND_PATTERNS) {
        const settings = { difficulty, zones, handPattern };
        const chart = buildRhythmChart({ events: hostile, durationSec: 30, beats: [5, 5.5, Number.NaN, 4.5], timingConfidence: 0.9, performancePlan: plan }, config, settings);
        assert.ok(chart.every(n => valid.has(n.time)), `${JSON.stringify(settings)}: only usable onsets`);
        assert.ok(chart.every((n, i) => i === 0 || n.time >= chart[i - 1].time), 'ascending');
        assert.ok(chart.every(n => Number.isFinite(n.xOffsetMeters) && [0, 1, 2].includes(n.row)));
        assert.equal(new Set(chart.map(n => n.id)).size, chart.length, 'unique ids even with duplicate timestamps');
    }
    // Extremely dense input (every 30 ms) at the most permissive setting still honours the floors.
    const dense = Array.from({ length: 2000 }, (_, i) => ({ time: 2 + i * 0.03, intensity: 0.5 + (i % 7) * 0.07, type: (i % 3) + 1 }));
    const expert = difficultyProfile('expert');
    const chart = buildRhythmChart({ events: dense, durationSec: 62, beats: [], timingConfidence: 0.2 }, config,
        { difficulty: 'expert', activity: 'active', variation: 'expressive', zones: 'cross', handPattern: 'independent' });
    const last = {};
    for (let i = 0; i < chart.length; i++) {
        const n = chart[i];
        if (i && !(n.pairId && n.pairId === chart[i - 1].pairId)) assert.ok(n.time - chart[i - 1].time >= config.minGlobalNoteSpacingSec * expert.globalSpacingScale - 1e-7);
        if (last[n.hand]) assert.ok(n.time - last[n.hand].time >= config.minSameHandSpacingSec * expert.sameHandSpacingScale - 1e-8);
        last[n.hand] = n;
    }
    // A 20-minute track stays an offline computation covering the whole track (no wall-clock
    // assertion: timing checks are not reliable test conditions, see testing-validation.md).
    const long = Array.from({ length: 5200 }, (_, i) => ({ time: 2 + i * 0.23, intensity: 0.3 + (i % 9) * 0.07, type: (i % 3) + 1 }));
    const longChart = buildRhythmChart({ events: long, durationSec: 1200, beats: Array.from({ length: 2600 }, (_, i) => i * 0.46), timingConfidence: 0.9 }, config,
        { difficulty: 'expert', zones: 'cross', handPattern: 'call-response' });
    assert.ok(longChart.length > 500 && longChart.at(-1).time > 1100, 'the whole track is populated');
    // High timing confidence without a grid falls back to the onset scaffold.
    assert.ok(buildRhythmChart({ events: dense.slice(0, 300), durationSec: 12, beats: [], timingConfidence: 1 }).length > 0);
});

// ---------------------------------------------------------------- section callout
const section = (start, end, label) => ({ start, end, label, energy: 0.5, density: 0.5, dominantFeature: 'rhythm', avgRms: 0.1, peakRms: 0.2 });
test('section timeline: invalid, unsorted, overlapping, single, very short and repeated sections', () => {
    assert.equal(buildSectionTimeline([], [], 0, 60).length, 0);
    assert.equal(buildSectionTimeline([section(3, 3, 'drop'), section(5, 4, 'drop'), section(Number.NaN, 9, 'intro'), section(1, 2, 'solo')], [], 0.9, 60).length, 0);
    const unsorted = buildSectionTimeline([section(20, 40, 'drop'), section(0, 20, 'intro'), section(18, 30, 'build')], [], 0.1, 35);
    assert.equal(unsorted.map(c => c.label).join(), 'intro,build,drop', 'sorted by start even when overlapping');
    assert.ok(unsorted.every(c => c.end <= 35), 'ends clamped to the track duration');
    const single = buildSectionTimeline([section(0, 60, 'peak')], [], 0.9, 60), cue = createCueState();
    for (const t of [-5, 0, 30, 59.9, 120]) { sectionCueAt(single, t, cue); assert.equal(cue.phase, 'steady'); assert.equal(cue.current, 0); }
    assert.equal(sectionCueAt(single, Number.NaN, cue).phase, 'none');
    const short = buildSectionTimeline([section(0, 1, 'intro'), section(1, 2, 'drop'), section(2, 40, 'drop')], [], 0.1, 40);
    assert.equal(short[1].leadIn, 0.5, 'lead-in never exceeds half the previous section');
    assert.equal(short.map(c => c.title).join(), 'INTRO,DROP 1,DROP 2', 'consecutive repeats are numbered');
    const timeline = buildSectionTimeline([section(0, 10, 'intro'), section(10, 30, 'build')], Array.from({ length: 80 }, (_, i) => i * 0.5), 0.9, 30);
    for (let t = 7.9; t < 10; t += 0.013) {
        sectionCueAt(timeline, t, cue);
        if (cue.phase !== 'lead-in') continue;
        assert.ok(cue.beatsRemaining >= 1 && cue.beatsRemaining <= 4); assert.ok(cue.beatFraction >= 0 && cue.beatFraction < 1);
        assert.ok(cue.progress >= 0 && cue.progress <= 1);
    }
    const callout = new XrSectionCallout(doc);
    callout.setTimeline(timeline); callout.update(3); const redraws = callout.redrawCount;
    callout.update(Number.NaN); callout.update(Infinity); callout.update(-Infinity);
    assert.ok(callout.redrawCount <= redraws + 1, 'non-finite song time never loops redraws');
    callout.setTimeline([]); assert.equal(callout.root.visible, false); callout.update(5);
    callout.dispose();
});

// ---------------------------------------------------------------- Wormhole depth output
test('depth cue clamps hostile values; removing layers restores legacy output; material frames keep one surface', () => {
    const wormhole = createLoader();
    const { CosmicWormholeIdentity } = wormhole('visuals/CosmicWormholeIdentity.ts');
    const { State } = wormhole('state/store.ts');
    const recorder = (width = 960, height = 540, raster = false) => {
        const calls = [], record = name => (...args) => calls.push([name, ...args]);
        return { width, height, frameCount: 1, calls, compactMaterialPreview: true,
            beginFieldRaster: raster ? (layer, cols, rows) => new Float32Array(cols * rows * 4) : () => null, drawFieldRaster: record('drawFieldRaster'),
            background: record('background'), noStroke: record('noStroke'), noFill: record('noFill'), fill: record('fill'), stroke: record('stroke'),
            strokeWeight: record('strokeWeight'), line: record('line'), circle: record('circle'), triangle: record('triangle'), beginShape: record('beginShape'),
            vertex: record('vertex'), endShape: record('endShape'), radialGlow: record('radialGlow'), radialDim: record('radialDim'), compositeRingTint: record('compositeRingTint') };
    };
    const run = (configure, { material = false } = {}) => {
        State.bpm = 128; State.playbackFade = 1; State.isPlaying = true;
        const tuning = { wormholeNebulaAmount: material ? 1 : 0, performanceMode: 0 };
        Object.assign(State.visualTuning, tuning); Object.assign(State.targetTuning, tuning);
        const identity = new CosmicWormholeIdentity(), far = recorder(960, 540, material), mid = recorder(768, 432), near = recorder(768, 432);
        configure(identity, mid, near); identity.syncPosition(4);
        for (let i = 0; i < 12; i++) { State.currentTime = 4 + i / 30; identity.draw(far, [], []); }
        return { far: JSON.stringify(far.calls), mid: mid.calls.length, near: near.calls.length };
    };
    const legacy = run(() => {});
    for (const bad of [Number.NaN, -3, -Infinity]) assert.equal(run(i => i.setDepthCue(bad)).far, legacy.far, `${bad} disables the cue`);
    assert.equal(run(i => i.setDepthCue(7)).far, run(i => i.setDepthCue(1)).far, 'amounts above 1 clamp');
    assert.equal(run((i, mid, near) => { i.setDepthLayers({ mid, near }); i.setDepthLayers(null); }).far, legacy.far, 'removing layers restores the single surface');
    const material = run((i, mid, near) => i.setDepthLayers({ mid, near }), { material: true });
    assert.equal(material.mid + material.near, 0, 'material frames never route grains to nearer planes');
    assert.ok(material.far.includes('drawFieldRaster'), 'the material composite stays on the main surface');
});

test('HUD shows the combo multiplier and redraws when only the multiplier changes', () => {
    const hud = new XrHud(), ctx = hud.mesh.material.map.image.getContext('2d');
    hud.update(snapshot({ score: 300, combo: 3 }), 'x');
    assert.ok(ctx.calls.some(c => c[0] === 'fillText' && c[1] === '×1'), 'a snapshot without a multiplier reads 1x');
    const clears = () => ctx.calls.filter(c => c[0] === 'clearRect').length, before = clears();
    hud.update(snapshot({ score: 300, combo: 3, multiplier: 2 }), 'x');
    assert.equal(clears(), before + 1);
    assert.ok(ctx.calls.some(c => c[0] === 'fillText' && c[1] === '×2'));
    hud.dispose();
});
