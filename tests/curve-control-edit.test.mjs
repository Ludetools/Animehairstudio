import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createInputEditSession} from '../modules/input-edit-session.js';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const extract=name=>source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0];

function fixture() {
  let lock={id:'one',points:[{},{}],curvePointSharpness:[0,0],curvePointBevel:true,curvePointBevelApexFlow:1};
  let captures=0, mirrors=0;
  const c={activeTool:'curve-sharpness',curveSharpnessSliderEdit:null,curvePointBevelApexFlowEdit:null,cancelledInputDrag:null,
    curvePointSharpnessInput:{value:'0'},curvePointBevelApexFlowInput:{value:'1'},selectedId:'one',
    get locks(){return [lock];},selectedCurveSharpnessTarget:()=>({lock,pointIndex:1}),selectedCurveSharpnessLock:()=>lock,
    normalizeCurvePointSharpness:values=>[...values],
    THREE:{MathUtils:{clamp:(v,min,max)=>Math.min(max,Math.max(min,v))}},
    beginAdaptiveRemeshSourceEdit(){},finishAdaptiveRemeshSourceEdit(){},flushPendingLockGeometryUpdates(){},
    syncInputs(){},syncCurveSharpnessControl(){},updateCurveObjects(){},updateLockGeometry(){},syncActiveMirror(){mirrors++;},
    setCurvePointSharpness(target,index,value){target.curvePointSharpness[index]=value;mirrors++;return true;}
  };
  c.inputEditSession=createInputEditSession({capture(){captures++;return JSON.stringify(lock);},restore(saved){lock=JSON.parse(saved);c.curveSharpnessSliderEdit=null;c.curvePointBevelApexFlowEdit=null;}});
  vm.createContext(c);
  for(const name of ['beginCurveSharpnessSliderEdit','updateCurveSharpnessSliderEdit','finishCurveSharpnessSliderEdit','beginCurvePointBevelApexFlowEdit','updateCurvePointBevelApexFlowEdit','finishCurvePointBevelApexFlowEdit']) vm.runInContext(extract(name),c);
  return {c,get lock(){return lock;},get captures(){return captures;},get mirrors(){return mirrors;}};
}

test('sharpness slider captures actual changes once, cancels and starts a fresh edit',()=>{
  const f=fixture(),c=f.c;
  c.beginCurveSharpnessSliderEdit();c.updateCurveSharpnessSliderEdit();assert.equal(f.captures,0);
  c.curvePointSharpnessInput.value='.3';c.updateCurveSharpnessSliderEdit();
  c.curvePointSharpnessInput.value='.7';c.updateCurveSharpnessSliderEdit();assert.equal(f.captures,1);
  assert.equal(f.lock.curvePointSharpness[1],.7);assert.equal(f.mirrors,2);
  c.inputEditSession.cancel(c.curvePointSharpnessInput);assert.equal(f.lock.curvePointSharpness[1],0);
  c.cancelledInputDrag=c.curvePointSharpnessInput;c.updateCurveSharpnessSliderEdit();assert.equal(f.captures,1);
  c.cancelledInputDrag=null;c.updateCurveSharpnessSliderEdit();assert.equal(f.captures,2);
  c.finishCurveSharpnessSliderEdit();assert.equal(c.inputEditSession.cancel(),null);
});

test('bevel flow groups updates, restores cancellation and rejects unavailable settings',()=>{
  const f=fixture(),c=f.c;
  c.updateCurvePointBevelApexFlowEdit();assert.equal(f.captures,0);
  c.curvePointBevelApexFlowInput.value='.4';c.updateCurvePointBevelApexFlowEdit();
  c.curvePointBevelApexFlowInput.value='.2';c.updateCurvePointBevelApexFlowEdit();assert.equal(f.captures,1);
  assert.equal(f.mirrors,2);c.inputEditSession.cancel(c.curvePointBevelApexFlowInput);
  assert.equal(f.lock.curvePointBevelApexFlow,1);
  f.lock.curvePointBevel=false;c.updateCurvePointBevelApexFlowEdit();assert.equal(f.captures,1);
  f.lock.curvePointBevel=true;f.lock.curvePointBevelRemoveApex=true;c.updateCurvePointBevelApexFlowEdit();assert.equal(f.captures,1);
  f.lock.curvePointBevelRemoveApex=false;c.updateCurvePointBevelApexFlowEdit();c.finishCurvePointBevelApexFlowEdit();
  assert.equal(f.captures,2);assert.equal(c.inputEditSession.cancel(),null);
  assert.match(extract('resetTransientInteractionsForStateRestore'),/curveSharpnessSliderEdit = null;\s*curvePointBevelApexFlowEdit = null;/);
});

test('mesh bevel replaces the mistaken curve tool and lives outside the main operations panel',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/data-tool="curve-bevel"|curveBevelToolSettings/);
  assert.doesNotMatch(source,/curve-bevel/);
  assert.match(html,/id="meshBevelTool"/);
  assert.match(html,/id="meshBevelDialog"[\s\S]*id="meshBevelWidth"/);
  // Rendering and popup placement are boundary doubles; opening must invoke
  // both without modifying the selected mesh.
  const c={viewportEditMode:'mesh',selectedMeshEdgeOperationContext:()=>({edges:[[1,2]],lock:{mesh:{visible:true}}}),meshTopologyOperationAllowed:()=>true,meshBevelButton:{},
    cancelMeshBevelPreview(){},inputEditSession:{finish(){}},updateMeshBevelPreview(){c.previewed=true;},positionMeshBevelSettings(){c.positioned=true;},
    document:{querySelector:()=>({show(){c.opened=true;}})}};
  vm.runInNewContext(extract('openMeshBevelDialog'),c);
  assert.equal(c.openMeshBevelDialog(),true);assert.equal(c.opened,true);
  assert.equal(c.previewed,true);assert.equal(c.positioned,true);
  c.opened=false;c.viewportEditMode='strand';assert.equal(c.openMeshBevelDialog(),false);assert.equal(c.opened,false);
});
