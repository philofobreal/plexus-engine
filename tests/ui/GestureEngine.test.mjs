import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureEngine } from '../../src/ui/GestureEngine.ts';

function createMockElement() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    getBoundingClientRect() {
      return { left: 10, right: 210, width: 200, top: 20, bottom: 120, height: 100 };
    }
  };
}

test('GestureEngine normalizes drag start, movement, hover, and cleanup', () => {
  const element = createMockElement();
  const starts = [];
  const moves = [];
  const hovers = [];
  let ended = false;
  const engine = new GestureEngine(element, {
    onStart: (focusX, focusY, button, shiftKey) => {
      starts.push({ focusX, focusY, button, shiftKey });
      return true;
    },
    onMove: (focusX, focusY, deltaX, deltaY) => moves.push({ focusX, focusY, deltaX, deltaY }),
    onHover: (focusX, focusY) => hovers.push({ focusX, focusY }),
    onEnd: () => {
      ended = true;
    }
  });

  element.listeners.get('mousemove')({ clientX: 60, clientY: 70, preventDefault() {} });
  element.listeners.get('mousedown')({ button: 0, shiftKey: false, clientX: 10, clientY: 20, preventDefault() {} });
  element.listeners.get('mousemove')({ clientX: 110, clientY: 70, preventDefault() {} });
  element.listeners.get('mouseup')({});

  assert.deepEqual(hovers, [{ focusX: 0.25, focusY: 0.5 }]);
  assert.deepEqual(starts, [{ focusX: 0, focusY: 0, button: 0, shiftKey: false }]);
  assert.deepEqual(moves, [{ focusX: 0.5, focusY: 0.5, deltaX: 0.5, deltaY: 0.5 }]);
  assert.equal(ended, true);
  engine.destroy();
  assert.equal(element.listeners.size, 0);
});

test('GestureEngine emits semantic wheel zoom and double-click callbacks', () => {
  const element = createMockElement();
  const zoomEvents = [];
  const doubleClicks = [];
  new GestureEngine(element, {
    onZoom: (delta, focusX) => zoomEvents.push({ delta, focusX }),
    onDoubleClick: (focusX, focusY) => doubleClicks.push({ focusX, focusY })
  });

  element.listeners.get('wheel')({ deltaY: -1, clientX: 60, preventDefault() {} });
  element.listeners.get('dblclick')({ clientX: 210, clientY: 120 });

  assert.deepEqual(zoomEvents, [{ delta: 1, focusX: 0.25 }]);
  assert.deepEqual(doubleClicks, [{ focusX: 1, focusY: 1 }]);
});
