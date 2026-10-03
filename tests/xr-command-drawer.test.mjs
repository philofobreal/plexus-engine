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
    assert.equal(drawer.menuButton.getAttribute('aria-label'), 'Open track panel, no track loaded');
    drawer.menuButton.click(); assert.equal(drawer.isOpen, true);
    // The track panel holds only the file picker, the transport, Enter VR and their status lines.
    for (const control of [drawer.fileInput, drawer.progressEl, drawer.errorEl, drawer.trackInfoEl, drawer.trackTitleEl,
        drawer.capabilityEl, drawer.enterVrButton, drawer.previewButton]) assert.ok(drawer.panel.contains(control));
    assert.equal(findAll(drawer.panel, n => n.type === 'radio' || n.type === 'range' || n.type === 'checkbox').length, 0,
        'no settings in HTML: they live in the canvas game menu');
    assert.equal(drawer.fileInput.type, 'file'); assert.equal(drawer.panel.className.includes('xr-launch-overlay'), true);
    drawer.dispose();
});

test('the game menu button asks the host for the canvas menu and reflects its state', () => {
    const doc = fakeDocument(), drawer = new XrCommandDrawer(doc);
    let asked = 0; drawer.onGameMenu = () => asked++;
    drawer.gameMenuButton.blur = () => {};
    drawer.gameMenuButton.click();
    assert.equal(asked, 1);
    assert.equal(drawer.gameMenuButton.getAttribute('aria-keyshortcuts'), 'Escape');
    drawer.setGameMenuOpen(true); assert.equal(drawer.gameMenuButton.getAttribute('aria-expanded'), 'true');
    assert.ok(drawer.root.children.includes(drawer.gameMenuButton) && !drawer.panel.contains(drawer.gameMenuButton), 'always reachable');
    drawer.dispose();
});

test('Escape closes an open drawer and returns focus from inside it to the menu button', () => {
    const doc = fakeDocument(), drawer = new XrCommandDrawer(doc);
    drawer.previewButton.focus();
    const event = escape(); doc.dispatchEvent(event);
    assert.equal(drawer.isOpen, false); assert.ok(event.defaultPrevented);
    assert.equal(doc.activeElement, drawer.menuButton);
    const ignored = escape(); doc.dispatchEvent(ignored); assert.equal(ignored.defaultPrevented, false);
    // Escape with focus outside the panel belongs to the game menu (the panel stays as it is).
    drawer.open(); doc.activeElement = null; const outside = escape(); doc.dispatchEvent(outside);
    assert.equal(drawer.isOpen, true); assert.equal(outside.defaultPrevented, false);
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
    assert.equal(drawer.menuButton.getAttribute('aria-label'), 'Close track panel, analyzing', 'the status light is announced');
    assert.equal(drawer.menuButton.title, 'analyzing');
    drawer.dispose(); assert.equal(host.children.length, 0);
    doc.dispatchEvent(escape()); assert.equal(drawer.isOpen, true);
});
