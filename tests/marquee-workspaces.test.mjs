import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { singleTargetMarqueeSelection } from '../modules/editing-context.js';
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('function selectObjectsInMarquee(drag) {'), app.indexOf('\nfunction finishSelectionMarquee'));
for (const workspace of ['guide', 'reference']) test(`${workspace} marquee executes removal and empty addition without replacing selection`, () => {
  const context = {
    viewportEditMode: workspace, selectedGuideId: 1, selectedReferenceImageId: 1,
    guides: [{id:1,mesh:{visible:true}}], referenceImages:[{id:1,type:'plane',mesh:{visible:true}}],
    referencesVisible:true, singleTargetMarqueeSelection,
    renderer:{domElement:{getBoundingClientRect:()=>({})}}, strandWorkspaceActive:()=>false,
    objectInsideSelectionMarquee:()=>false,
    selectGuide:id=>{context.selectedGuideId=id;}, selectReferenceImage:id=>{context.selectedReferenceImageId=id;},
  };
  vm.createContext(context); vm.runInContext(source,context);
  const drag = {startX:0,startY:0,currentX:10,currentY:10,selectionMode:'remove'};
  context.selectObjectsInMarquee(drag);
  const key = workspace === 'guide' ? 'selectedGuideId' : 'selectedReferenceImageId';
  assert.equal(context[key],1);
  context.selectObjectsInMarquee({...drag,selectionMode:'add'});
  assert.equal(context[key],1);
  context.objectInsideSelectionMarquee=()=>true;
  context.selectObjectsInMarquee(drag);
  assert.equal(context[key],null);
});
