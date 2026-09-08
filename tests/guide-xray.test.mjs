import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('guide points share strand radius and display size preference',()=>{
  const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  for(const name of ['createCurveLatticeHandles','createCapsuleGuideHandles']){
    const start=source.indexOf(`function ${name}(`);
    const body=source.slice(start,source.indexOf('\nfunction ',start+1));
    assert.match(body,/SphereGeometry\(0\.052 \* STRAND_CONTROL_POINT_RADIUS_SCALE/);
    assert.match(body,/handle.scale.setScalar\(controlPointDisplaySize\)/);
  }
  const start=source.indexOf('function setControlPointDisplaySize(');
  const body=source.slice(start,source.indexOf('\nfunction ',start+1));
  assert.match(body,/guides.forEach[\s\S]*handlesGroup\?\.children.forEach\(handle => handle.scale.setScalar\(controlPointDisplaySize\)\)/);
});

test('selected guide xray preserves original depth and ordering on deselection',()=>{
  const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const context=vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('function setGuideSelectionXray('),source.indexOf('function selectGuide(')),context);
  const material={depthTest:true,depthWrite:true};
  const mesh={material,renderOrder:3,userData:{},traverse(fn){fn(this);}};
  const guide={mesh};
  context.setGuideSelectionXray(guide,true);
  context.setGuideSelectionXray(guide,true);
  assert.equal(material.depthTest,false);assert.equal(material.depthWrite,false);assert.equal(mesh.renderOrder,100);
  context.setGuideSelectionXray(guide,false);
  assert.equal(material.depthTest,true);assert.equal(material.depthWrite,true);assert.equal(mesh.renderOrder,3);
  assert.equal(mesh.userData.guideXrayOriginal,undefined);
  assert.match(source,/const selected = item.id === id;\s*setGuideSelectionXray\(item, selected\)/);
  assert.match(source,/function resetGuideSelectionVisuals\(\) \{\s*guides.forEach\(\(guide\) => \{\s*setGuideSelectionXray\(guide, false\)/);
});
