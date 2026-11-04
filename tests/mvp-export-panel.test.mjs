import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createLoader } from './helpers/xr-loader.mjs';

test('the compact export retains progress, the pending command and the final outcome when reopened', () => {
    const document = { activeElement: null, createElement: () => new Element() };
    class Element extends EventTarget {
        children = new Map();
        disabled = false;
        textContent = '';
        style = {};
        dataset = {};
        classes = new Set();
        classList = {
            add: name => this.classes.add(name),
            remove: name => this.classes.delete(name),
            contains: name => this.classes.has(name),
            toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name)
        };
        querySelector(selector) {
            if (!this.children.has(selector)) this.children.set(selector, new Element());
            return this.children.get(selector);
        }
        querySelectorAll() { return []; }
        focus() { document.activeElement = this; }
        click() { this.dispatchEvent(new Event('click')); }
    }
    const { ExportDialog } = createLoader({}, { document, window: {} })('ui/mvp/ExportDialog.ts');
    let stops = 0;
    const view = new ExportDialog({ onStart() {}, onStop() { stops++; }, onCancel() {} });
    const find = selector => view.root.querySelector(selector);
    const compact = () => view.root.classList.contains('mvp-export-compact');
    const details = find('.mvp-export-details');
    const stop = find('.mvp-export-stop');
    const status = find('.mvp-modal-status');
    view.open();
    view.setActive(true);
    view.setProgress(.23);
    find('.mvp-export-minimize').click();
    assert.equal(compact(), true);
    assert.equal(document.activeElement, details);
    assert.equal(view.blocksWorkspaceShortcuts(), true);
    assert.equal(find('.mvp-export-progress output').textContent, '23%');
    stop.click();
    details.click();
    view.setProgress(.24);
    stop.click();
    assert.equal(compact(), false);
    assert.equal(stops, 1);
    assert.match(status.textContent, /^Stopping and saving/);
    view.close();
    assert.equal(compact(), true);
    view.setStatus('Done');
    view.setActive(false);
    assert.equal(view.blocksWorkspaceShortcuts(), false);
    assert.equal(find('.mvp-export-cancel').textContent, 'Dismiss');
    details.click();
    assert.equal(status.textContent, 'Done');
});

test('active export protects a clean page from unload without opening the unsaved-edits dialog', () => {
    const { UnsavedChangesGuard } = createLoader()('ui/mvp/UnsavedChangesGuard.ts');
    const host = new EventTarget();
    host.setTimeout = () => assert.fail('Export alone should not schedule an edits dialog');
    let active = true;
    const guard = new UnsavedChangesGuard(host, {
        hasChanges: () => false,
        hasActiveExport: () => active,
        confirm: () => assert.fail('Export alone has no unsaved edits')
    });
    guard.sync();
    assert.equal(host.dispatchEvent(new Event('beforeunload', { cancelable: true })), false);
    active = false;
    guard.sync();
    assert.equal(host.dispatchEvent(new Event('beforeunload', { cancelable: true })), true);
});

test('MVP reserves one job, ignores stale progress and releases the workspace on success and failure', async () => {
    const exports = {};
    class Element { inert = false; }
    const source = ts.transpileModule(readFileSync('src/ui/mvp/MvpUI.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    vm.runInNewContext(source, { exports, require: () => ({}), HTMLElement: Element, Error });
    const ui = Object.create(exports.MvpUI.prototype);
    const workspace = new Element(), existingLock = new Element(), panel = new Element();
    existingLock.inert = true;
    const jobs = [], downloads = [], updates = [], statuses = [], guard = [];
    Object.assign(ui, {
        root: { children: [workspace, panel, existingLock] },
        exportDialog: { root: panel, setActive() {}, setStatus: status => statuses.push(status), setProgress: p => updates.push(p) },
        controller: { startExport: (_config, progress) => new Promise((resolve, reject) => jobs.push({ progress, resolve, reject })) },
        unsavedChangesGuard: { sync: () => guard.push(Boolean(ui.exportJob)) },
        downloadBlob: blob => downloads.push(blob)
    });
    const first = ui.runExport({});
    await ui.runExport({});
    assert.equal(jobs.length, 1);
    assert.equal(workspace.inert, true);
    assert.equal(panel.inert, false);
    const blob = new Blob(['video']);
    jobs[0].resolve(blob);
    await first;
    assert.deepEqual(downloads, [blob]);
    assert.equal(workspace.inert, false);
    assert.equal(existingLock.inert, true);
    const second = ui.runExport({});
    jobs[0].progress(.9);
    jobs[1].progress(.2);
    jobs[1].reject(new Error('Export cancelled.'));
    await second;
    assert.deepEqual(updates, [.2]);
    assert.equal(statuses.at(-1), 'Export cancelled.');
    assert.deepEqual(downloads, [blob]);
    assert.deepEqual(guard, [true, false, true, false]);
    assert.equal(workspace.inert, false);
});
