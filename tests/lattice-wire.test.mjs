import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('open lattice topology overlays render both reflected and original faces; closed meshes retain culling', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('function createHairTopologyOverlay('), app.indexOf('function groupDefaultsFor('));
  const context = {
    THREE: {
      Mesh: class { constructor(geometry, material) { Object.assign(this,{geometry,material}); } },
      ShaderMaterial: class { constructor(options) { Object.assign(this,options); } },
      Color: class {}, FrontSide:0, DoubleSide:2
    },
    createHairTopologyGeometry:geometry=>geometry,
    hairTopologyVisible:true,
    syncBranchKnifeOverlay() {}
  };
  vm.createContext(context);vm.runInContext(source,context);
  for (const openSurface of [true,false,undefined]) {
    const overlay=context.createHairTopologyOverlay({userData:{openSurface}});
    assert.equal(overlay.material.side,openSurface?2:0);
    assert.equal(overlay.material.depthTest,true);
    assert.equal(overlay.material.depthWrite,false);
    assert.equal(overlay.visible,true);
  }
});
