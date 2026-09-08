import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('outliner visual refresh preserves hierarchy states and adds scoped selection and focus styling', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.outliner-tab\s*\{[^}]*border-radius: 5px 5px 0 0/);
  assert.doesNotMatch(css, /\.outliner-panel \.outliner-tab\.active\s*\{/);
  assert.match(css, /\.outliner-scroll-content\s*\{[^}]*min-height: 0;[^}]*overflow: auto;/);
  assert.doesNotMatch(css, /\.outliner-panel \.outliner-tabs\s*\{/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="toggleOutlinerPanel"[^]*?<\/button>\s*<div class="outliner-scroll-content">/);
  for (const selector of ['.outliner-tab', '.attribute-editor-tabs button']) {
    const block = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
    assert.ok(block.includes('height: 27px;'));
    assert.ok(block.includes('padding: 0 4px;'));
    assert.ok(block.includes('font-size: 12px;'));
  }
  assert.match(css, /\.outliner-panel button:focus-visible\s*\{[^}]*outline:/);
  assert.match(css, /\.outliner-panel :is\(\.drop-target, \.region-drop-target\)[^}]*dashed/);
  for (const [parent, child] of [['group', 'group-items'], ['layer', 'layer-items'], ['clump', 'clump-children']]) {
    assert.ok(css.includes(`.outliner-${parent}.open > .outliner-${child}`));
  }
  assert.match(css, /body\.outliner-folder-colors-disabled \.outliner-group/);
  assert.match(css, /\.outliner-visibility-toggle\.visible\s*\{\s*color: #e6e6ea/);
});

test('outliner flat rows remove strand swatches and keep badges on the name line', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.outliner-panel :is\(\.swatch, \.outliner-group-swatch, \.outliner-layer-swatch\)\s*\{\s*display: none/);
  assert.match(css, /\.outliner-panel :is\(\.outliner-group-items, \.outliner-layer-items, \.outliner-clump-children\)\s*\{[^}]*margin-left: 0;[^}]*padding-left: 0;[^}]*border-left: 0/);
  assert.match(css, /\.outliner-panel \.outliner-group > \.outliner-group-items\s*\{\s*margin-left: 12px;/);
  assert.match(css, /\.outliner-panel \.lock-item\s*\{\s*display: flex;\s*flex-wrap: nowrap/);
  assert.match(css, /\.outliner-panel \.lock-item > \.clump-guide-badge\s*\{[^}]*flex: 0 0 auto;[^}]*white-space: nowrap/);
});

test('clump and remesh folders default closed and selection does not force remesh expansion', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /const isOpen = clumpOpen\.get\(guide\.clumpId\) === true;/);
  assert.match(app, /const isOpen = autoRemeshOpen\.get\(result\.id\) === true;/);
  assert.match(app, /autoRemeshOpen\.set\(output\.id, false\)/);
  assert.match(app, /autoRemeshOpen\.set\(result\.id, !isOpen\)/);
});
