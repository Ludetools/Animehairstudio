import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { exportHairFaces, exportCurvePolyline } from '../modules/obj-export.js';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const functionSource = name => source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0];
const attribute = rows => ({ count: rows.length, getX: i => rows[i][0], getY: i => rows[i][1], getZ: i => rows[i][2] });
const geometry = {
  userData: { quadFaces: [[0, 1, 2, 3]] },
  getIndex: () => ({ array: [0, 1, 2, 0, 2, 3] }),
  getAttribute: name => name === 'position'
    ? attribute([[0,0,0],[1,0,0],[1,1,0],[0,1,0]])
    : name === 'uv' ? attribute([[0,0],[1,0],[1,1],[0,1]]) : null
};
const locks = [1,2,3].map(id => ({ id, name: `Strand ${id}`, mesh: { geometry }, points: [{x:0,y:0,z:0},{x:0,y:1,z:0}] }));

test('selection OBJ preserves quad UV indices and polylines without leaking unselected objects', () => {
  const context = { locks, exportHairFaces, exportCurvePolyline,
    THREE: { CatmullRomCurve3: class { constructor(points) { this.points = points; } getPoint(t) { return this.points[t]; } }, MathUtils: { clamp: x => x } },
    strandCurveParameters: () => [0,1]
  };
  runInNewContext(functionSource('buildHairObj'), context);
  const obj = context.buildHairObj({selectedIds: [1,3]});
  assert.doesNotMatch(obj, /Strand_2/);
  assert.match(obj, /o Strand_1\n/);
  assert.match(obj, /o Strand_3\n/);
  assert.match(obj, /f 1\/1 2\/2 3\/3 4\/4\n/);
  assert.match(obj, /f 7\/5 8\/6 9\/7 10\/8\n/);
  assert.match(obj, /l 5 6\n/);
  assert.match(obj, /l 11 12\n/);
  assert.doesNotMatch(context.buildHairObj({selectedIds: []}), /^o /m);
  assert.doesNotMatch(context.buildHairObj({selectedIds: [999]}), /^o /m);
  assert.match(context.buildHairObj(), /Strand_2/);
  assert.doesNotMatch(context.buildHairObj({selectedIds:[3],includeMesh:false}), /^f /m);
  assert.doesNotMatch(context.buildHairObj({selectedIds:[3],includeCurves:false}), /^l /m);
});

test('selection export guards empty or unrelated workspace selection and captures object IDs', () => {
  const opened = [], alerts = [];
  let selection = [];
  const context = { viewportEditMode:'strand', strandWorkspaceActive: () => context.viewportEditMode === 'strand',
    selectedLocksInOrder: () => selection,
    openFileActionDialog: action => opened.push(action), window: { alert: text => alerts.push(text) }
  };
  runInNewContext(functionSource('exportSelectedHairObj'), context);
  context.exportSelectedHairObj();
  assert.equal(opened.length,0);
  assert.equal(alerts.length,1);
  selection = [locks[0],locks[2]];
  context.viewportEditMode = 'mesh';
  context.exportSelectedHairObj();
  assert.deepEqual([...opened[0].selectedIds],[1,3]);
  selection = [locks[1]];
  assert.deepEqual([...opened[0].selectedIds],[1,3]);
  context.viewportEditMode = 'guide';
  context.exportSelectedHairObj();
  assert.equal(opened.length,1);
});

test('selection export is wired through the shared file dialog and exporter', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="exportSelectionObj"[^>]*><span>Export Selection to OBJ/);
  assert.match(source, /querySelector\("#exportSelectionObj"\).addEventListener\("click", exportSelectedHairObj\)/);
  assert.match(source, /selectedIds: action.selectedIds/);
  assert.match(source, /pendingFileAction = \{ format, local: Boolean\(local\), selectedIds \}/);
});
