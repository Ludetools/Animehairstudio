import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

test('attached glass preference switches independently and restores classic glass', async () => {
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const functions = ['normalizeSidePanelStyle', 'setSidePanelStyle'].map(name =>
    source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0]).join('\n');
  const classes = new Set();
  const saved = [];
  const context = {
    sidePanelStyle: 'glass', sidePanelStylePreferenceInput: {}, compactSidebarDockActivationWidth: null,
    document: { body: { classList: {
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
      remove: name => classes.delete(name)
    } } },
    window: { requestAnimationFrame: fn => fn() },
    syncViewportTopControlRows() {}, resize() {},
    SIDE_PANEL_STYLE_PREFERENCE_KEY: 'style',
    writeStoredPreference: (_window, _key, value) => saved.push(value)
  };
  runInNewContext(functions, context);
  context.setSidePanelStyle('attached-glass');
  assert.ok(classes.has('attached-glass-panels'));
  assert.ok(classes.has('glass-side-panels'));
  assert.equal(saved.at(-1), 'attached-glass');
  context.setSidePanelStyle('glass', { persist: false });
  assert.ok(!classes.has('attached-glass-panels'));
  assert.ok(classes.has('glass-side-panels'));
  assert.equal(saved.length, 1);
  context.setSidePanelStyle('default');
  assert.ok(!classes.has('floating-side-panels'));
  assert.ok(!classes.has('glass-side-panels'));
  assert.equal(context.normalizeSidePanelStyle(true), 'transparent');
});
