import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [app, html, css] = await Promise.all(['app.js', 'index.html', 'styles.css'].map(read));

test('empty strand guidance follows selection and tool context', () => {
  const start = app.indexOf('function updateAttributeEditorMode() {');
  const body = app.slice(start, app.indexOf('  const editingGroup =', start)) + '\n}';
  const hiddenFor = overrides => {
    let hidden;
    const state = {
      getSelectedLock: () => null, viewportEditMode: 'strand', activeTool: 'select',
      selectedStrandGroup: null, headSetupEditing: false, scalpBuilderEditing: false,
      scalpPaintEditing: false, scalpShapeEditing: false,
      document: { querySelector: id => {
        assert.equal(id, '#strandEmptyState');
        return { classList: { toggle: (name, value) => {
          assert.equal(name, 'hidden'); hidden = value;
        } } };
      } }, ...overrides
    };
    vm.runInNewContext(body + '\nupdateAttributeEditorMode();', state);
    return hidden;
  };
  assert.equal(hiddenFor({}), false);
  for (const overrides of [
    { getSelectedLock: () => ({ id: 'strand' }) }, { selectedStrandGroup: {} },
    { activeTool: 'draw' }, { activeTool: 'move' },
    ...['mesh', 'brush', 'preset', 'guide', 'reference'].map(viewportEditMode => ({ viewportEditMode })),
    ...['headSetupEditing', 'scalpBuilderEditing', 'scalpPaintEditing', 'scalpShapeEditing'].map(key => ({ [key]: true }))
  ]) assert.equal(hiddenFor(overrides), true, JSON.stringify(overrides));
  assert.equal(hiddenFor({}), false, 'Returning to empty Select restores guidance');
  assert.match(html, /id="strandEmptyState"[^>]*class="panel-section attribute-empty-state hidden"[^>]*data-attribute-panel="main"/);
});

test('empty outliner folders retain headers and selection sets use a single row', () => {
  assert.match(app, /groupElement\.classList\.toggle\("outliner-group-empty", groupLocks\.length === 0\)/);
  assert.match(app, /group\.classList\.toggle\("outliner-group-empty", selectionSets\.length === 0\)/);
  assert.match(css, /\.outliner-panel \.outliner-group-empty > \.outliner-group-items\s*\{\s*display: none;/);
  assert.match(css, /\.selection-sets-group \.outliner-group-select\s*\{\s*grid-template-columns: 12px minmax\(0, 1fr\) auto;/);
});

test('neutral head material and curve icons use the revised display styling', async () => {
  const install = app.slice(app.indexOf('function installGuideModel('));
  assert.match(install, /new THREE\.MeshStandardMaterial\(\{\s*color: 0x646468,/);
  for (const name of ['relax-tool', 'curve-sharpness-tool']) {
    const svg = await read(`assets/${name}.svg`);
    assert.match(svg, /viewBox="0 0 32 32"/);
    assert.match(svg, /stroke-width="1\.8"/);
    assert.ok(css.includes(`${name}.svg?v=20260905-1`));
  }
});
