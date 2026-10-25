import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';
import { fakeDocument, findAll } from './helpers/fake-dom.mjs';
import { historicalXrSettings } from './helpers/xr-historical-settings.mjs';

const doc = fakeDocument();
const load = createLoader({ three: THREE }, { document: doc });
const { menuLayout, menuItemAt, activateMenuItem, switchMenuTab, moveMenuFocus, menuHomeScreen, menuResults, formatResults, DEFAULT_MENU_STATE,
    MENU_CANVAS, settingsReport, diagnosticsReport } = load('xr/XrMenuModel.ts');
const clipboardNavigator = {};
const { copyTextToClipboard } = createLoader({}, { navigator: clipboardNavigator })('xr/XrClipboard.ts');
const { XrMenuPanel, MENU_PANEL_WIDTH_METERS, MENU_PANEL_HEIGHT_METERS, MENU_DISTANCE_METERS } = load('xr/scene/XrMenuPanel.ts');
const { XR_SETTINGS, XR_SETTING_SECTIONS } = load('xr/XrSettings.ts');
/** Menu mechanics run on a fixed baseline, independent of the shipped defaults. */
const DEFAULT_XR_SETTINGS = historicalXrSettings(load);
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

test('every settings tab ends above its two-line hint, which ends above the Back button', () => {
    for (const section of XR_SETTING_SECTIONS) {
        const layout = menuLayout({ ...DEFAULT_MENU_STATE, screen: 'settings', tab: section.id, hover: 'action:back' }, context({ input: 'desktop' }));
        const hint = layout.texts.find(t => t.maxLines === 2);
        const back = layout.items.find(i => i.id === 'action:back');
        const rows = layout.items.filter(i => i.kind === 'option' || i.kind === 'step');
        const lowest = Math.max(...rows.map(i => i.y + i.h));
        assert.ok(lowest <= hint.y - hint.size, `${section.id}: rows end at ${lowest}, the hint starts at ${hint.y - hint.size}`);
        assert.ok(hint.y + hint.size * 1.3 <= back.y, `${section.id}: the second hint line stays above Back`);
        assert.ok(rows.every(i => i.h >= 38), `${section.id}: controls stay large enough to point at`);
    }
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
    assert.equal(switchMenuTab({ ...settingsState, tab: 'system' }, 1).tab, 'gameplay', 'wraps');
    assert.equal(switchMenuTab(DEFAULT_MENU_STATE, 1), DEFAULT_MENU_STATE, 'only on Settings');
    assert.deepEqual(['idle', 'ready', 'playing', 'paused', 'finished'].map(menuHomeScreen), ['main', 'main', 'pause', 'pause', 'results']);
    const hovered = menuLayout({ ...settingsState, hover: 'opt:difficulty:ultra' }, context());
    assert.ok(hovered.texts.some(t => t.text.startsWith('Beyond Expert') && t.text.endsWith('restarts the song.')), 'the hovered hint explains the choice');
});

test('Settings has one-click Copy settings and Copy diagnostics buttons beside Back; the outcome is shown there', () => {
    const settings = { ...DEFAULT_MENU_STATE, screen: 'settings' };
    for (const section of XR_SETTING_SECTIONS) {
        const layout = menuLayout({ ...settings, tab: section.id }, context({ diagnostics: 'Display 72.0 fps' }));
        const back = layout.items.find(i => i.id === 'action:back');
        const copy = ['action:copy-settings', 'action:copy-diagnostics'].map(id => layout.items.find(i => i.id === id));
        for (const button of copy) {
            assert.ok(button && button.kind === 'button', `${section.id}: ${button?.id}`);
            inside(button, section.id); assert.equal(button.y, back.y, 'one bottom bar');
            for (const other of layout.items) if (other !== button) assert.ok(!overlaps(button, other), `${button.id} vs ${other.id}`);
        }
        assert.equal(copy[1].disabled, false);
    }
    const layout = menuLayout(settings, context({ diagnostics: 'Display 72.0 fps' }));
    assert.equal(JSON.stringify(activateMenuItem(settings, context(), layout, 'action:copy-settings').command), '{"type":"copy-settings"}');
    assert.equal(JSON.stringify(activateMenuItem(settings, context(), layout, 'action:copy-diagnostics').command), '{"type":"copy-diagnostics"}');
    assert.equal(activateMenuItem(settings, context(), layout, 'action:copy-settings').state.screen, 'settings', 'stays on Settings');
    // Without a diagnostics line the button is disabled and says why.
    const empty = menuLayout(settings, context());
    const diagnostics = empty.items.find(i => i.id === 'action:copy-diagnostics');
    assert.equal(diagnostics.disabled, true); assert.match(diagnostics.hint, /System > Diagnostics/);
    assert.equal(activateMenuItem(settings, context(), empty, 'action:copy-diagnostics').command, null);
    // The outcome takes the hint line's place (full width, above the bar) until the next menu action.
    const noticed = menuLayout({ ...settings, hover: 'action:copy-settings' }, context({ notice: 'Diagnostics + settings copied.' }));
    const notice = noticed.texts.find(t => t.text === 'Diagnostics + settings copied.');
    assert.ok(notice && notice.role === 'accent' && notice.maxLines === 2 && notice.y + notice.size * 1.3 <= layout.items.find(i => i.id === 'action:back').y);
    assert.ok(!noticed.texts.some(t => t.text === noticed.items.find(i => i.id === 'action:copy-settings').hint), 'instead of the hover hint');
});

test('Reset defaults sits in the bottom bar and needs a second click; it restores every authored default and restarts only when gameplay changes', () => {
    const { resetXrSettings } = load('xr/XrMenuModel.ts');
    const { DEFAULT_XR_SETTINGS: SHIPPED, changeScope } = load('xr/XrSettings.ts');
    const custom = { ...SHIPPED, background: { ...SHIPPED.background, rateHz: 24 }, system: { ...SHIPPED.system, diagnostics: false, backgroundPacing: 'fixed', backgroundRaster: 'cpu' } };
    const state = { ...DEFAULT_MENU_STATE, screen: 'settings', hover: 'action:reset' };
    for (const section of XR_SETTING_SECTIONS) {
        const layout = menuLayout({ ...state, tab: section.id }, context({ settings: custom, diagnostics: 'x' }));
        const reset = layout.items.find(i => i.id === 'action:reset'), back = layout.items.find(i => i.id === 'action:back');
        assert.ok(reset && reset.kind === 'button' && !reset.disabled); inside(reset, section.id); assert.equal(reset.y, back.y, 'one bottom bar');
        for (const other of layout.items) if (other !== reset) assert.ok(!overlaps(reset, other), `${reset.id} vs ${other.id}`);
    }
    // First click arms (no command), the second resets; the label and hint say so.
    const layout = menuLayout(state, context({ settings: custom }));
    assert.equal(layout.items.find(i => i.id === 'action:reset').label, 'Reset defaults');
    const armed = activateMenuItem(state, context({ settings: custom }), layout, 'action:reset');
    assert.equal(armed.command, null); assert.equal(armed.state.confirm, 'reset');
    const armedLayout = menuLayout(armed.state, context({ settings: custom }));
    const confirm = armedLayout.items.find(i => i.id === 'action:reset');
    assert.equal(confirm.label, 'Confirm reset'); assert.match(confirm.hint, /Click again/);
    const done = activateMenuItem(armed.state, context({ settings: custom }), armedLayout, 'action:reset');
    assert.equal(done.state.confirm, null); assert.equal(done.command.type, 'settings-changed');
    assert.equal(JSON.stringify(done.command.settings), JSON.stringify(SHIPPED), 'every setting at its default, Diagnostics included');
    assert.equal(done.command.settings.system.backgroundRaster, 'webgl', 'Background raster back to WebGL');
    assert.equal(done.command.scope, changeScope(custom, done.command.settings));
    assert.equal(done.command.scope, 'presentation', 'presentation-only differences do not restart the song');
    // Anything else, or moving the pointer away, cancels the armed reset.
    assert.equal(activateMenuItem(armed.state, context({ settings: custom }), armedLayout, 'tab:background').state.confirm, null);
    const away = { ...armed.state, hover: 'action:back' };
    assert.equal(menuLayout(away, context({ settings: custom })).items.find(i => i.id === 'action:reset').label, 'Reset defaults');
    assert.equal(activateMenuItem(away, context({ settings: custom }), layout, 'action:back').state.confirm, null, 'another choice disarms it');
    // At the defaults there is nothing to reset.
    const atDefaults = menuLayout(state, context({ settings: resetXrSettings() }));
    assert.equal(atDefaults.items.find(i => i.id === 'action:reset').disabled, true);
    assert.equal(changeScope(SHIPPED, resetXrSettings()), null);
});

test('the settings report lists every setting as the menu shows it, plus the exact record', () => {
    const report = settingsReport(DEFAULT_XR_SETTINGS, 'Song');
    assert.ok(report.startsWith('Plexus XR settings - Song'));
    for (const section of XR_SETTING_SECTIONS) assert.ok(report.includes(`[${section.title}]`), section.title);
    for (const descriptor of XR_SETTINGS) {
        const value = descriptor.read(DEFAULT_XR_SETTINGS);
        const shown = descriptor.kind === 'choice' ? descriptor.choices.find(c => c.value === value).label : String(value);
        assert.ok(report.includes(`${descriptor.label}: ${shown}`), descriptor.id);
    }
    const json = report.split('\n').find(line => line.startsWith('JSON: '));
    assert.equal(json.slice(6), JSON.stringify(DEFAULT_XR_SETTINGS), 'reproducible');
    // Copy diagnostics: the line first, then the whole settings report (one paste per measurement).
    const diagnostics = diagnosticsReport('Display 72.0 fps | Background 24.0 fps', DEFAULT_XR_SETTINGS, 'Song');
    assert.equal(diagnostics, `Plexus XR diagnostics\nDisplay 72.0 fps | Background 24.0 fps\n\n${report}`);
});

test('the clipboard helper reports whether the text arrived: Clipboard API first, then the copy command', async () => {
    const written = [];
    const withNavigator = async (clipboard, run) => {
        if (clipboard) clipboardNavigator.clipboard = clipboard; else delete clipboardNavigator.clipboard;
        return run();
    };
    assert.equal(await withNavigator({ writeText: async text => { written.push(text); } }, () => copyTextToClipboard('a', undefined)), true);
    assert.deepEqual(written, ['a']);
    // Blocked API, no document: false (the menu says so).
    assert.equal(await withNavigator({ writeText: async () => { throw new Error('blocked'); } }, () => copyTextToClipboard('b', undefined)), false);
    // Fallback: a hidden text area and the copy command, removed afterwards.
    const removed = [], appended = [];
    const fake = { body: { appendChild: el => appended.push(el) }, execCommand: command => command === 'copy',
        createElement: () => ({ style: {}, setAttribute() {}, select() {}, remove() { removed.push(this); } }) };
    assert.equal(await withNavigator(null, () => copyTextToClipboard('c', fake)), true);
    assert.equal(appended[0].value, 'c'); assert.equal(removed.length, 1);
});

test('results count flawless sections like the song map and read the same on both menus', () => {
    const section = (over) => ({ index: 0, hits: 2, perfects: 2, misses: 0, resolved: 2, points: 0, bonus: 0, completedAt: 5, ...over });
    const results = menuResults({ state: 'finished', score: 900, maxScore: 1000, combo: 0, maxCombo: 12, hitCount: 9, missCount: 1, totalNotes: 10,
        sections: [section(), section({ perfects: 1 }), section({ misses: 1, hits: 1, perfects: 1 }), section({ resolved: 0, hits: 0, perfects: 0, completedAt: null })] });
    assert.equal(results.rank, 'S'); assert.equal(results.flawlessSections, 1); assert.equal(results.sections, 3);
    assert.equal(formatResults(results), 'Rank S - 90.0% - 900 pts - max combo 12 - 1/3 flawless sections');
    assert.equal(menuResults({ state: 'idle', score: 0, combo: 0, maxCombo: 0, hitCount: 0, missCount: 0, totalNotes: 0 }), null);
});

test('crowded menu labels abbreviate without reducing the readable font or overflowing controls', () => {
    const { shortenMenuText } = load('xr/scene/XrMenuPanel.ts');
    const measure = value => value.length * 12;
    assert.equal(shortenMenuText('Performance', 80, measure), 'Perf.');
    assert.equal(shortenMenuText('Balanced', 80, measure), 'Bal.');
    assert.equal(shortenMenuText('4K', 80, measure), '4K');
    assert.equal(shortenMenuText('Unknown long name', 80, measure), 'Unkno…');
    assert.equal(shortenMenuText('Unknown', 1, measure), '');
    for (const section of XR_SETTING_SECTIONS) {
        const layout = menuLayout({ ...DEFAULT_MENU_STATE, screen: 'settings', tab: section.id }, context());
        for (const item of layout.items) assert.ok(measure(shortenMenuText(item.label, item.w - 16, measure)) <= item.w - 16);
        for (const label of layout.texts.filter(t => t.role === 'label')) assert.ok(label.width <= 234, 'row labels stay out of controls');
    }
});

test('every settings tab actually draws fitted labels at its authored font size', () => {
    const panel = new XrMenuPanel(doc), ctx = panel.canvas.context;
    for (const section of XR_SETTING_SECTIONS) {
        ctx.calls.length = 0;
        const layout = panel.update({ ...DEFAULT_MENU_STATE, screen: 'settings', tab: section.id }, context());
        const draws = ctx.calls.filter(c => c[0] === 'fillText');
        for (const item of layout.items) {
            const draw = draws.find(c => c[2] === item.x + item.w / 2 && c[3] === item.y + item.h / 2 + 1);
            assert.ok(draw, item.id);
            const size = item.kind === 'step' ? 34 : item.kind === 'button' ? 28 : 22;
            assert.match(draw[4], new RegExp(` ${size}px `), item.id);
            ctx.font = draw[4];
            assert.ok(ctx.measureText(draw[1]).width <= item.w - 16, `${item.id}: rendered width`);
            if (item.id === 'opt:backgroundQuality:4k') assert.equal(draw[1], '4K');
        }
        for (const line of layout.texts.filter(t => t.role === 'label' && t.text)) {
            const draw = draws.find(c => c[2] === line.x && c[3] === line.y);
            assert.ok(draw, line.text);
            assert.match(draw[4], new RegExp(` ${line.size}px `));
            ctx.font = draw[4];
            assert.ok(ctx.measureText(draw[1]).width <= line.width, line.text);
        }
    }
    panel.dispose();
});

test('desktop menu remains in front of a camera that has looked up and turned around', () => {
    const panel = new XrMenuPanel(doc), camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.65, 2.6); camera.rotation.set(1.2, 2.5, 0, 'YXZ'); camera.updateMatrixWorld(true);
    panel.placeForCamera(camera); panel.setVisible(true); panel.update(DEFAULT_MENU_STATE, context());
    const ray = new THREE.Ray(camera.position.clone(), panel.root.position.clone().sub(camera.position).normalize());
    assert.ok(panel.hitTest(ray)); assert.ok(panel.root.quaternion.equals(camera.quaternion));
    panel.dispose();
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
    const hovered = { ...DEFAULT_MENU_STATE, hover: 'action:start' }, frameContext = context();
    const layout = panel.update(hovered, frameContext);
    assert.equal(panel.redrawCount, 2, 'hover redraws once');
    assert.equal(panel.update(hovered, frameContext), layout, 'the same state and context objects reuse the layout');
    assert.equal(panel.redrawCount, 2);
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

test('the enlarged menu keeps nine category rows at full control height and reserves separate header, hint and footer space', () => {
    const settingsModule = load('xr/XrSettings.ts');
    const descriptors = [...settingsModule.XR_SETTINGS];
    // Exercise the category capacity even when the current descriptor set has fewer than nine rows.
    let count = descriptors.filter(d => d.section === 'choreography').length;
    while (count < 9) descriptors.push({ id: `capacity-${count++}`, section: 'choreography', label: 'Additional setting',
        scope: 'chart', kind: 'choice', choices: [{ value: 'one', label: 'One', hint: 'One' }, { value: 'two', label: 'Two', hint: 'Two' }],
        read: () => 'one', write: settings => settings });
    const capacityLoad = createLoader({ './XrSettings': { ...settingsModule, XR_SETTINGS: descriptors } });
    const { menuLayout: capacityLayout } = capacityLoad('xr/XrMenuModel.ts');
    const layout = capacityLayout({ ...DEFAULT_MENU_STATE, screen: 'settings', tab: 'choreography', hover: 'action:copy-settings' },
        context({ trackTitle: 'A very long filename '.repeat(40) }));
    assert.ok(MENU_CANVAS.width >= 1280 && MENU_CANVAS.height >= 900);
    const rows = layout.items.filter(i => i.kind === 'option' || i.kind === 'step');
    assert.equal(new Set(rows.map(i => i.y)).size, 9);
    assert.ok(rows.every(i => i.h >= 52), 'category capacity does not depend on shrinking laser targets');
    const tabs = layout.items.filter(i => i.kind === 'tab'), hint = layout.texts.find(t => t.maxLines === 2);
    const back = layout.items.find(i => i.id === 'action:back');
    assert.equal(tabs.length, XR_SETTING_SECTIONS.length, 'no added categories');
    assert.ok(Math.max(...tabs.map(i => i.y + i.h)) < Math.min(...rows.map(i => i.y)));
    assert.ok(Math.max(...rows.map(i => i.y + i.h)) < hint.y - hint.size);
    assert.ok(hint.y + hint.size * 1.7 < back.y, 'both hint lines have bottom-bar clearance');
    const heading = layout.texts.find(t => t.text === 'SETTINGS'), filename = layout.texts.find(t => t.role === 'muted' && t.y === 58);
    assert.ok(heading.x + heading.width < filename.x - filename.width, 'long filenames cannot overwrite the title');
    layout.items.forEach((a, i) => { inside(a, 'nine-row settings');
        for (const b of layout.items.slice(i + 1)) assert.ok(!overlaps(a, b), `${a.id} / ${b.id}`); });
    assert.equal(MENU_PANEL_WIDTH_METERS / MENU_CANVAS.width, 1.28 / 1024, 'larger VR panel preserves physical text size');
});

test('desktop camera fitting keeps every enlarged-panel corner and control reachable in landscape, portrait and zoomed views', () => {
    const panel = new XrMenuPanel(doc);
    panel.setVisible(true);
    panel.update({ ...DEFAULT_MENU_STATE, screen: 'settings', tab: 'choreography' }, context({ input: 'desktop' }));
    const redraws = panel.redrawCount;
    const point = new THREE.Vector3();
    for (const [aspect, fov, zoom] of [[16 / 9, 70, 1], [9 / 16, 70, 1], [1 / 3, 45, 1], [9 / 16, 60, 1.5]]) {
        const camera = new THREE.PerspectiveCamera(fov, aspect, .05, 1000);
        camera.zoom = zoom; camera.updateProjectionMatrix();
        camera.position.set(.7, 1.65, 2.6); camera.rotation.set(.8, 2.1, 0, 'YXZ'); camera.updateMatrixWorld(true);
        panel.placeForCamera(camera);
        for (const x of [-MENU_PANEL_WIDTH_METERS / 2, MENU_PANEL_WIDTH_METERS / 2])
            for (const y of [-MENU_PANEL_HEIGHT_METERS / 2, MENU_PANEL_HEIGHT_METERS / 2]) {
                point.set(x, y, 0); panel.mesh.localToWorld(point); point.project(camera);
                assert.ok(Math.abs(point.x) <= .900001 && Math.abs(point.y) <= .900001, `${aspect}/${fov}/${zoom}: visible corner`);
                assert.ok(point.z > -1 && point.z < 1);
            }
        for (const item of panel.layout.items) {
            point.set(((item.x + item.w / 2) / MENU_CANVAS.width - .5) * MENU_PANEL_WIDTH_METERS,
                (.5 - (item.y + item.h / 2) / MENU_CANVAS.height) * MENU_PANEL_HEIGHT_METERS, 0);
            panel.mesh.localToWorld(point);
            const hit = panel.hitTest(new THREE.Ray(camera.position.clone(), point.clone().sub(camera.position).normalize()));
            assert.equal(hit?.item?.id, item.id);
        }
    }
    assert.equal(panel.redrawCount, redraws, 'camera fitting never rerasterizes the menu');
    panel.dispose();
});
