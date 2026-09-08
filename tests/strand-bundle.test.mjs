import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStrandBundle, strandBundleTemplate, ponytailBundleRecipe } from '../modules/strand-bundle.js';

test('release point is opt-in, bounded, persistent and changes only the released portion', () => {
  assert.equal(normalizeStrandBundle().medium.release,null);
  assert.equal(normalizeStrandBundle({medium:{release:9}}).medium.release,.95);
  const recipe=normalizeStrandBundle({variation:0,medium:{count:1,release:.5,flare:0,curl:0},flyaway:{count:0}});
  assert.deepEqual(normalizeStrandBundle(JSON.parse(JSON.stringify(recipe))),recipe);
  const attached=strandBundleTemplate(recipe).strands[1];
  recipe.medium.flare=1;
  const released=strandBundleTemplate(recipe).strands[1];
  assert.deepEqual(attached.points.slice(0,9),released.points.slice(0,9));
  assert.ok(released.points.at(-1)[0]>attached.points.at(-1)[0]+.9);
  assert.equal(released.settings.taperCurve.at(-1).value,0);
});

test('ponytail medium locks reach the real unit-radius surface, with tucked roots and staggered tips', () => {
  const recipe=ponytailBundleRecipe();
  recipe.flyaway.count=4; // The starter disables detail while keeping it available.
  const strands=strandBundleTemplate(recipe).strands;
  const medium=strands.slice(1,1+recipe.medium.count);
  assert.ok(medium.every(s=>s.settings.taperCurve[0].value<s.settings.taperCurve[2].value));
  assert.equal(new Set(medium.map(s=>s.pathParameters.at(-1))).size,recipe.medium.count);
  assert.ok(medium.every(s=>Math.hypot(s.points[4][0],s.points[4][2]/recipe.depth)>.6));
  for(const s of strands.slice(1)) assert.equal(s.settings.taperCurve.at(-1).value,0);
  for(const s of strands.slice(1+recipe.medium.count,1+recipe.medium.count+recipe.flyaway.count)) assert.equal(s.settings.taperCurve[0].value,0);
});

test('chunky accents persist, remain independent of random layers and can oppose the main flow', () => {
  const recipe=ponytailBundleRecipe();
  assert.deepEqual(normalizeStrandBundle().accents,[]);
  assert.deepEqual(normalizeStrandBundle({accents:'invalid'}).accents,[]);
  assert.deepEqual(normalizeStrandBundle(JSON.parse(JSON.stringify(recipe))),recipe);
  const a=strandBundleTemplate(recipe).strands.slice(-2);
  assert.ok(a[0].points.at(-1)[1]>a[0].points[0][1]);
  assert.ok(a[1].points.at(-1)[1]<a[1].points[0][1]);
  recipe.seed=999;recipe.medium.count=0;
  assert.deepEqual(strandBundleTemplate(recipe).strands.slice(-2),a);
  for(const strand of a) {
    assert.ok(strand.points.flat().every(Number.isFinite));
    assert.equal(new Set(strand.pathParameters).size,1);
    assert.equal(strand.settings.taperCurve.at(-1).value,0);
  }
  assert.equal(normalizeStrandBundle({accents:Array(20).fill(null)}).accents.length,8);
});

test('released strands remain finite at boundary settings and deterministic across seeds', () => {
  for(const release of [0,.5,.95]) for(const seed of [0,12,2147483647]) {
    const recipe={seed,variation:1,medium:{release,count:24,flare:2,follow:0},flyaway:{release,count:24,flare:2,follow:1}};
    const a=strandBundleTemplate(recipe);
    assert.deepEqual(a,strandBundleTemplate(recipe));
    assert.ok(a.strands.every(s=>s.points.flat().every(Number.isFinite)));
  }
});
test('main width and depth curves persist independently and drive surface following', () => {
  const recipe=normalizeStrandBundle({variation:0,medium:{count:4,follow:1,flare:0,curl:0},flyaway:{count:0}});
  const before=strandBundleTemplate(recipe);
  recipe.widthCurve[4].value=1.8;
  recipe.depthCurve[4].value=.2;
  const restored=normalizeStrandBundle(JSON.parse(JSON.stringify(recipe)));
  assert.deepEqual(restored,recipe);
  const after=strandBundleTemplate(restored);
  assert.equal(after.strands[0].settings.taperCurve[4].value,1.8);
  assert.equal(after.strands[0].settings.depthCurve[4].value,.2);
  assert.deepEqual(after.strands[1].settings.taperCurve,before.strands[1].settings.taperCurve);
  assert.ok(after.strands[1].points[8][0]>before.strands[1].points[8][0]);
  assert.ok(after.strands[2].points[8][2]<before.strands[2].points[8][2]);
  assert.equal(normalizeStrandBundle({widthCurve:'bad'}).widthCurve.length,9);
});
test('bundle recipe is seeded, bounded and independent between layers', () => {
  const a=strandBundleTemplate({seed:42});
  assert.deepEqual(a,strandBundleTemplate({seed:42}));
  assert.notDeepEqual(a,strandBundleTemplate({seed:43}));
  const changed=strandBundleTemplate({seed:42,flyaway:{count:2}});
  assert.deepEqual(a.strands.slice(0,7),changed.strands.slice(0,7));
  assert.equal(strandBundleTemplate({medium:{count:0},flyaway:{count:0}}).strands.length,1);
  assert.equal(normalizeStrandBundle({medium:{count:999}}).medium.count,24);
  assert.doesNotThrow(()=>normalizeStrandBundle(null));
});
test('bundle geometry retains a straight main axis and explicit partial-length path parameters', () => {
  for(const seed of [0,1,2147483647]) {
    const template=strandBundleTemplate({seed,variation:1});
    assert.deepEqual(template.strands[0].points,[[0,0,0],[0,-.5,0],[0,-1,0]]);
    for(const strand of template.strands.slice(1)) {
      assert.equal(strand.radialOffset,undefined);
      assert.equal(strand.points.length,strand.pathParameters.length);
      assert.ok(strand.width>0 && strand.depth>0);
      strand.points.forEach((p,i)=>{
        assert.ok(p.every(Number.isFinite));
        assert.equal(-p[1],strand.pathParameters[i]);
        assert.ok(strand.pathParameters[i]>=0 && strand.pathParameters[i]<=1);
        if(i) assert.ok(strand.pathParameters[i]>strand.pathParameters[i-1]);
      });
    }
    assert.ok(template.strands.at(-1).pathParameters.at(-1)<1);
  }
});
test('surface following and tip freedom remain independent, with fixed roots', () => {
  const options={variation:0,medium:{count:1,start:0,flare:0,curl:0},flyaway:{count:0}};
  const a=strandBundleTemplate(options).strands[1];
  const b=strandBundleTemplate({...options,medium:{...options.medium,flare:1}}).strands[1];
  assert.deepEqual(a.points[0],b.points[0]);
  assert.ok(Math.hypot(...b.points.at(-1).filter((_,i)=>i!==1))>Math.hypot(...a.points.at(-1).filter((_,i)=>i!==1)));
});
