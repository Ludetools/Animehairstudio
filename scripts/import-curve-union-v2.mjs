// Mechanical, dependency-closed import. Usage: node scripts/import-curve-union-v2.mjs <strandremesh-directory>
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Linter } from 'eslint';
const root = process.argv[2];
if (!root) throw new Error('Supply the Strand Remesh source directory.');
const version = Number(process.argv[3] || 2);
if (![1, 2, 3].includes(version)) throw new Error('Version must be 1, 2 or 3.');
const entry = version === 1 ? 'unionSweeps' : `curveUnionV${version}`;
const files = ['core.js', 'curve-union-v2.js', 'curve-union-v3.js'].slice(0, version);
const sources = files.map(file => fs.readFileSync(path.join(root, file), 'utf8'));
const source = sources.join('\n');
let code;
new Linter().verify(source, { languageOptions: { sourceType: 'script' },
  plugins: { extract: { rules: { capture: { create(context) {
    return { 'Program:exit'() { code = context.sourceCode; } };
  } } } } }, rules: { 'extract/capture': 'error' }
});
if (!code) throw new Error('Unable to parse upstream sources.');
const scope = code.scopeManager.globalScope;
const declarations = new Map();
for (const variable of scope.variables) {
  const def = variable.defs[0];
  if (def) declarations.set(variable.name, def.type === 'Variable' ? def.parent : def.node);
}
const selected = new Set();
function include(name) {
  const node = declarations.get(name);
  if (!node || selected.has(node)) return;
  selected.add(node);
  for (const variable of scope.variables) {
    if (variable.references.some(ref => ref.identifier.range[0] >= node.range[0] && ref.identifier.range[1] <= node.range[1])) include(variable.name);
  }
}
include(entry);
if (!selected.size) throw new Error(`Missing ${entry} entry point.`);
const manifest = files.map((file,i) => `${file}: ${createHash('sha256').update(sources[i]).digest('hex')}`).join('\n// ');
const result = `// Imported Curve Union ${version}.0 dependency closure; do not hand-edit.\n// ${manifest}\n`
  + 'export function createCurveUnionRuntime() {\n'
  + 'const requestAnimationFrame = callback => setTimeout(callback, 0);\n'
  + [...selected].sort((a,b) => a.range[0]-b.range[0]).map(node => code.getText(node)).join('\n\n')
  + `\n\nreturn ${entry};\n}\nexport const curveUnionV${version} = createCurveUnionRuntime();\n`;
fs.writeFileSync(`modules/curve-union-v${version}.js`, result);
console.log(`Imported ${selected.size} declarations (${result.length} characters).`);
