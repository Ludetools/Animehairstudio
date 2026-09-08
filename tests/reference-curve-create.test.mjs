import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {referencePlanePointFromCropCoordinate} from '../modules/reference-plane-crop.js';

test('Reference curve confirmation clones shape defaults as an object and creates one strand',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const start=app.indexOf('  onConfirm(path) {',app.indexOf('const referenceCurveEditor ='));
  const method=app.slice(start,app.indexOf('\n});',start));
  const cloneStart=app.indexOf('function cloneShapePresetValue(value)');
  const clone=app.slice(cloneStart,app.indexOf('\n}',cloneStart)+2);
  class Vector3 {
    constructor(x,y,z){Object.assign(this,{x,y,z});}
    sub(p){this.x-=p.x;this.y-=p.y;this.z-=p.z;return this;}
  }
  const reference={name:'Test',aspect:1,mesh:{updateWorldMatrix(){},localToWorld:p=>p}};
  const defaults={width:0.16,depth:0.24,taperCurve:[{t:0,value:1},{t:1,value:0}],sweepProfile:[{x:1,y:0}]};
  const original=structuredClone(defaults),events=[];
  let created;
  const state=vm.createContext({
    structuredClone,referenceCurveSource:reference,referenceImages:[reference],
    normalizeReferenceCrop:()=>({left:0,right:1,top:0,bottom:1}),
    referencePlaneCropCenterPoint:()=>({x:0,y:0,z:0}),referencePlanePointFromCropCoordinate,
    hairGroup:{updateWorldMatrix(){},worldToLocal:p=>p},THREE:{Vector3},
    strandCreationDefaults:defaults,
    pushUndoState(){events.push('undo');},
    addLock(preset,data){events.push('create');created={id:'created',...data};return created;},
    selectLock(id){events.push(id);},updateCount(){events.push('count');}
  });
  vm.runInContext(clone,state);
  const confirm=vm.runInContext(`({${method}}).onConfirm`,state);
  confirm([{x:0.5,y:0.1},{x:0.5,y:0.5},{x:0.5,y:0.9}]);
  assert.deepEqual(events,['undo','create','created','count']);
  assert.equal(created.name,'Test Curve');
  assert.equal(created.width,defaults.width);
  assert.equal(created.points.length,3);
  assert.equal(created.rootAttachmentEnabled,false);
  created.taperCurve[0].value=0.2;
  created.sweepProfile[0].x=2;
  assert.deepEqual(defaults,original,'Editing the new strand cannot modify Draw Strand defaults');
});
