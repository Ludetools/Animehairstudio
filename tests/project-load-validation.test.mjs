import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHairProject} from '../modules/project-schema.js';
const project=locks=>({format:'anime-hair-studio-project',version:1,state:{locks,guides:[]}});
test('project validation rejects malformed nested geometry before restoration',()=>{
  for(const lock of [null,{points:{}},{points:[{x:0,y:0,z:Infinity}]},{points:[{x:0,y:0,z:0}],polyFaces:[[0,1,2]]}])assert.throws(()=>validateHairProject(project([lock])));
});
test('valid legacy envelopes and n-gon records survive preflight without mutation',()=>{
  assert.ok(validateHairProject(project([])));
  const p=project([{points:Array.from({length:5},(_,i)=>({x:i,y:0,z:0})),polyFaces:[[0,1,2,3,4]]}]);
  const before=JSON.stringify(p);assert.equal(validateHairProject(p),p);assert.equal(JSON.stringify(p),before);
});
