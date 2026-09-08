import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderRemeshProgress } from '../modules/remesh-progress.js';

function elements() {
  return {container: {}, label: {}, bar: {removeAttribute(name) { delete this[name]; }}};
}

test('Remesh progress starts indeterminate, reports progress, and clears after completion', () => {
  const ui = elements();
  renderRemeshProgress({pending: true}, ui);
  assert.equal(ui.container.hidden, false);
  assert.equal(ui.bar.value, undefined);
  assert.equal(ui.label.textContent, 'Preparing remesh…');
  renderRemeshProgress({running: true, progress: 0.42}, ui);
  assert.equal(ui.bar.value, 42);
  assert.equal(ui.label.textContent, 'Remeshing… 42%');
  renderRemeshProgress({running: false, pending: false}, ui);
  assert.equal(ui.container.hidden, true);
  assert.equal(ui.label.textContent, '');
});

test('Remesh progress handles cancellation, failure, restart and final processing', () => {
  const ui = elements();
  renderRemeshProgress({running: true, progress: 1}, ui);
  assert.equal(ui.bar.value, 99, 'Do not claim completion before the preview is built');
  for (const operation of [null, {closed: true, running: true}, {pending: false, running: false}]) {
    renderRemeshProgress(operation, ui);
    assert.equal(ui.container.hidden, true);
  }
  renderRemeshProgress({pending: true, progress: null}, ui);
  assert.equal(ui.bar.value, undefined);
  assert.equal(ui.container.hidden, false);
});

test('Remesh panel supplies uniquely identified progress controls and keeps Cancel', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['autoRemeshProgress', 'autoRemeshProgressBar', 'autoRemeshProgressLabel', 'cancelAutoRemeshStrands']) {
    assert.equal(html.split(`id="${id}"`).length - 1, 1);
  }
  assert.match(html, /<progress id="autoRemeshProgressBar" max="100" aria-label="Remeshing progress"/);
});
