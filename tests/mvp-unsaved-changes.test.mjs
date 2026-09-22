import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const flush = () => new Promise(resolve => setImmediate(resolve));
function load(name, globals = {}) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync(`src/ui/mvp/${name}.ts`, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText, { exports, ...globals });
    return exports[name];
}

class FakeElement extends EventTarget {
    children = new Map();
    open = false;
    disabled = false;
    textContent = '';
    classList = { toggle() {} };
    setAttribute() {}
    querySelector(selector) {
        if (!this.children.has(selector)) this.children.set(selector, new FakeElement());
        return this.children.get(selector);
    }
    showModal() { this.open = true; }
    close() { if (this.open) { this.open = false; this.dispatchEvent(new Event('close')); } }
    click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
}

function guardHarness() {
    const listeners = new Map(), timers = new Map(), confirmations = [];
    let dirty = false, sequence = 0;
    const host = {
        addEventListener: (name, handler) => listeners.set(name, handler),
        removeEventListener: name => listeners.delete(name),
        setTimeout: callback => { const id = ++sequence; timers.set(id, callback); return id; },
        clearTimeout: id => timers.delete(id)
    };
    const Guard = load('UnsavedChangesGuard');
    const guard = new Guard(host, {
        hasChanges: () => dirty,
        confirm: continuing => new Promise(resolve => confirmations.push({ continuing, resolve }))
    });
    return { guard, listeners, confirmations, timers, setDirty(value) { dirty = value; guard.sync(); },
        runTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); } };
}

test('native unload protection exists only while dirty and offers Save after staying', () => {
    const h = guardHarness();
    h.guard.sync(); assert.equal(h.listeners.size, 0);
    h.setDirty(true); assert.equal(h.listeners.size, 1);
    let prevented = false;
    const event = { preventDefault() { prevented = true; }, returnValue: false };
    h.listeners.get('beforeunload')(event);
    assert.equal(prevented, true);
    assert.equal(event.returnValue, true);
    assert.equal(h.confirmations.length, 0, 'no asynchronous dialog in the unload callback');
    h.runTimers();
    assert.equal(h.confirmations[0].continuing, false, 'stay-mode only offers saving/keeping edits');
    h.setDirty(false); assert.equal(h.listeners.size, 0);
});

test('track replacement waits for an explicit decision; duplicate attempts cannot replace it', async () => {
    const h = guardHarness(); const loaded = [];
    await h.guard.run(() => loaded.push('clean'));
    h.setDirty(true);
    const pending = h.guard.run(() => loaded.push('first'));
    await h.guard.run(() => loaded.push('duplicate'));
    assert.deepEqual(loaded, ['clean']);
    assert.equal(h.confirmations.length, 1);
    h.confirmations[0].resolve(false); await pending;
    assert.deepEqual(loaded, ['clean'], 'Keep editing never replaces the track');
    const accepted = h.guard.run(() => { loaded.push('accepted'); h.setDirty(false); });
    h.confirmations[1].resolve(true); await accepted;
    assert.deepEqual(loaded, ['clean', 'accepted']);
    assert.equal(h.listeners.size, 0);
});

test('guard cleanup cancels deferred modal and removes unload listener', () => {
    const h = guardHarness(); h.setDirty(true);
    h.listeners.get('beforeunload')({ preventDefault() {} });
    h.guard.dispose(); h.runTimers();
    assert.equal(h.listeners.size, 0);
    assert.equal(h.confirmations.length, 0);
});

function dialogHarness(save, changes = { journey: true, tuning: false }) {
    const Dialog = load('UnsavedChangesDialog', { document: { createElement: () => new FakeElement() } });
    const dialog = new Dialog(async choice => {
        const saved = await save(choice);
        if (saved) {
            if (choice !== 'tuning') changes.journey = false;
            if (choice !== 'journey') changes.tuning = false;
            if (choice === 'history' || choice === 'all') changes.history = false;
        }
        return saved;
    }, () => ({ ...changes }), () => { changes.history = false; });
    return { dialog, changes, save: dialog.root.querySelector('[data-save-all]'),
        saveJourney: dialog.root.querySelector('[data-save-journey]'), saveTuning: dialog.root.querySelector('[data-save-tuning]'),
        description: dialog.root.querySelector('#mvp-unsaved-description'), discard: dialog.root.querySelector('[data-discard]'),
        cancel: dialog.root.querySelector('[data-cancel]'), status: dialog.root.querySelector('[role="status"]') };
}

test('specific history errors remain inside the modal and a retry can complete the pending navigation', async () => {
    const Dialog = load('UnsavedChangesDialog', { document: { createElement: () => new FakeElement() } });
    let history = true, fail = true;
    const dialog = new Dialog(async () => { if (fail) return false; history = false; return true; },
        () => ({ journey: false, tuning: false, history }), () => {}, () => 'History is too large to save.');
    const pending = dialog.confirm(true);
    dialog.root.querySelector('[data-save-history]').click(); await flush();
    assert.equal(dialog.root.open, true);
    assert.equal(dialog.root.querySelector('[role="status"]').textContent, 'History is too large to save.');
    assert.equal(dialog.root.querySelector('[data-save-history]').disabled, false);
    fail = false; dialog.root.querySelector('[data-save-history]').click();
    assert.equal(await pending, true);
    assert.equal(dialog.root.open, false);
});

test('dialog retains changes on failed/throwing save; successful retry alone permits continuation', async () => {
    let attempt = 0;
    const h = dialogHarness(async () => { if (++attempt === 1) throw new Error('storage'); return attempt > 2; });
    let continued = false;
    const pending = h.dialog.confirm(true).then(value => { continued = value; });
    for (let i = 0; i < 2; i++) {
        h.save.click(); await flush();
        assert.equal(h.dialog.root.open, true);
        assert.equal(continued, false);
        assert.match(h.status.textContent, /not saved/);
    }
    h.save.click(); await pending;
    assert.equal(continued, true); assert.equal(h.dialog.root.open, false);
});

test('Escape/cancel preserves edits; returned-page history opt-out cannot discard unsaved panels', async () => {
    let writes = 0;
    const h = dialogHarness(async () => { writes++; return true; });
    const cancel = h.dialog.confirm(true);
    const escape = new Event('cancel', { cancelable: true });
    h.dialog.root.dispatchEvent(escape);
    assert.equal(await cancel, false); assert.equal(escape.defaultPrevented, true);
    const discard = h.dialog.confirm(true); h.discard.click(); assert.equal(await discard, true);
    assert.equal(writes, 0);
    const staying = h.dialog.confirm(false);
    assert.equal(h.discard.hidden, false); assert.equal(h.discard.disabled, true); assert.equal(h.save.textContent, 'Save all');
    assert.equal(await h.dialog.confirm(true), false, 'an open prompt cannot be replaced');
    h.cancel.click(); assert.equal(await staying, false);
});

test('separate panel saves leave history pending, with explicit full save or history opt-out', async () => {
    for (const finish of ['history', 'all', 'discard']) {
        const choices = [], h = dialogHarness(async choice => { choices.push(choice); return true; },
            { journey: true, tuning: true, history: true });
        const pending = h.dialog.confirm(false);
        const history = h.dialog.root.querySelector('[data-save-history]');
        assert.equal(history.disabled, false);
        h.saveJourney.click(); await flush(); h.saveTuning.click(); await flush();
        assert.equal(h.changes.history, true); assert.equal(h.dialog.root.open, true);
        assert.equal(h.discard.disabled, false);
        if (finish === 'discard') h.discard.click();
        else if (finish === 'history') history.click(); else h.save.click();
        assert.equal(await pending, true);
        assert.equal(h.changes.history, false);
        assert.deepEqual(choices, finish === 'discard' ? ['journey', 'tuning'] : ['journey', 'tuning', finish]);
    }
});

test('while saving the modal blocks double writes, discard and Escape', async () => {
    let resolveSave, writes = 0;
    const h = dialogHarness(() => { writes++; return new Promise(resolve => { resolveSave = resolve; }); });
    const pending = h.dialog.confirm(true);
    h.save.click(); h.save.click(); h.discard.click();
    h.dialog.root.dispatchEvent(new Event('cancel', { cancelable: true }));
    assert.equal(writes, 1); assert.equal(h.dialog.root.open, true);
    resolveSave(true); assert.equal(await pending, true);
});

test('each separate modal save preserves the other domain and waits for its explicit save', async () => {
    for (const first of ['journey', 'tuning']) {
        const choices = [];
        const h = dialogHarness(async choice => { choices.push(choice); return true; }, { journey: true, tuning: true });
        let continued = false;
        const pending = h.dialog.confirm(true).then(value => { continued = value; });
        assert.match(h.description.textContent, /Automation and visual tuning/);
        const firstButton = first === 'journey' ? h.saveJourney : h.saveTuning;
        const secondButton = first === 'journey' ? h.saveTuning : h.saveJourney;
        firstButton.click(); await flush();
        assert.equal(h.dialog.root.open, true);
        assert.equal(continued, false);
        assert.equal(firstButton.disabled, true);
        assert.equal(secondButton.disabled, false);
        assert.equal(h.save.disabled, false);
        assert.match(h.status.textContent, /Other changes are still unsaved/);
        assert.match(h.description.textContent, first === 'journey' ? /^Visual tuning/ : /^Automation changes/);
        firstButton.click();
        assert.deepEqual(choices, [first], 'already saved group cannot be written again');
        secondButton.click(); await pending;
        assert.equal(continued, true);
        assert.deepEqual(choices, first === 'journey' ? ['journey', 'tuning'] : ['tuning', 'journey']);
    }
});

test('Save all is one explicit choice; tuning-only changes still open the shared modal', async () => {
    const choices = [];
    const h = dialogHarness(async choice => { choices.push(choice); return true; }, { journey: false, tuning: true });
    const pending = h.dialog.confirm(true);
    assert.equal(h.saveJourney.disabled, true);
    assert.equal(h.saveTuning.disabled, false);
    assert.match(h.description.textContent, /Advanced tuning/);
    h.save.click(); assert.equal(await pending, true);
    assert.deepEqual(choices, ['all']);
});

test('partial success followed by a failed save never discards remaining changes', async () => {
    const h = dialogHarness(async choice => choice === 'journey', { journey: true, tuning: true });
    const pending = h.dialog.confirm(true);
    h.saveJourney.click(); await flush();
    h.saveTuning.click(); await flush();
    assert.deepEqual(h.changes, { journey: false, tuning: true });
    assert.equal(h.dialog.root.open, true);
    assert.equal(h.saveJourney.disabled, true);
    assert.equal(h.saveTuning.disabled, false);
    assert.match(h.status.textContent, /not saved/);
    h.cancel.click(); assert.equal(await pending, false);
    assert.equal(h.changes.tuning, true);
});

test('advanced Save projects unsaved, busy, failure and successful states consistently', async () => {
    let resolveSave;
    const Panel = load('AdvancedTuningPanel', {
        document: { createElement: () => new FakeElement() },
        require: request => request.includes('visualTuning') ? { visualTuningControls: [] } : { ADVANCED_BOOST_GROUPS: [] }
    });
    const panel = new Panel({ onChange() {}, onReset() {}, onSave: () => new Promise(resolve => { resolveSave = resolve; }) });
    const button = panel.root.querySelector('[data-meta-save]'), status = panel.root.querySelector('[data-meta-save-status]');
    panel.setSaveState(true, false); assert.equal(button.disabled, true);
    panel.setSaveState(true, true); assert.match(status.textContent, /Unsaved visual tuning/);
    button.click(); assert.equal(button.disabled, true);
    resolveSave(false); await flush(); assert.match(status.textContent, /Couldn't save/);
    button.click(); resolveSave(true); await flush(); assert.match(status.textContent, /newer visual tuning changes/);
    button.click(); panel.setSaveState(false, true); resolveSave(true); await flush();
    assert.equal(status.textContent, 'Visual tuning saved for this track.');
});

test('dramaturgy Save button reflects dirty/busy state and reports failure without claiming a save', async () => {
    let resolveSave;
    const Toolbar = load('TimelineToolbar', { document: { createElement: () => new FakeElement() } });
    const toolbar = new Toolbar({ onSave: () => new Promise(resolve => { resolveSave = resolve; }) });
    const button = toolbar.root.querySelector('.mvp-journey-save');
    const status = toolbar.root.querySelector('.mvp-journey-save-status');
    toolbar.setSaveState(true, false); assert.equal(button.disabled, true);
    toolbar.setSaveState(true, true); assert.match(status.textContent, /Unsaved/);
    button.click(); assert.equal(button.disabled, true);
    resolveSave(false); await flush(); assert.match(status.textContent, /Could not save/);
    assert.equal(button.disabled, false);
    button.click(); toolbar.setSaveState(false, true); resolveSave(true); await flush();
    assert.equal(status.textContent, 'Automation saved for this track.');
});
