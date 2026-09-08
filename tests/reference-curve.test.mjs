import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {traceReferenceCurve} from '../modules/reference-curve.js';

const polygon=[{x:0.3,y:0.05},{x:0.7,y:0.05},{x:0.7,y:0.8},{x:0.5,y:0.95},{x:0.3,y:0.8}];
test('Reference center tracing is deterministic, ordered root to tip, and does not mutate the mask',()=>{
  const before=JSON.stringify(polygon), root={x:0.5,y:0.08}, tip={x:0.5,y:0.9};
  const path=traceReferenceCurve(polygon,root,tip);
  assert.deepEqual(traceReferenceCurve(polygon,root,tip),path);
  assert.ok(path.length>=2 && path.length<=100);
  assert.ok(path[0].y<0.1 && path.at(-1).y>0.88);
  assert.ok(path.every(p=>Math.abs(p.x-0.5)<0.04));
  assert.equal(JSON.stringify(polygon),before);
});
test('Reference center tracing follows a bent selection rather than taking a shortcut through background',()=>{
  const bent=[{x:0.1,y:0.1},{x:0.9,y:0.1},{x:0.9,y:0.9},{x:0.7,y:0.9},{x:0.7,y:0.3},{x:0.1,y:0.3}];
  const path=traceReferenceCurve(bent,{x:0.14,y:0.2},{x:0.8,y:0.86});
  assert.ok(path.length>2);
  assert.ok(path.every(p=>p.y<=0.31 || p.x>=0.69));
});
test('Reference tracing rejects missing masks, outside anchors, and coincident endpoints',()=>{
  assert.throws(()=>traceReferenceCurve([],{},{}),/Outline/);
  assert.throws(()=>traceReferenceCurve(polygon,{x:0,y:0},{x:0.5,y:0.9}),/inside/);
  assert.throws(()=>traceReferenceCurve(polygon,{x:0.5,y:0.5},{x:0.5,y:0.5}),/farther apart/);
});
test('Reference tracing stays isolated behind a plane-only modal and ordinary strand creation',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for(const id of ['referenceCurveDialog','referenceCurveCanvas','referenceCurveConfirm','referenceCurveCancel','traceReferenceCurve']){
    assert.equal(html.split(`id="${id}"`).length-1,1);
  }
  assert.match(app,/traceReferenceCurve"\)\.disabled = drawingPanel \|\| reference\.type !== "plane"/);
  const integration=app.slice(app.indexOf('const referenceCurveDialog ='),app.indexOf('function requestReferenceImage(type)'));
  assert.match(integration,/onConfirm\(path\)[\s\S]*pushUndoState\(\);[\s\S]*addLock\("front"/);
  assert.match(integration,/rootAttachmentEnabled: false, layerOffsetApplied: true/);
  assert.match(integration,/hairGroup\.worldToLocal\(reference\.mesh\.localToWorld/);
});
