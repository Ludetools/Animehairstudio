import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {
  DEFAULT_SHORTCUT_BINDINGS, EDITABLE_SHORTCUTS, changeShortcutBinding, getShortcutBindings,
  setShortcutBindings, normalizeShortcutBindings, shortcutToolForKey, workspaceForShortcutKey,
  focusedControlShouldYieldToShortcut
} from '../modules/shortcut-registry.js';
import { readStoredPreference } from '../modules/preference-storage.js';
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');

test('custom shortcut routing replaces old keys and preserves focus policy', t => {
  t.after(() => setShortcutBindings(DEFAULT_SHORTCUT_BINDINGS));
  const draft = changeShortcutBinding(DEFAULT_SHORTCUT_BINDINGS, 'tool:move', 'J').bindings;
  const next = changeShortcutBinding(draft, 'workspace:mesh', '7').bindings;
  setShortcutBindings(next);
  assert.equal(shortcutToolForKey('J'), 'move');
  assert.equal(shortcutToolForKey('w'), null);
  assert.equal(workspaceForShortcutKey('7'), 'mesh');
  assert.equal(workspaceForShortcutKey('2'), null);
  assert.equal(focusedControlShouldYieldToShortcut({ tagName: 'SELECT' }, { key: 'j' }), true);
  assert.equal(focusedControlShouldYieldToShortcut({ tagName: 'SELECT' }, { key: 'w' }), false);
  for (const type of ['text', 'number']) assert.equal(focusedControlShouldYieldToShortcut({ tagName: 'INPUT', type }, { key: 'j' }), false);
  assert.equal(focusedControlShouldYieldToShortcut({ tagName: 'INPUT', type: 'range' }, { key: 'ArrowRight' }), false);
  assert.equal(focusedControlShouldYieldToShortcut({ tagName: 'SELECT' }, { key: 'd', ctrlKey: true }), true);
});

test('shortcut conflicts, swaps and resets are explicit and drafts do not mutate runtime', () => {
  const before = getShortcutBindings();
  assert.deepEqual(changeShortcutBinding(before, 'tool:move', 'e'), { conflict: 'tool:rotate' });
  const swapped = changeShortcutBinding(before, 'tool:move', 'e', true).bindings;
  assert.equal(swapped['tool:rotate'], 'w');
  assert.equal(swapped['tool:move'], 'e');
  assert.deepEqual(getShortcutBindings(), before);
  const reset = changeShortcutBinding(swapped, 'tool:move', 'w', true).bindings;
  assert.deepEqual(reset, DEFAULT_SHORTCUT_BINDINGS);
  for (const key of ['s', 'b', 'o', 'h', 'l', 'f', 'x', 'z', 'Tab', ' ', 'Ctrl+j']) assert.ok(changeShortcutBinding(before, 'tool:move', key).error);
});

test('stored custom shortcuts normalize or fall back atomically', () => {
  for (const invalid of [null, [], { 'tool:move': 'q' }, { 'tool:move': 's' }]) assert.deepEqual(normalizeShortcutBindings(invalid), DEFAULT_SHORTCUT_BINDINGS);
  assert.equal(normalizeShortcutBindings({ 'tool:move': 'J' })['tool:move'], 'j');
  const roundTrip = JSON.parse(JSON.stringify(changeShortcutBinding(DEFAULT_SHORTCUT_BINDINGS, 'tool:move', 'j').bindings));
  assert.deepEqual(normalizeShortcutBindings(roundTrip), roundTrip);
  assert.deepEqual(readStoredPreference({ localStorage: { getItem: () => '{broken' } }, 'key', {
    fallback: DEFAULT_SHORTCUT_BINDINGS, normalize: value => normalizeShortcutBindings(JSON.parse(value))
  }), DEFAULT_SHORTCUT_BINDINGS);
});

test('shortcut editor save failures and cancellation do not activate drafts', () => {
  const listeners = {}, dialog = { close() { this.closed = true; } }, status = {};
  let writesSucceed = false, labels = 0;
  const state = vm.createContext({
    document: { querySelector: () => ({ addEventListener: (name, fn) => { listeners.cancel = fn; } }) },
    saveShortcutButton: { addEventListener: (name, fn) => { listeners.save = fn; } },
    shortcutEditor: dialog, shortcutBindingStatus: status, shortcutStorageKey: 'key', window: {},
    shortcutDraft: changeShortcutBinding(DEFAULT_SHORTCUT_BINDINGS, 'tool:move', 'j').bindings,
    writeStoredPreference: () => writesSucceed, setShortcutBindings, syncShortcutLabels: () => labels++
  });
  const start = app.indexOf('document.querySelector("#cancelShortcutBindings").addEventListener');
  vm.runInContext(app.slice(start, app.indexOf('\nsyncShortcutLabels();', start)), state);
  listeners.save();
  assert.match(status.textContent, /Could not save/);
  assert.equal(shortcutToolForKey('w'), 'move');
  listeners.cancel();
  assert.equal(dialog.closed, true);
  assert.equal(shortcutToolForKey('w'), 'move');
  writesSucceed = true;
  listeners.save();
  assert.equal(shortcutToolForKey('j'), 'move');
  assert.equal(labels, 1);
  setShortcutBindings(DEFAULT_SHORTCUT_BINDINGS);
});

test('Settings shortcut editor is separate and labels cover every editable binding', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="settingsMenu"[\s\S]*id="openShortcutEditor"/);
  assert.match(html, /<dialog id="shortcutEditor"/);
  assert.match(app, /if \(document.querySelector\("#shortcutEditor"\)\.open\) return;/);
  for (const action of EDITABLE_SHORTCUTS) assert.ok(html.includes(`data-shortcut-label="${action.id}"`));
});

test('reassigned tool keys retain production tap, hold and matching release behavior', t => {
  t.after(() => setShortcutBindings(DEFAULT_SHORTCUT_BINDINGS));
  setShortcutBindings(changeShortcutBinding(DEFAULT_SHORTCUT_BINDINGS, 'tool:move', 'j').bindings);
  let callback, active, opened = 0, finished = 0;
  const context = vm.createContext({ toolShortcutPress: null, toolRadialGesture: null,
    strandRadialGesture: null, duplicatePlacement: null, radialMenusEnabled: true,
    hotkeyToolSettingsExperimentalEnabled: false,
    setActiveTool: tool => { active = tool; },
    window: { setTimeout: fn => { callback = fn; return 1; }, clearTimeout() {} },
    beginToolRadialGesture: () => { opened++; return true; },
    finishToolRadialGesture: () => { finished++; }
  });
  const start = app.indexOf('function beginToolShortcutPress(');
  vm.runInContext(app.slice(start, app.indexOf('function cancelToolShortcutPress()', start)), context);
  context.requested = shortcutToolForKey('j');
  vm.runInContext('beginToolShortcutPress("j", requested)', context);
  assert.equal(active, 'move');
  assert.equal(vm.runInContext('finishToolShortcutPress("w")', context), false);
  assert.equal(vm.runInContext('finishToolShortcutPress("j")', context), true);
  callback();
  assert.equal(opened, 0, 'Released tap cannot open a delayed radial menu');
  vm.runInContext('beginToolShortcutPress("j", requested)', context);
  callback();
  assert.equal(opened, 1);
  assert.equal(vm.runInContext('finishToolShortcutPress("j")', context), true);
  assert.equal(finished, 1);
});
