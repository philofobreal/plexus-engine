import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(name, globals = {}, fullModule = false) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync(`src/ui/mvp/${name}.ts`, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText, { exports, ...globals });
    return fullModule ? exports : exports[name];
}
const EditHistory = load('EditHistory');
const snapshot = value => ({ key: String(value), data: JSON.stringify(value) });
const record = (h, domain, from, to, label = String(to)) => h.record(domain, snapshot(from), snapshot(to), label);

test('scope filters independent domains, keeps both histories and is never a command', () => {
    const h = new EditHistory();
    record(h, 'journey', 0, 1); record(h, 'tuning', 0, 10); record(h, 'journey', 1, 2);
    assert.equal(h.getStatus().undoCount, 2);
    assert.equal(h.undo().after.key, '2');
    h.setScope('all'); assert.equal(h.getStatus().undoCount, 2);
    assert.equal(h.undo().domain, 'tuning');
    h.setScope('journey'); assert.equal(h.getStatus().redoCount, 1);
    assert.equal(h.redo().after.key, '2');
    h.setScope('all'); assert.equal(h.getStatus().redoCount, 1);
    assert.equal(h.redo().after.key, '10');
    assert.equal(h.undo().domain, 'tuning', 'undo reverses the last applied redo');
    assert.equal(h.undo().after.key, '2');
    assert.equal(h.undo().after.key, '1');
    assert.equal(h.undo(), null);
});

test('a new edit invalidates redo even when hidden by scope; no-ops do not', () => {
    const h = new EditHistory(); h.setScope('all');
    record(h, 'tuning', 0, 1); h.undo(); h.setScope('journey');
    record(h, 'journey', 0, 0); h.setScope('all');
    assert.equal(h.getStatus().redoCount, 1);
    h.setScope('journey'); record(h, 'journey', 0, 2); h.setScope('all');
    assert.equal(h.redo(), null);
});

test('a gesture is one command, separate gestures are distinct and a round trip is no command', () => {
    const h = new EditHistory(); h.beginGroup();
    for (let i = 0; i < 80; i++) record(h, 'journey', i, i + 1);
    assert.equal(h.getStatus().undoCount, 1);
    const entry = h.undo(); assert.equal(entry.before.key, '0'); assert.equal(entry.after.key, '80');
    h.redo(); h.beginGroup(); record(h, 'journey', 80, 81); h.endGroup();
    assert.equal(h.getStatus().undoCount, 2);
    h.beginGroup(); record(h, 'journey', 81, 90); record(h, 'journey', 90, 81); h.endGroup();
    assert.equal(h.getStatus().undoCount, 2);
});

test('300 retained edits have a bounded oldest edge and support all 300 redo operations', () => {
    const h = new EditHistory();
    for (let i = 0; i < 350; i++) record(h, 'journey', i, i + 1);
    assert.equal(h.getStatus().undoCount, 300);
    let last;
    for (let i = 0; i < 300; i++) last = h.undo();
    assert.equal(last.before.key, '50'); assert.equal(h.undo(), null);
    for (let i = 0; i < 300; i++) last = h.redo();
    assert.equal(last.after.key, '350'); assert.equal(h.redo(), null);
    h.setScope('all'); h.clear();
    assert.equal(h.getStatus().scope, 'all');
    assert.equal(h.getStatus().undoCount, 0); assert.equal(h.getStatus().redoCount, 0);
});

test('alternating scopes and branches never violate domain snapshot continuity', () => {
    const h = new EditHistory();
    const state = { journey: 0, tuning: 0 };
    let seed = 1234;
    const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0);
    for (let i = 0; i < 4000; i++) {
        const choice = random() % 7;
        if (choice < 3) {
            const domain = random() % 2 ? 'journey' : 'tuning';
            record(h, domain, state[domain], i + 1); state[domain] = i + 1;
        } else if (choice < 5) {
            const redo = choice === 4, entry = redo ? h.redo() : h.undo();
            if (entry) {
                assert.equal(String(state[entry.domain]), (redo ? entry.before : entry.after).key);
                state[entry.domain] = Number((redo ? entry.after : entry.before).key);
            }
        } else h.setScope(choice === 5 ? 'journey' : 'all');
    }
});

function inputHarness() {
    const listeners = new Map(), calls = [];
    let blocked = false;
    const host = {
        addEventListener(name, fn, capture) { listeners.set(name, { fn, capture }); },
        removeEventListener(name) { listeners.delete(name); }
    };
    const Input = load('HistoryInput');
    const input = new Input(host, { undo: () => calls.push('undo'), redo: () => calls.push('redo'),
        beginGesture: () => calls.push('begin'), endGesture: () => calls.push('end'), blocked: () => blocked });
    function send(name, props = {}) {
        const event = { key: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, repeat: false,
            isComposing: false, prevented: false, stopped: false, ...props,
            preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; },
            stopImmediatePropagation() { this.stopped = true; } };
        listeners.get(name)?.fn(event); return event;
    }
    return { input, listeners, calls, send, block(value) { blocked = value; } };
}

test('Ctrl/Cmd shortcuts capture regardless of canvas, text, select, range or contenteditable target', () => {
    const h = inputHarness(); assert.equal(h.listeners.get('keydown').capture, true);
    for (const target of [{tagName:'CANVAS'}, {tagName:'INPUT',type:'text'}, {tagName:'TEXTAREA'},
        {tagName:'SELECT'}, {tagName:'INPUT',type:'range'}, {tagName:'DIV',isContentEditable:true}, null]) {
        for (const props of [{ctrlKey:true,key:'z'}, {metaKey:true,key:'z'}, {ctrlKey:true,shiftKey:true,key:'Z'},
            {metaKey:true,shiftKey:true,key:'Z'}, {ctrlKey:true,key:'y'}]) {
            const event = h.send('keydown', { ...props, target });
            assert.equal(event.prevented, true); assert.equal(event.stopped, true);
            assert.equal(h.calls.at(-1), props.shiftKey || props.key === 'y' ? 'redo' : 'undo');
        }
    }
});

test('modal/busy state blocks history, repeats do not drain it, and IME/Alt/unmodified keys stay native', () => {
    const h = inputHarness(); h.block(true);
    assert.equal(h.send('keydown', {ctrlKey:true,key:'z'}).prevented, true);
    assert.ok(!h.calls.includes('undo'));
    h.block(false); h.send('keydown', {ctrlKey:true,key:'z',repeat:true});
    for (const extra of [{isComposing:true}, {keyCode:229}, {altKey:true}, {ctrlKey:false}]) {
        assert.equal(h.send('keydown', {ctrlKey:true,key:'z',...extra}).prevented, false);
    }
    assert.ok(!h.calls.includes('undo'));
});

test('pointer/key gestures group across repeats and outside releases, without swallowing native range adjustment', () => {
    const h = inputHarness(), range = {tagName:'INPUT',type:'range'}, old = {tagName:'INPUT',type:'text'};
    h.send('pointerdown', {target:range}); h.send('focusout', {target:old});
    assert.equal(h.calls.at(-1), 'begin', 'old focusout must not end the newly pressed slider');
    h.send('pointerup', {target:null}); assert.equal(h.calls.at(-1), 'end');
    const count = h.calls.filter(x=>x==='begin').length;
    for(let i=0;i<5;i++) {
        const event = h.send('keydown', {target:range,key:'ArrowRight',repeat:i>0});
        assert.equal(event.prevented, false); assert.equal(event.stopped, true);
    }
    assert.equal(h.calls.filter(x=>x==='begin').length, count+1);
    h.send('keyup', {key:'ArrowRight'}); assert.equal(h.calls.at(-1), 'end');
    h.send('pointerdown', {target:range}); h.send('pointercancel'); assert.equal(h.calls.at(-1), 'end');
    h.input.dispose(); assert.equal(h.listeners.size, 0);
});

test('focused moment time commits only a genuine draft, never the rounded display of an untouched time', () => {
    class Element extends EventTarget {
        children = new Map(); value = ''; classList = {add(){},remove(){},toggle(){}};
        querySelector(key) { if(!this.children.has(key)) this.children.set(key, new Element()); return this.children.get(key); }
        querySelectorAll() { return []; }
    }
    const document = {activeElement:null, createElement:()=>new Element()}, changes = [];
    const format = load('mvpFormat', {}, true);
    const Inspector = load('MomentInspector', {document, Event, require:()=>format});
    const inspector = new Inspector({onTimeChange:(id,time)=>changes.push({id,time})});
    const point = {id:'p',time:12.4567,preset:'default.json',intensity:1,morphDurationSec:2,reason:'manual'};
    inspector.show(point, ['default.json']);
    const input = inspector.root.querySelector('.mvp-moment-time'); document.activeElement = input;
    inspector.commitPendingTime(); assert.equal(changes.length, 0, '12.5 display must not become a time edit');
    input.value = '0:14.0'; inspector.commitPendingTime();
    assert.deepEqual(changes, [{id:'p',time:14}]);
    input.value = 'invalid'; inspector.commitPendingTime();
    assert.equal(input.value, format.formatTimeTenths(point.time)); assert.equal(changes.length, 1);
});
