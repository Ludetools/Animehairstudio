import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const extract=name=>source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0];
const button=()=>({hidden:false,classList:{toggle(){}},setAttribute(){}});
test('accessory dev gate hides both entries and leaves active tools safely without deleting objects',()=>{
  const tab=button(),saved=[];
  const c={showDevTestFeatures:false,proceduralDrawExperimentalEnabled:false,
    proceduralDrawExperimentalPreferenceInput:{},proceduralDrawToolButton:button(),
    document:{querySelectorAll:()=>[tab]},activeTool:'procedural-draw',brushWorkspaceStyle:'accessory',
    setActiveTool:value=>{c.activeTool=value;},setBrushWorkspaceStyle:value=>{c.brushWorkspaceStyle=value;},
    saveBooleanPreference:(...v)=>saved.push(v),PROCEDURAL_DRAW_EXPERIMENTAL_PREFERENCE_KEY:'existing-key'};
  vm.runInNewContext(extract('setProceduralDrawExperimentalEnabled'),c);
  c.setProceduralDrawExperimentalEnabled(true,{persist:false});
  assert.equal(tab.hidden,true);assert.equal(c.activeTool,'select');assert.equal(c.brushWorkspaceStyle,'pattern');
  assert.equal(saved.length,0);
  c.showDevTestFeatures=true;c.setProceduralDrawExperimentalEnabled(true);
  assert.equal(tab.hidden,false);assert.equal(c.proceduralDrawToolButton.hidden,false);
  c.setProceduralDrawExperimentalEnabled(false);
  assert.equal(tab.hidden,true);assert.equal(c.proceduralDrawToolButton.hidden,true);
});
test('accessory direct builder and tool entry are guarded and preference starts off',()=>{
  const c={showDevTestFeatures:false,proceduralDrawExperimentalEnabled:true,brushWorkspaceStyle:'pattern'};
  vm.runInNewContext(extract('setBrushWorkspaceStyle'),c);
  c.setBrushWorkspaceStyle('accessory');assert.equal(c.brushWorkspaceStyle,'pattern');
  assert.match(source,/tool === "procedural-draw" && \(!showDevTestFeatures \|\| !proceduralDrawExperimentalEnabled\)/);
  assert.match(source,/let proceduralDrawExperimentalEnabled = readStoredBooleanPreference\([\s\S]*?PROCEDURAL_DRAW_EXPERIMENTAL_PREFERENCE_KEY,\s*false/);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/data-brush-workspace-style="accessory"[^>]*hidden/);
  assert.match(html,/<strong>Accessory Brushes<\/strong>/);
});
