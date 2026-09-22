import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { clampMorphScale, computeMaxMorphScale } from '../src/automation/morphScale.ts';

class Element extends EventTarget {
    nodes = new Map();
    attributes = new Map();
    classList = { toggle() {} };
    min = '0.25'; max = '4'; value = '1'; disabled = false;
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name); }
    querySelector(selector) {
        if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
        return this.nodes.get(selector);
    }
}

function harness(maximum) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync('src/ui/mvp/TimelineToolbar.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText, { exports, document: { createElement: () => new Element() } });
    let scale = 0.25;
    const edits = [];
    const toolbar = new exports.TimelineToolbar({ onMorphScaleChange(value) {
        scale = Math.max(0.25, Math.min(maximum, value));
        edits.push(scale);
        toolbar.setMorphScale(scale, maximum); // Same synchronous refresh as MvpUI.
    } });
    toolbar.setMorphScale(scale, maximum);
    return { toolbar, edits, slider: toolbar.root.querySelector('.mvp-toolbar-morph-slider'),
        output: toolbar.root.querySelector('.mvp-toolbar-morph-value') };
}

test('MVP morph slider ends at the plan limit even below 100%, without a dead upper range', () => {
    const h = harness(0.495);
    assert.equal(Number(h.slider.max), 0.495);
    h.slider.value = h.slider.max;
    h.slider.dispatchEvent(new Event('input'));
    assert.equal(Number(h.slider.value), 0.495);
    assert.equal(h.edits[0], 0.495);
    assert.equal(h.output.textContent, '49.5%');
    assert.equal(h.slider.getAttribute('aria-valuetext'), '49.5%');
    assert.match(h.slider.title, /49\.5%/);
});

test('MVP morph slider follows narrower and wider plans and disables an exhausted range', () => {
    const h = harness(4);
    h.toolbar.setMorphScale(4, 4);
    assert.equal(Number(h.slider.max), 4);
    h.toolbar.setMorphScale(0.495, 0.495);
    assert.equal(Number(h.slider.max), 0.495);
    assert.equal(h.slider.disabled, false);
    h.toolbar.setMorphScale(0.25, 0.25);
    assert.equal(Number(h.slider.min), Number(h.slider.max));
    assert.equal(h.slider.disabled, true);
    h.toolbar.setMorphScale(1, 4);
    assert.equal(h.slider.disabled, false);
    assert.equal(h.output.textContent, '100%');
});

test('MVP exact fractional endpoint agrees with the non-destructive plan clamp', () => {
    const plan = { version: 1, source: 'edited', points: [
        { id: 'a', time: 0, morphDurationSec: 2 },
        { id: 'b', time: 1.01, morphDurationSec: 1 }
    ] };
    const original = structuredClone(plan);
    const max = computeMaxMorphScale(plan);
    const h = harness(max);
    h.toolbar.setMorphScale(clampMorphScale(plan, 4), max);
    assert.equal(Number(h.slider.max), max);
    assert.equal(Number(h.slider.value), max);
    assert.deepEqual(plan, original);
    // Native range must accept an exact endpoint between hundredths, including keyboard End.
    assert.match(readFileSync('src/ui/mvp/TimelineToolbar.ts', 'utf8'), /class="mvp-slider mvp-toolbar-morph-slider"[^>]*step="any"/);
});

test('MVP native range publishes the full current-plan limit above 400 percent', () => {
    const plan = { points: [{ id: 'a', time: 0, morphDurationSec: 1 },
        { id: 'b', time: 20, morphDurationSec: 4 }, { id: 'c', time: 100, morphDurationSec: 2 }] };
    const maximum = computeMaxMorphScale(plan, { durationSec: 180 });
    const h = harness(maximum);
    h.slider.value = h.slider.max;
    h.slider.dispatchEvent(new Event('input'));
    assert.equal(Number(h.slider.value), 19.98);
    assert.equal(h.edits[0], 19.98);
    assert.equal(h.output.textContent, '1998%');
});
