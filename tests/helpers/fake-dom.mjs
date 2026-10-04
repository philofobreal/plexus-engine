// Minimal DOM double for XR chrome/controller tests: elements with children, attributes, dataset,
// events, focus and containment, plus 2D canvas contexts that record calls. No layout or styles.

/** 2D context double; measureText scales with the current font size so layout fallbacks can be tested. */
export function fakeContext2d() {
    const ctx = {
        calls: [], font: '10px sans-serif', fillStyle: '', textAlign: 'left', textBaseline: 'top', globalAlpha: 1,
        clearRect(...args) { this.calls.push(['clearRect', ...args]); },
        fillRect(...args) { this.calls.push(['fillRect', ...args]); },
        fillText(text, x, y) { this.calls.push(['fillText', text, x, y, this.font]); },
        measureText(text) { const size = Number(/(\d+)px/.exec(this.font)?.[1] ?? 10); return { width: String(text).length * size * 0.6 }; }
    };
    // Path and transform calls are recorded by name only (no geometry is simulated).
    for (const name of ['save', 'restore', 'translate', 'rotate', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke']) {
        ctx[name] = (...args) => { ctx.calls.push([name, ...args]); };
    }
    return ctx;
}

export function fakeDocument() {
    const doc = new EventTarget();
    class FakeElement extends EventTarget {
        constructor(tag) {
            super();
            this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this.attributes = {};
            this.dataset = {}; this.style = {}; this.hidden = false; this.inert = false; this.textContent = '';
            this.disabled = false; this.checked = false; this.value = ''; this.files = null;
            if (this.tagName === 'CANVAS') { this.width = 300; this.height = 150; this.context = fakeContext2d(); }
        }
        get parentElement() { return this.parent; }
        getContext() { return this.context ?? null; }
        setAttribute(name, value) { this.attributes[name] = String(value); }
        getAttribute(name) { return this.attributes[name] ?? null; }
        append(...nodes) { for (const node of nodes) { if (node && typeof node === 'object') node.parent = this; this.children.push(node); } }
        appendChild(node) { this.append(node); return node; }
        contains(node) { for (let n = node; n; n = n.parent) if (n === this) return true; return false; }
        focus() { doc.activeElement = this; }
        blur() { if (doc.activeElement === this) doc.activeElement = null; }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
        click() { this.dispatchEvent(new Event('click')); }
        closest() { return null; }
        getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
    }
    doc.activeElement = null;
    doc.hidden = false;
    doc.createElement = tag => new FakeElement(tag);
    doc.createTextNode = text => ({ textContent: text, parent: null });
    doc.body = doc.createElement('body');
    return doc;
}

/** Depth-first search over fake element children. */
export function findAll(root, predicate, out = []) {
    for (const child of root.children ?? []) {
        if (child && typeof child === 'object') {
            if (predicate(child)) out.push(child);
            findAll(child, predicate, out);
        }
    }
    return out;
}
