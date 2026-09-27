import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';

const context = { clearRect() {}, fillRect() {}, fillText() {}, measureText: text => ({ width: text.length * 12 }) };
const doc = { createElement: () => ({ getContext: () => context }) };
const load = createLoader({ three: THREE }, { document: doc });
const { buildSectionTimeline, sectionCueAt, createCueState, XrSectionCallout, scramble, SECTION_STYLE, CAPTION_PLANE_HEIGHT } = load('xr/scene/XrSectionCallout.ts');
const { RhythmGameScene } = load('xr/scene/RhythmGameScene.ts');

const section = (start, end, label) => ({ start, end, label, energy: 0.5, density: 0.5, dominantFeature: 'rhythm', avgRms: 0.1, peakRms: 0.2 });
const beats = Array.from({ length: 400 }, (_, i) => i * 0.5); // 120 BPM
const sections = [section(0, 16, 'intro'), section(16, 32, 'build'), section(32, 48, 'drop'), section(48, 50, 'break'), section(50, 80, 'drop')];
const timeline = buildSectionTimeline(sections, beats, 0.9, 80);
const idle = { state: 'paused', score: 0, combo: 0, maxCombo: 0, hitCount: 0, missCount: 0, totalNotes: 0 };

test('timeline uses analyzer sections with MVP names, numbered repeats and bounded one-bar lead-ins', () => {
    assert.equal(timeline.map(c => c.title).join(), 'INTRO,BUILD-UP,DROP 1,BREAKDOWN,DROP 2');
    assert.equal(timeline[0].leadIn, 0);
    assert.equal(timeline[1].leadIn, 2); // 4 beats at 120 BPM
    assert.equal(timeline[4].leadIn, 1, 'never longer than half the previous section');
    const unreliable = buildSectionTimeline(sections, [], 0.1, 80);
    assert.equal(unreliable[1].leadIn, 2); // 4 x 0.5 s fallback beat
    assert.equal(buildSectionTimeline([section(5, 4, 'drop'), section(0, 5, 'mystery')], beats, 0.9, 80).length, 0);
    for (const label of Object.keys(SECTION_STYLE)) assert.ok(SECTION_STYLE[label].name && SECTION_STYLE[label].color);
});

test('cue phases: steady, one-bar lead-in with a 4..1 countdown, then a short arrival', () => {
    const cue = createCueState();
    assert.equal(sectionCueAt(timeline, 5, cue).phase, 'steady'); assert.equal(cue.current, 0);
    const countdown = [];
    for (let t = 14.01; t < 16; t += 0.5) { sectionCueAt(timeline, t, cue); assert.equal(cue.phase, 'lead-in'); assert.equal(cue.next, 1); countdown.push(cue.beatsRemaining); }
    assert.equal(countdown.join(), '4,3,2,1');
    sectionCueAt(timeline, 16.2, cue); assert.equal(cue.phase, 'arrival'); assert.equal(cue.current, 1);
    sectionCueAt(timeline, 17, cue); assert.equal(cue.phase, 'steady');
    assert.equal(sectionCueAt([], 3, cue).phase, 'none');
});

test('cue state is a pure function of song time: replay and backward seeks match a fresh evaluation', () => {
    const a = createCueState(), b = createCueState();
    for (const t of [3, 31.2, 47.5, 15.3, 49.1, 15.3]) sectionCueAt(timeline, t, a);
    assert.deepEqual({ ...a }, { ...sectionCueAt(timeline, 15.3, b) });
    assert.equal(scramble('DROP 2', 0.4, 3), scramble('DROP 2', 0.4, 3));
    assert.equal(scramble('DROP 2', 1, 3), 'DROP 2');
    assert.ok(scramble('DROP 2', 0.5, 3).startsWith('DRO'));
});

test('caption redraws only on display changes; frame pulses and snaps from song time without uploads', () => {
    const callout = new XrSectionCallout(doc);
    assert.equal(callout.root.visible, false);
    callout.setTimeline(timeline); assert.equal(callout.root.visible, true);
    callout.update(2); const steadyRedraws = callout.redrawCount, version = callout.texture.version;
    for (let t = 2; t < 13; t += 1 / 60) callout.update(t);
    assert.equal(callout.redrawCount, steadyRedraws, 'steady section: no canvas work');
    assert.equal(callout.texture.version, version);
    for (let i = 0; i < 100; i++) callout.update(13); // paused
    assert.equal(callout.redrawCount, steadyRedraws);
    const scales = [];
    for (let t = 13; t < 17.5; t += 1 / 72) { callout.update(t); scales.push(callout.frame.scale.x); }
    const transitionRedraws = callout.redrawCount - steadyRedraws;
    assert.ok(transitionRedraws >= 6 && transitionRedraws <= 40, `bounded caption work per transition: ${transitionRedraws}`);
    assert.ok(Math.max(...scales) > 1.05, 'arrival snaps the frame outward');
    assert.equal(callout.frame.scale.x, 1, 'and it settles');
    // Colour drifts toward the next section during the lead-in.
    callout.update(14.2); const early = callout.frame.material.color.clone();
    callout.update(15.9); const late = callout.frame.material.color.clone();
    const target = new THREE.Color(SECTION_STYLE.build.color);
    const distance = c => Math.hypot(c.r / Math.max(c.r, c.g, c.b, 1e-6) - target.r, c.g / Math.max(c.r, c.g, c.b, 1e-6) - target.g, c.b / Math.max(c.r, c.g, c.b, 1e-6) - target.b);
    assert.ok(distance(late) < distance(early));
    // Seeking back reproduces the exact frame state.
    callout.update(40); callout.update(16.2); const seekScale = callout.frame.scale.x;
    const fresh = new XrSectionCallout(doc); fresh.setTimeline(timeline); fresh.update(16.2);
    assert.equal(fresh.frame.scale.x, seekScale);
    const disposed = [];
    for (const r of [callout.frame.geometry, callout.frame.material, callout.caption.geometry, callout.caption.material, callout.texture])
        r.addEventListener('dispose', () => disposed.push(r));
    callout.dispose(); fresh.dispose();
    assert.equal(disposed.length, 5);
});

test('scene wires the callout into the gate and keeps the caption clear of the raised HUD', () => {
    const world = new THREE.Scene(), scene = new RhythmGameScene(world);
    scene.setSectionTimeline(timeline);
    scene.update([], 15, idle, 'Paused');
    assert.equal(scene.sectionCallout.root.parent, scene.playfield);
    assert.equal(scene.sectionCallout.root.visible, true);
    // Eye in playfield space: hitHeightBelowEyes above the middle row, playfieldForward behind the gate.
    const eye = new THREE.Vector3(0, 0.55, 0.85);
    const elevation = (y, z) => Math.atan2(y - eye.y, eye.z - z) * 180 / Math.PI;
    const caption = scene.sectionCallout.caption.position, hud = scene.hud.mesh.position;
    const captionTop = elevation(caption.y + CAPTION_PLANE_HEIGHT / 2, caption.z), hudBottom = elevation(hud.y - 0.3125, hud.z);
    assert.ok(captionTop <= hudBottom, `caption top ${captionTop.toFixed(1)} vs HUD bottom ${hudBottom.toFixed(1)}`);
    // The caption never occludes the line of sight to the highest incoming row.
    const farTopRow = new THREE.Vector3(0, 0.34 + 0.16, -8), gateZ = 0;
    const sightY = eye.y + (farTopRow.y - eye.y) * (eye.z - gateZ) / (eye.z - farTopRow.z);
    assert.ok(sightY < caption.y - CAPTION_PLANE_HEIGHT / 2);
    scene.setSectionTimeline([]); assert.equal(scene.sectionCallout.root.visible, false);
    scene.dispose(); assert.equal(world.children.length, 0);
});
