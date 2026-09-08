import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { bundlePreviewPaths } from '../modules/bundle-preview.js';
import { ponytailBundleRecipe, normalizeStrandBundle, strandBundleTemplate } from '../modules/strand-bundle.js';

test('bundle preview provides equal-length finite straight and curved strokes without changing recipe data', () => {
  const paths = bundlePreviewPaths('compare');
  assert.deepEqual(paths.map(p => p.kind), ['straight','curved']);
  for (const { points } of paths) {
    assert.equal(points.length,17);
    assert.ok(points.flat().every(Number.isFinite));
    const length = points.slice(1).reduce((sum,p,i) => sum + Math.hypot(...p.map((v,a)=>v-points[i][a])),0);
    assert.ok(Math.abs(length-2.8)<1e-10);
    assert.ok(points.every((p,i)=>!i || p[1]<points[i-1][1]));
  }
  assert.equal(new Set(paths[0].points.map(p=>p[0])).size,1);
  assert.ok(new Set(paths[1].points.map(p=>p[0])).size>8);
  assert.equal(bundlePreviewPaths('invalid')[0].kind,'straight');
  assert.equal(bundlePreviewPaths('curved').length,1);
});

test('ponytail starter preserves the large form with four subordinate locks and no flyaways', () => {
  const recipe=ponytailBundleRecipe();
  assert.deepEqual(normalizeStrandBundle(JSON.parse(JSON.stringify(recipe))),recipe);
  const template=strandBundleTemplate(recipe);
  assert.equal(template.strands.length,7);
  assert.equal(recipe.flyaway.count,0);
  assert.ok(recipe.medium.width<=.25);
  assert.ok(recipe.medium.release>=.7);
  assert.ok(recipe.medium.flare<=.1);
  // Preserve near-round volume through the body without widening its silhouette.
  assert.equal(recipe.width,.34);
  for (const i of [1,2,3,4,5,6]) {
    const depthRatio=recipe.depth*recipe.depthCurve[i].value/recipe.widthCurve[i].value;
    assert.ok(depthRatio>=.9 && depthRatio<=1);
  }
  assert.notDeepEqual(recipe.widthCurve,recipe.depthCurve);
  assert.equal(recipe.widthCurve.at(-1).value,0);
  assert.ok(recipe.widthCurve[2].value>recipe.widthCurve[0].value);
  assert.deepEqual(template,strandBundleTemplate(ponytailBundleRecipe()));
  recipe.flyaway.count=4;
  assert.deepEqual(strandBundleTemplate(recipe).strands.slice(0,5),template.strands.slice(0,5));
  recipe.widthCurve[0].value=2;
  assert.equal(ponytailBundleRecipe().widthCurve[0].value,.2);
});

test('production bundle preview rebuild handles compare, single view, legacy and exit without authored locks', () => {
  const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const controller=source.match(/function rebuildBrushWorkspacePreview\([^]*?\n\}/)[0];
  const created=[],mapped=[];
  class Vector3 { constructor(x,y,z){Object.assign(this,{x,y,z});} }
  const context={viewportEditMode:'brush',brushWorkspaceStyle:'accessory',brushWorkspacePreviewFrame:1,
    disposeBrushWorkspacePreview:()=>{created.length=0;},drawToolSizeInput:{value:1},
    creationPresetSnapshot:()=>({width:.3,depth:.2,lengthSegments:16}),brushWorkspaceCreationDefaults:{},
    bundleRecipeEnabled:{checked:true},bundleRecipeEditor:{getRecipe:ponytailBundleRecipe},
    bundlePreviewMode:{value:'compare'},bundlePreviewPaths,strandBundleTemplate,THREE:{Vector3},
    drawClumpStrandMaps:(samples,width,template)=>{mapped.push({samples,width,template});return template.strands.map(()=>({points:samples.map(s=>s.point)}));},
    brushWorkspaceForwardNormals:points=>points.map(()=>new Vector3(0,0,1)),activeHairMaterialId:'hair',DEFAULT_HAIR_LAYER:'mid',
    proceduralBrushTopologySegments:n=>n,curvePolylineLength:()=>2.8,
    addLock:(region,options,meta)=>{const lock={mesh:{},options,meta};created.push(lock);return lock;},
    brushWorkspacePreviewGroup:{add:()=>{},visible:false},requestShadowMapRefresh:()=>{},
    brushWorkspaceAccessoryParentVisibleInput:{checked:false},brushWorkspaceAccessoryCountInput:{value:1},brushWorkspaceAccessoryRadiusInput:{value:1},
    proceduralAccessoryTemplateData:()=>({strands:[{points:[[0,0,0],[0,-1,0]]}]}),
  };
  vm.runInNewContext(controller,context);
  context.rebuildBrushWorkspacePreview();
  assert.equal(created.length,14);
  assert.equal(mapped.length,2);
  assert.equal(new Set(created.map(p=>p.meta.id)).size,14);
  assert.ok(created.every(p=>p.meta.transient));
  assert.deepEqual(mapped[0].template,mapped[1].template);
  context.bundlePreviewMode.value='curved';context.rebuildBrushWorkspacePreview();
  assert.equal(created.length,7);
  context.bundleRecipeEnabled.checked=false;context.rebuildBrushWorkspacePreview();
  assert.equal(created.length,1);assert.equal(created[0].mesh.visible,false);
  context.viewportEditMode='strand';context.rebuildBrushWorkspacePreview();
  assert.equal(created.length,1);
});

test('bundle preview controls are scoped to the accessory builder and do not enter saved recipe state', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert.match(html, /id="brushWorkspaceAccessorySettings"[^]*?id="loadPonytailBundleRecipe"[^]*?id="bundlePreviewModeRow"[^>]*hidden[^]*?id="bundlePreviewMode"/);
  assert.match(source,/querySelector\('#bundlePreviewModeRow'\).hidden = !bundleRecipeEnabled.checked/);
  assert.match(source,/bundleRecipeEditor.setRecipe\(ponytailBundleRecipe\(\)\)/);
  assert.equal(normalizeStrandBundle({previewMode:'compare'}).previewMode,undefined);
});
