import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { PANEL_DEFAULTS, normalizePanelWidths, draggedPanelWidth, panelDragShouldCollapse, dockedToolSettingsLayout } from '../modules/workspace-layout.js';
import { readStoredPreference, writeStoredPreference } from '../modules/preference-storage.js';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');

test('docked tool settings align with workspace and tool rail at different UI scales', () => {
  for (const scale of [0.75, 1, 1.5, 2]) {
    const viewport = { left: 100, top: 50, width: 1000 * scale, height: 700 * scale };
    const rail = { right: 100 + 50 * scale, top: 50 + 100 * scale };
    const workspace = { right: 100 + 260 * scale };
    const result = dockedToolSettingsLayout(viewport, rail, workspace, scale);
    assert.equal(result.left, 54);
    assert.equal(result.top, 100);
    assert.equal(result.left + result.width, 260);
    assert.equal(result.top + result.maxHeight, 692);
  }
  const small = dockedToolSettingsLayout({ left: 0, top: 0, width: 220, height: 160 }, { right: 50, top: 140 }, { right: 260 });
  assert.equal(small.left + small.width, 212);
  assert.equal(small.maxHeight, 12, 'Do not enforce a minimum height that exceeds available room');
});

test('panel widths normalize invalid preferences and account for zoom and direction', () => {
  assert.deepEqual(normalizePanelWidths(null), PANEL_DEFAULTS);
  assert.deepEqual(normalizePanelWidths({ left: NaN, right: '400' }), PANEL_DEFAULTS);
  assert.deepEqual(normalizePanelWidths({ left: 0, right: 9999 }), { left: 220, right: 520 });
  assert.equal(draggedPanelWidth('left', 280, 40, 2), 300);
  assert.equal(draggedPanelWidth('right', 360, 40, 2), 340);
});

function fixture(side = 'left') {
  const handlers = {}, attributes = {}, stored = new Map();
  let captured = null;
  const handle = {
    parentElement: { getBoundingClientRect: () => ({ width: PANEL_DEFAULTS[side] * 2 }) },
    addEventListener: (name, callback) => { handlers[name] = callback; },
    setAttribute: (key, value) => { attributes[key] = value; },
    setPointerCapture: id => { captured = id; }, hasPointerCapture: id => captured === id,
    releasePointerCapture: () => { captured = null; }
  };
  const host = { addEventListener: (name, fn) => { handlers[name] = fn; },
    localStorage: { setItem: (key, value) => stored.set(key, value), getItem: key => stored.get(key) ?? null } };
  const state = vm.createContext({ panelWidths: { ...PANEL_DEFAULTS }, panelWidthKey: 'layout',
    PANEL_DEFAULTS, normalizePanelWidths, draggedPanelWidth, panelDragShouldCollapse, writeStoredPreference,
    collapsed: false,
    setOutlinerPanelCollapsed: value => { state.collapsed = value; },
    setAttributeEditorPanelCollapsed: value => { state.collapsed = value; },
    document: { documentElement: {}, body: { classList: { add() {}, remove() {}, contains: () => false } } },
    getComputedStyle: () => ({ getPropertyValue: () => '2' }), window: host,
    syncCompactSidebarLayout() {}, handle, side });
  const start = app.indexOf('function bindPanelResize(');
  vm.runInContext(app.slice(start, app.indexOf('\ndocument.querySelectorAll("[data-panel-resize]")', start)) + '\nbindPanelResize(handle, side);', state);
  const fire = (type, props = {}) => handlers[type]({ button: 0, pointerId: 1, clientX: 100,
    preventDefault() {}, stopPropagation() {}, ...props });
  return { fire, state, stored, host, attributes, captured: () => captured };
}

test('panel resize controller commits, restores cancellation, resets and supports keyboard', () => {
  for (const side of ['left', 'right']) {
    const f = fixture(side), original = PANEL_DEFAULTS[side];
    f.fire('pointerdown');
    f.fire('pointermove', { clientX: side === 'left' ? 140 : 60 });
    assert.equal(f.state.panelWidths[side], original + 20);
    assert.equal(f.stored.size, 0, 'Dragging does not write preferences');
    f.fire('pointercancel');
    assert.equal(f.state.panelWidths[side], original);
    assert.equal(f.captured(), null);
    f.fire('pointerdown');
    f.fire('pointermove', { clientX: side === 'left' ? 140 : 60 });
    f.fire('pointerup');
    assert.equal(JSON.parse(f.stored.get('layout'))[side], original + 20);
    const reloaded = readStoredPreference(f.host, 'layout', { fallback: PANEL_DEFAULTS, normalize: value => normalizePanelWidths(JSON.parse(value)) });
    assert.equal(reloaded[side], original + 20);
    f.fire('dblclick');
    assert.equal(f.state.panelWidths[side], original);
    f.fire('keydown', { key: side === 'left' ? 'ArrowRight' : 'ArrowLeft', shiftKey: true });
    assert.equal(f.state.panelWidths[side], original + 1);
    f.fire('keydown', { key: 'Home' });
    assert.equal(f.state.panelWidths[side], original);
    f.fire('pointerdown');
    f.fire('pointermove', { clientX: 150 });
    f.fire('blur');
    assert.equal(f.state.panelWidths[side], original);
  }
});

test('workspace layout storage failures safely retain defaults', () => {
  for (const value of ['{broken', '{"left":null,"right":-5}']) {
    const host = { localStorage: { getItem: () => value } };
    const widths = readStoredPreference(host, 'layout', { fallback: PANEL_DEFAULTS, normalize: value => normalizePanelWidths(JSON.parse(value)) });
    assert.equal(widths.left, 280);
    assert.ok(widths.right >= 280);
  }
  assert.equal(writeStoredPreference({}, 'layout', '{}'), false);
});

test('inward panel drag collapses at an unclamped zoom-aware threshold and preserves reopen width', () => {
  for (const side of ['left', 'right']) {
    const f = fixture(side), original = PANEL_DEFAULTS[side];
    const pointerAtWidth = width => 100 + (width - original) * 2 * (side === 'left' ? 1 : -1);
    f.fire('pointerdown');
    f.fire('pointermove', { clientX: pointerAtWidth(141) });
    assert.equal(f.state.collapsed, false);
    f.fire('pointermove', { clientX: pointerAtWidth(139) });
    assert.equal(f.state.collapsed, true);
    assert.equal(f.captured(), 1, 'Collapse keeps capture until release');
    f.fire('pointermove', { clientX: pointerAtWidth(180) });
    assert.equal(f.state.collapsed, false, 'Pulling back reopens during the same gesture');
    f.fire('pointermove', { clientX: pointerAtWidth(100) });
    f.fire('pointerup');
    assert.equal(f.state.collapsed, true);
    assert.equal(f.state.panelWidths[side], original);
    assert.equal(JSON.parse(f.stored.get('layout'))[side], original);
    assert.equal(f.captured(), null);
    const cancelled = fixture(side);
    cancelled.fire('pointerdown');
    cancelled.fire('pointermove', { clientX: pointerAtWidth(100) });
    cancelled.fire('pointercancel');
    assert.equal(cancelled.state.collapsed, false);
    assert.equal(cancelled.state.panelWidths[side], original);
    assert.equal(cancelled.stored.size, 0);
  }
});

test('workspace status reads tool and workspace selection without rebuilding the scene', () => {
  const summary = { textContent: '' };
  const context = vm.createContext({ activeTool: 'select', viewportEditMode: 'strand',
    selectedStrandIds: new Set(['a', 'b']), selectedId: 'b', selectedGuideId: null,
    selectedReferenceImageId: null,
    document: { querySelector: selector => selector === '#workspaceStatusSummary' ? summary
      : { getAttribute: () => 'Select tool' } }
  });
  const start = app.indexOf('function updateWorkspaceStatus()');
  vm.runInContext(app.slice(start, app.indexOf('\nconst shortcutStorageKey', start)), context);
  vm.runInContext('updateWorkspaceStatus()', context);
  assert.equal(summary.textContent, 'Select tool · 2 objects selected');
  context.viewportEditMode = 'guide';
  context.selectedGuideId = 'guide';
  vm.runInContext('updateWorkspaceStatus()', context);
  assert.equal(summary.textContent, 'Select tool · 1 object selected');
  context.viewportEditMode = 'reference';
  vm.runInContext('updateWorkspaceStatus()', context);
  assert.equal(summary.textContent, 'Select tool · 0 objects selected');
});

test('workspace chrome has resize accessibility, bounded layout and authoritative status hints', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.equal((html.match(/id="placementStatus"/g) || []).length, 1);
  assert.match(html, /class="workspace-status-bar"[\s\S]*id="workspaceStatusSummary"[\s\S]*id="placementStatus"/);
  for (const side of ['left', 'right']) assert.ok(html.includes(`data-panel-resize="${side}" role="separator" tabindex="0"`));
  assert.match(css, /grid-template-columns: var\(--left-panel-space\) minmax\(0, 1fr\) var\(--right-panel-space\)/);
  assert.match(css, /body:not\(\.compact-sidebar-docked\)\.compact-outliner-collapsed/);
  assert.match(app, /placementStatus\.title = message/);
});
