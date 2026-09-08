import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { resizeStrandLattice } from '../modules/strand-lattice-resize.js';
import { createInputEditSession } from '../modules/input-edit-session.js';

const fixture=()=>({curveSurfaceColumns:2,curveSurfaceRows:2,curveSurfaceCenterCurve:1,
  points:[{x:0,y:1,z:0},{x:0,y:0,z:0},{x:1,y:1,z:0},{x:1,y:0,z:0}],
  pointTwists:[0,1,2,3],pointScales:Array(4).fill({x:1,z:1}),pointWidths:[1,1,1,1],pointSurfaceNormals:[],curvePointSharpness:[0,0,0,0]});

test('lattice loop resize adds and removes rows and columns with consistent attributes and corners',()=>{
  const data=fixture(),before=JSON.stringify(data);
  const up=resizeStrandLattice(data,3,5);
  assert.equal(up.points.length,15);assert.equal(up.pointTwists.length,15);
  assert.deepEqual(up.points[7],{x:.5,y:.5,z:0});assert.equal(up.pointTwists[7],1.5);
  assert.deepEqual(up.points[0],data.points[0]);assert.deepEqual(up.points.at(-1),data.points.at(-1));
  assert.deepEqual(resizeStrandLattice(up,2,2).points,data.points);
  assert.equal(JSON.stringify(data),before);
  assert.equal(resizeStrandLattice(data,1,5),null);
  assert.equal(resizeStrandLattice(data,3,257),null);
  assert.equal(resizeStrandLattice(data,3.5,5),null);
});

test('lattice loop edit makes one undoable commit and ignores other objects and no-op counts',async()=>{
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('function applyStrandLatticeLoops('),app.indexOf('function selectedStrandLatticeSources()'));
  const lock={...fixture(),curveSurfaceLoft:true};let undo=0,finished=0;
  const before=JSON.stringify(lock);
  class V {constructor(x,y,z){Object.assign(this,{x,y,z});}normalize(){return this;}}
  const context={getSelectedLock:()=>lock,viewportEditMode:'strand',resizeStrandLattice,
    curveSurfaceControllerCurves:base=>Array.from({length:base.curveSurfaceColumns},(_,c)=>base.points.slice(c*base.curveSurfaceRows,(c+1)*base.curveSurfaceRows)),
    THREE:{Vector3:V,CatmullRomCurve3:class{constructor(points){this.points=points;}getPoint(t){return {x:this.points[0].x,y:1-t,z:0};}}},
    pushUndoState(){assert.equal(JSON.stringify(lock),before);undo++;},clearMultiPointSelection(){},
    selectedPoint:{},selectedCurveSurfaceController:{},finishStrandCurveTopologyChange(){finished++;},syncStrandLatticeSettings(){},renderLockList(){}};
  vm.createContext(context);vm.runInContext(source,context);
  assert.equal(context.applyStrandLatticeLoops(2,2),false);
  assert.equal(context.applyStrandLatticeLoops(0,3),false);assert.equal(undo,0);
  assert.equal(context.applyStrandLatticeLoops(3,4),true);assert.equal(undo,1);assert.equal(finished,1);
  assert.equal(lock.points.length,12);assert.equal(context.selectedPoint,null);
  assert.equal(context.applyStrandLatticeLoops(2,2,{source:fixture(),recordUndo:false}),true);
  assert.equal(undo,1);assert.equal(finished,2);
  assert.equal(JSON.stringify(lock.points),JSON.stringify(fixture().points));
  lock.locked=true;assert.equal(context.applyStrandLatticeLoops(2,2),false);assert.equal(undo,1);
});

test('lattice settings have dedicated controls and replace inapplicable strand panels',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  for(const id of ['strandLatticeSettings','strandLatticeSettingsForm','strandLatticeRows','strandLatticeColumns']) {
    assert.equal(html.split(`id="${id}"`).length-1,1);
  }
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  assert.doesNotMatch(html,/id="applyStrandLatticeLoops"/);
  assert.match(app,/strandTopologyPanel\.classList\.toggle\("hidden", editingLattice/);
  assert.match(html,/Horizontal Loops <input id="strandLatticeRows" type="range"[^>]*value="8"/);
  assert.match(html,/Vertical Loops <input id="strandLatticeColumns" type="range"[^>]*value="3"/);
  assert.match(app,/querySelector\('#strandLatticeRowsValue'\)\.textContent/);
  assert.match(app,/querySelector\('#strandLatticeColumnsValue'\)\.textContent/);
  assert.match(app,/strandShapePanel\.classList\.toggle\(\s*"hidden",\s*editingLattice/);
});

test('lattice control shares numeric and drag transactions, retains source grid and cancels safely', async () => {
  const app = await readFile(new URL('../app.js',import.meta.url),'utf8');
  const listeners = new Map(), windowListeners = new Map();
  const control = { addEventListener(type, fn) { listeners.set(type, fn); } };
  let target = {...fixture(), id:'lattice', curveSurfaceLoft:true}, captures=0;
  const initial = JSON.stringify(target), sources=[];
  const session = createInputEditSession({
    capture() {captures++;return JSON.stringify(target);},
    restore(saved) {target=JSON.parse(saved);}
  });
  const values = {columns:3,rows:4};
  const c = {getSelectedLock:()=>target, viewportEditMode:'strand',cancelledInputDrag:null,inputEditSession:session,
    window:{addEventListener(type,fn){windowListeners.set(type,fn);}},
    document:{querySelector:id=>({value:id.includes('Columns')?values.columns:values.rows})},
    syncStrandLatticeSettings(){},
    applyStrandLatticeLoops(columns,rows,opts){
      if(columns===target.curveSurfaceColumns && rows===target.curveSurfaceRows)return false;
      assert.equal(opts.recordUndo,false);opts.beforeCommit();sources.push(opts.source);
      Object.assign(target,resizeStrandLattice(opts.source,columns,rows));return true;
    }
  };
  vm.runInNewContext(app.match(/function bindStrandLatticeLoopControl\([^]*?\n\}/)[0], c);
  c.bindStrandLatticeLoopControl(control);
  // Typed edits need no pointer-down to start the same source-preserving session.
  listeners.get('input')({}); values.rows=6;listeners.get('input')({});
  assert.equal(captures,1);assert.equal(sources[0],sources[1]);assert.equal(sources[0].points.length,4);
  assert.equal(session.cancel({}),null); // Other owners cannot cancel this edit.
  session.cancel(control);assert.equal(JSON.stringify(target),initial);
  listeners.get('change')();values.rows=4;listeners.get('input')({});
  assert.equal(captures,2);listeners.get('change')();assert.equal(session.cancel(),null);
  listeners.get('pointerdown')();values.rows=5;listeners.get('input')({});
  listeners.get('pointercancel')();assert.equal(target.curveSurfaceRows,4);
  c.cancelledInputDrag=control;let blocked=0;
  listeners.get('input')({preventDefault(){blocked++;},stopImmediatePropagation(){blocked++;}});
  assert.equal(blocked,2);assert.equal(captures,3);
  c.cancelledInputDrag=null;target.locked=true;listeners.get('input')({});assert.equal(captures,3);
});
