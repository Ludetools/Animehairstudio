import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('1.0 patch notes cover the expanded release in the 0.1.5 style without an updating section', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const notes=readFileSync(new URL('../docs/RELEASE_NOTES_1.0.0.md',import.meta.url),'utf8');
  const panel=html.slice(html.indexOf('data-patch-notes-panel="1.0.0"')).split('</article>')[0];
  for(const heading of ['New features','UI changes','Tweaks and quality of life','Bug fixes']) {
    assert.ok(panel.includes(`<h3>${heading}</h3>`));
    assert.ok(notes.includes(`## ${heading}`));
  }
  assert.match(panel, /<strong>Curve Lattice Meshes<\/strong><br \/>/);
  assert.doesNotMatch(panel, /Before updating/);
  assert.doesNotMatch(notes, /## Compatibility and limitations|## Version-update contract/);
  for(const feature of ['Curve Normal Repair','Green Backface Debug View','Experimental Reference-to-Curve Tool','Experimental Accessory Brush Builder','Attached Glass Panel Style','Better Tool Settings Placement','Clearer Selection Feedback']) {
    assert.ok(panel.includes(`<strong>${feature}</strong>`));
    assert.ok(notes.includes(`**${feature}**`));
  }
  assert.match(html, /data-patch-notes-panel="0\.1\.5"/);
  for(const feature of ["Grease Pencil","Reference Shape Tool","Mesh Editing Workspace","Mesh Primitives","Poly Brush","Curve-Driven Face Extrusion","Standard Face Extrusion","Loop Cut and Edge Operations","Back Hair Mesh and Connected Strand Shell","Draw Capsule Guide","Adaptive Remeshing","Pattern Types and Sections"]) {
    assert.ok(panel.includes('<strong>'+feature+'</strong>'));
    assert.ok(notes.includes('**'+feature+'**'));
  }
});
