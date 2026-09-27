import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoader } from './helpers/xr-loader.mjs';
import { findAll } from './helpers/fake-dom.mjs';

function fakeDocument() {
    const doc = new EventTarget();
    class FakeElement extends EventTarget {
        constructor(tag) { super(); this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this.attributes = {};
            this.dataset = {}; this.style = {}; this.hidden = false; this.inert = false; this.textContent = ''; }
        setAttribute(name, value) { this.attributes[name] = String(value); }
        getAttribute(name) { return this.attributes[name] ?? null; }
        append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
        contains(node) { for (let n = node; n; n = n.parent) if (n === this) return true; return false; }
        focus() { doc.activeElement = this; }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
        click() { this.dispatchEvent(new Event('click')); }
    }
    doc.activeElement = null;
    doc.createElement = tag => new FakeElement(tag);
    doc.createTextNode = text => ({ textContent: text, parent: null });
    return doc;
}
const escape = () => Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' });
const { XrCommandDrawer } = createLoader()('xr/XrCommandDrawer.ts');

test('drawer starts open, toggles via the menu button and mirrors aria/inert state', () => {
    const doc = fakeDocument(), drawer = new XrCommandDrawer(doc);
    assert.equal(drawer.isOpen, true);
    assert.equal(drawer.menuButton.getAttribute('aria-expanded'), 'true');
    assert.equal(drawer.menuButton.getAttribute('aria-controls'), drawer.panel.id);
    assert.equal(drawer.panel.inert, false);
    drawer.menuButton.click();
    assert.equal(drawer.isOpen, false); assert.equal(drawer.panel.inert, true);
    assert.equal(drawer.panel.dataset.open, 'false'); assert.equal(drawer.menuButton.getAttribute('aria-expanded'), 'false');
    assert.equal(drawer.menuButton.getAttribute('aria-label'), 'Open command menu, no track loaded');
    drawer.menuButton.click(); assert.equal(drawer.isOpen, true);
    // Existing launch controls are preserved inside the drawer panel.
    for (const control of [drawer.fileInput, drawer.progressEl, drawer.errorEl, drawer.trackInfoEl, drawer.trackTitleEl,
        drawer.capabilityEl, drawer.enterVrButton, drawer.previewButton, drawer.wormholeToggle]) assert.ok(drawer.panel.contains(control));
    assert.equal(drawer.fileInput.type, 'file'); assert.equal(drawer.panel.className.includes('xr-launch-overlay'), true);
    drawer.dispose();
});

test('Escape closes an open drawer and returns focus from inside it to the menu button', () => {
    const doc = fakeDocument(), drawer = new XrCommandDrawer(doc);
    drawer.previewButton.focus();
    const event = escape(); doc.dispatchEvent(event);
    assert.equal(drawer.isOpen, false); assert.ok(event.defaultPrevented);
    assert.equal(doc.activeElement, drawer.menuButton);
    const ignored = escape(); doc.dispatchEvent(ignored); assert.equal(ignored.defaultPrevented, false);
    // Closing without focus inside the panel leaves focus where it is.
    drawer.open(); doc.activeElement = null; drawer.close(); assert.equal(doc.activeElement, null);
    drawer.dispose();
});

test('hidden chrome ignores Escape, keeps drawer state, reports status and removes listeners on dispose', () => {
    const doc = fakeDocument(), drawer = new XrCommandDrawer(doc);
    const host = doc.createElement('div'); host.append(drawer.root);
    drawer.setVisible(false); doc.dispatchEvent(escape());
    assert.equal(drawer.isOpen, true); assert.equal(drawer.root.hidden, true);
    drawer.setVisible(true); assert.equal(drawer.root.hidden, false);
    drawer.setStatus('busy'); assert.equal(drawer.menuButton.dataset.status, 'busy');
    assert.equal(drawer.menuButton.getAttribute('aria-label'), 'Close command menu, analyzing', 'the status light is announced');
    assert.equal(drawer.menuButton.title, 'analyzing');
    drawer.dispose(); assert.equal(host.children.length, 0);
    doc.dispatchEvent(escape()); assert.equal(drawer.isOpen, true);
});

test('game settings expose Activity, Variation, Hands and Lead as radio groups that report changes', () => {
    const doc = fakeDocument(), drawer = new XrCommandDrawer(doc);
    const radios = [];
    const walk = node => { for (const child of node.children ?? []) { if (child.type === 'radio') radios.push(child); walk(child); } };
    walk(drawer.generationFieldset);
    const groups = [...new Set(radios.map(r => r.name))];
    assert.equal(JSON.stringify(groups), JSON.stringify(['xr-generation-difficulty', 'xr-generation-activity', 'xr-generation-variation',
        'xr-generation-handPattern', 'xr-generation-handLead', 'xr-generation-zones']));
    assert.equal(radios.length, 4 + 3 + 3 + 4 + 3 + 3);
    const groupsWithHints = findAll(drawer.generationFieldset, n => n.className === 'xr-segment');
    for (const group of groupsWithHints) {
        const hint = findAll(group, n => n.id === group.getAttribute('aria-describedby'));
        assert.equal(hint.length, 1, 'each group is described by its hint');
        assert.ok(hint[0].textContent.length > 0);
    }
    assert.ok(drawer.panel.contains(drawer.generationFieldset));
    const checked = () => radios.filter(r => r.checked).map(r => r.value).join();
    assert.equal(checked(), 'normal,balanced,paired,alternate,even,split');
    const reports = [];
    drawer.onGenerationChange = settings => reports.push({ ...settings });
    const pick = value => { const radio = radios.find(r => r.value === value); radio.checked = true; radio.dispatchEvent(new Event('change')); };
    pick('active'); pick('call-response'); pick('left'); pick('expert'); pick('cross');
    assert.equal(reports.length, 5);
    assert.equal(JSON.stringify(reports.at(-1)), JSON.stringify({ difficulty: 'expert', activity: 'active', variation: 'paired',
        handPattern: 'call-response', handLead: 'left', zones: 'cross' }));
    assert.equal(checked(), 'expert,active,paired,call-response,left,cross');
    // Programmatic updates reflect state without reporting a change.
    drawer.setGenerationSettings({ variation: 'expressive' });
    assert.equal(reports.length, 5); assert.equal(checked(), 'normal,balanced,expressive,alternate,even,split');
    drawer.dispose();
});
