import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './helpers/xr-loader.mjs';

function harness(pointerType = 'mouse') {
    const window = new EventTarget(), canvas = new EventTarget();
    canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 800, height: 600 });
    let captured = null;
    canvas.setPointerCapture = id => { captured = id; };
    canvas.hasPointerCapture = id => captured === id;
    canvas.releasePointerCapture = () => { captured = null; };
    const { DesktopInputAdapter } = createLoader({ three: THREE }, { window })('xr/DesktopInputAdapter.ts');
    const input = new DesktopInputAdapter(canvas);
    const looks = [], clicks = [];
    input.onLook = (...args) => looks.push(args);
    input.onStrike = (...args) => clicks.push(args);
    const send = (type, x = 410, y = 320, overrides = {}) => {
        const event = new Event(type, { cancelable: true });
        Object.assign(event, { clientX: x, clientY: y, button: 0, pointerId: 1, isPrimary: true, pointerType, ...overrides });
        canvas.dispatchEvent(event);
        return event;
    };
    return { input, send, looks, clicks, window, captured: () => captured };
}

for (const pointerType of ['mouse', 'touch', 'pen']) {
    test(`${pointerType}: a tap activates once; a captured drag rotates without a strike`, () => {
        const h = harness(pointerType);
        h.send('pointerdown'); assert.equal(h.clicks.length, 0); assert.equal(h.captured(), 1);
        h.send('pointerup'); assert.equal(h.clicks.length, 1); assert.equal(h.clicks[0][0], 'left');
        assert.equal(h.captured(), null);
        h.send('pointerdown'); h.send('pointermove', 470, 350); h.send('pointerup', 530, 380);
        assert.equal(h.looks.length, 2);
        assert.deepEqual(h.looks[0], [0.1, 0.05]);
        assert.equal(h.clicks.length, 1, 'dragging never activates a note or menu item');
        h.input.dispose();
    });
}

test('movement tolerance, coalesced release and secondary pointers preserve gesture ownership', () => {
    const h = harness('touch');
    h.send('pointerdown'); h.send('pointermove', 413, 321); h.send('pointerup', 413, 321);
    assert.equal(h.looks.length, 0); assert.equal(h.clicks.length, 1, 'small tap jitter is accepted');
    h.send('pointerdown');
    h.send('pointerdown', 600, 400, { pointerId: 2, isPrimary: false });
    h.send('pointermove', 700, 500, { pointerId: 2, isPrimary: false });
    h.send('pointerup', 700, 500, { pointerId: 2, isPrimary: false });
    assert.equal(h.looks.length, 0); assert.equal(h.captured(), 1);
    h.send('pointerup', 470, 320);
    assert.equal(h.looks.length, 1); assert.equal(h.clicks.length, 1, 'large coalesced release counts as drag');
    h.input.dispose();
});

test('menus and immersive sessions can gate looking; cancellation, blur and disposal never activate', () => {
    const h = harness();
    h.input.canLook = () => false;
    h.send('pointerdown'); h.send('pointermove', 500, 400); h.send('pointerup', 500, 400);
    assert.equal(h.looks.length, 0); assert.equal(h.clicks.length, 0);
    h.send('pointerdown'); h.send('pointerup'); assert.equal(h.clicks.length, 1, 'a menu tap still works');
    for (const cancel of ['pointercancel', 'lostpointercapture', 'blur']) {
        h.send('pointerdown');
        if (cancel === 'blur') h.window.dispatchEvent(new Event('blur')); else h.send(cancel);
        h.send('pointerup'); assert.equal(h.clicks.length, 1, cancel); assert.equal(h.captured(), null);
    }
    h.send('pointerdown'); h.input.dispose();
    h.send('pointerup'); h.send('pointerdown'); h.send('pointermove', 500, 400);
    assert.equal(h.clicks.length, 1); assert.equal(h.looks.length, 0); assert.equal(h.captured(), null);
});

test('a successful gameplay press keeps press timing and owns the entire pointer gesture', () => {
    const h = harness('touch'), presses = [];
    h.input.onGameplayPress = (x, y) => { presses.push([x, y]); return true; };
    h.send('pointerdown');
    assert.deepEqual(presses, [[0, 0]], 'the game judges at contact, before a hold or drag');
    h.send('pointermove', 500, 400); h.send('pointerup', 560, 420);
    assert.equal(h.looks.length, 0, 'a scored contact cannot also rotate the camera');
    assert.equal(h.clicks.length, 0, 'release cannot create a second strike');
    h.input.dispose();
});

test('an empty gameplay press may look, but cannot retry a newly arriving target on release', () => {
    const h = harness(), presses = [];
    h.input.onGameplayPress = () => { presses.push('miss'); return false; };
    h.send('pointerdown'); h.send('pointerup');
    assert.equal(presses.length, 1); assert.equal(h.clicks.length, 0);
    h.send('pointerdown'); h.send('pointermove', 500, 400); h.send('pointerup', 500, 400);
    assert.equal(presses.length, 2); assert.equal(h.clicks.length, 0); assert.equal(h.looks.length, 2);
    h.send('pointerdown', 410, 320, { button: 2 });
    assert.equal(h.clicks[0][0], 'right', 'right-hand input also retains its immediate press timing');
    h.input.dispose();
});
