import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('Modelling toolbar icons share vector metrics and Dynamic retains accessible toggle state',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 for(const name of ['loop-cut','poly-brush','ortho','multi-cam','capsule-guide','curve-lattice-guide','draw-capsule-guide','dynamic-surface','face-extrude','standard-extrude']) {
  const svg=readFileSync(new URL(`../assets/icons/${name}.svg`,import.meta.url),'utf8');
  assert.match(svg,/viewBox="0 0 24 24"/);
  assert.match(svg,name==='dynamic-surface'?/stroke-width="2"/:/stroke-width="1.5"/);
  assert.ok(css.includes(`assets/icons/${name}.svg`));
 }
 assert.match(html,/id="drawSurfaceDynamic"[^>]*aria-pressed="true"[^>]*aria-label="Dynamic live surface"/);
 const dynamicSvg=readFileSync(new URL('../assets/icons/dynamic-surface.svg',import.meta.url),'utf8');
 assert.equal((dynamicSvg.match(/<path\b/g)||[]).length,2,'Dynamic uses only a surface line and departure arrow at toolbar size');
 assert.match(dynamicSvg,/M3 19h8/);
 assert.match(dynamicSvg,/m-6 0h6v6/);
 assert.doesNotMatch(dynamicSvg,/<(?:circle|rect|line|polygon)\b|opacity=/);
 assert.match(css,/#drawSurfaceDynamic\s*\{[^}]*width: 36px/);
 for(const id of ['drawCapsuleGuideMode','viewportDrawCapsuleGuideTool'])assert.match(html,new RegExp(`id="${id}"[^>]*><span class="tool-icon icon-draw-capsule-guide"`));
});
