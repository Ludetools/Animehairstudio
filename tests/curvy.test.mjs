import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { mountCurvy } from '../modules/curvy.js';
function fixture() {
  const nodes = new Map();
  const root = { addEventListener() {}, querySelector(key) {
    if (!nodes.has(key)) nodes.set(key, { hidden: false, handlers: {}, addEventListener(e, fn) { this.handlers[e] = fn; }, setAttribute(k,v) { this[k] = v; }, focus() {} });
    return nodes.get(key);
  } };
  return { root, nodes, curvy: mountCurvy(root) };
}
test('Curvy is opt-in and retains dismissed tips across tool changes', () => {
  const { root, nodes, curvy } = fixture();
  assert.equal(root.hidden, true);
  assert.equal(curvy.enabled, false);
  curvy.update('draw', 'Draw');
  assert.equal(nodes.get('[data-curvy-tip]').textContent, undefined);
  curvy.setEnabled(true);
  curvy.update('draw', 'Draw');
  assert.match(nodes.get('[data-curvy-tip]').textContent, /stroke/);
  nodes.get('[data-curvy-close]').handlers.click();
  curvy.update('loop-cut', 'Loop Cut');
  assert.equal(nodes.get('[data-curvy-bubble]').hidden, true);
  assert.match(nodes.get('[data-curvy-tip]').textContent, /Shift/);
  curvy.setEnabled(false);
  assert.equal(root.hidden, true);
});
test('Curvy preference previews, cancels and persists through its setter', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const { curvy } = fixture();
  const input = {}, writes = [];
  const context = { curvy, CURVY_PREFERENCE_KEY: 'curvy', document: { querySelector: () => input }, saveBooleanPreference: (...args) => writes.push(args) };
  vm.runInNewContext(app.match(/function setCurvyEnabled\(enabled, \{ persist = true \} = \{\}\) \{[\s\S]*?\n\}/)[0], context);
  context.setCurvyEnabled(true, { persist: false });
  assert.equal(input.checked, true);
  assert.equal(writes.length, 0);
  context.setCurvyEnabled(false, { persist: false });
  assert.equal(curvy.enabled, false);
  context.setCurvyEnabled(true);
  assert.deepEqual(writes, [['curvy', true]]);
  assert.match(app, /setCurvyEnabled\(preferencesOpenSnapshot.curvy, \{ persist: false \}\)/);
  assert.match(app, /readStoredBooleanPreference\(window, CURVY_PREFERENCE_KEY, false\)/);
});
