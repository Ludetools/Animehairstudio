import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { flippedCurveNormalIndices, rebuiltCurveNormals } from '../modules/curve-normal-repair.js';
test('rebuilt normals are perpendicular unit vectors with stable transport and degenerate fallbacks', () => {
  const tangents=Array.from({length:20},(_,i)=>({x:Math.cos(i/19*Math.PI),y:Math.sin(i/19*Math.PI),z:0}));
  const normals=rebuiltCurveNormals(tangents,{x:1,y:0,z:0});
  normals.forEach((n,i)=>{
    assert.ok(Math.abs(Math.hypot(n.x,n.y,n.z)-1)<1e-8);
    assert.ok(Math.abs(n.x*tangents[i].x+n.y*tangents[i].y)<1e-8);
    if(i)assert.ok(n.x*normals[i-1].x+n.y*normals[i-1].y+n.z*normals[i-1].z>0);
  });
  assert.ok(rebuiltCurveNormals([{x:0,y:0,z:0},{x:0,y:-1,z:0}],null).every(n=>Object.values(n).every(Number.isFinite)));
});
test('rebuild dialog normals-only path does not resample points or twist and creates one undo', async () => {
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('function rebuildSelectedCurves() {'),app.indexOf('\nfunction fixSelectedCurveNormals()'));
  const point=y=>({x:0,y,z:0,clone(){return point(this.y);}});
  const target={points:[point(0),point(1),point(2)],pointTwists:[0,.2,.4],rootSurfaceNormal:{x:0,y:0,z:1}};
  const originalPoints=target.points,originalTwists=target.pointTwists;let undo=0,finished=0;
  const context={selectedRebuildableCurves:()=>[target],rebuildCurvePointCountInput:{value:'3',setCustomValidity(){}},
    rebuildCurveEvenSpacingInput:{checked:false},rebuildCurveNormalsInput:{checked:true,disabled:false},
    rebuildCurveResetRotationsInput:{checked:false,disabled:false},
    pushUndoState(){undo++;},clearMultiPointSelection(){},curveRebuildParameters:()=>[0,.5,1],rebuiltCurveNormals,
    THREE:{CatmullRomCurve3:class{getLengths(){return [0,1,2];}getTangent(){return {x:0,y:1,z:0};}},Vector3:class{constructor(x,y,z){Object.assign(this,{x,y,z});}}},
    resampleStrandCurveData(){throw Error('Normals-only must not resample');},finishStrandCurveTopologyChange(){finished++;},
    getSelectedLock:()=>null,renderLockList(){},refreshRebuildCurveDialog(){}};
  vm.createContext(context);vm.runInContext(source,context);
  assert.equal(context.rebuildSelectedCurves(),true);assert.equal(undo,1);assert.equal(finished,1);
  assert.equal(target.points,originalPoints);assert.equal(target.pointTwists,originalTwists);
  assert.equal(target.pointSurfaceNormals.length,3);
  assert.equal(target.surfaceNormalInfluence,1);
  // Reset works independently, without rebuilding normals or resampling.
  context.rebuildCurveNormalsInput.checked=false;
  context.rebuildCurveResetRotationsInput.checked=true;
  const originalNormals=target.pointSurfaceNormals;
  target.braidRotation=35;target.strandRotation=12;target.twist=.6;
  target.pointTwists=[2.2942656135587,2.9362418312641236,2.827290744863955];
  assert.equal(context.rebuildSelectedCurves(),true);
  assert.equal(undo,2);assert.equal(finished,2);
  assert.deepEqual(Array.from(target.pointTwists),[0,0,0]);
  assert.equal(target.points,originalPoints);assert.equal(target.pointSurfaceNormals,originalNormals);
  assert.equal(target.braidRotation,35);assert.equal(target.strandRotation,12);assert.equal(target.twist,.6);
  context.rebuildCurveResetRotationsInput.checked=false;
  assert.equal(context.rebuildSelectedCurves(),false);assert.equal(undo,2);
});
test('rebuild point rotation reset is a separate unchecked checkbox', async () => {
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const input=html.match(/<input\b[^>]*id="rebuildCurveResetRotations"[^>]*>/g);
  assert.equal(input?.length,1);
  assert.match(input[0],/type="checkbox"/);
  assert.doesNotMatch(input[0],/\bchecked\b/);
});
test('braid frames consume repaired normals at curve parameter rather than world radial direction', async () => {
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('function braidFrameAt('),app.indexOf('\nfunction braidFrameAtExtended('));
  const unit={normalize(){return this;}};
  const lock={braidRotation:90};
  const point={x:1,y:-2,z:0};
  let sampledParameter,appliedTwist;
  const normal={applyAxisAngle(axis,angle){assert.equal(axis,unit);appliedTwist=angle;return this;},normalize(){return this;}};
  const context={THREE:{MathUtils:{degToRad:n=>n*Math.PI/180},Vector3:class{crossVectors(){return unit;}}},
    guidedNormalAt(target,p,tangent,t){assert.equal(target,lock);assert.equal(p,point);assert.equal(tangent,unit);sampledParameter=t;return normal;},
    outwardNormalAtPoint(){throw Error('Braid bypassed the repaired normal field');},strandTwistAt:()=>.2};
  vm.createContext(context);vm.runInContext(source,context);
  const curve={getPointAt:()=>point,getTangentAt:()=>unit,getUtoTmapping:t=>t*t};
  const frame=context.braidFrameAt(lock,curve,.5);
  assert.equal(sampledParameter,.25,'normal control points use curve parameter, not arc length');
  assert.equal(frame.z,normal);assert.equal(frame.point,point);
  assert.equal(appliedTwist,.2+Math.PI/2,'preserve authored twist and braid rotation');
});
test('normal repair controller captures one undo before modifying the selected curves', async () => {
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('function fixSelectedCurveNormals() {'),app.indexOf("\ndocument.querySelector('#fixCurveNormals').addEventListener"));
  const normal=z=>({x:0,y:0,z,negate(){this.z=-this.z;}});
  const lock={geometryType:'strand',points:[{x:0,y:0,z:0},{x:0,y:1,z:0}],pointSurfaceNormals:[normal(1),normal(-1)]};
  const before=JSON.stringify(lock.points);let undo=0,mirrors=0;
  const context={selectedLocksInOrder:()=>[lock],flippedCurveNormalIndices,
    document:{querySelector:()=>({})},pushUndoState(){assert.equal(lock.pointSurfaceNormals[1].z,-1);undo++;},
    commitClumpMemberRestState(){},updateLockGeometry(){},updateCurveObjects(){},syncActiveMirror(){mirrors++;},requestShadowMapRefresh(){}};
  vm.createContext(context);vm.runInContext(source,context);context.fixSelectedCurveNormals();
  assert.equal(undo,1);assert.equal(mirrors,1);assert.equal(lock.pointSurfaceNormals[1].z,1);
  assert.equal(JSON.stringify(lock.points),before);
  context.fixSelectedCurveNormals();assert.equal(undo,1);
});
test('curve normal repair finds isolated and consecutive sign flips without mutation', () => {
  const points=[0,1,2,3,4].map(y=>({x:0,y,z:0}));
  const normals=[1,-1,-1,1,1].map(z=>({x:0,y:0,z}));
  assert.deepEqual(flippedCurveNormalIndices(points,normals),[1,2]);
  assert.equal(normals[1].z,-1);
  assert.deepEqual(flippedCurveNormalIndices(points,[]),[]);
});
test('gradual curved normals are transported rather than globally forced to one hemisphere', () => {
  const points=Array.from({length:17},(_,i)=>({x:Math.cos(i*Math.PI/16),y:Math.sin(i*Math.PI/16),z:0}));
  assert.deepEqual(flippedCurveNormalIndices(points,points),[]);
  const normals=points.map(p=>({...p}));normals[8]={x:-normals[8].x,y:-normals[8].y,z:0};
  assert.deepEqual(flippedCurveNormalIndices(points,normals),[8]);
});
