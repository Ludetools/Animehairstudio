import test from 'node:test';
import assert from 'node:assert/strict';
import { editingContextLabel, meshOperationReasons, singleTargetMarqueeSelection, selectionScopeLabel } from '../modules/editing-context.js';
test('single-target marquee preserves unmatched selection and subtracts only matches', () => {
  assert.equal(singleTargetMarqueeSelection(1, [2], 'remove'), 1);
  assert.equal(singleTargetMarqueeSelection(1, [1,2], 'remove'), null);
  assert.equal(singleTargetMarqueeSelection(1, [], 'add'), 1);
  assert.equal(singleTargetMarqueeSelection(null, [2], 'add'), 2);
  assert.equal(singleTargetMarqueeSelection(1, [], 'replace'), null);
});
test('selection scope distinguishes group settings, multi-selection and links', () => {
  assert.match(selectionScopeLabel({group:'bangs',count:5}), /5 existing strands.*Group settings/);
  assert.match(selectionScopeLabel({count:2,linked:1,mirror:true}), /2 selected objects.*1 with mirror links.*on/);
  assert.match(selectionScopeLabel({count:1,name:'Fringe'}), /^Fringe/);
});
test('editing context distinguishes component mode, transform axes and applicable mirror state', () => {
  assert.equal(editingContextLabel({workspace:'mesh', meshMode:'edge', transformSpace:'object', mirror:true}), 'Meshes / Edges · Object axes · X mirror on');
  assert.equal(editingContextLabel({workspace:'strand', selectionMode:'component', transformSpace:'world', mirror:false}), 'Strands / Component · World axes');
  assert.equal(editingContextLabel({workspace:'reference', selectionMode:'component', transformSpace:'world', mirror:true}), 'References / Object · World axes');
});
test('mesh tool explanations follow the current enablement predicates', () => {
  assert.match(meshOperationReasons(0,true,true).bevel, /Select/);
  assert.match(meshOperationReasons(1,true,true).bridge, /exactly two/);
  assert.match(meshOperationReasons(2,true,false).bridge, /open boundary/);
  assert.deepEqual(meshOperationReasons(2,true,true), {bevel:'',bridge:'',flow:''});
  assert.match(meshOperationReasons(2,false,true).bevel, /procedural extrusions/);
  assert.equal(meshOperationReasons(2,false,true).flow, '');
});
