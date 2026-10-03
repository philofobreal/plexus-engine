import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { fakeDocument, findAll } from './helpers/fake-dom.mjs';

const doc = fakeDocument();
const load = createLoader({ three: THREE }, { document: doc });
const { menuLayout, menuItemAt, activateMenuItem, switchMenuTab, moveMenuFocus, menuHomeScreen, menuResults, formatResults, DEFAULT_MENU_STATE,
    MENU_CANVAS } = load('xr/XrMenuModel.ts');
const { XrMenuPanel, MENU_PANEL_WIDTH_METERS, MENU_PANEL_HEIGHT_METERS, MENU_DISTANCE_METERS } = load('xr/scene/XrMenuPanel.ts');
const { XR_SETTINGS, XR_SETTING_SECTIONS, DEFAULT_XR_SETTINGS } = load('xr/XrSettings.ts');
const { XrCommandDrawer } = load('xr/XrCommandDrawer.ts');
const { XrInputAdapter, POINTER_DEFAULT_LENGTH_METERS } = load('xr/runtime/XrInputAdapter.ts');

const context = (over = {}) => ({ settings: DEFAULT_XR_SETTINGS, sessionState: 'ready', trackTitle: 'Song', busy: false, canStart: true,
    status: '', results: null, ...over });
const inside = (i, label) => {
    assert.ok(i.x >= 0 && i.y >= 0 && i.x + i.w <= MENU_CANVAS.width && i.y + i.h <= MENU_CANVAS.height, `${label}: ${i.id} inside the canvas`);
};
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('every setting is reachable on its tab, and every screen fits the panel without overlapping items', () => {
    for (const section of XR_SETTING_SECTIONS) {
        const layout = menuLayout({ ...DEFAULT_MENU_STATE, screen: 'settings', tab: section.id }, context());
        for (const descriptor of XR_SETTINGS.filter(d => d.section === section.id)) {
            if (descriptor.kind === 'choice') for (const choice of descriptor.choices) {
                const option = layout.items.find(i => i.id === `opt:${descriptor.id}:${choice.value}`);
                assert.ok(option, `${descriptor.id}=${choice.value}`);
                assert.equal(option.selected, descriptor.read(DEFAULT_XR_SETTINGS) === choice.value);
                assert.ok(option.hint.startsWith(choice.hint));
            } else {
                assert.ok(layout.items.some(i => i.id === `step:${descriptor.id}:1`) && layout.items.some(i => i.id === `step:${descriptor.id}:-1`));
            }
        }
        assert.equal(layout.items.filter(i => i.kind === 'tab').map(i => i.label).join(), XR_SETTING_SECTIONS.map(s => s.title).join(), 'same tabs, same order');
    }
    const screens = [['main', 'ready'], ['pause', 'paused'], ['results', 'finished'], ...XR_SETTING_SECTIONS.map(s => ['settings', 'ready', s.id])];
    const results = { rank: 'S', accuracy: 0.91, score: 123456, maxCombo: 87, hits: 90, misses: 4, flawlessSections: 2, sections: 5 };
    for (const [screen, sessionState, tab] of screens) {
        const layout = menuLayout({ ...DEFAULT_MENU_STATE, screen, tab: tab ?? 'gameplay' }, context({ sessionState, results }));
        layout.items.forEach((a, i) => { inside(a, screen); for (const b of layout.items.slice(i + 1)) assert.ok(!overlaps(a, b), `${screen}: ${a.id} / ${b.id}`); });
        assert.ok(new Set(layout.items.map(i => i.id)).size === layout.items.length);
    }
    const main = menuLayout(DEFAULT_MENU_STATE, context({ busy: true, status: 'Recomposing choreography...' }));
    assert.equal(main.items.find(i => i.id === 'action:start').disabled, true, 'Start waits for the chart');
    assert.ok(main.texts.some(t => t.text === 'Recomposing choreography...'));
    const start = main.items[0];
    assert.equal(menuItemAt(main, start.x + 1, start.y + 1), start);
    assert.equal(menuItemAt(main, 2, 2), null);
});

test('activation: navigation stays in the menu, choices become scoped setting commands, steppers clamp', () => {
    const settingsState = { ...DEFAULT_MENU_STATE, screen: 'settings', tab: 'choreography' };
    const layout = menuLayout(settingsState, context());
    const pick = activateMenuItem(settingsState, context(), layout, 'opt:difficulty:ultra');
    assert.equal(pick.command.type, 'settings-changed'); assert.equal(pick.command.scope, 'chart');
    assert.equal(pick.command.settings.generation.difficulty, 'ultra');
    assert.equal(activateMenuItem(settingsState, context(), layout, 'opt:difficulty:normal').command, null, 'the current value is no change');
    assert.equal(activateMenuItem(settingsState, context(), layout, 'tab:background').state.tab, 'background');
    assert.equal(activateMenuItem(settingsState, context({ sessionState: 'paused' }), layout, 'action:back').state.screen, 'pause');
    assert.equal(activateMenuItem(settingsState, context({ sessionState: 'finished' }), layout, 'action:back').state.screen, 'results');
    assert.equal(activateMenuItem(settingsState, context(), layout, 'nonsense').command, null);
    const bg = { ...settingsState, tab: 'background' };
    const full = menuLayout(bg, context());
    const down = activateMenuItem(bg, context(), full, 'step:lineStroke:-1').command;
    assert.equal(down.scope, 'presentation'); assert.ok(Math.abs(down.settings.background.lineStroke - 0.88) < 1e-9, 'tenths of the range');
    const up = activateMenuItem(bg, context(), full, 'step:lineStroke:1').command;
    assert.equal(up.settings.background.lineStroke, 1, 'clamped to the maximum');
    const max = { ...DEFAULT_XR_SETTINGS, background: { ...DEFAULT_XR_SETTINGS.background, lineStroke: 1 } };
    const atMax = menuLayout(bg, context({ settings: max }));
    assert.equal(atMax.items.find(i => i.id === 'step:lineStroke:1').disabled, true);
    assert.equal(activateMenuItem(bg, context({ settings: max }), atMax, 'step:lineStroke:1').command, null, 'disabled at the bound');
    const busyMain = menuLayout(DEFAULT_MENU_STATE, context({ busy: true }));
    assert.equal(activateMenuItem(DEFAULT_MENU_STATE, context({ busy: true }), busyMain, 'action:start').command, null);
    const main = menuLayout(DEFAULT_MENU_STATE, context());
    assert.equal(activateMenuItem(DEFAULT_MENU_STATE, context(), main, 'action:start').command.type, 'start');
    assert.equal(activateMenuItem(DEFAULT_MENU_STATE, context(), main, 'action:exit').command.type, 'exit-vr');
    assert.equal(activateMenuItem(DEFAULT_MENU_STATE, context(), main, 'action:settings').state.screen, 'settings');
    assert.equal(switchMenuTab(settingsState, 1).tab, 'background');
    assert.equal(switchMenuTab({ ...settingsState, tab: 'character' }, 1).tab, 'gameplay', 'wraps');
    assert.equal(switchMenuTab(DEFAULT_MENU_STATE, 1), DEFAULT_MENU_STATE, 'only on Settings');
    assert.deepEqual(['idle', 'ready', 'playing', 'paused', 'finished'].map(menuHomeScreen), ['main', 'main', 'pause', 'pause', 'results']);
    const hovered = menuLayout({ ...settingsState, hover: 'opt:difficulty:ultra' }, context());
    assert.ok(hovered.texts.some(t => t.text.startsWith('Beyond Expert') && t.text.endsWith('restarts the song.')), 'the hovered hint explains the choice');
});

test('results count flawless sections like the song map and read the same on both menus', () => {
    const section = (over) => ({ index: 0, hits: 2, perfects: 2, misses: 0, resolved: 2, points: 0, bonus: 0, completedAt: 5, ...over });
    const results = menuResults({ state: 'finished', score: 900, maxScore: 1000, combo: 0, maxCombo: 12, hitCount: 9, missCount: 1, totalNotes: 10,
        sections: [section(), section({ perfects: 1 }), section({ misses: 1, hits: 1, perfects: 1 }), section({ resolved: 0, hits: 0, perfects: 0, completedAt: null })] });
    assert.equal(results.rank, 'S'); assert.equal(results.flawlessSections, 1); assert.equal(results.sections, 3);
    assert.equal(formatResults(results), 'Rank S - 90.0% - 900 pts - max combo 12 - 1/3 flawless sections');
    assert.equal(menuResults({ state: 'idle', score: 0, combo: 0, maxCombo: 0, hitCount: 0, missCount: 0, totalNotes: 0 }), null);
});

test('the VR panel redraws only on change, faces the player and maps a laser to the item it points at', () => {
    const panel = new XrMenuPanel(doc);
    assert.equal(panel.visible, false);
    assert.equal(panel.hitTest(new THREE.Ray(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 0, -1))), null, 'hidden panels take no rays');
    panel.setVisible(true);
    panel.placeFacing(0.5, 1.7, 0.2, Math.PI / 2); // looking toward -x
    assert.ok(Math.abs(panel.root.position.x - (0.5 - MENU_DISTANCE_METERS)) < 1e-9 && Math.abs(panel.root.position.z - 0.2) < 1e-9);
    panel.update(DEFAULT_MENU_STATE, context());
    panel.update(DEFAULT_MENU_STATE, context());
    assert.equal(panel.redrawCount, 1);
    panel.update({ ...DEFAULT_MENU_STATE, hover: 'action:start' }, context());
    assert.equal(panel.redrawCount, 2, 'hover redraws once');
    const start = panel.layout.items.find(i => i.id === 'action:start');
    const point = panel.mesh.localToWorld(new THREE.Vector3(((start.x + start.w / 2) / MENU_CANVAS.width - 0.5) * MENU_PANEL_WIDTH_METERS,
        (0.5 - (start.y + start.h / 2) / MENU_CANVAS.height) * MENU_PANEL_HEIGHT_METERS, 0));
    const origin = new THREE.Vector3(0.4, 1.4, 0.3);
    const hit = panel.hitTest(new THREE.Ray(origin, point.clone().sub(origin).normalize()));
    assert.equal(hit.item.id, 'action:start');
    assert.ok(Math.abs(hit.distance - point.distanceTo(origin)) < 1e-9);
    const behind = new THREE.Vector3(-2, 1.5, 0.2);
    assert.equal(panel.hitTest(new THREE.Ray(behind, point.clone().sub(behind).normalize())), null, 'never from behind');
    assert.equal(panel.hitTest(new THREE.Ray(origin, new THREE.Vector3(1, 0, 0))), null, 'pointing away');
    panel.dispose();
});

test('desktop keyboard focus moves through the items like a game menu and flips tabs at the row ends', () => {
    const settings = { ...DEFAULT_MENU_STATE, screen: 'settings', tab: 'choreography' };
    const ctx = context({ input: 'desktop' });
    const layout = menuLayout(settings, ctx);
    let state = moveMenuFocus(settings, layout, 'down');
    assert.equal(state.hover, layout.items.find(i => !i.disabled).id, 'nothing focused: the first item');
    state = { ...settings, hover: 'opt:difficulty:normal' };
    assert.equal(moveMenuFocus(state, layout, 'right').hover, 'opt:difficulty:hard');
    assert.equal(moveMenuFocus(state, layout, 'down').hover.split(':')[1], 'activity', 'the next row');
    assert.equal(moveMenuFocus({ ...settings, hover: 'opt:activity:balanced' }, layout, 'up').hover.split(':')[1], 'difficulty');
    const end = moveMenuFocus({ ...settings, hover: 'opt:zones:cross' }, layout, 'right');
    assert.equal(end.tab, 'background'); assert.equal(end.hover, 'tab:background', 'past the row end: the next tab');
    const ids = layout.items.filter(i => !i.disabled).map(i => i.id);
    assert.equal(moveMenuFocus({ ...settings, hover: ids.at(-1) }, layout, 'next').hover, ids[0], 'Tab wraps');
    assert.equal(moveMenuFocus({ ...settings, hover: ids[0] }, layout, 'previous').hover, ids.at(-1));
    const desktopPause = menuLayout({ ...DEFAULT_MENU_STATE, screen: 'pause' }, context({ sessionState: 'paused', input: 'desktop' }));
    assert.equal(desktopPause.items.some(i => i.id === 'action:exit'), false, 'no Exit VR on the desktop');
    assert.ok(desktopPause.texts.some(t => t.text.startsWith('Mouse or arrow keys')));
    assert.ok(menuLayout({ ...DEFAULT_MENU_STATE, screen: 'pause' }, context({ sessionState: 'paused' })).items.some(i => i.id === 'action:exit'));
});

test('pointer mode swaps sabers for lasers; rays and thumbsticks come from the tracked controller', () => {
    const grips = [new THREE.Group(), new THREE.Group()], rays = [new THREE.Group(), new THREE.Group()];
    const adapter = new XrInputAdapter({ xr: { getControllerGrip: i => grips[i], getController: i => rays[i] } }, new THREE.Scene());
    const ray = new THREE.Ray();
    assert.equal(adapter.getPointerRay('right', ray), false, 'no controller yet');
    rays[1].dispatchEvent({ type: 'connected', data: { handedness: 'right', gamepad: { axes: [0, 0, -0.8, 0.1] } } });
    rays[1].position.set(0.3, 1.2, -0.1); rays[1].rotation.set(0, Math.PI / 2, 0);
    assert.equal(adapter.getPointerRay('right', ray), true);
    assert.ok(ray.origin.distanceTo(new THREE.Vector3(0.3, 1.2, -0.1)) < 1e-9);
    assert.ok(ray.direction.distanceTo(new THREE.Vector3(-1, 0, 0)) < 1e-9, 'along the controller\'s -Z');
    assert.equal(adapter.getThumbstickX('right'), -0.8, 'xr-standard thumbstick X');
    assert.equal(adapter.getThumbstickX('left'), 0);
    const saber = grips[1].children[0], laser = rays[1].children.find(c => c.name === 'menuPointer');
    assert.ok(saber.visible && !laser.visible);
    adapter.setPointerMode(true);
    assert.ok(!saber.visible && laser.visible && adapter.isPointerMode);
    adapter.setPointerLength('right', 0.9); assert.equal(laser.scale.z, 0.9);
    adapter.setPointerLength('right', null); assert.equal(laser.scale.z, POINTER_DEFAULT_LENGTH_METERS);
    adapter.setPointerMode(false);
    assert.ok(saber.visible && !laser.visible);
    adapter.dispose();
    assert.equal(rays[1].children.length, 0, 'the laser is removed on dispose');
});
