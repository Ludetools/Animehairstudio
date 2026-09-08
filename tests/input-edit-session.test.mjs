import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createInputEditSession } from '../modules/input-edit-session.js';
import { BoundedHistory } from '../modules/history.js';

test('control edit groups mutations, cancellation restores prior values and both history stacks', () => {
  const undo = new BoundedHistory(2), redo = new BoundedHistory(2);
  undo.push('a'); undo.push('b'); redo.push('future');
  let state = [0.2, 0.5];
  const session = createInputEditSession({
    capture() {
      const saved = { state: [...state], undo: undo.checkpoint(), redo: redo.checkpoint() };
      undo.push(saved.state); redo.clear(); return saved;
    },
    restore(saved) {
      state = saved.state; undo.restoreCheckpoint(saved.undo); redo.restoreCheckpoint(saved.redo);
    }
  });
  session.begin('width'); state = [0.3, 0.6];
  session.begin('width'); state = [0.4, 0.7];
  assert.deepEqual(undo.checkpoint(), ['b', [0.2, 0.5]]);
  assert.equal(session.cancel(), 'width');
  assert.deepEqual(state, [0.2, 0.5]);
  assert.deepEqual(undo.checkpoint(), ['a', 'b']);
  assert.deepEqual(redo.checkpoint(), ['future']);
  assert.equal(session.cancel(), null);
  session.begin('width'); state = [0.3, 0.6]; session.finish('width');
  assert.equal(session.cancel(), null);
  assert.deepEqual(undo.pop(), [0.2, 0.5]);
});

test('control edit changing owners or an external action finishes the previous edit', () => {
  const captured = [], restored = [];
  const session = createInputEditSession({capture: () => { captured.push(1); return captured.length; }, restore: s => restored.push(s)});
  session.begin('width'); session.begin('depth'); session.finish('width'); session.cancel();
  assert.deepEqual(restored, [2]);
  session.begin('width'); session.finish(); assert.equal(session.cancel(), null);
});

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
test('production undo binding ignores click and navigation, captures before input, commits change and blur', () => {
  const listeners = new Map(), calls = [];
  const input = {addEventListener(type, fn, capture) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push({fn, capture});
  }};
  const context = {cancelledInputDrag: null, inputEditSession: {begin: () => calls.push('begin'), finish: () => calls.push('finish')}};
  vm.runInNewContext(source.match(/function bindUndoCapture\([^]*?\n\}/)[0], context);
  context.bindUndoCapture(input);
  assert.equal(listeners.has('pointerdown'), false);
  assert.equal(listeners.has('keydown'), false);
  assert.equal(listeners.get('input')[0].capture, true);
  listeners.get('input')[0].fn({});
  listeners.get('change').forEach(({fn}) => fn({}));
  listeners.get('blur')[0].fn({});
  assert.deepEqual(calls, ['begin', 'begin', 'finish', 'finish']);
  context.cancelledInputDrag = input;
  const blocked = [];
  listeners.get('input')[0].fn({preventDefault: () => blocked.push('prevent'), stopImmediatePropagation: () => blocked.push('stop')});
  assert.deepEqual(blocked, ['prevent', 'stop']);
  assert.equal(calls.length, 4);
});

test('generated numeric controls expose mixed values and forward edit completion', () => {
  assert.match(source, /numberInput\.value = mixed \? '' : range\.value/);
  assert.match(source, /numberInput\.placeholder = mixed \? 'Mixed' : ''/);
  assert.match(source, /numberInput.addEventListener\("change", \(\) => range.dispatchEvent\(new Event\("change"/);
  assert.match(source, /Mixed values\. Changes apply the same delta/);
});
