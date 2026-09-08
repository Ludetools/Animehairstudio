import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { buildConnectedCurveCardGrid } from '../modules/curve-surface.js';
import { orderStrandLatticeCurves, curveSurfacePointVisible } from '../modules/strand-lattice-order.js';

test('lattice ordering follows spatial neighbors regardless of selection order or shared roots', () => {
  const curves=Array.from({length:7},(_,i)=>Array.from({length:8},(_,row)=>{
    const angle=i*Math.PI/9;
    return {x:Math.cos(angle)*row,y:3-row,z:Math.sin(angle)*row};
  }));
  const shuffled=[curves[3],curves[0],curves[6],curves[2],curves[5],curves[1],curves[4]];
  const before=JSON.stringify(shuffled);
  const result=orderStrandLatticeCurves(shuffled).map(c=>curves.indexOf(c));
  assert.ok(result.every((n,i)=>!i || Math.abs(n-result[i-1])===1));
  assert.deepEqual(orderStrandLatticeCurves([...shuffled].reverse()).map(c=>curves.indexOf(c)),result);
  assert.equal(JSON.stringify(shuffled),before);
});

test('all loft control points are exposed while legacy surfaces retain controller filtering', () => {
  const lock={geometryType:'curve-surface',curveSurfaceRows:5,curveSurfaceLoft:true};
  for (const active of [null,0,1,2]) {
    for (let i=0;i<15;i++) assert.equal(curveSurfacePointVisible(lock,i,active),true);
  }
  assert.equal(curveSurfacePointVisible({...lock,curveSurfaceLoft:false},7,0),false);
  assert.equal(curveSurfacePointVisible({...lock,curveSurfaceLoft:false},7,1),true);
});

test('strand lattice preserves root-to-tip direction and exact exterior boundaries', () => {
  const curves = [
    [{x:0,y:2,z:0},{x:0,y:0,z:0}],
    [{x:1,y:0,z:0},{x:1,y:2,z:0}]
  ];
  const before = JSON.stringify(curves);
  const grid = buildConnectedCurveCardGrid(curves, {rows:9,loft:true});
  assert.equal(grid.columns,2);
  assert.equal(grid.points.length,18);
  assert.deepEqual(grid.points.slice(0,2),curves.map(c=>c[0]));
  assert.deepEqual(grid.points.slice(-2),curves.map(c=>c.at(-1)));
  assert.ok(grid.points.every(p=>Object.values(p).every(Number.isFinite)));
  assert.equal(JSON.stringify(curves),before);
  assert.ok(buildConnectedCurveCardGrid(curves,{rows:9}).columns>2,'legacy strip margins remain');
});

test('strand lattice creation copies curves, hides sources and captures one undo before mutation', async () => {
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('function selectedStrandLatticeSources()'),app.indexOf('function createCompoundStrand()'));
  class V {
    constructor(x,y,z=0){Object.assign(this,{x,y,z});}
    clone(){return new V(this.x,this.y,this.z);}
    sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
    lengthSq(){return this.x**2+this.y**2+this.z**2;}
    set(x,y,z){Object.assign(this,{x,y,z});return this;}
    normalize(){const n=Math.sqrt(this.lengthSq());this.x/=n;this.y/=n;this.z/=n;return this;}
  }
  const sources=[0,1].map(x=>({id:String(x),geometryType:'strand',points:[new V(x,3),new V(x,0)],outlinerVisible:true,pointTwists:[.2,.4],materialId:'test',scalpRegion:'front',hairLayer:'mid'}));
  const before=JSON.stringify(sources);let undo=0,created,selected;
  const context={viewportEditMode:'strand',selectedLocksInOrder:()=>sources,lockIndex:9,orderStrandLatticeCurves,
    strandBaseCurve:lock=>({getPointAt:t=>new V(lock.points[0].x,3*(1-t))}),
    pushUndoState(){assert.equal(JSON.stringify(sources),before);undo++;},
    addLock(preset,data){created={...data,id:'new'};return created;},
    setLocksOutlinerVisibility(targets,visible){targets.forEach(t=>t.outlinerVisible=visible);},
    selectLock(id){selected=id;},setActiveTool(){},updateCount(){}};
  vm.createContext(context);vm.runInContext(source,context);
  for (const invalid of [0,1,257,2.5,NaN]) assert.equal(context.createStrandLattice(invalid),false);
  assert.equal(undo,0);
  assert.equal(context.createStrandLattice(5),true);
  assert.equal(undo,1);assert.equal(selected,'new');assert.equal(created.curveSurfaceLoft,true);
  assert.equal(created.curveSurfaceColumns,2);assert.equal(created.curveSurfaceRows,5);
  assert.equal(created.materialId,'test');assert.equal(created.outlinerVisible,true);
  sources.forEach((s,i)=>{
    assert.equal(s.outlinerVisible,false);
    assert.deepEqual(s.pointTwists,[.2,.4]);
    assert.notEqual(created.points[i*5],s.points[0]);
    assert.deepEqual(created.points[i*5],s.points[0]);
    assert.deepEqual(created.points[i*5+4],s.points.at(-1));
  });
  context.viewportEditMode='mesh';assert.equal(context.createStrandLattice(),false);assert.equal(undo,1);
  context.viewportEditMode='strand';sources.pop();assert.equal(context.createStrandLattice(),false);assert.equal(undo,1);
});

test('strand lattice command and saved loft discriminator have lifecycle owners', async () => {
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.equal((html.match(/id="createStrandLattice"/g)||[]).length,1);
  assert.match(html,/<dialog id="strandLatticeDialog"/);
  assert.match(html,/<input id="strandLatticePointCount"[^>]*min="2"[^>]*max="256"[^>]*required/);
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  assert.match(app,/partner\.curveSurfaceLoft = Boolean\(lock\.curveSurfaceLoft\)/);
  assert.match(app,/curveSurfaceLoft: snapshot\.geometryType === "curve-surface" && Boolean\(snapshot\.curveSurfaceLoft\)/);
});

test('lattice helpers include every crosswise control row without changing legacy curves', async () => {
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('function curveSurfaceControllerSegments('),app.indexOf('function curveSurfaceControllerIndexNearPoint('));
  const curves=Array.from({length:3},(_,x)=>Array.from({length:4},(_,y)=>({x,y,z:0})));
  const context={curveSurfaceControllerPreviewRows:()=>4,sampledCurveSurfaceControllerCurves:()=>curves,curveSurfaceControllerCurves:()=>curves};
  vm.createContext(context);vm.runInContext(source,context);
  const lock={curveSurfaceLoft:true,curveSurfaceRows:4};
  const lines=context.curveSurfaceControllerSegments(lock);
  assert.equal(lines.length,3*3*2+2*4*2);
  assert.equal(lines[18],curves[0][0]);assert.equal(lines[19],curves[1][0]);
  assert.equal(lines.at(-2),curves[1][3]);assert.equal(lines.at(-1),curves[2][3]);
  assert.equal(context.curveSurfaceControllerSegments(lock,1).length,6);
  assert.equal(context.curveSurfaceControllerSegments({...lock,curveSurfaceLoft:false}).length,18);
});

test('opening lattice dialog proposes count without committing or hiding sources', async () => {
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('function openStrandLatticeDialog('),app.indexOf('function createStrandLattice('));
  let opened=0;
  const title={},hint={},hide={};
  const context={document:{querySelector:id=>id.endsWith('Hint')?hint:id.endsWith('HideSources')?hide:title},selectedStrandLatticeSources:()=>[{points:Array(12)}],strandLatticeDialog:{dataset:{},showModal(){opened++;}},strandLatticePointCountInput:{setCustomValidity(){},focus(){},select(){}}};
  vm.createContext(context);vm.runInContext(source,context);
  assert.equal(context.openStrandLatticeDialog(),true);assert.equal(opened,1);
  assert.equal(context.strandLatticePointCountInput.value,'12');
  assert.equal(hide.checked,true);
  assert.equal(context.openStrandLatticeDialog('guide'),true);
  assert.equal(context.strandLatticePointCountInput.max,'12');
  assert.equal(title.textContent,'Create Curve Lattice Guide');
  assert.equal(hide.checked,false);
  assert.match(hint.textContent,/hiding is optional/);
  assert.equal(context.strandLatticeDialog.dataset.output,'guide');
  context.selectedStrandLatticeSources=()=>Array.from({length:13},()=>({points:Array(3)}));
  assert.equal(context.openStrandLatticeDialog('guide'),false);
  context.selectedStrandLatticeSources=()=>[];
  assert.equal(context.openStrandLatticeDialog(),false);assert.equal(opened,2);
});
