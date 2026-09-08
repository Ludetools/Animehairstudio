import nodeAssert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("strand lattice radial entries reuse selection eligibility and creation dialog", async () => {
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  for (const kind of ['clump', 'selection']) {
    const start = source.indexOf(`if (kind === "${kind}") {`);
    const section = source.slice(start, source.indexOf('\n  if (kind ===', start + 1));
    assert.match(section, /selectedStrandLatticeSources\(\)\.length\s*\? \[\{ action: "open-strand-lattice", label: "Create Strand Lattice", list: true \}\]/);
  }
  assert.match(source, /if \(action === "open-strand-lattice"\) return openStrandLatticeDialog\(\);/);
});

test("green backface debug is gated on creation and selection refresh", async () => {
  const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/id="toggleBackfaceDebug"[^>]*aria-pressed="false"/);
  assert.match(html,/id="fixCurveNormals"/);
  assert.match(source,/overlay.visible = meshBackfaceDebugEnabled/);
  assert.doesNotMatch(source,/backfaceDebugOverlay.visible = !lock.proceduralParentHidden/);
});

test("bundle recipe shares preview and stroke templates without enabling legacy regeneration", async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(html, /id="bundleRecipeEnabled"/);
  assert.match(html, /id="bundleRecipeEditor" hidden/);
  assert.match(source, /if \(settings.bundle\) return strandBundleTemplate\(settings.bundle\)/);
  assert.match(source, /const template = bundle \? strandBundleTemplate\(bundleRecipeEditor.getRecipe\(\)\)/);
  assert.match(source, /const bundleMaps = bundle \? drawClumpStrandMaps/);
  assert.match(source, /proceduralDraw: drawingGeneratedGuide && !accessoryBrushSettings\?\.bundle/);
  assert.match(source, /\(template.proceduralBrush \|\| template.bundle\)/);
});


test("selected tools and shortcut badges use the blue highlight", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.tool-button.active \{\s*border-color: #63c7ff;\s*background: #1d3040;\s*color: #a8e1ff;/);
  assert.match(css, /\.tool-button.active kbd \{\s*border-color: #63c7ff;\s*color: #a8e1ff;/);
  assert.match(css, /:is\(\.viewport-display-actions, \.viewport-modes\) > button.active \{\s*border-color: #63c7ff;\s*background: #1d3040;\s*color: #a8e1ff;/);
});

test("slim attribute sliders retain a comfortable hit area and visible focus", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const prefix = ':is(.tool-panel .attribute-editor-content, .floating-tool-settings-panel) input[type="range"]';
  const block = suffix => css.slice(css.indexOf(prefix + suffix + ' {')).split('}')[0];
  assert.ok(block('').includes('height: 28px;'));
  for (const track of ['::-webkit-slider-runnable-track', '::-moz-range-track']) assert.ok(block(track).includes('height: 3px;'));
  for (const thumb of ['::-webkit-slider-thumb', '::-moz-range-thumb']) {
    assert.ok(block(thumb).includes('width: 10px;'));
    assert.ok(block(thumb).includes('height: 10px;'));
    assert.ok(block(thumb).includes('background: var(--slider-accent);'));
  }
  assert.ok(block(':focus-visible').includes('outline: 1px solid'));
  assert.ok(block(':disabled').includes('opacity: .4;'));
});

test("attribute and hold-key settings share grey sliders and blue active toggles", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /:is\(\.tool-panel \.attribute-editor-content, \.floating-tool-settings-panel\) input\[type="range"\] \{\s*--slider-accent: #dedbe3;\s*accent-color: var\(--slider-accent\);/);
  assert.match(css, /\.toggle-row input:checked \{\s*background: #63c7ff4d;/);
  assert.match(css, /\.toggle-row input:checked::after \{\s*transform: translateX\(18px\);\s*background: #63c7ff;/);
  assert.match(css, /\.transform-space-setting \.segmented-control button.active \{\s*background: #1d3040;\s*color: #63c7ff;/);
  assert.match(css, /\.toggle-row input:focus-visible/);
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(source, /floatingToolSettingsPanel\.append\(panel\)/);
  assert.match(source, /attributeSliderRanges\.forEach\(syncSliderFill\)/);
});

test("attribute controls share dimensions and stack labels in narrow panels", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const start = css.indexOf('/* Consistent attribute-editor controls;');
  const controls = css.slice(start, css.indexOf('/* Shared flat panel tabs;', start));
  assert.ok(start >= 0);
  assert.match(controls, /--setting-height: 28px;/);
  assert.match(controls, /--setting-label-width: 104px;/);
  assert.match(controls, /grid-template-columns: 64px minmax\(0, 1fr\) var\(--setting-height\)/);
  assert.match(controls, /@container attribute-controls \(max-width: 300px\)/);
  assert.match(controls, /grid-template-columns: minmax\(0, 1fr\); gap: 4px;/);
  assert.match(controls, /font-variant-numeric: tabular-nums;/);
  assert.doesNotMatch(controls, /display:|pointer-events:/);
});

test("panel chrome shows expand tabs only and preserves capture during drag collapse", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /body \.sidebar-collapse-toggle\[aria-expanded="true"\] \{ display: none !important;/);
  assert.match(css, /body\.panel-resizing \.studio-shell :is\(\.outliner-panel, \.tool-panel\) > \.panel-resize-handle \{\s*display: block !important; pointer-events: auto;/);
});

test("panel tabs share a flat neutral strip without changing scrolling or selection", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const shared = 'body .studio-shell :is(.outliner-panel, .tool-panel) :is(.outliner-tabs, .attribute-editor-tabs)';
  const strip = css.slice(css.indexOf(shared + ' {')).split('}')[0];
  const tab = css.slice(css.indexOf(shared + ' > button[role="tab"] {')).split('}')[0];
  const active = css.slice(css.indexOf(shared + ' > button[role="tab"].active::after {')).split('}')[0];
  assert.ok(strip.includes('flex: 0 0 auto;'));
  assert.ok(strip.includes('gap: 0;'));
  for (const rule of ['height: 38px;', 'min-height: 38px;', 'border: 0;', 'border-radius: 0;', 'background: transparent;', 'box-shadow: none;']) assert.ok(tab.includes(rule), rule);
  assert.ok(active.includes('height: 2px;'));
  assert.ok(active.includes('background: #c7c3cd;'));
  assert.match(css, /\.outliner-scroll-content\s*\{[^}]*overflow: auto;/);
  assert.match(css, /\.attribute-editor-content\s*\{[^}]*overflow: auto;/);
});

test("shortcut reference uses readable columns and wrapping key groups", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(html, /class="shortcuts-sections">\s*<div class="shortcut-reference-columns">/);
  assert.match(css, /\.shortcut-reference-columns \{ columns: 2;/);
  assert.match(css, /@media \(max-width: 720px\) \{\s*\.shortcut-reference-columns \{ columns: 1;/);
  assert.match(css, /#shortcutsDialog \.shortcut-key-group \{ flex-wrap: wrap; white-space: normal;/);
  assert.match(css, /#shortcutsDialog \.shortcuts-section \{\s*break-inside: avoid;/);
  assert.match(css, /#shortcutsDialog \.shortcut-row > kbd \{ justify-self: start;/);
});

test("collapsed desktop panels leave only tiny edge tabs without full height rails", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /compact-outliner-collapsed \{ --left-panel-space: 0px;/);
  assert.match(css, /compact-attribute-collapsed \{ --right-panel-space: 0px;/);
  assert.match(css, /compact-attribute-collapsed \.tool-panel \{\s*width: 0; min-width: 0; height: 48px;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none; backdrop-filter: none; overflow: visible; pointer-events: none;/);
  assert.match(css, /compact-outliner-collapsed #toggleOutlinerPanel \{\s*left: 0; right: auto; pointer-events: auto;/);
  assert.match(css, /compact-attribute-collapsed #toggleAttributeEditorPanel \{\s*right: 0; left: auto; pointer-events: auto;/);
});

test("panel collapse notches sit outside tabs at the middle of the inner edges", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  for (const id of ["toggleOutlinerPanel", "toggleAttributeEditorPanel"]) {
    assert.match(html, new RegExp(`</div>\\s*<button id="${id}"`));
    assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
  }
  assert.match(css, /position: absolute; top: 50%; transform: translateY\(-50%\)/);
  assert.match(css, /body \.outliner-panel > \.sidebar-collapse-toggle \{ right: 0;/);
  assert.match(css, /body \.tool-panel > \.sidebar-collapse-toggle \{ left: 0;/);
  assert.match(css, /body \.sidebar-collapse-toggle > span \{ display: none;/);
  assert.match(css, /\.compact-outliner-collapsed \.outliner-panel > :not\(\.sidebar-collapse-toggle\)/);
  assert.match(css, /\.compact-attribute-collapsed \.tool-panel > :not\(\.sidebar-collapse-toggle\)/);
});
import { contractPatternMatches } from "./helpers/contract-match.mjs";

test("startup splash includes a small muted LudeTools credit", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  nodeAssert.match(html, /<p class="startup-credit">LudeTools 2026<\/p>/);
  nodeAssert.match(css, /\.startup-credit\s*\{[^}]*font-size: 11px;[^}]*text-align: right/);
});

test("startup splash uses fading decorative strand wireframe without tagline", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  nodeAssert.doesNotMatch(html, /Your next hairstyle starts here|startup-tagline/);
  nodeAssert.match(html, /class="startup-strand-wire"[^>]*aria-hidden="true"[^>]*focusable="false"/);
  nodeAssert.match(html, /id="startupStrandFade"/);
  nodeAssert.match(html, /offset="1"[^>]*stop-opacity="0"/);
  nodeAssert.match(css, /\.startup-strand-wire\s*\{[^}]*pointer-events: none/);
  nodeAssert.match(css, /\.startup-splash-card\s*\{[^}]*z-index: 1/);
});

test("startup splash is a bounded centered panel rather than a fullscreen cover", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const rule = css.match(/#startupSplash\s*\{([^}]+)\}/)[1];
  nodeAssert.match(rule, /top: 50%; left: 50%; transform: translate\(-50%, -50%\)/);
  nodeAssert.match(rule, /width: min\(428px, calc\(100vw - 32px\)\)/);
  nodeAssert.match(rule, /max-height: calc\(100vh - 32px\)/);
  nodeAssert.doesNotMatch(rule, /inset:\s*0/);
});

const assert = Object.create(nodeAssert);
assert.match = (actual, pattern, message) => {
  nodeAssert.equal(contractPatternMatches(actual, pattern), true, message || `Expected input to match ${pattern}`);
};
assert.doesNotMatch = (actual, pattern, message) => {
  nodeAssert.equal(contractPatternMatches(actual, pattern), false, message || `Expected input not to match ${pattern}`);
};

let settingsContractSourcesPromise;
function settingsContractSources() {
  settingsContractSourcesPromise ||= Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../modules/app-config.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/preference-storage.js", import.meta.url), "utf8")
  ]).then(([html, source, css, localization, packageSource, configSource, preferenceStorageSource]) => ({
    html,
    source,
    css,
    localization,
    packageSource,
    configSource,
    preferenceStorageSource
  }));
  return settingsContractSourcesPromise;
}

test("top menu bar has refined styling and accessible open and focus states", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /\.app-topbar::before/);
  assert.match(css, /\.app-topbar\s*\{[^}]*background: linear-gradient\(to bottom,[^}]*color-mix\(in srgb, var\(--glass-panel-color, #0b0a0e\) 73%, transparent\) 100%\);[^}]*backdrop-filter: blur\(14px\) saturate\(72%\);/);
  assert.doesNotMatch(css, /\.app-topbar::after/);
  assert.match(css, /\.app-topbar\s*\{\s*--app-menu-font-size: 14px;/);
  assert.match(css, /\.app-menu-trigger\s*\{[^}]*font-size: var\(--app-menu-font-size\);[^}]*font-weight: 550/);
  assert.match(css, /\.app-menu-dropdown button\s*\{[^}]*font-size: var\(--app-menu-font-size\);/);
  assert.match(css, /--app-menu-text-color: #d8d8de;/);
  assert.match(css, /\.app-topbar \.app-menu-trigger,\s*\.app-topbar \.app-menu-dropdown button,\s*\.app-topbar \.app-menu-dropdown span,\s*\.app-topbar \.app-menu-dropdown kbd\s*\{\s*color: var\(--app-menu-text-color\);/);
  assert.match(css, /\.app-menu-trigger\[aria-expanded="true"\]\s*\{\s*border-color: #4c4650;\s*background: #29262d;\s*box-shadow: none;/);
  assert.match(css, /\.app-menu-trigger:focus-visible\s*\{[^}]*outline: 1px solid/);
});

test("outliner folders use a white vector outline instead of the teal block", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const svg = await readFile(new URL("../assets/outliner-folder.svg", import.meta.url), "utf8");
  assert.match(css, /\.outliner-folder-icon\s*\{[^}]*background: #f0f0f3;[^}]*mask: url\("\.\/assets\/outliner-folder\.svg"\)/);
  assert.doesNotMatch(css, /\.outliner-folder-icon::before/);
  assert.match(svg, /viewBox="0 0 24 24" fill="none"/);
});

test("layer-only header bands inherit region colour and respect folder colour preferences", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.outliner-layer-head::before\s*\{[^}]*inset: 4px 0;/);
  assert.match(css, /\.outliner-panel \[data-strand-group\] \.outliner-layer-head::before\s*\{[^}]*pointer-events: none;[^}]*var\(--outliner-region-color\) var\(--outliner-folder-group-line-mix, 24%\)/);
  assert.match(css, /body\.outliner-folder-colors-disabled \.outliner-panel \[data-strand-group\] \.outliner-layer-head::before\s*\{\s*background: rgb\(220 220 230 \/ 8%\);/);
  assert.doesNotMatch(css, /:is\(\.outliner-group-head, \.outliner-layer-head\)::before/);
  assert.match(css, /var\(--outliner-region-color\) var\(--outliner-folder-background-mix, 11%\), transparent/);
});

test("outliner strand rows use compact heights including visibility controls and clump children", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.outliner-panel \.lock-item\s*\{\s*display: flex;[^}]*min-height: 24px;[^}]*padding-top: 1px;/);
  assert.match(css, /\.outliner-panel \.lock-item-shell > \.outliner-visibility-toggle\s*\{\s*min-height: 24px;/);
  assert.match(css, /\.outliner-panel \.lock-item-shell\.clump-child \.lock-item\s*\{\s*min-height: 24px;/);
});

test("outliner folder disclosure switches closed and open icons without duplicating the label icon", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.outliner-panel \.outliner-clump-disclosure\s*\{[^}]*font-size: 0;[^}]*transform: none/);
  assert.match(css, /\.outliner-clump-disclosure\[aria-expanded="true"\]::before\s*\{[^}]*outliner-folder-open\.svg/);
  assert.match(css, /\.outliner-panel \.outliner-clump-select > \.outliner-folder-icon\s*\{ display: none; \}/);
  assert.match(await readFile(new URL("../assets/outliner-folder-open.svg", import.meta.url), "utf8"), /viewBox="0 0 24 24"/);
});

test("static JavaScript control references exist in the HTML", async () => {
  const [html, source, favicon] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../favicon.svg", import.meta.url), "utf8")
  ]);
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\.\/favicon\.svg\?v=20260830-2" \/>/);
  assert.match(favicon, /<svg[^>]*viewBox="0 0 512 512"[\s\S]*color="#63c7ff"/);
  assert.doesNotMatch(favicon, /#57aeff/i);
  const htmlIds = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  const duplicates = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], [], "HTML IDs must be unique");
  const idSet = new Set(htmlIds);
  const referencedIds = [...source.matchAll(/querySelector\(["']#([A-Za-z0-9_-]+)["']\)/g)].map((match) => match[1]);
  const optionalControls = new Set(["curveLatticeToggle"]);
  const missing = [...new Set(referencedIds.filter((id) => !idSet.has(id) && !optionalControls.has(id)))];
  assert.deepEqual(missing, [], `Missing controls: ${missing.join(", ")}`);
});

test("the default cyan accent is replaced by sky blue across UI and viewport helpers", async () => {
  const [source, css, favicon] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../favicon.svg", import.meta.url), "utf8")
  ]);

  assert.match(source, /const UI_ACCENT_COLOR = 0x63c7ff/);
  assert.match(css, /#63c7ff/);
  assert.match(favicon, /color="#63c7ff"/);
  assert.doesNotMatch(source, /0x58f6ff/);
  assert.doesNotMatch(css, /#58f6ff/);
  assert.doesNotMatch(css, /#(?:17363a|18333b|183137|152327|24373a|58dbe3|6cdde5|74edf3|75e8ef|8ff9ff|8bfbff|9eeff4)/i);
  assert.doesNotMatch(css, /rgba\(88,\s*246,\s*255,/);
  assert.doesNotMatch(favicon, /#58f6ff/);
});

test("lattice settings hidden state has an effective CSS rule", async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(css, /#strandLatticeSettings\.hidden\s*\{\s*display:\s*none;/);
  assert.match(source, /querySelector\('#strandLatticeSettings'\)\.classList\.toggle\('hidden', !editingLattice\)/);
});

test("viewport chrome attaches flush to title bar without expanding collapsed panels", async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.viewport-top-controls \.viewport-display-actions > button,[\s\S]*?border-top-left-radius: 0 !important;\s*border-top-right-radius: 0 !important;/);
  for (const name of ['viewport-top-controls', 'viewport-edit-mode']) {
    assert.match(css, new RegExp(`\\.${name} \\{[^}]*top: 0;`));
  }
  assert.match(css, /glass-side-panels:not\(\.compact-outliner-collapsed\) \.outliner-panel,[\s\S]*align-self: start;[\s\S]*height: calc\(100% - 10px\)/);
});

test("attached viewport controls omit only the top highlight", async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.viewport-edit-mode,\s*\.viewport-top-controls \.tool-button,[\s\S]*?\.viewport-top-controls \.viewport-draw-settings > label\s*\{\s*border-top-color: transparent !important;\s*box-shadow: 0 8px 24px #0000004d;/);
  assert.match(css, /height: calc\(100% - 10px\);\s*border-top-color: transparent;/);
});

test("performance box matches viewport glass styling", async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.viewport-stats\s*\{[^}]*border: 1px solid #ffffff18;\s*border-radius: 7px;\s*background: color-mix\(in srgb, var\(--glass-panel-color, #0b0a0e\) 73%, transparent\);\s*box-shadow: 0 8px 24px #0000004d;\s*backdrop-filter: blur\(14px\) saturate\(72%\);/);
});

test("desktop scene extends beneath title bar while viewport chrome stays below menus", async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(css, /&\.compact-sidebar-docked \.studio-shell > \.viewport-panel\s*\{\s*grid-row: 1 \/ -1;/);
  assert.match(css, /\.viewport-panel > :is\(\.viewport-top-controls, \.viewport-edit-mode\)\s*\{\s*top: var\(--viewport-title-inset\)/);
  assert.match(source, /function resize\(\) \{\s*const \{ clientWidth, clientHeight \} = viewport;/);
  assert.doesNotMatch(css, /\.app-topbar::after/);
});

test("user-facing English follows the application spelling conventions", async () => {
  const [html, source, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);
  const usVariants = "Color|Colors|Colored|Neighbor|Neighbors|Neighboring|Behavior|Modeling";
  assert.doesNotMatch(html, new RegExp(`>\\s*[^<>]*\\b(?:${usVariants})\\b`, "i"));
  assert.doesNotMatch(html, new RegExp(`(?:title|aria-label|data-patch-notes-summary)="[^"]*\\b(?:${usVariants})\\b`, "i"));
  assert.doesNotMatch(localization, new RegExp(`^\\s*"[^"]*\\b(?:${usVariants})\\b[^"]*"\\s*:`, "im"));
  assert.match(html, />Colour</);
  assert.match(html, />Center</);
  assert.doesNotMatch(html, /\bCentre(?:d)?\b/);
  assert.match(html, /Neighbour Segments/);
  assert.match(html, /Modelling tools/);
  assert.match(source, /"Show default hair colour"[\s\S]*"Show strand group colours"/);
});

test("curve surface tool exposes incremental strip controls and confirmation flow", async () => {
  const [html, source, css, projectState] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/project-state.js", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(html, /data-tool="curve-surface"[^>]*title="Draw Curve Surface"/);
  assert.match(html, /id="curveSurfaceToolPanel"/);
  assert.match(html, /id="curveSurfaceStripWidth"/);
  assert.doesNotMatch(html, /id="curveSurfaceThickness"/);
  assert.doesNotMatch(html, /id="curveSurfaceSurface"/);
  assert.match(html, /id="drawStrandSurface"/);
  assert.match(html, /id="confirmCurveSurfaceDraft"[^>]*disabled[^>]*>Confirm Shape</);
  assert.match(html, /id="resetCurveSurfaceDraft"/);
  assert.match(source, /function beginCurveSurfaceStroke\(event, hit\)/);
  assert.match(html, /Hold Shift to constrain a curve to eight directions while it conforms to the live surface/);
  assert.match(source, /function curveSurfaceStrokeEvent\(stroke, event\)[\s\S]*eightWayScreenDelta\([\s\S]*cardinalDirectionKey/);
  assert.match(source, /function updateCurveSurfaceStroke\(event\)[\s\S]*curveSurfaceStrokeEvent\(stroke, event\)[\s\S]*drawSurfaceHitFromEvent\(sampleEvent\)/);
  assert.match(source, /function updateCurveSurfacePreview\(\)/);
  assert.match(source, /function unifiedMirroredCurveSurface\(controllerCurves, controllerNormals = \[\], sourceCenterIndex = 0\)/);
  assert.match(source, /const unifiedPreview = unifiedMirroredCurveSurface\(grid\.orderedCurves, \[\], previewCenterIndex\)/);
  assert.match(source, /if \(activeTool === "curve-surface"\) updateCurveSurfacePreview\(\)/);
      assert.match(source, /function confirmCurveSurfaceDraft\(\)/);
      assert.match(source, /function curveSurfaceFallbackHit\([\s\S]*surfaceMode = activeStrokeSurfaceValue\(\)[\s\S]*dynamic = activeStrokeDynamicEnabled\(surfaceMode\)/);
      assert.match(source, /renderer\.domElement\.addEventListener\("pointerup", finishCurveSurfaceStroke, true\)/);
      assert.match(source, /event\.key === "Enter" && activeTool === "curve-surface" && commitCurveSurfaceDraft\(event\)/);
  assert.match(source, /function commitCurveSurfaceDraft\(event = null\)[\s\S]*finishCurveSurfaceStroke\(event\)[\s\S]*confirmCurveSurfaceDraft\(\)/);
  assert.match(source, /confirmCurveSurfaceDraftButton\.addEventListener\("click"/);
  assert.match(source, /document\.activeElement\.blur\?\.\(\)/);
  assert.match(source, /curveSurfaceDraft\.curves\.push\(points\)/);
  assert.match(source, /const confirmedControlRows = curveSurfaceControlPointCount\(grid\.orderedCurves\)[\s\S]*resampleCurveSurfaceLine\(curve, confirmedControlRows\)[\s\S]*curveSurfaceColumns: controllerCurves\.length[\s\S]*curveSurfaceRows: confirmedControlRows[\s\S]*points: controllerPoints/);
  assert.match(source, /function curveSurfaceProfileNormals\(samples\)[\s\S]*sample\.onSurface[\s\S]*strokeSurfaceNormals/);
  assert.match(source, /orderedSourceIndices = grid\.sourceColumns[\s\S]*authoredControllerNormals = orderedSourceIndices\.map[\s\S]*drawClumpSampleNormal[\s\S]*pointSurfaceNormals: controllerNormals\.flat\(\)/);
  assert.match(source, /const renderRows = THREE\.MathUtils\.clamp\([\s\S]*Number\(lock\.lengthSegments\)[\s\S]*geometry\.userData\.actualLengthSegments = Math\.max\(0, grid\.rows - 1\)/);
  assert.match(source, /candidateGrid\.rejectedCurveIndices\.includes\(candidateIndex\)/);
  assert.match(source, /lock\.curveSurfaceSource = \{[\s\S]*controllerCurves\.map\(\(curve, index\)[\s\S]*attachment:[\s\S]*column: index/);
  assert.match(source, /const unifiedSurface = unifiedMirroredCurveSurface\([\s\S]*authoredControllerCurves,[\s\S]*authoredControllerNormals,[\s\S]*sourceCenterIndex[\s\S]*curveSurfaceColumns: controllerCurves\.length/);
  assert.doesNotMatch(source, /function confirmCurveSurfaceDraft\(\)[\s\S]*createMirrorPartnerForNewLock\(lock\)/);
  assert.match(source, /const midlineAligned = event\.shiftKey && Math\.abs\(event\.clientX - viewportMidlineX\) <= 6/);
  assert.match(source, /curveSurfaceSymmetric: mirrorXEditing/);
  assert.match(source, /function syncUnifiedCurveSurfaceMirror\(lock, sourcePointIndex, tool = activeTool\)/);
  assert.match(source, /curveSurfaceMirroredPointIndex\(lock, index\)[\s\S]*lock\.points\[mirroredIndex\]\.set\(-point\.x, point\.y, point\.z\)/);
  assert.match(source, /curveSurfaceSymmetric: lock\.geometryType === "curve-surface" && Boolean\(lock\.curveSurfaceSymmetric\)/);
  assert.match(source, /curveSurfaceSymmetric: snapshot\.geometryType === "curve-surface" && Boolean\(snapshot\.curveSurfaceSymmetric\)/);
  assert.match(source, /curveSurfaceSource: curveSurfaceSourceForSnapshot\(lock\)/);
  assert.match(source, /curveSurfaceSource: cloneCurveSurfaceSource\(snapshot\.curveSurfaceSource\)/);
  assert.match(source, /function createConnectedCurveCardGeometry\(lock\)[\s\S]*geometry\.userData\.quadFaces = quadFaces[\s\S]*geometry\.userData\.openSurface = true/);
  assert.match(source, /lock\.geometryType === "curve-surface"[\s\S]*curveSurfaceControllerCurves\(lock\)/);
  assert.match(source, /function createOutlinerCurveSurface\(lock\)[\s\S]*outliner-curve-surface[\s\S]*Curve \$\{controllerIndex \+ 1\}[\s\S]*curveSurfaceControllerIndex: controllerIndex/);
  assert.match(source, /function activeCurveSurfaceControllerIndex\(lock\)[\s\S]*selectedCurveSurfaceController/);
  assert.match(source, /activeCurveSurfaceControllerIndex\(lock\)[\s\S]*curveSurfacePointVisible\(lock, index, controllerIndex\)/);
  assert.match(source, /function curveSurfaceControllerHitFromEvent\(event, lock = getSelectedLock\(\)\)[\s\S]*raycaster\.intersectObject\(lock\.curveObjects\.line, false\)[\s\S]*curveSurfaceControllerIndexNearPoint/);
  assert.match(source, /curveSurfaceControllerHitFromEvent\(event[\s\S]*curveSurfaceControllerIndex: curveSurfaceControllerHit\.controllerIndex/);
  assert.match(source, /curveSurfaceControllerSegments\(\s*lock\s*\)/);
  assert.match(source, /function sampledCurveSurfaceControllerSides\(lock, rowCount\)[\s\S]*strandGeometryFrameAt\(controllerLock, curve[\s\S]*frame\.x\.clone\(\)\.negate\(\)/);
  assert.match(source, /function curveSurfaceControllerFrameLock\(lock, controllerIndex[\s\S]*curveSurfaceControllerSideDirections\(controllerCurves, side\)[\s\S]*crossVectors\(tangent, localSide\)[\s\S]*pointSurfaceNormals: controllerNormals,[\s\S]*surfaceNormalInfluence: 1/);
  assert.match(source, /buildConnectedCurveCardGrid\(controllers,[\s\S]*controllerSides/);
  assert.match(source, /function curveFrameAtPoint\(lock, pointIndex\)[\s\S]*curveSurfaceControllerFrameLock\(lock, controllerIndex\)[\s\S]*transportedStrandFrameAt/);
  assert.match(source, /unsupportedCurveSurfaceTool[\s\S]*\["scale", "relax"\]\.includes\(tool\)/);
  assert.match(source, /componentEditModeActive\(\)[\s\S]*controllerVisible[\s\S]*lock\.id === selectedId[\s\S]*\["rotate", "relax"\]\.includes\(activeTool\)/);
  assert.match(source, /createProjectSelectionSnapshot\(\{[\s\S]*selectedCurveSurfaceController/);
  assert.match(projectState, /selectedCurveSurfaceController: cloneOptionalRecord\(selectedCurveSurfaceController\)/);
  assert.match(css, /\.outliner-curve-surface \.outliner-folder-icon[\s\S]*\.curve-surface-controller-icon/);
});

test("full body mesh import is available in File and Edit Head with seven-head scalp-top fitting", async () => {
  const [html, source, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="importFullBodyMeshMenu"[^>]*role="menuitem"[\s\S]*Import Full Body Mesh/);
  assert.match(html, /id="fullBodyMeshFile"[^>]*accept="\.obj,model\/obj,text\/plain"/);
  assert.match(html, /id="headPanel"[\s\S]*id="importFullBodyMesh"[\s\S]*Import Full Body Mesh/);
  assert.match(source, /const FULL_BODY_HEAD_COUNT = 7/);
  assert.match(source, /const FULL_BODY_TARGET_HEIGHT = GUIDE_HEAD_TARGET_HEIGHT \* FULL_BODY_HEAD_COUNT/);
  assert.match(source, /const FULL_BODY_FRAME_BOTTOM_MARGIN = GUIDE_HEAD_TARGET_HEIGHT \* 0\.9/);
  assert.match(
    source,
    /function installGuideModel\(obj, options = \{\}\)[\s\S]*fullBody \? size\.y[\s\S]*FULL_BODY_TARGET_HEIGHT \/ sourceSize[\s\S]*scalpBounds\.max\.y - \(size\.y \* scale \* 0\.5\)/
  );
  assert.match(source, /fit: "full-body"/);
  assert.match(source, /project\.headAsset\.fit === "full-body"/);
  assert.match(source, /await restoreState\(project\.state\);[\s\S]*realignFullBodyGuideToScalpTop\(\)/);
  assert.match(
    source,
    /function restoreAuthoredScalpForStateRestore[\s\S]*authoredScalpRestorePromise = ensureEditedScalpSurface\(\)\.then[\s\S]*return authoredScalpRestorePromise;[\s\S]*function restoreState[\s\S]*authoredScalpRestorePromise = restoreAuthoredScalpForStateRestore[\s\S]*return authoredScalpRestorePromise;/
  );
  assert.match(
    source,
    /function fullBodyScalpFocusBounds\(\)[\s\S]*activeScalpSurfaceMesh\(\)[\s\S]*bounds\.min\.y -= FULL_BODY_FRAME_BOTTOM_MARGIN/
  );
  assert.match(
    source,
    /await restoreState\(project\.state\);[\s\S]*realignFullBodyGuideToScalpTop\(\);[\s\S]*frameViewportBounds\(fullBodyScalpFocusBounds\(\)\)/
  );
  assert.match(
    source,
    /function cycleViewportFraming\(\) \{[\s\S]*fullBodyReference[\s\S]*frameViewportBounds\(fullBodyScalpFocusBounds\(\)\)/
  );
  assert.match(source, /importFullBodyMeshMenu\.addEventListener\("click"/);
  assert.match(source, /fullBodyMeshFileInput\.addEventListener\("change"/);
  assert.match(localization, /"Import Full Body Mesh":/);
});

test("Preview menu exposes a transient turntable with contextual speed controls", async () => {
  const [html, source, styles] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="previewMenuToggle"[\s\S]*>Preview<\/button>/);
  assert.match(html, /id="toggleTurntable"[\s\S]*aria-pressed="false"[\s\S]*>[\s\S]*Turntable/);
  assert.match(html, /id="turntablePanel"[^>]*data-attribute-panel="tools"/);
  assert.match(html, /id="turntableSpeed"[^>]*min="0\.1"[^>]*max="3"[^>]*value="1"/);
  assert.match(source, /function setTurntableActive\(enabled\)[\s\S]*turntablePanel\.classList\.toggle\("hidden", !turntableActive\)/);
  assert.match(source, /TURNTABLE_RADIANS_PER_SECOND \* turntableSpeed \* deltaSeconds/);
  assert.match(source, /turntableActive && !altOrbitDrag && !viewSnapDrag/);
  assert.doesNotMatch(source, /turntableActive[\s\S]{0,100}(?:captureState|restoreState|createHairProject)/);
  assert.match(styles, /#turntablePanel\.hidden,[\s\S]*#strandShapePanel\.hidden/);
});

test("strand selection modifiers add with Ctrl and remove with Shift", async () => {
  const [source, selectionState] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/selection-state.js", import.meta.url), "utf8")
  ]);

  assert.match(
    selectionState,
    /selectionMode === "add" \|\| selectionMode === "remove"[\s\S]*selectionMode === "remove"[\s\S]*nextIds\.delete\(id\)[\s\S]*nextIds\.add\(id\)/
  );
  assert.match(
    source,
    /event\.ctrlKey && !event\.shiftKey && !event\.altKey[\s\S]*\? "add"[\s\S]*event\.shiftKey && !event\.ctrlKey && !event\.altKey[\s\S]*\? "remove"/
  );
  assert.match(
    source,
    /const addingSelection = event\.ctrlKey[\s\S]*const removingSelection = event\.shiftKey[\s\S]*beginSelectionMarquee\(event, selectedSurface, addingSelection \? "add" : "remove"\)/
  );
  assert.match(
    source,
    /function beginSelectionMarquee\(event, surface = null, selectionMode = "replace"\)[\s\S]*selectionMode === "add"[\s\S]*selectionMode === "remove"[\s\S]*selectionMode,/
  );
  assert.match(source, /function selectPointsInMarquee\(drag\)[\s\S]*drag\.selectionMode === "add"[\s\S]*drag\.selectionMode === "remove"/);
  assert.match(
    source,
    /function selectObjectsInMarquee\(drag\)[\s\S]*requestedId: matches\[0\]\.id,[\s\S]*requestedIds: matches\.map[\s\S]*selectionMode: drag\.selectionMode/
  );
  assert.doesNotMatch(source, /toggleSelection/);
});

test("strand selection refreshes derived consumers through one coordinator", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(
    source,
    /function refreshStrandSelectionConsumers\(\{[\s\S]*updateGeometry = false[\s\S]*updateTopology = false[\s\S]*syncActiveInputs = false[\s\S]*resetGuideSelectionVisuals\(\)[\s\S]*updateStrandSelectionHighlight\(\)[\s\S]*refreshStrandCurveSelectionVisuals\(\)[\s\S]*transformControls\.detach\(\)[\s\S]*updateLockGeometry\(item\)[\s\S]*renderLockList\(\)[\s\S]*updateAttributeEditorMode\(\)[\s\S]*updateGuideControlsVisibility\(\)[\s\S]*updateSelectedPointLabel\(\)[\s\S]*updateTopologyStats\(\)[\s\S]*refreshRebuildCurveDialog\(\)[\s\S]*rebuildProceduralDuplicatePreview\(\{ updateSources: true \}\)[\s\S]*syncInputs\(lock\)/
  );
  assert.match(
    source,
    /function refreshStrandCurveSelectionVisuals\(\)[\s\S]*strandWorkspaceActive\(\)[\s\S]*!componentEditModeActive\(\)[\s\S]*!sculptBrushToolActive\(\)[\s\S]*lock\.curveObjects\?\.group[\s\S]*group\.visible = false[\s\S]*updateCurveObjects\(item, \{ visible: item\.id === selectedId \}\)/
  );
  assert.match(
    source,
    /function selectLock\(id, options = \{\}\)[\s\S]*refreshStrandSelectionConsumers\(\{\s*syncActiveInputs: true\s*\}\)/
  );
  assert.doesNotMatch(source, /function selectLock\(id, options = \{\}\)[\s\S]*?refreshStrandSelectionConsumers\(\{[\s\S]*?updateGeometry: true/);
  assert.match(
    source,
    /function deselectStrands\(\)[\s\S]*refreshStrandSelectionConsumers\(\{ updateTopology: true \}\)/
  );
});

test("strand locks persist and block viewport selection, transforms, and sculpt editing", async () => {
  const [html, source, registry] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/shortcut-registry.js", import.meta.url), "utf8")
  ]);

  assert.match(source, /function strandAvailableForViewportInteraction\(lock\) \{[\s\S]*strandVisibleForDisplay\(lock\) && !lock\.locked/);
  assert.match(source, /function selectObjectsInMarquee\(drag\)[\s\S]*strandAvailableForViewportInteraction\(lock\)/);
  assert.match(source, /locks\.filter\(strandAvailableForViewportInteraction\)\.map\(\(lock\) => lock\.mesh\)/);
  assert.match(source, /function attachStrandObjectTransform\(\)[\s\S]*\|\| lock\.locked/);
  assert.match(source, /function sculptBrushEditableLock\(lock\)[\s\S]*&& !lock\.locked/);
  assert.match(source, /name: lock\.name,[\s\S]*locked: Boolean\(lock\.locked\)[\s\S]*function restoreLock\(snapshot,[\s\S]*locked: Boolean\(snapshot\.locked\)/);
  assert.match(source, /function lockStrands\(targets\)[\s\S]*pushUndoState\(\)[\s\S]*lock\.locked = true[\s\S]*deselectStrands\(\)/);
  assert.match(source, /function lockSelectedStrands\(\)[\s\S]*selectedLocksInOrder\(\)[\s\S]*lockStrands\(targets\)/);
  assert.match(source, /function unlockStrands\(targets\)[\s\S]*pushUndoState\(\)[\s\S]*lock\.locked = false/);
  assert.match(source, /function unlockAllStrands\(\) \{[\s\S]*unlockStrands\(locks\)/);
  assert.match(source, /event\.key\.toLowerCase\(\) === "l"[\s\S]*selectedLocksInOrder\(\)\.length[\s\S]*lockSelectedStrands\(\)[\s\S]*unlockAllStrands\(\)/);
  assert.match(registry, /APPLICATION_SHORTCUT_KEYS[\s\S]*"l"/);
  assert.match(html, /<kbd>L<\/kbd><span>Lock selected strands; unlock all when none are selected<\/span>/);
  assert.match(html, /<kbd>Ctrl<\/kbd><span>\+<\/span><kbd>H<\/kbd><\/span><span>Hide selected strands; unhide all when none are selected<\/span>/);
  assert.match(source, /kind === "locking-submenu"[\s\S]*Lock Strands[\s\S]*Unlock All/);
  assert.match(source, /kind === "root"[\s\S]*lockedStrandsExist\(\)[\s\S]*unlock-all-strands/);
  assert.match(source, /function strandViewportBaseColor\(lock\) \{[\s\S]*lock\.locked[\s\S]*strandDisplayColor\(lock\)[\s\S]*0x747780[\s\S]*0\.18/);
  assert.match(source, /function applyLockedStrandPalette\(material\)[\s\S]*ANIME_ANISOTROPIC_SHADER[\s\S]*uShadowColor[\s\S]*uHighlightColor[\s\S]*uRimColor/);
  assert.match(source, /function setStrandSelectionVisual\(lock\)[\s\S]*setAnimeHairBaseColor\(material, strandViewportBaseColor\(lock\)\)[\s\S]*lock\.locked[\s\S]*applyLockedStrandPalette\(material\)/);
  assert.match(source, /function unlockStrands\(targets\)[\s\S]*lock\.locked = false[\s\S]*updateStrandSelectionHighlight\(\)/);
  assert.match(source, /function createHairTopologyOverlay\(sourceGeometry\)[\s\S]*fwidth\(vBarycentric\) \* 1\.25[\s\S]*smoothstep\(vec3\(0\.0\), edgeWidth, vBarycentric\)/);
  assert.match(source, /function syncLockedStrandWireVisual\(lock\)[\s\S]*0xff4fd8[\s\S]*lock\.locked \? 0\.25 : 0\.72[\s\S]*lock\.locked[\s\S]*hairTopologyVisible[\s\S]*meshWorkspaceWireSelection\(lock\)/);
  assert.doesNotMatch(source, /uniform float dotted|uniforms\.dotted/);
  assert.match(html, /id="lockOutlinerAction"[\s\S]*Lock Region/);
  assert.match(source, /function outlinerLockTargets\(target = outlinerContextTarget\)[\s\S]*target\?\.type === "strand"[\s\S]*strand-region[\s\S]*strand-layer[\s\S]*normalizeHairLayer\(lock\.hairLayer\)/);
  assert.match(source, /header\.addEventListener\("contextmenu"[\s\S]*type: "strand-region"[\s\S]*layerHeader\.addEventListener\("contextmenu"[\s\S]*type: "strand-layer"/);
  assert.match(source, /const unlockTargets = lockTargets\.length > 0 && lockTargets\.every\(\(lock\) => lock\.locked\)[\s\S]*`\$\{lockActionVerb\} Strand`[\s\S]*`\$\{lockActionVerb\} Strands`[\s\S]*`\$\{lockActionVerb\} Layer`[\s\S]*`\$\{lockActionVerb\} Region`/);
  assert.match(source, /lockOutlinerAction\.addEventListener\("click"[\s\S]*outlinerLockTargets\(\)[\s\S]*targets\.every\(\(lock\) => lock\.locked\)[\s\S]*unlockStrands\(targets\)[\s\S]*lockStrands\(targets\)/);
});

test("Layered Side Bun is bundled as a clean human-authored full-hair preset", async () => {
  const [html, source, presetText, preview] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../assets/presets/layered-side-bun.ahs", import.meta.url), "utf8"),
    readFile(new URL("../assets/presets/layered-side-bun-preview.png", import.meta.url))
  ]);
  const preset = JSON.parse(presetText);

  assert.equal(preset.format, "anime-hair-studio-project");
  assert.equal(preset.version, 1);
  assert.equal(preset.metadata.name, "Layered Side Bun");
  assert.equal(preset.metadata.authoredBy, "human");
  assert.equal(preset.state.locks.length, 88);
  assert.deepEqual([...preview.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(
    source,
    /\["layered-side-bun", "\.\/assets\/presets\/layered-side-bun\.ahs\?v=20260730-1"\]/
  );
  assert.match(
    source,
    /previewImage: "\.\/assets\/presets\/layered-side-bun-preview\.png\?v=20260730-1"/
  );
  assert.match(
    source,
    /const presetState = catalogPreset\?\.omitAuthoringAids[\s\S]*referenceImages: \[\], guides: \[\][\s\S]*const stateToRestore = regionalPreset[\s\S]*: presetState;[\s\S]*restoreState\(stateToRestore/
  );
  const presetCatalogSource = source.match(/const presetCatalog = \[([\s\S]*?)\];/)?.[1] || "";
  assert.doesNotMatch(presetCatalogSource, /id: "(?:braided-buns|braided-bob|long-layered-curls|bowl-cut|generated-bangs|front|side|back|twin|ahoge)"/);
  assert.doesNotMatch(html, /id="presetPanel"|id="addLock"/);
});

test("tool presets capture brush settings and persist named records in browser storage", async () => {
  const [html, source] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8")
  ]);
  assert.match(
    html,
    /class="creation-preset-row"[\s\S]*id="drawBrushPreset"[\s\S]*id="saveStrandToolPreset"[\s\S]*id="removeStrandToolPreset"[^>]*disabled/
  );
  assert.match(html, /id="removeBraidToolPreset"[^>]*disabled/);
  assert.doesNotMatch(html, /id="strandToolPreset"/);
  assert.doesNotMatch(source, /strandToolPresetInput/);
  assert.match(
    source,
    /function populateDrawBrushPresetSelect\([\s\S]*Custom Presets[\s\S]*customCreationPresets\.strand/
  );
  assert.match(html, /id="creationPresetDialog"[\s\S]*id="creationPresetName"/);
  assert.match(
    html,
    /id="removeCreationPresetDialog"[\s\S]*id="removeCreationPresetMessage"[\s\S]*id="confirmRemoveCreationPreset"/
  );
  assert.match(source, /CREATION_PRESET_STORAGE_KEY = "anime-hair-studio-creation-presets-v1"/);
  assert.match(
    source,
    /function creationToolSettingsSnapshot\(type\)[\s\S]*brushPattern[\s\S]*brushStrandCount[\s\S]*brushStrandPatternPoints[\s\S]*toolSize[\s\S]*smoothing[\s\S]*curveStep[\s\S]*scalpOffset[\s\S]*surfaceNormalInfluence/
  );
  assert.match(source, /function applyCreationToolSettings\(type, settings[\s\S]*brushPattern: brushWorkspacePatternInput[\s\S]*brushStrandCount: brushWorkspaceStrandCountInput[\s\S]*toolSize: drawToolSizeInput/);
  assert.match(source, /toolSettings: creationToolSettingsSnapshot\(type\)/);
  assert.match(source, /localStorage\.setItem\(CREATION_PRESET_STORAGE_KEY/);
  assert.match(source, /function syncCreationPresetRemoveButtons\(\)[\s\S]*startsWith\("custom:"\)/);
  assert.match(
    source,
    /function commitRemoveCreationPreset\(\)[\s\S]*removeToolPreset\([\s\S]*saveCustomCreationPresets\(\)[\s\S]*removeCreationPresetDialog\.close\(\)/
  );
});

test("strand profile, width, and depth curves support browser-persisted custom presets", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /data-shape-preset="sweepProfile"/);
  assert.match(html, /data-shape-preset="taperCurve"/);
  assert.match(html, /data-shape-preset="depthCurve"/);
  assert.match(source, /id: "soft-dome", name: "Soft Dome"/);
  assert.match(source, /SHAPE_PRESET_STORAGE_KEY = "anime-hair-studio-shape-presets-v1"/);
  assert.match(
    source,
    /function setupShapePresetControls\(\)[\s\S]*shape-preset-action[\s\S]*openSaveShapePreset\(select\)[\s\S]*openRemoveShapePreset\(select\)/
  );
  assert.match(
    source,
    /function commitCustomShapePreset\(\)[\s\S]*secondaryValue:[\s\S]*asymmetric:[\s\S]*saveCustomShapePresets\(\)/
  );
  assert.match(
    source,
    /function applyShapePreset\(select\)[\s\S]*target\[taperSecondaryKey\(key\)\][\s\S]*target\[taperAsymmetryKey\(key\)\]/
  );
  assert.doesNotMatch(html, /id="shapePresetShareDialog"|id="shapePresetPasteText"|id="copyShapePresetShare"/);
  assert.doesNotMatch(source, /openShapePresetShare|serializeShapePresetShareText|parseShapePresetShareText/);
  assert.match(css, /\.shape-preset-picker\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 24px 24px[\s\S]*gap:\s*3px/);
  assert.match(css, /\.shape-preset-action\s*\{[\s\S]*min-height:\s*24px;[\s\S]*max-width:\s*24px;[\s\S]*max-height:\s*24px;[\s\S]*width:\s*24px;[\s\S]*height:\s*24px;[\s\S]*aspect-ratio:\s*1/);
  assert.doesNotMatch(css, /shape-preset-share|shape-preset-paste/);
});

test("capsule guides expose persistent editable names and colors", async () => {
  const [html, source] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="surfaceGuideToolPanel"[\s\S]*id="surfaceGuideName"[^>]*maxlength="60"[\s\S]*id="surfaceGuideColor"[^>]*type="color"/);
  assert.match(html, /id="surfaceGuideCenterVisibility"[^>]*value="0\.5"[\s\S]*id="surfaceGuideCenterVisibilityValue"[^>]*>0\.50</);
  assert.match(source, /const DEFAULT_CAPSULE_GUIDE_COLOR = "#70b6bd"/);
  assert.match(source, /const surfaceGuideDefaults = \{[\s\S]*centerVisibility: 0\.5/);
  assert.match(source, /guide\.centerVisibility \?\? 0\.5/);
  assert.match(
    source,
    /function addCapsuleGuide\(overrides[\s\S]*name: normalizeCapsuleGuideName\(overrides\.name, fallbackName\)[\s\S]*color: normalizeCapsuleGuideColor\(overrides\.color\)/
  );
  assert.match(
    source,
    /function updateCapsuleGuideDisplayColor\(guide\)[\s\S]*guide\.wire\?\.material\.color[\s\S]*guide\.controlWire\?\.material\.color[\s\S]*updateCapsuleGuideHandleColors[\s\S]*refreshCapsuleGuideFillInfluence/
  );
  assert.match(source, /const base = capsuleGuideAccentColor\(guide\)/);
  assert.match(
    source,
    /function syncGuideInputs\(guide\)[\s\S]*surfaceGuideNameInput\.value = guide\.name[\s\S]*surfaceGuideColorInput\.value = normalizeCapsuleGuideColor\(guide\.color\)/
  );
  assert.match(
    source,
    /surfaceGuideNameInput\.addEventListener\("change"[\s\S]*normalizeCapsuleGuideName[\s\S]*renderGuideOutliner\(\)[\s\S]*refreshLiveSurfaceOptions\(\)/
  );
  assert.match(
    source,
    /surfaceGuideColorInput\.addEventListener\("input"[\s\S]*normalizeCapsuleGuideColor[\s\S]*updateCapsuleGuideDisplayColor\(guide\)[\s\S]*renderGuideOutliner\(\)/
  );
  assert.match(source, /name: guide\.name,[\s\S]*objectTransform: normalizeStrandObjectTransform\(guide\.objectTransform\),[\s\S]*color: normalizeCapsuleGuideColor\(guide\.color\)/);
  assert.match(source, /icon\.style\.background = normalizeCapsuleGuideColor\(guide\.color\)/);
});

test("capsule guides can be drawn as curved live-surface cages", async () => {
  const [html, source] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="drawCapsuleGuideMode"[\s\S]*Draw Capsule Guide/);
  assert.match(html, /id="viewportDrawCapsuleGuideTool"[^>]*data-tool="draw-capsule-guide"/);
  assert.match(html, /id="capsuleGuideDrawSettings"[\s\S]*id="capsuleGuideCurveStep"[\s\S]*id="capsuleGuideProfileRoot"[\s\S]*id="capsuleGuideProfileMiddle"[\s\S]*id="capsuleGuideProfileTip"/);
  assert.match(source, /function beginCapsuleGuideDrawStroke\(event, hit\)[\s\S]*drawSurfaceHitFromEvent/);
  assert.match(source, /function setCapsuleGuideEditing\(enabled\)[\s\S]*if \(enabled && !componentEditModeActive\(\)\) setViewportSelectionMode\("component"\)/);
  assert.match(source, /function setCapsuleGuideEditing\(enabled\)[\s\S]*const selectedCapsule = getSelectedGuide\(\)\?\.type === "capsule"[\s\S]*guides\.find\(\(guide\) => \([\s\S]*guide\.type === "capsule"[\s\S]*selectGuide\(selectedCapsule\.id\)/);
  assert.match(source, /function setViewportSelectionMode\(mode\)[\s\S]*getSelectedGuide\(\)\?\.type === "capsule"[\s\S]*nextMode === "component"[\s\S]*setCapsuleGuideEditing\(true\)[\s\S]*nextMode === "object"[\s\S]*setCapsuleGuideEditing\(false\)/);
  assert.match(source, /function selectGuide\(id\)[\s\S]*guide\?\.type === "capsule" && componentEditModeActive\(\) && !capsuleGuideEditing[\s\S]*setCapsuleGuideEditing\(true\)/);
  assert.match(source, /function createCapsuleGuideAlongCurve\(samples\)[\s\S]*Math\.ceil\(authoredLength \/ curveStep\)/);
  assert.match(source, /function createCapsuleGuideAlongCurve\(samples\)[\s\S]*curveDeformedCapsulePoints\(\{[\s\S]*radialProfile,[\s\S]*capAtEnd: true[\s\S]*addCapsuleGuide/);
  assert.match(source, /if \(key === "radius"\)[\s\S]*scaleCapsuleRadialLoops\([\s\S]*guide\.controlLoops[\s\S]*updateCapsuleGuideGeometry\(guide, \{ preserveControlPoints: true \}\)/);
  assert.match(source, /function updateCapsuleGuideGeometry\(guide,[\s\S]*const minimumLength = 0\.04;/);
  assert.doesNotMatch(source, /guide\.controlPoints\.forEach\(\(point\) => \{\s*point\.x \*= radiusScale;\s*point\.z \*= radiusScale;/);
  assert.match(source, /function finishCapsuleGuideDrawStroke\(event, \{ cancel = false \} = \{\}\)[\s\S]*pushUndoState\(\)[\s\S]*createCapsuleGuideAlongCurve/);
  assert.match(source, /controlPoints: guide\.controlPoints\?\.map\(vectorToData\)[\s\S]*controlFaces: guide\.controlFaces/);
});

test("standalone curve lattice guides are available while surface experiments remain retired", async () => {
  const [html, source, localization, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="curveLatticeGuideMode"[^>]*role="menuitem"/);
  assert.doesNotMatch(html, /id="curveLatticeGuideMode"[^>]*(?:retired-experiment|hidden|aria-hidden="true")/);
  assert.match(
    html,
    /id="viewportCurveLatticeGuideTool"[^>]*class="tool-button guide-toolbar-tool hidden"[^>]*aria-pressed="false"/
  );
  assert.match(
    html,
    /id="curveLatticeControls"[\s\S]*id="curveLatticePreset"[\s\S]*id="saveCurveLatticePreset"[\s\S]*id="removeCurveLatticePreset"[\s\S]*id="curveLatticeColor"[^>]*type="color"[\s\S]*Horizontal Loops[\s\S]*id="curveLatticeHorizontalLoops"[\s\S]*Vertical Loops[\s\S]*id="curveLatticeVerticalLoops"/
  );
  assert.doesNotMatch(html, /id="curveLatticeControls"[^>]*retired-experiment/);
  assert.doesNotMatch(html, /curveLatticeBottomExtrude|curveLatticeBottomRows|Bottom Extrude|Extrude Loops/);
  assert.match(
    source,
    /function createStandaloneCurveLatticeGuide\(\) \{\s*if \(!CURVE_LATTICE_FEATURE_ENABLED\) return null;[\s\S]*columns = DEFAULT_CURVE_LATTICE_PLANE\.columns[\s\S]*standalone:\s*true/
  );
  assert.match(
    source,
    /function createCurveLatticeGuideFromUi\(\) \{\s*if \(!CURVE_LATTICE_FEATURE_ENABLED\) return;[\s\S]*createStandaloneCurveLatticeGuide\(\)/
  );
  assert.match(
    source,
    /function resampleCurveLatticeGuide\([\s\S]*resampleCurveLatticePointData[\s\S]*rebuildCurveLatticeHandles\(guide\)[\s\S]*updateCurveLatticeGeometry\(guide\)/
  );
  assert.doesNotMatch(
    source,
    /curveLatticeBottomExtrude|curveLatticeBottomRows|bottomExtrude|bottomRows|bottomPoints|bottomMesh|bottomWire/
  );
  assert.match(
    source,
    /function addCurveLattice\(overrides[\s\S]*standalone = Boolean\(overrides\.standalone\)[\s\S]*standalone \? flatCurveLatticePoints\(columns, rows\)[\s\S]*scalpRegion = standalone \? "unassigned"[\s\S]*outlinerVisible: overrides\.outlinerVisible !== false[\s\S]*\(!CURVE_LATTICE_FEATURE_ENABLED \|\| !REGION_CURVE_VISUALIZATION_ENABLED\)[\s\S]*&& !guide\.standalone/
  );
  assert.match(source, /function outlinerGuides\(\)[\s\S]*CURVE_LATTICE_FEATURE_ENABLED && guide\.standalone/);
  assert.match(source, /function serializeGuide\(guide\) \{[\s\S]*guide\.type === "curve-lattice"[\s\S]*standalone: Boolean\(guide\.standalone\)/);
  assert.match(source, /function normalizeCurveLatticeGuideColor\(value, fallback = UI_ACCENT_COLOR\)[\s\S]*Number\.isFinite\(value\)[\s\S]*new THREE\.Color\(fallback\)/);
  assert.match(source, /function updateCurveLatticeDisplayColor\(guide,[\s\S]*guide\.mesh\?\.material\.color[\s\S]*guide\.wire\?\.material\.color[\s\S]*guide\.rootMesh\?\.material\.color[\s\S]*guide\.groupCurveLine\?\.material\.color/);
  assert.match(source, /function syncGuideInputs\(guide\)[\s\S]*guide\.type === "curve-lattice"[\s\S]*curveLatticeColorInput\.value = normalizeCurveLatticeGuideColor/);
  assert.match(source, /CURVE_LATTICE_PRESET_STORAGE_KEY = "anime-hair-studio-curve-lattice-presets-v1"/);
  assert.match(source, /function openSaveCurveLatticePreset\(\)[\s\S]*curveLatticePresetValue[\s\S]*Create Curve Lattice Preset[\s\S]*creationPresetDialog\.showModal/);
  assert.match(source, /function applyCurveLatticePreset\(presetId\)[\s\S]*curveLatticePresetPoints[\s\S]*pushUndoState\(\)[\s\S]*rebuildCurveLatticeHandles\(guide\)[\s\S]*updateCurveLatticeGeometry\(guide\)/);
  assert.match(source, /function commitCustomCurveLatticePreset\(\)[\s\S]*customCurveLatticePresets\.push\(preset\)[\s\S]*saveCustomCurveLatticePresets\(\)/);
  assert.match(source, /function commitRemoveCurveLatticePreset\(\)[\s\S]*removeCurveLatticePresetFromLibrary[\s\S]*saveCustomCurveLatticePresets\(\)/);
  assert.match(source, /curveLatticePresetInput\.addEventListener\("change"[\s\S]*applyCurveLatticePreset[\s\S]*saveCurveLatticePresetButton\.addEventListener[\s\S]*removeCurveLatticePresetButton\.addEventListener/);
  assert.match(source, /bindUndoCapture\(curveLatticeColorInput\)[\s\S]*curveLatticeColorInput\.addEventListener\("input"[\s\S]*updateCurveLatticeDisplayColor\(guide\)[\s\S]*renderGuideOutliner\(\)/);
  assert.match(source, /guide\.type === "curve-lattice"[\s\S]*icon\.style\.setProperty\([\s\S]*"--guide-color"[\s\S]*normalizeCurveLatticeGuideColor/);
  assert.match(
    source,
    /function guideSupportsLiveSurface\(guide\)[\s\S]*guide\?\.type === "capsule"[\s\S]*guide\?\.type === "curve-lattice" && guide\.standalone[\s\S]*function liveSurfaceGuide\([\s\S]*guideSupportsLiveSurface\(guide\)/
  );
  assert.match(
    source,
    /function drawScalpRegionAtEvent\([\s\S]*surfaceGuide[\s\S]*scalpRegionNearestWorldPoint\(surfaceHit\.point\)[\s\S]*curveLatticeId[\s\S]*scalpRegionNearestWorldPoint\(surfaceHit\.point\)/
  );
  assert.match(
    source,
    /function createStrandsFromCurveLattice\(guide\)[\s\S]*const root = points\[0\][\s\S]*scalpRegion: scalpRegionNearestWorldPoint\(root\)/
  );
  assert.match(
    source,
    /function createCurveLatticeLoopPickers\(guide\)[\s\S]*curveLatticeLoopAxis = axis[\s\S]*curveLatticeLoopIndex = loopIndex/
  );
  assert.match(
    source,
    /function selectCurveLatticeLoop\(guide, axis, loopIndex\)[\s\S]*curveLatticeLoopPointIndices[\s\S]*selectedControlPoints = indices\.map[\s\S]*updateCurveLatticeHandleColors/
  );
  assert.match(
    source,
    /const latticeLoopHit = curveLatticeLoopHitFromEvent\(event, selectedLattice\)[\s\S]*selectCurveLatticeLoop\([\s\S]*latticeLoopHit\.axis[\s\S]*latticeLoopHit\.loopIndex/
  );
  assert.match(
    source,
    /function updateCurveLatticeLoopHover\(event\)[\s\S]*hoveredControlPoint[\s\S]*pointerHitsTransformGizmo\(event\)[\s\S]*setCurveLatticeLoopHover\(result\)[\s\S]*"pointer"/
  );
  assert.match(
    source,
    /function refreshCurveLatticeLoopHover\(\)[\s\S]*curveLatticeLoopHover\?\.guideId[\s\S]*curveLatticeLoopHover\.axis[\s\S]*picker\.material\.opacity = hovered \? 0\.96 : 0/
  );
  assert.match(
    source,
    /renderer\.domElement\.addEventListener\("pointermove", updateControlPointHover\)[\s\S]*renderer\.domElement\.addEventListener\("pointermove", updateCurveLatticeLoopHover\)/
  );
  assert.match(
    source,
    /function setActiveTool\(tool\)[\s\S]*\["rotate", "scale"\]\.includes\(tool\)[\s\S]*viewportEditMode === "guide"[\s\S]*componentEditModeActive\(\)[\s\S]*getSelectedGuide\(\)\?\.type === "curve-lattice"[\s\S]*tool = "move"/
  );
  assert.match(
    source,
    /function updateViewportToolVisibility\(\)[\s\S]*viewportCapsuleGuideTool\.classList\.toggle\("hidden", !guideMode\)[\s\S]*viewportCurveLatticeGuideTool\.classList\.toggle\("hidden", !guideMode \|\| !CURVE_LATTICE_FEATURE_ENABLED\)/
  );
  assert.match(
    source,
    /capsuleGuideMode\.addEventListener\("click", toggleCapsuleGuideTool\)[\s\S]*viewportCapsuleGuideTool\.addEventListener\("click", toggleCapsuleGuideTool\)[\s\S]*curveLatticeGuideMode\.addEventListener\("click", createCurveLatticeGuideFromUi\)[\s\S]*viewportCurveLatticeGuideTool\.addEventListener\("click", createCurveLatticeGuideFromUi\)/
  );
  assert.match(
    source,
    /function applyCurveLatticeMultiTransform\(handle\)[\s\S]*activeTool !== "move"[\s\S]*transformControls\.mode !== "translate"[\s\S]*target\.copy\(point\)\.add\(delta\)/
  );
  assert.match(
    source,
    /const showCurveLatticeControls = CURVE_LATTICE_FEATURE_ENABLED[\s\S]*guide\?\.type === "curve-lattice"[\s\S]*guide\.standalone[\s\S]*curveLatticeControls\.hidden = !showCurveLatticeControls/
  );
  assert.match(
    source,
    /const REGION_CURVE_VISUALIZATION_ENABLED = false;[\s\S]*if \(REGION_CURVE_VISUALIZATION_ENABLED\) \{[\s\S]*ensureGroupCurveDisplay\(guide\)\.visible = groupCurveVisible;[\s\S]*guide\.groupCurveLine\.visible = false;/
  );
  assert.match(
    source,
    /const latticeVisible = REGION_CURVE_VISUALIZATION_ENABLED[\s\S]*guide\.mesh\.visible = latticeVisible;[\s\S]*guide\.wire\.visible = latticeVisible;[\s\S]*guide\.loopPickersGroup\.visible = latticeVisible;/
  );
  assert.match(
    source,
    /item\.standalone\s*\?\s*item\.viewportGroupVisible !== false\s*:\s*REGION_CURVE_VISUALIZATION_ENABLED/
  );
  assert.match(html, /class="tool-button retired-experiment"[^>]*data-tool="surface"[^>]*hidden/);
  assert.match(html, /class="tool-button retired-experiment"[^>]*data-tool="surface-loft"[^>]*hidden/);
  assert.match(localization, /"Curve Lattice Guide":\s*"カーブラティスガイド"/);
  assert.match(css, /\.guide-outliner-icon\.lattice-guide,[\s\S]*\.icon-curve-lattice-guide[\s\S]*var\(--guide-color, #365d63\)/);
});

test("retired hair envelopes have no UI, geometry, or live-surface entry points", async () => {
  const [html, source, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(html, /hairEnvelope|Hair Envelope/);
  assert.doesNotMatch(source, /ConvexGeometry|createHairEnvelope|addHairEnvelope|hairEnvelopeGuideMode/);
  assert.doesNotMatch(source, /guide\?\.type === "hair-envelope"/);
  assert.match(source, /if \(snapshot\.type === "hair-envelope"\) \{\s*return;\s*\}/);
  assert.doesNotMatch(localization, /Hair Envelope|ヘアエンベロープ/);
});

test("outliner items support inline renaming and guide context deletion", async () => {
  const [html, source, css, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);
  const scalpRowStart = source.indexOf("function createScalpGuideOutlinerRow()");
  const scalpRowEnd = source.indexOf("\n}\n\nfunction renderGuideOutliner", scalpRowStart) + 2;
  const scalpRowSource = source.slice(scalpRowStart, scalpRowEnd);

  assert.match(
    source,
    /function beginOutlinerRename\(label,[\s\S]*outliner-rename-input[\s\S]*pushUndoState\(\)[\s\S]*event\.key === "Enter"[\s\S]*event\.key === "Escape"/
  );
  assert.match(source, /function handleOutlinerRenameClick\(event, options\)[\s\S]*event\.detail >= 2[\s\S]*beginOutlinerRename/);
  assert.match(
    source,
    /function createOutlinerStrandButton[\s\S]*handleOutlinerRenameClick\(event,[\s\S]*lock\.name = nextName/
  );
  assert.match(
    source,
    /function createOutlinerClump[\s\S]*handleOutlinerRenameClick\(event,[\s\S]*clumpLocks\.forEach[\s\S]*lock\.clumpName = nextName/
  );
  assert.match(
    source,
    /function renderReferenceOutliner[\s\S]*reference-outliner-name[\s\S]*handleOutlinerRenameClick\(event,[\s\S]*reference\.name = nextName/
  );
  assert.match(
    source,
    /function renderReferenceOutliner[\s\S]*item\.addEventListener\("contextmenu"[\s\S]*type: "reference"[\s\S]*referenceId: reference\.id/
  );
  assert.match(
    source,
    /function renderGuideOutliner[\s\S]*handleOutlinerRenameClick\(event,[\s\S]*guide\.name = nextName[\s\S]*type: "guide"[\s\S]*guideId: guide\.id/
  );
  assert.notEqual(scalpRowStart, -1);
  assert.doesNotMatch(scalpRowSource, /handleOutlinerRenameClick/);
  assert.match(
    source,
    /function showOutlinerContextMenu\(event, target\)[\s\S]*const isGuide = target\.type === "guide"[\s\S]*"Delete guide"[\s\S]*"Guide actions"/
  );
  assert.match(
    html,
    /id=["']clumpContextMenu["'][\s\S]*id=["']promoteLiveSurfaceGuideAction["'][^>]*>Promote to Live Surface Guide<\/button>/
  );
  assert.match(
    source,
    /function showOutlinerContextMenu\(event, target\)[\s\S]*promoteLiveSurfaceGuideAction\.classList\.toggle\("hidden", !strand\)[\s\S]*"Remove from Live Surface Guides"[\s\S]*"Promote to Live Surface Guide"/
  );
  assert.match(
    source,
    /promoteLiveSurfaceGuideAction\.addEventListener\("click"[\s\S]*lock\.liveSurfaceGuide = !lock\.liveSurfaceGuide[\s\S]*setActiveStrokeSurfaceValue\(`strand:\$\{lock\.id\}`\)[\s\S]*markProjectChangedForRecovery\(\)/
  );
  assert.doesNotMatch(
    source,
    /promoteLiveSurfaceGuideAction\.addEventListener\("click"[\s\S]*?pushUndoState\(\)[\s\S]*?lock\.liveSurfaceGuide = !lock\.liveSurfaceGuide/
  );
  assert.match(
    source,
    /function refreshLiveSurfaceOptions\(\)[\s\S]*locks\.filter\(\(lock\) => lock\.liveSurfaceGuide\)[\s\S]*value: `strand:\$\{lock\.id\}`[\s\S]*appendGroup\([\s\S]*"Strand Guides"/
  );
  assert.match(
    source,
    /liveSurfaceGuide: Boolean\(lock\.liveSurfaceGuide\)[\s\S]*function restoreLock\(snapshot,[\s\S]*liveSurfaceGuide: Boolean\(snapshot\.liveSurfaceGuide\)/
  );
  assert.match(
    source,
    /function createOutlinerStrandButton\(lock,[\s\S]*if \(lock\.liveSurfaceGuide\) \{[\s\S]*button\.classList\.add\("live-surface-guide-item"\)[\s\S]*button\.setAttribute\("aria-label", `\$\{lock\.name\}, live surface guide`\)/
  );
  assert.doesNotMatch(source, /badge\.textContent = "Surface"/);
  assert.match(
    source,
    /deleteOutlinerAction\.addEventListener\("click"[\s\S]*target\?\.type === "guide"[\s\S]*deleteGuide\(guides\.find/
  );
  assert.match(
    source,
    /deleteOutlinerAction\.addEventListener\("click"[\s\S]*target\?\.type === "reference"[\s\S]*selectReferenceImage\(reference\.id\)[\s\S]*deleteSelectedReferenceImage\(\)/
  );
  assert.match(source, /const isReference = target\.type === "reference"[\s\S]*"Delete reference"[\s\S]*"Reference actions"/);
  assert.match(source, /function deleteGuide\(guide\)[\s\S]*removeGuideObjects\(guide\)[\s\S]*disposeGuide\(guide\)/);
  assert.match(source, /type: guide\.type,\s*name: guide\.name/);
  assert.match(source, /referenceImages: referenceImages\.map\(serializeReferenceImage\)/);
  assert.match(source, /clumpName: lock\.clumpName \|\| null/);
  assert.match(css, /\.outliner-rename-input\s*\{[\s\S]*border:\s*1px solid #e7a95d/);
  assert.match(
    source,
    /function renderLockList\(\)[\s\S]*const groupColor = `#\$\{new THREE\.Color\(SCALP_REGIONS\[group\.id\]\.color\)\.getHexString\(\)\}`[\s\S]*groupElement\.style\.setProperty\("--outliner-region-color", groupColor\)[\s\S]*groupSwatch\.style\.background = groupColor/
  );
  assert.match(
    css,
    /\.outliner-group\s*\{[\s\S]*border-left:\s*2px solid color-mix\(in srgb, var\(--outliner-region-color\) var\(--outliner-folder-border-mix, 58%\), #57515a\)[\s\S]*background:\s*color-mix\(in srgb, var\(--outliner-region-color\) var\(--outliner-folder-background-mix, 11%\), #19181d\)/
  );
  assert.match(css, /\.outliner-group-head\s*\{[\s\S]*min-height:\s*29px;[\s\S]*padding:\s*1px 2px/);
  assert.match(css, /\.outliner-layer-head\s*\{[\s\S]*min-height:\s*24px;[\s\S]*padding:\s*1px 5px 1px 1px/);
  assert.match(css, /\.lock-item\s*\{[\s\S]*min-height:\s*26px;[\s\S]*padding:\s*3px 6px/);
  assert.match(
    css,
    /\.lock-item\.live-surface-guide-item\s*\{[\s\S]*border-color:\s*#63c7ff66;[\s\S]*box-shadow:\s*inset 2px 0 #63c7ff/
  );
  assert.match(localization, /"Delete guide":/);
  assert.match(html, /id="editScalpOutlinerAction"/);
});

test("strand rows can be dragged to another region and receive a unique region name", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(
    source,
    /function nextStrandName\(region = "unassigned", excludedLockId = null\)[\s\S]*lock\.id !== excludedLockId[\s\S]*usedNames\.has\(`\$\{group\.label\} \$\{number\}`\)/
  );
  assert.match(
    source,
    /function handleOutlinerRegionDrop\(event, regionId\)[\s\S]*pushUndoState\(\)[\s\S]*detachLockFromClump\(source\)[\s\S]*source\.scalpRegion = regionId[\s\S]*source\.name = nextStrandName\(regionId, source\.id\)[\s\S]*syncRootAttachmentMetadata\(source\)[\s\S]*refreshLiveSurfaceOptions\(\)[\s\S]*renderLockList\(\)/
  );
  assert.match(
    source,
    /function createOutlinerStrandButton\(lock,[\s\S]*setData\(OUTLINER_STRAND_DRAG_TYPE, lock\.id\)/
  );
  assert.match(
    source,
    /function renderLockList\(\)[\s\S]*header\.addEventListener\("dragover"[\s\S]*region-drop-target[\s\S]*header\.addEventListener\("drop"[\s\S]*handleOutlinerRegionDrop\(event, group\.id\)/
  );
  assert.match(css, /\.outliner-group-head\.region-drop-target\s*\{[\s\S]*#63c7ff/);
});

test("clumps can be saved from the outliner as reusable draw brush presets", async () => {
  const [html, source, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="clumpContextMenu"[\s\S]*id="createClumpPresetAction"[\s\S]*Create preset from clump/);
  assert.match(html, /id="creationPresetDescription"/);
  assert.match(source, /const LEGACY_CLUMP_PRESET_STORAGE_KEY = "anime-hair-studio-clump-presets-v1"/);
  assert.match(source, /clump-brush-presets\.js\?v=20260803-3/);
  assert.match(source, /function createCustomClumpPreset\(guide\)[\s\S]*pendingClumpPresetGuideId = guide\.id[\s\S]*Create Brush Preset[\s\S]*creationPresetDialog\.showModal/);
  assert.match(
    source,
    /if \(type === "clump"\) \{[\s\S]*snapshotState\(\)[\s\S]*createClumpBrushTemplate\(clumpLocks, guideSnapshot\?\.id\)[\s\S]*customCreationPresets\.strand\.push\(preset\)[\s\S]*saveCustomCreationPresets\(\)[\s\S]*populateDrawBrushPresetSelect\(`custom:\$\{preset\.id\}`\)/
  );
  assert.match(source, /function applyCustomCreationPreset\(type, value\)[\s\S]*normalizeClumpBrushTemplate\(preset\.value\.clumpTemplate\)[\s\S]*drawStrandMode = "clump"/);
  assert.match(source, /function activeDrawClumpTemplate\(stroke = null\) \{[\s\S]*activeCustomDrawClumpTemplate/);
  assert.match(source, /function migrateLegacyClumpPresets\(\)[\s\S]*createClumpBrushTemplate\(locks, guide\.id\)[\s\S]*customCreationPresets\.strand\.push[\s\S]*removeItem\(LEGACY_CLUMP_PRESET_STORAGE_KEY\)/);
  assert.doesNotMatch(source, /customPresetCatalog|saveCustomClumpPresets|addCustomClumpPreset/);
  assert.match(localization, /"Create preset from clump":/);
  assert.match(localization, /"Save this clump as a reusable Draw Strand brush in this browser\.":/);
});

test("brush presets capture selected strand profiles before the naming dialog opens", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(
    source,
    /function createCustomCreationPreset\(type\)[\s\S]*const selected = viewportEditMode === "brush" \? null : getSelectedLock\(\)[\s\S]*selected\?\.geometryType === "strand"[\s\S]*viewportEditMode === "brush" \? brushWorkspaceCreationDefaults : strandCreationDefaults[\s\S]*const presetValue = creationPresetSnapshot\(source, type\)[\s\S]*pendingCreationPresetDraft = \{[\s\S]*value: presetValue[\s\S]*toolSettings: creationToolSettingsSnapshot\(type\)[\s\S]*creationPresetDialog\.showModal\(\)/
  );
  assert.match(
    source,
    /function commitCustomCreationPreset\(\)[\s\S]*const draft = pendingCreationPresetDraft\?\.type === type[\s\S]*const libraryType = type === "procedural-brush" \? "strand" : type[\s\S]*\.\.\.\(draft\?\.value \|\| creationPresetSnapshot\(fallback, libraryType\)\)[\s\S]*toolSettings: draft\?\.toolSettings \|\| creationToolSettingsSnapshot\(libraryType\)/
  );
  assert.match(
    source,
    /function creationPresetSnapshot\(source, type, fallback =[\s\S]*taperCurve: clonePresetShape\(source\.taperCurve[\s\S]*depthCurve: clonePresetShape\(source\.depthCurve[\s\S]*sweepProfile: clonePresetShape\(source\.sweepProfile/
  );
});

test("retired clump conform and boolean compound experiments have no entry points", async () => {
  const [html, source, presets, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/clump-brush-presets.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.doesNotMatch(html, /clumpConform|createCompoundFromSelection|compoundBoolean/i);
  assert.doesNotMatch(source, /clumpConform|compoundSourceIds|compoundBoolean/i);
  assert.doesNotMatch(presets, /clumpConform/i);
  assert.doesNotMatch(localization, /Clump Conform|Boolean Match/);
});

test("Chain Links braid preset uses the authored narrow and deep dimensions", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(
    source,
    /"chain-links": \{[\s\S]*?braidMeshPreset: "chain-links",[\s\S]*?braidWidth: 0\.12,[\s\S]*?braidDepth: 0\.65,/
  );
});

test("retired Place Strand tool has no visible or keyboard entry point", async () => {
  const [html, source] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(html, /data-tool=["']place["']/);
  assert.doesNotMatch(source, /\ba\s*:\s*["']place["']/);
});

test("Select, Move, Relax, Curve Sharpness, Draw Strand, and Add Primitive use the supplied SVG toolbar icons", async () => {
  const [html, css, selectIcon, moveIcon, relaxIcon, curveSharpnessIcon, drawStrandIcon, cubeIcon] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/select-tool.svg", import.meta.url), "utf8"),
    readFile(new URL("../assets/move-tool.svg", import.meta.url), "utf8"),
    readFile(new URL("../assets/relax-tool.svg", import.meta.url), "utf8"),
    readFile(new URL("../assets/curve-sharpness-tool.svg", import.meta.url), "utf8"),
    readFile(new URL("../assets/draw-strand-tool.svg", import.meta.url), "utf8"),
    readFile(new URL("../assets/primitive-cube-tool.svg", import.meta.url), "utf8")
  ]);

  assert.match(html, /data-tool="select"[\s\S]*class="tool-icon icon-select"/);
  assert.match(html, /data-tool="move"[\s\S]*class="tool-icon icon-move"/);
  assert.match(html, /data-tool="relax"[\s\S]*class="tool-icon icon-relax"/);
  assert.match(html, /data-tool="curve-sharpness"[\s\S]*class="tool-icon icon-curve-sharpness"/);
  assert.match(html, /data-tool="draw"[\s\S]*class="tool-icon icon-draw-strand"/);
  assert.match(html, /id="addMeshPrimitive"[\s\S]*class="mesh-primitive-icon cube"/);
  assert.match(css, /\.icon-select\s*\{[\s\S]*url\("\.\/assets\/select-tool\.svg\?v=20260830-2"\)/);
  assert.match(css, /\.icon-move\s*\{[\s\S]*url\("\.\/assets\/move-tool\.svg\?v=20260830-2"\)/);
  assert.match(css, /\.icon-relax\s*\{[\s\S]*url\("\.\/assets\/relax-tool\.svg\?v=20260905-1"\)/);
  assert.match(css, /\.icon-curve-sharpness\s*\{[\s\S]*url\("\.\/assets\/curve-sharpness-tool\.svg\?v=20260905-1"\)/);
  assert.match(css, /\.icon-draw-strand\s*\{[\s\S]*url\("\.\/assets\/draw-strand-tool\.svg\?v=20260830-3"\)/);
  assert.match(css, /\.mesh-primitive-icon\.cube\s*\{[\s\S]*url\("\.\/assets\/primitive-cube-tool\.svg"\)/);
  assert.doesNotMatch(css, /\.icon-(?:select|move|relax|curve-sharpness)::(?:before|after)/);
  [selectIcon, moveIcon, drawStrandIcon, cubeIcon].forEach((icon) => {
    assert.match(icon, /<svg[^>]*viewBox="0 0 512 512"/);
  });
  [relaxIcon, curveSharpnessIcon].forEach((icon) => {
    assert.match(icon, /<svg[^>]*viewBox="0 0 32 32"/);
    assert.match(icon, /stroke-width="1\.8"/);
  });
  assert.match(moveIcon, /scale\(16\.75\)/);
  assert.match(moveIcon, /stroke-width="1\.9"/);
  assert.match(relaxIcon, /stroke="#63c7ff"/);
  assert.match(drawStrandIcon, /color="#63c7ff"/);
  assert.match(curveSharpnessIcon, /stroke="#63c7ff"/);
  assert.doesNotMatch(`${relaxIcon}\n${curveSharpnessIcon}\n${drawStrandIcon}`, /#(?:57a8ff|57aeff|57b6ff)/i);
});

test("Rotate, Wireframe, and Guide Toggle use the supplied SVG toolbar icons", async () => {
  const [html, css, rotateIcon, wireframeIcon, guideIcon] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/rotate-tool.svg", import.meta.url), "utf8"),
    readFile(new URL("../assets/wireframe-toggle.svg", import.meta.url), "utf8"),
    readFile(new URL("../assets/guide-toggle.svg", import.meta.url), "utf8")
  ]);

  assert.match(html, /data-tool="rotate"[\s\S]*class="tool-icon icon-rotate"/);
  assert.match(html, /id="toggleWire"[\s\S]*class="tool-icon icon-wireframe-toggle"/);
  assert.match(html, /id="scalpGuideVisibilityToggle"[\s\S]*class="tool-icon icon-guide-toggle"/);
  assert.match(css, /\.icon-rotate\s*\{[\s\S]*url\("\.\/assets\/rotate-tool\.svg\?v=20260830-1"\)/);
  assert.match(css, /\.icon-wireframe-toggle\s*\{[\s\S]*url\("\.\/assets\/wireframe-toggle\.svg\?v=20260830-1"\)/);
  assert.match(css, /\.icon-guide-toggle\s*\{[\s\S]*url\("\.\/assets\/guide-toggle\.svg\?v=20260830-1"\)/);
  assert.match(css, /\.icon-guide-toggle,\s*\.icon-wireframe-toggle\s*\{[^}]*width:\s*28px;[^}]*height:\s*28px/);
  assert.match(css, /\.icon-select,\s*\.icon-move,\s*\.icon-rotate,\s*\.icon-relax,\s*\.icon-curve-sharpness,\s*\.icon-draw-strand\s*\{[^}]*width:\s*28px;[^}]*height:\s*28px/);
  assert.doesNotMatch(css, /\.icon-(?:rotate|scalp-guide)::(?:before|after)/);
  [rotateIcon, wireframeIcon, guideIcon].forEach((icon) => {
    assert.match(icon, /<svg[^>]*viewBox="0 0 512 512"/);
  });
  assert.match(`${wireframeIcon}\n${guideIcon}`, /color="#63c7ff"/);
  assert.doesNotMatch(`${wireframeIcon}\n${guideIcon}`, /#57aeff/i);
});

test("braid tool uses the supplied simplified SVG icon", async () => {
  const [html, css, icon, server] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/braidtoolicon-simplified.svg", import.meta.url), "utf8"),
    readFile(new URL("../server.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /data-tool=["']braid["'][\s\S]*?class=["']tool-icon icon-braid["']/);
  assert.match(css, /\.icon-braid\s*\{[\s\S]*mask:\s*url\("\.\/assets\/braidtoolicon-simplified\.svg"\)/);
  assert.match(server, /["']\.svg["']:\s*["']image\/svg\+xml["']/);
  assert.doesNotMatch(css, /\.icon-braid::(?:before|after)/);
  assert.match(icon, /<title id=["']title["']>Simplified braid tool icon<\/title>/);
});

test("panel tool uses the supplied split-panel SVG and user-facing name", async () => {
  const [html, source, css, icon, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../assets/splitpaneltool-simplified.svg", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /data-tool=["']panel["'][^>]*title=["']Split Panel \(P\)["'][^>]*aria-label=["']Split Panel tool["'][\s\S]*?class=["']tool-icon icon-panel["']/);
  assert.match(html, /id=["']panelStrandToolPanel["'][\s\S]*?<span id=["']panelToolTitle["']>Split Panel Tool<\/span>/);
assert.match(html, /<kbd[^>]*>P<\/kbd><span>Split Panel<\/span>/);
  assert.match(css, /\.icon-panel\s*\{[\s\S]*mask:\s*url\("\.\/assets\/splitpaneltool-simplified\.svg"\)/);
  assert.doesNotMatch(css, /\.icon-panel::(?:before|after)/);
  assert.match(icon, /<title id=["']title["']>Simplified split panel tool icon<\/title>/);
  assert.match(source, /message = "Split Panel: draw its center path on the contextual 2D plane\."/);
  assert.doesNotMatch(source, /Draw panel:/);
  assert.match(localization, /"Split Panel":/);
  assert.match(localization, /"Split Panel Tool":/);
  assert.match(localization, /"Split Panel tool":/);
  assert.match(html, /Vertical Loops <input id=["']panelLengthLoops["']/);
  assert.match(html, /Horizontal Loops <input id=["']panelWidthLoops["']/);
  assert.doesNotMatch(html, /Lengthwise Loops|Crosswise Loops/);
  assert.match(localization, /"Vertical Loops":/);
  assert.match(localization, /"Horizontal Loops":/);
  assert.doesNotMatch(localization, /"Lengthwise Loops"|"Crosswise Loops"/);
});

test("split panels expose a persistent signed tip curve control", async () => {
  const [html, source, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id=["']panelTipCurve["'][^>]*min=["']-1["'][^>]*max=["']1["'][^>]*value=["']0["']/);
  assert.match(source, /panelTipCurve:\s*0/);
  assert.match(source, /panelTipCurveParameter\(t, u, tipCurve, edgeTrim\)/);
  assert.match(source, /panelTipCurve:\s*Number\(lock\.panelTipCurve \?\? panelCreationDefaults\.panelTipCurve\)/);
  assert.match(source, /panelTipCurve:\s*snapshot\.geometryType === "surface"/);
  assert.match(source, /partner\.panelTipCurve = lock\.geometryType === "surface"/);
  assert.match(localization, /"Tip Curve":/);
});

test("split panels can preserve hard zipper and perimeter edges", async () => {
  const [html, source, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /for=["']panelHardZipperEdges["'][\s\S]*Hard Split Edges[\s\S]*id=["']panelHardZipperEdges["']/);
  assert.match(source, /panelHardZipperEdges:\s*false/);
  assert.match(source, /lock\.panelHardZipperEdges = Boolean\(base\.panelHardZipperEdges\)/);
  assert.match(source, /panelHardZipperEdges:\s*Boolean\(lock\.panelHardZipperEdges\)/);
  assert.match(source, /panelHardZipperEdges:\s*Boolean\(snapshot\.panelHardZipperEdges\)/);
  assert.match(source, /partner\.panelHardZipperEdges = Boolean\(lock\.panelHardZipperEdges\)/);
  assert.match(source, /hardSplitEdges[\s\S]*duplicateHardEdgeVertex[\s\S]*hard-surface-left-[\s\S]*hard-surface-right-[\s\S]*hard-left-[\s\S]*hard-right-[\s\S]*hard-start-[\s\S]*hard-end-/);
  assert.match(source, /if \(hardSplitEdges\)[\s\S]*globalRow >= Number\(options\.leftWallStartRow[\s\S]*globalRow >= Number\(options\.rightWallStartRow/);
  assert.match(source, /smoothCoincidentPanelNormals\(geometry, welded\.protectedVertices\)/);
  assert.match(source, /geometry\.userData\.quadFaces = welded\.quadFaces[\s\S]*geometry\.userData\.topology = "quad-patches-with-zipper-boundaries"/);
  assert.match(source, /function createHairTopologyGeometry\(sourceGeometry\)[\s\S]*triangleEdgeMasksFromFaces\([\s\S]*sourceGeometry\.userData\.quadFaces[\s\S]*authoredFaceMasks\[triangleIndex\]/);
  assert.match(localization, /"Hard Split Edges":/);
});

test("split panels can add persistent lower-fringe topology density", async () => {
  const [html, source, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /Tip Loops <input id=["']panelTipLoops["'][^>]*min=["']0["'][^>]*max=["']16["'][^>]*step=["']1["']/);
  assert.match(source, /panelTipLoops:\s*0/);
  assert.match(source, /panelTipLoopParameters\(baseLengthLoops, tipLoops\)/);
  assert.match(source, /panelTipLoops:\s*Number\(lock\.panelTipLoops \?\? panelCreationDefaults\.panelTipLoops\)/);
  assert.match(source, /panelTipLoops:\s*snapshot\.geometryType === "surface"/);
  assert.match(source, /partner\.panelTipLoops = lock\.geometryType === "surface"/);
  assert.match(localization, /"Tip Loops":/);
});

test("Poly Brush is available in the Meshes workspace and authors persistent quad meshes", async () => {
  const [html, source, css, topology] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/poly-topology.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id=["']viewportPolyBrushTool["'][^>]*data-tool=["']poly["'][^>]*aria-label=["']Poly Brush tool["']/);
  assert.match(html, /id=["']polyBrushToolPanel["'][\s\S]*id=["']polyBrushDrawStrips["'][^>]*type=["']checkbox["'](?![^>]*checked)[\s\S]*id=["']polyBrushSurfaceOffset["'][\s\S]*id=["']polyBrushWidth["'][\s\S]*id=["']polyBrushSpacing["'][\s\S]*id=["']polyBrushWeldDistance["'][^>]*value=["']0\.08["']/);
  assert.match(css, /\.icon-poly[\s\S]*\.poly-brush-help/);
  assert.match(source, /geometryType:\s*"poly"[\s\S]*polyFaces:\s*\[\]/);
  assert.match(source, /function addPolyLock\(\)[\s\S]*geometryType: "poly"[\s\S]*materialId: DEFAULT_MESH_MATERIAL_ID/);
  assert.match(source, /function createMeshPrimitive\(type = lastMeshPrimitiveType\)[\s\S]*modelingMeshType: "primitive"[\s\S]*materialId: DEFAULT_MESH_MATERIAL_ID/);
  assert.match(source, /function appendPolyStrokeRow[\s\S]*appendPolyQuad/);
  assert.match(source, /function appendMirroredPolyChanges[\s\S]*mirrorPolyTopologyAppend[\s\S]*function appendPolyStrokeRow[\s\S]*appendMirroredPolyChanges/);
  assert.match(source, /function isModelingMesh\(lock\) \{[\s\S]*lock\?\.geometryType === "poly"/);
  assert.match(source, /function populatePolyEditObjects\(lock, target\)[\s\S]*createHairShellVertexMarker\(lock, point, index\)[\s\S]*handle\.userData\.polyVertexIndex = index/);
  assert.match(source, /function populatePolyEditObjects\(lock, target\)[\s\S]*opacity: 0\.16[\s\S]*depthTest: false[\s\S]*const visibleLine = new THREE\.Line[\s\S]*opacity: 0\.82[\s\S]*depthTest: true[\s\S]*depthFunc: THREE\.LessEqualDepth[\s\S]*visibleLine\.raycast = \(\) => \{\}/);
  assert.doesNotMatch(source, /faceOverlay|polyFaceOverlay/);
  const scalpAutoShowPolicy = source.slice(
    source.indexOf("function activeToolUsesScalpGuide"),
    source.indexOf("function autoShowScalpGuideForActiveTool")
  );
  assert.doesNotMatch(scalpAutoShowPolicy, /"poly"/);
  assert.match(source, /activeTool === "poly" && !meshMode[\s\S]*setActiveTool\("select"\)/);
  assert.match(source, /const meshToolAllowed = \["select", "move", "rotate", "scale", "poly", "loop-cut"\]\.includes\(tool\)/);
  assert.match(source, /!meshMode && \["poly", "face-extrude", "standard-extrude", "loop-cut"\]\.includes\(tool\)/);
  assert.match(source, /function beginPolyBrushPointer[\s\S]*function updatePolyBrushStroke/);
  assert.match(source, /function beginPolyBrushPointer\(event\)[\s\S]*activeTool !== "poly"[\s\S]*\|\| event\.altKey[\s\S]*\) return;/);
  assert.match(source, /event\.shiftKey[\s\S]*fillPolyGap[\s\S]*polyFillCandidate/);
  assert.match(source, /event\.shiftKey[\s\S]*target = polyTargetAtEvent\(event\)[\s\S]*kind:\s*"relax"/);
  assert.match(source, /stroke\.kind === "relax"[\s\S]*relaxPolyPoints[\s\S]*projectPolyRelaxPoint[\s\S]*pushUndoState\(\)/);
  assert.match(source, /function polyHitIsFrontFacing[\s\S]*worldNormal\.dot\(raycaster\.ray\.direction\) < -1e-6/);
  assert.match(source, /function polyFrontFacingComponentSets[\s\S]*frontFacingPolyComponents\(worldPoints, lock\.polyFaces, raycaster\.ray\.direction\)/);
  assert.match(source, /function polyMeshFaceHit[\s\S]*frontFacingOnly[\s\S]*material\.side = THREE\.DoubleSide[\s\S]*hits\.find\(polyHitIsFrontFacing\)[\s\S]*material\.side = previousSides\[index\]/);
  assert.match(source, /function polyTargetAtEvent[\s\S]*frontFacing\.vertexIndices\.has[\s\S]*frontFacing\.edgeKeys\.has[\s\S]*polyMeshFaceHit\(lock, \{ frontFacingOnly: true \}\)/);
  assert.match(source, /function polyEdgeTargetAtEvent[\s\S]*frontFacing\.edgeKeys\.has/);
  assert.match(source, /const sample = polySurfaceSample\(event\)[\s\S]*stroke\.kind === "relax" \? polyRelaxCursorSample\(event, strokeLock\)/);
  assert.match(source, /stroke\?\.kind === "relax"[\s\S]*startPoints[\s\S]*undoHistory\.pop\(\)/);
  assert.match(source, /function polyFillCandidateForEvent[\s\S]*function showPolyFillPreview[\s\S]*function updatePolyFillPreview/);
  assert.match(source, /const vertexMaxDistance = maxDistance \* 3;[\s\S]*\{ maxDistance, vertexMaxDistance \}/);
  assert.match(topology, /vertexMaxDistance = maxDistance[\s\S]*boundaryVertices[\s\S]*!usedVertices\.has\(entry\.index\) \|\| boundaryVertices\.has\(entry\.index\)/);
  assert.match(source, /new THREE\.MeshBasicMaterial\(\{[\s\S]*color:\s*0xff4fd8[\s\S]*depthTest:\s*false/);
  assert.match(source, /window\.addEventListener\("pointermove", updatePolyFillPreview\)/);
  assert.match(source, /event\.key === "Shift"[\s\S]*clearPolyFillPreview\(\)/);
  assert.match(source, /target\?\.type === "vertex"[\s\S]*kind:\s*"vertex"[\s\S]*lock\.points\[stroke\.pointIndex\]\.copy\(point\)/);
  assert.match(source, /polyBrushSurfaceOffsetInput[\s\S]*addScaledVector\(normal,\s*Number\(polyBrushSurfaceOffsetInput\.value\)\)/);
  assert.match(source, /event\.shiftKey && event\.ctrlKey && !event\.altKey && !event\.metaKey[\s\S]*polyComponentDeleteCandidate[\s\S]*finishPolyComponentDelete[\s\S]*deletePolyComponent/);
  assert.match(html, /<strong>Shift\+Ctrl-click component<\/strong> delete/);
  assert.match(source, /target\.type === "face"[\s\S]*mirroredPolyFaceIndex[\s\S]*deletePolyFacesAndOrphans[\s\S]*removePolyPointAttributes/);
  assert.match(source, /stroke\.kind === "vertex"[\s\S]*stroke\.mirrorPointIndex[\s\S]*mirroredVector\(point\)/);
  assert.match(source, /function polyWeldTargetForPoint[\s\S]*polyBrushWeldDistanceInput\.value[\s\S]*stroke\.weldTargetIndex = polyWeldTargetForPoint/);
  assert.match(source, /seamDistanceSquared = 4 \* point\.x \* point\.x[\s\S]*bestIndex = stroke\.mirrorPointIndex[\s\S]*weldingMirrorPair[\s\S]*point\.x = 0/);
  assert.match(source, /stroke\?\.kind === "vertex" && stroke\.changed && stroke\.weldTargetIndex >= 0[\s\S]*weldPolyVertices[\s\S]*removePolyPointAttributes/);
  assert.match(source, /\["edge", "face"\]\.includes\(target\?\.type\)[\s\S]*kind: polyTabExtrudeHeld \? "edge-extrude" : "component"/);
  assert.match(source, /function updatePolyEdgeExtrusion[\s\S]*extrudePolyBoundaryEdge[\s\S]*nearestPolyWeldTarget[\s\S]*excludedIndices[\s\S]*stroke\.extrudeWeldPairs/);
  assert.match(source, /const loopExtrudeGesture = polyTabExtrudeHeld && event\.button === 1[\s\S]*kind:\s*"edge-loop-extrude"/);
  assert.match(source, /function updatePolyBoundaryLoopExtrusion[\s\S]*extrudePolyBoundaryEdgeLoop[\s\S]*loopExtrudedEdge/);
  assert.match(source, /\["component", "edge-extrude", "edge-loop-extrude"\][\s\S]*updatePolyBoundaryLoopExtrusion/);
  assert.match(html, /<strong>Tab\+middle-drag boundary edge<\/strong> extrude its full loop/);
  assert.match(source, /stroke\?\.kind === "edge-extrude"[\s\S]*stroke\.extrudeWeldPairs[\s\S]*weldPolyVertices[\s\S]*removePolyPointAttributes/);
  assert.match(source, /stroke\.kind === "edge-extrude"[\s\S]*updatePolyEdgeExtrusion/);
  assert.match(source, /function updatePolyBrushComponentHover[\s\S]*setPolyBrushHoveredComponent\(target\)[\s\S]*renderer\.domElement\.addEventListener\("pointermove", updatePolyBrushComponentHover\)/);
  assert.match(source, /function polyEdgeLoopCandidateForEvent[\s\S]*polyEdgeLoopPlan[\s\S]*new THREE\.Vector3\(cut\.point\.x, cut\.point\.y, cut\.point\.z\)/);
  const edgeLoopCandidateSource = source.slice(
    source.indexOf("function polyEdgeLoopCandidateForEvent"),
    source.indexOf("function showPolyEdgeLoopPreview")
  );
  assert.match(edgeLoopCandidateSource, /cutPointsByKey\.set\(cut\.key, desired\)[\s\S]*cutNormalsByKey\.set\(cut\.key, preferredNormal\)/);
  assert.doesNotMatch(edgeLoopCandidateSource, /projectPolyRelaxPoint/);
  assert.match(source, /function polyEdgeLoopCandidateForEvent[\s\S]*const mirrorMap = polyMirrorVertexMap\(points\)[\s\S]*mirroredEdge[\s\S]*const mirrorMap = polyMirrorVertexMap\(points\)[\s\S]*mirroredVertices/);
  assert.match(source, /function polyEdgeLoopCandidateForEvent[\s\S]*mirroredVector\(sourcePoint\)[\s\S]*mirroredVector\(sourceNormal\)\.normalize\(\)/);
  assert.match(source, /function polyRelaxMirrorMap\(lock\)[\s\S]*polyMirrorVertexMap\(lock\.points, \{ tolerance: recoveryTolerance \}\)/);
  assert.match(source, /kind:\s*"relax"[\s\S]*mirrorMap:\s*mirrorXEditing \? polyRelaxMirrorMap\(lock\) : null/);
  assert.match(source, /function updatePolyEdgeLoopPreview[\s\S]*event\.ctrlKey[\s\S]*showPolyEdgeLoopPreview/);
  assert.match(source, /function commitPolyEdgeLoop[\s\S]*insertPolyEdgeLoops/);
  assert.match(source, /function appendPolyEdgeLoopPointAttributes[\s\S]*pointWidths\[index\][\s\S]*pointScales\[index\][\s\S]*pointTwists\[index\][\s\S]*candidate\.cutNormalsByKey\.get\(key\)/);
  assert.match(source, /lock\.polyFaces = result\.faces;[\s\S]*appendPolyEdgeLoopPointAttributes\(lock, result, candidate\)/);
  assert.match(source, /stroke\?\.kind === "edge-loop"[\s\S]*commitPolyEdgeLoop/);
  assert.match(html, /<strong>Ctrl-click edge<\/strong> insert edge loop/);
  assert.match(source, /event\.key === "Tab"[\s\S]*activeTool === "poly"[\s\S]*polyTabExtrudeHeld = true[\s\S]*MESH_EDIT_MODES\.indexOf/);
  assert.match(source, /stroke\.kind === "draw" && !stroke\.drawStripsEnabled[\s\S]*stroke\.dragging = true/);
  assert.match(source, /polyFaces:\s*\["poly", "hair-shell"\]\.includes\(lock\.geometryType\)[\s\S]*normalizePolyFaces\(snapshot\.points/);
  assert.match(source, /if \(\["poly", "hair-shell"\]\.includes\(lock\.geometryType\)\) return createPolyGeometry\(lock\)/);
  const sidedMaterialSource = source.slice(
    source.indexOf("function strandUsesDoubleSidedMaterial"),
    source.indexOf("function applyMaterialDefinitionToLock")
  );
  assert.match(sidedMaterialSource, /lock\?\.geometryType === "braid"/);
  assert.doesNotMatch(sidedMaterialSource, /geometryType[^\n]*"poly"/);
  assert.match(source, /if \(includeCurves\)[\s\S]*!\["poly", "hair-shell"\]\.includes\(lock\.geometryType\)/);
  assert.match(topology, /export function appendPolyQuad[\s\S]*export function extrudePolyBoundaryEdge[\s\S]*export function polyBoundaryEdgeLoop[\s\S]*export function extrudePolyBoundaryEdgeLoop[\s\S]*export function polyBoundaryEdges[\s\S]*export function polyEdgeLoopPlan[\s\S]*export function insertPolyEdgeLoops/);
  assert.match(topology, /export function insertPolyEdgeLoops[\s\S]*export function weldPolyVertices[\s\S]*export function polyMeshBuffers/);
});

test("Meshes workspace can add a remembered primitive or choose one from a hold picker", async () => {
  const [html, source, css, primitives, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/mesh-primitives.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="meshPrimitiveTool"[\s\S]*id="addMeshPrimitive"[\s\S]*id="meshPrimitivePicker"/);
  assert.match(html, /id="strandObjectTransformPanel"[\s\S]*id="meshPrimitiveInitializationPanel"[\s\S]*data-primitive-setting="segmentsX"[\s\S]*data-primitive-setting="columns"[\s\S]*data-primitive-setting="radialSegments"[\s\S]*data-primitive-setting="resolution"/);
  assert.match(html, /data-mesh-primitive="cube"[\s\S]*data-mesh-primitive="plane"[\s\S]*data-mesh-primitive="cylinder"[\s\S]*data-mesh-primitive="sphere"/);
  assert.match(css, /\.mesh-primitive-picker\s*\{[\s\S]*left:\s*calc\(100% \+ 7px\)[\s\S]*display:\s*flex/);
  assert.match(source, /LAST_MESH_PRIMITIVE_PREFERENCE_KEY[\s\S]*MESH_PRIMITIVE_HOLD_MS = 280/);
  assert.match(source, /function meshPrimitiveSpawnOrigin\(points\)[\s\S]*new THREE\.Box3\(\)\.setFromObject\(scalp\)[\s\S]*const worldOrigin = new THREE\.Vector3\([\s\S]*scalpBounds\.max\.y - primitiveBounds\.min\.y \+ clearance[\s\S]*hairGroup\.worldToLocal\(worldOrigin\)/);
  assert.match(source, /function createMeshPrimitive\(type = lastMeshPrimitiveType\)[\s\S]*viewportEditMode !== "mesh"[\s\S]*const origin = meshPrimitiveSpawnOrigin\(data\.points\)[\s\S]*pushUndoState\(\)[\s\S]*modelingMeshType:\s*"primitive"[\s\S]*meshPrimitiveType: data\.type[\s\S]*meshPrimitiveSettings: data\.settings[\s\S]*selectLock\(lock\.id[\s\S]*setViewportSelectionMode\("object"\)/);
  assert.match(source, /function syncMeshPrimitiveInitializationPanel[\s\S]*lock\?\.modelingMeshType === "primitive"[\s\S]*normalizeMeshPrimitiveSettings[\s\S]*function applyMeshPrimitiveInitialization[\s\S]*createMeshPrimitiveData\(type, nextSettings\)[\s\S]*pushUndoState\(\)[\s\S]*updateLockGeometry\(lock, \{ immediate: true \}\)/);
  assert.match(source, /function createPolyGeometry\(lock\)[\s\S]*\["cube", "cylinder"\]\.includes\(lock\.meshPrimitiveType\)[\s\S]*splitMeshVerticesByFaceGroups[\s\S]*geometry\.userData\.quadFaces = buffers\.quadFaces[\s\S]*geometry\.userData\.renderQuadFaces = renderQuadFaces/);
  assert.match(source, /meshPrimitiveType: lock\.modelingMeshType === "primitive"[\s\S]*meshPrimitiveSettings:[\s\S]*meshPrimitiveOrigin:[\s\S]*modelingMeshType: \["primitive", "back-hair", "connected-strand-shell", "auto-remesh"\]/);
  assert.match(source, /function beginMeshPrimitivePicker[\s\S]*setPointerCapture[\s\S]*function updateMeshPrimitivePicker[\s\S]*elementFromPoint[\s\S]*function finishMeshPrimitivePicker[\s\S]*gesture\.hoveredType/);
  assert.match(source, /addMeshPrimitiveButton\.addEventListener\("pointerdown", beginMeshPrimitivePicker\)/);
  assert.match(source, /window\.addEventListener\("pointermove", updateMeshPrimitivePicker, true\)[\s\S]*window\.addEventListener\("pointerup", finishMeshPrimitivePicker, true\)/);
  assert.match(source, /meshPrimitiveTool\.classList\.toggle\("edit-mode-tool-hidden", !meshMode\)/);
  assert.match(primitives, /export const MESH_PRIMITIVE_TYPES[\s\S]*MESH_PRIMITIVE_DEFAULT_SETTINGS[\s\S]*normalizeMeshPrimitiveSettings[\s\S]*function cubeSurface[\s\S]*function cylinderData[\s\S]*function sphereData[\s\S]*export function splitMeshVerticesByFaceGroups[\s\S]*export function createMeshPrimitiveData/);
  assert.match(localization, /"Add primitive":[\s\S]*"Choose mesh primitive":[\s\S]*"Cube":[\s\S]*"Plane":[\s\S]*"Cylinder":[\s\S]*"Sphere":/);
});

test("Surface experiment is hidden and guarded while its legacy project path remains load-compatible", async () => {
  const [html, source, css, lattice] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/surface-lattice.js", import.meta.url), "utf8")
  ]);

  assert.match(
    html,
    /class="tool-button retired-experiment"[^>]*data-tool="surface"[^>]*hidden[^>]*aria-hidden="true"/
  );
  assert.match(
    html,
    /id=["']surfaceLatticeControls["'][\s\S]*Horizontal Points[\s\S]*id=["']surfaceLatticeColumns["'][^>]*min=["']3["'][^>]*max=["']11["'][^>]*step=["']2["'][\s\S]*Vertical Points[\s\S]*id=["']surfaceLatticeRows["']/
  );
  assert.match(html, /id=["']panelCurvatureControl["'][\s\S]*Horizontal Curvature[\s\S]*id=["']panelCurvature["']/);
  assert.match(css, /\.icon-surface\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*1fr\)/);
  assert.match(
    css,
    /#surfaceLatticeControls\.hidden,\s*#panelCurvatureControl\.hidden\s*\{[\s\S]*display:\s*none !important/
  );
  assert.match(source, /from "\.\/modules\/surface-lattice\.js\?v=20260727-5"/);
  assert.match(
    source,
    /function createSurfaceLockFromLattice\(points, options = \{\}\)[\s\S]*geometryType:\s*"surface"[\s\S]*updateLockGeometry\(lock\)/
  );
  assert.doesNotMatch(source, /centerX:\s*mirrorXEditing/);
  assert.match(
    source,
    /function createViewportSurface\(\) \{\s*return null;[\s\S]*createSurfaceLatticePointData\([\s\S]*createSurfaceLockFromLattice\(points/
  );
  assert.match(
    source,
    /if \(button\.dataset\.tool === "surface"\) createViewportSurface\(\)/
  );
  assert.doesNotMatch(source, /createDrawnSurface|createSurfaceLatticeFromStroke|outputType === "surface"/);
  assert.match(
    source,
    /function resampleSurfaceLock\(lock,\s*nextColumns,\s*nextRows\)[\s\S]*resampleSurfaceLatticePointData\([\s\S]*lock\.surfaceColumns = targetColumns[\s\S]*rebuildCurveObjects\(lock\)[\s\S]*syncActiveMirror\(lock/
  );
  assert.match(
    source,
    /surfaceColumns:\s*lock\.geometryType === "surface"[\s\S]*surfaceRows:\s*lock\.geometryType === "surface"/
  );
  assert.match(
    source,
    /const surfaceColumns = normalizeSurfaceLatticeCount\(snapshot\.surfaceColumns[\s\S]*const surfaceRows = normalizeSurfaceLatticeCount\(snapshot\.surfaceRows/
  );
  assert.match(source, /partner\.surfaceColumns = lock\.surfaceColumns[\s\S]*partner\.surfaceRows = lock\.surfaceRows/);
  assert.match(
    source,
    /function applySurfaceLatticeMirror\(lock,\s*pointIndex\)[\s\S]*mirroredSurfaceLatticePointIndex\([\s\S]*mirroredPoint\.set\(-point\.x,\s*point\.y,\s*point\.z\)/
  );
  assert.match(
    source,
    /function createPanelStrandGeometry\(lock\)[\s\S]*const latticeControlled = lock\.geometryType === "surface"[\s\S]*surfacePanelPoint\(/
  );
  assert.match(
    source,
    /function surfacePanelPoint\(lock,\s*t,\s*u,\s*shell = 0\)[\s\S]*shell \* thickness \* 0\.5/
  );
  assert.match(
    source,
    /panelCurvatureControl\.classList\.toggle\("hidden", Boolean\(selectedSurface\)\)[\s\S]*selectedSurface\.panelCurvature = 0/
  );
  assert.match(
    source,
    /lock\.panelCurvature = lock\.geometryType === "surface"\s*\?\s*0/
  );
  assert.match(
    source,
    /Lattice surfaces already use outward-facing parameter order\.\s*if \(!latticeControlled\) \{[\s\S]*indices\[index \+ 1\], indices\[index \+ 2\]/
  );
  assert.match(source, /new THREE\.LineSegments[\s\S]*surfaceLatticeWireSegments\(\s*lock\.points,\s*lock\.surfaceColumns,\s*lock\.surfaceRows/);
  assert.match(
    source,
    /function updateCurveObjects\(lock[\s\S]*syncLockedStrandWireVisual\(lock\)/
  );
  assert.doesNotMatch(source, /selectedSurfaceQuadPreview|hairTopologyVisible \|\| lock\.geometryType === "surface"/);
  assert.match(
    source,
    /indices\.push\(a, c, b, a, d, c\);[\s\S]*triangleEdgeMasks\.push\(\[1, 1, 0\], \[1, 0, 1\]\);[\s\S]*indices\.push\(a, b, c, a, c, d\);[\s\S]*triangleEdgeMasks\.push\(\[1, 0, 1\], \[1, 1, 0\]\)/
  );
  assert.match(
    source,
    /if \(lock\.geometryType === "surface"\) \{[\s\S]*surfaceObjectAnchor = new THREE\.Object3D\(\)[\s\S]*new THREE\.OctahedronGeometry\(0\.072, 0\)[\s\S]*surfaceObjectAnchorHandle\.position\.set\(0, -0\.18, 0\)/
  );
  assert.match(
    source,
    /function surfaceObjectAnchorPose\(lock\)[\s\S]*surfaceLatticeSampleVectors\(lock, 0\.5, 0\)[\s\S]*makeBasis\(x, y, z\)/
  );
  assert.match(
    source,
    /function selectSurfaceObjectAnchor\(lock[\s\S]*selectedSurfaceObjectAnchorId = lock\.id[\s\S]*attachSurfaceObjectAnchorTransform\(lock\)/
  );
  assert.match(
    source,
    /function updateSurfaceObjectTransform\(anchor\)[\s\S]*edit\.points\.forEach\([\s\S]*lock\.points\[index\]\.copy\(transformPoint\(point\)\)[\s\S]*lock\.pointSurfaceNormals = edit\.pointSurfaceNormals\.map\(transformNormal\)[\s\S]*syncActiveMirror\(lock\)/
  );
  assert.match(
    source,
    /surfaceAnchorSelected[\s\S]*tool === "relax" \|\| \(!surfaceAnchorSelected && \["rotate", "scale"\]\.includes\(tool\)\)/
  );
  assert.match(
    lattice,
    /function sampleCatmullRomLine\(points,\s*t\)[\s\S]*export function surfaceLatticeWireSegments\([\s\S]*sampleSurfaceLattice\(points/
  );
  assert.match(source, /function isPanelGeometry\(target\)[\s\S]*\["panel", "surface"\]\.includes\(target\?\.geometryType\)/);
});

test("retired lightweight strand collision has no UI or runtime entry point", async () => {
  const [html, source, constraints] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/strand-constraints.js", import.meta.url), "utf8")
  ]);

  assert.doesNotMatch(html, /strandCollisionToggle|lightweight strand collision|icon-collision|collision-button/i);
  assert.doesNotMatch(source, /strandCollision|resolveStrandCollisions|findSpatialCollisionPairs|closestPointsOnSegments/);
  assert.doesNotMatch(constraints, /findSpatialCollisionPairs|closestPointsOnSegments/);
});

test("transform gizmo picker volumes are deflated without shortening axis reach", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /const TRANSFORM_GIZMO_PICKER_DEFLATION = 0\.5;/);
  assert.match(source, /const TRANSFORM_GIZMO_AXIS_PICKER_DEFLATION = 0\.35;/);
  assert.doesNotMatch(source, /TRANSFORM_GIZMO_XZ_PICKER_LENGTH/);
  assert.match(source, /X:\s*\[1,\s*axisFactor,\s*axisFactor\]/);
  assert.match(source, /Y:\s*\[axisFactor,\s*1,\s*axisFactor\]/);
  assert.match(source, /Z:\s*\[axisFactor,\s*axisFactor,\s*1\]/);
  assert.match(source, /ringRadius \+ \(radialDistance - ringRadius\) \* factor/);
  assert.match(source, /geometry\.translate\(-center\.x,\s*-center\.y,\s*-center\.z\)/);
  assert.match(source, /deflateTransformGizmoPickers\(TRANSFORM_GIZMO_PICKER_DEFLATION\)/);
});

test("transform scale drags use restrained axis response and directional uniform response", async () => {
  const [html, source, css, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="transformToolPanel"[\s\S]*id="transformToolTitle"[\s\S]*class="transform-space-setting"[\s\S]*aria-label="Transform space"[\s\S]*id="pullMoveSetting"[\s\S]*id="scaleSensitivitySetting"[\s\S]*id="scaleSensitivity"[^>]*min="0\.05"[^>]*max="1"[^>]*value="0\.3"/);
  assert.match(html, /data-transform-space="world"[\s\S]*data-transform-space="object"[\s\S]*id="normalTransformSpaceButton"[^>]*data-transform-space="normal"[^>]*class="hidden"/);
  assert.match(css, /\.segmented-control\.normal-space-available\s*\{[\s\S]*grid-template-columns: repeat\(3, 1fr\)/);
  assert.match(css, /\.segmented-control button\.hidden,[\s\S]*\.segmented-control button\[hidden\][\s\S]*display: none/);
  assert.match(source, /function normalTransformSpaceAvailable\(\)[\s\S]*viewportEditMode === "mesh"[\s\S]*\["vert", "edge", "face"\]\.includes\(meshEditMode\)/);
  assert.match(source, /function syncTransformSpaceControls\(\)[\s\S]*normalTransformSpaceButton\.hidden = !normalAvailable[\s\S]*classList\.toggle\("hidden", !normalAvailable\)/);
  assert.match(source, /function setTransformSpaceEditing\(space\)[\s\S]*transformSpaceEditing[\s\S]*objectSpaceEditing = transformSpaceEditing === "object"[\s\S]*updateHairShellComponentOverlays\(\)/);
  assert.match(source, /function cycleTransformSpaceEditing\(\)[\s\S]*\["world", "object", "normal"\][\s\S]*setTransformSpaceEditing/);
  assert.match(source, /let scaleSensitivity = 0\.3;/);
  assert.match(source, /function setScaleSensitivity\(value\)[\s\S]*normalizeScaleSensitivity\(value\)[\s\S]*scaleSensitivityValue\.textContent/);
  assert.match(source, /scaleSensitivitySetting\.classList\.toggle\("hidden", activeTool !== "scale"\)/);
  assert.match(source, /transformControls\.addEventListener\("dragging-changed"[\s\S]*transformScaleDrag = \{[\s\S]*axis: transformControls\.axis,[\s\S]*startScale: transformControls\.object\?\.scale\.clone\(\) \|\| null,[\s\S]*startPointerX: pointerX,[\s\S]*startPointerY: pointerY,[\s\S]*lastPointerX: pointerX,[\s\S]*lastRawScale:[\s\S]*appliedScale:/);
  assert.match(source, /const MIN_UNIFORM_SCALE_RATIO = 0\.05;[\s\S]*const MAX_UNIFORM_SCALE_RATIO = 4;/);
  assert.match(source, /function applyReducedTransformScale\(handle\)[\s\S]*precision = transformPrecisionHeld \? TRANSFORM_PRECISION_MULTIPLIER : 1[\s\S]*drag\.axis === "XYZ"[\s\S]*horizontalDrag = drag\.pointerX - drag\.lastPointerX[\s\S]*upwardDrag = drag\.lastPointerY - drag\.pointerY[\s\S]*Math\.abs\(horizontalDrag\) >= Math\.abs\(upwardDrag\)[\s\S]*Math\.exp\(screenDrag \* 0\.01 \* scaleSensitivity \* precision\)[\s\S]*drag\.appliedScale\.multiplyScalar\(factor\)[\s\S]*adjustedRatio = 1 \+ \(rawRatio - 1\) \* scaleSensitivity \* precision/);
  assert.match(source, /function updateTransformScalePointer\(event\)[\s\S]*transformScaleDrag\.axis !== "XYZ"[\s\S]*transformScaleDrag\.pointerX = event\.clientX[\s\S]*transformScaleDrag\.pointerY = event\.clientY/);
  assert.match(source, /window\.addEventListener\("pointermove", updateTransformScalePointer, true\)/);
  assert.match(source, /transformControls\.addEventListener\("objectChange"[\s\S]*applyReducedTransformScale\(handle\)[\s\S]*applyUniformTransformScale\(handle\)/);
  assert.match(css, /#pullMoveSetting\.hidden,[\s\S]*#pullRigiditySetting\.hidden,[\s\S]*#pullCollisionSetting\.hidden,[\s\S]*#moveCurveControlsSetting\.hidden,[\s\S]*#scaleSensitivitySetting\.hidden[\s\S]*display: none !important/);
  assert.match(localization, /"Scale Sensitivity": "スケール感度"/);
  assert.doesNotMatch(source, /SCALE_SENSITIVITY_PREFERENCE_KEY/);
});

test("Move tool exposes independent segmented viewport curve controls and compact shape checkboxes", async () => {
  const [html, source, css, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="moveCurveControlsSetting"[\s\S]*class="move-curve-viewport-options"[\s\S]*class="move-curve-dual-button"[\s\S]*<span>Width<\/span>[\s\S]*id="moveWidthCurveControls" type="checkbox"[\s\S]*id="moveAsymmetricWidthLabel">Sym[\s\S]*id="moveAsymmetricWidth" type="checkbox"[\s\S]*<span>Depth<\/span>[\s\S]*id="moveDepthCurveControls" type="checkbox"[\s\S]*id="moveAsymmetricDepthLabel">Sym[\s\S]*id="moveAsymmetricDepth" type="checkbox"[\s\S]*<span>Twist<\/span>[\s\S]*id="moveTwistCurveControls" type="checkbox"/);
  assert.match(html, /id="moveCenterAsymmetricProfile" type="checkbox"/);
  assert.match(html, /id="moveGrabHandlesSetting"[\s\S]*>Grab Handles<[\s\S]*id="moveWidthGrabHandles" type="checkbox" checked[\s\S]*id="moveDepthGrabHandles" type="checkbox"[\s\S]*id="moveUniformGrabHandles" type="checkbox"/);
  assert.doesNotMatch(html, />Curve Shape<\/div>/);
  assert.doesNotMatch(html, />Asymmetric Width<\/span>|>Asymmetric Depth<\/span>/);
  assert.match(source, /const moveCurveControlVisibility = \{[\s\S]*taperCurve: false,[\s\S]*depthCurve: false,[\s\S]*twistCurve: false/);
  assert.match(source, /function moveCurveControlsApplicable[\s\S]*activeTool === "move"[\s\S]*componentEditModeActive\(\)/);
  assert.match(source, /function visibleTaperMeshCurveEdits[\s\S]*Object\.entries\(moveCurveControlVisibility\)[\s\S]*taperMeshPointsVisible/);
  assert.match(source, /function setSelectedMoveCurveShapeFlag[\s\S]*pushUndoState\(\)[\s\S]*editSelectedLocks[\s\S]*ensureSecondaryTaperCurve\(lock, curveKey\)[\s\S]*lock\[key\] = Boolean\(enabled\)/);
  assert.match(source, /function syncMoveCurveControls[\s\S]*setMixedControl\(control, null, values, Boolean\)/);
  assert.match(source, /const moveGrabHandleVisibility = \{[\s\S]*width: true,[\s\S]*depth: false,[\s\S]*uniform: false[\s\S]*function moveGrabHandleVisible\(dimension\)[\s\S]*moveGrabHandleVisibility\.uniform[\s\S]*dimension === "uniform"[\s\S]*function setMoveGrabHandleVisibility/);
  assert.match(source, /function syncMoveCurveControls[\s\S]*moveWidthGrabHandlesInput\.disabled = moveGrabHandleVisibility\.uniform[\s\S]*moveDepthGrabHandlesInput\.disabled = moveGrabHandleVisibility\.uniform/);
  assert.match(css, /\.move-curve-controls \{[\s\S]*display: grid[\s\S]*gap: 2px/);
  assert.match(css, /\.sliders label\.move-curve-checkbox \{[\s\S]*display: flex[\s\S]*justify-content: space-between[\s\S]*width: 100%[\s\S]*white-space: nowrap[\s\S]*\.sliders label\.move-curve-checkbox input \{[\s\S]*width: 14px[\s\S]*height: 14px/);
  assert.match(css, /\.move-curve-viewport-options \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)[\s\S]*gap: 4px/);
  assert.match(css, /\.move-curve-dual-button \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) 42px[\s\S]*\.move-curve-dual-button:has\(\.move-curve-control-segment input:checked\) \.move-curve-symmetry-segment[\s\S]*color: #9bdcff[\s\S]*\.move-curve-symmetry-segment:has\(input:checked\)[\s\S]*color: #ff7bdf[\s\S]*\.move-curve-dual-button:not\(:has\(\.move-curve-control-segment input:checked\)\) \.move-curve-symmetry-segment[\s\S]*color: #c9c2ca/);
  assert.match(css, /\.sliders \.move-curve-segment \{[\s\S]*grid-template-columns: 1fr[\s\S]*place-items: center[\s\S]*min-height: 22px[\s\S]*margin: 0 !important[\s\S]*\.sliders \.move-curve-segment > span \{[\s\S]*text-align: center[\s\S]*\.sliders \.move-curve-segment:has\(input:checked\)[\s\S]*background: #4b3724/);
  assert.match(localization, /"Viewport Curve Controls"/);
  assert.match(localization, /"Grab Handles"/);
});

test("Shift provides temporary precision for active transform gizmo drags", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /const TRANSFORM_PRECISION_MULTIPLIER = 0\.2/);
  assert.match(source, /transformControls\.addEventListener\("dragging-changed"[\s\S]*\["translate", "rotate"\]\.includes\(transformControls\.mode\)[\s\S]*transformPrecisionDrag = object[\s\S]*lastRawPosition:[\s\S]*appliedPosition:[\s\S]*lastRawQuaternion:[\s\S]*appliedQuaternion:/);
  assert.match(source, /function applyTransformPrecision\(handle\)[\s\S]*drag\.mode === "translate"[\s\S]*addScaledVector\([\s\S]*precision[\s\S]*drag\.mode !== "rotate"[\s\S]*localRotation = transformControls\.space === "local"[\s\S]*!\["E", "XYZE"\]\.includes\(transformControls\.axis\)[\s\S]*new THREE\.Quaternion\(\)\.slerp\(delta, precision\)/);
  assert.match(source, /transformControls\.addEventListener\("objectChange"[\s\S]*applyTransformPrecision\(handle\)[\s\S]*applyReducedTransformScale\(handle\)/);
  assert.match(source, /if \(event\.key === "Shift" && !event\.repeat\) \{[\s\S]*transformPrecisionHeld = true;[\s\S]*syncNavigationModifierLocks\(\)/);
  assert.match(source, /event\.key === "Shift"[\s\S]*transformDragging[\s\S]*\["translate", "rotate", "scale"\]\.includes\(transformControls\.mode\)[\s\S]*event\.preventDefault\(\)/);
  assert.match(source, /window\.addEventListener\("keyup"[\s\S]*event\.key === "Shift"[\s\S]*transformPrecisionHeld = false/);
  assert.match(source, /window\.addEventListener\("blur"[\s\S]*transformPrecisionHeld = false/);
});

test("transform gizmo picker debug overlay and C shortcut are retired", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.doesNotMatch(source, /transformGizmoPickerOverlayVisible|configureTransformGizmoPickerOverlay/);
  assert.doesNotMatch(source, /TRANSFORM_GIZMO_PICKER_COLORS|debugPickerOverlay/);
  assert.doesNotMatch(source, /event\.key\.toLowerCase\(\) === "c"/);
});

test("move and scale gizmos add visible rods for their negative axes", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /\["translate", "scale"\]\.forEach\(\(mode\)/);
  assert.match(source, /\["X", "Y", "Z"\]\.forEach\(\(axis\)/);
  assert.match(source, /negativeRod\.geometry\.applyMatrix4\(rotation\)/);
  assert.match(source, /negativeRod\.material\.color\.setHex\(TRANSFORM_GIZMO_DARK_AXIS_COLORS\[axis\]\)/);
  assert.match(source, /negativeRod\.userData\.negativeAxisRod = true/);
  assert.match(source, /addNegativeTransformGizmoRods\(\)/);
});

test("rotate gizmo adds dark full-circle axis guides", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /const TRANSFORM_GIZMO_DARK_AXIS_COLORS = Object\.freeze/);
  assert.match(source, /new THREE\.TorusGeometry\(0\.5,\s*0\.0055,\s*3,\s*64\)/);
  assert.match(source, /circle\.userData\.fullRotateAxisCircle = true/);
  assert.match(source, /addFullRotateGizmoAxisCircles\(\)/);
});

test("rotate gizmo removes the grey free-rotation ring and its hidden picker", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /\[transformGizmo\.gizmo\.rotate,\s*transformGizmo\.picker\.rotate\]\.forEach/);
  assert.match(source, /\.filter\(\(handle\) => handle\.name === "XYZE"\)/);
  assert.match(source, /removeRotateFreeAxisRing\(\)/);
  assert.doesNotMatch(source, /XYZE:\s*0x/);
});

test("object-space rotate gizmo keeps its drag-start frame until release", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(
    source,
    /const preserveDraggedObjectRotation = Boolean\([\s\S]*transformDragging[\s\S]*objectSpaceEditing[\s\S]*activeTool === "rotate"[\s\S]*activeHandleEdit\?\.lockId === lock\.id[\s\S]*transformControls\.object === handle/
  );
  assert.match(
    source,
    /if \(frame\) \{\s*if \(!preserveDraggedObjectRotation\) handle\.quaternion\.copy\(frame\.quaternion\);\s*\} else \{\s*handle\.quaternion\.identity\(\)/
  );
  assert.match(
    source,
    /transformControls\.addEventListener\("dragging-changed", \(event\) => \{\s*transformDragging = event\.value;[\s\S]*flushPendingLockGeometryUpdates\(\)/
  );
});

test("control point hover is opaque while selected control points are yellow", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /const CONTROL_POINT_SELECTED_COLOR = 0xffd84d/);
  assert.match(source, /controlPointHoverOverlay = new THREE\.Mesh\([\s\S]*transparent:\s*false[\s\S]*opacity:\s*1/);
  assert.match(source, /controlPointHoverOverlay\.material\.color\.copy\(hoveredControlPoint\.material\.color\)/);
  assert.match(source, /controlPointHoverOverlay\.scale\.setScalar\(1\.06\)/);
  assert.match(source, /controlPointHoverOverlay\.raycast = \(\) => \{\}/);
  assert.match(source, /if \(selectedHandle\) return CONTROL_POINT_SELECTED_COLOR/);
  assert.match(source, /handle\.material\.color\.set\(isSelected \? CONTROL_POINT_SELECTED_COLOR/);
  assert.match(source, /if \(selected\) handle\.material\.color\.set\(CONTROL_POINT_SELECTED_COLOR\)/);
  assert.match(source, /if \(pointerHitsTransformGizmo\(event\)\)/);
  assert.match(source, /raycaster\.intersectObjects\(targets,\s*false\)/);
  assert.match(source, /addEventListener\("pointermove",\s*updateControlPointHover\)/);
  assert.match(
    source,
    /addEventListener\("pointerleave",\s*\(\) => \{[\s\S]*setHoveredControlPoint\(null\)[\s\S]*setCurveLatticeLoopHover\(null\)[\s\S]*\}\)/
  );
});

test("Loft Surface experiment is hidden and blocked while its prototype math remains recoverable", async () => {
  const [html, source, css, lattice] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/surface-lattice.js", import.meta.url), "utf8")
  ]);

  assert.match(
    html,
    /class="tool-button retired-experiment"[^>]*data-tool="surface-loft"[^>]*hidden[^>]*aria-hidden="true"/
  );
  assert.match(source, /RETIRED_CURVE_LATTICE_SURFACE_TOOLS = new Set\(\["surface", "surface-loft"\]\)/);
  assert.match(source, /if \(RETIRED_CURVE_LATTICE_SURFACE_TOOLS\.has\(tool\)\) tool = "select"/);
  assert.match(
    html,
    /id="loftSurfaceToolPanel"[\s\S]*id="loftHorizontalStep"[\s\S]*Draw horizontal curve[\s\S]*id="loftVerticalStep"[\s\S]*Draw vertical curve[\s\S]*id="resetLoftSurfaceDraft"/
  );
  assert.match(css, /\.icon-loft-surface::before,[\s\S]*\.loft-surface-steps li\.active/);
  assert.match(
    lattice,
    /export function createLoftSurfaceLatticePointData\([\s\S]*horizontalPoints[\s\S]*verticalPoints[\s\S]*surfaceLatticePointIndex/
  );
  assert.match(
    source,
    /function beginLoftSurfaceStroke\(event, hit\)[\s\S]*stage: loftSurfaceDraft\.horizontalPoints \? "vertical" : "horizontal"/
  );
  assert.match(
    source,
    /function finishLoftSurfaceStroke\(event, options = \{\}\)[\s\S]*createLoftSurfaceLatticePointData\([\s\S]*createSurfaceLockFromLattice\(points,[\s\S]*setActiveTool\("move"\)/
  );
  assert.match(source, /window\.addEventListener\("pointermove", updateLoftSurfaceStroke\)/);
  assert.match(source, /window\.addEventListener\("pointerup", finishLoftSurfaceStroke\)/);
  assert.match(source, /activeTool === "surface-loft" && cancelLoftSurfaceDraft\(\)/);
  assert.match(
    source,
    /const leavingLoftSurface = activeTool === "surface-loft" && tool !== "surface-loft";[\s\S]*cancelLoftSurfaceDraft\(\)/
  );
});

test("strand curve control points de-emphasize and support branching hover in Draw Strand", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /const STRAND_CONTROL_POINT_RADIUS_SCALE = 0\.85;/);
  assert.match(source, /const STRAND_CONTROL_POINT_DRAW_TOOL_SCALE = 0\.5;/);
  assert.match(source, /0\.052 \* STRAND_CONTROL_POINT_RADIUS_SCALE/);
  assert.match(
    source,
    /const STRAND_CONTROL_POINT_MIN_PICK_RADIUS = 0\.065;[\s\S]*function strandControlPointRaycast\(raycaster, intersections\)[\s\S]*intersectSphere\([\s\S]*handle\.raycast = strandControlPointRaycast/
  );
  assert.match(
    source,
    /const STRAND_CONTROL_POINT_MIN_PICK_PIXELS = 12;[\s\S]*function strandControlPointHitFromEvent\(event, lock = getSelectedLock\(\)\)[\s\S]*handle\.getWorldPosition\([\s\S]*\.project\(camera\)[\s\S]*screenDistance > STRAND_CONTROL_POINT_MIN_PICK_PIXELS/
  );
  assert.match(
    source,
    /function prepareCurvePointSelection\(event\)[\s\S]*const hit = adaptiveRemeshControlPointHitFromEvent\(event\)[\s\S]*strandControlPointHitFromEvent\(event, selectedLock\)[\s\S]*activateStrandControlPoint\(hit\.object, event\)/
  );
  assert.match(
    source,
    /function strandControlPointHit\(event, lock = getSelectedLock\(\)\) \{\s*return strandControlPointHitFromEvent\(event, lock\)/
  );
  assert.match(
    source,
    /handle\.raycast = brushDebugVisible\s*\? sculptBrushDebugRaycast\s*:\s*strandControlPointRaycast/
  );
  assert.doesNotMatch(source, /index === 0 \? 0\.065 : 0\.052/);
  assert.match(
    source,
    /const deEmphasizeControlPoints = \["draw", "radial-draw", "procedural-draw", "braid", "panel"\]\.includes\(activeTool\)[\s\S]*controlPointDisplayScale[\s\S]*handle\.scale\.set\([\s\S]*controlPointDisplayScale[\s\S]*handle\.material\.color\.getHSL\(hsl\)[\s\S]*hsl\.s \* 0\.28[\s\S]*deEmphasizeControlPoints[\s\S]*\? 0\.18/
  );
  assert.match(
    source,
    /function visibleControlPointHoverTargets\(\)[\s\S]*lock\?\.curveObjects\?\.group\.visible[\s\S]*\["draw", "radial-draw"\]\.includes\(activeTool\)[\s\S]*!\["procedural-draw", "braid", "panel"\]\.includes\(activeTool\)[\s\S]*targets\.push\(\.\.\.lock\.curveObjects\.handles\.filter\(\(handle\) => !handle\.userData\.hairShellCurveRoot\)\)/
  );
  assert.match(
    source,
    /activeTool = tool;[\s\S]*\["draw", "radial-draw", "crown-grow", "procedural-draw", "braid", "panel", "curve-surface", "silhouette-volume", "scalp-draw"\]\.includes\(activeTool\)[\s\S]*setHoveredControlPoint\(null\)/
  );
  assert.match(
    source,
    /function activateStrandControlPoint\(handle, event\)[\s\S]*selectCurvePoint\(handle\.userData\.lockId, handle\.userData\.pointIndex, preserveMulti\)[\s\S]*attachTransformForCurvePoint\(getSelectedLock\(\), handle\.userData\.pointIndex, handle\)/
  );
  assert.match(
    source,
    /function activateStrandControlPoint\(handle, event\)[\s\S]*selectCurvePoint\([\s\S]*if \(activeTool === "select"\) \{\s*transformControls\.detach\(\);\s*return true;\s*\}[\s\S]*attachTransformForCurvePoint/
  );
  assert.match(
    source,
    /function prepareCurvePointSelection\(event\)[\s\S]*\["place", "draw", "radial-draw", "procedural-draw", "braid", "panel", "surface-loft", "surface-guide"\]\.includes\(activeTool\)[\s\S]*pointRemovalCandidate[\s\S]*activateStrandControlPoint\(hit\.object, event\)[\s\S]*event\.stopImmediatePropagation\(\)/
  );
  assert.doesNotMatch(
    source,
    /function prepareCurvePointSelection\(event\)[\s\S]{0,700}\["select", "place", "draw"/
  );
  assert.match(
    source,
    /const surfaceAnchorHit = modelingClick && surfaceAnchorHandle && surfaceAnchorHandle\.visible !== false[\s\S]*raycaster\.intersectObject\(surfaceAnchorHandle, false\)/
  );
  assert.doesNotMatch(source, /surfaceAnchorHandle\?\.visible !== false/);
});

test("tapping proportional edit restores transform controls for the selected point", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(
    source,
    /function setProportionalEditing\(enabled\)[\s\S]*refreshCapsuleGuideLoopInfluence\(\);[\s\S]*updateInteractionLocks\(\);[\s\S]*updateAttributeEditorMode\(\)/
  );
  assert.match(
    source,
    /proportionalHotkeyPress = null;[\s\S]*endProportionalSizeEdit\(\);[\s\S]*setProportionalEditing\(!press\.wasEnabled\)/
  );
  assert.match(
    source,
    /function proportionalStrandVisualsActive\(lock\)[\s\S]*proportionalEditing[\s\S]*\["move", "rotate", "scale", "relax"\]\.includes\(activeTool\)[\s\S]*selectedPoint\?\.lockId === lock\.id/
  );
  assert.match(
    source,
    /function setActiveTool\(tool\)[\s\S]*const previousTool = activeTool[\s\S]*proportionalVisualStateChanged[\s\S]*refreshProportionalStrandColors\(\)/
  );
  assert.match(source, /function strandInfluenceColor\(lock, t,[\s\S]*!proportionalStrandVisualsActive\(lock\)/);
  assert.match(
    source,
    /function updateProportionalInfluenceColors\(lock\)[\s\S]*getAttribute\?\.\("color"\)[\s\S]*colorAttribute\.setXYZ[\s\S]*colorAttribute\.needsUpdate = true/
  );
  assert.match(
    source,
    /function selectPointsInMarquee\(drag\)[\s\S]*selectedPoint = null;[\s\S]*if \(proportionalEditing \|\| proportionalPreviewLockId\) refreshProportionalStrandColors\(\)[\s\S]*updateCurveObjects/
  );
  assert.match(source, /const proportionalInfluenceColorCaches = new WeakMap\(\)[\s\S]*cache\.colors\.get\(key\)[\s\S]*cache\.colors\.set\(key, color\)/);
  assert.match(
    source,
    /function beginHandleEdit\([\s\S]*proportionalWeights: proportionalEditing[\s\S]*lock\.points\.map[\s\S]*function applyProportionalMove[\s\S]*edit\.proportionalWeights\?\.\[i\][\s\S]*addScaledVector\(delta, weight\)/
  );
  assert.match(
    source,
    /function refreshProportionalPreview\(\)[\s\S]*refreshProportionalStrandColors\(\)[\s\S]*updateCurveObjects\(selectedLock/
  );
  assert.doesNotMatch(
    source,
    /function refreshProportionalPreview\(\)[\s\S]*locks\.forEach\(\(lock\) => updateLockGeometry\(lock\)\)/
  );
  assert.match(
    source,
    /transformControls\.addEventListener\("objectChange"[\s\S]*if \(!transformDragging\) syncInputs\(lock\)/
  );
});

test("strand relax independently smooths point positions and authored rotations", async () => {
  const [html, source, localization, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="relaxToolPanel"[\s\S]*id="relaxPosition"[^>]*checked[\s\S]*id="relaxRotation"[^>]*checked/);
  assert.match(source, /relaxToolPanel\.classList\.toggle\("hidden", activeTool !== "relax"\)/);
  assert.match(css, /#transformToolPanel\.hidden,[\s\S]*#relaxToolPanel\.hidden,[\s\S]*#placeStrandToolPanel\.hidden[\s\S]*display:\s*none/);
  assert.match(source, /activeTool === "relax"\) panel = relaxToolPanel/);
  assert.match(localization, /"Smooth curve-point positions and their width and depth scales\.":[\s\S]*"Smooth authored curve-point rotations without requiring position relaxation\.":/);

  assert.match(
    source,
    /function beginRelaxEdit\(lock, pointIndex, event\)[\s\S]*relaxPositionInput\.checked[\s\S]*relaxRotationInput\.checked[\s\S]*if \(!relaxPosition && !relaxRotation\) return false[\s\S]*relaxPosition,[\s\S]*relaxRotation/
  );
  assert.match(
    source,
    /function updateRelaxEdit\(event\)[\s\S]*if \(relaxEdit\.relaxPosition\)[\s\S]*curvedRelaxPositionTarget\(sourcePoints, index\)[\s\S]*relaxedPoints\[index\]\.lerp\([\s\S]*if \(relaxEdit\.relaxRotation\)[\s\S]*relaxAngleValue\([\s\S]*if \(relaxEdit\.relaxRotation\) lock\.pointTwists\[index\] = relaxedTwists\[index\]/
  );
  assert.match(
    source,
    /function beginRelaxEdit\(lock, pointIndex, event\)[\s\S]*proportionalWeights: proportionalEditing[\s\S]*lock\.points\.map\(\(_, index\) => proportionalWeight\(index, pointIndex\)\)[\s\S]*function updateRelaxEdit\(event\)[\s\S]*relaxEdit\.proportionalWeights\[index\]/
  );
});

test("strand curve root and tip use distinct endpoint colors without a gradient", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /const endpointIndex = lock\.geometryType === "curve-surface"[\s\S]*const endpointCount = lock\.geometryType === "curve-surface"[\s\S]*const endpointColor = endpointIndex === 0[\s\S]*0x8298ff[\s\S]*endpointIndex === endpointCount - 1[\s\S]*0x62edb0[\s\S]*UI_ACCENT_COLOR/);
  assert.match(source, /if \(selectedHandle\) return CONTROL_POINT_SELECTED_COLOR;/);
  assert.match(source, /return endpointColor;/);
});

test("strand control frames preserve authored normal orientation while points move across the world origin", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(
    source,
    /function transportedStrandFrameAt\(lock, curve, t, options = \{\}\)[\s\S]*stepCount[\s\S]*strandGeometryFrameAt\([\s\S]*clampedT \* step \/ stepCount[\s\S]*frame/
  );
  assert.match(
    source,
    /function strandGeometryFrameAt\([\s\S]*makeBasis\(x, tangent, z\)[\s\S]*quaternion: new THREE\.Quaternion\(\)\.setFromRotationMatrix\(matrix\)/
  );
  assert.match(
    source,
    /function curveFrameAtPoint\(lock, pointIndex\)[\s\S]*transportedStrandFrameAt\([\s\S]*strandBaseCurve\(frameLock\)/
  );
  assert.match(
    source,
    /function guidedNormalAt\(lock, point, tangent, t\)[\s\S]*if \(fallback\.dot\(sampled\) < 0\) fallback\.negate\(\)/
  );
  assert.doesNotMatch(
    source,
    /function guidedNormalAt\(lock, point, tangent, t\)[\s\S]{0,900}sampled\.dot\(fallback\)[\s\S]{0,80}sampled\.negate\(\)/
  );
  assert.match(
    source,
    /function twistFromHandle\(lock, pointIndex, handle\)[\s\S]*transportedStrandFrameAt\([\s\S]*twistOverride: 0/
  );
  assert.match(
    source,
    /function beginHandleEdit\(handle = transformControls\.object\)[\s\S]*pointSurfaceNormals: lock\.pointSurfaceNormals\?\.map\(\(normal\) => normal\?\.clone\?\.\(\) \|\| null\)[\s\S]*function applyHierarchicalRotate\(lock, pointIndex, handle\)[\s\S]*rotateGuideNormal[\s\S]*applyQuaternion\(rotation\)\.normalize\(\)[\s\S]*pointIndex === range\.start[\s\S]*lock\.pointTwists\[i\] = edit\.pointTwists\[i\][\s\S]*return;[\s\S]*const deltaTwist/
  );
  assert.match(
    source,
    /function syncUnifiedCurveSurfaceMirror\(lock, sourcePointIndex, tool = activeTool\)[\s\S]*tool === "rotate"[\s\S]*lock\.points\[index\]\.distanceToSquared\(edit\.points\[index\]\)[\s\S]*controllerRoot[\s\S]*!\(tool === "rotate" && controllerRoot\)/
  );
});

test("rotate and relax tools use compact line-and-cone curve normal indicators", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(
    source,
    /function createCurveNormalIndicator\(sharedGeometries = null\)[\s\S]*new THREE\.Line\([\s\S]*new THREE\.ConeGeometry\(0\.075, 0\.24, 10\)[\s\S]*indicator\.add\(shaft, cone\)/
  );
  assert.match(
    source,
    /const length = 0\.13 \+ scale \* 0\.06;[\s\S]*arrow\.scale\.setScalar\(length\)[\s\S]*arrow\.quaternion\.setFromUnitVectors[\s\S]*\["rotate", "relax"\]\.includes\(activeTool\)/
  );
  assert.doesNotMatch(source, /createOutlineArrowGeometry/);
});

test("hair card toggle sweeps the upper authored profile arc as an open double-sided quad surface", async () => {
  const [html, source, localization, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /id=["']hairCardControl["'][\s\S]*?id=["']hairCard["'][^>]*type=["']checkbox["']/);
  assert.match(html, /id=["']strandProfileLabel["'][\s\S]*?id=["']hairCardControl["']/);
  assert.match(html, /id=["']strandHairCardCoveragePreview["'][^>]*class=["'][^"']*hair-card-coverage-path/);
  assert.match(html, /id=["']sweepProfileHairCardCoveragePath["'][^>]*class=["'][^"']*hair-card-coverage-path/);
  assert.match(source, /function createHairCardGeometry\(lock, curve, profilePoints\)/);
  assert.match(source, /upperProfileArcIndices\(closedTopology\.samples\.map\(\(sample\) => sample\.point\)\)/);
  assert.match(source, /strandRadiusAt\(lock, t, "x", 1, profile\.x\)/);
  assert.match(source, /strandRadiusAt\(lock, t, "z", 1, profile\.z\)/);
  assert.match(source, /quadFaces\.push\(\[a, c, d, b\]\)/);
  assert.match(source, /geometry\.userData\.quadFaces = quadFaces/);
  assert.match(source, /geometry\.userData\.openSurface = true/);
  assert.match(source, /lock\.geometryType === "strand" && lock\.hairCard[\s\S]*createHairCardGeometry\(lock, curve, profilePoints\)/);
  assert.match(source, /function strandUsesDoubleSidedMaterial\(lock\)[\s\S]*lock\?\.hairCard[\s\S]*THREE\.DoubleSide/);
  assert.match(source, /const hairCardIncompatibleControls = \[\s*"#strandSplitControls"\s*\]/);
  assert.match(source, /hairCardIncompatibleControls\.forEach\(\(control\) => control\.classList\.toggle\("hair-card-hidden", enabled\)\)/);
  assert.match(source, /hairCardInput\.addEventListener\("change"/);
  assert.match(source, /function renderHairCardCoveragePath\(path, profile, visible, mapPoint\)/);
  assert.match(source, /renderHairCardCoveragePath\(\s*sweepProfileHairCardCoveragePath/);
  assert.match(css, /\.hair-card-coverage-path,[\s\S]*?stroke:\s*#ffd84d/);
  assert.match(localization, /"Hair Card":\s*"\\u30d8\\u30a2\\u30ab\\u30fc\\u30c9"/);
  assert.match(css, /\.hair-card-hidden\s*\{[\s\S]*?display:\s*none !important;/);
});

test("hair card state propagates through defaults, drawing, mirrors, history, projects, and presets", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /const strandCreationDefaults = \{[\s\S]*?hairCard: false/);
  assert.match(source, /lock\.hairCard = Boolean\(base\.hairCard\)/);
  assert.match(source, /hairCard: extensionLock\?\.hairCard \?\? Boolean\(strandCreationDefaults\.hairCard\)/);
  assert.match(source, /hairCard: Boolean\(setting\("hairCard", stroke\.hairCard \?\? strandCreationDefaults\.hairCard\)\)/);
  assert.match(source, /partner\.hairCard = Boolean\(lock\.hairCard\)/);
  assert.match(source, /hairCard: Boolean\(snapshot\.hairCard\)/);
  assert.match(source, /hairCard: Boolean\(source\.hairCard\)/);
  assert.match(source, /"profileTrimRoundness", "hairCard"/);
});

test("reference images support viewport overlays and transformable 3D planes with persistence", async () => {
  const [html, source, css, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id=["']referenceMenuToggle["'][\s\S]*?id=["']referenceMenu["'][\s\S]*?id=["']createViewportReferenceMenu["'][\s\S]*?Create 2D Viewport Reference[\s\S]*?id=["']createPlaneReferenceMenu["'][\s\S]*?Create 3D Plane Reference/);
  assert.doesNotMatch(html, /id=["']materialsMenuToggle["']|id=["']materialsMenu["']|id=["']referenceImagesMode["']/);
  assert.match(html, /id=["']referenceImageFile["'][^>]*accept=["'][^"']*image\/png/);
  assert.match(html, /id=["']viewportReferenceImages["'][^>]*class=["']viewport-reference-images["']/);
  assert.match(html, /id=["']referenceImageDropTarget["'][^>]*class=["']reference-image-drop-target["'][\s\S]*?data-reference-drop-target=["']front["'][\s\S]*?data-reference-drop-target=["']back["'][\s\S]*?data-reference-drop-target=["']left["'][\s\S]*?data-reference-drop-target=["']right["'][\s\S]*?id=["']referenceOverlayDropMarker["']/);
  assert.doesNotMatch(html, /reference-image-drop-card[^>]*data-reference-drop-target=["']overlay["']/);
  assert.match(html, /id=["']referenceImagePanel["'][\s\S]*?id=["']addViewportReference["'][\s\S]*?id=["']addPlaneReference["']/);
  assert.match(html, /id=["']strandOutlinerTab["'][\s\S]*?id=["']guideOutlinerTab["'][\s\S]*?id=["']referenceOutlinerTab["'][\s\S]*?id=["']guideOutliner["'][\s\S]*?id=["']referenceOutliner["']/);
  assert.match(html, /id=["']referenceOutlinerTab["'][^>]*title=["']References["'][^>]*aria-label=["']References["'][^>]*>Ref<\/button>/);
  assert.match(html, /id=["']referenceImageType["'][\s\S]*?value=["']overlay["'][\s\S]*?value=["']plane["']/);
  assert.match(html, /<div class=["']toggle-row reference-visibility-row["'][\s\S]*?<input id=["']referenceImageVisible["'][^>]*aria-label=["']Visible["']/);
  assert.doesNotMatch(html, /<label[^>]*for=["']referenceImageVisible["']/);
  assert.match(html, /id=["']referenceImageFlipX["'][^>]*aria-pressed=["']false["'][^>]*>Flip Horizontal<\/button>/);
  assert.doesNotMatch(html, /data-tool=["']crop["']|Crop reference tool/);
  assert.match(html, /id=["']referenceCropHandles["'][^>]*class=["']reference-crop-handles hidden["'][\s\S]*?data-crop-anchor=["']nw["'][\s\S]*?data-crop-anchor=["']ne["'][\s\S]*?data-crop-anchor=["']se["'][\s\S]*?data-crop-anchor=["']sw["']/);
  assert.doesNotMatch(html, /data-crop-anchor=["'](?:n|e|s|w)["']/);
  assert.match(css, /\.reference-crop-handles > span\s*\{[\s\S]*width: 40px[\s\S]*border: 0[\s\S]*background: transparent/);
  assert.doesNotMatch(html, /crop-picker-debug/);
  assert.doesNotMatch(css, /#ff3030|#8fcf00|reference-overlay-scale-handle::after/);
  assert.match(css, /\.reference-crop-handles > span:hover::before\s*\{[\s\S]*border-color: #fff2aa[\s\S]*drop-shadow/);
  assert.match(css, /\[data-crop-anchor="nw"\]\s*\{[\s\S]*translate\(calc\(-100% - 18px\), calc\(-100% - 18px\)\)[\s\S]*\[data-crop-anchor="nw"\]::before[\s\S]*border-right-width: 3px[\s\S]*border-bottom-width: 3px/);
  assert.match(css, /\[data-crop-anchor="se"\]\s*\{[\s\S]*translate\(18px, 18px\)[\s\S]*\[data-crop-anchor="se"\]::before[\s\S]*border-top-width: 3px[\s\S]*border-left-width: 3px/);
  assert.match(html, /id=["']resetReferenceImageCrop["'][^>]*>Reset Crop<\/button>/);
  assert.match(html, /id=["']referenceImageView["'][\s\S]*?value=["']front["'][\s\S]*?value=["']back["'][\s\S]*?value=["']left["'][\s\S]*?value=["']right["']/);
  assert.match(html, /id=["']referenceImageSnappedViewOnlyRow["'][\s\S]*?id=["']referenceImageSnappedViewOnlyLabel["'][\s\S]*?id=["']referenceImageSnappedViewOnly["'][^>]*type=["']checkbox["']/);
  assert.match(html, /<div id=["']referencePlaneInFrontRow["'][^>]*class=["']toggle-row["'][\s\S]*?<input id=["']referencePlaneInFront["'][^>]*checked/);
  assert.match(source, /function createReferenceImageRuntime\(reference\)[\s\S]*reference\.type === "overlay"[\s\S]*new THREE\.PlaneGeometry/);
  assert.match(source, /new THREE\.TextureLoader\(\)\.load\([\s\S]*reference\.source,[\s\S]*\(\) => applyReferenceImageRuntime\(reference\)/);
  assert.match(source, /if \(texture\.image\) texture\.needsUpdate = true/);
  assert.match(source, /new THREE\.MeshBasicMaterial\(\{[\s\S]*map: texture[\s\S]*side: THREE\.DoubleSide[\s\S]*depthWrite: false/);
  assert.match(source, /front: \{ position: \[0, 0\.8, 2\.4\]/);
  assert.match(source, /back: \{ position: \[0, 0\.8, -2\.4\]/);
  assert.match(source, /left: \{ position: \[-2\.4, 0\.8, 0\], rotation: \[0, -Math\.PI \/ 2, 0\]/);
  assert.match(source, /right: \{ position: \[2\.4, 0\.8, 0\], rotation: \[0, Math\.PI \/ 2, 0\]/);
  assert.match(source, /"1,0,0": "right"[\s\S]*"-1,0,0": "left"/);
  assert.match(source, /left: \{ axis: "x", sign: -1 \}[\s\S]*right: \{ axis: "x", sign: 1 \}/);
  assert.match(source, /const planeInFront = snapshot\.planeInFront !== false/);
  assert.match(source, /planeInFront: reference\.planeInFront !== false/);
  assert.match(source, /flipX: Boolean\(snapshot\.flipX\)/);
  assert.match(source, /flipX: Boolean\(reference\.flipX\)/);
  assert.match(source, /flipPivotX: normalizeReferenceFlipPivotX\(crop, snapshot\.flipPivotX\)/);
  assert.match(source, /flipPivotX: normalizeReferenceFlipPivotX\(reference\.crop, reference\.flipPivotX\)/);
  assert.match(source, /const crop = normalizeReferenceCrop\(snapshot\.crop\)[\s\S]*flipPivotX: normalizeReferenceFlipPivotX\(crop, snapshot\.flipPivotX\)[\s\S]*crop,/);
  assert.match(source, /crop: \{ \.\.\.normalizeReferenceCrop\(reference\.crop\) \}/);
  assert.match(source, /reference\.imageElement\.style\.transform = reference\.flipX \? "scaleX\(-1\)" : "none"/);
  assert.match(source, /reference\.imageElement\.style\.transformOrigin = `\$\{referenceCropHorizontalFlipOffset\(crop, reference\.flipPivotX\) \* 50\}% 50%`/);
  assert.match(source, /referencePlaneCropGeometryData[\s\S]*from "\.\/modules\/reference-plane-crop\.js/);
  assert.match(source, /function createReferencePlaneCropGeometry\(reference\)[\s\S]*new THREE\.BufferGeometry\(\)[\s\S]*setAttribute\("position"[\s\S]*setAttribute\("uv"/);
  assert.match(source, /function updateReferencePlaneCropGeometry\(reference\)[\s\S]*reference\.mesh\.geometry = geometry[\s\S]*reference\.selectionOutline\.geometry = new THREE\.EdgesGeometry\(geometry\)/);
  assert.match(source, /function referencePlaneCropCenterPoint\(reference\)[\s\S]*\(crop\.left \+ crop\.right\) \* 0\.5[\s\S]*\(crop\.top \+ crop\.bottom\) \* 0\.5/);
  assert.match(source, /function referencePlanePivotPosition\(reference\)[\s\S]*referencePlaneCropCenterPoint\(reference\)[\s\S]*multiplyScalar\(Number\(reference\?\.scale \|\| 1\)\)[\s\S]*return position\.add\(offset\)/);
  assert.match(source, /function referencePlaneAuthoredPositionForPivot\(reference, pivot\)[\s\S]*return authoredPosition\.sub\([\s\S]*referencePlaneCropCenterPoint\(reference\)/);
  assert.match(source, /reference\.mesh\.position\.copy\(drawingPanel[\s\S]*referencePlanePivotPosition\(reference\)\)/);
  assert.match(source, /function syncReferenceImageFromMesh\(reference\)[\s\S]*referencePlaneAuthoredPositionForPivot\(reference, reference\.mesh\.position\)[\s\S]*reference\.position = \{/);
  assert.match(source, /texture\.wrapS = THREE\.ClampToEdgeWrapping[\s\S]*texture\.repeat\.x = reference\.flipX \? -1 : 1[\s\S]*referenceCropHorizontalFlipOffset\(crop, reference\.flipPivotX\)/);
  assert.match(source, /referenceImageFlipX\.addEventListener\("click"[\s\S]*pushUndoState\(\)[\s\S]*reference\.flipX = !reference\.flipX[\s\S]*reference\.flipPivotX = \(crop\.left \+ crop\.right\) \* 0\.5/);
  assert.match(source, /function beginReferenceCrop\(event\)[\s\S]*\["overlay", "plane"\]\.includes\(reference\?\.type\)[\s\S]*reference\.greasePencilLayer/);
  assert.match(source, /function referenceCropSourcePoint\(event, drag\)[\s\S]*drag\.type === "plane"[\s\S]*raycaster\.ray\.intersectPlane[\s\S]*referencePlaneCropCoordinateFromPoint/);
  assert.match(source, /function referenceCropAnchorScreenPositions\(reference\)[\s\S]*referencePlanePointFromCropCoordinate[\s\S]*\.project\(camera\)/);
  assert.match(source, /const REFERENCE_CROP_ANCHORS = Object\.freeze\(\["nw", "ne", "se", "sw"\]\)/);
  assert.match(source, /const directAnchor = event\.target\.closest\?\.\("\[data-crop-anchor\]"\)[\s\S]*REFERENCE_CROP_ANCHORS\.includes\(directAnchor\) \? directAnchor : null/);
  assert.doesNotMatch(source, /REFERENCE_CROP_HANDLE_HIT_RADIUS|referenceCropAnchorAtPointer/);
  assert.match(source, /function updateReferenceCrop\(event\)[\s\S]*pushUndoState\(\)[\s\S]*reference\.crop = normalizeReferenceCrop/);
  assert.match(source, /function finishReferenceCrop\(event, \{ cancel = false \} = \{\}\)[\s\S]*drag\.startCrop/);
  assert.match(source, /resetReferenceImageCrop\.addEventListener\("click"[\s\S]*pushUndoState\(\)[\s\S]*left: 0, top: 0, right: 1, bottom: 1/);
  assert.match(source, /resetReferenceImageCrop\.addEventListener\("click"[\s\S]*reference\.flipPivotX = 0\.5/);
  assert.match(localization, /"Flip Horizontal":\s*"\\u6c34\\u5e73\\u53cd\\u8ee2"/);
  assert.match(source, /function setReferencePlaneInFront\(reference, inFront\)[\s\S]*reference\.position\[axis\] = distance \* sign/);
  assert.match(source, /referencePlaneInFront\.addEventListener\("change"[\s\S]*setReferencePlaneInFront/);
  assert.match(source, /if \(Math\.abs\(depthCoordinate\) > 0\.0001\) reference\.planeInFront = depthCoordinate > 0/);
  assert.match(source, /depthTest: true[\s\S]*depthWrite: false/);
  assert.match(source, /mesh\.renderOrder = 0/);
  assert.match(source, /function migratedReferencePlanePosition\(snapshot, view, placement\)[\s\S]*isUntouchedLegacySideReferencePlacement/);
  assert.match(source, /function migratedReferencePlaneRotation\(snapshot, view, placement\)[\s\S]*isUntouchedLegacySideReferencePlacement[\s\S]*isInwardFacingSideReferencePlacement/);
  assert.match(source, /function isInwardFacingSideReferencePlacement\(snapshot, view\)[\s\S]*inwardRotationY/);
  assert.match(source, /planePlacementVersion: 4/);
  assert.match(source, /function referencePlanePlacement\(view = "front", inFront = true\)/);
  assert.match(source, /function attachReferenceImageTransform\(\)[\s\S]*\["move", "scale"\]/);
  assert.match(source, /referenceScaleDrag[\s\S]*handle\.scale\.copy\(start\)\.multiplyScalar/);
  assert.match(source, /snappedViewOnly: type === "plane" && Boolean\(snapshot\.snappedViewOnly\)/);
  assert.match(source, /snappedViewOnly: Boolean\(reference\.snappedViewOnly\)/);
  assert.match(source, /const newViewportOverlay = type === "overlay"[\s\S]*snapshot\.x == null[\s\S]*snapshot\.y == null/);
  assert.match(source, /snapshot\.x \?\? \(newViewportOverlay \? 2 : 50\)/);
  assert.match(source, /snapshot\.y \?\? \(newViewportOverlay \? 2 : 50\)/);
  assert.match(source, /reference\.overlayAnchor === "top-left"[\s\S]*style\.transform = topLeftAnchored \? "none"/);
  assert.match(source, /overlayAnchor: reference\.overlayAnchor/);
  assert.match(source, /overlayConfigured: Boolean\(reference\.overlayConfigured\)/);
  assert.match(source, /planeConfigured: Boolean\(reference\.planeConfigured\)/);
  assert.match(source, /function setReferenceImageType\(reference, nextType\)[\s\S]*disposeReferenceImageRuntime\(reference\)[\s\S]*createReferenceImageRuntime\(reference\)/);
  assert.match(source, /function placeReferencePlane\(reference, view\)[\s\S]*const nextPivot = new THREE\.Vector3\(\.\.\.placement\.position\)[\s\S]*nextPivot\.y = currentPivotY[\s\S]*referencePlaneAuthoredPositionForPivot\([\s\S]*nextPivot[\s\S]*applyReferenceImageRuntime\(reference\)/);
  assert.match(source, /selectReferenceImage\(reference\.id\);\s*if \(nextType === "plane"\) setOrthographicView\(true\)/);
  assert.match(source, /referenceImageType\.addEventListener\("change"[\s\S]*setReferenceImageType/);
  assert.match(source, /reference\.planeScale = reference\.scale/);
  assert.match(source, /reference\.overlayScale = nextScale/);
  assert.match(source, /function isSupportedReferenceImageFile\(file\)[\s\S]*png\|jpe\?g\|webp\|gif/);
  assert.match(source, /async function addReferenceImagesFromFiles\([\s\S]*type = "overlay",[\s\S]*\{ view = "front", overlayPosition = null \} = \{\}[\s\S]*Promise\.allSettled[\s\S]*overlayAnchor: "center"[\s\S]*x: overlayPosition\.x[\s\S]*y: overlayPosition\.y/);
  assert.match(source, /if \(type === "plane" && added\.length\) setOrthographicView\(true\)/);
  assert.match(source, /function prepareReferenceImageDrop\(\) \{[\s\S]*setViewportEditMode\("reference"\)[\s\S]*setOutlinerTab\("references"\)[\s\S]*setReferenceImagePanelOpen\(true\)/);
  assert.match(source, /function referenceDropDestination\(event\) \{[\s\S]*\["overlay", "front", "back", "left", "right"\][\s\S]*viewportPanel\.contains\(event\.target\) \? "overlay" : null/);
  assert.match(source, /function viewportOverlayDropPosition\(event\) \{[\s\S]*viewport\.getBoundingClientRect\(\)[\s\S]*event\.clientX[\s\S]*event\.clientY/);
  assert.match(source, /function setReferenceDropHover\(event = null\) \{[\s\S]*referenceOverlayDropMarker\.classList\.remove\("visible"\)[\s\S]*referenceOverlayDropMarker\.style\.left[\s\S]*referenceOverlayDropMarker\.classList\.add\("visible"\)/);
  assert.match(source, /window\.addEventListener\("dragover"[\s\S]*dropEffect = "copy"/);
  assert.match(source, /window\.addEventListener\("dragenter"[\s\S]*prepareReferenceImageDrop\(\)[\s\S]*setReferenceImageDragActive\(true\)/);
  assert.match(source, /window\.addEventListener\("dragover"[\s\S]*setReferenceImageDragActive\(true\)[\s\S]*setReferenceDropHover\(event\)/);
  assert.match(source, /window\.addEventListener\("drop"[\s\S]*referenceDropDestination\(event\)[\s\S]*viewportOverlayDropPosition\(event\)[\s\S]*if \(!destination\) return[\s\S]*addReferenceImagesFromFiles\(files, type,[\s\S]*view: type === "plane" \? destination : "front",[\s\S]*overlayPosition/);
  assert.match(source, /function snappedReferenceImageView\(\)[\s\S]*!camera\.isOrthographicCamera \|\| !snapped[\s\S]*REFERENCE_VIEW_BY_CAMERA_AXIS/);
  assert.match(source, /function updateReferencePlaneVisibility\(\)[\s\S]*reference\.view === snappedView/);
  assert.match(source, /referenceImageSnappedViewOnly\.addEventListener\("change"/);
  assert.match(source, /referenceImageSnappedViewOnlyLabel\.textContent = `Only in \$\{viewLabel\} Orthogonal view`/);
  assert.match(source, /updateReferencePlaneVisibility\(\);[\s\S]*updateViewPlaneGrid\(\)/);
  assert.match(source, /referenceImages: referenceImages\.map\(serializeReferenceImage\)/);
  assert.match(source, /const REFERENCE_OUTLINER_GROUPS = Object\.freeze\(\[[\s\S]*Viewport Overlays[\s\S]*Front[\s\S]*Left[\s\S]*Right[\s\S]*Back/);
  assert.match(source, /function renderReferenceOutliner\(\)[\s\S]*referenceOutlinerGroup\(reference\)[\s\S]*header\.dataset\.referenceDropTarget = group\.id[\s\S]*createOutlinerVisibilityToggle/);
  assert.match(source, /function createReferenceOutlinerOpacityControl\(reference\)[\s\S]*input\.type = "range"[\s\S]*bindUndoCapture\(input\)[\s\S]*reference\.opacity = THREE\.MathUtils\.clamp[\s\S]*applyReferenceImageRuntime\(reference\)[\s\S]*item\.append\(visibility, select, opacity\)/);
  assert.match(source, /referenceOutlinerTab\.addEventListener\("click"[\s\S]*setOutlinerPanelCollapsed\(false\)[\s\S]*setOutlinerTab\("references"\)/);
  assert.match(source, /guideOutlinerTab\.addEventListener\("click"[\s\S]*setOutlinerPanelCollapsed\(false\)[\s\S]*setOutlinerTab\("guides"\)/);
  assert.match(source, /function requestReferenceImage\(type\) \{[\s\S]*setViewportEditMode\("reference"\)[\s\S]*pendingReferenceImageType = type[\s\S]*referenceImageFile\.click\(\)/);
  assert.match(source, /createViewportReferenceMenu\.addEventListener\("click", \(\) => requestReferenceImage\("overlay"\)\)/);
  assert.match(source, /createPlaneReferenceMenu\.addEventListener\("click", \(\) => requestReferenceImage\("plane"\)\)/);
  assert.match(source, /function outlinerGuides\(\)[\s\S]*guide\.type !== "curve-lattice"[\s\S]*guide\.standalone/);
  assert.match(source, /function createScalpGuideOutlinerRow\(\) \{[\s\S]*label: "Scalp Guide"[\s\S]*setScalpGuideVisibility\(!scalpGuideVisible\)[\s\S]*type: "scalp-guide"/);
  assert.match(source, /function renderGuideOutliner\(\)[\s\S]*createScalpGuideOutlinerRow\(\)[\s\S]*guide-outliner-item[\s\S]*selectGuide\(guide\.id\)/);
  assert.match(html, /id=["']clumpContextMenu["'][\s\S]*id=["']editScalpOutlinerAction["'][\s\S]*Edit Scalp/);
  assert.match(source, /function showOutlinerContextMenu\(event, target\) \{[\s\S]*target\.type === "scalp-guide"[\s\S]*editScalpOutlinerAction\.classList\.toggle\("hidden", !isScalpGuide\)/);
  assert.match(source, /editScalpOutlinerAction\.addEventListener\("click"[\s\S]*setViewportEditMode\("guide"\)[\s\S]*setScalpBuilderEditing\(true\)/);
  assert.match(html, /id=["']surfaceGuideFitScalp["'][\s\S]*Create Capsule Guide From Scalp/);
  assert.match(localization, /"Create Capsule Guide From Scalp":/);
  assert.match(source, /function drawReferenceOutlinerThumbnail\(reference, canvas\)[\s\S]*normalizeReferenceCrop\(reference\.crop\)[\s\S]*normalizeReferenceFlipPivotX\(crop, reference\.flipPivotX\)[\s\S]*context\.drawImage/);
  assert.match(source, /thumbnail\.className = "reference-outliner-thumbnail"[\s\S]*thumbnail\.width = 240[\s\S]*thumbnail\.height = 84[\s\S]*drawReferenceOutlinerThumbnail\(reference, thumbnail\)/);
  assert.match(source, /status\.className = "reference-outliner-status"[\s\S]*"Ortho Only"[\s\S]*"All Views"/);
  assert.match(source, /function createOutlinerVisibilityToggle\([\s\S]*outliner-visibility-toggle[\s\S]*onToggle\(\)/);
  assert.match(source, /function setLocksOutlinerVisibility\(targets, visible\)[\s\S]*lock\.outlinerVisible = Boolean\(visible\)/);
  assert.match(source, /outlinerVisible: lock\.outlinerVisible !== false/);
  assert.match(source, /outlinerVisible: guide\.outlinerVisible !== false/);
  assert.match(source, /return lock\.outlinerVisible !== false[\s\S]*visibleStrandRegions\.has\(region\)/);
  assert.match(css, /\.outliner-tab\.active[\s\S]*\.reference-outliner-group\.open > \.reference-outliner-group-items/);
  assert.match(css, /\.outliner-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,[\s\S]*border-bottom:/);
  assert.doesNotMatch(html, /class=["']outliner-titlebar["']|<span>Outliner<\/span>/);
  assert.match(html, /class=["']outliner-tabs["'][\s\S]*id=["']strandOutlinerTab["'][\s\S]*id=["']meshOutlinerTab["'][\s\S]*id=["']guideOutlinerTab["'][\s\S]*id=["']referenceOutlinerTab["'][\s\S]*id=["']toggleOutlinerPanel["']/);
  assert.match(css, /\.reference-outliner-thumbnail\s*\{[\s\S]*object-fit:\s*contain/);
  assert.match(css, /\.reference-outliner-select\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(72px, 1fr\)/);
  assert.match(css, /\.reference-outliner-status\s*\{[\s\S]*font-size:\s*11px/);
  assert.match(css, /\.reference-outliner-opacity\s*\{[\s\S]*grid-column:\s*2;[\s\S]*grid-template-columns:\s*auto minmax\(44px, 1fr\) 34px/);
  assert.match(css, /\.outliner-visibility-toggle::before[\s\S]*translate\(-50%, -50%\)[\s\S]*M3 10Q12 20 21 10/);
  assert.match(css, /\.outliner-visibility-toggle\.visible::before,[\s\S]*\.outliner-visibility-toggle\.partial::before[\s\S]*M2 12Q12 1 22 12Q12 23 2 12Z/);
  assert.match(css, /\.outliner-visibility-toggle\.visible\s*\{\s*color:\s*#e6e6ea;\s*opacity:\s*1/);
  assert.match(css, /\.outliner-visibility-toggle\s*\{[^}]*color:\s*#a6a6ac;\s*opacity:\s*0\.5/);
  assert.match(localization, /"Viewport Overlays":\s*"\\u30d3\\u30e5\\u30fc\\u30dd\\u30fc\\u30c8/);
  assert.match(source, /restorePlan\.scene\.referenceImages\.forEach\(\(snapshot\) => addReferenceImage/);
  assert.match(source, /function disposeAllEditableObjects\(\) \{\s*clearHairShellFaceSelection\(\);\s*clearReferenceImages\(\)/);
  assert.match(css, /#viewport\s*\{[\s\S]*?z-index:\s*1/);
  assert.match(css, /\.viewport-reference-images\s*\{[\s\S]*?z-index:\s*0[\s\S]*?pointer-events:\s*none/);
  assert.match(css, /\.reference-image-drop-target\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(css, /\.viewport-panel\.reference-image-drag-active \.reference-image-drop-target\s*\{[\s\S]*opacity:\s*1;[\s\S]*pointer-events:\s*auto/);
  assert.match(css, /\.reference-image-drop-options\s*\{[\s\S]*grid-template-columns:\s*repeat\(4/);
  assert.match(css, /\.reference-image-drop-card\.reference-drop-hover\s*\{[\s\S]*border-style:\s*solid;[\s\S]*transform:\s*scale\(1\.025\)/);
  assert.match(css, /\.reference-outliner-group-head\.reference-drop-hover\s*\{[\s\S]*outline:\s*2px solid #ffdc66/);
  assert.match(css, /\.reference-overlay-drop-marker\s*\{[\s\S]*width:\s*150px;[\s\S]*height:\s*96px;[\s\S]*pointer-events:\s*none/);
  assert.match(css, /\.reference-overlay-drop-marker\.visible\s*\{\s*display:\s*grid/);
  assert.match(css, /body\.reference-image-drag-active \.reference-outliner-group-head\[data-reference-drop-target\]/);
  assert.match(css, /\.reference-image-panel\s*\{[\s\S]*?top:\s*68px;[\s\S]*?max-height:\s*calc\(100% - 86px\)/);
  assert.match(css, /#referencePlaneInFrontRow\.hidden/);
  assert.match(css, /\.viewport-tools\s*\{[\s\S]*?top:\s*100px;[\s\S]*?z-index:\s*3/);
  assert.match(localization, /"Reference Images":\s*"\\u53c2\\u8003\\u753b\\u50cf"/);
  assert.match(localization, /"Create 2D Viewport Reference":/);
  assert.match(localization, /"Create 3D Plane Reference":/);
  assert.match(localization, /"Only in Front Orthogonal view":/);
  assert.match(localization, /"Only in Back Orthogonal view":/);
  assert.match(localization, /"Only in Left Orthogonal view":/);
  assert.match(localization, /"Only in Right Orthogonal view":/);
  assert.match(localization, /"Drop image as reference":/);
  assert.match(localization, /"Drop anywhere in the viewport for a 2D overlay, or choose a 3D plane view\.":/);
  assert.match(localization, /"2D Overlay":/);
  assert.match(localization, /"Viewport Overlay":/);
  assert.match(localization, /"3D Plane":/);
  assert.match(localization, /"In front of mesh":/);
});

test("reference outliner drag and drop can move or duplicate images between view sections", async () => {
  const [html, source, css, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="referenceTransferDialog"[\s\S]*Move or Duplicate Reference\?[\s\S]*id="moveReferenceTransfer"[\s\S]*Move Reference[\s\S]*id="duplicateReferenceTransfer"[\s\S]*Duplicate Reference/);
  assert.match(source, /function beginReferenceOutlinerDrag\(event, reference, element\)[\s\S]*reference\.greasePencilLayer[\s\S]*effectAllowed = "copyMove"[\s\S]*reference-outliner-drag-active/);
  assert.match(source, /groupElement\.dataset\.referenceDropTarget = group\.id[\s\S]*groupElement\.addEventListener\("dragover"[\s\S]*updateReferenceOutlinerDropTarget[\s\S]*groupElement\.addEventListener\("drop"[\s\S]*openReferenceTransferPrompt/);
  assert.match(source, /select\.draggable = !reference\.greasePencilLayer[\s\S]*select\.addEventListener\("dragstart"[\s\S]*beginReferenceOutlinerDrag/);
  assert.match(source, /function openReferenceTransferPrompt\(referenceId, destination\)[\s\S]*referenceOutlinerGroup\(source\) === destination[\s\S]*referenceTransferDialog\.showModal\(\)/);
  assert.match(source, /function transferReferenceToOutlinerGroup\(referenceId, destination,[\s\S]*pushUndoState\(\)[\s\S]*if \(duplicate\)[\s\S]*serializeReferenceImage\(source\)[\s\S]*nextDuplicateName[\s\S]*addReferenceImage[\s\S]*destination === "overlay"[\s\S]*setReferenceImageType\(target, "overlay"\)[\s\S]*setReferenceImageType\(target, "plane"\)[\s\S]*placeReferencePlane\(target, destination\)/);
  assert.match(source, /function placeReferencePlane\(reference, view\)[\s\S]*reference\.mesh\?\.position\.y \?\? referencePlanePivotPosition\(reference\)\.y[\s\S]*nextPivot\.y = currentPivotY[\s\S]*referencePlaneAuthoredPositionForPivot\([\s\S]*nextPivot/);
  assert.match(source, /moveReferenceTransferButton\.addEventListener\("click", \(\) => commitReferenceTransfer\(false\)\)[\s\S]*duplicateReferenceTransferButton\.addEventListener\("click", \(\) => commitReferenceTransfer\(true\)\)/);
  assert.match(source, /function resetTransientInteractionsForStateRestore\(\)[\s\S]*referenceTransferDialog\.close\(\)[\s\S]*pendingReferenceTransfer = null[\s\S]*clearReferenceOutlinerDragState\(\)/);
  assert.match(css, /body\.reference-outliner-drag-active[\s\S]*reference-drop-hover[\s\S]*#63c7ff/);
  assert.match(css, /\.reference-outliner-select\[draggable="true"\][\s\S]*cursor:\s*grab/);
  assert.match(localization, /"Move or Duplicate Reference\?":[\s\S]*"Move Reference":[\s\S]*"Duplicate Reference":/);
});

test("dropping AHS and OBJ files uses destructive confirmation and explicit OBJ routing", async () => {
  const [html, source, css, localization, fileDrop, recentProjects] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/file-drop.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/recent-projects.js", import.meta.url), "utf8")
  ]);

  assert.match(fileDrop, /function applicationDropFileKind\(file\)[\s\S]*\\\.ahs\$[\s\S]*return "project"[\s\S]*\\\.obj\$[\s\S]*return "obj"/);
  assert.match(html, /id="recentProjectsMenu"[\s\S]*Recent Projects[\s\S]*id="recentProjectsSubmenu"[\s\S]*No recent projects/);
  assert.match(html, /id="dropImportDialog"[\s\S]*You will lose any unsaved progress in the current project/);
  assert.match(html, /id="dropObjTargetChoices"[\s\S]*value="head" checked[\s\S]*value="body"[\s\S]*value="object" disabled[\s\S]*Not yet supported/);
  assert.match(source, /function openDroppedApplicationFilePrompt\(file\)[\s\S]*applicationDropFileKind\(file\)[\s\S]*Open Dropped Project\?[\s\S]*Import Dropped OBJ\?[\s\S]*dropImportDialog\.showModal\(\)/);
  assert.match(source, /function confirmDroppedApplicationFile\(\)[\s\S]*openHairProjectFile\(file\)[\s\S]*objTarget === "body"[\s\S]*importFullBodyMeshFile\(file\)[\s\S]*objTarget === "head"[\s\S]*importHeadMeshFile\(file\)/);
  assert.match(source, /window\.addEventListener\("dragover"[\s\S]*dragContainsApplicationFile\(event\)[\s\S]*setReferenceImageDragActive\(false\)[\s\S]*dragContainsReferenceImage\(event\)/);
  assert.match(source, /function dragContainsReferenceImage\(event\)[\s\S]*SUPPORTED_REFERENCE_IMAGE_TYPES\.has[\s\S]*isSupportedReferenceImageFile\(file\)/);
  assert.match(source, /window\.addEventListener\("drop"[\s\S]*applicationFiles = transferredFiles\.filter[\s\S]*Drop one \.ahs or \.obj file at a time[\s\S]*openDroppedApplicationFilePrompt\(applicationFiles\[0\]\)[\s\S]*filter\(isSupportedReferenceImageFile\)/);
  assert.match(css, /\.drop-import-dialog[\s\S]*\.drop-obj-target-choices[\s\S]*label:has\(input:checked\)/);
  assert.match(css, /\.app-menu-submenu[\s\S]*left: calc\(100% \+ 5px\)/);
  assert.match(recentProjects, /MAX_RECENT_PROJECTS = 10[\s\S]*indexedDB[\s\S]*rememberRecentProject/);
  assert.match(source, /async function renderRecentProjectsMenu\(\)[\s\S]*listRecentProjects\(\)[\s\S]*openDroppedApplicationFilePrompt/);
  assert.match(source, /async function openHairProjectFile\(file,[\s\S]*safelyRememberRecentProject/);
  assert.match(source, /async function performFileAction[\s\S]*safelyRememberRecentProject/);
  assert.match(localization, /"Open Dropped Project\?":/);
  assert.match(localization, /"Import Dropped OBJ\?":/);
  assert.match(localization, /"Object Mesh":/);
  assert.match(localization, /"Not yet supported\.":/);
  assert.match(localization, /"Recent Projects":/);
  assert.match(localization, /"You will lose any unsaved progress in the current project\.":/);
});

test("viewport display controls can switch between perspective and orthographic projection", async () => {
  const [html, source, css, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id=["']orthographicViewToggle["'][^>]*aria-pressed=["']false["']/);
  assert.match(html, /class=["']viewport-top-controls["'][\s\S]*class=["']bar-actions viewport-display-actions["'][\s\S]*id=["']drawStrandSurface["'][\s\S]*id=["']viewportDrawLayer["'][\s\S]*class=["']viewport-modes["']/);
  assert.doesNotMatch(html, /id=["']resetCamera["']|Reset camera/);
  assert.match(source, /const perspectiveCamera = new THREE\.PerspectiveCamera/);
  assert.match(source, /const orthographicCamera = new THREE\.OrthographicCamera/);
  assert.match(source, /let camera = perspectiveCamera/);
  assert.match(source, /function setOrthographicView\(enabled\)[\s\S]*controls\.object = camera[\s\S]*transformControls\.camera = camera/);
  assert.match(source, /visibleHalfHeight[\s\S]*perspectiveCamera\.position\.copy\(controls\.target\)/);
  assert.match(source, /function updateCameraProjectionForViewport\(\)[\s\S]*orthographicCamera\.left[\s\S]*orthographicCamera\.updateProjectionMatrix/);
  assert.match(source, /orthographicViewToggle\.addEventListener\("click"/);
  assert.match(html, /id=["']multiCameraViewToggle["'][^>]*aria-pressed=["']false["'][^>]*hidden[^>]*aria-hidden=["']true["']/);
  assert.match(css, /\.viewport-display-actions > button\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(source, /function setMultiCameraEnabled\(enabled\) \{\s*const nextEnabled = Boolean\(enabled\);\s*if \(nextEnabled && !multiCameraExperimentalEnabled\) return;/);
  assert.match(html, /id=["']multiCameraViews["'][^>]*aria-hidden=["']true["'][\s\S]*id=["']multiCameraPerspective["'][^>]*class=["'][^"']*active[^"']*["'][^>]*[\s\S]*?<span>Persp<\/span>[\s\S]*id=["']multiCameraFront["'][\s\S]*id=["']multiCameraRight["'][\s\S]*id=["']multiCameraTop["']/);
  assert.match(source, /function setMultiCameraEnabled\(enabled\)[\s\S]*classList\.toggle\("multi-camera-view", multiCameraEnabled\)[\s\S]*ensureMultiCameraPreviewRenderers\(\)[\s\S]*resize\(\)/);
  assert.match(source, /function setMultiCameraActiveView\(view,[\s\S]*camera = multiCameraForView\(view\)[\s\S]*controls\.object = camera[\s\S]*transformControls\.camera = camera[\s\S]*container\.classList\.toggle\("active", candidate === view\)/);
  assert.match(source, /function renderNextInactiveMultiCameraPreview\(\)[\s\S]*filter\(\(\[view\]\) => view !== multiCameraActiveView\)[\s\S]*multiCameraPreviewRenderCursor % inactivePreviews\.length[\s\S]*previewRenderer\.render\(scene, multiCameraForView\(view\)\)[\s\S]*function animate[\s\S]*renderer\.render\(scene, camera\)[\s\S]*renderNextInactiveMultiCameraPreview\(\)/);
  assert.doesNotMatch(source, /querySelector\(["']#resetCamera["']\)/);
  assert.match(css, /\.orthographic-view-button\.active\s*\{/);
  assert.match(css, /\.viewport-panel\.multi-camera-view \.multi-camera-views[\s\S]*\.multi-camera-preview\.active > span\s*\{[^}]*color:\s*#63c7ff/);
  assert.match(css, /\.viewport-top-controls\s*\{[^}]*flex-wrap:\s*nowrap[^}]*width:\s*calc\(100% - 24px\)/);
  assert.match(css, /\.viewport-top-controls\s*\{[^}]*gap:\s*4px/);
  assert.match(css, /\.viewport-draw-settings\s*\{[^}]*gap:\s*4px;[^}]*height:\s*38px/);
  assert.match(css, /\.viewport-display-actions\s*\{[^}]*gap:\s*4px;[^}]*height:\s*38px/);
  assert.match(css, /\.viewport-modes\s*\{[^}]*gap:\s*4px;[^}]*height:\s*38px/);
  assert.match(css, /\.viewport-top-controls\.two-row\s*\{[^}]*grid-template-areas:\s*"settings settings"\s*"display modes"[^}]*row-gap:\s*4px[^}]*transform:\s*translateX\(calc\(-50% \+ var\(--viewport-top-controls-overlap-shift, 0px\)\)\)[\s\S]*?\.viewport-top-controls\.two-row \.viewport-draw-settings\s*\{[^}]*grid-area:\s*settings[\s\S]*?\.viewport-top-controls\.two-row \.viewport-display-actions\s*\{[^}]*grid-area:\s*display[\s\S]*?\.viewport-top-controls\.two-row \.viewport-modes\s*\{[^}]*grid-area:\s*modes/);
  assert.match(source, /function syncViewportTopControlRows\(\)[\s\S]*--viewport-top-controls-overlap-shift", "0px"[\s\S]*classList\.remove\("two-row"\)[\s\S]*Math\.min\(\.\.\.groups\.map[\s\S]*const useTwoRows = oneRowLeft - workspaceBounds\.right <= 4[\s\S]*getBoundingClientRect\(\)\.left[\s\S]*Math\.max\(0, workspaceBounds\.right \+ 4 - liveSurfaceLeft\)[\s\S]*--viewport-top-controls-overlap-shift/);
  assert.match(source, /new ResizeObserver\(syncViewportTopControlRows\)\.observe\(viewportPanel\)/);
  assert.match(css, /\.viewport-display-actions > button,\s*\.viewport-modes > \.tool-button\s*\{[^}]*flex:\s*0 0 38px[^}]*width:\s*38px[^}]*height:\s*38px[^}]*aspect-ratio:\s*1/);
  assert.match(css, /\.viewport-display-actions > button:not\(\.active\),\s*\.viewport-modes > \.tool-button:not\(\.active\)\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--glass-panel-color, #0b0a0e\) 73%, transparent\)/);
  assert.match(localization, /"Switch to orthographic view":\s*"\\u6b63\\u6295\\u5f71/);
  assert.doesNotMatch(localization, /"Reset camera":/);
});

test("braid meshes preserve authored quads for viewport topology and OBJ export", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /new THREE\.FileLoader\(\)\.load\(path, \(content\) =>/);
  assert.match(source, /annotateBraidObjTopology\(obj, parseObjFaceVertexCounts\(content\)\)/);
  assert.match(source, /faceVertexCounts\.push\(\.\.\.\(/);
  assert.match(source, /sourceFaceVertexCounts\.forEach\(\(faceVertexCount\) =>/);
  assert.match(source, /fanTriangleEdgeMasks\(faceVertexCount\)/);
  assert.match(source, /geometry\.userData\.quadFaces = authoredFaces/);
  assert.match(source, /geometry\.userData\.triangleEdgeMasks = triangleEdgeMasks/);
  assert.match(source, /geometry\.userData\.topology = "authored-polygons"/);
});

test("scalp and strand control points take pointer and hover priority over the transform gizmo", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /function pointerHitsTransformGizmo\(event\)[\s\S]*transformControls\.dragging \|\| transformControls\.axis/);
  assert.match(source, /function prioritizeScalpBuilderPointSelection\(event\)/);
  assert.match(source, /const pointIndex = hit\.object\.userData\.scalpBuilderLatticeIndex;[\s\S]*selectScalpBuilderCurveLatticePoint\(pointIndex\)/);
  assert.match(source, /if \(pointIndex === scalpBuilderCurveLattice\.selectedIndex\) return;/);
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
  assert.match(source, /addEventListener\("pointerdown",\s*prioritizeScalpBuilderPointSelection,\s*true\)/);
  assert.match(source, /hoveringSelectedScalpPoint[\s\S]*pointerHitsTransformGizmo\(event\)/);
  assert.match(source, /if \(\(unselectedScalpPointHasPriority \|\| unselectedStrandPointHasPriority\) && !adaptiveGizmoHit\)[\s\S]*transformControls\.axis = null/);
  assert.match(source, /raycaster\.intersectObjects\(scalpBuilderCurveLattice\.handles,\s*false\)/);
  assert.doesNotMatch(source, /SCALP_BUILDER_POINT_PICKER_SCALE|pointPickers|configureScalpBuilderPointPickerOverlay/);
  assert.match(
    source,
    /function prepareCurvePointSelection\(event\)[\s\S]*const hit = adaptiveRemeshControlPointHitFromEvent\(event\)[\s\S]*strandControlPointHitFromEvent\(event, selectedLock\);[\s\S]*const attachedPointHit = hit\?\.object === transformControls\.object;[\s\S]*pointerHitsTransformGizmo\(event\)[\s\S]*\(!hit \|\| attachedPointHit\)/
  );
  assert.match(
    source,
    /function updateControlPointHover\(event\)[\s\S]*strandPointPriorityActive[\s\S]*unselectedStrandPointHasPriority[\s\S]*transformControls\.axis = null[\s\S]*hoveringAttachedPoint[\s\S]*pointerHitsTransformGizmo\(event\)/
  );
});

test("scalp fine tuning restores editable points while the retired region lattice stays hidden", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /const SCALP_REGION_CURVE_VISUALIZATION_ENABLED = false;/);
  assert.match(
    source,
    /function scalpBuilderCurveLatticePointHit\(\) \{\s*if \(!scalpBuilderEditing \|\| !scalpBuilderCurveLattice\) return null;/
  );
  assert.match(
    source,
    /scalpBuilderCurveLattice\.surface\.visible = SCALP_REGION_CURVE_VISUALIZATION_ENABLED;[\s\S]*scalpBuilderCurveLattice\.line\.visible = SCALP_REGION_CURVE_VISUALIZATION_ENABLED;/
  );
  assert.match(source, /line\.renderOrder = 15;\s*line\.visible = SCALP_REGION_CURVE_VISUALIZATION_ENABLED;/);
  assert.match(source, /surface\.renderOrder = 14;\s*surface\.visible = SCALP_REGION_CURVE_VISUALIZATION_ENABLED;/);
  assert.match(
    source,
    /handle\.visible = scalpBuilderEditing;/
  );
  assert.match(
    source,
    /function updateScalpEditingVisibility\(\) \{[\s\S]*scalpBuilderGroup\.visible = scalpBuilderEditing;/
  );
  assert.match(source, /Select a blue control point and use the gizmo to fine tune the scalp guide/);
  assert.match(
    source,
    /async function rebuildScalpBuilderTemplateOverlay\(\)[\s\S]*!SCALP_REGION_CURVE_VISUALIZATION_ENABLED[\s\S]*scalpBuilderTemplateOverlay\.visible = false;/
  );
});

test("sculpt brushes share brush controls, per-tool strength, and camera-facing clipping debug settings", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="sculptBrushDock"[\s\S]*data-tool="sculpt-move"[\s\S]*data-tool="sculpt-smooth"[\s\S]*data-tool="sculpt-inflate"[\s\S]*<\/div>/);
  assert.match(html, /data-tool="sculpt-move"[\s\S]*<span>Move Brush<\/span>[\s\S]*data-tool="sculpt-smooth"[\s\S]*<span>Smooth Brush<\/span>[\s\S]*data-tool="sculpt-inflate"[\s\S]*<span>Inflate Brush<\/span>/);
  assert.doesNotMatch(html.match(/id="sculptBrushDock"[\s\S]*?<\/div>/)?.[0] || "", /sculptBrushRadius|sculptBrushFalloff/);
  assert.match(html, /id="sculptMoveToolPanel"[\s\S]*data-attribute-panel="tools"[\s\S]*id="sculptBrushStrength"[\s\S]*value="0\.2"[\s\S]*>0\.20<\/output>[\s\S]*id="sculptBrushRadius"[\s\S]*id="sculptBrushFalloff"[\s\S]*id="sculptInflateProfileSetting"[\s\S]*id="sculptInflateProfile"[\s\S]*value="both" selected[\s\S]*value="width"[\s\S]*value="depth"[\s\S]*id="sculptPreserveTipsSetting"[\s\S]*id="sculptPreserveTips"[^>]*checked/);
  const sculptBrushPanel = html.match(/id="sculptMoveToolPanel"[\s\S]*?<\/section>/)?.[0] || "";
  assert.match(sculptBrushPanel, /class="sculpt-brush-debug-settings"[\s\S]*<summary>Debug<\/summary>[\s\S]*id="sculptBrushShowClippingPlane"[\s\S]*id="sculptBrushShowCurves"[\s\S]*id="sculptBrushPlanePosition"[^>]*min="0"[^>]*max="1"[^>]*value="0\.5"/);
  assert.doesNotMatch(sculptBrushPanel, /id="sculptBrushShowClippingPlane"[^>]*checked/);
  assert.doesNotMatch(sculptBrushPanel, /id="sculptBrushShowCurves"[^>]*checked/);
  assert.match(css, /\.sculpt-brush-dock\s*\{[\s\S]*bottom:\s*18px;[\s\S]*transform:\s*translateX\(-50%\)/);
  assert.match(css, /\.sculpt-brush-dock\s*\{[\s\S]*gap:\s*6px;[\s\S]*min-height:\s*38px;[\s\S]*padding:\s*4px 5px;/);
  assert.match(css, /\.sculpt-brush-button\.tool-button\s*\{[\s\S]*min-height:\s*30px;[\s\S]*font-size:\s*11px;/);
  assert.match(css, /\.sculpt-brush-cursor\s*\{[\s\S]*border-radius:\s*50%/);
  assert.match(css, /\.sculpt-brush-debug-settings\s*\{[\s\S]*border-top:/);
  assert.match(source, /cameraFacingPlaneNormal,[\s\S]*inflateSculptPointScale,[\s\S]*pointInCameraFacingHalfSpace,[\s\S]*proportionalSculptWeights,[\s\S]*rebuildInflatedSculptProfileCurve,[\s\S]*sculptBrushWeight,[\s\S]*smoothSculptPointDeltas[\s\S]*"\.\/modules\/sculpt-brush\.js\?v=20260821-2"/);
  assert.match(source, /function captureSculptMoveStrokeInfluence\([\s\S]*sourceWeights[\s\S]*partnerWeights[\s\S]*influenceBySourceId\.set/);
  assert.match(source, /function beginSculptMoveStroke\(event\)[\s\S]*const inflateBrushActive = effectiveSculptBrushTool\(\) === "sculpt-inflate";[\s\S]*event\.ctrlKey && !inflateBrushActive[\s\S]*inflateInverted: inflateBrushActive && event\.ctrlKey[\s\S]*moveInfluence: activeTool === "sculpt-move"[\s\S]*captureSculptMoveStrokeInfluence[\s\S]*pushUndoState\(\)/);
  assert.match(source, /function applySculptMoveStrokeSample\(stroke, clientX, clientY\)[\s\S]*const firstPointIndex = inflateBrushActive \? 0 : 1;[\s\S]*for \(let pointIndex = firstPointIndex; pointIndex < source\.points\.length; pointIndex \+= 1\)/);
  assert.match(source, /const sculptBrushStrengthByTool = \{[\s\S]*"sculpt-move": 0\.2,[\s\S]*"sculpt-smooth": 0\.5,[\s\S]*"sculpt-inflate": 0\.5/);
  assert.match(source, /function syncSculptBrushStrengthForActiveTool\(\)[\s\S]*sculptBrushStrengthByTool\[tool\][\s\S]*sculptBrushStrengthInput\.value = String/);
  assert.match(source, /function updateActiveSculptBrushStrength\(\)[\s\S]*sculptBrushStrengthByTool\[tool\] = Number\(sculptBrushStrengthInput\.value\)/);
  assert.match(source, /const strength = Number\([\s\S]*sculptBrushStrengthByTool\[effectiveSculptBrushTool\(\)\][\s\S]*const dragWorldDelta = sculptBrushWorldDelta[\s\S]*dragWorldDelta\.multiplyScalar\(weight \* strength\)/);
  assert.match(source, /const fixedMoveBrushInfluence = !smoothBrushActive && !inflateBrushActive[\s\S]*initialMoveInfluence = stroke\.moveInfluence\.get\(source\.id\)[\s\S]*initialMoveInfluence\?\.sourceWeights[\s\S]*initialMoveInfluence\?\.partnerWeights/);
  assert.match(source, /const units = sculptBrushUnits\(\)[\s\S]*sculptMoveStroke = \{[\s\S]*units,[\s\S]*function applySculptMoveStrokeSample\(stroke, clientX, clientY\)/);
  assert.match(source, /stroke\.pendingX = event\.clientX;[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*flushSculptMoveStrokeSample\(stroke\)/);
  assert.match(source, /function finishSculptMoveStroke\(event, \{ cancel = false \} = \{\}\)[\s\S]*cancelAnimationFrame\(stroke\.frameRequest\)[\s\S]*if \(!cancel\) flushSculptMoveStrokeSample\(stroke\)/);
  assert.doesNotMatch(source.match(/function applySculptMoveStrokeSample[\s\S]*?function flushSculptMoveStrokeSample/)?.[0] || "", /updateCurveObjects|updateTopologyStats/);
  assert.match(source, /SCULPT_BRUSH_GEOMETRY_FRAME_BUDGET_MS = 6/);
  assert.match(source, /function flushSculptBrushGeometryUpdates\(\{ all = false \} = \{\}\)[\s\S]*performance\.now\(\) - startedAt >= SCULPT_BRUSH_GEOMETRY_FRAME_BUDGET_MS/);
  assert.match(source, /function syncSculptBrushMirrorPoints\(source, partner\)[\s\S]*partner\.points\[index\]\.set\(-point\.x, point\.y, point\.z\)[\s\S]*partner\.pointScales = source\.pointScales\.map[\s\S]*partner\.pointWidths = \[\.\.\.source\.pointWidths\]/);
  assert.match(source, /syncSculptBrushMirrorPoints\(source, partner\)[\s\S]*queueSculptBrushGeometryUpdate\(source\)[\s\S]*queueSculptBrushGeometryUpdate\(partner\)/);
  assert.match(source, /flushSculptBrushGeometryUpdates\(\{ all: true \}\)/);
  assert.match(source, /sculptMoveToolPanel\.classList\.toggle\("hidden", !sculptBrushToolActive\(\)\)/);
  assert.match(source, /else if \(sculptBrushToolActive\(\)\) panel = sculptMoveToolPanel/);
  assert.match(source, /sculptBrushPointWeight\(sourcePoint[\s\S]*sculptBrushPointWeight\(partnerPoint/);
  assert.match(source, /sourcePoint\.add\(worldDelta\)[\s\S]*syncSculptBrushMirrorPoints\(source, partner\)/);
  assert.match(source, /function finishSculptMoveStroke\(event, \{ cancel = false \} = \{\}\)[\s\S]*commitClumpMemberRestState\(lock\)/);
  assert.match(source, /renderer\.domElement\.addEventListener\("pointerdown", beginSculptMoveStroke, true\)/);
  assert.match(source, /window\.addEventListener\("pointermove", updateSculptMoveStroke, true\)/);
  assert.match(source, /window\.addEventListener\("pointerup", finishSculptMoveStroke, true\)/);
  assert.match(source, /const sculptBrushPreserveTipsByTool = \{[\s\S]*"sculpt-move": false,[\s\S]*"sculpt-smooth": true/);
  assert.match(source, /function syncSculptBrushToolButtons\(\)[\s\S]*sculptBrushPreserveTipsByTool\[activeTool\][\s\S]*sculptPreserveTipsInput\.checked = sculptBrushPreserveTipsByTool\[activeTool\]/);
  assert.match(source, /function updateActiveSculptBrushPreserveTips\(\)[\s\S]*sculptBrushPreserveTipsByTool\[activeTool\] = sculptPreserveTipsInput\.checked/);
  assert.match(source, /const preserveTips = Boolean\(sculptBrushPreserveTipsByTool\[activeTool\]\)[\s\S]*pointIndex === source\.points\.length - 1[\s\S]*smoothSculptPointDeltas\([\s\S]*preserveTip: preserveTips/);
  assert.match(source, /sculptPreserveTipsInput\.addEventListener\("change", updateActiveSculptBrushPreserveTips\)/);
  assert.match(source, /const sculptProportionalToolActive = \["sculpt-move", "sculpt-smooth"\]\.includes\(activeTool\)[\s\S]*proportionalPanel\.classList\.toggle\([\s\S]*sculptProportionalToolActive[\s\S]*proportionalLockRootRow\.classList\.toggle\([\s\S]*sculptProportionalToolActive/);
  assert.match(source, /function captureSculptMoveStrokeInfluence[\s\S]*proportionalEditing[\s\S]*proportionalSculptWeights\(sourceWeights, proportionalRadius, proportionalFalloff\)[\s\S]*proportionalSculptWeights\(partnerWeights, proportionalRadius, proportionalFalloff\)/);
  assert.match(source, /if \(smoothBrushActive\) \{[\s\S]*const smoothingWeights = proportionalEditing[\s\S]*proportionalSculptWeights\([\s\S]*pointWeights[\s\S]*smoothSculptPointDeltas\([\s\S]*smoothingWeights/);
  assert.match(source, /function sculptBrushToolActive\(tool = activeTool\) \{[\s\S]*"sculpt-move", "sculpt-smooth", "sculpt-inflate"/);
  assert.match(source, /function sculptBrushSelectionMaskActive\(\) \{[\s\S]*sculptBrushToolActive\(\)[\s\S]*selectedStrandIds\.size > 0/);
  assert.match(source, /function sculptBrushSelectionAllows\(lock\) \{[\s\S]*!sculptBrushSelectionMaskActive\(\)[\s\S]*selectedStrandIds\.has\(lock\?\.id\)/);
  assert.match(source, /function sculptBrushMirrorUpdateLock\(lock\) \{[\s\S]*lock\?\.points\?\.length > 1[\s\S]*!\["poly", "surface", "curve-surface"\]\.includes[\s\S]*function sculptBrushEditableLock\(lock\) \{[\s\S]*sculptBrushMirrorUpdateLock\(lock\)[\s\S]*!lock\.locked[\s\S]*sculptBrushSelectionAllows\(lock\)/);
  assert.match(source, /function strandViewportBaseColor\(lock\) \{[\s\S]*sculptBrushSelectionMaskActive\(\)[\s\S]*sculptBrushSelectionAllows\(lock\)[\s\S]*return strandDisplayColor\(lock\)[\s\S]*maskedColor\.multiplyScalar\(0\.28\)/);
  assert.match(source, /activeTool = tool;[\s\S]*updateStrandSelectionHighlight\(\);[\s\S]*updateReferenceSelectionVisuals\(\)/);
  assert.match(source, /const inflateBrushActive = effectiveSculptBrushTool\(\) === "sculpt-inflate"[\s\S]*inflateSculptPointScale\([\s\S]*source\.pointScales\[pointIndex\],[\s\S]*weight,[\s\S]*strength,[\s\S]*strokeDistance,[\s\S]*radius,[\s\S]*stroke\.inflateInverted \? -1 : 1[\s\S]*profile === "depth" \? source\.pointScales\[pointIndex\]\.x : nextScale\.x[\s\S]*profile === "width" \? source\.pointScales\[pointIndex\]\.z : nextScale\.z/);
  assert.match(source, /function updateSculptMoveStroke\(event\)[\s\S]*if \(stroke\.inflateProfile\) stroke\.inflateInverted = Boolean\(event\.ctrlKey\)/);
  assert.match(source, /function bakeSculptInflateProfiles\(stroke\)[\s\S]*rebuildInflatedSculptProfileCurve\(source\.taperCurve, widthSamples\)[\s\S]*rebuildInflatedSculptProfileCurve\(source\.depthCurve, depthSamples\)[\s\S]*source\.pointScales\.forEach[\s\S]*syncSculptBrushMirrorPoints\(source, partner\)/);
  assert.match(source, /function finishSculptMoveStroke[\s\S]*if \(!cancel\) bakeSculptInflateProfiles\(stroke\)[\s\S]*flushPendingLockGeometryUpdates/);
  assert.match(source, /sculptTool === "sculpt-inflate"[\s\S]*Inflate Brush: drag across visible strands to rebuild the selected width and depth profiles\. Hold Ctrl to deflate/);
  assert.match(source, /snapshots: snapshotLocks\.map[\s\S]*pointScales: lock\.pointScales\.map[\s\S]*pointWidths: \[\.\.\.lock\.pointWidths\][\s\S]*lock\.pointScales = snapshot\.pointScales\.map[\s\S]*lock\.pointWidths = \[\.\.\.snapshot\.pointWidths\]/);
  assert.match(source, /function setSculptBrushShiftSmoothHeld\(held\)[\s\S]*syncSculptBrushStrengthForActiveTool\(\)/);
  assert.match(source, /activeTool = tool;[\s\S]*if \(sculptBrushToolActive\(\)\) syncSculptBrushStrengthForActiveTool\(\)/);
  assert.match(source, /event\.key === "Shift"[\s\S]*sculptBrushToolActive\(\)[\s\S]*setSculptBrushShiftSmoothHeld\(true\)/);
  assert.match(source, /window\.addEventListener\("keyup"[\s\S]*event\.key === "Shift"[\s\S]*setSculptBrushShiftSmoothHeld\(false\)/);
  assert.match(source, /function sculptBrushDebugCurveVisible\(lock\)[\s\S]*sculptBrushToolActive\(\)[\s\S]*sculptBrushShowCurvesInput\.checked[\s\S]*sculptBrushEditableLock\(lock\)[\s\S]*strandVisibleForDisplay\(lock\)[\s\S]*sculptBrushLockViable\(lock\)/);
  assert.match(source, /function sculptBrushWorkingPlaneNormal\(\)[\s\S]*camera\.getWorldDirection\(sculptBrushCameraFacingNormal\)[\s\S]*sculptBrushCameraFacingNormal\.negate\(\)[\s\S]*cameraFacingPlaneNormal\(sculptBrushCameraFacingNormal\)/);
  assert.match(source, /function sculptBrushPlaneOffset\(\)[\s\S]*Number\(sculptBrushPlanePositionInput\.value\) - 0\.5\) \* 4/);
  assert.match(source, /function sculptBrushLockViable\([\s\S]*planeOffset = sculptBrushPlaneOffset\(\)[\s\S]*pointInCameraFacingHalfSpace\(point, planeNormal, planeOffset\)/);
  assert.match(source, /function sculptBrushUnits\(\)[\s\S]*const partner = sculptBrushMirrorUpdateLock\(mirrorPartnerFor\(lock\)\)[\s\S]*const sourceVisible = sculptBrushEditableLock\(source\)[\s\S]*const partnerVisible = sculptBrushEditableLock\(sourcePartner\)[\s\S]*partner: sculptBrushMirrorUpdateLock\(sourcePartner\)/);
  assert.match(source, /const units = sculptBrushUnits\(\);[\s\S]*const snapshotLocks = \[\.\.\.new Map\(units\.flatMap[\s\S]*snapshots: snapshotLocks\.map/);
  assert.match(source, /new THREE\.GridHelper\(4\.2, 12, 0xff4fd8, 0xff4fd8\)[\s\S]*new THREE\.PlaneGeometry\(4\.2, 4\.2\)[\s\S]*color: 0xff4fd8/);
  assert.match(source, /sculptBrushViabilityPlane\.material\.depthTest = true;[\s\S]*Sculpt Brush Viability Plane \(Debug\)[\s\S]*function updateSculptBrushViabilityPlane\(\)[\s\S]*sculptBrushViabilityPlane\.visible = visible && sculptBrushShowClippingPlaneInput\.checked[\s\S]*sculptBrushCurveClippingPlane\.constant = -planeOffset[\s\S]*sculptBrushPlaneRight\.set\(1, 0, 0\)\.applyQuaternion\(camera\.quaternion\)[\s\S]*sculptBrushViabilityPlane\.position\.copy\(sculptBrushPlaneNormal\)\.multiplyScalar\(planeOffset\)[\s\S]*sculptBrushViabilityPlane\.quaternion\.setFromRotationMatrix\(sculptBrushPlaneBasis\)[\s\S]*const changedLockIds = new Set[\s\S]*changedLockIds\.has\(lock\.id\)[\s\S]*updateCurveObjects\(lock/);
  assert.match(source, /controls\.addEventListener\("change", \(\) => \{[\s\S]*cameraViewportHelpersDirty = true/);
  assert.match(source, /function animate\(timestamp[\s\S]*controls\.update\(\);[\s\S]*if \(cameraViewportHelpersDirty\) \{[\s\S]*updateCameraViewCube\(\);[\s\S]*updateSculptBrushViabilityPlane\(\);[\s\S]*updateReferencePlaneVisibility\(\);[\s\S]*updateViewPlaneGrid\(\);[\s\S]*cameraViewportHelpersDirty = false;[\s\S]*else if \(sculptMoveStroke\)/);
  const animateSource = source.match(/function animate\(timestamp[\s\S]*?requestAnimationFrame\(animate\);\s*\}/)?.[0] || "";
  assert.doesNotMatch(animateSource, /updateReferenceCropHandles\(\)/);
  assert.doesNotMatch(animateSource, /updatePullGuideVisual\(\)/);
  assert.match(source, /function resize\(\)[\s\S]*applyReferenceImageRuntime[\s\S]*updateReferenceCropHandles\(\)/);
  assert.match(source, /line\.material\.depthTest = false;[\s\S]*line\.material\.stencilWrite = brushDebugVisible;[\s\S]*line\.material\.stencilFunc = THREE\.NotEqualStencilFunc;[\s\S]*line\.renderOrder = brushDebugVisible \? 50 : 3/);
  assert.match(source, /handle\.material\.depthTest = false;[\s\S]*handle\.material\.stencilWrite = brushDebugVisible;[\s\S]*handle\.material\.stencilFunc = THREE\.NotEqualStencilFunc;[\s\S]*handle\.renderOrder = brushDebugVisible \? 51 : 4/);
  assert.match(source, /child\.material = new THREE\.MeshStandardMaterial\(\{[\s\S]*stencilWrite: true,[\s\S]*stencilFunc: THREE\.AlwaysStencilFunc,[\s\S]*stencilZFail: THREE\.ReplaceStencilOp/);
  assert.match(source, /renderer\.localClippingEnabled = true/);
  assert.match(source, /function setSculptBrushMaterialClipping\(material, enabled\)[\s\S]*material\.clippingPlanes = enabled \? sculptBrushCurveClippingPlanes : null/);
  assert.match(source, /sculptBrushCurveClippingPlane\.normal\.copy\(sculptBrushPlaneNormal\);/);
  assert.match(source, /function captureSculptMoveStrokeInfluence\([\s\S]*pointInCameraFacingHalfSpace\(sourcePoint, planeNormal, planeOffset\)[\s\S]*pointInCameraFacingHalfSpace\(partnerPoint, planeNormal, planeOffset\)/);
  assert.match(source, /function beginSculptMoveStroke\(event\)[\s\S]*const planeNormal = sculptBrushWorkingPlaneNormal\(\);[\s\S]*const planeOffset = sculptBrushPlaneOffset\(\);[\s\S]*planeNormal,[\s\S]*planeOffset,/);
  assert.match(source, /function updateSculptBrushDebugCurve\(lock\)[\s\S]*strandBaseCurve\(lock\)\.getPoints\(40\)[\s\S]*group\.visible = true/);
  assert.match(source, /function updateCurveObjects\(lock, options = \{\}\)[\s\S]*sculptBrushHelpersSuppressed = sculptBrushToolActive\(\)[\s\S]*edge\.visible = lock\.id === selectedId[\s\S]*!sculptBrushHelpersSuppressed[\s\S]*arrow\.visible = componentEditModeActive\(\)[\s\S]*!sculptBrushHelpersSuppressed/);
  assert.match(source, /panelSplitHandles\?\.forEach[\s\S]*visible = !sculptBrushHelpersSuppressed[\s\S]*if \(!visible\) \{[\s\S]*line\.visible = false[\s\S]*strandSplitVisible = !sculptBrushHelpersSuppressed/);
  assert.match(
    source,
    /handle\.raycast = brushDebugVisible\s*\? sculptBrushDebugRaycast\s*:\s*strandControlPointRaycast/
  );
  assert.match(source, /const brushCurveVisibilityAllowed = !sculptBrushToolActive\(\) \|\| sculptBrushShowCurvesInput\.checked;[\s\S]*lock\.curveObjects\.group\.visible = brushCurveVisibilityAllowed[\s\S]*options\.visible && componentEditModeActive\(\)[\s\S]*brushDebugVisible/);
  assert.match(source, /syncSculptBrushMirrorPoints\(source, partner\)[\s\S]*updateSculptBrushDebugCurve\(source\)[\s\S]*updateSculptBrushDebugCurve\(partner\)/);
  assert.match(source, /sculptBrushStrengthInput\.addEventListener\("input", updateActiveSculptBrushStrength\)/);
  assert.match(source, /sculptBrushShowClippingPlaneInput\.addEventListener\("change", updateSculptBrushViabilityPlane\)/);
  assert.match(source, /sculptBrushShowCurvesInput\.addEventListener\("change",[\s\S]*refreshSculptBrushDebugView\(\)/);
  assert.match(source, /sculptBrushPlanePositionInput\.addEventListener\("input",[\s\S]*updateSculptBrushViabilityPlane\(\)/);
  assert.match(css, /\.sculpt-inflate-icon\s*\{[\s\S]*border-radius:\s*50%/);
  assert.match(css, /\.sculpt-brush-cursor\.inflate\s*\{[\s\S]*border-color:\s*#ff79cf/);
  assert.match(css, /\.attribute-editor-content > \.active-tool-settings\s*\{[\s\S]*order:\s*-1000\s*!important;[\s\S]*#proportionalPanel\s*\{[\s\S]*order:\s*-999;/);
});

test("scalp editor keeps transform tools active and places viewport guidance at bottom left", async () => {
  const [source, css, html] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8")
  ]);

  assert.match(source, /const scalpBuilderTool = \["select", "move"\]\.includes\(tool\)/);
  assert.match(source, /if \(scalpBuilderEditing && setupTransformTool && !scalpBuilderTool\) return;/);
  assert.match(source, /const usefulInScalpEditor = scalpBuilderEditing[\s\S]*\["select", "move"\]\.includes\(tool\)/);
  assert.match(source, /if \(\["rotate", "scale"\]\.includes\(activeTool\)\) setActiveTool\("select"\)/);
  assert.match(source, /if \(scalpBuilderEditing && tool === "move"\)/);
  assert.match(source, /scalpBuilderCurveLattice\?\.handles\[scalpBuilderCurveLattice\.selectedIndex\]/);
  assert.doesNotMatch(source, /placementStatus\.classList\.toggle\("bottom-left"/);
  assert.match(
    html,
    /class="workspace-status-bar"[\s\S]*id="placementStatus"/
  );
  assert.doesNotMatch(html, /hierarchyNavigationHint|Navigate curve points/);
  assert.match(
    css,
    /\.viewport-bottom-left-guidance\s*\{[\s\S]*?left:\s*18px;[\s\S]*?bottom:\s*18px;[\s\S]*?flex-direction:\s*column;/
  );
});

test("display visibility filters expose every strand region, layer, character mesh, and guide parent", async () => {
  const [html, source, projectState] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/project-state.js", import.meta.url), "utf8")
  ]);
  const regions = [...html.matchAll(/data-region-visibility=["']([^"']+)["']/g)].map((match) => match[1]);
  const layers = [...html.matchAll(/data-layer-visibility=["']([^"']+)["']/g)].map((match) => match[1]);

  assert.deepEqual(regions, [
    "bangs",
    "side-bangs-left",
    "side-bangs-right",
    "side-left",
    "side-right",
    "back",
    "unassigned"
  ]);
  assert.deepEqual(layers, ["bottom", "mid", "top", "accent"]);
  assert.match(html, /id=["']allRegionsVisibility["'][^>]*checked/);
  assert.match(html, /id=["']allLayersVisibility["'][^>]*checked/);
  assert.match(html, /id=["']allGuidesVisibility["']/);
  assert.match(html, /id=["']scalpDisplayVisibility["']/);
  assert.match(html, /id=["']capsuleDisplayVisibility["']/);
  assert.match(html, /id=["']curveLatticeDisplayVisibility["']/);
  assert.match(html, /Character Meshes[\s\S]*id=["']headMeshDisplayVisibility["'][^>]*checked[\s\S]*Head Mesh/);
  assert.match(html, /Character Meshes[\s\S]*id=["']bodyMeshDisplayVisibility["'][^>]*checked[\s\S]*Body Mesh/);
  assert.match(source, /function applyCharacterMeshDisplayVisibility\(\)[\s\S]*guideModel\.visible = guideModel\.userData\.fullBodyReference[\s\S]*bodyMeshVisible[\s\S]*headMeshVisible/);
  assert.match(source, /function syncDisplayVisibilityInputs\(\)[\s\S]*headMeshDisplayVisibilityInput\.disabled = !hasCharacterMesh \|\| hasBodyMesh[\s\S]*bodyMeshDisplayVisibilityInput\.disabled = !hasCharacterMesh \|\| !hasBodyMesh/);
  assert.match(source, /headMeshDisplayVisibilityInput\.addEventListener\("change"[\s\S]*bodyMeshDisplayVisibilityInput\.addEventListener\("change"/);
  assert.match(source, /function snapshotState\(\)[\s\S]*curveLatticeGuidesVisible,[\s\S]*headMeshVisible,[\s\S]*bodyMeshVisible,/);
  assert.match(projectState, /curveLatticeGuides: state\.curveLatticeGuidesVisible !== false,[\s\S]*headMesh: state\.headMeshVisible !== false,[\s\S]*bodyMesh: state\.bodyMeshVisible !== false/);
});

test("guide visibility button exposes independent guide-type checks and reveals newly created guides", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="scalpGuideVisibilityToggle"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"/);
  assert.match(html, /id="guideViewContextMenu"[\s\S]*data-guide-visibility="scalp"[\s\S]*data-guide-visibility="capsule"[\s\S]*data-guide-visibility="lattice"[\s\S]*data-guide-visibility="references"/);
  assert.match(source, /const guideViewVisibilityInputs = \[\.\.\.guideViewContextMenu\.querySelectorAll\("\[data-guide-visibility\]"\)\]/);
  assert.match(source, /scalpGuideVisibilityToggle\.addEventListener\("click", showGuideViewContextMenu\)[\s\S]*guideViewVisibilityInputs\.forEach[\s\S]*setScalpGuideVisibility\(input\.checked\)[\s\S]*capsuleGuidesVisible = input\.checked[\s\S]*curveLatticeGuidesVisible = input\.checked[\s\S]*referencesVisible = input\.checked[\s\S]*applyReferenceDisplayVisibility/);
  assert.match(source, /function updateGuideViewToggle\(\)[\s\S]*referencesVisible && "References"/);
  assert.match(source, /function applyReferenceDisplayVisibility\(\)[\s\S]*referenceImages\.forEach\(applyReferenceImageRuntime\)[\s\S]*updateReferenceSelectionVisuals\(\)[\s\S]*updateReferenceCropHandles\(\)/);
  assert.match(source, /function snapshotState\(\)[\s\S]*curveLatticeGuidesVisible,[\s\S]*referencesVisible,/);
  assert.match(source, /restoreSharedStateForStateRestore[\s\S]*referencesVisible = restorePlan\.visibility\.references/);
  assert.match(source, /function addCurveLattice\([\s\S]*if \(!options\.deferUi\) \{[\s\S]*curveLatticeGuidesVisible = true;[\s\S]*syncDisplayVisibilityInputs\(\)/);
  assert.match(source, /function addCapsuleGuide\([\s\S]*if \(!deferUi\) \{[\s\S]*capsuleGuidesVisible = true;[\s\S]*syncDisplayVisibilityInputs\(\)/);
  assert.doesNotMatch(source, /GUIDE_VIEW_MODES|cycleGuideViewMode|data-guide-view-mode/);
  assert.match(source, /function filterCurveLatticesToGroup[\s\S]*curveLatticeGuidesVisible && guide\.outlinerVisible/);
  assert.match(css, /\.guide-view-check-row[\s\S]*accent-color: #63c7ff/);
});

test("file menu exposes online downloads and de-emphasized local exports", async () => {
  const [html, source, server, css, fileActions] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../server.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/file-actions.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id=["']exportObj["']/);
  assert.match(html, /id=["']exportUsda["']/);
  assert.match(html, /id=["']localExportObj["'][\s\S]*?class=["'][^"']*local-save-menu-item/);
  assert.match(html, /id=["']localExportUsda["'][\s\S]*?class=["'][^"']*local-save-menu-item/);
  assert.match(html, /id=["']localExportObj["'][\s\S]*?title=["'][^"']*Local Export for Dev purposes/);
  assert.match(html, /id=["']localExportUsda["'][\s\S]*?title=["'][^"']*Local Export for Dev purposes/);
  assert.match(source, /function exportHairUsdaLocally\(\)\s*\{\s*openFileActionDialog\(\{\s*format:\s*"usda",\s*local:\s*true\s*\}\)/);
  assert.match(server, /\["obj", "usda"\]/);
  assert.match(server, /Universal Scene Description ASCII \(\*\.usda\)\|\*\.usda/);
  assert.match(server, /Anime Hair Studio Project \(\*\.ahs\)\|\*\.ahs/);
  assert.match(server, /Legacy Anime Hair Project \(\*\.animehair\.json\)\|\*\.animehair\.json/);
  assert.match(server, /const defaultExtension = exportKind === "project"\s*\?\s*"ahs"/);
  assert.match(html, /id=["']fileActionDialog["'][\s\S]*?id=["']fileActionName["'][\s\S]*?id=["']fileActionExtension["']/);
  assert.match(html, /id=["']hairProjectFile["'][^>]*accept=["'][^"']*\.ahs[^"']*\.animehair\.json[^"']*\.json/);
  assert.match(html, /id=["']fileActionExtension["'][^>]*>\.ahs</);
  assert.match(fileActions, /extension:\s*"\.ahs"/);
  assert.match(html, /id=["']fileExportContents["'][\s\S]*?id=["']exportIncludeMesh["'][\s\S]*?id=["']exportIncludeCurves["'][\s\S]*?id=["']exportIncludeBones["'][\s\S]*?id=["']exportIncludeWeights["']/);
  assert.match(html, /id=["']projectSaveContents["'][\s\S]*?Project Contents[\s\S]*?id=["']projectIncludeHeadAsset["'][^>]*checked[\s\S]*?Head \/ Body Mesh[\s\S]*?id=["']projectIncludeReferences["'][^>]*checked[\s\S]*?References/);
  assert.match(source, /function openFileActionDialog\([\s\S]*fileActionFormat\(format\)[\s\S]*fileExportAvailability[\s\S]*fileActionDialog\.showModal\(\)/);
  assert.match(source, /projectSaveContents\.classList\.toggle\("hidden", isExport\)[\s\S]*projectIncludeHeadAssetInput\.checked = true[\s\S]*projectIncludeHeadAssetInput\.disabled = !importedHeadAsset[\s\S]*projectIncludeReferencesInput\.checked = true[\s\S]*projectIncludeReferencesInput\.disabled = referenceImages\.length === 0/);
  assert.match(source, /function buildHairProjectFile\(name, \{[\s\S]*includeHeadAsset = true[\s\S]*includeReferences = true[\s\S]*if \(!includeReferences\) state\.referenceImages = \[\][\s\S]*headAsset: includeHeadAsset \? importedHeadAsset : null/);
  assert.match(source, /headAssetOmitted: Boolean\(importedHeadAsset && !includeHeadAsset\)/);
  assert.match(source, /async function openHairProjectFile\(file,[\s\S]*project\.headAssetOmitted === true[\s\S]*disposeGuideModel\(guideModel\)[\s\S]*guideModel = null[\s\S]*importedHeadAsset = null[\s\S]*else if \(project\.headAsset\?\.format === "obj"/);
  assert.match(source, /function performFileAction\(action, baseName, contents\)[\s\S]*buildHairProjectFile\(baseName, \{[\s\S]*includeHeadAsset: contents\.headAsset[\s\S]*includeReferences: contents\.references/);
  assert.match(source, /fileActionForm\.addEventListener\("submit"[\s\S]*action\.format === "project"[\s\S]*headAsset: projectIncludeHeadAssetInput\.checked && !projectIncludeHeadAssetInput\.disabled[\s\S]*references: projectIncludeReferencesInput\.checked && !projectIncludeReferencesInput\.disabled/);
  assert.match(source, /row\.classList\.remove\("hidden"\)[\s\S]*Not supported in \$\{definition\.label\}\. Use USDA to export\./);
  assert.match(source, /const objPolyline = format === "obj" && key === "curves"[\s\S]*Export Curve as Polyline[\s\S]*Not supported in Maya\./);
  assert.match(source, /fileActionForm\.addEventListener\("submit"[\s\S]*normalizeExportContents[\s\S]*performFileAction/);
  assert.match(source, /function buildHairObj\(\{\s*includeMesh = true,\s*includeCurves = true,\s*selectedIds = null\s*\} = \{\}\)[\s\S]*if \(includeMesh\)[\s\S]*if \(includeCurves\)/);
  assert.match(source, /function buildHairUsda\(\{[\s\S]*includeMesh = true[\s\S]*includeCurves = true[\s\S]*includeBones = false[\s\S]*includeWeights = false/);
  assert.match(css, /\.file-action-dialog\s*\{[\s\S]*transform:\s*translate\(-50%, -50%\)/);
  assert.match(css, /\.file-export-contents\.hidden,[\s\S]*\.file-export-option\.hidden\s*\{[\s\S]*display:\s*none/);
  assert.doesNotMatch(html, /exportMaya|localExportMaya|Python For Maya/);
  assert.doesNotMatch(source, /buildMayaImportScript|exportHairForMaya|mayaCurveExportData|utf8Base64/);
  assert.doesNotMatch(server, /export-maya|Maya Python Importer|mayaExport/);
});

test("debug menu toggles a labeled UV checker and synchronized UV inspector without replacing authored materials", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /id=["']debugMenuToggle["'][\s\S]*?id=["']debugMenu["'][\s\S]*?id=["']toggleUvChecker["'][^>]*aria-pressed=["']false["'][\s\S]*?id=["']uvCheckerMenuState["']/);
  assert.match(html, /id=["']uvInspectorWindow["'][\s\S]*?id=["']uvInspectorDragHandle["'][\s\S]*?id=["']uvInspectorCanvas["'][\s\S]*?id=["']uvInspectorStatus["']/);
  assert.match(source, /function createUvCheckerTexture\(\)[\s\S]*new THREE\.CanvasTexture\(canvas\)[\s\S]*THREE\.RepeatWrapping/);
  assert.match(source, /function ensureUvCheckerForLock\(lock\)[\s\S]*uvCheckerOriginalMaterial[\s\S]*new THREE\.MeshBasicMaterial[\s\S]*userData\.uvChecker = true/);
  assert.match(source, /function applyMaterialDefinitionToLock\(lock\)[\s\S]*lock\.mesh\.material === lock\.uvCheckerMaterial[\s\S]*lock\.mesh\.material = lock\.uvCheckerOriginalMaterial[\s\S]*ensureUvCheckerForLock\(lock\)/);
  assert.match(source, /function removeUvCheckerFromLock\(lock\)[\s\S]*lock\.mesh\.material = lock\.uvCheckerOriginalMaterial[\s\S]*checkerMaterial\.dispose\(\)/);
  assert.match(source, /function uvInspectorRecord\(lock\)[\s\S]*uvInspectorRecordCache\.get\(geometry\)[\s\S]*hairFaceIndices\(geometry\)[\s\S]*uvInspectorRecordCache\.set\(geometry/);
  assert.match(source, /function renderUvInspector\([\s\S]*if \(!force && !uvInspectorDirty\) return[\s\S]*uvCoordinateBounds\(allPoints\)[\s\S]*uvViewTransform\(bounds[\s\S]*#ff4fd8/);
  assert.match(source, /function setUvCheckerEnabled\(enabled\)[\s\S]*uvInspectorWindow\.show\(\)[\s\S]*uvInspectorWindow\.close\(\)/);
  assert.match(source, /toggleUvCheckerButton\.addEventListener\("click", \(\) => setUvCheckerEnabled\(!uvCheckerEnabled\)\)/);
  assert.match(source, /function rebuildLockGeometry\([\s\S]*invalidateUvInspector\(\)/);
  assert.match(source, /function refreshStrandSelectionConsumers\([\s\S]*invalidateUvInspector\(\)/);
  assert.match(source, /new ResizeObserver\(invalidateUvInspector\)\.observe\(uvInspectorWindow\)/);
  assert.match(source, /function animate\([\s\S]*renderUvInspector\(timestamp\)[\s\S]*renderer\.render/);
  assert.doesNotMatch(source, /function animate\([\s\S]*syncUvCheckerMaterials\(\)/);
  assert.match(source, /function disposeLockRuntime\(lock\)[\s\S]*removeUvCheckerFromLock\(lock\)[\s\S]*lock\.mesh\.material\.dispose\(\)[\s\S]*function disposeAllEditableObjects\(\)[\s\S]*locks\.forEach\(disposeLockRuntime\)/);
  assert.match(source, /function deleteLocks\([\s\S]*removeUvCheckerFromLock\(item\)[\s\S]*item\.mesh\.material\.dispose\(\)/);
  assert.match(css, /\.app-menu-dropdown button\.active \.app-menu-state\s*\{[\s\S]*color:\s*#a8e1ff/);
  assert.match(css, /\.uv-inspector-window\s*\{[\s\S]*resize:\s*both[\s\S]*\.uv-inspector-window\[open\]\s*\{[\s\S]*display:\s*grid/);
});

test("settings menu exposes preference markup and language controls", async () => {
  const { html } = await settingsContractSources();

  assert.match(html, /id=["']settingsMenuToggle["']/);
  assert.match(html, /id=["']settingsMenu["'][\s\S]*?id=["']openPreferences["'][\s\S]*?Preferences\.\.\.[\s\S]*?id=["']languageSelect["']/);
  assert.match(html, /id=["']preferencesDialog["'][\s\S]*?class=["']preferences-workspace["'][\s\S]*?class=["']preferences-categories["'][\s\S]*?data-preference-category=["']viewport["'][\s\S]*?data-preference-category=["']materials["'][\s\S]*?data-preference-category=["']experimental["'][\s\S]*?data-preference-category=["']backup["'][\s\S]*?class=["']preferences-content["']/);
  assert.match(html, /data-preference-panel=["']experimental["'][\s\S]*id=["']proceduralDrawExperimentalPreference["']/);
  assert.match(html, /data-preference-panel=["']viewport["'][\s\S]*?id=["']viewportInterface["'][\s\S]*?id=["']radialMenusPreference["'][^>]*checked[\s\S]*?id=["']viewportConventions["'][\s\S]*?data-preference-panel=["']materials["'][\s\S]*?id=["']defaultHairShaderPreference["'][\s\S]*?value=["']standard-anisotropic["'][\s\S]*?value=["']anime-anisotropic["'][\s\S]*?value=["']lambert["']/);
  assert.match(html, /data-preference-anchor=["']viewportDisplay["'][\s\S]*?data-preference-anchor=["']viewportInterface["'][\s\S]*?data-preference-anchor=["']viewportConventions["']/);
  assert.match(html, /id=["']navigationTipsPreference["'][^>]*checked/);
  assert.match(html, /id=["']navigationStylePreference["'][\s\S]*?value=["']anime-hair-studio["']>Anime Hair Studio<[\s\S]*?value=["']blender["']>Blender</);
  assert.match(html, /id=["']cameraSmoothingPreference["'][^>]*type=["']checkbox["'][\s\S]*?id=["']cameraSmoothingStrengthPreference["'][^>]*type=["']range["'][^>]*min=["']0["'][^>]*max=["']1["'][^>]*value=["']0\.5["']/);
  assert.doesNotMatch(html, /id=["']cameraSmoothingPreference["'][^>]*checked/);
  assert.match(html, /id=["']toolTipsPreference["'][^>]*checked/);
  assert.match(html, /id=["']viewportStatisticsPreference["'][^>]*checked/);
  assert.match(html, /id=["']layerColorShiftsPreference["'][^>]*checked/);
  assert.match(html, /id=["']sideNamingPerspectivePreference["'][\s\S]*?value=["']viewport["']>Viewport Perspective<[\s\S]*?value=["']character["']>Character Perspective</);
  assert.match(html, /id=["']viewportBackgroundColorPreference["'][^>]*type=["']color["'][^>]*value=["']#2b2730["']/);
  assert.match(html, /id=["']resetViewportBackgroundColor["'][^>]*class=["']slider-reset-button["'][^>]*aria-label=["']Reset viewport background colour["']/);
  assert.match(html, /id="compactToolButtonsPreference"[^>]*type="checkbox"/);
  assert.doesNotMatch(html, /id="compactToolButtonsPreference"[^>]*checked/);
  assert.match(html, /id="sidePanelStylePreference"[\s\S]*value="default">Legacy<[\s\S]*value="transparent">No panel backgrounds<[\s\S]*value="glass" selected>Glass Panels</);
  assert.match(html, /id="glassPanelColorPreference"[^>]*type="color"[^>]*value="#19181d"[\s\S]*id="resetGlassPanelColor"[^>]*aria-label="Reset glass panel colour"/);
  assert.match(html, /id="outlinerFolderColorsPreference"[^>]*type="checkbox"[^>]*checked/);
  assert.match(html, /id="outlinerFolderColorOpacityPreference"[^>]*type="range"[^>]*min="0"[^>]*max="100"[^>]*step="1"[^>]*value="100"/);
  assert.match(html, /class="preference-select" for="uiScalePreference"[\s\S]*id="uiScalePreference"[\s\S]*value="75">75%<[\s\S]*value="100" selected>100%<[\s\S]*value="125">125%</);
  assert.doesNotMatch(html, /sdfStrandFusionPreference|SDF strand fusion/);
  assert.match(html, /data-preference-panel=["']backup["'][\s\S]*?id=["']loadPreferencesAndPresets["'][\s\S]*?Load Preferences &amp; Presets[\s\S]*?id=["']downloadPreferencesAndPresets["'][\s\S]*?Download Preferences &amp; Presets[\s\S]*?id=["']preferencesAndPresetsFile["'][\s\S]*?id=["']preferencesBackupStatus["']/);
  assert.match(html, /data-preference-panel="backup"[\s\S]*id="autosavePreference"[^>]*type="checkbox"[^>]*checked[\s\S]*id="autosaveIntervalPreference"[\s\S]*value="15"[\s\S]*value="30" selected[\s\S]*value="300"/);
  assert.match(html, /id="recoveryDialog"[\s\S]*id="discardRecovery"[\s\S]*id="downloadRecovery"[\s\S]*id="recoverProject"/);
  assert.match(html, /id=["']viewportStats["'][^>]*class=["']viewport-stats["'][\s\S]*?id=["']viewportSelectedStats["'][\s\S]*?id=["']viewportTotalStats["'][\s\S]*?id=["']viewportFps["']/);
  assert.match(html, /class=["']preferences-dialog-head-actions["'][\s\S]*?id=["']cancelPreferences["'][\s\S]*?id=["']savePreferences["'][\s\S]*?id=["']closePreferences["']/);
  assert.doesNotMatch(html, /class=["']preferences-dialog-actions["']/);
  assert.match(html, /id=["']viewportNavigationTips["'][\s\S]*?Alt \+ Left Mouse[\s\S]*?Orbit[\s\S]*?Alt \+ Right Mouse[\s\S]*?Pan[\s\S]*?Scrollwheel[\s\S]*?Zoom[\s\S]*?<kbd>F<\/kbd>[\s\S]*?Cycle selected and full-scene framing/);
  assert.match(html, /data-navigation-style-tip="blender"[\s\S]*Middle Mouse[\s\S]*Shift \+ Middle Mouse[\s\S]*Ctrl \+ Middle Mouse[\s\S]*Scrollwheel[\s\S]*Alt \+ Middle Mouse/);
  assert.match(html, /data-navigation-style-shortcut="anime-hair-studio"[\s\S]*Alt[\s\S]*Left drag[\s\S]*data-navigation-style-shortcut="blender"[\s\S]*Middle Mouse drag[\s\S]*Ctrl \+ Middle Mouse[\s\S]*Zoom the camera[\s\S]*Scrollwheel[\s\S]*Zoom the camera/);
  assert.match(html, /id=["']languageSelect["'][\s\S]*?<option value=["']en["']>English<\/option>/);
  assert.match(html, /id=["']languageSelect["'][\s\S]*?<option value=["']ja["']>日本語<\/option>/);
});

test("settings preferences retain behavior and persistence contracts", async () => {
  const { source, css, localization, preferenceStorageSource } = await settingsContractSources();
  assert.match(source, /const RADIAL_MENUS_PREFERENCE_KEY = "anime-hair-studio-radial-menus"/);
  assert.doesNotMatch(source, /LEGACY_RADIAL_MENUS_PREFERENCE_KEY/);
  assert.match(preferenceStorageSource, /function readStoredPreference\([\s\S]*host\.localStorage\.getItem\(key\)[\s\S]*return fallback/);
  assert.match(preferenceStorageSource, /function readStoredBooleanPreference\([\s\S]*value === "true"[\s\S]*value === "false"[\s\S]*Boolean\(fallback\)/);
  assert.match(preferenceStorageSource, /function writeStoredPreference\([\s\S]*host\.localStorage\.setItem\(key, String\(value\)\)[\s\S]*return false/);
  assert.match(source, /let radialMenusEnabled = readStoredBooleanPreference\(window, RADIAL_MENUS_PREFERENCE_KEY, true\)/);
  assert.match(source, /function setRadialMenusEnabled\(enabled, \{ persist = true \} = \{\}\) \{[\s\S]*cancelToolShortcutPress\(\)[\s\S]*cancelToolRadialGesture\(\)[\s\S]*cancelStrandRadialGesture\(\)[\s\S]*saveBooleanPreference\(RADIAL_MENUS_PREFERENCE_KEY, radialMenusEnabled\)/);
  assert.match(source, /function setPreferenceCategory\(category\) \{[\s\S]*dataset\.preferenceCategory[\s\S]*aria-selected[\s\S]*dataset\.preferencePanel[\s\S]*preferencePageTitle\.textContent/);
  assert.match(source, /\["viewport", "materials", "experimental", "backup"\]\.includes\(category\)/);
  assert.match(source, /function downloadPreferencesAndPresets\(\) \{[\s\S]*createPreferencesBackup\([\s\S]*documentLocalizer\.language[\s\S]*defaultShader: defaultHairShader[\s\S]*presets: customCreationPresets[\s\S]*curveLatticePresets: customCurveLatticePresets[\s\S]*preferencesBackupFileName\(exportedAt\)/);
  assert.match(source, /function loadPreferencesAndPresets\(file\) \{[\s\S]*normalizePreferencesBackup\(JSON\.parse\(await file\.text\(\)\)\)[\s\S]*setNavigationTipsEnabled[\s\S]*setDefaultHairShader[\s\S]*normalizeCreationPresetLibrary\(backup\.presets\)[\s\S]*saveCustomCreationPresets\(\)[\s\S]*normalizeCurveLatticePresetLibrary\(backup\.curveLatticePresets\)[\s\S]*saveCustomCurveLatticePresets\(\)/);
  assert.match(source, /loadPreferencesAndPresetsButton\.addEventListener\("click"[\s\S]*preferencesAndPresetsFile\.click\(\)[\s\S]*preferencesAndPresetsFile\.addEventListener\("change", handlePreferencesAndPresetsFile\)/);
  assert.match(source, /downloadPreferencesAndPresetsButton\.addEventListener\("click", downloadPreferencesAndPresets\)/);
  assert.match(source, /function markProjectChangedForRecovery\(\)[\s\S]*recoveryChangeVersion \+= 1[\s\S]*scheduleRecoveryAutosave\(\)/);
  assert.match(source, /function flushRecoveryAutosave\(\)[\s\S]*buildHairProjectFile\(currentProjectName,[\s\S]*includeHeadAsset: true[\s\S]*includeReferences: true[\s\S]*writeRecoverySnapshot/);
  assert.match(source, /async function openHairProjectFile\(file, \{[\s\S]*replaceHistory = false[\s\S]*if \(replaceHistory\)[\s\S]*undoHistory\.clear\(\)[\s\S]*redoHistory\.clear\(\)/);
  assert.match(source, /async function offerRecoverySnapshot\(\)[\s\S]*readRecoverySnapshot\(\)[\s\S]*validateHairProject[\s\S]*recoveryDialog\.showModal\(\)/);
  assert.match(source, /recoverProjectButton\.addEventListener\("click", recoverPendingProject\)[\s\S]*discardRecoveryButton\.addEventListener\("click", discardPendingRecovery\)[\s\S]*downloadRecoveryButton\.addEventListener\("click", downloadPendingRecovery\)/);
  assert.match(source, /const recoveryVersionAtSave = recoveryChangeVersion[\s\S]*if \(saved\) \{[\s\S]*clearAcknowledgedRecovery\(recoveryVersionAtSave\)/);
  assert.match(source, /function openPreferencesDialog\(\) \{[\s\S]*preferencesOpenSnapshot[\s\S]*setPreferenceCategory\("viewport"\)[\s\S]*preferencesDialog\.showModal\(\)/);
  assert.match(source, /function savePreferencesDialog\(\) \{[\s\S]*saveBooleanPreference\(RADIAL_MENUS_PREFERENCE_KEY, radialMenusEnabled\)[\s\S]*saveBooleanPreference\(NAVIGATION_TIPS_PREFERENCE_KEY, navigationTipsEnabled\)[\s\S]*saveBooleanPreference\(TOOL_TIPS_PREFERENCE_KEY, toolTipsEnabled\)[\s\S]*saveBooleanPreference\(VIEWPORT_STATISTICS_PREFERENCE_KEY, viewportStatisticsEnabled\)[\s\S]*preferencesDialog\.close\(\)/);
  assert.match(source, /function cancelPreferencesDialog\(\) \{[\s\S]*setRadialMenusEnabled\([\s\S]*persist: false[\s\S]*setNavigationTipsEnabled\([\s\S]*persist: false[\s\S]*setToolTipsEnabled\([\s\S]*persist: false[\s\S]*setViewportStatisticsEnabled\([\s\S]*persist: false[\s\S]*preferencesDialog\.close\(\)/);
  assert.match(source, /radialMenusPreferenceInput\.addEventListener\("change"[\s\S]*setRadialMenusEnabled\(radialMenusPreferenceInput\.checked, \{ persist: false \}\)/);
  assert.match(source, /function beginStrandRadialGesture\(\) \{\s*if \(!radialMenusEnabled/);
  assert.match(source, /function beginToolRadialGesture\(\) \{\s*if \(!radialMenusEnabled/);
  assert.match(source, /function beginToolShortcutPress\(key, tool\) \{[\s\S]*setActiveTool\(tool\);\s*if \(!radialMenusEnabled && !hotkeyToolSettingsExperimentalEnabled\) return;/);
  assert.match(source, /const NAVIGATION_TIPS_PREFERENCE_KEY = "anime-hair-studio-navigation-tips"/);
  assert.match(source, /const NAVIGATION_STYLE_PREFERENCE_KEY = "anime-hair-studio-navigation-style"/);
  assert.match(source, /const CAMERA_SMOOTHING_ENABLED_PREFERENCE_KEY = "anime-hair-studio-camera-smoothing-enabled"/);
  assert.match(source, /const CAMERA_SMOOTHING_STRENGTH_PREFERENCE_KEY = "anime-hair-studio-camera-smoothing-strength"/);
  assert.match(source, /const VIEWPORT_BACKGROUND_COLOR_PREFERENCE_KEY = "anime-hair-studio-viewport-background-color"/);
  assert.match(source, /const DEFAULT_VIEWPORT_BACKGROUND_COLOR = "#2b2730"/);
  assert.match(source, /function setViewportBackgroundColor\(value, \{ persist = true \} = \{\}\) \{[\s\S]*--viewport-background-center[\s\S]*--viewport-background-middle[\s\S]*--viewport-background-edge[\s\S]*VIEWPORT_BACKGROUND_COLOR_PREFERENCE_KEY/);
  assert.match(source, /resetViewportBackgroundColorButton\.addEventListener\("click"[\s\S]*setViewportBackgroundColor\(DEFAULT_VIEWPORT_BACKGROUND_COLOR, \{ persist: false \}\)/);
  assert.match(source, /preferenceAnchorButtons\.forEach[\s\S]*setPreferenceCategory\("viewport"\)[\s\S]*scrollIntoView/);
  assert.match(css, /\.preferences-viewport-section[\s\S]*\.viewport-preference-grid[\s\S]*grid-template-columns: minmax\(0, 1fr\)[\s\S]*\.viewport-preference-grid > label[\s\S]*min-height: 42px;[\s\S]*margin: 0/);
  assert.match(css, /\.preference-category-group\.expanded \.preference-subcategories[\s\S]*display: grid/);
  assert.match(css, /--viewport-background-center: #2b2730[\s\S]*--viewport-background-middle: #16151a[\s\S]*--viewport-background-edge: #0c0b0f[\s\S]*var\(--viewport-background-edge\)/);
  assert.match(source, /let navigationTipsEnabled = readStoredBooleanPreference\(window, NAVIGATION_TIPS_PREFERENCE_KEY, true\)/);
  assert.match(source, /function setNavigationTipsEnabled\(enabled, \{ persist = true \} = \{\}\) \{[\s\S]*viewportNavigationTips\.classList\.toggle\("hidden", !navigationTipsEnabled\)[\s\S]*saveBooleanPreference\(NAVIGATION_TIPS_PREFERENCE_KEY, navigationTipsEnabled\)/);
  assert.match(source, /navigationTipsPreferenceInput\.addEventListener\("change"[\s\S]*setNavigationTipsEnabled\(navigationTipsPreferenceInput\.checked, \{ persist: false \}\)/);
  assert.match(source, /let navigationStyle = readStoredPreference\(window, NAVIGATION_STYLE_PREFERENCE_KEY, \{[\s\S]*fallback: "anime-hair-studio"[\s\S]*normalize: normalizeNavigationStyle/);
  assert.match(source, /function setNavigationStyle\(value,[\s\S]*navigationStyleTipRows[\s\S]*navigationStyleShortcutRows[\s\S]*configureNavigationMouseButtons\(\)[\s\S]*NAVIGATION_STYLE_PREFERENCE_KEY/);
  assert.match(source, /navigationStylePreferenceInput\.addEventListener\("change"[\s\S]*setNavigationStyle\(navigationStylePreferenceInput\.value, \{ persist: false \}\)/);
  assert.match(source, /function downloadPreferencesAndPresets\(\)[\s\S]*navigationStyle,[\s\S]*function loadPreferencesAndPresets\(file\)[\s\S]*setNavigationStyle\(preferences\.navigationStyle\)/);
  assert.match(source, /function openPreferencesDialog\(\)[\s\S]*navigationStyle,[\s\S]*function savePreferencesDialog\(\)[\s\S]*NAVIGATION_STYLE_PREFERENCE_KEY[\s\S]*function cancelPreferencesDialog\(\)[\s\S]*preferencesOpenSnapshot\.navigationStyle/);
  assert.match(source, /let cameraSmoothingEnabled = readStoredBooleanPreference\(window, CAMERA_SMOOTHING_ENABLED_PREFERENCE_KEY, false\)/);
  assert.match(source, /let cameraSmoothingStrength = readStoredPreference\(window, CAMERA_SMOOTHING_STRENGTH_PREFERENCE_KEY, \{[\s\S]*fallback: 0\.5[\s\S]*normalize: normalizeCameraSmoothingStrength/);
  assert.match(source, /function applyCameraSmoothingPreference\(\)[\s\S]*controls\.enableDamping = cameraSmoothingEnabled[\s\S]*controls\.dampingFactor = THREE\.MathUtils\.lerp\(0\.12, 0\.01, cameraSmoothingStrength\)[\s\S]*control\.disabled = !cameraSmoothingEnabled/);
  assert.match(source, /cameraSmoothingPreferenceInput\.addEventListener\("change"[\s\S]*setCameraSmoothingEnabled\(cameraSmoothingPreferenceInput\.checked, \{ persist: false \}\)[\s\S]*cameraSmoothingStrengthPreferenceInput\.addEventListener\("input"[\s\S]*setCameraSmoothingStrength\(cameraSmoothingStrengthPreferenceInput\.value, \{ persist: false \}\)/);
  assert.match(source, /function downloadPreferencesAndPresets\(\)[\s\S]*cameraSmoothingEnabled,[\s\S]*cameraSmoothingStrength,[\s\S]*function loadPreferencesAndPresets\(file\)[\s\S]*setCameraSmoothingEnabled[\s\S]*setCameraSmoothingStrength/);
  assert.match(source, /function openPreferencesDialog\(\)[\s\S]*cameraSmoothingEnabled,[\s\S]*cameraSmoothingStrength,[\s\S]*function savePreferencesDialog\(\)[\s\S]*CAMERA_SMOOTHING_ENABLED_PREFERENCE_KEY[\s\S]*CAMERA_SMOOTHING_STRENGTH_PREFERENCE_KEY[\s\S]*function cancelPreferencesDialog\(\)[\s\S]*preferencesOpenSnapshot\.cameraSmoothingEnabled[\s\S]*preferencesOpenSnapshot\.cameraSmoothingStrength/);
  assert.match(localization, /"Camera smoothing":[\s\S]*"Smoothing amount":[\s\S]*"Higher values let camera movement glide for longer\.":/);
  assert.match(css, /\.preference-slider\[aria-disabled="true"\]\s*\{[\s\S]*opacity: 0\.55/);
  assert.match(source, /const TOOL_TIPS_PREFERENCE_KEY = "anime-hair-studio-tool-tips"/);
  assert.match(source, /let toolTipsEnabled = readStoredBooleanPreference\(window, TOOL_TIPS_PREFERENCE_KEY, true\)/);
  assert.match(source, /function setToolTipsEnabled\(enabled, \{ persist = true \} = \{\}\) \{[\s\S]*updatePlacementStatus\(\)[\s\S]*saveBooleanPreference\(TOOL_TIPS_PREFERENCE_KEY, toolTipsEnabled\)/);
  assert.match(source, /function updatePlacementStatus\(\) \{[\s\S]*!toolTipsEnabled \|\| !message[\s\S]*placementStatus\.classList\.toggle\("hidden", hidden\)/);
  assert.match(source, /toolTipsPreferenceInput\.addEventListener\("change"[\s\S]*setToolTipsEnabled\(toolTipsPreferenceInput\.checked, \{ persist: false \}\)/);
  assert.match(source, /const COMPACT_TOOL_BUTTONS_PREFERENCE_KEY = "anime-hair-studio-compact-tool-buttons"/);
  assert.match(source, /let compactToolButtonsEnabled = readStoredBooleanPreference\(window, COMPACT_TOOL_BUTTONS_PREFERENCE_KEY, false\)/);
  assert.match(source, /function setCompactToolButtonsEnabled\(enabled, \{ persist = true \} = \{\}\) \{[\s\S]*document\.body\.classList\.toggle\("compact-tool-buttons", compactToolButtonsEnabled\)[\s\S]*saveBooleanPreference\(COMPACT_TOOL_BUTTONS_PREFERENCE_KEY, compactToolButtonsEnabled\)/);
  assert.match(source, /compactToolButtonsPreferenceInput\.addEventListener\("change"[\s\S]*setCompactToolButtonsEnabled\(compactToolButtonsPreferenceInput\.checked, \{ persist: false \}\)/);
  assert.match(source, /const UI_SCALE_PREFERENCE_KEY = "anime-hair-studio-ui-scale"[\s\S]*function normalizeUiScale\(value\)[\s\S]*Math\.min\(125, Math\.max\(75, Math\.round\(scale \/ 5\) \* 5\)\)[\s\S]*let uiScale = readStoredPreference\(window, UI_SCALE_PREFERENCE_KEY/);
  assert.match(source, /function setUiScale\(value, \{ persist = true \} = \{\}\)[\s\S]*--ui-scale[\s\S]*--ui-layout-width[\s\S]*--ui-layout-height[\s\S]*renderer\.setPixelRatio[\s\S]*requestAnimationFrame\(resize\)[\s\S]*UI_SCALE_PREFERENCE_KEY/);
  assert.match(source, /uiScalePreferenceInput\.addEventListener\("change"[\s\S]*setUiScale\(uiScalePreferenceInput\.value, \{ persist: false \}\)/);
  assert.doesNotMatch(source, /uiScalePreferenceNumberInput/);
  assert.match(source, /preferences:[\s\S]*uiScale,[\s\S]*preferences\.uiScale[\s\S]*setUiScale\(preferences\.uiScale\)/);
  assert.match(source, /function openPreferencesDialog\(\)[\s\S]*uiScale,[\s\S]*function savePreferencesDialog\(\)[\s\S]*UI_SCALE_PREFERENCE_KEY[\s\S]*function cancelPreferencesDialog\(\)[\s\S]*preferencesOpenSnapshot\.uiScale/);
  assert.match(css, /:root\s*\{[\s\S]*--ui-scale:\s*1[\s\S]*--ui-layout-width:\s*100vw[\s\S]*--ui-layout-height:\s*100vh[\s\S]*body\s*\{[\s\S]*zoom:\s*var\(--ui-scale\)[\s\S]*\.studio-shell\s*\{[\s\S]*height:\s*var\(--ui-layout-height\)/);
  assert.match(localization, /"UI scale":[\s\S]*"Scale the application interface while keeping the viewport fitted to the window\.":/);
  assert.match(source, /const SIDE_PANEL_STYLE_PREFERENCE_KEY = "anime-hair-studio-floating-side-panels"/);
  assert.match(source, /function normalizeSidePanelStyle\(value\)[\s\S]*value === "transparent" \|\| value === "glass"[\s\S]*value === true \|\| value === "true" \? "transparent" : "default"/);
  assert.match(source, /let sidePanelStyle = readStoredPreference\(window, SIDE_PANEL_STYLE_PREFERENCE_KEY, \{[\s\S]*fallback: "glass"[\s\S]*normalize: normalizeSidePanelStyle/);
  assert.match(source, /function setSidePanelStyle\(value, \{ persist = true \} = \{\}\) \{[\s\S]*classList\.toggle\("floating-side-panels", expanded\)[\s\S]*classList\.toggle\("glass-side-panels", sidePanelStyle === "glass" \|\| sidePanelStyle === "attached-glass"\)[\s\S]*writeStoredPreference\(window, SIDE_PANEL_STYLE_PREFERENCE_KEY, sidePanelStyle\)/);
  assert.match(source, /sidePanelStylePreferenceInput\.addEventListener\("change"[\s\S]*setSidePanelStyle\(sidePanelStylePreferenceInput\.value, \{ persist: false \}\)/);
  assert.match(source, /function downloadPreferencesAndPresets\(\)[\s\S]*sidePanelStyle,[\s\S]*function loadPreferencesAndPresets\(file\)[\s\S]*preferences\.sidePanelStyle[\s\S]*typeof preferences\.floatingSidePanels === "boolean"[\s\S]*"transparent" : "default"/);
  assert.match(source, /function openPreferencesDialog\(\)[\s\S]*sidePanelStyle,[\s\S]*function savePreferencesDialog\(\)[\s\S]*SIDE_PANEL_STYLE_PREFERENCE_KEY[\s\S]*function cancelPreferencesDialog\(\)[\s\S]*preferencesOpenSnapshot\.sidePanelStyle/);
  assert.match(source, /const GLASS_PANEL_COLOR_PREFERENCE_KEY = "anime-hair-studio-glass-panel-color"[\s\S]*const LEGACY_DEFAULT_GLASS_PANEL_COLOR = "#0b0a0e"[\s\S]*const DEFAULT_GLASS_PANEL_COLOR = "#19181d"[\s\S]*let glassPanelColor = readStoredPreference\(window, GLASS_PANEL_COLOR_PREFERENCE_KEY[\s\S]*glassPanelColor === LEGACY_DEFAULT_GLASS_PANEL_COLOR[\s\S]*DEFAULT_GLASS_PANEL_COLOR/);
  assert.match(source, /function setGlassPanelColor\(value, \{ persist = true \} = \{\}\)[\s\S]*--glass-panel-color[\s\S]*GLASS_PANEL_COLOR_PREFERENCE_KEY/);
  assert.match(source, /preferences:[\s\S]*glassPanelColor,[\s\S]*preferences\.glassPanelColor[\s\S]*setGlassPanelColor\(preferences\.glassPanelColor\)/);
  assert.match(source, /preferencesOpenSnapshot = \{[\s\S]*glassPanelColor,[\s\S]*GLASS_PANEL_COLOR_PREFERENCE_KEY[\s\S]*preferencesOpenSnapshot\.glassPanelColor/);
  assert.match(source, /glassPanelColorPreferenceInput\.addEventListener\("input"[\s\S]*setGlassPanelColor\(glassPanelColorPreferenceInput\.value, \{ persist: false \}\)[\s\S]*resetGlassPanelColorButton\.addEventListener\("click"[\s\S]*DEFAULT_GLASS_PANEL_COLOR/);
  assert.match(source, /const VIEWPORT_STATISTICS_PREFERENCE_KEY = "anime-hair-studio-viewport-statistics"/);
  assert.match(source, /let viewportStatisticsEnabled = readStoredBooleanPreference\(window, VIEWPORT_STATISTICS_PREFERENCE_KEY, true\)/);
  assert.match(source, /function setViewportStatisticsEnabled\(enabled, \{ persist = true \} = \{\}\) \{[\s\S]*viewportStats\.classList\.toggle\("hidden", !viewportStatisticsEnabled\)[\s\S]*saveBooleanPreference\(VIEWPORT_STATISTICS_PREFERENCE_KEY, viewportStatisticsEnabled\)/);
  assert.match(source, /viewportStatisticsPreferenceInput\.addEventListener\("change"[\s\S]*setViewportStatisticsEnabled\(viewportStatisticsPreferenceInput\.checked, \{ persist: false \}\)/);
  assert.match(source, /const LAYER_COLOR_SHIFTS_PREFERENCE_KEY = "anime-hair-studio-layer-color-shifts"/);
  assert.match(source, /let layerColorShiftsEnabled = readStoredBooleanPreference\(window, LAYER_COLOR_SHIFTS_PREFERENCE_KEY, true\)/);
  assert.match(source, /function setLayerColorShiftsEnabled\(enabled, \{ persist = true \} = \{\}\) \{[\s\S]*locks\.forEach\(applyMaterialDefinitionToLock\)[\s\S]*updateDrawStrandPreview\(\)[\s\S]*saveBooleanPreference\(LAYER_COLOR_SHIFTS_PREFERENCE_KEY, layerColorShiftsEnabled\)/);
  assert.match(source, /layerColorShiftsPreferenceInput\.addEventListener\("change"[\s\S]*setLayerColorShiftsEnabled\(layerColorShiftsPreferenceInput\.checked, \{ persist: false \}\)/);
  assert.match(source, /const OUTLINER_FOLDER_COLORS_PREFERENCE_KEY = "anime-hair-studio-outliner-folder-colors"/);
  assert.match(source, /const OUTLINER_FOLDER_COLOR_OPACITY_PREFERENCE_KEY = "anime-hair-studio-outliner-folder-color-opacity"/);
  assert.match(source, /function normalizeOutlinerFolderColorOpacity\(value\)[\s\S]*Math\.min\(100, Math\.max\(0, opacity\)\)[\s\S]*: 100/);
  assert.match(source, /function setOutlinerFolderColorOpacity\(value, \{ persist = true \} = \{\}\)[\s\S]*--outliner-folder-border-mix[\s\S]*--outliner-folder-background-mix[\s\S]*OUTLINER_FOLDER_COLOR_OPACITY_PREFERENCE_KEY/);
  assert.match(source, /outlinerFolderColorOpacityPreferenceInput\.addEventListener\("input"[\s\S]*setOutlinerFolderColorOpacity\(outlinerFolderColorOpacityPreferenceInput\.value, \{ persist: false \}\)/);
  assert.match(source, /preferences:[\s\S]*outlinerFolderColorOpacity,[\s\S]*preferences\.outlinerFolderColorOpacity[\s\S]*setOutlinerFolderColorOpacity/);
  assert.match(source, /preferencesOpenSnapshot = \{[\s\S]*outlinerFolderColorOpacity,[\s\S]*setOutlinerFolderColorOpacity\(preferencesOpenSnapshot\.outlinerFolderColorOpacity, \{ persist: false \}\)/);
  assert.match(css, /\.outliner-group \{[\s\S]*var\(--outliner-folder-border-mix, 58%\)[\s\S]*var\(--outliner-folder-background-mix, 11%\)/);
  assert.match(source, /let outlinerFolderColorsEnabled = readStoredBooleanPreference\(window, OUTLINER_FOLDER_COLORS_PREFERENCE_KEY, true\)/);
  assert.match(source, /function setOutlinerFolderColorsEnabled\(enabled, \{ persist = true \} = \{\}\) \{[\s\S]*classList\.toggle\("outliner-folder-colors-disabled", !outlinerFolderColorsEnabled\)[\s\S]*saveBooleanPreference\(OUTLINER_FOLDER_COLORS_PREFERENCE_KEY, outlinerFolderColorsEnabled\)/);
  assert.match(source, /outlinerFolderColorsPreferenceInput\.addEventListener\("change"[\s\S]*setOutlinerFolderColorsEnabled\(outlinerFolderColorsPreferenceInput\.checked, \{ persist: false \}\)/);
  assert.match(source, /function downloadPreferencesAndPresets\(\)[\s\S]*compactToolButtons: compactToolButtonsEnabled[\s\S]*outlinerFolderColors: outlinerFolderColorsEnabled/);
  assert.match(source, /function loadPreferencesAndPresets\(file\)[\s\S]*setCompactToolButtonsEnabled\([\s\S]*setOutlinerFolderColorsEnabled\(/);
  assert.match(source, /function openPreferencesDialog\(\)[\s\S]*compactToolButtonsEnabled[\s\S]*outlinerFolderColorsEnabled[\s\S]*preferencesDialog\.showModal/);
  assert.match(source, /function savePreferencesDialog\(\)[\s\S]*COMPACT_TOOL_BUTTONS_PREFERENCE_KEY[\s\S]*OUTLINER_FOLDER_COLORS_PREFERENCE_KEY/);
  assert.match(source, /function cancelPreferencesDialog\(\)[\s\S]*preferencesOpenSnapshot\.compactToolButtonsEnabled[\s\S]*preferencesOpenSnapshot\.outlinerFolderColorsEnabled/);
  assert.match(source, /const SIDE_NAMING_PERSPECTIVE_PREFERENCE_KEY = "anime-hair-studio-side-naming-perspective"[\s\S]*fallback: "viewport"[\s\S]*normalize: normalizeSideNamingPerspective/);
  assert.match(source, /function sideNamingDisplayId\(id\)[\s\S]*"side-bangs-left": "side-bangs-right"[\s\S]*function setSideNamingPerspective\(value,[\s\S]*updateSideNamingLabels\(\)/);
  assert.match(source, /sideNamingPerspectivePreferenceInput\.addEventListener\("change"[\s\S]*setSideNamingPerspective\(sideNamingPerspectivePreferenceInput\.value, \{ persist: false \}\)/);
  assert.match(source, /const adjustedFactor = showGroupColors[\s\S]*layerColorShiftsEnabled \? Number\(MATERIAL_LAYER_COLOR_FACTORS[\s\S]*if \(showGroupColors \|\| layerColorShiftsEnabled\)/);
  assert.match(source, /function openPreferencesDialog\(\) \{[\s\S]*layerColorShiftsEnabled[\s\S]*preferencesDialog\.showModal/);
  assert.match(source, /function savePreferencesDialog\(\) \{[\s\S]*saveBooleanPreference\(LAYER_COLOR_SHIFTS_PREFERENCE_KEY, layerColorShiftsEnabled\)/);
  assert.match(source, /function cancelPreferencesDialog\(\) \{[\s\S]*setLayerColorShiftsEnabled\(preferencesOpenSnapshot\.layerColorShiftsEnabled, \{ persist: false \}\)/);
  assert.match(source, /const DEFAULT_HAIR_SHADER_PREFERENCE_KEY = "anime-hair-studio-default-hair-shader"[\s\S]*let defaultHairShader = readStoredPreference\(window, DEFAULT_HAIR_SHADER_PREFERENCE_KEY, \{[\s\S]*fallback: STANDARD_ANISOTROPIC_SHADER[\s\S]*normalize: normalizeHairShader/);
  assert.match(source, /function builtInMaterialDefinitions\(\)[\s\S]*shader: defaultHairShader[\s\S]*const projectMaterialDefinitions = ensureRequiredMaterialDefinitions[\s\S]*function setDefaultHairShader\(shader, \{ persist = true \} = \{\}\)/);
  assert.match(source, /function savePreferencesDialog\(\) \{[\s\S]*writeStoredPreference\(window, DEFAULT_HAIR_SHADER_PREFERENCE_KEY, defaultHairShader\)/);
  assert.match(source, /function cancelPreferencesDialog\(\) \{[\s\S]*setDefaultHairShader\(preferencesOpenSnapshot\.defaultHairShader, \{ persist: false \}\)/);
});

test("settings preferences retain styling, localization, and version contracts", async () => {
  const { css, localization, packageSource, configSource } = await settingsContractSources();
  const packageData = JSON.parse(packageSource);
  assert.match(css, /\.preferences-dialog\s*\{[\s\S]*width:\s*min\(780px[\s\S]*height:\s*min\(620px[\s\S]*overflow:\s*hidden/);
  assert.match(css, /\.preferences-dialog-shell\s*\{[\s\S]*display:\s*flex[\s\S]*flex-direction:\s*column[\s\S]*height:\s*100%/);
  assert.match(css, /\.preferences-dialog-head-actions\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /\.preferences-workspace\s*\{[\s\S]*grid-template-columns:\s*170px minmax\(0, 1fr\)/);
  assert.match(css, /\.preferences-content\s*\{[\s\S]*overflow:\s*auto/);
  assert.match(css, /\.preferences-categories button\.active\s*\{[\s\S]*box-shadow:\s*inset 3px 0 #63c7ff/);
  assert.match(css, /\.preference-toggle,[\s\S]*\.preference-select,[\s\S]*\.preference-slider,[\s\S]*\.preference-color,[\s\S]*\.preference-choice\s*\{[\s\S]*justify-content:\s*space-between/);
  assert.match(css, /\.preference-backup-actions\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /\.preferences-section\s*\{[\s\S]*display:\s*grid;[\s\S]*gap:\s*8px/);
  assert.match(css, /\.viewport-stats\.hidden\s*\{\s*display:\s*none/);
  assert.match(css, /body\.compact-tool-buttons \.viewport-tools \.tool-button,[\s\S]*width:\s*38px;[\s\S]*min-width:\s*38px;[\s\S]*height:\s*38px;[\s\S]*min-height:\s*38px;[\s\S]*aspect-ratio:\s*1;[\s\S]*border-radius:\s*7px;[\s\S]*backdrop-filter:\s*blur\(14px\) saturate\(72%\)/);
  assert.match(css, /body\.compact-tool-buttons \.viewport-tools \.tool-button:not\(\.active\),[\s\S]*border:\s*1px solid #ffffff18;[\s\S]*background:\s*color-mix\(in srgb, var\(--glass-panel-color, #0b0a0e\) 73%, transparent\)/);
  assert.match(css, /body\.compact-tool-buttons \.mesh-primitive-tool\s*\{[\s\S]*width:\s*38px/);
  assert.match(css, /body\.compact-tool-buttons \.viewport-tools \.tool-button kbd,[\s\S]*display:\s*none/);
  assert.match(css, /body\.outliner-folder-colors-disabled \.outliner-group\s*\{[\s\S]*background:\s*transparent/);
  assert.match(css, /\.viewport-bottom-left-guidance\s*\{[\s\S]*left:\s*18px;[\s\S]*bottom:\s*18px;[\s\S]*flex-direction:\s*column/);
  assert.match(css, /\.viewport-navigation-tips > div\.hidden\s*\{\s*display:\s*none/);
  assert.match(css, /\.shortcut-row\.hidden\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /\.viewport-panel\.navigation-tips-visible/);
  assert.match(localization, /"Experimental Features":/);
  assert.match(localization, /"Procedural Draw":/);
  assert.match(localization, /"Layer colour and brightness shifts":/);
  assert.match(localization, /"Radial menus":/);
  assert.doesNotMatch(localization, /SDF strand fusion|Preview SDF Fusion|Clear SDF/);
  assert.match(localization, /"Tool tips":/);
  assert.match(localization, /"Compact tool buttons":/);
  assert.match(localization, /"Side panel style":[\s\S]*"Legacy":[\s\S]*"No panel backgrounds":[\s\S]*"Glass Panels":[\s\S]*"Glass panel colour":[\s\S]*"Set the dark smoky tint used by Glass Panels\.":[\s\S]*"Reset glass panel colour":/);
  assert.match(localization, /"Outliner folder colours":/);
  assert.match(localization, /"Default shader":/);
  assert.match(localization, /"Load Preferences & Presets":/);
  assert.match(localization, /"Show contextual modelling guidance in the viewport\.":/);
  assert.match(localization, /"Show selected and total vertex, triangle, and FPS statistics\.":/);
  assert.match(localization, /"Navigation tips":/);
  assert.match(localization, /"Navigation style":/);
  assert.match(localization, /"Middle Mouse":/);
  assert.match(localization, /"Alt \+ Left Mouse":/);
  assert.match(localization, /"Center viewport on selected object":/);
  assert.equal(packageData.version, "1.0.0");
  assert.match(configSource, /APP_VERSION\s*=\s*["']1\.0\.0["']/);
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /aria-selected="true" data-patch-notes-version="1\.0\.0"/);
  assert.match(html, /data-patch-notes-panel="1\.0\.0"/);
});

test("title bar exposes icon-only Patreon and Ko-fi support links", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);
  assert.match(
    html,
    /class="patreon-link"[\s\S]*href="https:\/\/www\.patreon\.com\/cw\/animehairstudio"[\s\S]*target="_blank"[\s\S]*rel="noopener noreferrer"[\s\S]*title="Support Anime Hair Studio on Patreon"[\s\S]*aria-label="Support Anime Hair Studio on Patreon"[\s\S]*<svg/
  );
  assert.match(
    html,
    /class="kofi-link"[\s\S]*href="https:\/\/ko-fi\.com\/animehairstudio"[\s\S]*target="_blank"[\s\S]*rel="noopener noreferrer"[\s\S]*title="Support Anime Hair Studio on Ko-fi"[\s\S]*aria-label="Support Anime Hair Studio on Ko-fi"[\s\S]*<svg/
  );
  assert.match(css, /\.patreon-link,[\s\S]*\.kofi-link\s*\{[\s\S]*\.patreon-link\s*\{[\s\S]*margin-left:\s*auto[\s\S]*\.kofi-link\s*\{[\s\S]*margin-left:\s*4px[\s\S]*\.patreon-link:hover,[\s\S]*color:\s*#ff6b4a[\s\S]*\.kofi-link:hover,[\s\S]*color:\s*#54c7ec[\s\S]*\.kofi-link svg\s*\{/);
});

test("help menu exposes a complete keyboard shortcut reference", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /id=["']helpMenu["'][\s\S]*?id=["']openShortcuts["'][\s\S]*?id=["']openPatchNotes["'][\s\S]*?Patch Notes[\s\S]*?id=["']joinDiscord["']/);
  assert.match(html, /id=["']shortcutsDialog["'][\s\S]*?Keyboard Shortcuts[\s\S]*?<h3>Tools<\/h3>[\s\S]*?<kbd[^>]*>Q<\/kbd>[\s\S]*?<kbd[^>]*>W<\/kbd>[\s\S]*?<kbd[^>]*>E<\/kbd>[\s\S]*?<kbd[^>]*>R<\/kbd>[\s\S]*?<kbd[^>]*>T<\/kbd>[\s\S]*?<kbd[^>]*>D<\/kbd>[\s\S]*?<kbd[^>]*>P<\/kbd>[\s\S]*?<kbd[^>]*>G<\/kbd>[\s\S]*?<h3>Selection<\/h3>[\s\S]*?<h3>Curves<\/h3>[\s\S]*?<h3>Editing<\/h3>[\s\S]*?<h3>General and Viewport<\/h3>/);
  assert.match(html, /id=["']patchNotesDialog["'][\s\S]*?data-patch-notes-version=["']0\.1\.5["'][\s\S]*?<time datetime=["']2026-08-12["']>August 12, 2026<\/time>[\s\S]*?data-patch-notes-version=["']0\.1\.4["'][\s\S]*?<time datetime=["']2026-08-05["']>August 5, 2026<\/time>[\s\S]*?data-patch-notes-version=["']0\.1\.3["'][\s\S]*?<time datetime=["']2026-07-30["']>July 30, 2026<\/time>[\s\S]*?data-patch-notes-version=["']0\.1\.2["'][\s\S]*?<time datetime=["']2026-07-25["']>July 25, 2026<\/time>[\s\S]*?data-patch-notes-version=["']0\.1\.1["'][\s\S]*?<time datetime=["']2026-07-23["']>July 23, 2026<\/time>[\s\S]*?data-patch-notes-panel=["']0\.1\.5["'][\s\S]*?<h3>New features<\/h3>[\s\S]*?<h3>UI changes<\/h3>[\s\S]*?<h3>Tweaks and quality of life<\/h3>[\s\S]*?<h3>Bug fixes<\/h3>[\s\S]*?data-patch-notes-panel=["']0\.1\.4["'][\s\S]*?<h3>New tools<\/h3>[\s\S]*?<h3>New features<\/h3>[\s\S]*?<h3>Editing improvements<\/h3>[\s\S]*?<h3>Files and projects<\/h3>[\s\S]*?<h3>UI\/UX<\/h3>[\s\S]*?<h3>Performance<\/h3>[\s\S]*?<h3>Bug fixes<\/h3>[\s\S]*?<h3>Misc<\/h3>[\s\S]*?data-patch-notes-panel=["']0\.1\.3["'][\s\S]*?Anime Hair Studio Version 0\.1\.3 Patch Notes[\s\S]*?data-patch-notes-panel=["']0\.1\.2["'][\s\S]*?<h3>Editing and navigation<\/h3>[\s\S]*?<h3>References and outliner<\/h3>[\s\S]*?<h3>Preferences and shortcuts<\/h3>[\s\S]*?<h3>Experimental radial menus<\/h3>[\s\S]*?<h3>Hair cards<\/h3>[\s\S]*?data-patch-notes-panel=["']0\.1\.1["'][\s\S]*?<h3>New tools<\/h3>[\s\S]*?<h3>Strand editing<\/h3>[\s\S]*?<h3>Visibility and interface<\/h3>[\s\S]*?<h3>Materials<\/h3>[\s\S]*?<h3>Bug fixes<\/h3>/);
  assert.doesNotMatch(html, /0\.1\.4 Draft|Draft notes used to preview patch-note history navigation/);
  assert.match(html, /<h3>Selection<\/h3>[\s\S]*?<kbd>B<\/kbd>[\s\S]*?<kbd>Hold B<\/kbd>[\s\S]*?<h3>Curves<\/h3>/);
  assert.match(html, /<h3>Curves<\/h3>[\s\S]*?<kbd>H<\/kbd>[\s\S]*?<h3>Editing<\/h3>[\s\S]*?<kbd>X<\/kbd><span>Toggle X-axis mirror editing<\/span>/);
  assert.doesNotMatch(html, /Previous curve point in the hierarchy|Next curve point in the hierarchy/);
  assert.match(html, /<h3>Editing<\/h3>[\s\S]*?<kbd>S<\/kbd>[\s\S]*?Adjust the active brush size[\s\S]*?<kbd>Delete<\/kbd>[\s\S]*?<kbd>O<\/kbd>/);
  assert.match(html, /Orbit drag[\s\S]*<kbd>Hold Shift<\/kbd>[\s\S]*Snap the camera to cardinal views[\s\S]*Orbit the camera[\s\S]*<kbd>F<\/kbd>[\s\S]*Cycle selected and full-scene framing[\s\S]*Hold Q \/ W \/ E \/ R[\s\S]*Choose options for that tool[\s\S]*Close the active menu or window/);
  assert.match(source, /openShortcutsButton\.addEventListener\("click", \(\) => shortcutsDialog\.showModal\(\)\)/);
  assert.match(source, /\[closeShortcutsButton, dismissShortcutsButton\][\s\S]*shortcutsDialog\.close\(\)/);
  assert.match(source, /function selectPatchNotesVersion\(version\)[\s\S]*patchNotesPanels\.find[\s\S]*aria-selected[\s\S]*panel\.hidden = panel !== selectedPanel[\s\S]*patchNotesDialogTitle\.textContent[\s\S]*selectedPanel\.scrollTop = 0/);
  assert.match(source, /openPatchNotesButton\.addEventListener\("click"[\s\S]*selectPatchNotesVersion\(patchNotesVersionButtons\[0\][\s\S]*patchNotesDialog\.showModal\(\)/);
  assert.match(source, /\[closePatchNotesButton, dismissPatchNotesButton\][\s\S]*patchNotesDialog\.close\(\)/);
  assert.match(css, /\.shortcuts-dialog\s*\{[\s\S]*width:\s*min\(1180px/);
  assert.match(css, /\.patch-notes-dialog\s*\{[\s\S]*width:\s*min\(1040px[\s\S]*height:\s*calc\(100vh - 32px\)[\s\S]*overflow:\s*hidden/);
  assert.match(css, /\.patch-notes-dialog-shell\s*\{[\s\S]*height:\s*100%/);
  assert.match(css, /\.patch-notes-workspace\s*\{[\s\S]*grid-template-columns:\s*150px minmax\(0, 1fr\)/);
  assert.match(css, /\.patch-notes-sidebar button\.active\s*\{[\s\S]*background:\s*#1d3040;[\s\S]*color:\s*#9edcff/);
  assert.match(css, /\.patch-notes-content\s*\{[\s\S]*overflow:\s*auto/);
  assert.match(css, /body\s*\{[\s\S]*user-select:\s*none/);
  assert.match(css, /input,\s*textarea,\s*\[contenteditable\]:not\(\[contenteditable="false"\]\),\s*\.patch-notes-content\s*\{[\s\S]*user-select:\s*text/);
  assert.match(css, /\.shortcuts-sections\s*\{[\s\S]*grid-template-columns:\s*repeat\(5,/);
  assert.match(css, /@media \(max-width:\s*1000px\)[\s\S]*\.shortcuts-sections\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,/);
  assert.match(css, /\.shortcut-row kbd,[\s\S]*font:\s*700 11px/);
});

test("undo and redo preserve the active mirror editing toggle", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(
    source,
    /function undoLastAction\(\)[\s\S]*?restoreState\(state, \{[\s\S]*?preserveMirrorMode: true,[\s\S]*?preserveIsolation: true,[\s\S]*?preserveLiveSurfaces: true[\s\S]*?\}\)/
  );
  assert.match(
    source,
    /function redoLastAction\(\)[\s\S]*?restoreState\(state, \{[\s\S]*?preserveMirrorMode: true,[\s\S]*?preserveIsolation: true,[\s\S]*?preserveLiveSurfaces: true[\s\S]*?\}\)/
  );
  assert.match(
    source,
    /function restoreSharedStateForStateRestore\(state, restorePlan, \{ preserveMirrorMode = false \}[\s\S]*?setMirrorXEditing\(preserveMirrorMode \? mirrorXEditing : Boolean\(state\.mirrorXEditing\)\)/
  );
  assert.match(
    source,
    /function undoLastAction\(\)[\s\S]*try \{[\s\S]*restoreState\(state, \{[\s\S]*preserveLiveSurfaces: true[\s\S]*\}\)[\s\S]*finally \{[\s\S]*restoringHistory = false[\s\S]*updateHistoryButtons\(\)/
  );
  assert.match(
    source,
    /function redoLastAction\(\)[\s\S]*try \{[\s\S]*restoreState\(state, \{[\s\S]*preserveLiveSurfaces: true[\s\S]*\}\)[\s\S]*finally \{[\s\S]*restoringHistory = false[\s\S]*updateHistoryButtons\(\)/
  );
  assert.match(
    source,
    /function finalizeStateRestore\(state\) \{[\s\S]*restoreRefreshes\.run\(\{ state \}\)[\s\S]*function restoreState\(state,[\s\S]*restoringHistory = true;\s*try \{[\s\S]*finalizeStateRestore\(state\);[\s\S]*\} finally \{\s*restoringHistory = false/
  );
  assert.match(
    source,
    /function resetTransientInteractionsForStateRestore\(\) \{[\s\S]*proceduralDuplicatePreview = null[\s\S]*proceduralDuplicateDialog\.close\(\)[\s\S]*transformControls\.detach\(\)[\s\S]*duplicatePlacement = null[\s\S]*hideProceduralDuplicateArcPreview\(\)[\s\S]*hideStrandRadialMenu\(\)[\s\S]*hideToolRadialMenu\(\)[\s\S]*placeEdit = null[\s\S]*transformDragging = false[\s\S]*updateInteractionLocks\(\)[\s\S]*function restoreState\(state,[\s\S]*try \{\s*resetTransientInteractionsForStateRestore\(\);\s*resetEditableSceneForStateRestore\(preservedLocks\);\s*restoreSharedStateForStateRestore\(state, restorePlan, \{ preserveMirrorMode \}\);\s*authoredScalpRestorePromise = restoreAuthoredScalpForStateRestore\(state, \{\s*preservePlacement,\s*preserveScalpGeometry\s*\}\);\s*restoreSceneCollectionsForStateRestore\(restorePlan, \{[\s\S]*preservedLocks[\s\S]*\}\);\s*validateSelectionAfterStateRestore\(\);[\s\S]*reapplySelectionAfterStateRestore\(restorePlan\);[\s\S]*finalizeStateRestore\(state\)[\s\S]*return authoredScalpRestorePromise/
  );
  assert.match(
    source,
    /function undoLastAction\(\)[\s\S]*const currentState = snapshotState\(\)[\s\S]*redoHistory\.push\(currentState\)[\s\S]*currentHistoryState: currentState[\s\S]*function redoLastAction\(\)[\s\S]*const currentState = snapshotState\(\)[\s\S]*undoHistory\.push\(currentState\)[\s\S]*currentHistoryState: currentState/
  );
  assert.match(
    source,
    /function historyStatesShareAuthoredScalp\(currentState, restoredState\)[\s\S]*scalpHistoryStateSignature\(currentState\) === scalpHistoryStateSignature\(restoredState\)[\s\S]*const preserveScalpGeometry = historyStatesShareAuthoredScalp\(currentHistoryState, state\)[\s\S]*authoredScalpRestorePromise = restoreAuthoredScalpForStateRestore\(state, \{\s*preservePlacement,\s*preserveScalpGeometry\s*\}\)/
  );
  assert.match(
    source,
    /expandHistoryDependencyIds[\s\S]*function historyLocksToRebuild\(currentState, restoredState\)[\s\S]*currentSnapshots\.length !== restoredSnapshots\.length[\s\S]*return expandHistoryDependencyIds\([\s\S]*function preservedHistoryRuntimeLocks\(currentState, restoredState\)[\s\S]*!rebuildIds\.has\(lock\.id\)/
  );
  assert.match(
    source,
    /function resetEditableSceneForStateRestore\(preservedLocks = new Map\(\)\)[\s\S]*!preservedLocks\.has\(lock\.id\)[\s\S]*function restoreSceneCollectionsForStateRestore[\s\S]*const preservedLock = preservedLocks\.get\(snapshot\.id\)[\s\S]*if \(preservedLock\) locks\.push\(preservedLock\)/
  );
  assert.match(
    source,
    /const historyRootAttachmentCache = new WeakMap\(\)[\s\S]*function historyRootAttachmentSnapshot\(lock\)[\s\S]*cached\?\.revision === revision[\s\S]*rootAttachmentToData\(syncRootAttachmentMetadata\(lock\)\)/
  );
  assert.match(source, /rootAttachment: historyRootAttachmentSnapshot\(lock\)/);
  assert.match(
    source,
    /renderer\.shadowMap\.enabled = true[\s\S]*renderer\.shadowMap\.autoUpdate = true[\s\S]*function animate[\s\S]*renderer\.render/
  );
  assert.match(
    source,
    /let historyShortcutHeld = false[\s\S]*event\.key\.toLowerCase\(\) === "z"[\s\S]*event\.repeat \|\| historyShortcutHeld[\s\S]*historyShortcutHeld = true[\s\S]*undoLastAction\(\)[\s\S]*event\.key\.toLowerCase\(\) === "y"[\s\S]*event\.repeat \|\| historyShortcutHeld[\s\S]*historyShortcutHeld = true[\s\S]*redoLastAction\(\)/
  );
  assert.match(
    source,
    /window\.addEventListener\("keyup", \(event\) => \{[\s\S]*\["z", "y", "control", "meta"\]\.includes\(event\.key\.toLowerCase\(\)\)[\s\S]*historyShortcutHeld = false/
  );
});

test("holding Spacebar drives a release-to-confirm strand radial menu", async () => {
  const [html, source, css, radialLayout] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/radial-layout.js", import.meta.url), "utf8")
  ]);

  assert.match(
    html,
    /id=["']strandRadialMenu["'][\s\S]*data-strand-radial-action=["']mirror-selected-strands["'][\s\S]*data-strand-radial-action=["']duplicate["'][\s\S]*data-strand-radial-action=["']delete["']/
  );
  assert.match(html, /<kbd>Hold Spacebar<\/kbd>[\s\S]*Choose from the contextual radial menu/);
  assert.match(css, /\.strand-radial-menu\s*\{[\s\S]*border-radius:\s*50%/);
  assert.match(css, /\.strand-radial-line\s*\{[\s\S]*transform-origin:\s*left center/);
  assert.match(css, /translateX\(var\(--radial-button-radius, calc\(var\(--radial-radius\) \+ var\(--radial-radius-offset, 0px\)\)\)\)/);
  assert.match(css, /\.strand-radial-menu button\.selected/);
  assert.match(css, /> button:not\(\.radial-back\)::before[\s\S]*width:\s*var\(--radial-sector-size, var\(--radial-size\)\)[\s\S]*conic-gradient\([\s\S]*--radial-sector-start[\s\S]*--radial-sector-span[\s\S]*mask:\s*radial-gradient/);
  assert.match(css, /> button:not\(\.radial-back\):not\(\.radial-submenu-option\)::before[\s\S]*--radial-sector-divider-start[\s\S]*rgb\(255 255 255 \/ 20%\) 0 0\.45deg[\s\S]*transparent 0\.45deg 1turn/);
  assert.match(css, /> button\.radial-submenu-option::after[\s\S]*--radial-sector-divider-start[\s\S]*transparent 0\.45deg calc\(var\(--radial-sector-span\) - 0\.45deg\)[\s\S]*rgb\(255 255 255 \/ 20%\) calc\(var\(--radial-sector-span\) - 0\.45deg\) var\(--radial-sector-span\)[\s\S]*mask:\s*radial-gradient/);
  assert.match(css, /> button:not\(\.radial-back\)\.selected::before[\s\S]*radial-gradient\([\s\S]*rgb\(88 246 255 \/ 2%\)[\s\S]*rgb\(88 246 255 \/ 34%\)[\s\S]*conic-gradient\([\s\S]*mask-composite:\s*intersect[\s\S]*rgb\(88 246 255 \/ 16%\)/);
  assert.match(source, /function applyRadialSectorVariables\(button, option, options, menu, geometry = null\)[\s\S]*radialOptionSector\([\s\S]*\{ gap: 0 \}[\s\S]*labelRadius[\s\S]*--radial-button-radius[\s\S]*--radial-sector-size[\s\S]*--radial-sector-start[\s\S]*--radial-sector-divider-start[\s\S]*--radial-sector-center-x/);
  assert.match(source, /const labelRadius = geometry\?\.labelRadius[\s\S]*Math\.min\(optionRadius, size \* 0\.5 - 82\)/);
  assert.match(css, /\.strand-radial-menu button\.has-submenu::after[\s\S]*content:\s*"›"[\s\S]*--submenu-arrow-x[\s\S]*--submenu-arrow-y[\s\S]*--submenu-arrow-angle/);
  assert.match(css, /\.strand-radial-menu button\.has-submenu,[\s\S]*button\.has-submenu\.selected[\s\S]*border-color:\s*transparent[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none/);
  assert.match(css, /button\.has-submenu:disabled[\s\S]*border-color:\s*transparent[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none/);
  assert.match(css, /\.strand-radial-menu button\.radial-back,[\s\S]*width:\s*54px[\s\S]*height:\s*54px[\s\S]*border:\s*1px solid rgb\(240 193 90 \/ 50%\)[\s\S]*border-radius:\s*50%[\s\S]*background:\s*rgb\(22 20 26 \/ 96%\)/);
  assert.match(css, /--radial-size:\s*220px[\s\S]*width:\s*var\(--radial-size\)/);
  assert.match(radialLayout, /function radialMenuAngles\(optionCount\)[\s\S]*count === 1[\s\S]*count === 2[\s\S]*count === 3[\s\S]*count === 4[\s\S]*Math\.PI \* 2 \/ count/);
  assert.match(source, /function ensureRadialButtonCapacity\([\s\S]*while \(buttons\.length < count\)[\s\S]*menu\.insertBefore\(button, insertBefore\)/);
  assert.match(source, /--radial-radius-offset[\s\S]*option\.radiusOffset \|\| 0/);
  assert.match(source, /function configureRadialSubmenuIndicator\(button, option, kind\)[\s\S]*option\?\.submenu[\s\S]*radialButtonRayExtent\(option\.angle[\s\S]*aria-haspopup[\s\S]*--submenu-arrow-angle/);
  assert.match(source, /const arrowDistance = Math\.min\(buttonRayExtent \+ 10, 58\)[\s\S]*label\.className = "radial-submenu-label"[\s\S]*--submenu-label-x[\s\S]*--submenu-label-y/);
  assert.match(css, /button\.has-submenu > \.radial-submenu-label[\s\S]*transform:\s*translate\([\s\S]*--submenu-label-x[\s\S]*--submenu-label-y/);
  assert.match(source, /function radialButtonDimensions\(kind, option = null\)[\s\S]*option\?\.action === "back-to-main"[\s\S]*width: 54, height: 54/);
  assert.match(source, /button\.classList\.toggle\("radial-back", option\?\.action === "back-to-main"\)/);
  assert.match(source, /function layoutContextualRadialOptions\(kind,[\s\S]*backAngle = Math\.PI \* 0\.5[\s\S]*anchorAction: "back-to-main"[\s\S]*anchorAngle: backAngle[\s\S]*backOption\.radiusOffset = backRadiusOffset/);
  assert.match(source, /partitionRadialOptions\(toolRadialOptions\(\), MAX_RADIAL_OPTIONS\)[\s\S]*layoutRadialOptions\(partitioned\.radialOptions\)[\s\S]*applyRadialMenuDimensions\(toolRadialMenu, options\.length, sharedRadialFrameDimensions\(\)\)/);
  assert.match(source, /function radialMenuDimensionsForKind\(kind, optionCount\)[\s\S]*\["selection", "clump"\]\.includes\(kind\) \? 8 : 18/);
  assert.match(source, /const MAX_RADIAL_OPTIONS = 8[\s\S]*const MAX_RADIAL_SUBMENU_OPTIONS = 5[\s\S]*const RADIAL_SUBMENU_SLOT_COUNT = 12[\s\S]*const STANDARD_RADIAL_FRAME_DIMENSIONS = radialMenuDimensions\(MAX_RADIAL_OPTIONS,[\s\S]*buttonWidth: 138[\s\S]*buttonHeight: 42[\s\S]*gap: 8/);
  assert.match(source, /function sharedRadialFrameDimensions\(\) \{[\s\S]*return \{ \.\.\.STANDARD_RADIAL_FRAME_DIMENSIONS \}/);
  assert.match(source, /function layoutContextualRadialOptions\(kind,[\s\S]*partitionRadialOptions\([\s\S]*options,[\s\S]*MAX_RADIAL_OPTIONS,[\s\S]*MAX_RADIAL_SUBMENU_OPTIONS[\s\S]*layoutRadialOptions\(partitioned\.radialOptions[\s\S]*listOptions: partitioned\.listOptions/);
  assert.match(html, /id="strandRadialActionList" class="radial-action-list hidden"[\s\S]*id="toolRadialActionList" class="radial-action-list hidden"/);
  assert.match(css, /\.strand-radial-menu \.radial-action-list\s*\{[\s\S]*top:\s*calc\(100% \+ var\(--radial-action-list-offset, 8px\)\)[\s\S]*width:\s*190px/);
  assert.match(source, /function radialListOptionAtPointer\(container, options, event\)[\s\S]*containerBounds = container\.getBoundingClientRect\(\)[\s\S]*buttons = \[\.\.\.container\.querySelectorAll[\s\S]*function updateStrandRadialGesture\(event\)[\s\S]*activeListOptions = gesture\.submenu\?\.listOptions \|\| gesture\.listOptions[\s\S]*radialListOptionAtPointer\(strandRadialActionList, activeListOptions, event\)/);
  assert.match(source, /function applyRadialMenuDimensions\(menu, optionCount, fixedDimensions = null\)[\s\S]*fixedDimensions\?\.size \|\| dimensions\.size[\s\S]*fixedDimensions\?\.radius \|\| dimensions\.radius/);
  assert.match(
    source,
    /function beginStrandRadialGesture\(\) \{[\s\S]*centerX: lastPointer\.x[\s\S]*centerY: lastPointer\.y[\s\S]*frameDimensions: sharedRadialFrameDimensions\(\)[\s\S]*strandRadialMenu\.classList\.remove\("hidden"\)/
  );
  assert.match(
    source,
    /function updateStrandRadialGesture\(event\) \{[\s\S]*distance <= 34[\s\S]*gesture\.action[\s\S]*strandRadialLine\.style\.transform/
  );
  assert.match(source, /event\.code === "Space"[\s\S]*beginStrandRadialGesture\(\)/);
  assert.match(source, /window\.addEventListener\("keyup"[\s\S]*event\.code === "Space"[\s\S]*finishStrandRadialGesture\(\)/);
  assert.match(source, /renderer\.domElement\.addEventListener\("contextmenu", blockMeshEditModeBrowserContextMenu\)/);
  assert.match(
    source,
    /function performStrandRadialAction\(action, lockId\) \{[\s\S]*action === "mirror-selected-strands"[\s\S]*mirrorSelectionTargets\(selectedLocksInOrder\(\), mirrorPartnerFor\)[\s\S]*createMirrorPartner\(lock, \{ deferUi: true \}\)[\s\S]*action === "decouple-selected-mirrors"[\s\S]*decouple\.forEach\(decoupleMirrorPartner\)[\s\S]*if \(action === "duplicate"\)[\s\S]*beginDuplicatePlacement\(lock\)[\s\S]*if \(action === "delete"\)[\s\S]*deleteLocks\(\[lock\]\)/
  );
  assert.match(
    source,
    /function selectedMirrorRadialOptions\(\)[\s\S]*selectedLocks\.length === 1 \? "Mirror Strand" : "Mirror Strands"[\s\S]*decouple\.length === 1[\s\S]*Decouple Mirror Instance[\s\S]*Decouple \$\{decouple\.length\} Mirror Instances/
  );
  assert.match(source, /action: "decouple-selected-mirrors",\s*label: decouple\.length === 1[\s\S]*`Decouple \$\{decouple\.length\} Mirror Instances`,\s*list: true\s*\}/);
  assert.match(source, /action: "decouple-mirrored-clump"[\s\S]*list: true/);
  assert.match(source, /kind === "selection"[\s\S]*\.\.\.selectedMirrorRadialOptions\(\)[\s\S]*return \[[\s\S]*\.\.\.selectedMirrorRadialOptions\(\)[\s\S]*Duplicate strand/);
  assert.match(
    source,
    /function contextualRadialOptions\(kind\) \{[\s\S]*kind === "root"[\s\S]*open-workspace-submenu[\s\S]*open-live-surface-submenu[\s\S]*open-edit-mode-submenu[\s\S]*kind === "workspace-submenu"[\s\S]*workspace-strand[\s\S]*workspace-guide[\s\S]*workspace-reference[\s\S]*kind === "live-surface-submenu"[\s\S]*activeStrokeSurfaceInput\(\)\.options[\s\S]*toggle-dynamic-surface[\s\S]*kind === "edit-mode-submenu"[\s\S]*edit-mode-component[\s\S]*edit-mode-object/
  );
  assert.match(source, /option\.dataset\.userCreatedLiveSurface = "true"/);
  assert.match(source, /list: option\.dataset\.userCreatedLiveSurface === "true"[\s\S]*action: "toggle-dynamic-surface"[\s\S]*label: drawSurfaceDynamicEnabled\(\) \? "Disable Dynamic" : "Enable Dynamic"/);
  assert.match(
    source,
    /function beginStrandRadialGesture\(\) \{[\s\S]*const guide = getSelectedGuide\(\)[\s\S]*const reference = selectedReferenceImage\(\)[\s\S]*const selectedClumpGuide = clumpViewportSelection \? clumpGuideForLock\(lock\) : null[\s\S]*selectedClumpGuide[\s\S]*\? "clump"[\s\S]*selectedLocksInOrder\(\)\.length > 1 \? "selection"[\s\S]*lock \? "strand"[\s\S]*guide \? "guide"[\s\S]*reference \? "reference"[\s\S]*"root"[\s\S]*configureContextualRadialMenu\(kind, options, listOptions\)/
  );
  assert.match(source, /function openStrandRadialSubmenu\(option\)[\s\S]*filter\(\(\{ action \}\) => action !== "back-to-main"\)[\s\S]*layoutRadialSubmenuSlots\([\s\S]*option\.angle[\s\S]*slotCount: RADIAL_SUBMENU_SLOT_COUNT[\s\S]*const outerRadius = parentOuterRadius \+ 82[\s\S]*const labelRadius = parentOuterRadius \+ 43[\s\S]*--radial-action-list-offset[\s\S]*outerRadius - parentOuterRadius \+ 8[\s\S]*radial-submenu-option[\s\S]*sectorAngles: slotAngles[\s\S]*sectorIndex: submenuOption\.radialSlotIndex[\s\S]*options: hitOptions/);
  assert.match(css, /button\[data-strand-radial-action="duplicate-procedural"\][\s\S]*width:\s*72px[\s\S]*white-space:\s*pre-line/);
  assert.match(source, /action: "duplicate-procedural", label: "Duplicate\\nProcedural"/);
  assert.match(source, /function closeStrandRadialSubmenu[\s\S]*removeProperty\("--radial-action-list-offset"\)[\s\S]*renderRadialActionList/);
  assert.match(source, /function updateStrandRadialGesture\(event\)[\s\S]*closestCandidate[\s\S]*optionsAtPointer\.reduce[\s\S]*closestCandidate\?\.enabled === false \? null : closestCandidate/);
  assert.doesNotMatch(source, /strandRadialSubmenuEntryDistance|radialButtonEntryDistance/);
  assert.match(source, /function updateStrandRadialGesture\(event\)[\s\S]*gesture\.submenu && distance <= 34[\s\S]*closeStrandRadialSubmenu\(\)[\s\S]*distance <= gesture\.submenu\.parentOuterRadius[\s\S]*closestOption\?\.submenu[\s\S]*openStrandRadialSubmenu\(closestOption\)/);
  assert.match(source, /action === "toggle-dynamic-surface"[\s\S]*setDrawSurfaceDynamicEnabled\(!drawSurfaceDynamicEnabled\(\)\)[\s\S]*action\?\.startsWith\("select-live-surface:"\)[\s\S]*setActiveStrokeSurfaceValue[\s\S]*action\?\.startsWith\("workspace-"\)[\s\S]*setViewportEditMode[\s\S]*action\?\.startsWith\("edit-mode-"\)[\s\S]*setViewportSelectionMode/);
  assert.match(
    source,
    /function setActiveStrokeSurfaceValue\(value\) \{[\s\S]*activeStrokeSurfaceInput\(\)[\s\S]*input\.value = value[\s\S]*dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/
  );
});

test("newly drawn strands create linked mirror instances while X mirror is enabled", async () => {
  const [html, source] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /app\.js\?v=\d{8}-\d+/);
  assert.match(html, /id="mirrorInstanceAction"[^>]*>Mirror Strand<\/button>/);
  assert.match(
    source,
    /function showOutlinerContextMenu\(event, target\)[\s\S]*mirrorInstanceAction\.classList\.toggle\("hidden", !strand && !isClump\)[\s\S]*Decouple Mirrored Clump[\s\S]*Mirror Clump[\s\S]*Decouple Mirrored Instance Strand[\s\S]*Mirror Strand/
  );
  assert.match(
    source,
    /mirrorInstanceAction\.addEventListener\("click"[\s\S]*pushUndoState\(\)[\s\S]*mirroredClumpPartners\(guide\)[\s\S]*decoupleMirroredClump\(guide\)[\s\S]*createMirroredClump\(guide\)[\s\S]*mirrorPartnerFor\(lock\)[\s\S]*decoupleMirrorPartner\(lock\)[\s\S]*createMirrorPartner\(lock\)/
  );
  assert.match(
    source,
    /function createMirrorPartnerForNewLock\(lock\) \{[\s\S]*!mirrorXEditing[\s\S]*createMirrorPartner\(lock, \{ deferUi: true \}\)/
  );
  assert.match(
    source,
    /const faceExtrusionPreview = Boolean\(drawStrandStroke\.hairShellLockId\)[\s\S]*const showMirrorPreview = !faceExtrusionPreview[\s\S]*mirrorPartnerFor\(extensionLock\)[\s\S]*!extensionLock && mirrorXEditing[\s\S]*drawStrandMirrorPreview\.visible = showMirrorPreview/
  );
  assert.match(
    source,
    /function createDrawnBraid\(stroke\) \{[\s\S]*createMirrorPartnerForNewLock\(lock\)[\s\S]*function createDrawnStrand/
  );
  assert.match(
    source,
    /function createDrawnStrand\(stroke\) \{[\s\S]*created\.map\(createMirrorPartnerForNewLock\)/
  );
  assert.match(
    source,
    /function finalizeDrawnLockSelection\(lock\) \{[\s\S]*selectLock\(lock\.id, \{ individualClumpMember: true \}\)[\s\S]*interactiveHelpersDeferred[\s\S]*rebuildCurveObjects\(lock\)[\s\S]*function createDrawnBraid[\s\S]*return finalizeDrawnLockSelection\(lock\)[\s\S]*function createDrawnStrand[\s\S]*return finalizeDrawnLockSelection\(created\[0\]\)[\s\S]*function createDrawnPanel[\s\S]*return finalizeDrawnLockSelection\(lock\)/
  );
  const finalizer = source.match(/function finalizeDrawnLockSelection\(lock\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(finalizer, /updateCurveObjects/);
  assert.match(
    source,
    /function createDrawnPanel\(stroke\) \{[\s\S]*createMirrorPartnerForNewLock\(lock\)/
  );
  assert.match(
    source,
    /X axis mirror is active\. New strands create linked mirror instances[\s\S]*Enable X axis mirror\. New strands will create linked mirror instances/
  );
});

test("camera view cube exposes six undo-free cardinal camera snaps", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="cameraViewCube"[\s\S]*data-camera-view="front"[\s\S]*data-camera-view="back"[\s\S]*data-camera-view="left"[\s\S]*data-camera-view="right"[\s\S]*data-camera-view="top"[\s\S]*data-camera-view="bottom"/);
  assert.match(source, /const CAMERA_VIEW_AXES = Object\.freeze\(\{[\s\S]*front: new THREE\.Vector3\(0, 0, 1\)[\s\S]*bottom: new THREE\.Vector3\(0, -1, 0\)/);
  assert.match(source, /function snapCameraToCardinalAxis\(axis, distance\) \{[\s\S]*camera\.up\.set\(0, 1, 0\)[\s\S]*const poleOffset = 0\.0001[\s\S]*addScaledVector\(horizontalAxis, poleOffset\)[\s\S]*addScaledVector\(positionAxis, distance\)/);
  assert.doesNotMatch(source, /camera\.up\.set\(0, 0, axis\.y/);
  assert.match(source, /cameraViewCubeFaces\.forEach[\s\S]*snapCameraToCardinalAxis\(axis, distance\)[\s\S]*focusViewportForHotkeys\(\)/);
  assert.match(css, /\.camera-view-cube \{[\s\S]*top: calc\(var\(--viewport-title-inset, 0px\) \+ 86px\);[\s\S]*right: 18px;[\s\S]*perspective: 220px/);
  assert.match(css, /\.camera-view-cube-front[\s\S]*translateZ\(23px\)[\s\S]*\.camera-view-cube-bottom[\s\S]*rotateX\(-90deg\)/);
});

test("linked X-mirror instances reverse asymmetric width-curve sides", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(source, /function createMirrorPartner\(lock, options = \{\}\)[\s\S]*mirroredAsymmetricTaperCurves\([\s\S]*taperCurve: mirroredWidthCurves\.primary[\s\S]*taperCurveSecondary: mirroredWidthCurves\.secondary/);
  assert.match(source, /function syncMirrorPartnerFromLock[\s\S]*const mirroredWidthCurves = mirroredAsymmetricTaperCurves\([\s\S]*partner\.taperCurve = mirroredWidthCurves\.primary[\s\S]*partner\.taperCurveSecondary = mirroredWidthCurves\.secondary/);
  assert.match(source, /partner\.depthCurve = lock\.depthCurve\.map[\s\S]*partner\.depthCurveSecondary = lock\.depthCurveSecondary\.map/);
  assert.match(source, /function normalizeLegacyMirroredAsymmetricWidthCurves[\s\S]*storedInSameOrientation[\s\S]*alreadyReversed[\s\S]*partner\.taperCurve = mirroredWidthCurves\.primary/);
  assert.match(source, /restorePlan\.scene\.locks\.forEach[\s\S]*normalizeLegacyMirroredAsymmetricWidthCurves\(\)/);
});

test("project materials select standard, anime anisotropic, and Lambert shaders", async () => {
  const [html, source, config, shaderModule, materialState, localization, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/app-config.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/anime-hair-shaders.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/material-state.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(
    html,
    /id=["']hairMaterialShader["'][\s\S]*value=["']standard-anisotropic["']>Standard Anisotropic<[\s\S]*value=["']anime-anisotropic["']>Anime Anisotropic<[\s\S]*value=["']lambert["']>Lambert</
  );
  assert.match(html, /app\.js\?v=\d{8}-\d+/);
  assert.match(
    html,
    /id=["']hairMaterialAnimeControls["'][\s\S]*id=["']hairMaterialAnimeBaseColor["'][\s\S]*value=["']#dbc2aa["'][\s\S]*id=["']hairMaterialAnimeShadowColor["'][\s\S]*value=["']#99675c["'][\s\S]*id=["']hairMaterialAnimeRimColor["'][\s\S]*value=["']#ffd9cf["'][\s\S]*id=["']hairMaterialAnimeRimStrength["'][\s\S]*value=["']0\.35["'][\s\S]*id=["']hairMaterialAnimeRimWidth["'][\s\S]*value=["']0\.3["'][\s\S]*id=["']hairMaterialAnimeHighlightEdgeSuppression["']/
  );
  assert.match(html, /id=["']hairMaterialGradientEnabled["'][\s\S]*id=["']editHairMaterialGradient["'][\s\S]*id=["']hairMaterialGradientDialog["'][\s\S]*id=["']hairMaterialGradientTrack["'][\s\S]*id=["']addHairMaterialGradientStop["']/);
  assert.match(html, /id=["']hairMaterialPreset["'][\s\S]*id=["']saveHairMaterialPreset["'][\s\S]*id=["']removeHairMaterialPreset["']/);
  assert.doesNotMatch(html, /id=["']shareHairMaterialPreset["']/);
  assert.match(config, /DEFAULT_HAIR_MATERIAL_SETTINGS[\s\S]*shader:\s*"standard-anisotropic"/);
  assert.match(config, /DEFAULT_MESH_MATERIAL_ID = "default-mesh-grey"[\s\S]*DEFAULT_MESH_MATERIAL_SETTINGS = \{[\s\S]*color: "#777982"[\s\S]*roughness: 1[\s\S]*shader: "lambert"/);
  assert.match(materialState, /function normalizeHairMaterialDefinition\(material = \{\}\) \{[\s\S]*material\.shader = normalizeHairShader\(material\.shader\)/);
  assert.match(source, /function builtInMaterialDefinitions\(\)[\s\S]*id: DEFAULT_HAIR_MATERIAL_ID[\s\S]*id: DEFAULT_MESH_MATERIAL_ID,[\s\S]*name: "Default Mesh Grey"[\s\S]*const projectMaterialDefinitions = ensureRequiredMaterialDefinitions/);
  assert.match(source, /function projectMaterialDefinition\(materialId\) \{[\s\S]*resolveHairMaterialDefinition\(projectMaterialDefinitions, materialId\)/);
  assert.match(source, /function defaultMaterialIdForLockData\(lock\) \{[\s\S]*defaultMaterialIdForGeometry\(lock\?\.geometryType,[\s\S]*hairMaterialId: DEFAULT_HAIR_MATERIAL_ID[\s\S]*meshMaterialId: DEFAULT_MESH_MATERIAL_ID[\s\S]*function materialForLock\(lock\)[\s\S]*defaultMaterialIdForLockData\(lock\)/);
  assert.match(source, /function restoreSharedStateForStateRestore[\s\S]*ensureRequiredMaterialDefinitions\([\s\S]*restorePlan\.resources\.hairMaterials,[\s\S]*builtInMaterialDefinitions\(\)[\s\S]*projectMaterialDefinitions\.splice/);
  assert.match(source, /function renderHairMaterialOutliner\(\) \{[\s\S]*hairMaterialUsageCounts\(locks, projectMaterialDefinitions, DEFAULT_HAIR_MATERIAL_ID\)/);
  assert.match(
    source,
    /function createHairMaterial\(lock\) \{[\s\S]*definition\.shader === ANIME_ANISOTROPIC_SHADER[\s\S]*createAnimeAnisotropicMaterial\(lock\)[\s\S]*definition\.shader === LAMBERT_SHADER[\s\S]*new THREE\.MeshLambertMaterial[\s\S]*new THREE\.MeshPhysicalMaterial/
  );
  assert.match(
    source,
    /function applyMaterialDefinitionToLock\(lock\) \{[\s\S]*lock\.mesh\.material\.userData\.hairShader !== definition\.shader[\s\S]*previousMaterial\.dispose\(\)/
  );
  assert.match(
    source,
    /hairShader === STANDARD_ANISOTROPIC_SHADER[\s\S]*roughness = definition\.roughness;[\s\S]*else if \(lock\.mesh\.material\.userData\.hairShader === ANIME_ANISOTROPIC_SHADER\)[\s\S]*uniforms\[uniformName\]/
  );
  assert.match(
    source,
    /hairMaterialShaderInput\.addEventListener\("change"[\s\S]*material\.shader = normalizeHairShader[\s\S]*refreshMaterialUsers\(material\.id\)/
  );
  assert.match(source, /hairMaterials:\s*projectMaterialDefinitions\.map\(\(material\) => \(\{[\s\S]*baseColorGradientStops:[\s\S]*\.map\(\(stop\) => \(\{ \.\.\.stop \}\)\)/);
  assert.match(shaderModule, /uRimColor[\s\S]*uShadowThreshold[\s\S]*uSoftShadowStrength[\s\S]*uRimStrength[\s\S]*uRimWidth[\s\S]*uAnisotropy[\s\S]*uHighlightJaggedness/);
  assert.match(shaderModule, /uBaseGradient[\s\S]*uUseBaseGradient[\s\S]*texture2D\(uBaseGradient, vec2\(0\.5, clamp\(vUv\.y, 0\.0, 1\.0\)\)\)[\s\S]*multipliedShadowColor = authoredBaseColor \* uShadowColor[\s\S]*mix\(multipliedShadowColor, authoredBaseColor, lightBand\)/);
  assert.match(shaderModule, /float shadowMask = 1\.0 - lightBand[\s\S]*float shadowRim =[\s\S]*shadowMask \*[\s\S]*uRimStrength/);
  assert.match(shaderModule, /rimLightenColor = max\(color, uRimColor\)[\s\S]*mix\(color, rimLightenColor, shadowRim\)[\s\S]*highlightLightenColor = max\(color, uHighlightColor\)[\s\S]*mix\(color, highlightLightenColor, litHighlight\)/);
  assert.doesNotMatch(shaderModule, /uSelectionColor|uSelectionStrength/);
  assert.doesNotMatch(source, /uSelectionColor|uSelectionStrength/);
  assert.match(source, /const STRAND_SELECTION_OUTLINE_COLOR = 0xffd45e;[\s\S]*uOutlineWidth: \{ value: 0\.007 \}/);
  assert.match(source, /function meshWorkspaceWireSelection\(lock\)[\s\S]*viewportEditMode === "mesh"[\s\S]*selectedStrandIds\.has\(lock\.id\)/);
  assert.match(source, /function setViewportEditMode\(mode, options = \{\}\)[\s\S]*viewportEditMode = nextMode[\s\S]*updateStrandSelectionHighlight\(\)/);
  assert.match(source, /function strandViewportBaseColor\(lock\)[\s\S]*proportionalStrandVisualsActive\(lock\)[\s\S]*showSelectionHighlight = viewportEditMode !== "mesh"[\s\S]*0x76d4d9[\s\S]*0x5bbec4[\s\S]*STRAND_SELECTION_OUTLINE_COLOR\), 0\.12[\s\S]*STRAND_SELECTION_OUTLINE_COLOR\), 0\.08[\s\S]*strandMirrorPartnerHighlighted\(lock\)[\s\S]*STRAND_MIRROR_OUTLINE_COLOR\), 0\.12[\s\S]*strandDisplayColor\(lock\)/);
  assert.match(source, /function createStrandSelectionOutline\(geometry\)[\s\S]*position \+ normal \* uOutlineWidth[\s\S]*side: THREE\.BackSide[\s\S]*depthWrite: false[\s\S]*outline\.raycast = \(\) => \{\}/);
  assert.equal((source.match(/lock\.selectionOutline = createStrandSelectionOutline\(lock\.mesh\.geometry\)/g) || []).length, 2);
  assert.match(source, /function strandMirrorPartnerHighlighted\(lock\)[\s\S]*selectedStrandIds\.has\(lock\.id\)[\s\S]*mirrorPartnerFor\(lock\)[\s\S]*selectedStrandIds\.has\(partner\.id\)/);
  assert.match(source, /function syncStrandSelectionOutline\(lock\)[\s\S]*outline\.visible = Boolean\([\s\S]*!lock\.proceduralParentHidden[\s\S]*viewportEditMode !== "mesh"[\s\S]*selected \|\| mirrorPartnerHighlighted[\s\S]*STRAND_MIRROR_OUTLINE_COLOR : STRAND_SELECTION_OUTLINE_COLOR/);
  assert.match(source, /function setStrandSelectionVisual\(lock\)[\s\S]*setAnimeHairBaseColor\(material, strandViewportBaseColor\(lock\)\)[\s\S]*material\.emissive\?\.set\(0x000000\)[\s\S]*syncStrandSelectionOutline\(lock\)/);
  assert.match(source, /function rebuildLockGeometry\(lock, options = \{\}\)[\s\S]*lock\.selectionOutline\.geometry = lock\.mesh\.geometry/);
  assert.doesNotMatch(source, /material\.color\.getLuminance\(\)[\s\S]*contrastTint/);
  assert.match(source, /function updateStrandSelectionHighlightForLock\(item\) \{[\s\S]*setStrandSelectionVisual\(item\)/);
  assert.match(source, /function updateStrandSelectionHighlight\(\) \{[\s\S]*locks\.forEach\(updateStrandSelectionHighlightForLock\)/);
  assert.match(source, /function applyMaterialDefinitionToLock\(lock\)[\s\S]*updateStrandSelectionHighlightForLock\(lock\)/);
  assert.doesNotMatch(source, /activeAttributeTab === "materials"/);
  assert.match(shaderModule, /dFdx\(vWorldPosition\)[\s\S]*uvTangent[\s\S]*litHighlight/);
  assert.match(localization, /"Anime Anisotropic":\s*"アニメ異方性"/);
  assert.match(localization, /"Lambert":\s*"ランバート"/);
  assert.match(css, /#hairMaterialStandardControls\.hidden,[\s\S]*#hairMaterialAnimeControls\.hidden,[\s\S]*#hairMaterialRoughnessControl\.hidden\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /#hairMaterialAnimeControls \.topology-control\.editable-slider-control\s*\{[\s\S]*grid-template-columns:\s*130px minmax\(0, 1fr\)/);
  assert.match(css, /#hairMaterialAnimeControls \.slider-input-row\s*\{[\s\S]*grid-template-columns:\s*72px minmax\(0, 1fr\) 24px[\s\S]*width:\s*100%/);
  assert.match(source, /hairMaterialRoughnessControl\.classList\.toggle\("hidden", definition\.shader !== STANDARD_ANISOTROPIC_SHADER\)/);
  assert.match(materialState, /Object\.assign\(material, normalizeAnimeAnisotropicSettings\(material\)\)/);
  assert.match(materialState, /MAX_HAIR_GRADIENT_STOPS = 8[\s\S]*function normalizeHairGradientStops[\s\S]*material\.baseColorGradientEnabled = Boolean[\s\S]*material\.baseColorGradientStops = normalizeHairGradientStops/);
  assert.match(materialState, /function hairMaterialPresetValue\(material = \{\}\)[\s\S]*color: normalized\.color[\s\S]*baseColorGradientStops:[\s\S]*\.\.\.animeSettings[\s\S]*function normalizeHairMaterialPresetLibrary/);
  assert.match(source, /HAIR_MATERIAL_PRESET_STORAGE_KEY[\s\S]*function loadCustomHairMaterialPresets\(\)[\s\S]*function saveCustomHairMaterialPresets\(\)/);
  assert.match(source, /function applyHairMaterialPreset\(presetId\)[\s\S]*pushUndoState\(\)[\s\S]*Object\.assign\(definition, applied\)[\s\S]*refreshMaterialUsers\(definition\.id\)/);
  assert.match(source, /function commitCustomHairMaterialPreset\(\)[\s\S]*customHairMaterialPresets\.push\(preset\)[\s\S]*saveCustomHairMaterialPresets\(\)/);
  assert.doesNotMatch(source, /openHairMaterialPresetShare|serializeHairMaterialPresetShareText|parseHairMaterialPresetShareText/);
  assert.match(source, /materialPresets: customHairMaterialPresets[\s\S]*normalizeHairMaterialPresetLibrary\(backup\.materialPresets\)/);
  assert.match(source, /function syncHairGradientTexture\(definition\)[\s\S]*new THREE\.DataTexture[\s\S]*texture\.needsUpdate = true/);
  assert.match(source, /function applyHairBaseGradient\(material, lock\)[\s\S]*uUseBaseGradient[\s\S]*material\.map = texture/);
  assert.match(source, /hairMaterialGradientEnabledInput\.addEventListener\("change"[\s\S]*refreshMaterialUsers\(material\.id\)/);
  assert.match(css, /\.material-gradient-track\s*\{[\s\S]*\.material-gradient-stop\.active/);
  assert.match(css, /\.creation-preset-dialog\.material-gradient-dialog\s*\{[^}]*width:\s*min\(440px[^}]*overflow:\s*hidden/);
  assert.match(css, /\.material-gradient-dialog \.dialog-actions\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(source, /Object\.entries\(hairMaterialAnimeNumericControls\)[\s\S]*refreshMaterialUsers\(material\.id\)/);
});

test("editable mesh backfaces use an unpickable lime debug pass", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(source, /const MESH_BACKFACE_DEBUG_COLOR = 0x7cfc00/);
  assert.match(source, /function createMeshBackfaceDebugOverlay\(geometry\)[\s\S]*MeshBasicMaterial[\s\S]*side: THREE\.BackSide[\s\S]*depthWrite: false[\s\S]*overlay\.raycast = \(\) => \{\}/);
  assert.equal((source.match(/syncMeshBackfaceDebugOverlay\(lock\);/g) || []).length, 3);
  assert.match(source, /function rebuildLockGeometry\(lock, options = \{\}\)[\s\S]*syncMeshBackfaceDebugOverlay\(lock\)[\s\S]*previousGeometry\.dispose\(\)/);
  assert.match(source, /function disposeLockRuntime\(lock\)[\s\S]*disposeMeshBackfaceDebugOverlay\(lock\)/);
});

test("holding a transform shortcut opens its authoritative tool radial menu", async () => {
  const [html, source, css, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id=["']toolRadialMenu["'][\s\S]*data-tool-radial-index=["']0["'][\s\S]*data-tool-radial-index=["']3["']/);
  assert.match(css, /\.tool-radial-menu button\.hidden\s*\{[\s\S]*display:\s*none/);
  assert.match(
    source,
    /function toolRadialOptions\(tool = activeTool\) \{[\s\S]*Strand Select[\s\S]*Guide Select[\s\S]*Reference Select[\s\S]*World Space[\s\S]*Object Space[\s\S]*2D Translation[\s\S]*Pull Strand[\s\S]*proportionalEditing[\s\S]*toggle-proportional-lock-root[\s\S]*Unlock Root[\s\S]*Lock Root/
  );
  assert.match(source, /function setProportionalRootLocked\(enabled\)[\s\S]*proportionalLockRootInput\.checked = proportionalRootLocked[\s\S]*refreshProportionalPreview\(\)[\s\S]*updatePlacementStatus\(\)/);
  assert.match(source, /action === "toggle-proportional-lock-root"[\s\S]*setProportionalRootLocked\(!proportionalRootLocked\)/);
  assert.match(localization, /"Lock Root": "ルートを固定"[\s\S]*"Unlock Root": "ルート固定を解除"/);
  assert.match(
    source,
    /function beginToolShortcutPress\(key, tool\) \{[\s\S]*setActiveTool\(tool\)[\s\S]*window\.setTimeout[\s\S]*beginToolRadialGesture\(\)[\s\S]*180/
  );
  assert.match(
    source,
    /const tool = shortcutToolForKey\(event\.key\)[\s\S]*hotkeyToolSettingsExperimentalEnabled \|\| \["select", "move", "rotate", "scale"\]\.includes\(tool\)[\s\S]*beginToolShortcutPress/
  );
  assert.match(source, /window\.addEventListener\("keyup"[\s\S]*finishToolShortcutPress\(event\.key\.toLowerCase\(\)\)/);
  assert.doesNotMatch(source, /event\.key === "Control"[\s\S]*beginToolRadialGesture/);
  assert.match(source, /const selectingStrands = strandWorkspaceActive\(\)/);
  assert.match(source, /const selectingGuides = viewportEditMode === "guide"/);
  assert.match(source, /const referenceSelectionActive = selectionToolSupportsPicking\(\) && viewportEditMode === "reference"/);
  assert.match(source, /function referenceOverlayAtPointer\(event\)[\s\S]*reference\.element\.getBoundingClientRect\(\)/);
  assert.match(source, /const overlayReference = viewportEditMode === "reference" \? referenceOverlayAtPointer\(event\) : null/);
  assert.match(
    source,
    /function referencePlaneHitFromPointer\(\{ ignoreOcclusion = false \} = \{\}\)[\s\S]*if \(!planeHit \|\| ignoreOcclusion\) return planeHit/
  );
  assert.match(source, /referencePlaneHitFromPointer\(\{[\s\S]*ignoreOcclusion: viewportEditMode === "reference"/);
});

test("Contextual 2D point movement uses Z as a transient control-normal modifier", async () => {
  const [html, source] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /<kbd>Hold Z<\/kbd>[\s\S]*Point drag[\s\S]*Move along the control point normal/);
  assert.match(source, /let viewPlaneNormalMoveHeld = false/);
  assert.match(source, /function viewPlaneMovePointNormal\(lock, latticeGuide, pointIndex\)[\s\S]*pointUpDirection\(lock, pointIndex\)[\s\S]*latticeGuide\.pointNormals/);
  assert.match(source, /function rebaseViewPlaneMoveDrag\(normalMoveActive = viewPlaneNormalMoveHeld\)[\s\S]*drag\.plane\.setFromNormalAndCoplanarPoint\(drag\.planeNormal, drag\.planeOrigin\)[\s\S]*drag\.normalStartPointerY = drag\.lastPointerY/);
  assert.match(source, /function updateViewPlaneMove\(event\)[\s\S]*normalDistance = \(viewPlaneMoveDrag\.normalStartPointerY - event\.clientY\)[\s\S]*addScaledVector\(viewPlaneMoveDrag\.normal, normalDistance\)/);
  assert.match(source, /const viewPlaneNormalGuide = new THREE\.Line\([\s\S]*viewPlaneNormalGuide\.visible = false/);
  assert.match(source, /function updateViewPlaneNormalGuide\(\) \{[\s\S]*drag\?\.normalMoveActive[\s\S]*addScaledVector\(drag\.normal, -extent\)[\s\S]*addScaledVector\(drag\.normal, extent\)/);
  assert.match(source, /event\.key\.toLowerCase\(\) === "z"[\s\S]*activeTool === "move"[\s\S]*viewPlaneMoveActiveForView\(\)[\s\S]*setViewPlaneNormalMoveHeld\(true\)/);
  assert.match(source, /window\.addEventListener\("keyup"[\s\S]*event\.key\.toLowerCase\(\) === "z"[\s\S]*setViewPlaneNormalMoveHeld\(false\)/);
});

test("curve lattice point selection restores the move gizmo after contextual dragging", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(
    source,
    /if \(selectionToolSupportsPicking\(\)\)[\s\S]*const latticePointHit = selectedLattice\?\.handlesGroup\.visible[\s\S]*const directMove = activeTool === "move" && viewPlaneMoveActiveForView\(\);[\s\S]*activeTool === "move" && !directMove[\s\S]*if \(directMove\) beginViewPlaneMove\(null, latticePointHit\.object, event\)/
  );
  assert.doesNotMatch(
    source,
    /const modelingClick =[\s\S]{0,300}activeTool === "move" && selectedLattice\?\.handlesGroup\.visible/
  );
  assert.match(
    source,
    /function updateViewPlaneGrid\(\)[\s\S]*const keepLatticeGizmoVisible = directMoveActive && latticePointActive && !viewPlaneMoveDrag;[\s\S]*if \(keepLatticeGizmoVisible && selectedMoveHandle\) \{[\s\S]*configureTransformControls\("move"\);[\s\S]*transformControls\.object !== selectedMoveHandle[\s\S]*transformControls\.attach\(selectedMoveHandle\)/
  );
  assert.match(
    source,
    /function endViewPlaneMove\(event\)[\s\S]*viewPlaneMoveDrag = null;[\s\S]*updateViewPlaneGrid\(\);[\s\S]*updateInteractionLocks\(\)/
  );
});

test("strand radial menus hide the selection and restore hidden strands", async () => {
  const [source, localization] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(source, /function strandVisibilityRadialOptions[\s\S]*action: "hide-selected-strands"[\s\S]*label: "Hide"[\s\S]*action: "unhide-hidden-strands"[\s\S]*label: "Unhide Hidden"/);
  assert.match(source, /includeHideSelected = true,[\s\S]*unhideAsList = true[\s\S]*hide-selected-strands", label: "Hide"[\s\S]*\.\.\.\(unhideAsList \? \{ list: true \} : \{\}\)/);
  assert.match(source, /includeHideSelected: false,[\s\S]*unhideAsList: false/);
  assert.match(source, /action: "decouple-selected-mirrors"[\s\S]*list: true/);
  assert.match(source, /MAX_RADIAL_SUBMENU_OPTIONS = 5[\s\S]*partitionRadialOptions\([\s\S]*MAX_RADIAL_SUBMENU_OPTIONS/);
  assert.match(source, /reserveBottomForList: partitioned\.listOptions\.length > 0/);
  assert.match(source, /const innerRingOuterRadius = gesture\.submenu\?\.parentOuterRadius[\s\S]*const listCorridorReserved = !listOption[\s\S]*distance > innerRingOuterRadius[\s\S]*radialListCorridorContains\(dx, dy\)[\s\S]*distance <= 34 \|\| listCorridorReserved/);
  assert.match(source, /function hideSelectedStrands\(\)[\s\S]*pushUndoState\(\)[\s\S]*setLocksOutlinerVisibility\(targets, false\)[\s\S]*deselectStrands\(\)/);
  assert.match(source, /function unhideHiddenStrands\(\)[\s\S]*pushUndoState\(\)[\s\S]*setLocksOutlinerVisibility\(targets, true\)/);
  assert.match(source, /event\.ctrlKey[\s\S]*event\.key\.toLowerCase\(\) === "h"[\s\S]*selectedLocksInOrder\(\)\.length[\s\S]*hideSelectedStrands\(\)[\s\S]*unhideHiddenStrands\(\)/);
  assert.match(source, /function performStrandRadialAction\(action, lockId\)[\s\S]*action === "hide-selected-strands"[\s\S]*hideSelectedStrands\(\)[\s\S]*action === "unhide-hidden-strands"[\s\S]*unhideHiddenStrands\(\)/);
  assert.match(localization, /"Hide Selected":[\s\S]*"Hide":[\s\S]*"Unhide Hidden":/);
});

test("recognized app shortcuts reclaim focus from dropdowns and range sliders", async () => {
  const [source, registry] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/shortcut-registry.js", import.meta.url), "utf8")
  ]);

  assert.match(registry, /const APPLICATION_SHORTCUT_KEYS = new Set\(\[[\s\S]*"s"[\s\S]*"b"[\s\S]*"o"[\s\S]*"h"[\s\S]*"l"[\s\S]*"f"[\s\S]*"x"/);
  assert.doesNotMatch(registry, /^\s*"z",?\s*$/m);
  assert.match(
    registry,
    /function focusedControlShouldYieldToShortcut\(focused, event\) \{[\s\S]*tag === "select" \|\| \(tag === "input" && focused\.type === "range"\)[\s\S]*event\?\.ctrlKey \|\| event\?\.metaKey[\s\S]*event\?\.code === "Space" \|\| shortcutToolForKey\(key\) !== null/
  );
  assert.match(
    source,
    /let editingField = tag === "input"[\s\S]*focusedControlShouldYieldToShortcut\(document\.activeElement, event\)[\s\S]*document\.activeElement\.blur\(\);[\s\S]*editingField = false/
  );
  assert.match(
    source,
    /renderer\.domElement\.tabIndex = -1;[\s\S]*function focusViewportForHotkeys\(\)[\s\S]*dialog\[open\][\s\S]*renderer\.domElement\.focus\(\{ preventScroll: true \}\)[\s\S]*addEventListener\("pointerenter", focusViewportForHotkeys\)[\s\S]*addEventListener\("pointerdown", focusViewportForHotkeys, true\)/
  );
  assert.match(
    registry,
    /function pointerControlShouldReturnViewportFocus\(control\)[\s\S]*\["checkbox", "radio", "range"\][\s\S]*aria-pressed/
  );
  assert.match(
    source,
    /function returnPointerControlFocusToViewport\(event\)[\s\S]*pointerControlShouldReturnViewportFocus\(control\)[\s\S]*requestAnimationFrame[\s\S]*document\.activeElement !== control[\s\S]*focusViewportForHotkeys\(\)[\s\S]*event\.shiftKey && sculptBrushToolActive\(\)[\s\S]*setSculptBrushShiftSmoothHeld\(true\)[\s\S]*document\.addEventListener\("pointerup", returnPointerControlFocusToViewport, true\)/
  );
  assert.match(
    source,
    /const requestedShortcutTool = !editingField[\s\S]*shortcutToolForKey\(event\.key\)[\s\S]*cancelStrandRadialGesture\(\)[\s\S]*cancelToolShortcutPress\(\)[\s\S]*cancelToolRadialGesture\(\)/
  );
  assert.match(source, /event\.key\.toLowerCase\(\) === "x"[\s\S]*setMirrorXEditing\(!mirrorXEditing\)/);
  assert.doesNotMatch(source, /navigateCurvePointHierarchy|event\.key\.toLowerCase\(\) === "z"[\s\S]*navigateCurvePoint/);
  assert.match(source, /window\.addEventListener\("keydown", \(event\) => \{[\s\S]*\}, true\);/);
});

test("Delete removes the current removable selection but never the scalp guide", async () => {
  const [html, source, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /<kbd>Delete<\/kbd><span>Delete selected components, strands, guides, or references<\/span>/);
  assert.match(localization, /"Delete selected components, strands, guides, or references":/);
  assert.match(localization, /"Delete Vert":[\s\S]*"Delete Verts":[\s\S]*"Delete Edge":[\s\S]*"Delete Edges":[\s\S]*"Delete Face":[\s\S]*"Delete Faces":/);
  assert.match(source, /function deleteSelectedStrands\(\) \{[\s\S]*pushUndoState\(\)[\s\S]*deleteLocks\(selection\)/);
  assert.match(
    source,
    /function deleteGuide\(guide\) \{[\s\S]*pushUndoState\(\)[\s\S]*removeGuideObjects\(guide\)[\s\S]*disposeGuide\(guide\)[\s\S]*refreshLiveSurfaceOptions\(\)[\s\S]*function deleteSelectedGuide\(\) \{\s*return deleteGuide\(getSelectedGuide\(\)\)/
  );
  assert.match(
    source,
    /function deleteSelectedReferenceImage\(\) \{[\s\S]*selectedReferenceImage\(\)[\s\S]*pushUndoState\(\)[\s\S]*disposeReferenceImage\(reference\)[\s\S]*referenceImages\.splice/
  );
  assert.match(
    source,
    /function deleteCurrentSelection\(\) \{[\s\S]*selectedMeshComponentDeleteContext\(\)[\s\S]*deleteSelectedMeshComponents\(\)[\s\S]*selectedReferenceImage\(\)[\s\S]*selectedLocksInOrder\(\)\.length[\s\S]*getSelectedGuide\(\)[\s\S]*permanent scalp guide[\s\S]*return false/
  );
  assert.match(source, /if \(event\.key === "Delete"\) \{[\s\S]*event\.preventDefault\(\)[\s\S]*if \(!event\.repeat\) deleteCurrentSelection\(\)/);
  assert.doesNotMatch(source, /event\.key === "Backspace"[\s\S]*deleteCurrentSelection/);
  assert.match(source, /deleteSelectionAction\.addEventListener\("click", \(\) => \{\s*deleteCurrentSelection\(\)/);
});

test("duplicate commands dispatch to strands, guides, and references", async () => {
  const [html, source] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8")
  ]);
  assert.match(
    source,
    /function duplicateSelectedGuide\(\) \{[\s\S]*pushUndoState\(\)[\s\S]*serializeGuide\(source\)[\s\S]*snapshot\.id = crypto\.randomUUID\(\)[\s\S]*restoreGuide\(snapshot\)[\s\S]*selectGuide\(duplicate\.id\)/
  );
  assert.match(
    source,
    /function duplicateSelectedReferenceImage\(\) \{[\s\S]*pushUndoState\(\)[\s\S]*serializeReferenceImage\(source\)[\s\S]*delete snapshot\.id[\s\S]*addReferenceImage\(snapshot, \{ select: true \}\)/
  );
  assert.match(
    source,
    /function duplicateCurrentSelection\(\) \{[\s\S]*selectedReferenceImage\(\)[\s\S]*duplicateSelectedReferenceImage\(\)[\s\S]*getSelectedGuide\(\)[\s\S]*duplicateSelectedGuide\(\)[\s\S]*beginDuplicatePlacement\(selectedLocksInOrder\(\)\)/
  );
  assert.match(
    source,
    /event\.key\.toLowerCase\(\) === "d"[\s\S]*if \(!event\.repeat\) duplicateCurrentSelection\(\)/
  );
  assert.match(source, /kind === "guide"[\s\S]*Duplicate Guide[\s\S]*Delete Guide/);
  assert.match(source, /kind === "reference"[\s\S]*Duplicate Reference[\s\S]*Delete Reference/);
  assert.match(source, /action === "duplicate-current-selection"[\s\S]*duplicateCurrentSelection\(\)/);
  assert.match(html, /Ctrl\+D duplicates the current selection/);
});

test("Rebuild Curve supports selected strands and curve extrusions", async () => {
  const [html, source, css, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(
    html,
    /id="editMenuToggle"[\s\S]*id="curvesMenuToggle"[\s\S]*id="scalpSetupToggle"/
  );
  assert.match(html, /id="openRebuildCurve"[\s\S]*Rebuild Curve\.\.\./);
  assert.match(
    html,
    /id="rebuildCurveDialog"[\s\S]*id="rebuildCurveSelectionNote"[\s\S]*Multiple strands are selected[\s\S]*id="rebuildCurvePointCount"[^>]*min="2"[\s\S]*id="rebuildCurveEvenSpacing"[^>]*checked[\s\S]*id="confirmRebuildCurve"/
  );
  assert.match(
    source,
    /function selectedRebuildableCurves\(\)[\s\S]*selectedHairShellExtrusionRecord\(\)[\s\S]*rebuildCurveType: "hair-shell-extrusion"[\s\S]*!\["poly", "hair-shell", "surface", "curve-surface"\]\.includes\(lock\.geometryType\)/
  );
  assert.match(
    source,
    /function refreshRebuildCurveDialog\(\)[\s\S]*selection\.length === 1 && !multipleSelected[\s\S]*String\(selection\[0\]\.points\.length\)[\s\S]*confirmRebuildCurveButton\.disabled = !selection\.length/
  );
  assert.match(
    source,
    /function openRebuildCurveDialog\(\)[\s\S]*rebuildCurveEvenSpacingInput\.checked = true[\s\S]*rebuildCurveDialog\.show\(\)[\s\S]*refreshRebuildCurveDialog\(\)/
  );
  assert.match(
    source,
    /if \(kind === "clump"\)[\s\S]*action: "open-rebuild-curve"[\s\S]*if \(kind === "selection"\)[\s\S]*action: "delete-selection"[\s\S]*action: "open-rebuild-curve"[\s\S]*action: "delete"[\s\S]*action: "open-rebuild-curve"/
  );
  assert.match(source, /action: "open-rebuild-curve",[\s\S]*label: "Rebuild Curve",[\s\S]*enabled: selectedRebuildableCurves\(\)\.length > 0/);
  assert.match(source, /action === "open-rebuild-curve"\) return openRebuildCurveDialog\(\)/);
  assert.match(
    source,
    /function rebuildSelectedCurves\(\)[\s\S]*requestedCount < 2[\s\S]*pushUndoState\(\)[\s\S]*curveRebuildParameters\(pointCount, evenlySpaced, cumulativeLengths\)[\s\S]*rebuildCurveType === "hair-shell-extrusion"[\s\S]*target\.extrusion\.curvePoints = sampleStrandPointVectors[\s\S]*rebuildHairShell\(target\.lock\)[\s\S]*resampleStrandCurveData\(target, parameters\)[\s\S]*finishStrandCurveTopologyChange\(target\)/
  );
  assert.match(source, /renderLockList\(\);\s*refreshRebuildCurveDialog\(\);\s*return true;/);
  assert.match(css, /\.rebuild-curve-dialog\s*\{[\s\S]*inset:\s*54px 372px auto auto;[\s\S]*z-index:\s*19/);
  assert.match(css, /\.rebuild-curve-selection-note\.hidden\s*\{[\s\S]*display:\s*none[\s\S]*\.rebuild-curve-check/);
  assert.match(localization, /"Rebuild Curve":/);
  assert.match(localization, /"Evenly Space Control Points":/);
});

test("curve extrusions use the Anime Wedge Creased profile directly in their stable source frame", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const topology = await readFile(new URL("../modules/hair-shell.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /HAIR_SHELL_EXTRUSION_DEFAULT_SWEEP_PROFILE/);
  assert.match(source, /lock\.hairShellExtrusions\.push\(normalizeHairShellExtrusionSettings\([\s\S]*sweepProfile:\s*DEFAULT_SWEEP_PROFILE\.map\(\(point\) => \(\{ \.\.\.point \}\)\)/);
  assert.match(source, /#resetSweepProfile[\s\S]*const resetProfile = sweepProfileEdit\.type === "connected-shell-section"[\s\S]*DEFAULT_SWEEP_PROFILE;/);
  assert.match(topology, /function extrusionProfileDeformer[\s\S]*sampledProfilePolygon\(sweepProfile\)/);
  assert.doesNotMatch(topology, /orientHairShellExtrusionSweepProfile/);
});

test("Curves menu creates a standalone three-controller compound strand mesh", async () => {
  const [html, source, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="curvesMenu"[\s\S]*id="createCompoundStrand"[\s\S]*Create Compound Strand/);
  assert.match(
    source,
    /function createCompoundStrand\(\)[\s\S]*const rows = 7[\s\S]*const centerCurve = Array\.from\(\{ length: rows \}[\s\S]*new THREE\.Vector3\(0, 1\.55 - row \* 0\.5, 1\.45\)[\s\S]*const controllerCurves = \[-1, 0, 1\][\s\S]*pushUndoState\(\)[\s\S]*geometryType: "curve-surface"[\s\S]*curveSurfaceColumns: 3[\s\S]*curveSurfaceCompoundProfile: true/
  );
  const compoundConstructor = source.match(
    /function createCompoundStrand\(\)[\s\S]*?\n}\n\nfunction refreshRebuildCurveDialog/
  )?.[0] || "";
  assert.doesNotMatch(compoundConstructor, /createCurvePoints|presets\.front/);
  assert.match(
    source,
    /function createCompoundStrandGeometry\(lock\)[\s\S]*compoundSide[\s\S]*controller\.pointSurfaceNormals = controller\.points\.map[\s\S]*controllerFrames[\s\S]*controllerSpanInFrame[\s\S]*compoundProfileBridgePlan[\s\S]*normalizeCompoundBridgeZippers[\s\S]*compoundBridgeSegmentCounts[\s\S]*compoundControllerWidthScales[\s\S]*bridgeConnectedSegmentCounts[\s\S]*geometry\.userData\.openSurface = true/
  );
  const compoundGeometry = source.match(
    /function createCompoundStrandGeometry\(lock\)[\s\S]*?\n}\n\nfunction proceduralBranchGeometryLock/
  )?.[0] || "";
  assert.doesNotMatch(compoundGeometry, /THREE\.ShapeUtils\.triangulateShape/);
  assert.match(compoundGeometry, /geometry\.userData\.compoundBridgeConnectedSegmentCounts = \[\.\.\.bridgeConnectedSegmentCounts\]/);
  assert.match(compoundGeometry, /connectedSeam !== null[\s\S]*row < bridgeConnectedSegmentCounts\[connectedSeam\]/);
  assert.match(compoundGeometry, /geometry\.userData\.compoundIndependentControllerFrames = true/);
  assert.match(compoundGeometry, /bridgeSmoothing[\s\S]*Math\.max\(authoredBridgeLoops, bridgeSmoothing > 0 \? 1 : 0\)/);
  assert.match(compoundGeometry, /compoundBridgeArchWeight\([\s\S]*position\.addScaledVector\(tangent, -bridgeSpan \* 0\.5 \* archWeight\)/);
  assert.match(compoundGeometry, /bridgeVertexIndices[\s\S]*bridgeSegmentCount/);
  assert.match(compoundGeometry, /orientedQuadFace[\s\S]*geometry\.userData\.compoundBridgeEndCapped = true/);
  assert.doesNotMatch(compoundGeometry, /sharedFrameLock|sharedCurve|sharedFrames|sectionCenters/);
  assert.match(html, /id="compoundBridgeLoopsControl"[\s\S]*Bridge Loops[\s\S]*id="compoundBridgeLoops"[^>]*min="0"[^>]*max="8"/);
  assert.match(html, /id="compoundBridgeSmoothingControl"[\s\S]*Bridge Smoothing[\s\S]*id="compoundBridgeSmoothing"[^>]*min="0"[^>]*max="1"/);
  assert.match(
    source,
    /const compoundWidthCurve = \[[\s\S]*position: 0, value: 0\.95, interpolation: "smooth"[\s\S]*position: 0\.43, value: 0\.95[\s\S]*position: 0\.68, value: 0\.8[\s\S]*position: 0\.89, value: 0\.4[\s\S]*position: 1, value: 0[\s\S]*const compoundDepthCurve = \[[\s\S]*position: 0, value: 0\.64, interpolation: "smooth"[\s\S]*position: 0\.25, value: 0\.66[\s\S]*position: 1, value: 0/
  );
  assert.match(source, /taperCurve: compoundWidthCurve[\s\S]*depthCurve: compoundDepthCurve/);
  assert.doesNotMatch(source, /function selectedCompoundStrandSources\(/);
  assert.doesNotMatch(source, /function createCompoundStrandFromSelection\(/);
  assert.match(source, /curveSurfaceCompoundProfile: lock\.geometryType === "curve-surface"[\s\S]*Boolean\(lock\.curveSurfaceCompoundProfile\)/);
  assert.match(source, /curveSurfaceCompoundProfile: snapshot\.geometryType === "curve-surface"[\s\S]*Boolean\(snapshot\.curveSurfaceCompoundProfile\)/);
  assert.match(source, /compoundBridgeLoops: lock\.geometryType === "curve-surface"[\s\S]*lock\.curveSurfaceCompoundProfile/);
  assert.match(source, /compoundBridgeLoops: snapshot\.geometryType === "curve-surface"[\s\S]*snapshot\.curveSurfaceCompoundProfile/);
  assert.match(source, /compoundBridgeSmoothing: lock\.geometryType === "curve-surface"[\s\S]*lock\.curveSurfaceCompoundProfile/);
  assert.match(source, /compoundBridgeSmoothing: snapshot\.geometryType === "curve-surface"[\s\S]*snapshot\.curveSurfaceCompoundProfile/);
  assert.match(source, /compoundBridgeZippers: lock\.geometryType === "curve-surface"[\s\S]*normalizeCompoundBridgeZippers/);
  assert.match(source, /compoundBridgeZippers: snapshot\.geometryType === "curve-surface"[\s\S]*normalizeCompoundBridgeZippers/);
  assert.match(source, /function createCompoundBridgeControlContext\(lock, seamIndex\)[\s\S]*leftFrameLock:[\s\S]*rightFrameLock:/);
  assert.match(source, /function compoundBridgeControlPoint\([\s\S]*contextOverride = null[\s\S]*normalizeCompoundBridgeZippers[\s\S]*leftPoint\.clone\(\)\.lerp\(rightPoint, 0\.5 \+ offset\)/);
  assert.match(source, /const compoundBridgeHandles = \[\][\s\S]*userData\.compoundBridgeIndex = index[\s\S]*compoundBridgeHandles,/);
  assert.match(source, /function createSplitControlHandle\(\)[\s\S]*new THREE\.SphereGeometry\(0\.042, 18, 12\)/);
  assert.match(source, /const controlPointDisplayScale = controlPointDisplaySize[\s\S]*compoundBridgeHandles[\s\S]*panelSplitHandles[\s\S]*strandSplitHandle[\s\S]*handle\.scale\.setScalar\(controlPointDisplayScale\)/);
  assert.match(source, /function beginPanelSplitHandleDrag\(event\)[\s\S]*compoundBridgeHandles[\s\S]*const kind = hit\.object\.userData\.strandSplitHandle[\s\S]*createCompoundBridgeControlContext\(lock, splitIndex\)/);
  assert.match(source, /function updatePanelSplitHandleDrag\(event\)[\s\S]*panelSplitDrag\.kind === "compound"[\s\S]*for \(let pass = 0; pass < 2; pass \+= 1\)[\s\S]*Math\.round\(best\.parameter \* renderSegments\) \/ renderSegments[\s\S]*lock\.compoundBridgeZippers = zippers[\s\S]*updateLockGeometry\(lock, \{ defer: true \}\)[\s\S]*syncActiveMirror\(lock, \{ deferGeometry: true \}\)/);
  assert.match(source, /function endPanelSplitHandleDrag\(event\)[\s\S]*kind === "compound"[\s\S]*flushPendingLockGeometryUpdates\(\)/);
  assert.match(
    source,
    /function strandUsesDoubleSidedMaterial\(lock\)[\s\S]*lock\?\.geometryType === "curve-surface"[\s\S]*lock\?\.curveSurfaceCompoundProfile/
  );
  assert.match(source, /lock\.mesh\.material\.side = strandUsesDoubleSidedMaterial\(lock\)/);
  assert.match(source, /const entityLabel = compound \? "Compound Strand" : "Curve Surface"/);
  assert.match(localization, /"Create Compound Strand":/);
  assert.match(localization, /"Bridge Loops":/);
  assert.match(localization, /"Bridge Smoothing":/);
});

test("Hair Shell creates an expanded scalp-fitted quad shell and Face Extrude draws connected faces", async () => {
  const [html, source, topology, css, componentVisuals] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/hair-shell.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/mesh-component-visuals.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="curvesMenu"[\s\S]*id="createHairShell"[\s\S]*Create Hair Shell/);
  assert.match(html, /id="viewportFaceExtrudeTool"[^>]*data-tool="face-extrude"[^>]*aria-label="Face Extrude tool"/);
  assert.match(html, /id="viewportStandardExtrudeTool"[^>]*data-tool="standard-extrude"[^>]*aria-label="Standard Extrude tool"/);
  assert.match(html, /id="standardExtrudeSettingsPanel" class="standard-extrude-settings-panel hidden"[\s\S]*id="standardExtrudeDistance"[\s\S]*id="standardExtrudeEaseDirection"[\s\S]*value="top"[\s\S]*value="right"[\s\S]*value="bottom"[\s\S]*value="left"[\s\S]*id="standardExtrudeEaseSpan"[^>]*min="1" max="8"/);
  assert.match(css, /\.standard-extrude-settings-panel\s*\{[\s\S]*top: 146px;[\s\S]*right: 18px;[\s\S]*var\(--glass-panel-color[\s\S]*backdrop-filter: blur\(14px\)/);
  assert.match(source, /async function createHairShell\(\)[\s\S]*ensureEditedScalpSurface\(\)[\s\S]*subdivideScalpBuilderCage\(authoredPoints, template\.faces, 1\)[\s\S]*multiplyScalar\(1\.08\)[\s\S]*geometryType: "hair-shell"/);
  assert.match(source, /function selectHairShellFaceAtEvent\(event\)[\s\S]*!meshEditModeActive\("face"\)[\s\S]*event\.ctrlKey[\s\S]*event\.shiftKey[\s\S]*showHairShellFaceSelection\(lock, next\)/);
  assert.doesNotMatch(source, /\|\| isModelingMesh\(lock\)/);
  assert.match(source, /const meshToolAllowed = [\s\S]*tool === "standard-extrude"[\s\S]*meshEditModeActive\("face"\)[\s\S]*\["poly", "hair-shell"\]\.includes\(selectedModelingMesh\?\.geometryType\)[\s\S]*tool === "face-extrude"[\s\S]*selectedModelingMesh\?\.geometryType === "hair-shell"/);
  assert.match(source, /!meshMode && \["poly", "face-extrude", "standard-extrude", "loop-cut"\]\.includes\(tool\)/);
  assert.match(source, /function ensureHairShellFaceSelectionGroup\(\)[\s\S]*new THREE\.LineSegments[\s\S]*SphereGeometry\(0\.055[\s\S]*hairShellFaceExtrudeHandle/);
  assert.match(source, /function showHairShellFaceSelection\(lock, faceIndexOrIndices\)[\s\S]*hairShellFaceRegionCenter[\s\S]*handle\.position\.copy\(center\)[\s\S]*connectedHairShellFaceRegion[\s\S]*faceIndices/);
  assert.match(source, /function selectedHairShellFaceStart\(event\)[\s\S]*activeTool !== "face-extrude"[\s\S]*connectedHairShellFaceRegion[\s\S]*canExtrudeHairShellFace[\s\S]*intersectObject\(handle, false\)[\s\S]*hairShellFaceRegionCenter[\s\S]*hairShellFaceRegionNormal/);
  assert.match(source, /function standardExtrudeTopologyForLock\(lock\)[\s\S]*lock\?\.geometryType === "hair-shell"[\s\S]*lock\?\.geometryType === "poly"[\s\S]*points: lock\.points[\s\S]*faces: lock\.polyFaces/);
  assert.match(source, /function selectedStandardExtrudeFaceIndices\(lock\)[\s\S]*selectedHairShellFaceIndices\(lock\)[\s\S]*selectedPolyMeshComponent\.faceIndices/);
  assert.match(source, /function standardExtrudeFaceRegions\(lock, topology, faceIndices\)[\s\S]*mirrorXEditing[\s\S]*polyMirroredFaceRegions\(topology\.points, topology\.faces, faceIndices\)[\s\S]*connectedHairShellFaceRegion/);
  assert.match(source, /function beginStandardExtrudeSelectedHairShellFace\(event\)[\s\S]*activeTool !== "standard-extrude"[\s\S]*connectedHairShellFaceRegion\(topology\.faces, faceIndices\)[\s\S]*standardExtrudeSelectionHit\(event, lock, faceIndices\)[\s\S]*faceRegions = standardExtrudeFaceRegions[\s\S]*geometryType: lock\.geometryType[\s\S]*faceRegions,[\s\S]*undoState: snapshotState\(\)[\s\S]*basePoints: topology\.points/);
  assert.match(source, /function updateStandardExtrudeDrag\(event\)[\s\S]*startPointerY - event\.clientY[\s\S]*applyStandardExtrudePreview/);
  assert.match(source, /function syncStandardExtrudeSettingsPanel\(\)[\s\S]*standardExtrudeDistanceInput\.value[\s\S]*standardExtrudeEaseDirectionInput\.value[\s\S]*lastTopology\?\.easedEnd/);
  assert.match(source, /function setViewportEditMode\(mode, options = \{\}\)[\s\S]*updateAttributeEditorMode\(\);\s*syncStandardExtrudeSettingsPanel\(\);\s*syncHairShellExtrusionControls\(\);/);
  assert.match(source, /function setMeshEditMode\(mode\)[\s\S]*syncStandardExtrudeSettingsPanel\(\);\s*syncHairShellExtrusionControls\(\);/);
  assert.match(source, /function standardExtrudeVisibleViewportBounds[\s\S]*\[outlinerPanel, toolPanel\][\s\S]*horizontalOverlap[\s\S]*bounds\.left[\s\S]*bounds\.right/);
  assert.match(source, /function positionStandardExtrudeSettingsPanel[\s\S]*standardExtrudeVisibleViewportBounds\(\)[\s\S]*style\.maxWidth[\s\S]*style\.maxHeight[\s\S]*preferredLeft = bounds\.right - panelBounds\.width[\s\S]*style\.left[\s\S]*style\.top/);
  assert.match(source, /function applyStandardExtrudeTopology\(lock, drag, topology\)[\s\S]*lock\.geometryType === "hair-shell"[\s\S]*rebuildHairShell\(lock\)[\s\S]*lock\.geometryType !== "poly"[\s\S]*lock\.points = points[\s\S]*lock\.polyFaces = faces[\s\S]*updateLockGeometry\(lock, \{ immediate: true \}\)/);
  assert.match(source, /function buildStandardExtrudePreviewTopology\(drag, distance\)[\s\S]*drag\.faceRegions[\s\S]*extrudeHairShellFaceTopology\([\s\S]*faceRegion,[\s\S]*mirroredFaceIndices/);
  assert.match(source, /function applyStandardExtrudePreview\(drag, distance, \{ force = false \} = \{\}\)[\s\S]*buildStandardExtrudePreviewTopology\(drag, nextDistance\)[\s\S]*applyStandardExtrudeTopology\(lock, drag, topology\)[\s\S]*syncActiveMirror\(lock\)/);
  assert.match(source, /function beginPolyMeshComponentEdit\(handle\)[\s\S]*mirrorXEditing \? polyMirrorVertexMap\(lock\.points\)[\s\S]*primaryIndices: mirroredPolyPrimaryIndices/);
  assert.match(source, /function updatePolyMeshComponentFromHandle\(handle\)[\s\S]*edit\.primaryIndices\.forEach[\s\S]*mirrorIndex === index[\s\S]*mirroredVector\(transformed\)/);
  assert.match(source, /function beginHairShellComponentEdit\(handle\)[\s\S]*sourceWeights[\s\S]*mirrorXEditing \? polyMirrorVertexMap\(lock\.hairShellBasePoints\)[\s\S]*Math\.max\(weight,[\s\S]*primaryIndices: mirroredPolyPrimaryIndices/);
  assert.match(source, /function updateHairShellComponentFromHandle\(handle\)[\s\S]*edit\.primaryIndices\.forEach[\s\S]*mirrorIndex === index[\s\S]*mirroredVector\(result\)/);
  assert.match(componentVisuals, /function mirroredComponentVertexIndices\(points, indices,[\s\S]*polyMirrorVertexMap\(points,[\s\S]*!selected\.has\(index\)/);
  assert.match(componentVisuals, /function mirroredComponentFaceIndices\([\s\S]*polyMirroredFaceRegions\(points, faces, faceIndices,[\s\S]*regions\.length === 2/);
  assert.match(componentVisuals, /function meshComponentOverlayBuffers\(points, components, type\)[\s\S]*outlinePositions/);
  assert.match(componentVisuals, /function meshTopologyEdgePositions\(points, faces\)[\s\S]*seen\.has\(key\)/);
  assert.match(source, /function populatePolyEditObjects\(lock, target\)[\s\S]*const color = UI_ACCENT_COLOR[\s\S]*visibleEdgeLines\.push/);
  assert.match(source, /function syncPolyEditObjectKinds\(lock\)[\s\S]*mirroredComponentVertexIndices\([\s\S]*selected \|\| mirrored \? CONTROL_POINT_SELECTED_COLOR : UI_ACCENT_COLOR[\s\S]*edge\.visible = edgeVisible \|\| faceVisible/);
  assert.match(source, /function syncPolyBrushComponentOverlay\(\)[\s\S]*mirroredComponentFaceIndices\([\s\S]*mirroredComponentVertexIndices\([\s\S]*lock\.points[\s\S]*setPolyComponentOverlayGeometry\(mirroredMesh, mirroredOutline/);
  assert.match(source, /function addHairShellTopologyEdgeOverlay\(group, lock\)[\s\S]*color: UI_ACCENT_COLOR[\s\S]*overlay\.raycast = \(\) => \{\}/);
  assert.match(source, /function addHairShellMirroredFaceSelectionOverlay\(group, lock, faceIndices\)[\s\S]*color: CONTROL_POINT_SELECTED_COLOR[\s\S]*fill\.raycast = \(\) => \{\}[\s\S]*outline\.raycast = \(\) => \{\}/);
  assert.match(source, /function updateHairShellComponentOverlays\(\)[\s\S]*mirroredComponentVertexIndices\([\s\S]*lock\.hairShellBasePoints[\s\S]*addHairShellTopologyEdgeOverlay\(group, lock\)[\s\S]*mirroredVertexIndices\.has\(pointIndex\)[\s\S]*addHairShellMirroredFaceSelectionOverlay/);
  assert.match(source, /function setMirrorXEditing\(enabled\)[\s\S]*syncPolyEditObjectKinds\(selectedLock\)[\s\S]*syncPolyBrushComponentOverlay\(\)[\s\S]*updateHairShellComponentOverlays\(\)/);
  assert.match(source, /function finishStandardExtrudeDrag\(event, \{ cancel = false \} = \{\}\)[\s\S]*undoHistory\.push\(drag\.undoState\)[\s\S]*releasePointerCapture/);
  assert.match(source, /standardExtrudeDistanceInput\?\.addEventListener\("input"[\s\S]*applyStandardExtrudePreview\(operation, distance, \{ force: true \}\)/);
  assert.match(source, /standardExtrudeEaseDirectionInput\?\.addEventListener\("change"[\s\S]*\["none", "top", "right", "bottom", "left"\][\s\S]*applyStandardExtrudePreview\(operation, operation\.distance, \{ force: true \}\)/);
  assert.match(source, /standardExtrudeEaseSpanInput\?\.addEventListener\("input"[\s\S]*Math\.round\(Number\(value\) \|\| 1\)[\s\S]*applyStandardExtrudePreview\(operation, operation\.distance, \{ force: true \}\)/);
  assert.match(source, /if \(activeTool === "face-extrude" && event\.button === 0[\s\S]*selectedHairShellFaceStart\(event\)[\s\S]*if \(faceStart && beginDrawStrandStroke\(event, null, null, faceStart\)\) return/);
  assert.match(source, /const faceExtrudeToolTransition = \(previousTool === "face-extrude"\) !== \(tool === "face-extrude"\)[\s\S]*finishDrawStrandStroke\(null, \{ cancel: true \}\)/);
  assert.match(source, /function configureTransformControls\(tool\) \{[\s\S]*const mode = toolModes\[tool\][\s\S]*if \(!mode\) \{[\s\S]*transformControls\.detach\(\)[\s\S]*transformControls\.setMode\("translate"\)[\s\S]*return false[\s\S]*transformControls\.setMode\(mode\)/);
  assert.match(source, /function finishDrawStrandStroke\(event, options = \{\}\)[\s\S]*try \{[\s\S]*\} finally \{[\s\S]*releasePointerCapture\(stroke\.pointerId\)[\s\S]*updateInteractionLocks\(\)/);
  assert.match(source, /lostpointercapture", \(event\) => finishDrawStrandStroke\(event, \{ cancel: true \}\)/);
  assert.match(source, /Unable to start the draw preview[\s\S]*finishDrawStrandStroke\(null, \{ cancel: true \}\)/);
  assert.match(source, /Unable to update the draw preview[\s\S]*finishDrawStrandStroke\(event, \{ cancel: true \}\)/);
  assert.match(source, /function updateHairShellExtrusionVolumePreview\(stroke, samples\)[\s\S]*hairShellBaseFaceIndices[\s\S]*buildHairShellRegionExtrusionPreviewTopology\([\s\S]*buildHairShellExtrusionPreviewTopology\([\s\S]*polyFaces: topology\.faces[\s\S]*createPolyGeometry\(previewLock\)/);
  assert.match(source, /function createHairShellCurveObjects\(lock\)[\s\S]*LineSegments[\s\S]*function updateHairShellCurveObjects\(lock\)[\s\S]*hairShellExtrusions[\s\S]*CatmullRomCurve3[\s\S]*hairShellCurvePoint/);
  assert.match(source, /function createHairShellCurveObjects\(lock\)[\s\S]*depthTest: true[\s\S]*selectedLine[\s\S]*depthTest: false[\s\S]*function hairShellCurveIsSelected/);
  assert.match(source, /function updateHairShellCurveObjects\(lock\)[\s\S]*selectedLinePoints[\s\S]*hairShellCurveIsSelected[\s\S]*curveObjects\.selectedLine\.geometry[\s\S]*handle\.material\.depthTest = !curveSelected/);
  assert.match(source, /function activateHairShellCurvePoint\(handle\)[\s\S]*hairShellCurveRoot[\s\S]*selectedHairShellCurvePoint[\s\S]*transformControls\.attach\(handle\)/);
  assert.match(source, /viewportEditMode === "mesh"[\s\S]*\["move", "rotate"\]\.includes\(tool\)[\s\S]*selectedHairShellCurvePoint[\s\S]*curveObjects\?\.handles\.find[\s\S]*configureTransformControls\(tool\)[\s\S]*transformControls\.attach\(curveHandle\)/);
  assert.match(source, /function updateHairShellCurveFromHandle\(handle\)[\s\S]*activeTool === "rotate"[\s\S]*pointRotations\[pointIndex\][\s\S]*curvePoints\[pointIndex\]\.copy\(handle\.position\)[\s\S]*rebuildHairShell\(lock\)[\s\S]*syncActiveMirror\(lock\)/);
  assert.match(source, /function updateHairShellCurveObjects\(lock\)[\s\S]*hairShellExtrusionCurveFrames[\s\S]*makeBasis\([\s\S]*authored\.frame\.normal\)\.negate\(\)[\s\S]*createCurveNormalIndicator[\s\S]*activeTool === "rotate"/);
  assert.match(topology, /function shapedExtrusionOffset[\s\S]*sampleExtrusionPointRotation/);
  assert.match(topology, /export function hairShellExtrusionCurveFrames[\s\S]*pointRotations/);
  assert.match(source, /function rebuildLockGeometry\(lock, options = \{\}\)[\s\S]*wireGeometryActive[\s\S]*meshWorkspaceWireSelection\(lock\)[\s\S]*createHairTopologyGeometry\(lock\.mesh\.geometry\)/);
  assert.match(source, /transformControls\.object\?\.userData\.hairShellCurvePoint[\s\S]*pushUndoState\(\)[\s\S]*activeHairShellCurveEdit/);
  assert.match(source, /function prepareCurvePointSelection\(event\)[\s\S]*hairShellCurveEditing[\s\S]*meshEditModeActive\("curve"\)[\s\S]*activateHairShellCurvePoint\(hit\.object\)/);
  const extrusionPreviewSource = source.slice(
    source.indexOf("function updateHairShellExtrusionVolumePreview"),
    source.indexOf("function updateDrawStrandPreview")
  );
  assert.doesNotMatch(extrusionPreviewSource, /buildHairShellTopology\(/);
  assert.doesNotMatch(source, /drawingHairShell|hairShellStart/);
  assert.match(source, /if \(stroke\.hairShellLockId\) extrudeHairShellFromStroke\(stroke\)/);
  assert.match(source, /function extrudeHairShellFromStroke\(stroke\)[\s\S]*hairShellBaseFaceIndices[\s\S]*curvePoints\[0\]\.copy[\s\S]*faceIndices,[\s\S]*selectedHairShellCurvePoint = \{[\s\S]*pointIndex: curvePoints\.length - 1/);
  assert.match(source, /hairShellBasePoints:[\s\S]*hairShellBaseFaces:[\s\S]*hairShellExtrusions:/);
  assert.match(source, /function rebuildBackHairMesh\(lock,[\s\S]*remapHairShellExtrusions\([\s\S]*if \(lock\.hairShellExtrusions\.length\) rebuildHairShell\(lock\)/);
  assert.match(source, /input\.disabled = Boolean\(meshLock\.hairShellTopologyEdited\)[\s\S]*key === "thickness" && Boolean\(meshLock\.hairShellExtrusions\.length\)/);
  assert.match(source, /const surfaceVertexCount = lock\.hairShellBasePoints\.length \/ 2/);
  assert.match(topology, /export const HAIR_SHELL_ROOT_SUPPORT_SIDE = 2/);
  assert.match(topology, /function appendExtrusionRows[\s\S]*appendFace\(\[previousRing\[side\], previousRing\[next\], ring\[next\], ring\[side\]\]\)[\s\S]*appendFace\(\[\.\.\.previousRing\]\)/);
  assert.match(topology, /export function buildHairShellTopology[\s\S]*const rootSupports = new Map\(\)[\s\S]*average\(\[vector\(workingPoints\[farNext\]\), vector\(workingPoints\[farPrevious\]\)\]\)[\s\S]*\[support\.midpointIndex, end, farNext\][\s\S]*\[support\.midpointIndex, start, end\][\s\S]*\[support\.midpointIndex, farPrevious, start\]/);
  assert.doesNotMatch(topology, /rootTriangleMidpoint|previousTriangleMidpoint|extrusionSupports|roundedHairShellSupportPoint/);
  assert.match(topology, /export function normalizeHairShellExtrusionSettings[\s\S]*triangleSide: _legacyTriangleSide[\s\S]*radialSegments: _legacyRadialSegments[\s\S]*verticalLoops:[\s\S]*rootTriangle: extrusion\.rootTriangle !== false/);
  assert.doesNotMatch(topology, /appendDenseBoundaryExtrusionRows|subdividedClosedOffsets|appendRootTransitionFaces/);
  assert.match(topology, /export function subdivideHairShellVerticalLoops[\s\S]*seedFaceIndices[\s\S]*const subdividedFaces[\s\S]*!\[0, 2\]\.includes\(labels\[side\]\)[\s\S]*faceChildren[\s\S]*export function buildHairShellTopology[\s\S]*loopSeedFaces[\s\S]*subdivideHairShellVerticalLoops[\s\S]*subdivided\.faceChildren/);
  assert.doesNotMatch(html, /hairShellExtrusionTriangleSide|data-hair-shell-extrusion-setting="triangleSide"|Triangle Side/);
});

test("Arc Hair Surface creates a persistent procedural quad canopy with contextual controls", async () => {
  const [html, source, generator] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/arc-hair-surface.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="curvesMenu"[\s\S]*id="createArcHairSurface"[\s\S]*Create Arc Hair Surface/);
  assert.match(html, /id="arcHairSurfacePanel"[\s\S]*id="arcHairSurfaceWidth"[\s\S]*id="arcHairSurfaceArcSegments"[\s\S]*id="arcHairSurfaceDepthSegments"/);
  assert.match(source, /function createArcHairSurface\(\)[\s\S]*createArcHairSurfaceGrid\(\)[\s\S]*hairShellPrimitive: "arc"[\s\S]*selectLock\(lock\.id/);
  assert.match(source, /function rebuildArcHairSurface\(lock\)[\s\S]*createArcHairSurfaceGrid\(lock\.arcHairSurfaceSettings\)[\s\S]*updateLockGeometry\(lock, \{ immediate: true \}\)/);
  assert.match(source, /hairShellPrimitive:[\s\S]*arcHairSurfaceSettings:[\s\S]*arcHairSurfaceOrigin:/);
  assert.match(generator, /export function createArcHairSurfaceGrid[\s\S]*faces\.push\(\[current, nextRow, nextRow \+ 1, current \+ 1\]\)/);
});

test("viewport edit mode synchronizes selection targets, outliner, and contextual editors", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(
    html,
    /id=["']viewportEditModeControl["'][\s\S]*id=["']viewportEditMode["'][\s\S]*value=["']strand["'][^>]*selected[\s\S]*value=["']mesh["'][\s\S]*value=["']guide["'][\s\S]*value=["']reference["'][\s\S]*value=["']brush["']/
  );
  assert.match(html, /<span>Workspace<\/span>[\s\S]*id="viewportSelectionModeControl"[\s\S]*data-selection-mode="component"[^>]*aria-pressed="true"[\s\S]*data-selection-mode="object"/);
  assert.match(css, /\.viewport-edit-mode\s*\{[^}]*left:\s*18px;[^}]*top:\s*0;[^}]*flex-direction:\s*column;[^}]*width:\s*244px;[^}]*background:\s*color-mix\(in srgb, var\(--glass-panel-color, #0b0a0e\) 73%, transparent\)/);
  assert.match(css, /\.viewport-edit-mode label\s*\{[^}]*height:\s*39px;[^}]*min-height:\s*39px;[^}]*border:\s*0;[^}]*background:\s*transparent/);
  assert.match(css, /\.viewport-selection-mode\s*\{[^}]*height:\s*39px;[^}]*min-height:\s*39px;[^}]*border-top:\s*1px solid #ffffff12;[^}]*background:\s*transparent/);
  assert.match(css, /\.viewport-selection-mode-buttons button\s*\{[^}]*height:\s*28px;[^}]*min-height:\s*28px;[^}]*font-size:\s*11px/);
  assert.match(css, /\.viewport-tools\s*\{[\s\S]*top:\s*100px/);
  assert.match(css, /\.viewport-edit-mode select,[\s\S]*\.viewport-draw-settings select\s*\{[\s\S]*color-scheme:\s*dark/);
  assert.match(css, /\.viewport-edit-mode select option,[\s\S]*\.viewport-draw-settings select optgroup\s*\{[\s\S]*background-color:\s*var\(--glass-panel-color, #0b0a0e\);[\s\S]*color:\s*#e8e2e9/);
  assert.match(css, /\.viewport-edit-mode select option:checked,[\s\S]*\.viewport-draw-settings select option:checked\s*\{[\s\S]*background-color:\s*#28232d/);
  assert.match(source, /let viewportEditMode = "strand"/);
  assert.match(
    source,
    /function setViewportEditMode\(mode, options = \{\}\)[\s\S]*if \(nextMode === "guide"\) \{[\s\S]*if \(switchingMode\) setMirrorXEditing\(true\)[\s\S]*setAttributeEditorTab\("main"\)/
  );
  assert.match(
    source,
    /function setViewportEditMode\(mode, options = \{\}\) \{[\s\S]*const switchingMode = nextMode !== viewportEditMode[\s\S]*if \(switchingMode && options\.exitSetupEditors !== false\) exitSetupEditors\(\)[\s\S]*viewportEditModeInput\.value = nextMode[\s\S]*setOutlinerTab[\s\S]*setReferenceImagePanelOpen\(nextMode === "reference"\)[\s\S]*setActiveTool\("select"\)/
  );
  assert.match(source, /viewportEditModeInput\.addEventListener\("change", \(\) => setViewportEditMode\(viewportEditModeInput\.value\)\)/);
  assert.match(source, /event\.key === "Tab" && !event\.shiftKey[\s\S]*setViewportSelectionMode\(effectiveViewportSelectionMode\(\) === "component" \? "object" : "component"\)/);
  assert.match(source, /const shortcutWorkspace = workspaceForShortcutKey\(event\.key\)[\s\S]*if \(!event\.repeat\) setViewportEditMode\(shortcutWorkspace\)/);
  assert.match(html, /<kbd>Tab<\/kbd><span>Cycle available edit modes<\/span>/);
  assert.match(html, /<kbd[^>]*>1<\/kbd>[\s\S]*<kbd[^>]*>2<\/kbd>[\s\S]*<kbd[^>]*>3<\/kbd>[\s\S]*<kbd[^>]*>4<\/kbd>[\s\S]*<kbd[^>]*>5<\/kbd>[\s\S]*<kbd[^>]*>6<\/kbd>[\s\S]*Strands \/ Meshes \/ Guides \/ References \/ Brushes \/ Presets workspaces/);
  assert.match(source, /kind === "workspace-submenu"[\s\S]*workspace-strand[\s\S]*workspace-mesh[\s\S]*workspace-guide[\s\S]*workspace-reference[\s\S]*workspace-brush/);
  assert.match(source, /strandOutlinerTab\.addEventListener\("click"[\s\S]*setOutlinerPanelCollapsed\(false\)[\s\S]*setOutlinerTab\("strands"\)/);
  assert.match(source, /guideOutlinerTab\.addEventListener\("click"[\s\S]*setOutlinerPanelCollapsed\(false\)[\s\S]*setOutlinerTab\("guides"\)/);
  assert.match(source, /referenceOutlinerTab\.addEventListener\("click"[\s\S]*setOutlinerPanelCollapsed\(false\)[\s\S]*setOutlinerTab\("references"\)/);
  assert.match(source, /meshOutlinerTab\.addEventListener\("click"[\s\S]*setOutlinerPanelCollapsed\(false\)[\s\S]*setOutlinerTab\("meshes"\)/);
  assert.match(html, /id="meshesMenu"[\s\S]*id="createBackHairMesh"[\s\S]*Create Back Hair Mesh/);
  assert.match(html, /id="meshesMenu"[\s\S]*id="createConnectedStrandShell"[\s\S]*Create Connected Strand Shell/);
  assert.match(html, /id="connectedStrandShellPanel"[\s\S]*data-connected-shell-setting="inflation"[^>]*min="0"[^>]*max="0\.4"[^>]*value="0\.08"[\s\S]*data-connected-shell-setting="mergeDistance"[^>]*min="0"[^>]*max="0\.2"[^>]*value="0\.04"[\s\S]*id="connectedStrandShellSectionWidth"[^>]*min="0\.1"[^>]*max="3"[^>]*value="1"[\s\S]*103 verts \/ 88 quads/);
  assert.match(html, /id="connectedStrandShellSectionShapeControls"[\s\S]*id="connectedStrandShellSectionProfilePreview"[\s\S]*data-shape-preset="sweepProfile"[\s\S]*data-shape-preset="taperCurve"[\s\S]*id="connectedStrandShellSectionWidthCurvePreview"[\s\S]*data-shape-preset="depthCurve"[\s\S]*id="connectedStrandShellSectionDepthCurvePreview"/);
  assert.match(html, /id="backHairMeshPanel"[\s\S]*data-back-hair-setting="width"[\s\S]*data-back-hair-setting="depth"[\s\S]*data-back-hair-setting="headFit"[^>]*min="0"[^>]*max="1"[^>]*value="1"[\s\S]*data-back-hair-setting="thickness"[^>]*min="0"[^>]*max="0\.3"[^>]*value="0\.1"[\s\S]*data-back-hair-setting="crownHeight"[\s\S]*data-back-hair-setting="backProjection"[\s\S]*data-back-hair-setting="napeLength"[\s\S]*data-back-hair-setting="lowerFlare"/);
  assert.match(html, /id="hairShellExtrusionPanel"[\s\S]*id="hairShellExtrusionName"[\s\S]*id="rebuildHairShellExtrusionCurve"[\s\S]*data-hair-shell-extrusion-setting="widthScale"[\s\S]*data-hair-shell-extrusion-setting="depthScale"[\s\S]*data-hair-shell-extrusion-setting="profileRotation"[\s\S]*data-hair-shell-extrusion-setting="twist"[\s\S]*Curve Shape Profile[\s\S]*id="hairShellExtrusionProfilePreview"[\s\S]*data-shape-preset="sweepProfile"[\s\S]*id="hairShellExtrusionWidthCurvePreview"[\s\S]*data-shape-preset="depthCurve"[\s\S]*id="hairShellExtrusionDepthCurvePreview"[\s\S]*data-hair-shell-extrusion-setting="verticalLoops"[\s\S]*data-hair-shell-extrusion-setting="loops"[\s\S]*id="hairShellExtrusionRootTriangle"/);
  assert.doesNotMatch(html, /hairShellExtrusionRadialSegments|data-hair-shell-extrusion-setting="radialSegments"|Profile Segments/);
  assert.doesNotMatch(html, /id="hairShellExtrusion(?:Taper|TipScale)"|data-hair-shell-extrusion-setting="(?:taper|tipScale)"/);
  assert.match(source, /rebuildHairShellExtrusionCurveButton\.addEventListener\("click", openRebuildCurveDialog\)/);
  assert.match(source, /function activeTaperTarget\(\)[\s\S]*type === "hair-shell-extrusion"[\s\S]*hairShellExtrusions\?\.\[taperCurveEdit\.extrusionIndex\]/);
  assert.match(source, /function applyTaperCurveEdit[\s\S]*type === "hair-shell-extrusion"[\s\S]*normalizeHairShellExtrusionSettings[\s\S]*rebuildHairShell\(lock\)/);
  assert.match(source, /function activeSweepProfile\(\)[\s\S]*type === "hair-shell-extrusion"[\s\S]*hairShellExtrusions\?\.\[sweepProfileEdit\.extrusionIndex\]/);
  assert.match(source, /function applySweepProfileEdit\(\)[\s\S]*type === "hair-shell-extrusion"[\s\S]*rebuildHairShell\(lock\)/);
  assert.match(source, /hairShellExtrusionCurve[\s\S]*DEFAULT_HAIR_SHELL_EXTRUSION_DEPTH_CURVE[\s\S]*DEFAULT_HAIR_SHELL_EXTRUSION_WIDTH_CURVE/);
  assert.match(source, /function createBackHairMesh\(\)[\s\S]*geometryType: "hair-shell"[\s\S]*lock\.modelingMeshType = "back-hair"[\s\S]*rebuildBackHairMesh\(lock, data\.settings\)[\s\S]*setViewportSelectionMode\("object"\)/);
  assert.match(source, /function createConnectedStrandShell\(\)[\s\S]*createConnectedStrandShellData\(\)[\s\S]*lock\.modelingMeshType = "connected-strand-shell"[\s\S]*updateConnectedStrandShellGeometry\(lock\)[\s\S]*setViewportSelectionMode\("curve"\)/);
  assert.match(source, /function updateHairShellCurveObjects\(lock\)[\s\S]*connectedShellCurves[\s\S]*connectedShellCurveIndex/);
  assert.match(source, /connectedShellSettings: lock\.modelingMeshType === "connected-strand-shell"[\s\S]*connectedShellRestPoints:[\s\S]*connectedShellRestCurves:[\s\S]*connectedShellCurves:[\s\S]*connectedShellVertexBindings:/);
  assert.match(source, /connectedStrandShellSettingInputs\.forEach[\s\S]*bindUndoCapture\(input\)[\s\S]*rebuildConnectedStrandShell\(lock/);
  assert.match(source, /bindUndoCapture\(connectedStrandShellSectionWidthInput\)[\s\S]*sectionWidths\[sectionIndex\][\s\S]*updateConnectedStrandShellGeometry\(lock\)/);
  assert.match(source, /function selectedConnectedStrandShellSectionRecord[\s\S]*!shellLock[\s\S]*!selectedHairShellCurvePoint[\s\S]*selectedHairShellCurvePoint\.lockId !== shellLock\.id[\s\S]*connectedShellCurves\?\.\[sectionIndex\]/);
  assert.match(source, /function activeTaperTarget\(\)[\s\S]*type === "connected-shell-section"[\s\S]*connectedShellCurves\?\.\[taperCurveEdit\.sectionIndex\]/);
  assert.match(source, /function applyTaperCurveEdit[\s\S]*type === "connected-shell-section"[\s\S]*normalizeConnectedStrandShellSectionCurve[\s\S]*updateConnectedStrandShellGeometry\(lock\)/);
  assert.match(source, /function activeSweepProfile\(\)[\s\S]*type === "connected-shell-section"[\s\S]*connectedShellCurves\?\.\[sweepProfileEdit\.sectionIndex\]/);
  assert.match(source, /function applySweepProfileEdit\(\)[\s\S]*type === "connected-shell-section"[\s\S]*updateConnectedStrandShellGeometry\(lock\)/);
  assert.doesNotMatch(source, /function createBackHairMesh\(\)[\s\S]*location: \{ y: 0\.2 \}/);
  assert.match(source, /restoredObjectTransform\(snapshot, \{[\s\S]*backHairMeshInternalYOffset: BACK_HAIR_MESH_INTERNAL_Y_OFFSET/);
  assert.match(source, /backHairMeshUsesInternalOffset: lock\.modelingMeshType === "back-hair" \? true : null/);
  assert.match(source, /function rebuildBackHairMesh\(lock,[\s\S]*createBackHairMeshData\(settings\)[\s\S]*hairShellBasePoints = authoredPoints[\s\S]*updateLockGeometry\(lock, \{ immediate: true \}\)/);
  assert.match(source, /function createPolyGeometry\(lock\)[\s\S]*modelingMeshType === "back-hair"[\s\S]*usesInnerSurface && usesOuterSurface \? face\.map\(rimVertex\) : face[\s\S]*renderQuadFaces\.push\(renderFace\)[\s\S]*geometry\.userData\.renderQuadFaces = renderQuadFaces/);
  assert.match(source, /function createHairTopologyGeometry\(sourceGeometry\)[\s\S]*sourceGeometry\.userData\.renderQuadFaces \|\| sourceGeometry\.userData\.quadFaces/);
  assert.match(source, /function renderMeshOutliner\(\)[\s\S]*modelingMeshLocks\(\)[\s\S]*createOutlinerVisibilityToggle[\s\S]*mesh-outliner-children[\s\S]*selectHairShellExtrusion/);
  assert.match(source, /function importedMeshObjectRecords\(\)[\s\S]*headMeshes\(\)[\s\S]*importedMeshKey[\s\S]*importedMeshVisible/);
  assert.match(source, /function importedMeshOutlinerFiles\(\)[\s\S]*importedHeadAsset[\s\S]*Body Mesh[\s\S]*Head Mesh[\s\S]*meshes: importedMeshObjectRecords\(\)/);
  assert.match(source, /function createImportedMeshOutlinerFolder\(records\)[\s\S]*Imported Meshes[\s\S]*mesh-imported-file[\s\S]*record\.meshes\.forEach[\s\S]*mesh-imported-item[\s\S]*pushUndoState\(\)/);
  assert.match(source, /function createImportedMeshOutlinerFolder\(records\)[\s\S]*meshOutlinerOpen\.get\(IMPORTED_MESH_OUTLINER_KEY\) === true/);
  assert.match(source, /function renderMeshOutliner\(\)[\s\S]*importedMeshOutlinerFiles\(\)[\s\S]*createImportedMeshOutlinerFolder\(importedMeshes\)/);
  assert.match(source, /importedMeshVisibility: importedMeshVisibilitySnapshot\(\)[\s\S]*applyImportedMeshVisibilityState\(restorePlan\.visibility\.importedMeshes\)/);
  assert.match(css, /\.mesh-imported-folder-label[\s\S]*\.mesh-imported-item[\s\S]*grid-template-columns:\s*22px minmax\(0, 1fr\)/);
  assert.match(source, /function syncHairShellExtrusionControls\(\)[\s\S]*normalizeHairShellExtrusionSettings[\s\S]*hairShellExtrusionRootTriangleInput/);
  assert.match(source, /hairShellExtrusions: lock\.geometryType === "hair-shell"[\s\S]*normalizeHairShellExtrusionSettings[\s\S]*curvePoints: extrusion\.curvePoints\.map\(vectorToData\)/);
  assert.match(source, /modelingMeshType: lock\.modelingMeshType \|\| null[\s\S]*backHairMeshSettings:[\s\S]*backHairMeshFaceZones:/);
  assert.match(html, /id=["']toggleOutlinerPanel["'][^>]*aria-expanded=["']true["'][\s\S]*id=["']toggleAttributeEditorPanel["'][^>]*aria-expanded=["']true["']/);
  assert.match(css, /@media \(min-width: 861px\)[\s\S]*body\.compact-sidebar-docked \.studio-shell[\s\S]*grid-template-columns: minmax\(0, 1fr\) 360px[\s\S]*body\.compact-sidebar-docked \.viewport-panel[\s\S]*grid-row: 2 \/ 4[\s\S]*body\.compact-sidebar-docked \.tool-panel[\s\S]*grid-row: 2[\s\S]*body\.compact-sidebar-docked \.outliner-panel[\s\S]*grid-row: 3/);
  assert.match(css, /\.studio-shell\s*\{[\s\S]*grid-template-columns: 280px minmax\(0, 1fr\) 360px[\s\S]*\.outliner-tab\s*\{[\s\S]*height: 27px[\s\S]*padding: 0 4px[\s\S]*font-size: 12px[\s\S]*\.outliner-tab\.active\s*\{[\s\S]*height: 31px/);
  assert.match(css, /body\.floating-side-panels \.studio-shell[\s\S]*grid-template-columns: minmax\(0, 1fr\)[\s\S]*body\.floating-side-panels \.outliner-panel[\s\S]*width: 280px[\s\S]*background: transparent[\s\S]*body\.floating-side-panels \.tool-panel[\s\S]*background: transparent[\s\S]*body\.floating-side-panels\.glass-side-panels \.outliner-panel[\s\S]*width: 280px[\s\S]*height: calc\(100% - 20px\)[\s\S]*margin-left: 10px[\s\S]*border-radius: 9px[\s\S]*body\.floating-side-panels\.glass-side-panels \.tool-panel[\s\S]*margin-right: 10px[\s\S]*background: color-mix\(in srgb, var\(--glass-panel-color, #0b0a0e\) 73%, transparent\)[\s\S]*backdrop-filter: blur\(14px\) saturate\(72%\)[\s\S]*body\.floating-side-panels \.viewport-tools \{\s*left: 298px[\s\S]*body\.floating-side-panels \.viewport-stats \{\s*right: 378px[\s\S]*body\.floating-side-panels \.viewport-bottom-left-guidance \{\s*left: 298px[\s\S]*body\.floating-side-panels \.sculpt-brush-dock,[\s\S]*left: calc\(50% - 54px\)[\s\S]*body\.floating-side-panels \.reference-image-panel \{\s*right: 378px;\s*width: min\(330px, calc\(100% - 676px\)\)[\s\S]*body\.floating-side-panels \.preset-library \{\s*inset: 70px 414px 28px 334px/);
  assert.match(css, /body\.floating-side-panels:not\(\.glass-side-panels\) \.outliner-tabs,[\s\S]*gap: 0;[\s\S]*padding-right: 0;[\s\S]*padding-left: 0;[\s\S]*background: transparent[\s\S]*\.outliner-tab\.active,[\s\S]*border-color: #4d454f;[\s\S]*border-bottom-color: transparent;[\s\S]*background: transparent[\s\S]*\.outliner-panel::after,[\s\S]*\.tool-panel::before[\s\S]*top: 39px;[\s\S]*height: 96px;[\s\S]*linear-gradient\(to bottom, #4d454f 0%, #4d454f 38%, transparent 100%\)[\s\S]*\.outliner-panel::after \{\s*right: 0[\s\S]*\.tool-panel::before \{\s*left: 0[\s\S]*\.outliner-tab:not\(\.active\),[\s\S]*border-bottom-color: #4d454f/);
  assert.match(css, /body\.floating-side-panels:not\(\.glass-side-panels\) \.outliner-panel,[\s\S]*height: calc\(100% - 12px\);[\s\S]*\.outliner-panel \{\s*margin-left: 6px[\s\S]*\.tool-panel \{\s*margin-right: 6px/);
  assert.match(css, /body\.floating-side-panels:not\(\.glass-side-panels\) \.tool-panel \.visibility-filter-box[\s\S]*border-color: #ffffff18;[\s\S]*background: color-mix\(in srgb, var\(--glass-panel-color, #0b0a0e\) 73%, transparent\);[\s\S]*backdrop-filter: blur\(14px\) saturate\(72%\)/);
  assert.match(css, /body\.floating-side-panels:not\(\.glass-side-panels\):not\(\.outliner-folder-colors-disabled\) \.outliner-group[\s\S]*var\(--outliner-folder-background-mix, 11%\)[\s\S]*transparent/);
  assert.match(css, /body\.floating-side-panels:not\(\.glass-side-panels\) \.outliner-panel,[\s\S]*\.attribute-editor-content \{[\s\S]*scrollbar-color: #f4f0ec transparent[\s\S]*\.attribute-editor-content::-webkit-scrollbar-track[\s\S]*background: transparent[\s\S]*\.attribute-editor-content::-webkit-scrollbar-thumb[\s\S]*background: #f4f0ec;[\s\S]*background-clip: padding-box[\s\S]*\.attribute-editor-content::-webkit-scrollbar-button:vertical:decrement[\s\S]*background: transparent url\([\s\S]*fill='%23f4f0ec'[\s\S]*\.attribute-editor-content::-webkit-scrollbar-button:vertical:increment/);
  assert.match(html, /class="tool-panel"[\s\S]*class="attribute-editor-tabs"[\s\S]*class="attribute-editor-content"[\s\S]*id="turntablePanel"/);
  assert.match(css, /\.tool-panel\s*\{[\s\S]*overflow: hidden;[\s\S]*padding: 0;[\s\S]*\.attribute-editor-tabs\s*\{[\s\S]*position: relative;[\s\S]*top: 0;[\s\S]*margin: 0;[\s\S]*\.attribute-editor-content\s*\{[\s\S]*flex: 1 1 auto;[\s\S]*min-height: 0;[\s\S]*overflow: auto;[\s\S]*padding: 12px 14px 14px/);
  assert.match(css, /:root\s*\{[\s\S]*--glass-panel-color: #19181d;[\s\S]*\.outliner-panel\s*\{[\s\S]*background: var\(--glass-panel-color, #19181d\);[\s\S]*\.tool-panel\s*\{[\s\S]*background: var\(--glass-panel-color, #19181d\);/);
  assert.doesNotMatch(source, /function syncResponsiveSidebarDock\(\)[\s\S]*if \(sidePanelStyle !== "default"\)/);
  assert.match(css, /body\.floating-side-panels\.compact-sidebar-docked \.outliner-panel,[\s\S]*width: auto;[\s\S]*justify-self: stretch;[\s\S]*margin-inline: 6px[\s\S]*body\.floating-side-panels\.glass-side-panels\.compact-sidebar-docked[\s\S]*margin-inline: 10px[\s\S]*body\.floating-side-panels\.compact-sidebar-docked \.viewport-edit-mode,[\s\S]*left: 18px[\s\S]*\.viewport-stats \{[\s\S]*right: 18px[\s\S]*\.viewport-top-controls,[\s\S]*left: 50%[\s\S]*\.reference-image-panel \{[\s\S]*right: 18px;[\s\S]*width: min\(330px, calc\(100% - 36px\)\)[\s\S]*\.preset-library \{[\s\S]*inset: 70px 54px 28px/);
  assert.match(css, /body\.compact-sidebar-docked\.compact-attribute-collapsed \.studio-shell[\s\S]*grid-template-rows: 36px auto minmax\(0, 1fr\)[\s\S]*body\.compact-sidebar-docked\.compact-attribute-collapsed \.tool-panel > \.attribute-editor-content/);
  assert.match(css, /body\.compact-sidebar-docked\.compact-outliner-collapsed \.studio-shell[\s\S]*grid-template-rows: 36px minmax\(0, 1fr\) auto[\s\S]*body\.compact-sidebar-docked\.compact-outliner-collapsed \.outliner-panel \.outliner-content/);
  assert.match(source, /function syncResponsiveSidebarDock\(\)[\s\S]*floatingPanels = document\.body\.classList\.contains\("floating-side-panels"\)[\s\S]*effectiveViewportLeft = viewportBounds\.left \+ \(floatingPanels \? outlinerPanel\.getBoundingClientRect\(\)\.width : 0\)[\s\S]*effectiveViewportRight = viewportBounds\.right - \(floatingPanels \? toolPanel\.getBoundingClientRect\(\)\.width : 0\)[\s\S]*workspaceLeftMargin = workspaceBounds\.left - effectiveViewportLeft[\s\S]*layerRightMargin = effectiveViewportRight - layerBounds\.right[\s\S]*layerRightMargin > workspaceLeftMargin[\s\S]*classList\.add\("compact-sidebar-docked"\)/);
  assert.match(source, /compactSidebarDockActivationWidth[\s\S]*viewportWidth > compactSidebarDockActivationWidth[\s\S]*classList\.remove\("compact-sidebar-docked"\)/);
  assert.match(source, /function setOutlinerPanelCollapsed\(collapsed\)[\s\S]*compactAttributeEditorCollapsed = false[\s\S]*function setAttributeEditorPanelCollapsed\(collapsed\)[\s\S]*compactOutlinerCollapsed = false/);
  assert.match(source, /function syncViewportDrawSettings\(\) \{[\s\S]*const drawSettingsVisible =[\s\S]*!capsuleGuideEditing;[\s\S]*viewportEditModeControl\.classList\.remove\("hidden"\)[\s\S]*aria-hidden", "false"/);
  assert.match(source, /function setScalpBuilderEditing\(enabled\) \{\s*if \(enabled && viewportEditMode !== "guide"\) setViewportEditMode\("guide"\)/);
  assert.match(source, /function setScalpBuilderEditing\(enabled\) \{[\s\S]*if \(enabled\) \{[\s\S]*setScalpGuideVisibility\(true\)[\s\S]*createScalpBuilderCurveLattice\(\)/);
  assert.match(source, /function setHeadSetupEditing\(enabled\) \{[\s\S]*headSetupEditing = Boolean\(enabled\)[\s\S]*if \(headSetupEditing\) \{\s*setScalpGuideVisibility\(true\);\s*createScalpBuilderCurveLattice\(\)/);
  assert.match(source, /function updateScalpEditingVisibility\(\) \{[\s\S]*brushPreviewActive = viewportEditMode === "brush"[\s\S]*scalpSurfaceGroup\.visible = scalpGuideVisible && !brushPreviewActive;/);
  assert.match(source, /function setCapsuleGuideEditing\(enabled\) \{\s*if \(enabled && viewportEditMode !== "guide"\) setViewportEditMode\("guide"\)/);
  assert.match(source, /function selectLock\(id, options = \{\}\) \{[\s\S]*const requestedWorkspace = isModelingMesh\(requestedLock\)[\s\S]*\? "mesh"[\s\S]*: "strand"[\s\S]*setViewportEditMode\(requestedWorkspace, \{ clearSelection: false, activateSelect: false \}\)/);
  assert.match(source, /function selectGuide\(id\) \{[\s\S]*setViewportEditMode\("guide", \{ clearSelection: false, activateSelect: false \}\)/);
  assert.match(source, /function selectReferenceImage\(id\) \{[\s\S]*setViewportEditMode\("reference", \{ clearSelection: false, activateSelect: false \}\)/);
  assert.match(source, /const selectedGuide = getSelectedGuide\(\);[\s\S]*const editingGuide = viewportEditMode === "guide" && Boolean\(selectedGuide\)/);
  assert.match(source, /guidePanel\.classList\.toggle\("hidden", !editingLegacyGuide\)/);
  assert.match(source, /const canCreateCapsuleGuide = viewportEditMode === "guide"[\s\S]*!selectedGuide[\s\S]*!scalpBuilderEditing/);
  assert.match(source, /surfaceGuideToolPanel\.classList\.toggle\([\s\S]*!capsuleGuideEditing && !editingCapsuleGuide && !canCreateCapsuleGuide/);
  assert.match(source, /function strandWorkspaceActive\(mode = viewportEditMode\)[\s\S]*raycaster\.intersectObjects\([\s\S]*locks\.filter\(strandVisibleForDisplay\)/);
  assert.match(source, /viewportEditMode === "guide"[\s\S]*guides\.flatMap/);
});

test("mesh workspace exposes object, curve, vertex, edge, and face edit modes", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="viewportMeshSelectionMode"[\s\S]*value="object"[^>]*selected[\s\S]*value="curve"[\s\S]*value="vert"[\s\S]*value="edge"[\s\S]*value="face"/);
  assert.match(html, /id="viewportMeshSelectionMode"[^>]*aria-label="Mesh edit mode"/);
  assert.doesNotMatch(html, /class="sr-only">Mesh edit mode<\/span>/);
  assert.match(html, /id="selectToolEditModeMenu"[\s\S]*id="selectToolMeshEditMode"[\s\S]*Object[\s\S]*Curve[\s\S]*Vert[\s\S]*Edge[\s\S]*Face/);
  assert.match(css, /\.viewport-selection-mode\.mesh-edit-mode \.viewport-selection-mode-buttons[\s\S]*display: none[\s\S]*\.viewport-selection-mode\.mesh-edit-mode \.viewport-mesh-selection-mode[\s\S]*display: block/);
  assert.match(css, /\.select-tool-edit-mode-menu\s*\{[\s\S]*position: fixed[\s\S]*backdrop-filter: blur\(14px\)/);
  assert.match(source, /const MESH_EDIT_MODES = \["object", "curve", "vert", "edge", "face"\][\s\S]*let meshEditMode = "object"/);
  assert.match(source, /function setMeshEditMode\(mode\)[\s\S]*MESH_EDIT_MODES\.includes\(mode\)[\s\S]*refreshSelectionModeVisuals\(\)/);
  assert.match(source, /function setMeshEditMode\(mode\)[\s\S]*meshEditMode === nextMode[\s\S]*selectedLock\?\.geometryType === "poly"[\s\S]*updateCurveObjects\(selectedLock, \{ visible: true \}\)/);
  assert.match(source, /function polyEditObjectsVisible\(lock\)[\s\S]*viewportEditMode === "mesh"[\s\S]*\["vert", "edge", "face"\]\.includes\(meshEditMode\)[\s\S]*\["select", "move", "rotate", "scale"\]\.includes\(activeTool\)/);
  assert.match(source, /function polyTargetAtEvent\(event, requestedType = null\)[\s\S]*polyScreenEdgeHitAtEvent\(event, lock, frontFacing\)/);
  assert.match(source, /function polyScreenEdgeHitAtEvent\(event, lock, frontFacing, maximumDistance = 10\)[\s\S]*frontFacing\.edgeKeys\.has[\s\S]*closestPointOnScreenSegment[\s\S]*applyMatrix4\(lock\.mesh\.matrixWorld\)/);
  assert.match(source, /function syncPolyEditObjectKinds\(lock\)[\s\S]*meshEditMode === "vert"[\s\S]*meshEditMode === "edge"[\s\S]*meshEditMode === "face"/);
  assert.match(source, /function syncPolyEditObjectKinds\(lock\)[\s\S]*controlPointIsSelected\("strand", lock\.id, pointIndex\)[\s\S]*handle\.visible = vertexVisible \|\| selected[\s\S]*CONTROL_POINT_SELECTED_COLOR/);
  assert.match(source, /function selectPolyMeshComponentAtEvent\(event, lock\)[\s\S]*polyTargetAtEvent\(event, requestedType\)[\s\S]*meshComponentSelectionAfterPick\([\s\S]*selectedPolyMeshComponent = selection\.component[\s\S]*refreshPolyMeshComponentSelection\(lock\)/);
  assert.match(source, /function selectMeshEdgeLoopAtEvent\(event\)[\s\S]*meshEditMode !== "edge"[\s\S]*polyEdgeLoopEdges\(points, faces, target\.vertices\)[\s\S]*event\.ctrlKey[\s\S]*event\.shiftKey[\s\S]*selectHairShellComponent[\s\S]*selectedPolyMeshComponent =/);
  assert.match(source, /addEventListener\("dblclick", selectMeshEdgeLoopAtEvent, true\)/);
  assert.match(source, /function selectedMeshComponentDeleteContext\(\)[\s\S]*meshEditMode === "face"[\s\S]*meshEditMode === "edge"[\s\S]*label: `Delete \$\{count > 1 \? plural : singular\}`/);
  assert.match(source, /function deleteSelectedMeshComponents\(\)[\s\S]*pushUndoState\(\)[\s\S]*deletePolyVertices[\s\S]*deletePolyEdge[\s\S]*deletePolyFacesAndOrphans[\s\S]*clearPolyMeshComponentSelection\(\)[\s\S]*refreshPolyMesh\(lock\)/);
  assert.match(source, /function remapHairShellExtrusionsAfterTopologyDelete\(lock, previousPoints, previousFaces\)[\s\S]*nextFaceIndexByPreviousIndex[\s\S]*extrusionFaceIndices\(extrusion\)[\s\S]*faceIndices: mappedFaceIndices/);
  assert.match(source, /function deleteSelectedMeshComponents\(\)[\s\S]*editingHairShell[\s\S]*lock\.hairShellBasePoints = nextPoints[\s\S]*lock\.hairShellBaseFaces = nextFaces[\s\S]*remapHairShellExtrusionsAfterTopologyDelete[\s\S]*rebuildHairShell\(lock\)[\s\S]*syncActiveMirror\(lock\)/);
  assert.match(source, /function contextualRadialOptions\(kind\)[\s\S]*componentDelete[\s\S]*action: "delete-mesh-components"[\s\S]*label: componentDelete\.label/);
  assert.match(source, /function performStrandRadialAction\(action, lockId\)[\s\S]*action === "delete-mesh-components"[\s\S]*deleteSelectedMeshComponents\(\)/);
  assert.match(source, /function syncPolyBrushComponentOverlay\(\)[\s\S]*meshComponentActive = viewportEditMode === "mesh"[\s\S]*\["edge", "face"\]\.includes\(meshEditMode\)[\s\S]*group\.visible = true/);
  assert.match(source, /function prepareCurvePointSelection\(event\)[\s\S]*polyMeshComponentEditing[\s\S]*componentGizmoActive[\s\S]*pointerHitsTransformGizmo\(event\)[\s\S]*selectPolyMeshComponentAtEvent\(event, selectedLock\)/);
  assert.match(source, /function polyMeshComponentCenter\(lock,[\s\S]*multiplyScalar\(1 \/ validIndices\.length\)/);
  assert.match(source, /function syncPolyMeshComponentHandle\(lock,[\s\S]*polyMeshComponentHandle = true[\s\S]*selectedPolyMeshComponent\.handle = handle/);
  assert.match(source, /function attachPolyMeshComponentTransform\(lock\)[\s\S]*updateWorldMatrix\(true, true\)[\s\S]*handle\.updateWorldMatrix\(true, false\)[\s\S]*transformControls\.attach\(handle\)/);
  assert.match(source, /function updateViewPlaneGrid\(\)[\s\S]*polyComponentMoveActive[\s\S]*expectedMoveHandle = polyComponentMoveActive[\s\S]*attachPolyMeshComponentTransform\(lock\)[\s\S]*attachTransformForCurvePoint/);
  assert.match(source, /function beginPolyMeshComponentEdit\(handle\)[\s\S]*points: lock\.points\.map[\s\S]*pivot: handle\.position\.clone/);
  assert.match(source, /function updatePolyMeshComponentFromHandle\(handle\)[\s\S]*activeTool === "move"[\s\S]*activeTool === "rotate"[\s\S]*applyQuaternion\(rotation\)[\s\S]*activeTool === "scale"[\s\S]*multiply\(scaleRatio\)[\s\S]*updateLockGeometry\(lock, \{ immediate: true, updateCurveObjects: false \}\)/);
  assert.match(source, /transformControls\.addEventListener\("dragging-changed"[\s\S]*polyMeshComponentHandle[\s\S]*pushUndoState\(\)[\s\S]*beginPolyMeshComponentEdit[\s\S]*finishPolyMeshComponentEdit/);
  assert.match(source, /transformControls\.addEventListener\("objectChange"[\s\S]*polyMeshComponentHandle[\s\S]*updatePolyMeshComponentFromHandle\(handle\)/);
  assert.match(source, /function setActiveTool\(tool\)[\s\S]*selectedPolyComponentLock[\s\S]*attachPolyMeshComponentTransform\(selectedPolyComponentLock\)/);
  assert.match(source, /function createHairShellVertexMarker[\s\S]*new THREE\.SpriteMaterial\(\{[\s\S]*depthTest: true[\s\S]*polygonOffset: true[\s\S]*polygonOffsetFactor: -2[\s\S]*polygonOffsetUnits: -2[\s\S]*marker\.scale\.setScalar\(0\.0425 \* controlPointDisplaySize\)[\s\S]*hairShellVertexIndex/);
  assert.match(source, /function selectHairShellMeshComponentAtEvent[\s\S]*\["select", "move", "rotate", "scale"\]\.includes\(activeTool\)[\s\S]*nearestHairShellFaceVertex[\s\S]*nearestHairShellFaceEdge/);
  assert.match(source, /function updateHairShellComponentFromHandle[\s\S]*hairShellBasePoints\[index\]\.copy[\s\S]*rebuildHairShell\(lock\)[\s\S]*syncActiveMirror\(lock\)/);
  assert.match(source, /function configureTransformControls\(tool\)[\s\S]*transformControls\.showY = tool !== "scale"[\s\S]*viewportEditMode === "mesh"[\s\S]*!componentEditModeActive\(\)/);
  assert.match(source, /function hairShellComponentNormalQuaternion[\s\S]*hairShellComponentFaceIndices[\s\S]*hairShellFaceNormal[\s\S]*makeBasis\(tangent, bitangent, normal\)/);
  assert.match(source, /function updateHairShellComponentOverlays[\s\S]*normalTransformSpaceActive\(\)[\s\S]*hairShellComponentNormalQuaternion\(lock\)[\s\S]*configureTransformControls\(activeTool\)/);
  assert.match(source, /function updateHairShellComponentFromHandle[\s\S]*applyQuaternion\(inverseStartQuaternion\)[\s\S]*multiply\(scaleRatio\)[\s\S]*applyQuaternion\(edit\.startQuaternion\)/);
  assert.match(source, /function toolRadialOptions[\s\S]*normal-space[\s\S]*Normal Space[\s\S]*function performToolRadialAction[\s\S]*setTransformSpaceEditing\("normal"\)/);
  assert.match(source, /meshComponentProportionalToolActive[\s\S]*editingMesh[\s\S]*\["select", "move", "rotate", "scale"\]\.includes\(activeTool\)[\s\S]*\["vert", "edge", "face"\]\.includes\(meshEditMode\)[\s\S]*proportionalPanel\.classList\.toggle/);
  assert.match(source, /function beginHairShellComponentEdit[\s\S]*proportionalEditing[\s\S]*polyProportionalWeights\([\s\S]*selectedHairShellComponent\.indices[\s\S]*function updateHairShellComponentFromHandle[\s\S]*lerp\(transformed, weight\)/);
  assert.match(source, /function hairShellComponentInfluenceWeights[\s\S]*proportionalEditing[\s\S]*\["select", "move", "rotate", "scale"\]\.includes\(activeTool\)[\s\S]*polyProportionalWeights\([\s\S]*function addHairShellEdgeInfluenceOverlay[\s\S]*THREE\.LineSegments[\s\S]*function addHairShellFaceInfluenceOverlay[\s\S]*THREE\.MeshBasicMaterial/);
  assert.match(source, /function selectHairShellFaceAtEvent\(event\)[\s\S]*\["select", "move", "rotate", "scale"\]\.includes\(activeTool\)[\s\S]*showHairShellFaceSelection\(lock, next\)/);
  assert.match(source, /function createHairShellVertexMarker[\s\S]*influenceWeight[\s\S]*proportionalInfluenceColor\(influenceWeight\)[\s\S]*function updateHairShellComponentOverlays[\s\S]*influenceWeights\?\.\[pointIndex\][\s\S]*meshEditMode === "edge"[\s\S]*meshEditMode === "face"/);
  assert.match(source, /function contextualRadialOptions\(kind\)[\s\S]*viewportEditMode === "mesh"[\s\S]*MESH_EDIT_MODES\.map[\s\S]*edit-mode-\$\{mode\}/);
  assert.match(source, /function beginToolRadialGesture\(\)[\s\S]*activeTool === "select" && viewportEditMode === "mesh"[\s\S]*selectToolEditModeMenu\.classList\.remove\("hidden"\)/);
  assert.match(source, /function beginMeshEditModeRadialGesture\(event\)[\s\S]*event\.button !== 2[\s\S]*modelingMeshHitFromEvent\(event\)[\s\S]*selectLock\(lock\.id, \{ individualClumpMember: true \}\)[\s\S]*kind = "mesh-edit-mode"[\s\S]*setPointerCapture/);
  assert.match(source, /function finishMeshEditModeRadialGesture\(event,[\s\S]*releasePointerCapture[\s\S]*finishStrandRadialGesture\(\)[\s\S]*window\.addEventListener\("pointerup", finishMeshEditModeRadialGesture, true\)[\s\S]*renderer\.domElement\.addEventListener\("pointerdown", beginMeshEditModeRadialGesture, true\)/);
  assert.match(source, /function contextualRadialOptions\(kind\) \{[\s\S]*kind === "mesh-edit-mode"[\s\S]*MESH_EDIT_MODES\.map[\s\S]*function performStrandRadialAction[\s\S]*action\?\.startsWith\("edit-mode-"\)[\s\S]*setViewportSelectionMode/);
  const meshEditRadialSource = source.slice(
    source.indexOf('if (kind === "mesh-edit-mode")'),
    source.indexOf('if (kind === "mesh-tools")')
  );
  assert.doesNotMatch(meshEditRadialSource, /tool-loop-cut|Loop Cut/);
  assert.match(source, /function blockMeshEditModeBrowserContextMenu\(event\)[\s\S]*suppressMeshEditModeContextMenu[\s\S]*event\.preventDefault\(\)[\s\S]*renderer\.domElement\.addEventListener\("contextmenu", blockMeshEditModeBrowserContextMenu\)/);
});

test("edge edit mode exposes undoable mirrored loop, bevel, bridge, and flow operations", async () => {
  const [html, source, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="viewportLoopCutTool"[^>]*data-tool="loop-cut"[\s\S]*icon-loop-cut/);
  assert.match(html, /id="meshOperationsPanel"[\s\S]*id="meshBridge"[\s\S]*id="meshEdgeFlowStrength"[\s\S]*id="meshEdgeFlow"/);
  assert.match(html, /id="meshBevelDialog"[\s\S]*id="meshBevelWidth"[\s\S]*id="meshBevel"/);
  assert.match(html, /id="meshBevelSegments"[^>]*min="1"[^>]*max="12"/);
  assert.match(source, /function openMeshBevelDialog\(\)[\s\S]*\.show\(\);[\s\S]*updateMeshBevelPreview\(\)/);
  assert.match(source, /function keepSettingsClearOfStats\(\)[\s\S]*settingsClearance\(rect,stats,viewport\)/);
  assert.doesNotMatch(html, /id="meshLoopCutPosition"|id="meshLoopCut"/);
  assert.match(source, /function syncMeshOperationsPanel\(\)[\s\S]*viewportEditMode === "mesh"[\s\S]*meshEditMode === "edge"[\s\S]*polyBoundaryEdges/);
  assert.match(source, /function meshTopologyOperationAllowed\(lock\)[\s\S]*lock\?\.geometryType === "poly"/);
  assert.match(source, /function syncMeshOperationsPanel\(\)[\s\S]*const topologyAllowed = meshTopologyOperationAllowed\(context\.lock\)/);
  assert.doesNotMatch(source, /\bmeshOperationTopologyAllowed\b/);
  assert.match(source, /function mirroredMeshOperationEdges\(points, edges\)[\s\S]*mirrorXEditing[\s\S]*polyMirrorVertexMap/);
  const loopCutTargetSource = source.slice(
    source.indexOf("function meshLoopCutTargetAtEvent"),
    source.indexOf("function polyEdgeLoopCandidateForEvent")
  );
  assert.match(loopCutTargetSource, /viewportEditMode !== "mesh"[\s\S]*triangleQuadIds[\s\S]*closestPointToPoint/);
  assert.doesNotMatch(loopCutTargetSource, /meshEditMode/);
  assert.match(source, /function polyEdgeLoopCandidateForEvent\(event, \{ forceMidpoint = false \} = \{\}\)[\s\S]*activeTool === "loop-cut"[\s\S]*forceMidpoint[\s\S]*polyEdgeLoopPlan/);
  assert.match(source, /function updatePolyEdgeLoopPreview\(event\)[\s\S]*dedicatedTool = activeTool === "loop-cut"[\s\S]*forceMidpoint: dedicatedTool && event\.shiftKey/);
  assert.match(source, /function beginMeshLoopCutPointer\(event\)[\s\S]*activeTool !== "loop-cut"[\s\S]*event\.button !== 0[\s\S]*forceMidpoint: event\.shiftKey[\s\S]*commitPolyEdgeLoop/);
  assert.match(source, /function commitPolyEdgeLoop\(candidate\)[\s\S]*insertPolyEdgeLoops[\s\S]*pushUndoState\(\)[\s\S]*hairShellBasePoints[\s\S]*hairShellBaseFaces[\s\S]*refreshPolyMesh[\s\S]*syncActiveMirror[\s\S]*refreshSelectionModeVisuals\(\)/);
  assert.match(source, /function polyFaceSmoothingGroups\(lock, faces = lock\?\.polyFaces\)[\s\S]*inferMeshPrimitiveFaceSmoothingGroups/);
  assert.match(source, /function commitPolyEdgeLoop\(candidate\)[\s\S]*sourceSmoothingGroups[\s\S]*result\.faceSourceIndices\.map[\s\S]*sourceSmoothingGroups\[faceIndex\]/);
  assert.match(source, /function createPolyGeometry\(lock\)[\s\S]*lock\.polyFaceSmoothingGroups[\s\S]*inferMeshPrimitiveFaceSmoothingGroups[\s\S]*splitMeshVerticesByFaceGroups/);
  assert.match(source, /polyFaceSmoothingGroups: lock\.geometryType === "poly"[\s\S]*function restoreLock[\s\S]*polyFaceSmoothingGroups: \(snapshot\.polyFaceSmoothingGroups \|\| \[\]\)/);
  assert.match(source, /function contextualRadialOptions\(kind\)[\s\S]*kind === "mesh-tools"[\s\S]*action: "tool-loop-cut"[\s\S]*label: "Loop Cut"/);
  assert.match(source, /function contextualRadialOptions\(kind\)[\s\S]*kind === "mesh-tools"[\s\S]*selectedMeshComponentDeleteContext\(\)[\s\S]*action: "delete-mesh-components"[\s\S]*label: componentDelete\.label/);
  const meshToolsRadialSource = source.slice(
    source.indexOf('if (kind === "mesh-tools")'),
    source.indexOf('if (kind === "root")')
  );
  assert.doesNotMatch(meshToolsRadialSource, /tool-(?:select|move|rotate|scale)/);
  assert.doesNotMatch(meshToolsRadialSource, /tool-poly|Poly Brush/);
  assert.match(meshToolsRadialSource, /action: "duplicate-current-selection"[\s\S]*label: "Duplicate Object"/);
  assert.match(meshToolsRadialSource, /action: "delete-selection"[\s\S]*label: "Delete Object"/);
  assert.match(source, /function beginStrandRadialGesture\(\)[\s\S]*viewportEditMode === "mesh"[\s\S]*"mesh-tools"/);
  assert.match(source, /function performStrandRadialAction\(action, lockId\)[\s\S]*action\?\.startsWith\("tool-"\)[\s\S]*setActiveTool\(action\.slice\("tool-"\.length\)\)/);
  assert.match(source, /const meshToolAllowed = \["select", "move", "rotate", "scale", "poly", "loop-cut"\]\.includes\(tool\)/);
  assert.match(source, /function polyEditObjectsVisible\(lock\)[\s\S]*activeTool === "loop-cut"[\s\S]*return true/);
  assert.match(source, /function syncPolyEditObjectKinds\(lock\)[\s\S]*const edgeVisible = polyBrushActive[\s\S]*activeTool === "loop-cut"[\s\S]*\["vert", "edge", "face"\]\.includes\(meshEditMode\)/);
  assert.match(source, /function updateHairShellComponentOverlays\(\)[\s\S]*activeTool === "loop-cut"[\s\S]*addHairShellTopologyEdgeOverlay/);
  assert.match(source, /function meshBevelSelectedEdges\(\)[\s\S]*chamferMeshEdges[\s\S]*pushUndoState\(\)/);
  assert.match(source, /function meshBridgeSelectedEdges\(\)[\s\S]*polyBoundaryEdges[\s\S]*bridgePolyEdges[\s\S]*pushUndoState\(\)/);
  assert.match(source, /function meshFlowSelectedEdges\(\)[\s\S]*flowPolySelectedEdges[\s\S]*pushUndoState\(\)/);
  assert.match(source, /function commitMeshOperationTopology\(lock, points, faces, selectedEdges\)[\s\S]*hairShellBasePoints[\s\S]*hairShellBaseFaces[\s\S]*refreshPolyMesh[\s\S]*syncActiveMirror/);
  assert.match(localization, /"Mesh Operations":[\s\S]*"Loop Cut":[\s\S]*"Loop Cut tool":[\s\S]*"Bevel":[\s\S]*"Set Edge Flow":/);
});

test("object and component edit modes share selection while object transforms pivot at strand roots", async () => {
  const [html, source, css, localization, objectTransformSource] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/object-transform.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="viewportSelectionModeControl"[\s\S]*data-selection-mode="component"[^>]*aria-pressed="true"[\s\S]*data-selection-mode="object"/);
  assert.match(html, /id="strandObjectTransformPanel"[\s\S]*>Translation<[\s\S]*aria-label="Translation X"[\s\S]*data-reset-object-transform="location" data-axis="x"[\s\S]*>Rotation<[\s\S]*data-object-transform="rotation" data-axis="y"[\s\S]*data-reset-object-transform="rotation" data-axis="y"[\s\S]*>Scale<[\s\S]*data-object-transform="scale" data-axis="z"[\s\S]*data-reset-object-transform="scale" data-axis="z"/);
  assert.match(css, /\.strand-object-transform-panel\s*\{[\s\S]*var\(--glass-panel-color[\s\S]*backdrop-filter: blur\(14px\)/);
  assert.match(css, /\.viewport-edit-mode\s*\{[\s\S]*background: color-mix\(in srgb, var\(--glass-panel-color, #0b0a0e\) 73%, transparent\)[\s\S]*\.viewport-selection-mode\s*\{[\s\S]*background: transparent[\s\S]*\.viewport-selection-mode-buttons button\.active\s*\{[\s\S]*color: #63c7ff/);
  assert.match(css, /\.outliner-tabs\s*\{[\s\S]*border-bottom: 1px solid transparent;[\s\S]*background: transparent[\s\S]*\.outliner-tab\s*\{[\s\S]*var\(--glass-panel-color, #0b0a0e\) 88%, #ffffff[\s\S]*\.outliner-tab\.active\s*\{[\s\S]*border-bottom-color: transparent;[\s\S]*background: transparent/);
  assert.match(css, /\.attribute-editor-tabs\s*\{[\s\S]*border-bottom: 1px solid transparent;[\s\S]*background: transparent[\s\S]*\.attribute-editor-tabs button\s*\{[\s\S]*var\(--glass-panel-color, #0b0a0e\) 88%, #ffffff[\s\S]*\.attribute-editor-tabs button\.active\s*\{[\s\S]*border-bottom-color: transparent;[\s\S]*background: transparent/);
  assert.match(css, /:root:lang\(ja\)\s*\{[^}]*font-family:\s*"Yu Gothic UI", "Meiryo UI", "Noto Sans JP"[^}]*font-feature-settings:\s*"palt" 1;[^}]*letter-spacing:\s*-0\.015em/);
  assert.match(css, /:root:lang\(ja\) \.viewport-selection-mode-buttons button\s*\{[^}]*padding-inline:\s*4px;[^}]*font-size:\s*12px/);
  assert.match(localization, /"Workspace":/);
  assert.match(localization, /"Component":/);
  assert.match(localization, /"Cycle available edit modes":/);
  assert.match(localization, /"Strands \/ Meshes \/ Guides \/ References \/ Brushes \/ Presets workspaces":/);
  assert.match(source, /let viewportSelectionMode = "component"/);
  assert.match(source, /function effectiveViewportSelectionMode\(\)[\s\S]*viewportEditMode === "reference"[\s\S]*viewportEditMode === "mesh"[\s\S]*meshEditMode[\s\S]*viewportSelectionMode/);
  assert.match(source, /function setViewportSelectionMode\(mode\)[\s\S]*refreshSelectionModeVisuals\(\)/);
  assert.match(source, /lock\.curveObjects\.group\.visible = brushCurveVisibilityAllowed[\s\S]*options\.visible && componentEditModeActive\(\)/);
  assert.match(
    source,
    /function selectionToolSupportsPicking[\s\S]*\["select", "move", "rotate", "scale"\][\s\S]*tool === "relax" && strandWorkspaceActive\(\)/
  );
  assert.match(source, /if \(selectionToolSupportsPicking\(\)\)[\s\S]*beginSelectionMarquee\(event, selectedSurface, addingSelection \? "add" : "remove"\)[\s\S]*beginSelectionMarquee/);
  assert.match(source, /function objectSelectionScreenBounds\(object, viewportRect\)[\s\S]*bounds3d[\s\S]*samples[\s\S]*position\.project\(camera\)[\s\S]*return visibleSamples \? screenBounds : null/);
  assert.match(source, /function objectInsideSelectionMarquee\(object, bounds, viewportRect\)[\s\S]*screenBoundsOverlap\(bounds, objectSelectionScreenBounds\(object, viewportRect\)\)[\s\S]*traverseVisible[\s\S]*triangleIntersectsScreenBounds\(triangle, bounds\)/);
  assert.match(source, /function meshComponentMarqueeMatches\(points, faces, object, bounds, viewportRect\)[\s\S]*points\.flatMap[\s\S]*pointInsideScreenBounds[\s\S]*segmentIntersectsScreenBounds[\s\S]*faces\.flatMap[\s\S]*triangleIntersectsScreenBounds/);
  assert.match(source, /function selectMeshComponentsInMarquee\(drag\)[\s\S]*\["vert", "edge", "face"\][\s\S]*meshComponentSelectionAfterMatches[\s\S]*selectedPolyMeshComponent[\s\S]*selectHairShellComponent/);
  assert.match(source, /function syncPolyBrushComponentOverlay\(\)[\s\S]*marqueeSelection[\s\S]*selectedPolyMeshComponent\.edgeVertices[\s\S]*selectedFaceIndices[\s\S]*mirroredEdges/);
  assert.match(source, /function syncPolyEditObjectKinds\(lock\)[\s\S]*const selected = vertexVisible && controlPointIsSelected/);
  assert.match(source, /function finishSelectionMarquee\(event, options = \{\}\)[\s\S]*componentEditModeActive\(\)\) selectPointsInMarquee\(drag\)/);
  assert.match(source, /function strandObjectRoot\(lock\)[\s\S]*function attachStrandObjectTransform\(\)[\s\S]*strandObjectTransformHandle\.position\.copy\(root\)/);
  assert.match(source, /function beginStrandObjectTransform\(handle\)[\s\S]*selectedLocksInOrder\(\)[\s\S]*strandObjectTransformSnapshot[\s\S]*previewMeshes/);
  assert.match(source, /function strandObjectTransformOperators\(edit, handle\)[\s\S]*worldMatrixForPivot/);
  assert.match(source, /function strandObjectTransformSnapshot\(lock[\s\S]*curveSurfaceSide: lock\.curveSurfaceSide\?\.clone\(\) \|\| null/);
  assert.match(source, /function strandObjectTransformOperators\(edit, handle\)[\s\S]*const transformDirection = \(direction\)[\s\S]*multiply\(scale\)[\s\S]*transformDirection,[\s\S]*worldMatrixForPivot/);
  const objectPreviewSource = source.slice(
    source.indexOf("function updateStrandObjectTransform(handle)"),
    source.indexOf("function commitStrandObjectTransform(edit, handle)")
  );
  assert.match(objectPreviewSource, /worldMatrixForPivot[\s\S]*applyStrandObjectPreviewMatrix[\s\S]*mirroredDelta/);
  assert.doesNotMatch(objectPreviewSource, /syncLockFromCurve|updateLockGeometry|syncActiveMirror/);
  assert.match(source, /function commitStrandObjectTransform\(edit, handle\)[\s\S]*lock\.pointSurfaceNormals = target\.pointSurfaceNormals\?\.map\(transformNormal\)[\s\S]*lock\.curveSurfaceSide = transformDirection\(target\.curveSurfaceSide\)[\s\S]*syncLockFromCurve\(lock\)[\s\S]*updateLockGeometry\(lock, \{ immediate: true \}\)[\s\S]*syncActiveMirror/);
  assert.match(source, /function finishStrandObjectTransform\(\)[\s\S]*restoreStrandObjectPreviewMeshes\(edit\)[\s\S]*commitStrandObjectTransform\(edit, strandObjectTransformHandle\)/);
  assert.match(objectTransformSource, /EMPTY_OBJECT_TRANSFORM[\s\S]*location:[\s\S]*rotation:[\s\S]*scale:/);
  assert.match(source, /function objectTransformPanelLock\(\)[\s\S]*!strandWorkspaceActive\(\) && viewportEditMode !== "mesh"[\s\S]*componentEditModeActive\(\)[\s\S]*selected\.length !== 1/);
  assert.match(source, /function objectTransformPanelGuide\(\)[\s\S]*viewportEditMode !== "guide"[\s\S]*componentEditModeActive\(\)[\s\S]*getSelectedGuide\(\)/);
  assert.match(source, /function syncStrandObjectTransformPanel\([\s\S]*objectTransformPanelGuide\(\)[\s\S]*activeGuideObjectTransform\?\.guideId[\s\S]*strandObjectTransformValuesAfterHandle/);
  assert.match(source, /function applyStrandObjectTransformPanelValues\(\)[\s\S]*objectTransformPanelGuide\(\)[\s\S]*beginGuideObjectTransform\(guideObjectTransformHandle\)[\s\S]*updateGuideObjectTransform\(guideObjectTransformHandle\)[\s\S]*finishGuideObjectTransform\(\)/);
  assert.match(source, /function applyStrandObjectTransformPanelValues\(\)[\s\S]*pushUndoState\(\)[\s\S]*beginStrandObjectTransform\(strandObjectTransformHandle\)[\s\S]*finishStrandObjectTransform\(\)/);
  assert.match(source, /strandObjectTransformResetButtons\.forEach[\s\S]*dataset\.resetObjectTransform[\s\S]*dataset\.axis[\s\S]*strandObjectTransformInputs\.find[\s\S]*input\.value = "0"[\s\S]*applyStrandObjectTransformPanelValues\(\)/);
  assert.match(source, /function commitStrandObjectTransform\(edit, handle\)[\s\S]*lock\.objectTransform = edit\.authoredTransformOverrides[\s\S]*strandObjectTransformValuesAfterHandle/);
  assert.match(source, /objectTransform: normalizeStrandObjectTransform\(lock\.objectTransform\)/);
  assert.match(source, /objectTransform: restoredObjectTransform\(snapshot, \{[\s\S]*backHairMeshInternalYOffset: BACK_HAIR_MESH_INTERNAL_Y_OFFSET/);
  assert.match(source, /function syncMirrorPartnerFromLock[\s\S]*partner\.objectTransform = mirroredStrandObjectTransform\(lock\.objectTransform\)/);
  assert.match(source, /transformControls\.object\?\.userData\.strandObjectTransform[\s\S]*pushUndoState\(\)[\s\S]*beginStrandObjectTransform/);
  assert.match(source, /guideObjectTransformHandle\.userData\.guideObjectTransform = true/);
  assert.match(source, /function attachGuideObjectTransform\(\)[\s\S]*viewportEditMode === "guide"[\s\S]*componentEditModeActive\(\)[\s\S]*transformControls\.attach\(guideObjectTransformHandle\)/);
  assert.match(source, /function guideObjectTransformSnapshot\(guide, handle\)[\s\S]*objectTransform: normalizeStrandObjectTransform\(guide\.objectTransform\)[\s\S]*deformRestPoints[\s\S]*controlWorldPoints[\s\S]*meshWorldMatrix/);
  assert.match(source, /function updateGuideObjectTransform\(handle\)[\s\S]*updateCurveLatticeGeometry\(guide\)[\s\S]*updateCapsuleGuideGeometry\(guide, \{ preserveControlPoints: true \}\)[\s\S]*updateLegacyGuideObjectTransform/);
  assert.match(source, /function finishGuideObjectTransform\(\)[\s\S]*snapshot\.guide\.objectTransform = strandObjectTransformValuesAfterHandle[\s\S]*syncStrandObjectTransformPanel\(\)/);
  assert.match(source, /function serializeGuide\(guide\)[\s\S]*guide\.type === "capsule"[\s\S]*objectTransform: normalizeStrandObjectTransform\(guide\.objectTransform\)[\s\S]*guide\.type === "curve-lattice"[\s\S]*objectTransform: normalizeStrandObjectTransform\(guide\.objectTransform\)/);
  assert.match(source, /transformControls\.object\?\.userData\.guideObjectTransform[\s\S]*pushUndoState\(\)[\s\S]*beginGuideObjectTransform/);
  assert.match(source, /function refreshSelectionModeVisuals\(\)[\s\S]*viewportEditMode === "guide"[\s\S]*attachGuideObjectTransform\(\)/);
});

test("selected strands can be isolated from Ctrl+1 or the contextual radial menu", async () => {
  const [html, source, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /<kbd>Ctrl<\/kbd>[\s\S]*?<kbd>1<\/kbd>[\s\S]*?Isolate selected strands/);
  assert.match(source, /let isolatedStrandIds = null/);
  assert.match(source, /function strandVisibleForDisplay\(lock\)[\s\S]*isolatedStrandIds\.has\(lock\.id\)/);
  assert.match(source, /function toggleSelectedStrandIsolation\(\)[\s\S]*selectedLocksInOrder\(\)[\s\S]*setStrandIsolation\(selectedIds\)/);
  assert.match(source, /action: "toggle-isolate-selection"[\s\S]*strandIsolationActive\(\) \? "Exit Isolate" : "Isolate"/);
  assert.match(source, /if \(action === "toggle-isolate-selection"\) return toggleSelectedStrandIsolation\(\)/);
  assert.match(source, /event\.ctrlKey[\s\S]*event\.key === "1"[\s\S]*toggleSelectedStrandIsolation\(\)/);
  assert.match(source, /function resetTransientInteractionsForStateRestore\(\) \{\s*isolatedStrandIds = null/);
  assert.match(source, /function undoLastAction\(\)[\s\S]*restoreState\(state, \{[\s\S]*preserveIsolation: true,[\s\S]*preserveLiveSurfaces: true/);
  assert.match(source, /function redoLastAction\(\)[\s\S]*restoreState\(state, \{[\s\S]*preserveIsolation: true,[\s\S]*preserveLiveSurfaces: true/);
  assert.match(source, /function restoreState\(state,[\s\S]*preserveIsolation = false[\s\S]*isolationIdsToRestore[\s\S]*restoredIds\.length \? new Set\(restoredIds\) : null/);
  assert.match(localization, /"Isolate selected strands":[\s\S]*"Isolate Selected":[\s\S]*"Isolate":[\s\S]*"Exit Isolate":/);
});

test("Ctrl adds, Shift removes, and Alt topology gestures take priority over selection", async () => {
  const [html, source, css, localization, selectionState, projectState] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/selection-state.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/project-state.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /<h3>Selection<\/h3>[\s\S]*?<kbd>Ctrl<\/kbd>[\s\S]*?Left click \/ drag[\s\S]*?Add control points or strands to the selection/);
  assert.match(html, /<h3>Selection<\/h3>[\s\S]*?<kbd>Shift<\/kbd>[\s\S]*?Left click \/ drag[\s\S]*?Remove selected strands or control points/);
  assert.match(html, /<h3>Curves<\/h3>[\s\S]*?<kbd>Ctrl<\/kbd>[\s\S]*?<kbd>Alt<\/kbd>[\s\S]*?Left click[\s\S]*?Add a strand control point while preserving the curve/);
  assert.match(html, /<h3>Curves<\/h3>[\s\S]*?<kbd>Shift<\/kbd>[\s\S]*?<kbd>Alt<\/kbd>[\s\S]*?Left click[\s\S]*?Remove a strand control point while preserving the curve/);
  assert.match(localization, /"Add a control point or strand to the selection":/);
  assert.match(localization, /"Remove a selected strand or control point":/);
  assert.match(localization, /"Remove a strand control point while preserving the curve":/);
  assert.match(source, /let selectedStrandIds = new Set\(\)/);
  assert.match(source, /createProjectSelectionSnapshot\(\{[\s\S]*selectedStrandIds/);
  assert.match(projectState, /selectedStrandIds: \[\.\.\.selectedStrandIds\]/);
  assert.match(source, /applyStrandSelectionState\(restoreStrandSelection\(restorePlan\.strandSelection\)\)/);
  assert.match(source, /const addingSelection = event\.ctrlKey[\s\S]*const removingSelection = event\.shiftKey[\s\S]*event\.button === 0 && \(addingSelection \|\| removingSelection\)[\s\S]*beginSelectionMarquee\(event, selectedSurface, addingSelection \? "add" : "remove"\)/);
  assert.match(selectionState, /selectionMode === "add" \|\| selectionMode === "remove"[\s\S]*?const primaryId = nextIds\.has\(activeId\)[\s\S]*?selectionMode === "remove"[\s\S]*?nextIds\.delete\(id\)[\s\S]*?nextIds\.add\(id\)[\s\S]*?primaryId && nextIds\.has\(primaryId\)[\s\S]*?nextSelectedIds\[0\]/);
  assert.match(source, /selectLock\(lock\.id, \{[\s\S]*?selectionMode: event\.ctrlKey && !event\.shiftKey && !event\.altKey[\s\S]*?\? "add"[\s\S]*?event\.shiftKey && !event\.ctrlKey && !event\.altKey[\s\S]*?\? "remove"/);
  assert.match(source, /selectedStrandIds\.has\(item\.id\)/);
  assert.match(
    source,
    /function activateStrandControlPoint\(handle, event\)[\s\S]*event\.ctrlKey[\s\S]*addStrandControlPointSelection\(handle\)[\s\S]*event\.shiftKey[\s\S]*removeStrandControlPointSelection/
  );
  assert.match(
    source,
    /function addStrandControlPointSelection\(handle\)[\s\S]*selectedControlPoints\.findIndex[\s\S]*selectionIndex >= 0\) return true[\s\S]*selectedControlPoints\.push/
  );
  assert.match(
    source,
    /function removeStrandControlPointSelection\(lockId, pointIndex\)[\s\S]*selectedControlPoints\.findIndex[\s\S]*selectedControlPoints\.splice[\s\S]*refreshStrandControlPointSelection/
  );
  assert.match(
    source,
    /function prepareCurvePointSelection\(event\)[\s\S]*const removingCurvePoint = event\.shiftKey && event\.altKey[\s\S]*const insertingCurvePoint = event\.ctrlKey && event\.altKey[\s\S]*pointRemovalCandidate = \{[\s\S]*function finishPointRemoval/
  );
  assert.match(css, /\.curve-selection-add-cursor[\s\S]*%3ESelect%3C[\s\S]*\.curve-selection-remove-cursor[\s\S]*%3ESelect%3C/);
  assert.match(css, /\.curve-point-insert-cursor[\s\S]*%3EPoint%3C[\s\S]*\.curve-point-remove-cursor[\s\S]*%3EPoint%3C/);
  assert.match(source, /if \(removingCurvePoint\) \{[\s\S]*pointRemovalCandidate = \{[\s\S]*pointIndex:/);
  assert.match(
    source,
    /function resampleStrandCurveData\(lock, parameters\)[\s\S]*sampleStrandPointVectors[\s\S]*function promoteNextStrandPointToRoot\(lock\)[\s\S]*lock\.rootAttachment = createRootAttachment\(lock, promotedRoot\)[\s\S]*function finishStrandCurveTopologyChange\(lock\)[\s\S]*rebuildCurveObjects\(lock\)[\s\S]*syncActiveMirror[\s\S]*function removeStrandCurvePoint\(lockId, pointIndex\)[\s\S]*curvePointRemovalPlan\(lock\.points\.length, pointIndex\)[\s\S]*pushUndoState\(\)[\s\S]*plan\.promotedRoot[\s\S]*promoteNextStrandPointToRoot/
  );
  assert.match(source, /candidate\.selectionOnly[\s\S]*removeStrandControlPointSelection[\s\S]*removeStrandCurvePoint\(candidate\.lockId, candidate\.pointIndex\)/);
  assert.match(source, /Math\.hypot\(event\.clientX - candidate\.startX, event\.clientY - candidate\.startY\) >= 4/);
  assert.match(source, /window\.addEventListener\("pointerup", finishCurvePointInsertion, true\)[\s\S]*window\.addEventListener\("pointerup", finishPointRemoval, true\)[\s\S]*window\.addEventListener\("pointerup", endAltOrbit\)/);
  assert.match(source, /renderer\.domElement\.addEventListener\("pointerdown", prepareCurvePointSelection, true\)[\s\S]*renderer\.domElement\.addEventListener\("pointerdown", beginAltOrbit, true\)/);
  assert.match(source, /polyComponentDeleteCandidate = target[\s\S]*event\.stopImmediatePropagation\(\)/);
  assert.doesNotMatch(source, /Select strands or control points: left-click replaces the selection/);
});

test("multi-selected strands can become a clump or be deleted from selection actions", async () => {
  const [html, source, css, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="clumpContextMenu"[\s\S]*?id="createClumpFromSelectionAction"[\s\S]*?Create Clump from Selection/);
  assert.match(css, /\.strand-radial-menu button\.hidden\s*\{[\s\S]*?display:\s*none/);
  assert.match(css, /\.strand-radial-menu\[data-radial-kind="selection"\] button\s*\{[\s\S]*?width:\s*138px[\s\S]*?min-height:\s*42px/);
  assert.match(localization, /"Create Clump from Selection":/);
  assert.match(localization, /"Create clump":/);
  assert.match(localization, /"Delete Strands":/);
  assert.match(
    source,
    /function selectionCanBecomeClump\([\s\S]*?selection\.length >= 2[\s\S]*?lock\.geometryType === "strand" && !lock\.clumpId/
  );
  assert.match(
    source,
    /function createClumpFromSelection\(\) \{[\s\S]*?pushUndoState\(\)[\s\S]*?createClumpFromLocks\(selection\)[\s\S]*?clumpOpen\.set\(guide\.clumpId, false\)[\s\S]*?selectLock\(guide\.id\)/
  );
  assert.match(
    source,
    /createClumpFromSelectionAction\.classList\.toggle\("hidden", !canCreateSelectionClump\)[\s\S]*?createClumpFromSelectionAction\.addEventListener\("click"[\s\S]*?createClumpFromSelection\(\)/
  );
  assert.match(
    source,
    /if \(kind === "selection"\) \{[\s\S]*?action: "create-clump"[\s\S]*?Create clump[\s\S]*?action: "delete-selection"[\s\S]*?Delete Strands/
  );
  assert.match(source, /strandRadialMenu\.dataset\.radialKind = kind/);
  assert.match(source, /function deleteSelectedStrands\(\) \{[\s\S]*?pushUndoState\(\)[\s\S]*?deleteLocks\(selection\)/);
  assert.match(source, /if \(action === "create-clump"\) return Boolean\(createClumpFromSelection\(\)\)/);
  assert.match(source, /if \(action === "delete-selection"\) return deleteSelectedStrands\(\)/);
});

test("selection sets are created from contextual menus and recalled from the strand outliner", async () => {
  const [html, source, css, localization, projectState] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/project-state.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="createSelectionSetFromSelectedAction"[^>]*>Create Set from Selected</);
  assert.match(html, /id="addSelectedToSelectionSetAction"[^>]*>Add Selected to Set</);
  assert.match(html, /id="removeSelectedFromSelectionSetAction"[^>]*>Remove Selected from Set</);
  assert.match(source, /function createSelectionSetFromSelection\(\)[\s\S]*createSelectionSetRecord[\s\S]*pushUndoState\(\)[\s\S]*selectionSets\.push/);
  assert.match(source, /function editSelectionSetFromSelection\(selectionSetId, mode\)[\s\S]*updateSelectionSetMembers[\s\S]*pushUndoState\(\)[\s\S]*Object\.assign\(selectionSet, nextSelectionSet\)[\s\S]*selectionSets\.splice/);
  assert.match(source, /canCreateSelectionSet[\s\S]*createSelectionSetFromSelectedAction\.classList\.toggle\("hidden", !canCreateSelectionSet\)/);
  assert.match(source, /action: "create-selection-set"[\s\S]*label: "Create Set"/);
  assert.match(source, /function selectionSetRadialMenuOption\(\)[\s\S]*label: "Selection Sets"[\s\S]*selection-set-actions-submenu/);
  assert.match(source, /kind === "selection-set-actions-submenu"[\s\S]*Create Set[\s\S]*selectionSetMembershipRadialOptions\(\)/);
  assert.match(source, /function selectionSetMembershipRadialOptions\(\)[\s\S]*open-add-selection-set-dialog[\s\S]*Add to Set[\s\S]*open-remove-selection-set-dialog[\s\S]*Remove from Set/);
  assert.doesNotMatch(source, /selection-set-add-submenu|selection-set-remove-submenu/);
  assert.match(source, /if \(action === "create-selection-set"\) return Boolean\(createSelectionSetFromSelection\(\)\)/);
  assert.match(html, /id="selectionSetMembershipDialog"[\s\S]*id="selectionSetMembershipList"[\s\S]*id="cancelSelectionSetMembership"[\s\S]*id="confirmSelectionSetMembership"/);
  assert.match(source, /function openSelectionSetMembershipDialog\(mode\)[\s\S]*selectionSetCanEditFromSelection[\s\S]*selection-set-membership-option[\s\S]*selectionSetMembershipDialog\.showModal\(\)/);
  assert.match(source, /open-add-selection-set-dialog[\s\S]*openSelectionSetMembershipDialog\("add"\)[\s\S]*open-remove-selection-set-dialog[\s\S]*openSelectionSetMembershipDialog\("remove"\)/);
  assert.match(source, /selectionSetMembershipForm\.addEventListener\("submit"[\s\S]*FormData\(selectionSetMembershipForm\)[\s\S]*editSelectionSetFromSelection[\s\S]*closeSelectionSetMembershipDialog/);
  assert.match(source, /function createSelectionSetsOutlinerFolder\(\)[\s\S]*Selection Sets[\s\S]*handleOutlinerRenameClick[\s\S]*selectSelectionSet[\s\S]*type: "selection-set"/);
  assert.match(source, /function createSelectionSetsOutlinerFolder\(\)[\s\S]*selection-set-item-shell[\s\S]*createOutlinerVisibilityToggle\([\s\S]*visibleMemberCount[\s\S]*setLocksOutlinerVisibility\(memberLocks, visibleMemberCount !== memberLocks\.length\)/);
  assert.match(source, /addSelectedToSelectionSetAction\.addEventListener\("click"[\s\S]*editSelectionSetFromSelection\(selectionSetId, "add"\)[\s\S]*removeSelectedFromSelectionSetAction\.addEventListener\("click"[\s\S]*editSelectionSetFromSelection\(selectionSetId, "remove"\)/);
  assert.match(source, /function outlinerLockTargets\(target = outlinerContextTarget\)[\s\S]*target\?\.type === "selection-set"[\s\S]*selectionSet\.strandIds[\s\S]*memberIds\.has\(lock\.id\)/);
  assert.match(source, /lockOutlinerAction\.classList\.toggle\("hidden", !strand && !isSelectionSet[\s\S]*lockActionVerb[\s\S]*Strands/);
  assert.match(source, /function deleteSelectionSet\(selectionSetId\)[\s\S]*pushUndoState\(\)[\s\S]*selectionSets\.splice[\s\S]*renderLockList\(\)/);
  assert.match(source, /deleteOutlinerAction\.textContent[\s\S]*"Delete Selection Set"[\s\S]*deleteOutlinerAction\.addEventListener\("click"[\s\S]*target\?\.type === "selection-set"[\s\S]*deleteSelectionSet\(target\.selectionSetId\)/);
  assert.match(source, /selectionSets: selectionSets\.map[\s\S]*function resetEditableSceneForStateRestore[\s\S]*selectionSets\.length = 0/);
  assert.match(source, /restorePlan\.scene\.locks\.forEach[\s\S]*selectionSets\.push\(\.\.\.normalizeSelectionSets/);
  assert.match(projectState, /scene:[\s\S]*selectionSets: state\.selectionSets \|\| \[\]/);
  assert.match(css, /\.selection-set-item\.active[\s\S]*box-shadow: inset 2px 0 #53d9e6/);
  assert.match(localization, /"Create Set from Selected":[\s\S]*"Selection Sets":[\s\S]*"Lock Strands":[\s\S]*"Unlock Strands":[\s\S]*"Lock Strand":[\s\S]*"Unlock Strand":[\s\S]*"Delete Selection Set":/);
  assert.match(localization, /"Create Set":[\s\S]*"Add to Set":[\s\S]*"Remove from Set":/);
});

test("retired SDF fusion has no UI, runtime, preference, or localization entry points", async () => {
  const [html, source, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.doesNotMatch(html, /SDF|sdfStrandFusion|previewSdfFusion/);
  assert.doesNotMatch(source, /SDF|Sdf|sdf|MarchingCubes|preview-sdf-fusion/);
  assert.doesNotMatch(localization, /SDF|sdf/);
});

test("whole-clump selection exposes clump lifecycle radial actions", async () => {
  const [source, css, localization] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(
    source,
    /if \(kind === "clump"\) \{[\s\S]*?create-clump-preset[\s\S]*?Create Brush Preset[\s\S]*?dissolve-clump[\s\S]*?Dissolve clump[\s\S]*?delete-clump[\s\S]*?Delete clump/
  );
  assert.match(source, /const selectedClumpGuide = clumpViewportSelection \? clumpGuideForLock\(lock\) : null/);
  assert.match(
    source,
    /if \(action === "create-clump-preset"\)[\s\S]*?createCustomClumpPreset\(clumpGuide\)[\s\S]*?if \(action === "dissolve-clump"\)[\s\S]*?pushUndoState\(\)[\s\S]*?dissolveClump\(clumpGuide\.clumpId\)[\s\S]*?if \(action === "delete-clump"\)[\s\S]*?outlinerClumpLocks\(clumpGuide\)[\s\S]*?deleteLocks\(targets\)/
  );
  assert.match(
    source,
    /function createMirroredClump\(guide, options = \{\}\)[\s\S]*outlinerClumpLocks\(guide\)[\s\S]*sourceLocks\.some\(\(lock\) => mirrorPartnerFor\(lock\)\)[\s\S]*createMirrorPartner\(lock, \{ deferUi: true \}\)[\s\S]*createClumpFromLocks\(mirroredLocks[\s\S]*syncMirrorPartnerFromLock\(guide, mirroredGuide, \{ updateClump: false \}\)[\s\S]*updateClumpMembers\(mirroredGuide\)/
  );
  assert.match(
    source,
    /if \(kind === "clump"\)[\s\S]*clumpMirrorRadialOptions\(guide\)[\s\S]*if \(action === "mirror-clump"\)[\s\S]*createMirroredClump\(clumpGuide\)[\s\S]*if \(action === "decouple-mirrored-clump"\)[\s\S]*decoupleMirroredClump\(clumpGuide\)/
  );
  assert.match(css, /\.strand-radial-menu\[data-radial-kind="clump"\] button\s*\{[\s\S]*?width:\s*138px/);
  assert.match(localization, /"Clump actions":/);
  assert.match(localization, /"Clump":/);
});

test("selected references receive cropped visible non-raycast viewport outlines", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(css, /\.viewport-reference-frame\.selected-reference \.viewport-reference-image-clip\s*\{[\s\S]*outline:\s*1px solid #63c7ff[\s\S]*outline-offset:\s*2px/);
  assert.match(source, /reference\.cropElement\.style\.left = `[\s\S]*reference\.cropElement\.style\.width = `[\s\S]*reference\.imageElement\.style\.left = `[\s\S]*reference\.imageElement\.style\.width = `/);
  assert.match(source, /function referenceOverlayVisibleBounds\(reference\)[\s\S]*reference\?\.cropElement\?\.getBoundingClientRect/);
  assert.match(
    source,
    /function updateReferenceSelectionVisuals\(\) \{[\s\S]*classList\.toggle\("selected-reference", selected\)[\s\S]*selectionOutline\.visible = referencesVisible && reference\.visible && selected/
  );
  assert.match(source, /function updateReferenceCropHandles\(\)[\s\S]*const show = referencesVisible[\s\S]*viewportEditMode === "reference"/);
  assert.match(
    source,
    /const selectionOutline = new THREE\.LineSegments\([\s\S]*new THREE\.EdgesGeometry\(geometry\)[\s\S]*color: UI_ACCENT_COLOR[\s\S]*opacity: 0\.8[\s\S]*depthTest: false/
  );
  assert.match(source, /selectionOutline\.raycast = \(\) => \{\}/);
  assert.match(source, /function selectReferenceImage\(id\)[\s\S]*updateReferenceSelectionVisuals\(\)/);
  assert.match(
    source,
    /function disposeReferenceImageRuntime\(reference\)[\s\S]*reference\.selectionOutline\.geometry\.dispose\(\)[\s\S]*reference\.selectionOutline\.material\.dispose\(\)/
  );
});

test("viewport overlays drag and uniformly scale from corner handles", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.doesNotMatch(html, /referenceOverlayX|referenceOverlayY|referenceOverlayScale|referenceOverlayControls/);
  assert.match(source, /\["nw", "ne", "sw", "se"\]\.forEach\(\(corner\) => \{[\s\S]*reference-overlay-scale-handle/);
  assert.match(css, /\.reference-overlay-scale-handle\s*\{[\s\S]*width:\s*10px;[\s\S]*border:\s*2px solid #ffdf54/);
  assert.match(
    source,
    /function beginReferenceOverlayDrag\(event, reference\) \{[\s\S]*\["select", "move", "scale"\]\.includes\(activeTool\)[\s\S]*const mode = corner \? "scale" : "move"[\s\S]*setPointerCapture/
  );
  assert.match(
    source,
    /function setReferenceOverlayScaleHandleHover\(reference, corner = null\)[\s\S]*classList\.toggle\([\s\S]*"picker-hover"/
  );
  assert.match(css, /\.reference-overlay-scale-handle\.picker-hover\s*\{[\s\S]*border-color: #fff2aa[\s\S]*box-shadow/);
  assert.match(
    source,
    /function updateReferenceOverlayDrag\(event\) \{[\s\S]*pushUndoState\(\)[\s\S]*reference\.scale = nextScale[\s\S]*reference\.overlayScale = nextScale[\s\S]*reference\.x = THREE\.MathUtils\.clamp/
  );
  assert.match(
    source,
    /function finishReferenceOverlayDrag\(event, \{ cancel = false \} = \{\}\)[\s\S]*reference\.x = drag\.startX[\s\S]*reference\.scale = drag\.startScale/
  );
  assert.match(source, /window\.addEventListener\("pointermove", updateReferenceOverlayDrag, true\)/);
  assert.match(source, /window\.addEventListener\("pointerup", finishReferenceOverlayDrag, true\)/);
  assert.match(source, /const REFERENCE_OVERLAY_HANDLE_HIT_RADIUS = 15/);
  assert.match(
    source,
    /function referenceOverlayAtPointer\(event\) \{[\s\S]*selectedReferenceImage\(\)[\s\S]*referenceOverlayCornerAtPointer[\s\S]*return selectedReference/
  );
  assert.match(
    source,
    /Math\.abs\(event\.clientX - point\.x\) <= REFERENCE_OVERLAY_HANDLE_HIT_RADIUS[\s\S]*Math\.abs\(event\.clientY - point\.y\) <= REFERENCE_OVERLAY_HANDLE_HIT_RADIUS/
  );
});

test("duplicate placement supports ordinary copies and windowed procedural batches", async () => {
  const [source, html, css, projectState] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/project-state.js", import.meta.url), "utf8")
  ]);

  assert.match(projectState, /!duplicatePlacement\?\.lockIds\?\.includes\(lock\.id\)/);
  assert.match(source, /function beginDuplicatePlacement\(sourceOrSources\) \{[\s\S]*const undoState = snapshotState\(\)[\s\S]*mirrorPartnerId: null[\s\S]*lockIds: duplicates\.map/);
  assert.match(source, /event\.ctrlKey[\s\S]*event\.key\.toLowerCase\(\) === "d"[\s\S]*duplicateCurrentSelection\(\)/);
  assert.match(html, /id="proceduralDuplicateDialog"[\s\S]*id="proceduralDuplicateCount" type="range" min="1" max="32" step="1" value="1"[\s\S]*Confirm Duplicates/);
  assert.doesNotMatch(html, /proceduralDuplicateRootBlendEnd|Root Blend End/);
  assert.match(html, /id="proceduralDuplicateRootSink" type="range" min="0" max="1" step="0\.01" value="0"/);
  assert.match(html, /id="proceduralDuplicateSecondPointOutward" type="range" min="0" max="1" step="0\.01" value="0"/);
  assert.match(html, /id="proceduralDuplicateSecondPointTowardRoot" type="range" min="0" max="0\.95" step="0\.01" value="0"/);
  assert.match(css, /\.procedural-duplicate-count-control \.slider-input-row\s*\{[\s\S]*margin-top: 6px/);
  assert.match(css, /\.procedural-duplicate-dialog\s*\{[\s\S]*inset: 72px 372px auto auto;[\s\S]*transform: none/);
  assert.match(source, /selectedLocksInOrder\(\)\.length === 2 && selectedProceduralDuplicateSources\(\)\.length === 2[\s\S]*action: "duplicate-procedural"/);
  assert.match(source, /if \(action === "duplicate-procedural"\) return openProceduralDuplicateDialog\(\)/);
  assert.match(source, /function openProceduralDuplicateDialog\(\)[\s\S]*proceduralDuplicateWindowSourceIds[\s\S]*proceduralDuplicateDialog\.show\(\)[\s\S]*rebuildProceduralDuplicatePreview\(\)/);
  assert.match(source, /function buildEvenlySpacedProceduralDuplicates\(sources, count, undoState\)[\s\S]*evenlySpacedInteriorAmounts\(count, 32\)[\s\S]*surfaceArcPolylinePointData\([\s\S]*first\.points\[0\][\s\S]*second\.points\[0\][\s\S]*headCenter[\s\S]*count \+ 1[\s\S]*\.slice\(1, -1\)/);
  assert.match(source, /function applyProceduralDuplicateBlend[\s\S]*blendCylindricalPolylinePointData\([\s\S]*rootCorrection[\s\S]*cylindricalPoints\.map/);
  assert.match(source, /automaticRootBlendEnd = Math\.min\(1, 2 \/ lastPointIndex\)[\s\S]*rootCorrectionFalloff\([\s\S]*automaticRootBlendEnd[\s\S]*rootCorrection\.[xyz] \* correctionWeight/);
  assert.match(source, /sourcesAttached[\s\S]*bridgePointCount = Math\.min\(2, lock\.points\.length - 2\)[\s\S]*closestPointOnActiveScalp[\s\S]*signedDistance < minimumSurfaceOffset[\s\S]*addScaledVector\(normal, minimumSurfaceOffset\)/);
  assert.match(source, /secondPointOutwardDistance[\s\S]*secondPointSurfaceNormal[\s\S]*lock\.points\[1\]\.addScaledVector\(outwardNormal, secondPointOutwardDistance\)/);
  assert.match(source, /secondPointTowardRoot[\s\S]*lock\.points\[1\]\.lerp\(lock\.points\[0\], secondPointTowardRoot\)/);
  assert.match(source, /function proceduralDuplicateReferencePoints[\s\S]*lowestSharedHorizontalPolylinePointData\(first\.points, second\.points\)\?\.intersections/);
  assert.match(source, /function updateProceduralDuplicateArcPreview[\s\S]*horizontalCircleThroughPointData[\s\S]*horizontalCirclePointData[\s\S]*proceduralDuplicateCirclePreview\.visible = true/);
  assert.match(source, /function rebuildProceduralDuplicatePreview[\s\S]*previewSources = proceduralDuplicateSourceSnapshots[\s\S]*updateProceduralDuplicateArcPreview\(\{[\s\S]*blendAmount: 0\.5/);
  assert.match(source, /function clearProceduralDuplicatePreview\(\)[\s\S]*hideProceduralDuplicateArcPreview\(\)/);
  assert.match(source, /amounts\.forEach[\s\S]*restoreLock\(proceduralDuplicateCopySnapshot[\s\S]*applyProceduralDuplicateBlend\(duplicate, procedural, placedRoot, amount\)/);
  assert.match(source, /proceduralDuplicateCountInput\.addEventListener\("input"[\s\S]*rebuildProceduralDuplicatePreview\(\)/);
  assert.doesNotMatch(source, /proceduralDuplicateRootBlendEndInput|rootBlendEnd/);
  assert.match(source, /duplicate\.rootScalpOffset = THREE\.MathUtils\.clamp\([\s\S]*Number\(first\.rootScalpOffset[\s\S]*Number\(second\.rootScalpOffset[\s\S]*- rootSink/);
  assert.match(source, /proceduralDuplicateRootSinkInput,[\s\S]*proceduralDuplicateSecondPointOutwardInput,[\s\S]*proceduralDuplicateSecondPointTowardRootInput[\s\S]*rebuildProceduralDuplicatePreview\(\)/);
  assert.match(source, /function refreshStrandSelectionConsumers\([\s\S]*proceduralDuplicateDialog\.open[\s\S]*rebuildProceduralDuplicatePreview\(\{ updateSources: true \}\)/);
  assert.match(source, /function clearProceduralDuplicatePreview\(\)[\s\S]*deleteLocks\(previewLocks\)/);
  assert.match(source, /function confirmProceduralDuplicatePreview\(\)[\s\S]*undoHistory\.push\(preview\.undoState\)[\s\S]*closeProceduralDuplicateDialog\(\{ commit: true \}\)/);
  assert.match(source, /locks: projectSnapshotLocks\(locks, duplicatePlacement\)/);
  assert.match(projectState, /function projectSnapshotLocks\(locks,[\s\S]*!lock\.proceduralDuplicatePreview[\s\S]*duplicatePlacement\?\.lockId/);
  assert.match(source, /createMirrorPartnerForNewLock\(duplicate\)[\s\S]*selectedIds: createdLocks\.map\(\(lock\) => lock\.id\)/);
  assert.match(source, /function applyProceduralDuplicateBlend\(lock, procedural, placedRoot, explicitBlend = null\)/);
  assert.match(html, /<kbd>Ctrl<\/kbd>[\s\S]*<kbd>D<\/kbd>[\s\S]*Duplicate selected strands, guides, or references/);
  assert.doesNotMatch(html, /Toggle procedural duplicate mode|Alt\+D exits/);
  assert.doesNotMatch(source, /event\.altKey[\s\S]*event\.key\.toLowerCase\(\) === "d"[\s\S]*beginProceduralDuplicatePlacement/);
});

test("F cycles selected and all-scene framing while preserving view direction", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const focusBoundsSource = source.match(
    /function selectedViewportFocusBounds\(\) \{([\s\S]*?)\n\}\n\nfunction frameViewportBounds/
  )?.[1] || "";

  assert.match(focusBoundsSource, /const lock = getSelectedLock\(\)/);
  assert.match(focusBoundsSource, /const guide = getSelectedGuide\(\)/);
  assert.match(focusBoundsSource, /\[guide\.mesh, guide\.rootMesh\]/);
  assert.doesNotMatch(focusBoundsSource, /selectedReferenceImage|referenceImages/);
  assert.match(
    source,
    /function frameViewportBounds\(bounds\) \{[\s\S]*getBoundingSphere[\s\S]*camera\.position\.clone\(\)\.sub\(controls\.target\)[\s\S]*viewDirection\.normalize\(\)[\s\S]*controls\.target\.copy\(center\)/
  );
  assert.match(
    source,
    /if \(camera\.isOrthographicCamera\) \{[\s\S]*camera === orthographicCamera[\s\S]*multiCameraHalfHeight = radius \* 1\.16[\s\S]*camera\.position\.copy\(center\)\.addScaledVector\(viewDirection, currentDistance\)[\s\S]*updateCameraProjectionForViewport\(\)/
  );
  assert.match(
    source,
    /const limitingFov = Math\.min\(verticalFov, horizontalFov\)[\s\S]*Math\.sin\(limitingFov \* 0\.5\)[\s\S]*camera\.position\.copy\(center\)\.addScaledVector\(viewDirection, distance\)/
  );
  assert.match(
    source,
    /function fullSceneFocusBounds\(\) \{[\s\S]*locks\.map\(\(lock\) => lock\.mesh\)[\s\S]*guides\.flatMap\(\(guide\) => \[guide\.mesh, guide\.rootMesh\]\)[\s\S]*activeScalpSurfaceMesh\(\)[\s\S]*headMeshes\(\)[\s\S]*bounds\.expandByObject\(object, true\)/
  );
  assert.match(
    source,
    /function cycleViewportFraming\(\) \{[\s\S]*selectionKey !== viewportFrameSelectionKey[\s\S]*centerViewportOnSelectedItem\(\)[\s\S]*frameViewportBounds\(fullSceneFocusBounds\(\)\)[\s\S]*% 2/
  );
  assert.match(source, /event\.key\.toLowerCase\(\) === "f"[\s\S]*!event\.repeat[\s\S]*cycleViewportFraming\(\)/);
});

test("navigation styles isolate Anime Hair Studio and Blender viewport gestures", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /controls\.enableDamping = false;/);
  assert.match(source, /controls\.enableRotate = false;/);
  assert.match(source, /function syncNavigationModifierLocks\(\) \{\s*controls\.enablePan = navigationStyle !== "anime-hair-studio"[\s\S]*!transformPrecisionHeld && !selectionRemoveHeld/);
  assert.match(source, /event\.key === "Shift" && !event\.repeat[\s\S]*transformPrecisionHeld = true;[\s\S]*syncNavigationModifierLocks\(\)/);
  assert.match(source, /window\.addEventListener\("keyup"[\s\S]*event\.key === "Shift"[\s\S]*transformPrecisionHeld = false;[\s\S]*syncNavigationModifierLocks\(\)/);
  assert.match(source, /event\.key === "Control" && !event\.repeat[\s\S]*selectionRemoveHeld = true;[\s\S]*event\.key === "Control"[\s\S]*selectionRemoveHeld = false;/);
  assert.match(
    source,
    /function beginAltOrbit\(event\) \{[\s\S]*event\.button !== 0 \|\| !event\.altKey[\s\S]*controls\.enableRotate = true;[\s\S]*event\.preventDefault\(\);/
  );
  assert.match(source, /function beginAltOrbit\(event\) \{[\s\S]*navigationStyle !== "anime-hair-studio"/);
  assert.match(
    source,
    /function beginBlenderNavigation\(event\) \{[\s\S]*navigationStyle !== "blender" \|\| event\.button !== 1[\s\S]*event\.altKey[\s\S]*"snap"[\s\S]*event\.shiftKey[\s\S]*"pan"[\s\S]*event\.ctrlKey[\s\S]*"zoom"[\s\S]*"orbit"/
  );
  assert.match(
    source,
    /modified ROTATE binding into PAN[\s\S]*controls\.mouseButtons\.MIDDLE = action === "zoom"[\s\S]*THREE\.MOUSE\.DOLLY[\s\S]*THREE\.MOUSE\.ROTATE/
  );
  assert.match(source, /action === "snap"[\s\S]*startViewSnap\(event\.pointerId, event\.clientX, event\.clientY\)[\s\S]*stopImmediatePropagation/);
  assert.match(source, /renderer\.domElement\.addEventListener\("pointerdown", beginBlenderNavigation, true\)/);
  assert.match(source, /window\.addEventListener\("pointerup", endBlenderNavigation\)/);
  assert.match(
    source,
    /controls\.enabled = Boolean\(altOrbitDrag\) \|\| \(!toolRadialGesture[\s\S]*!duplicatePlacement/
  );
  assert.match(
    source,
    /function endAltOrbit\(event\) \{[\s\S]*altOrbitDrag = null;[\s\S]*controls\.enableRotate = false;/
  );
  assert.match(
    source,
    /function beginViewSnapFromActiveOrbit\(\) \{[\s\S]*!altOrbitDrag[\s\S]*altOrbitDrag\.pointerId !== pointer\.pointerId[\s\S]*startViewSnap\(pointer\.pointerId, pointer\.x, pointer\.y\)/
  );
  assert.match(source, /event\.key === "Shift"[\s\S]*beginViewSnapFromActiveOrbit\(\)/);
  assert.match(source, /navigationStyle === "blender"[\s\S]*event\.key === "Alt"[\s\S]*beginViewSnapFromActiveOrbit\(\)/);
  assert.match(
    source,
    /function startViewSnap\(pointerId, startX, startY\)[\s\S]*currentAxisKey: cardinalAxisKey\(startAxis\)[\s\S]*didDrag: true[\s\S]*shiftSnappedViewActive = true;[\s\S]*snapCameraToCardinalAxis\(startAxis, viewSnapDrag\.distance\)/
  );
  assert.match(source, /window\.addEventListener\("keyup"[\s\S]*event\.key === "Shift"[\s\S]*endViewSnap\(\)/);
  assert.match(source, /window\.addEventListener\("pointerup", endViewSnap\)/);
  assert.match(
    source,
    /function snapCameraToCardinalAxis\(axis, distance\)[\s\S]*const dampingEnabled = controls\.enableDamping;[\s\S]*controls\.enableDamping = false;[\s\S]*controls\.update\(\);[\s\S]*controls\.enableDamping = dampingEnabled;/
  );
  assert.match(
    source,
    /function updateViewSnap\(event\)[\s\S]*const axisKey = cardinalAxisKey\(axis\);\s*shiftSnappedViewActive = true;\s*snapCameraToCardinalAxis\(axis, viewSnapDrag\.distance\);\s*viewSnapDrag\.currentAxisKey = axisKey;/
  );
  assert.match(source, /window\.addEventListener\("pointermove", updateViewSnap, true\)/);
  assert.match(
    source,
    /function endViewSnap\(event\)[\s\S]*event\?\.preventDefault\(\);\s*\}/
  );
  assert.doesNotMatch(source, /function beginViewSnap\(event\)/);
  assert.doesNotMatch(source, /addEventListener\("pointerdown", beginViewSnap/);
  assert.match(source, /transformControls\.enabled = !toolRadialGesture && !strandRadialGesture && !duplicatePlacement && !referenceOverlayDrag && !referenceCropDrag && !altOrbitDrag/);
  assert.doesNotMatch(source, /if \(tool !== "select"\) \{\s*altOrbitDrag = null;/);
});

test("S plus left drag adjusts the active brush without starting a modeling gesture", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(
    source,
    /function activeBrushSizeInput\(\) \{[\s\S]*scalpPaintEditing[\s\S]*\["sculpt-move", "sculpt-smooth"\]\.includes\(activeTool\)[\s\S]*sculptBrushRadiusInput[\s\S]*\["draw", "radial-draw", "procedural-draw"\]\.includes\(activeTool\)[\s\S]*activeTool === "braid"[\s\S]*activeTool === "panel"/
  );
  assert.match(
    source,
    /function beginBrushSizeDrag\(event\) \{[\s\S]*!brushSizeHotkeyHeld[\s\S]*event\.button !== 0[\s\S]*event\.stopImmediatePropagation\(\);/
  );
  assert.match(
    source,
    /function updateBrushSizeDrag\(event\) \{[\s\S]*Math\.exp\(exponent\)[\s\S]*input\.dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)[\s\S]*refreshActiveBrushSizeScale\(\)/
  );
  assert.match(
    source,
    /function refreshActiveBrushSizeScale\(\) \{[\s\S]*scalpBrushCursor\.scale\.setScalar[\s\S]*setDrawStrandBrushCursorScale\(cursorScale\)/
  );
  assert.match(
    source,
    /function refreshActiveBrushSizeCursor\(event\) \{[\s\S]*\["sculpt-move", "sculpt-smooth"\]\.includes\(activeTool\)[\s\S]*updateSculptBrushCursor\(event\)/
  );
  assert.match(
    source,
    /function refreshActiveBrushSizeScale\(\) \{[\s\S]*\["sculpt-move", "sculpt-smooth"\]\.includes\(activeTool\)[\s\S]*syncSculptBrushControls\(\)/
  );
  assert.match(
    source,
    /function updateSculptBrushCursor\(event\) \{[\s\S]*brushSizeDrag\?\.input === sculptBrushRadiusInput[\s\S]*brushSizeDrag\.startX[\s\S]*brushSizeDrag\.startY[\s\S]*style\.left = `\$\{clientX - rect\.left\}px`[\s\S]*style\.top = `\$\{clientY - rect\.top\}px`/
  );
  assert.match(
    source,
    /function finishBrushSizeDrag\(event\) \{[\s\S]*const \{ pointerId, input \} = brushSizeDrag;[\s\S]*brushSizeDrag = null;[\s\S]*input === sculptBrushRadiusInput[\s\S]*updateSculptBrushCursor\(event\)/
  );
  assert.match(
    source,
    /const drawStrandBrushCursor = new THREE\.Mesh\(\s*new THREE\.RingGeometry\(0\.91, 1, 48\)/
  );
  assert.match(
    source,
    /function setDrawStrandBrushCursorScale\(scale\) \{[\s\S]*0\.09 \/ Math\.sqrt\(cursorScale\)[\s\S]*0\.05, 0\.24[\s\S]*new THREE\.RingGeometry\(1 - ringThickness, 1, 48\)[\s\S]*previousGeometry\.dispose\(\)[\s\S]*scale\.setScalar\(cursorScale\)/
  );
  assert.doesNotMatch(
    source,
    /drawStrandBrushCursor\.scale\.setScalar\((?!cursorScale\))/
  );
  assert.doesNotMatch(
    source,
    /input\.dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\);\s*refreshActiveBrushSizeCursor\(event\)/
  );
  assert.match(source, /event\.key\.toLowerCase\(\) === "s"[\s\S]*brushSizeHotkeyHeld = true/);
  assert.match(source, /renderer\.domElement\.addEventListener\("pointerdown", beginBrushSizeDrag, true\)/);
  assert.match(
    source,
    /function beginSculptMoveStroke\(event\) \{[\s\S]*!sculptBrushToolActive\(\)[\s\S]*\|\| brushSizeHotkeyHeld/
  );
  assert.match(
    source,
    /addEventListener\("pointerdown", beginBrushSizeDrag, true\);\s*renderer\.domElement\.addEventListener\("pointerdown", beginSculptMoveStroke, true\)/
  );
  assert.match(source, /controls\.enabled = [^\n]*!brushSizeDrag/);
  assert.match(source, /transformControls\.enabled = [^\n]*!brushSizeDrag/);
});

test("selected strand grab handles edit width, depth, and uniform dimensions", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(
    source,
    /const widthEdgeLines = deferInteractiveHelpers \? \[\] : \[-1, 1\]\.map\(\(side\) => \{[\s\S]*strandWidthEdge = true[\s\S]*createDimensionEdgeLines[\s\S]*depthEdgeLines = deferInteractiveHelpers \? \[\] : createDimensionEdgeLines\("depth"\)[\s\S]*uniformEdgeLines = deferInteractiveHelpers \? \[\] : createDimensionEdgeLines\("uniform"\)/
  );
  assert.match(
    source,
    /edge\.visible = lock\.id === selectedId[\s\S]*!clumpViewportSelection[\s\S]*strandWorkspaceActive\(\)[\s\S]*moveGrabHandleVisible\(dimension\)[\s\S]*\["select", "move"\]\.includes\(activeTool\)/
  );
  assert.match(
    source,
    /function beginStrandWidthEdgeDrag\(event\) \{[\s\S]*pushUndoState\(\);[\s\S]*setPointerCapture\?\.\(event\.pointerId\)[\s\S]*event\.stopImmediatePropagation\(\)/
  );
  assert.match(
    source,
    /function strandControlPointHit\(event,[\s\S]*strandControlPointHitFromEvent\(event, lock\)[\s\S]*function beginStrandWidthEdgeDrag\(event\)[\s\S]*if \(strandControlPointHit\(event, lock\)\) return;[\s\S]*raycaster\.intersectObjects\(edges, false\)/
  );
  assert.match(
    source,
    /function disposeAllEditableObjects\(\)[\s\S]*setHoveredStrandWidthEdge\(null\)[\s\S]*function beginStrandWidthEdgeDrag\(event\)[\s\S]*edge\.geometry\?\.getAttribute\("position"\)\?\.count[\s\S]*function updateStrandWidthEdgeHover\(event\)[\s\S]*edge\.geometry\?\.getAttribute\("position"\)\?\.count/
  );
  assert.match(
    source,
    /function transportedStrandWidthEdgeFrame\(lock, curve, t\)[\s\S]*strandWidthEdgeFrameAt\(lock, curve, 0\)[\s\S]*strandWidthEdgeFrameAt\(lock, curve, t \* step \/ stepCount, frame\)/
  );
  assert.match(
    source,
    /function strandWidthEdgePoints\(lock, side, dimension = "width"\)[\s\S]*let previousFrame = curve \? strandWidthEdgeFrameAt\(lock, curve, 0\)[\s\S]*strandWidthEdgeFrameAt\(lock, curve, t, previousFrame\)[\s\S]*strandWidthEdgeSample\(lock, t, side, frame, curve, dimension\)[\s\S]*previousFrame = frame/
  );
  assert.match(
    source,
    /function updateStrandWidthEdgeDrag\(event\) \{[\s\S]*nextDimension[\s\S]*dimensionDelta[\s\S]*uniformScale[\s\S]*drag\.dimension === "width"[\s\S]*applyEditableStrandWidth\(target, snapshot\.startWidth \+ dimensionDelta, snapshot\)[\s\S]*drag\.dimension === "depth"[\s\S]*setStrandDepthDimension\(target, snapshot\.startDepth \+ dimensionDelta\)[\s\S]*snapshot\.startWidth \* uniformScale[\s\S]*snapshot\.startDepth \* uniformScale[\s\S]*updateLockGeometry\(target, \{ immediate: true \}\)[\s\S]*syncInputs\(lock\)/
  );
  assert.doesNotMatch(source, /nextDimension[^\n]*drag\.side \* worldDelta/);
  assert.match(
    source,
    /lock\.geometryType === "surface"[\s\S]*drag\?\.startPoints[\s\S]*const center = drag\.startPoints\[centerIndex\][\s\S]*multiplyScalar\(ratio\)/
  );
  assert.match(
    source,
    /function finishStrandWidthEdgeDrag\(event, \{ cancel = false \} = \{\}\) \{[\s\S]*targetSnapshots\.forEach[\s\S]*Object\.assign\(target, snapshot\.startWidthState\)[\s\S]*releasePointerCapture/
  );
  assert.match(source, /window\.addEventListener\("pointermove", updateStrandWidthEdgeDrag, true\)/);
  assert.match(source, /renderer\.domElement\.addEventListener\("pointerdown", beginStrandWidthEdgeDrag, true\)/);
  assert.match(source, /controls\.enabled = [^\n]*!strandWidthEdgeDrag/);
  assert.match(source, /transformControls\.enabled = [^\n]*!strandWidthEdgeDrag/);
});

test("brush size uniformly scales strand width and depth", async () => {
  const [html, source] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8")
  ]);

  assert.match(source, /const strandCreationDefaults = \{[\s\S]*width: 0\.16,\s*depth: 0\.24,/);
  assert.match(html, /id="depthScale"[^>]*value="0\.24"[\s\S]*id="depthScaleValue"[^>]*>0\.24</);
  assert.match(
    source,
    /function activeStrokeBrushDepth\(\) \{[\s\S]*braidCreationDefaults\.braidDepth[\s\S]*panelCreationDefaults\.panelThickness[\s\S]*strandCreationDefaults\.depth/
  );
  assert.match(
    source,
    /brushSize: activeStrokeBrushSize\(\),\s*brushDepth: activeStrokeBrushDepth\(\)/
  );
  assert.match(
    source,
    /width: extensionLock\?\.width \|\| drawStrandStroke\.brushSize,\s*depth: extensionLock\?\.depth \?\? drawStrandStroke\.brushDepth/
  );
  assert.match(
    source,
    /depth: shapeTemplate && clumpTemplate[\s\S]*: stroke\.brushDepth/
  );
  assert.match(
    source,
    /drawStrandStroke\.panelThickness = drawStrandStroke\.brushDepth/
  );
});

test("Shift constrains shared draw-tool strokes to a surface-conformed eight-way direction", async () => {
  const [html, source] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8")
  ]);

  assert.match(
    source,
    /function beginDrawStrandStroke\(event,[\s\S]*event\.ctrlKey \|\| event\.altKey \|\| event\.metaKey[\s\S]*startX: event\.clientX[\s\S]*initialFreePlane/
  );
  assert.match(
    source,
    /function updateDrawStrandStroke\(event\)[\s\S]*event\.shiftKey[\s\S]*eightWayScreenDelta\([\s\S]*cardinalDirectionKey[\s\S]*drawStrokeSampleAtEvent\(stroke, sampleEvent\)/
  );
  assert.match(
    source,
    /if \(\["draw", "radial-draw", "procedural-draw", "braid", "panel"\]\.includes\(activeTool\)\) \{\s*if \(event\.ctrlKey \|\| event\.altKey \|\| event\.metaKey\) return;/
  );
  assert.match(source, /function drawStrokeSampleAtEvent\(stroke, event\)[\s\S]*drawSurfaceHitFromEvent\(event[\s\S]*drawSampleFromHit\(hit/);
  assert.match(html, /<kbd>Shift<\/kbd>[\s\S]*Draw drag[\s\S]*Draw a surface-conformed strand, braid, or panel in eight directions/);
});

test("Draw Strand creates a dedicated frame-attached branch from a selected control point", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(
    source,
    /function selectedDrawBranchPoint\(event\)[\s\S]*activeTool !== "draw"[\s\S]*canBranchDrawFromLock\(lock\)[\s\S]*strandControlPointHitFromEvent\(event, lock\)[\s\S]*pointIndex[\s\S]*curveFrameAtPoint\(lock, pointIndex\)/
  );
  assert.match(
    source,
    /function canBranchDrawFromLock\(lock\)[\s\S]*lock\?\.geometryType === "strand"[\s\S]*!lock\.clumpId \|\| lock\.clumpGuide/
  );
  assert.match(
    source,
    /const extensionLock = selectedTipContinuationLock\(event\);[\s\S]*const branchStart = extensionLock[\s\S]*selectedDrawBranchPoint\(event\)[\s\S]*beginDrawStrandStroke\(event, surfaceHit, extensionLock, branchStart\)/
  );
  assert.match(
    source,
    /function beginDrawStrandStroke\(event, hit, extensionLock = null, branchStart = null\)[\s\S]*branchSourceLockId: branchStart\?\.lock\.id \|\| null[\s\S]*branchSourcePointIndex: branchStart\?\.pointIndex \?\? null/
  );
  assert.match(
    source,
    /function attachDrawnLocksAsBranches\(stroke, created\)[\s\S]*canBranchDrawFromLock\(parent\)[\s\S]*ensureBranchParentNormalField\(parent\)[\s\S]*branchParentId = parent\.id[\s\S]*captureBranchLocalState\(lock\)[\s\S]*updateBranchChildren\(parent\)/
  );
  assert.match(
    source,
    /function updateBranchChildren\(parent\)[\s\S]*branchParentFrame\(parent, child\.branchParentParameter\)[\s\S]*point\.copy\(frame\.point\)\.add\(branchWorldVector\(local, frame\)\)[\s\S]*remapEnvelopeCurveRange\(parent\.taperCurve[\s\S]*remapEnvelopeCurveRange\(parent\.depthCurve/
  );
  assert.match(
    source,
    /branchParentId: lock\.branchParentId \|\| null[\s\S]*branchLocalPoints:[\s\S]*branchLocalSurfaceNormals:/
  );
  assert.match(
    source,
    /function beginStrandObjectTransform\(handle\)[\s\S]*selectedTargets\.filter[\s\S]*branchParentId[\s\S]*branchChildrenFor\(lock\)\.forEach\(\(child\) => previewLocks\.add\(child\)\)/
  );
  assert.match(
    source,
    /function updateStrandObjectTransform\(handle\)[\s\S]*branchChildrenFor\(lock\)\.forEach[\s\S]*applyStrandObjectPreviewMatrix\([\s\S]*child[\s\S]*worldDelta/
  );
  assert.match(
    source,
    /function commitStrandObjectTransform\(edit, handle\)[\s\S]*if \(lock\.branchParentId\)[\s\S]*enforceBranchRootPosition\(lock\)[\s\S]*captureBranchLocalState\(lock\)/
  );
  assert.match(
    source,
    /function enforceBranchRootPosition\(lock\)[\s\S]*branchParentFrame\(parent, lock\.branchParentParameter\)[\s\S]*lock\.points\[0\]\.copy\(frame\.point\)/
  );
  assert.match(
    source,
    /function updateStrandObjectTransform\(handle\)[\s\S]*lock\.branchParentId[\s\S]*worldMatrixForFixedPivot\(target\.pivot\)[\s\S]*applyStrandObjectPreviewMatrix\(lock, worldDelta, previewSnapshot\)/
  );
  assert.match(
    source,
    /function commitStrandObjectTransform\(edit, handle\)[\s\S]*const pointTransform = lock\.branchParentId \? transformPointAroundFixedPivot : transformPoint/
  );
  assert.match(
    source,
    /transformControls\.addEventListener\("objectChange"[\s\S]*enforceBranchRootPosition\(lock\)[\s\S]*syncUnifiedCurveSurfaceMirror/
  );
  assert.match(
    source,
    /function branchMoveGizmoDisabled\(\)[\s\S]*activeTool !== "move"[\s\S]*lock\?\.branchParentId[\s\S]*selectedPoint\.pointIndex === 0/
  );
  assert.match(
    source,
    /function setBranchMoveGizmoVisual\(disabled\)[\s\S]*material\._color\?\.copy[\s\S]*gizmoGroups\.translate[\s\S]*material\._color\?\.setHex\(0x7c7c84\)[\s\S]*material\._opacity = disabledOpacity/
  );
  assert.match(
    source,
    /transformControls\.enabled = [^\n]*!taperMeshPointDrag && !branchMoveDisabled[\s\S]*setBranchMoveGizmoVisual\(branchMoveDisabled\)/
  );
});

test("Procedural Draw creates a round-profile guide with editable accessories and branches", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);
  assert.match(html, /class="tool-button experimental-tool-hidden"[^>]*data-tool="procedural-draw"[^>]*title="Procedural Draw"[^>]*aria-label="Procedural Draw tool"[^>]*hidden[^>]*aria-hidden="true"[^>]*tabindex="-1"/);
  assert.match(html, /data-preference-category="experimental">Experimental<\/button>/);
  assert.match(html, /data-preference-panel="experimental"[\s\S]*id="proceduralDrawExperimentalPreference"[^>]*type="checkbox"/);
  assert.match(html, /data-preference-panel="experimental"[\s\S]*id="compoundStrandExperimentalPreference"[^>]*type="checkbox"[\s\S]*id="hairShellExperimentalPreference"[^>]*type="checkbox"[\s\S]*id="arcHairSurfaceExperimentalPreference"[^>]*type="checkbox"/);
  assert.match(html, /data-preference-panel="experimental"[\s\S]*Dev tests[\s\S]*Dev test features are not intended as functional tools and are included only for testing purposes\.[\s\S]*data-dev-test-feature[\s\S]*id="showDevTestFeaturesPreference"[^>]*type="checkbox"/);
  assert.match(html, /data-preference-panel="experimental"[\s\S]*id="multiCameraExperimentalPreference"[^>]*type="checkbox"[\s\S]*class="experimental-dev-tests"/);
  assert.doesNotMatch(html, /for="multiCameraExperimentalPreference"[^>]*data-dev-test-feature/);
  assert.match(html, /id="floatingToolSettingsPanel" class="floating-tool-settings-panel hidden"/);
  assert.match(html, /data-preference-panel="experimental"[\s\S]*for="floatingToolSettingsExperimentalPreference"[\s\S]*id="floatingToolSettingsExperimentalPreference"[^>]*type="checkbox"[\s\S]*class="experimental-dev-tests"/);
  assert.doesNotMatch(html, /for="floatingToolSettingsExperimentalPreference"[^>]*data-dev-test-feature/);
  assert.match(source, /const FLOATING_TOOL_SETTINGS_EXPERIMENTAL_PREFERENCE_KEY = "anime-hair-studio-experimental-floating-tool-settings"/);
  assert.match(source, /let floatingToolSettingsExperimentalEnabled = readStoredBooleanPreference\([\s\S]*FLOATING_TOOL_SETTINGS_EXPERIMENTAL_PREFERENCE_KEY,[\s\S]*false/);
  assert.match(source, /function syncFloatingToolSettingsPanel\(\)[\s\S]*floatingToolSettingPanels\.forEach[\s\S]*floatingToolSettingsPanel\.append\(panel\)[\s\S]*restoreFloatingToolSettingPanel\(panel\)/);
  assert.match(source, /function positionFloatingToolSettingsPanel\(\)[\s\S]*viewportEditModeControl\.getBoundingClientRect\(\)[\s\S]*dockedToolSettingsLayout\(viewportBounds, toolBounds, workspaceBounds/);
  assert.match(source, /function positionFloatingToolSettingsPanel\(\)[\s\S]*hotkeyToolSettingsExperimentalEnabled && hotkeyToolSettingsHoldActive[\s\S]*lastPointer\.x - viewportBounds\.left \+ pointerOffset[\s\S]*lastPointer\.y - viewportBounds\.top \+ pointerOffset[\s\S]*THREE\.MathUtils\.clamp/);
  assert.match(source, /function setFloatingToolSettingsExperimentalEnabled\(enabled, \{ persist = true \} = \{\}\)[\s\S]*syncFloatingToolSettingsPanel\(\)[\s\S]*FLOATING_TOOL_SETTINGS_EXPERIMENTAL_PREFERENCE_KEY/);
  assert.match(html, /for="hotkeyToolSettingsExperimentalPreference"[\s\S]*Replace tool hotkey radial menus with the floating glass settings panel while the hotkey is held\.[\s\S]*id="hotkeyToolSettingsExperimentalPreference"[^>]*type="checkbox"/);
  assert.match(html, /id="hotkeyToolSettingsKeepMainPreferenceRow"[\s\S]*Keep settings in Main tab[\s\S]*id="hotkeyToolSettingsKeepMainPreference"[^>]*type="checkbox"/);
  assert.match(source, /const HOTKEY_TOOL_SETTINGS_EXPERIMENTAL_PREFERENCE_KEY = "anime-hair-studio-experimental-hotkey-tool-settings"[\s\S]*const HOTKEY_TOOL_SETTINGS_KEEP_MAIN_PREFERENCE_KEY = "anime-hair-studio-hotkey-tool-settings-keep-main"/);
  assert.match(source, /let hotkeyToolSettingsExperimentalEnabled = readStoredBooleanPreference\([\s\S]*HOTKEY_TOOL_SETTINGS_EXPERIMENTAL_PREFERENCE_KEY,[\s\S]*false[\s\S]*let hotkeyToolSettingsKeepMain = readStoredBooleanPreference\([\s\S]*HOTKEY_TOOL_SETTINGS_KEEP_MAIN_PREFERENCE_KEY,[\s\S]*true/);
  assert.match(source, /function syncFloatingToolSettingsPanel\(\)[\s\S]*hotkeyFloatActive[\s\S]*removeHotkeySettingsFromMain[\s\S]*shouldFloat[\s\S]*shouldPark[\s\S]*floatingToolSettingsPanel\.classList\.toggle\("hidden", !visible\)/);
  assert.match(source, /function beginHotkeyToolSettingsHold\(\)[\s\S]*hotkeyToolSettingsHoldActive = true[\s\S]*syncFloatingToolSettingsPanel\(\)[\s\S]*function finishHotkeyToolSettingsHold\(\)[\s\S]*hotkeyToolSettingsHoldActive = false/);
  assert.match(source, /function beginToolShortcutPress\(key, tool\)[\s\S]*hotkeyToolSettingsExperimentalEnabled[\s\S]*beginHotkeyToolSettingsHold\(\) \? "settings"[\s\S]*beginToolRadialGesture\(\) \? "radial"[\s\S]*function finishToolShortcutPress[\s\S]*finishHotkeyToolSettingsHold\(\)[\s\S]*finishToolRadialGesture\(\)/);
  assert.match(source, /function setHotkeyToolSettingsExperimentalEnabled\(enabled,[\s\S]*hotkeyToolSettingsKeepMainPreferenceInput\.disabled = !hotkeyToolSettingsExperimentalEnabled[\s\S]*HOTKEY_TOOL_SETTINGS_EXPERIMENTAL_PREFERENCE_KEY/);
  assert.match(source, /function setHotkeyToolSettingsKeepMain\(enabled,[\s\S]*HOTKEY_TOOL_SETTINGS_KEEP_MAIN_PREFERENCE_KEY/);
  assert.match(css, /\.floating-tool-settings-panel\s*\{[\s\S]*position:\s*absolute;[\s\S]*width:\s*288px;[\s\S]*background:\s*color-mix\(in srgb, var\(--glass-panel-color, #19181d\) 82%, transparent\)/);
  assert.match(css, /\.floating-tool-settings-panel \.slider-input-row,[\s\S]*\.floating-tool-settings-panel \.slider-number-pair\.slider-input-row\s*\{[\s\S]*grid-template-columns:\s*54px minmax\(0, 1fr\) 24px/);
  assert.doesNotMatch(html, /id="showDevTestFeaturesPreference"[^>]*checked/);
  assert.match(html, /id="createCompoundStrand"[^>]*hidden[^>]*aria-hidden="true"[^>]*tabindex="-1"[\s\S]*id="createHairShell"[^>]*hidden[^>]*aria-hidden="true"[^>]*tabindex="-1"[\s\S]*id="createArcHairSurface"[^>]*hidden[^>]*aria-hidden="true"[^>]*tabindex="-1"/);
  assert.match(source, /COMPOUND_STRAND_EXPERIMENTAL_PREFERENCE_KEY[\s\S]*HAIR_SHELL_EXPERIMENTAL_PREFERENCE_KEY[\s\S]*ARC_HAIR_SURFACE_EXPERIMENTAL_PREFERENCE_KEY/);
  assert.match(source, /let compoundStrandExperimentalEnabled = readStoredBooleanPreference\([\s\S]*false[\s\S]*let hairShellExperimentalEnabled = readStoredBooleanPreference\([\s\S]*false[\s\S]*let arcHairSurfaceExperimentalEnabled = readStoredBooleanPreference\([\s\S]*false/);
  assert.match(source, /const SHOW_DEV_TEST_FEATURES_PREFERENCE_KEY = "anime-hair-studio-show-dev-test-features"[\s\S]*let showDevTestFeatures = readStoredBooleanPreference\([\s\S]*false/);
  assert.match(source, /function setExperimentalCreationCommandEnabled[\s\S]*const visible = showDevTestFeatures && selected[\s\S]*button\.hidden = !visible[\s\S]*button\.setAttribute\("aria-hidden", String\(!visible\)\)[\s\S]*button\.tabIndex = visible \? 0 : -1/);
  assert.match(source, /function setShowDevTestFeatures\(enabled[\s\S]*devTestFeaturePreferenceRows\.forEach[\s\S]*setProceduralDrawExperimentalEnabled[\s\S]*setCompoundStrandExperimentalEnabled[\s\S]*setHairShellExperimentalEnabled[\s\S]*setArcHairSurfaceExperimentalEnabled/);
  assert.match(css, /\.app-menu-dropdown button\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(source, /function setCompoundStrandExperimentalEnabled[\s\S]*function setHairShellExperimentalEnabled[\s\S]*function setArcHairSurfaceExperimentalEnabled/);
  assert.match(source, /function syncArcHairSurfaceControls\(lock = getSelectedLock\(\)\) \{[\s\S]*showDevTestFeatures[\s\S]*arcHairSurfaceExperimentalEnabled[\s\S]*lock\?\.hairShellPrimitive === "arc"[\s\S]*arcHairSurfacePanel\.classList\.toggle\("hidden", !visible\)[\s\S]*arcHairSurfacePanel\.hidden = !visible[\s\S]*aria-hidden/);
  assert.match(css, /#curveSurfaceToolPanel\.hidden,[\s\S]*#arcHairSurfacePanel\.hidden,[\s\S]*#surfaceGuideToolPanel\.hidden[\s\S]*display:\s*none/);
  assert.match(source, /function setArcHairSurfaceExperimentalEnabled\(enabled, \{ persist = true \} = \{\}\)[\s\S]*setExperimentalCreationCommandEnabled[\s\S]*syncArcHairSurfaceControls\(\)/);
  assert.match(source, /compoundStrandExperimental: compoundStrandExperimentalEnabled[\s\S]*hairShellExperimental: hairShellExperimentalEnabled[\s\S]*arcHairSurfaceExperimental: arcHairSurfaceExperimentalEnabled/);
  assert.match(source, /function createCompoundStrand\(\) \{\s*if \(!showDevTestFeatures \|\| !compoundStrandExperimentalEnabled\) return null;/);
  assert.match(source, /async function createHairShell\(\) \{\s*if \(!showDevTestFeatures \|\| !hairShellExperimentalEnabled\) return null;/);
  assert.match(source, /function createArcHairSurface\(\) \{\s*if \(!showDevTestFeatures \|\| !arcHairSurfaceExperimentalEnabled\) return null;/);
  assert.match(source, /const PROCEDURAL_DRAW_EXPERIMENTAL_PREFERENCE_KEY = "anime-hair-studio-experimental-procedural-draw"/);
  assert.match(source, /let proceduralDrawExperimentalEnabled = readStoredBooleanPreference\([\s\S]*PROCEDURAL_DRAW_EXPERIMENTAL_PREFERENCE_KEY,[\s\S]*false/);
  assert.match(source, /function setProceduralDrawExperimentalEnabled\(enabled, \{ persist = true \} = \{\}\)[\s\S]*const visible = showDevTestFeatures && proceduralDrawExperimentalEnabled[\s\S]*classList\.toggle\("experimental-tool-hidden", !visible\)[\s\S]*proceduralDrawToolButton\.hidden = !visible/);
  assert.match(css, /\.tool-button\.experimental-tool-hidden,[\s\S]*display:\s*none/);
  assert.doesNotMatch(source, /if \(tool === "procedural-draw" && \(!showDevTestFeatures \|\| !proceduralDrawExperimentalEnabled\)\) tool = "draw"/);
  assert.match(source, /brushWorkspaceTypeTabs\?\.addEventListener\("click", handleBrushWorkspaceTypeClick\)/);
  assert.match(html, /id="silhouetteVolumeExperimentalPreference"[^>]*type="checkbox"[\s\S]*id="scalpDrawExperimentalPreference"[^>]*type="checkbox"/);
  assert.match(html, /id="silhouetteVolumeToolButton"[^>]*hidden[^>]*aria-hidden="true"[^>]*tabindex="-1"/);
  assert.match(html, /id="scalpDrawToolButton"[^>]*hidden[^>]*aria-hidden="true"[^>]*tabindex="-1"/);
  assert.match(source, /tool === "silhouette-volume" && \(!showDevTestFeatures \|\| !silhouetteVolumeExperimentalEnabled\)[\s\S]*tool === "scalp-draw" && \(!showDevTestFeatures \|\| !scalpDrawExperimentalEnabled\)/);
  assert.match(source, /function setSilhouetteVolumeExperimentalEnabled[\s\S]*function setScalpDrawExperimentalEnabled/);
  assert.match(source, /silhouetteVolumeToolPanel\.classList\.toggle\([\s\S]*activeTool !== "silhouette-volume" \|\| !showDevTestFeatures \|\| !silhouetteVolumeExperimentalEnabled[\s\S]*scalpDrawToolPanel\.classList\.toggle\([\s\S]*activeTool !== "scalp-draw" \|\| !showDevTestFeatures \|\| !scalpDrawExperimentalEnabled/);
  assert.match(css, /\[data-attribute-panel="tools"\]\.hidden,[\s\S]*\[data-attribute-panel="tools"\]\[hidden\][\s\S]*display:\s*none\s*!important/);
  assert.match(source, /proceduralDrawExperimental: proceduralDrawExperimentalEnabled/);
  assert.doesNotMatch(html, /id="proceduralDrawAccessorySection"|id="proceduralAccessoryCount"|id="proceduralBranchCount"/);
  assert.match(source, /const PROCEDURAL_DRAW_DEFAULTS = Object\.freeze\([\s\S]*accessoryCount: 0[\s\S]*branchCount: 4/);
  assert.match(css, /\.procedural-draw-accessories\.hidden\s*\{\s*display:\s*none/);
  assert.match(html, /id="proceduralAccessoryEditPanel"[\s\S]*id="proceduralAccessoryEditCount"[^>]*min="0"[^>]*value="0"[\s\S]*id="proceduralAccessoryEditRadius"[\s\S]*id="proceduralAccessoryEditParentVisible"[\s\S]*id="proceduralBranchEditCount"[^>]*max="64"[\s\S]*id="proceduralBranchEditLength"[\s\S]*id="proceduralBranchEditTipOffset"/);
  assert.match(html, /id="proceduralBranchLengthCurvePreview"[\s\S]*data-curve-key="proceduralBranchLengthCurve"/);
  assert.match(html, /id="proceduralBranchShapeCurvePreview"[\s\S]*data-curve-key="proceduralBranchShapeCurve"/);
  assert.match(source, /function proceduralDrawClumpTemplate\(stroke = null\)[\s\S]*proceduralAccessoryTemplateData[\s\S]*ROUND_SWEEP_PROFILE/);
  assert.match(source, /function drawClumpStrandMaps[\s\S]*Array\.isArray\(strand\.radialOffset\)[\s\S]*parameters = centerPoints\.map[\s\S]*addScaledVector\(targetFrame\.x,[\s\S]*addScaledVector\(targetFrame\.z,/);
  assert.match(source, /function drawClumpStrandMaps[\s\S]*proceduralAccessoryTaperScale\(template\.parentShape, t, currentOffsetX, currentOffsetZ\)[\s\S]*currentOffsetX \* taperScale\.x[\s\S]*currentOffsetZ \* taperScale\.z/);
  assert.match(source, /proceduralParentHidden: Boolean\([\s\S]*isCenter[\s\S]*stroke\.proceduralBrushTemplate \|\| \(stroke\.proceduralDraw && !stroke\.proceduralParentVisible\)[\s\S]*\)/);
  assert.match(source, /function createDrawnStrand\(stroke\)[\s\S]*createClumpFromLocks\(created/);
  assert.match(source, /function syncProceduralParentVisibility\(lock\)[\s\S]*lock\.mesh\.material\.visible = !lock\.proceduralParentHidden[\s\S]*syncLockedStrandWireVisual\(lock\)/);
  assert.match(source, /function applyProceduralAccessorySettings\(guide,[\s\S]*proceduralAccessoryMapsForGuide[\s\S]*createProceduralAccessoryLock[\s\S]*setProceduralAccessoryGeometry/);
  assert.match(source, /function applyProceduralBranchSettings\(guide,[\s\S]*proceduralBranchTemplatesForGuide[\s\S]*guide\.proceduralBranchCount = normalizedCount[\s\S]*updateLockGeometry\(guide/);
  assert.match(source, /function applyTaperCurveEdit[\s\S]*proceduralBranchCurveEditing\(\)[\s\S]*guide\[curveKey\][\s\S]*updateLockGeometry\(guide, \{ immediate: true/);
  assert.match(source, /function proceduralBranchTemplatesForGuide[\s\S]*lengthCurve: guide\?\.proceduralBranchLengthCurve/);
  assert.match(source, /function proceduralBranchTemplatesForGuide[\s\S]*shapeCurve: guide\?\.proceduralBranchShapeCurve/);
  assert.match(source, /proceduralBranchLengthCurve: cloneShapePresetValue\([\s\S]*lock\.proceduralBranchLengthCurve \|\| DEFAULT_PROCEDURAL_BRANCH_LENGTH_CURVE/);
  assert.match(source, /function createHairGeometry\(lock\)[\s\S]*lock\?\.proceduralDrawGuide[\s\S]*proceduralBranchTemplatesForGuide\([\s\S]*proceduralBranchGeometryLock\(lock, template, index\)[\s\S]*mergeGeometries\(geometries, false\)/);
  assert.match(source, /function updateDrawStrandPreview\(\)[\s\S]*proceduralDrawGuide: Boolean\(drawStrandStroke\.proceduralDraw\)[\s\S]*proceduralBranchCount:[\s\S]*proceduralBranchLength:[\s\S]*proceduralBranchTipOffset:/);
  assert.match(source, /function updateClumpMembers\(guide\)[\s\S]*guide\?\.proceduralDrawGuide[\s\S]*proceduralAccessoryMapsForGuide\([\s\S]*guide,[\s\S]*count,[\s\S]*radius,[\s\S]*tipRadius,[\s\S]*rootRotation,[\s\S]*tipRotation/);
  assert.match(source, /proceduralDrawGuide: Boolean\(lock\.proceduralDrawGuide\)[\s\S]*proceduralAccessoryCount:[\s\S]*proceduralAccessoryRadius:[\s\S]*proceduralBranchCount:[\s\S]*proceduralBranchLength:[\s\S]*proceduralBranchTipOffset:/);
});

test("Style Forge is an opt-in region-seam hairstyle generator with live editable settings", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="crownGrowToolButton"[^>]*data-tool="crown-grow"[^>]*hidden[^>]*aria-hidden="true"[^>]*tabindex="-1"/);
  assert.match(html, /for="crownGrowExperimentalPreference"[\s\S]*Style Forge[\s\S]*id="crownGrowExperimentalPreference"[^>]*type="checkbox"/);
  assert.doesNotMatch(html, /for="crownGrowExperimentalPreference"[^>]*data-dev-test-feature/);
  assert.match(html, /id="crownGrowToolPanel"[\s\S]*Style Forge[\s\S]*id="crownGrowCount"[^>]*min="4"[^>]*max="64"[^>]*value="24"[\s\S]*id="crownGrowLength"[^>]*value="1\.8"[\s\S]*id="crownGrowSurfaceFollow"[^>]*value="0\.58"[\s\S]*id="crownGrowLift"[\s\S]*id="crownGrowGravity"[^>]*value="0\.82"[\s\S]*id="crownGrowSmoothing"[^>]*value="0\.72"[\s\S]*id="crownGrowRandomness"[\s\S]*id="styleForgeGenerate"/);
  assert.doesNotMatch(html, /Crown Gap|id="crownGrowRadius"|id="crownGrowSwirl"/);
  assert.match(source, /const CROWN_GROW_EXPERIMENTAL_PREFERENCE_KEY = "anime-hair-studio-experimental-crown-grow"/);
  assert.match(source, /let crownGrowExperimentalEnabled = readStoredBooleanPreference\([\s\S]*CROWN_GROW_EXPERIMENTAL_PREFERENCE_KEY,[\s\S]*false/);
  assert.match(source, /function setCrownGrowExperimentalEnabled\(enabled,[\s\S]*crownGrowToolButton\.hidden = !crownGrowExperimentalEnabled[\s\S]*activeTool === "crown-grow"/);
  assert.match(source, /function crownGrowTransportDirection[\s\S]*setFromUnitVectors[\s\S]*function crownGrowSurfaceStep[\s\S]*closestPointOnActiveScalp/);
  assert.match(source, /function crownGrowLimitDirectionTurn\([\s\S]*applyAxisAngle\(axis\.normalize\(\), maxRadians\)/);
  assert.match(source, /function crownGrowSurfaceStep\([\s\S]*heading >= Math\.cos\(THREE\.MathUtils\.degToRad\(55\)\)/);
  assert.match(source, /function styleForgeRegionBoundaryCandidates\([\s\S]*scalpTriangleRegion\(mesh, triangleIndex\)[\s\S]*first\.region === second\.region[\s\S]*targetRegion: target\.region/);
  assert.match(source, /function createStyleForgePoints\([\s\S]*crownGrowSmoothingMetrics[\s\S]*smoothing\.surfaceTurnDegrees[\s\S]*smoothing\.freeTurnDegrees/);
  assert.match(source, /const gravityReferenceDirection = freeDirection\.clone\(\)[\s\S]*gravityReferenceDirection\.clone\(\)[\s\S]*lerp\(new THREE\.Vector3\(0, -1, 0\), gravityBlend\)/);
  assert.match(source, /crownGrowGravityStrength\(settings\.gravity\)[\s\S]*const gravityTurnAuthority = 30 \* gravityStrength[\s\S]*smoothing\.freeTurnDegrees \+ gravityTurnAuthority/);
  assert.match(source, /const surfaceSteps = requestedSurfaceDistance > 0\.025[\s\S]*requestedSurfaceDistance \/ 0\.22[\s\S]*const freeSteps = freeDistance > 0\.025[\s\S]*freeDistance \/ 0\.3/);
  assert.doesNotMatch(source, /smoothing\.(?:surface|free)SegmentLength/);
  assert.match(source, /function createStyleForge\([\s\S]*selectStyleForgeRootCandidates[\s\S]*addLock\("front"[\s\S]*pointSurfaceNormals: grown\.normals/);
  assert.match(source, /function syncCrownGrowSettingsFromControls[\s\S]*regenerateCrownGrowSession/);
  assert.match(source, /styleForgeGenerateButton\.addEventListener\("click"[\s\S]*pushUndoState\(\)[\s\S]*createStyleForge/);
  assert.match(source, /crownGrowExperimental: crownGrowExperimentalEnabled/);
  assert.match(css, /\.icon-crown-grow::before,[\s\S]*\.icon-crown-grow::after/);
});

test("Procedural Brush exposes authored patterns without radial-array controls", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);
  assert.match(html, /data-tool="radial-draw"[^>]*title="Procedural Brush"[^>]*aria-label="Procedural Brush tool"/);
  assert.match(html, /id="radialDrawToolSettings"[\s\S]*id="radialDrawPatternPreset"[\s\S]*value="builtin:three-strand-braid">3 Strand Braid[\s\S]*id="radialDrawBrushSizeSlot"[\s\S]*id="radialDrawSizeCurvePreview"[\s\S]*data-curve-key="radialDrawSizeCurve"[\s\S]*id="radialDrawCurveStepSlot"[\s\S]*id="radialDrawPatternCurveStepSetting"[\s\S]*id="radialDrawPatternCurveStep"[^>]*min="0\.2"[^>]*max="2\.5"[^>]*value="0\.8"/);
  assert.match(html, /id="radialDrawEditPanel"[\s\S]*id="radialDrawEditSizeCurvePreview"[\s\S]*data-curve-key="radialDrawSizeCurve"[\s\S]*id="proceduralBrushEditSettings"[^>]*hidden[\s\S]*id="proceduralBrushEditCurveStep"[^>]*min="0\.2"[^>]*max="2\.5"[^>]*value="0\.8"/);
  assert.doesNotMatch(html, /id="radialDraw(?:Edit)?(?:Count|RootRadius|TipRadius|RootRotation|TipRotation|ArraySettings|EditPlacementSettings)"/);
  assert.match(html, /id="accessoryBrushToolSettings"[\s\S]*id="accessoryBrushPreset"[\s\S]*value="accessory-strands">Accessory Strands[\s\S]*value="radial-array">Radial Array[\s\S]*id="accessoryBrushCount"[\s\S]*id="accessoryBrushRootRadius"[\s\S]*id="accessoryBrushTipRadius"[\s\S]*id="accessoryBrushRootRotation"[\s\S]*id="accessoryBrushTipRotation"[\s\S]*id="accessoryBrushShowMain"/);
  assert.match(source, /const ACCESSORY_BRUSH_PRESETS = Object\.freeze\([\s\S]*"accessory-strands"[\s\S]*"radial-array"[\s\S]*count: 8[\s\S]*rootRadius: 0\.8[\s\S]*showMain: false/);
  assert.match(source, /function proceduralDrawClumpTemplate\(stroke = null\)[\s\S]*settings\.preset === "radial-array"[\s\S]*return radialDrawClumpTemplate\([\s\S]*radialStrandCount: settings\.count/);
  assert.equal((html.match(/data-shape-preset="taperCurve" data-shape-target="radialDrawSizeCurve"/g) || []).length, 2);
  assert.match(css, /\.icon-radial-draw::before\s*\{[^}]*background: currentColor;[^}]*mask: url\("\.\/assets\/procedural-brush-icon\.svg"\)/);
  const proceduralIcon = await readFile(new URL("../assets/procedural-brush-icon.svg", import.meta.url), "utf8");
  assert.match(proceduralIcon, /viewBox="0 0 32 32"/);
  assert.equal((proceduralIcon.match(/<path /g) || []).length, 4);
  assert.match(source, /const RADIAL_DRAW_DEFAULTS = Object\.freeze\([\s\S]*strandCount: 8[\s\S]*rootRadius: 0\.8[\s\S]*tipRadius: 0\.35[\s\S]*rootRotation: 0[\s\S]*tipRotation: 0/);
  assert.match(source, /function radialDrawClumpTemplate\(stroke = null\)[\s\S]*tipRadius:[\s\S]*rootRotation:[\s\S]*tipRotation:[\s\S]*template\.radialDraw = true/);
  assert.match(source, /function radialDrawClumpTemplate\(stroke = null\)[\s\S]*template\.radialDrawSizeCurve = cloneShapePresetValue\(sizeCurve\)[\s\S]*taperCurve: cloneShapePresetValue\(strandCreationDefaults\.taperCurve\)[\s\S]*depthCurve: cloneShapePresetValue\(strandCreationDefaults\.depthCurve\)/);
  assert.match(source, /function drawClumpStrandMaps[\s\S]*radialTipOffset[\s\S]*THREE\.MathUtils\.lerp\(offsetX, tipOffsetX, t\)[\s\S]*THREE\.MathUtils\.lerp\(offsetZ, tipOffsetZ, t\)/);
  assert.match(source, /function drawClumpStrandMaps[\s\S]*radialRootAngle[\s\S]*radialTipAngle[\s\S]*Math\.cos\(currentAngle\) \* currentRadius[\s\S]*Math\.sin\(currentAngle\) \* currentRadius/);
  assert.match(source, /function drawClumpStrandMaps[\s\S]*radialDirection:[\s\S]*new THREE\.CatmullRomCurve3\(points[\s\S]*projectOnPlane\(tangent\)[\s\S]*outward\.normalize\(\)/);
  assert.match(source, /const drawClumpTemplateMappingCache = new WeakMap\(\)[\s\S]*function drawClumpTemplateMapping\(template\)[\s\S]*sourceFrames:[\s\S]*drawClumpTemplateMappingCache\.set\(template, mapping\)/);
  assert.match(source, /function drawClumpTemplateMapping\(template\)[\s\S]*template\.proceduralBrush[\s\S]*strand\.pathParameters[\s\S]*arcLengthParameters: Boolean\(authoredParameters\)/);
  assert.match(source, /function drawClumpFrame\(curve, t, normal = null, arcLength = false\)[\s\S]*curve\.getPointAt\(t\)[\s\S]*curve\.getTangentAt\(t\)/);
  assert.match(source, /function scheduleDrawStrandPreview\(\)[\s\S]*requestAnimationFrame[\s\S]*function updateDrawStrandStroke\(event\)[\s\S]*scheduleDrawStrandPreview\(\)/);
  assert.match(source, /function applyProceduralBrushPreviewDensity\(lock, shapeTemplate = null\)[\s\S]*radialSegments = Number\(settings\.radialSegments \?\? strandCreationDefaults\.radialSegments\)[\s\S]*lengthSegments = proceduralBrushTopologySegments\([\s\S]*lock\.points\.length[\s\S]*dynamicDensity = Boolean\(settings\.dynamicDensity \?\? strandCreationDefaults\.dynamicDensity\)/);
  assert.match(source, /const hiddenProceduralParent = drawStrandStroke\.proceduralDraw[\s\S]*drawStrandVolumePreview\.visible = false[\s\S]*applyProceduralBrushPreviewDensity\(clumpPreviewLock, template\)/);
  assert.match(source, /function radialDrawRingPoints[\s\S]*new THREE\.LineLoop[\s\S]*radialRingLines/);
  assert.match(source, /radialDrawGuide: Boolean\(lock\.radialDrawGuide\)[\s\S]*proceduralAccessoryTipRadius:[\s\S]*radialDrawRootRotation:[\s\S]*radialDrawTipRotation:[\s\S]*radialDrawSizeCurve:/);
  assert.match(source, /function applyProceduralAccessorySettings\(guide, \{[\s\S]*rootRotation = 0[\s\S]*tipRotation = 0[\s\S]*guide\.proceduralAccessoryTipRadius = normalizedTipRadius[\s\S]*guide\.radialDrawRootRotation = normalizedRootRotation[\s\S]*guide\.radialDrawTipRotation = normalizedTipRotation/);
  assert.match(source, /function syncRadialDrawEditControls[\s\S]*guide\?\.proceduralBrushGuide[\s\S]*proceduralBrushEditCurveStepInput\.value/);
  assert.match(source, /function syncStrandSelectionOutline\(lock\)[\s\S]*outline\.visible = Boolean\([\s\S]*!lock\.proceduralParentHidden/);
  assert.match(source, /function syncLockedStrandWireVisual\(lock\)[\s\S]*!lock\.proceduralParentHidden[\s\S]*hairTopologyVisible/);
  assert.match(source, /function drawClumpStrandMaps[\s\S]*radialSizeScale = template\.radialDraw[\s\S]*sampleTaperCurve\([\s\S]*template\.radialDrawSizeCurve[\s\S]*x: radialSizeScale, z: radialSizeScale/);
  assert.match(source, /function drawClumpStrandMaps[\s\S]*patternSizeScale = template\.radialDrawSizeCurve[\s\S]*sampleTaperCurve\(template\.radialDrawSizeCurve, t\)[\s\S]*lateralScale \* patternSizeScale/);
  assert.match(source, /function applyTaperCurveEdit[\s\S]*editingRadialDrawSize[\s\S]*updateClumpMembers\(target\)[\s\S]*radialDrawEditSizeCurvePreview/);
  assert.match(css, /#radialDrawEditPanel\.hidden,[\s\S]*display:\s*none/);
  assert.match(css, /#drawBrushPresetRow\.hidden[\s\S]*display:\s*none/);
  assert.match(css, /#strandShapePanel\.brush-context #compoundBridgeLoopsControl,[\s\S]*#strandShapePanel\.brush-context #compoundBridgeSmoothingControl[\s\S]*display:\s*none/);
  assert.match(source, /selectedProceduralPattern = proceduralGuideForLock\(activeLock\)\?\.proceduralBrushGuide[\s\S]*patternBrushContext = viewportEditMode === "brush"[\s\S]*activeTool === "radial-draw"[\s\S]*Boolean\(selectedProceduralPattern\)[\s\S]*compoundBridgeControlsVisible = Boolean\(selectedCompound\) && !patternBrushContext[\s\S]*compoundBridgeLoopsControl\.hidden = !compoundBridgeControlsVisible[\s\S]*compoundBridgeSmoothingControl\.hidden = !compoundBridgeControlsVisible/);
  assert.match(html, /id="strandProfileLabel"[\s\S]*id="strandProfileControls"[\s\S]*id="strandWidthCurveHeading"[\s\S]*id="strandWidthCurveControls"[\s\S]*id="strandDepthCurveHeading"[\s\S]*id="strandDepthCurveControls"[\s\S]*id="strandCoilShapeControls"[\s\S]*id="strandSplitControls"/);
  assert.match(source, /const patternBrushInapplicableShapeControls = \[[\s\S]*#strandProfileLabel[\s\S]*#strandWidthCurveHeading[\s\S]*#strandDepthCurveHeading[\s\S]*#strandCoilShapeControls[\s\S]*#strandSplitControls[\s\S]*hidePatternBrushShapeControls = viewportEditMode !== "brush"[\s\S]*control\.hidden = hidePatternBrushShapeControls/);
  assert.match(css, /#strandShapePanel\.pattern-brush-context #strandProfileLabel,[\s\S]*#strandShapePanel\.pattern-brush-context #strandWidthCurveHeading,[\s\S]*#strandShapePanel\.pattern-brush-context #strandDepthCurveHeading,[\s\S]*#strandShapePanel\.pattern-brush-context #strandCoilShapeControls,[\s\S]*#strandShapePanel\.pattern-brush-context #strandSplitControls[\s\S]*display:\s*none !important/);
  assert.match(source, /function createProceduralAccessoryLock[\s\S]*surfaceNormalInfluence: guide\.radialDrawGuide \? 1/);
  assert.match(source, /const creationStroke = stroke\.radialDraw[\s\S]*surfaceNormalInfluence: 1[\s\S]*createDrawnLock\(\s*creationStroke/);
  assert.match(source, /function activeDrawClumpTemplate\(stroke = null\)[\s\S]*stroke\?\.proceduralBrushTemplate[\s\S]*return activeProceduralBrushTemplate\(\)/);
  assert.match(source, /function activeDrawClumpTemplate\(stroke = null\)[\s\S]*stroke\?\.accessoryBrushSettings \|\| activeTool === "procedural-draw"[\s\S]*return proceduralDrawClumpTemplate\(stroke\)[\s\S]*stroke\?\.radialDraw \|\| activeTool === "radial-draw"[\s\S]*return activeProceduralBrushTemplate\(\)/);
  assert.match(source, /function activeProceduralBrushCreationSettings\(\)[\s\S]*creationPresetSnapshot\(patternPlacementShapeDefaults\(\), "strand", patternPlacementBaseDefaults\)[\s\S]*function activeProceduralBrushTemplate\(\)[\s\S]*activeProceduralBrushCreationSettings\(\)[\s\S]*baseWidth: Math\.max\(0\.01, Number\(settings\.width\)[\s\S]*depth: Math\.max\(0\.01, Number\(settings\.depth\)[\s\S]*template\.radialDrawSizeCurve/);
  assert.match(source, /function proceduralBrushTemplateAndMapsForGuide[\s\S]*template\.radialDrawSizeCurve = cloneShapePresetValue\([\s\S]*guide\.radialDrawSizeCurve/);
  assert.match(source, /target\.radialDrawGuide \|\| target\.proceduralBrushGuide[\s\S]*updateClumpMembers\(target\)/);
  assert.match(source, /function shapeTargetForSelect\(select\)[\s\S]*select\.dataset\.shapeTarget === "radialDrawSizeCurve"[\s\S]*radialDrawCreationSettings/);
  assert.match(source, /function shapeTargetKeyForSelect\(select\)[\s\S]*select\.dataset\.shapeTarget \|\| select\.dataset\.shapePreset/);
  assert.match(source, /function applyShapePreset\(select\)[\s\S]*targetKey === "radialDrawSizeCurve"[\s\S]*updateClumpMembers\(target\)[\s\S]*mirroredGuide\.radialDrawSizeCurve/);
  assert.match(source, /function proceduralBrushTemplateForSamples\(template, samples\)[\s\S]*baseWidth: template\.proceduralBrushBaseStrandWidth \?\? template\.strands\?\.\[1\]\?\.width \?\? template\.baseWidth[\s\S]*depth: template\.proceduralBrushBaseStrandDepth/);
  assert.match(source, /guide\.proceduralBrushTemplateBaseWidth = guide\.proceduralBrushGuide[\s\S]*stroke\.proceduralBrushTemplate\.strands\?\.\[1\]\?\.width/);
  assert.match(source, /guide\.proceduralParentHidden = guide\.proceduralBrushGuide[\s\S]*mirroredGuide\.proceduralParentHidden = mirroredGuide\.proceduralBrushGuide[\s\S]*mirroredProceduralGuide\.proceduralParentHidden = mirroredProceduralGuide\.proceduralBrushGuide/);
  assert.match(source, /function createDrawnLock\([\s\S]*stroke\.proceduralBrushTemplate && isCenter\) lock\.name = "Curve"/);
  assert.match(source, /function syncMirrorPartnerFromLock\([\s\S]*lock\.proceduralBrushGuide\) partner\.name = "Curve"/);
  assert.match(source, /function activeProceduralBrushTemplate\(\)[\s\S]*curveStep: radialDrawPatternCurveStepInput\?\.value \?\? savedRecipe\.curveStep[\s\S]*proceduralBrushTemplateData\(recipe/);
  assert.match(source, /function syncActivePatternBrushCurveStep\([\s\S]*resetToPreset[\s\S]*recipe\.curveStep/);
  assert.match(html, /id="brushWorkspaceLayoutSettings"[\s\S]*id="radialDrawToolSettings"[\s\S]*id="drawBrushPresetRow"[\s\S]*id="drawToolSize"/);
  assert.match(html, /id="radialDrawPatternCurveStepSetting"[^>]*[\s\S]*Pattern Step[\s\S]*id="radialDrawPatternCurveStep"/);
  assert.match(source, /function syncProceduralBrushToolSettingVisibility\(\)[\s\S]*placingSavedPattern[\s\S]*radialDrawBrushSizeSlot\?\.append\(brushSizeControl\)[\s\S]*radialDrawCurveStepSlot\?\.append\(curveStepControl\)[\s\S]*brushWorkspaceStrokeSettings\.insertBefore\(brushSizeControl, smoothingControl\)[\s\S]*brushWorkspaceStrokeSettings\.insertBefore\(curveStepControl, scalpOffsetControl\)[\s\S]*curveStepControl\?\.classList\.remove\("hidden"\)/);
  assert.match(source, /function defaultProceduralBrushToolPreset\(\)[\s\S]*proceduralBrushBraidPreset\(3\)[\s\S]*name: "3 Strand Braid"/);
  assert.match(source, /function applyProceduralBrushToolPreset\(value\)[\s\S]*proceduralBrushToolPresetForValue\(value\)[\s\S]*syncActivePatternBrushCurveStep\(\{ resetToPreset: true \}\)[\s\S]*radialDrawPatternPresetInput\.addEventListener\("change"/);
  assert.doesNotMatch(source, /function applyProceduralBrushToolPreset\(value\)[\s\S]*?applyCreationPresetSnapshot\(strandCreationDefaults,[\s\S]*?\n\}/);
  assert.match(source, /radialDrawPatternCurveStepInput\?\.addEventListener\("input"[\s\S]*drawStrandStroke\?\.proceduralBrushTemplate[\s\S]*drawStrandStroke\.proceduralBrushTemplate = activeProceduralBrushTemplate\(\)[\s\S]*scheduleDrawStrandPreview\(\)/);
  assert.match(source, /function createCustomProceduralBrushPreset\(\)[\s\S]*pendingCreationPresetType = "procedural-brush"[\s\S]*proceduralBrushPattern = proceduralBrushRecipeFromControls\(\)/);
  assert.match(source, /function populateDrawBrushPresetSelect[\s\S]*filter\(\(preset\) => !preset\.value\?\.proceduralBrushPattern\)[\s\S]*function populateProceduralBrushPresetSelects[\s\S]*Saved Pattern Brushes/);
  assert.match(source, /const proceduralBrushTemplate = drawingRadial \? activeProceduralBrushTemplate\(\) : null[\s\S]*drawingRadial && !proceduralBrushTemplate\) return false[\s\S]*radialDraw: Boolean\(drawingProcedural && accessoryBrushSettings\.preset === "radial-array"\)[\s\S]*proceduralBrushTemplate,/);
  assert.match(source, /proceduralBrushName: drawingRadial[\s\S]*activeProceduralBrushPreset\?\.name[\s\S]*const clumpName = stroke\.proceduralBrushName \|\| nextClumpName\(\)[\s\S]*createClumpFromLocks\(created, \{[\s\S]*name: clumpName/);
  assert.match(source, /function createDeferredHairGeometry\(\)[\s\S]*setAttribute\("position", new THREE\.Float32BufferAttribute\(\[\], 3\)\)[\s\S]*function addLock\(presetName, overrides = \{\}, options = \{\}\)[\s\S]*options\.deferInitialGeometry === true \? createDeferredHairGeometry\(\) : createHairGeometry\(lock\)/);
  assert.match(source, /function createMirrorPartner\(lock, options = \{\}\)[\s\S]*deferUi: true,[\s\S]*deferInitialGeometry: true[\s\S]*syncMirrorPartnerFromLock\(lock, mirrored\)/);
  assert.match(source, /function createDrawnLock\([\s\S]*proceduralDrawGuide: Boolean\(stroke\.proceduralBrushTemplate && isCenter\)[\s\S]*proceduralBrushGuide: Boolean\(stroke\.proceduralBrushTemplate && isCenter\)[\s\S]*deferInitialGeometry: true/);
  assert.match(source, /guide\.proceduralBrushRecipe = guide\.proceduralBrushGuide[\s\S]*normalizeProceduralBrushRecipe\(stroke\.proceduralBrushTemplate\.proceduralBrushRecipe\)[\s\S]*guide\.proceduralBrushTemplateBaseWidth/);
  assert.match(source, /function proceduralBrushTemplateAndMapsForGuide\(guide[\s\S]*new THREE\.CatmullRomCurve3\([\s\S]*guideCurve\.getLength\(\), recipe\.curveStep[\s\S]*drawClumpStrandMaps\([\s\S]*function applyProceduralBrushCurveStep\(guide, curveStep\)[\s\S]*proceduralBrushTemplateAndMapsForGuide\(guide[\s\S]*setProceduralBrushMemberGeometry\(lock, rebuild\.maps\[index\], index\)[\s\S]*syncMirrorPartnerFromLock\(guide, mirroredGuide/);
  assert.match(source, /function updateClumpMembers\(guide\)[\s\S]*if \(guide\?\.proceduralBrushGuide\)[\s\S]*proceduralBrushTemplateAndMapsForGuide\(guide\)[\s\S]*setProceduralBrushMemberGeometry\(member, rebuild\.maps\[index\], index\)[\s\S]*return;[\s\S]*if \(guide\?\.proceduralDrawGuide\)/);
  assert.match(source, /function syncRadialDrawEditControls\([\s\S]*guide\?\.proceduralBrushGuide && guide\.proceduralBrushRecipe[\s\S]*proceduralBrushEditSettings\.classList\.toggle\("hidden", !patternVisible\)[\s\S]*proceduralBrushEditCurveStepInput\.value = String\(recipe\.curveStep\)/);
  assert.match(source, /proceduralBrushEditCurveStepInput\?\.addEventListener\("input"[\s\S]*beginRadialDrawEdit\(\)[\s\S]*updateSelectedProceduralBrushCurveStep\(\)/);
  assert.match(source, /proceduralBrushRecipe: lock\.proceduralBrushRecipe[\s\S]*proceduralBrushTemplateBaseWidth:[\s\S]*proceduralBrushStrandIndex:[\s\S]*proceduralBrushRecipe: snapshot\.proceduralBrushRecipe/);
  assert.match(source, /function createDrawnLock\([\s\S]*deferCurveHelpers: Boolean\(stroke\.proceduralBrushTemplate\)/);
  assert.match(html, /id="strandLengthSegments"[^>]*max="256"/);
  assert.match(source, /function createDrawnLock\([\s\S]*lengthSegments: stroke\.proceduralBrushTemplate[\s\S]*proceduralBrushTopologySegments\([\s\S]*points\.length/);
  assert.match(source, /function rebuildBrushWorkspacePreview\(\)[\s\S]*lengthSegments: proceduralBrushTopologySegments\(points\.length, defaults\.lengthSegments\)/);
  assert.match(source, /function createCurveObjects\(lock, options = \{\}\)[\s\S]*deferInteractiveHelpers = options\.deferInteractiveHelpers === true[\s\S]*interactiveHelpersDeferred: deferInteractiveHelpers/);
  assert.match(source, /function transportedStrandFramesAt\([\s\S]*stepDensity = Math\.max\(36[\s\S]*previousParameter = parameter[\s\S]*function curveFramesAtPoints\(lock\)/);
  assert.match(source, /function updateCurveObjects\(lock, options = \{\}\)[\s\S]*interactiveHelpersDeferred[\s\S]*rebuildCurveObjects\(lock\)[\s\S]*const pointFrames = [\s\S]*curveFramesAtPoints\(lock\)/);
  assert.match(source, /function finalizeDrawnLockSelection\(lock\)[\s\S]*interactiveHelpersDeferred[\s\S]*handles\?\.length !== lock\.points\.length/);
  assert.match(source, /function updateClumpMembers\(guide\)[\s\S]*syncLockFromCurve\(member\);\s*updateLockGeometry\(member\);/);
  assert.match(source, /function rebuildLockGeometry\(lock, options = \{\}\)[\s\S]*lock\.proceduralBrushGuide && lock\.proceduralParentHidden[\s\S]*createDeferredHairGeometry\(\)[\s\S]*createHairGeometry\(lock\)/);
  assert.doesNotMatch(source, /previewQuality/);
  assert.match(source, /created\.slice\(1\)\.forEach\(\(lock, index\) => \{[\s\S]*if \(!guide\.proceduralBrushGuide\) \{[\s\S]*lock\.proceduralAccessory = true/);
  assert.match(source, /if \(proceduralGuide && !stroke\.radialDraw && !stroke\.proceduralBrushTemplate\) \{/);
  assert.match(source, /const STRAND_TOPOLOGY_EDIT_KEYS = new Set\([\s\S]*"radialSegments"[\s\S]*"lengthSegments"[\s\S]*"dynamicDensity"[\s\S]*function proceduralBrushTopologyTargets\(lock, key\)[\s\S]*clumpDirectMembers\(lock\)/);
  assert.match(source, /const topologyTargets = lock \? proceduralBrushTopologyTargets\(lock, key\) : null[\s\S]*targets: dimensionTargets \|\| topologyTargets/);
  assert.match(source, /strandDynamicDensityInput\.addEventListener\("change"[\s\S]*targets: proceduralBrushTopologyTargets\(lock, "dynamicDensity"\)/);
  assert.match(source, /\["draw", "radial-draw", "procedural-draw", "braid", "panel"\]\.includes\(activeTool\)/);
});

test("Draw Strand keeps the authored creation profile across standard, coil, and clump brushes", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const previewStart = source.indexOf("function updateDrawStrandPreview()");
  const previewEnd = source.indexOf("\n}\n\nfunction beginDrawStrand", previewStart) + 2;
  const previewSource = source.slice(previewStart, previewEnd);
  const createStart = source.indexOf("function createDrawnLock(");
  const createEnd = source.indexOf("\n}\n\nfunction createDrawnStrand", createStart) + 2;
  const createSource = source.slice(createStart, createEnd);
  const extendStart = source.indexOf("function extendDrawnStrand(");
  const extendEnd = source.indexOf("\n}\n\nfunction finishDrawStrandStroke", extendStart) + 2;
  const extendSource = source.slice(extendStart, extendEnd);

  assert.match(previewSource, /sweepProfile: extensionLock\?\.sweepProfile \|\| defaults\.sweepProfile/);
  assert.doesNotMatch(previewSource, /curlEnabled \? ROUND_SWEEP_PROFILE/);
  assert.doesNotMatch(previewSource, /clumpTemplate\.sweepProfile \|\| previewLock\.sweepProfile/);
  assert.match(createSource, /sweepProfile: cloneShapePresetValue\(setting\("sweepProfile", strandCreationDefaults\.sweepProfile\)\)/);
  assert.doesNotMatch(createSource, /ROUND_SWEEP_PROFILE|clumpTemplate\?\.sweepProfile/);
  assert.doesNotMatch(extendSource, /lock\.sweepProfile = cloneShapePresetValue\(ROUND_SWEEP_PROFILE\)/);
});

test("viewport draw settings expose live surface and creation layer outside setup editors", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /id=["']viewportDrawSettings["'][\s\S]*?id=["']drawStrandSurface["']/);
  assert.match(html, /id=["']drawStrandSurface["'][\s\S]*?<option value=["']head["'] selected>Head Mesh<\/option>[\s\S]*?<option value=["']contextual-plane["']>Contextual 2D Plane<\/option>/);
  assert.match(html, /id="drawSurfaceDynamic"[^>]*aria-pressed="true"[^>]*aria-label="Dynamic live surface"[^>]*><span class="tool-icon icon-dynamic-surface" aria-hidden="true"><\/span><\/button>/);
  assert.match(css, /\.viewport-draw-settings \.viewport-dynamic-toggle\s*\{[^}]*min-height:\s*36px;[^}]*padding:\s*0 10px;[^}]*text-transform:\s*uppercase/);
  assert.match(css, /\.viewport-draw-settings \.viewport-dynamic-toggle\[aria-pressed="true"\]\s*\{[^}]*background:\s*#1d3040;[^}]*color:\s*#a8e1ff/);
  assert.doesNotMatch(css, /\.viewport-dynamic-toggle input/);
  assert.doesNotMatch(html, /id=["'](?:braidSurface|panelSurface|curveSurfaceSurface)["']/);
  assert.doesNotMatch(html, /Head Mesh \+ Contextual 2D|Conform to Head Mesh/);
  assert.match(html, /id=["']viewportDrawSettings["'][\s\S]*?id=["']viewportDrawLayer["']/);
  assert.match(html, /id=["']viewportDrawLayer["'][\s\S]*?<option value=["']bottom["']>Bottom<\/option>/);
  assert.match(html, /id=["']viewportDrawLayer["'][\s\S]*?<option value=["']accent["']>Accent<\/option>/);
  assert.match(source, /drawSettingsVisible = !scalpBuilderEditing[\s\S]*?!headSetupEditing[\s\S]*?!capsuleGuideEditing/);
  assert.match(source, /viewportDrawSettings\.classList\.toggle\(["']hidden["'], !drawSettingsVisible\)/);
  assert.match(source, /strandCreationDefaults\.hairLayer = layerId/);
  assert.match(
    source,
    /function refreshLiveSurfaceOptions\(\) \{[\s\S]*data-live-surface-guides[\s\S]*appendGroup\([\s\S]*"Guides"[\s\S]*"liveSurfaceGuides"/
  );
  assert.match(
    source,
    /const surfaceGuides = guides\.filter\(guideSupportsLiveSurface\);[\s\S]*value: `guide:\$\{guide\.id\}`/
  );
  assert.match(
    source,
    /function refreshLiveSurfaceOptions\(\) \{[\s\S]*locks\.filter\(\(lock\) => lock\.liveSurfaceGuide\)[\s\S]*data-live-surface-strands[\s\S]*appendGroup\([\s\S]*"Strand Guides"[\s\S]*"liveSurfaceStrands"/
  );
  assert.match(
    source,
    /function refreshLiveSurfaceOptions\(\) \{[\s\S]*currentDynamicOptions[\s\S]*optionsChanged[\s\S]*document\.activeElement === select[\s\S]*liveSurfaceRefreshPending/
  );
  assert.match(
    source,
    /drawStrandSurfaceInput\.addEventListener\("blur"[\s\S]*liveSurfaceRefreshPending[\s\S]*requestAnimationFrame\(refreshLiveSurfaceOptions\)/
  );
  assert.doesNotMatch(source, /Strands \+ Contextual 2D/);
  assert.match(source, /function activeStrokeSurfaceInput\(\) \{\s*return drawStrandSurfaceInput;\s*\}/);
  assert.match(source, /function activeStrokeSurfaceValue\(\) \{\s*return activeStrokeSurfaceInput\(\)\.value;\s*\}/);
  assert.match(source, /function activeStrokeDynamicEnabled\(surfaceMode = activeStrokeSurfaceValue\(\)\)[\s\S]*surfaceMode !== "contextual-plane" && drawSurfaceDynamicEnabled\(\)/);
  assert.match(source, /function drawSurfaceDynamicEnabled\(\)[\s\S]*aria-pressed[\s\S]*function setDrawSurfaceDynamicEnabled\(enabled\)/);
  assert.match(source, /function handleLiveSurfaceChange\(\)[\s\S]*finishDrawStrandStroke[\s\S]*drawSurfaceDynamicButton\.disabled = activeStrokeSurfaceValue\(\) === "contextual-plane"[\s\S]*drawStrandSurfaceInput\.addEventListener\("change", handleLiveSurfaceChange\)[\s\S]*drawSurfaceDynamicButton\.addEventListener\("click"[\s\S]*drawSurfaceDynamicButton\.addEventListener\("change", handleLiveSurfaceChange\)/);
  assert.match(
    source,
    /function captureLiveSurfaceHistoryState\(\) \{[\s\S]*surface: activeStrokeSurfaceValue\(\)[\s\S]*dynamic: drawSurfaceDynamicEnabled\(\)[\s\S]*strandGuideStates: new Map/
  );
  assert.match(
    source,
    /function restoreLiveSurfaceHistoryState\(historyState\) \{[\s\S]*lock\.liveSurfaceGuide = historyState\.strandGuideStates\.get\(lock\.id\)[\s\S]*refreshLiveSurfaceOptions\(\)[\s\S]*input\.value = historyState\.surface[\s\S]*setDrawSurfaceDynamicEnabled\(historyState\.dynamic\)[\s\S]*handleLiveSurfaceChange\(\)/
  );
  assert.match(
    source,
    /function restoreState\(state,[\s\S]*preserveLiveSurfaces = false[\s\S]*captureLiveSurfaceHistoryState\(\)[\s\S]*restoreLiveSurfaceHistoryState\(liveSurfaceStateToRestore\)/
  );
  assert.doesNotMatch(source, /curveSurfaceSurfaceInput|braidSurfaceInput|panelSurfaceInput|synchronizeLiveSurfaceInputs/);
  assert.match(source, /if \(\["draw", "radial-draw", "procedural-draw", "braid", "panel", "surface-loft"\]\.includes\(tool\)\) return activeStrokeSurfaceValue\(\) !== "contextual-plane"/);
  assert.match(source, /surface: activeStrokeSurfaceValue\(\)/);
  assert.match(source, /dynamicSurface: drawSurfaceDynamicEnabled\(\)/);
  assert.match(source, /input\.dataset\.booleanControl === "true"[\s\S]*setDrawSurfaceDynamicEnabled\(Boolean\(value\)\)/);
});

test("References workspace exposes persistent grease pencil drawing controls", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /id=["']greasePencilTool["'][^>]*data-tool=["']grease-pencil["']/);
  assert.match(html, /id=["']referenceShapeTool["'][^>]*data-tool=["']reference-shape["']/);
  assert.match(html, /id=["']referenceShapeBackground["'][^>]*class=["']reference-shape-background["']/);
  assert.match(html, /id=["']greasePencilLayer["'][\s\S]*value=["']background["'][\s\S]*value=["']front["'][\s\S]*value=["']left["'][\s\S]*value=["']right["'][\s\S]*value=["']back["']/);
  assert.match(html, /id=["']greasePencilToolPanel["'][^>]*data-attribute-panel=["']tools["'][\s\S]*id=["']greasePencilColor["'][^>]*type=["']color["']/);
  assert.match(html, /id=["']greasePencilColor["'][^>]*hidden[\s\S]*id=["']greasePencilEyedropper["']/);
  assert.match(html, /id=["']greasePencilEyedropper["'][^>]*aria-label=["']Pick a colour from the viewport["']/);
  assert.match(html, /id=["']greasePencilEyedropperMagnifier["'][\s\S]*id=["']greasePencilEyedropperPixels["']/);
  assert.match(html, /id=["']greasePencilToolPanel["'][^>]*data-attribute-panel=["']tools["'][\s\S]*id=["']greasePencilInlineColorPicker["'][\s\S]*id=["']greasePencilSize["'][\s\S]*id=["']greasePencilSmoothing["']/);
  assert.match(html, /id=["']greasePencilEraser["'][^>]*aria-pressed=["']false["']/);
  assert.match(source, /const referenceToolAllowed = \["select", "move", "scale", "grease-pencil", "reference-shape"\]/);
  assert.match(source, /greasePencilStrokes: greasePencilStrokes\.map/);
  assert.match(source, /restorePlan\.scene\.greasePencilStrokes\.forEach/);
  assert.match(source, /greasePencilToolPanel\.classList\.toggle\([\s\S]*viewportEditMode !== "reference" \|\| !\["grease-pencil", "reference-shape"\]\.includes\(activeTool\)/);
  assert.match(source, /color: normalizeGreasePencilColor\(greasePencilColorInput\.value\)[\s\S]*size: normalizeGreasePencilSize\(greasePencilSizeInput\.value\)[\s\S]*smoothing: normalizeGreasePencilSmoothing\(greasePencilSmoothingInput\.value\)/);
  assert.match(source, /function greasePencilDisplayPoints\(stroke\)[\s\S]*stroke\.smoothing[\s\S]*function updateGreasePencilRuntime\(stroke\)[\s\S]*stroke-width[\s\S]*THREE\.TubeGeometry[\s\S]*stroke\.size/);
  assert.match(source, /function ensureGreasePencilPanel\(layer\)[\s\S]*grease-panel-\$\{normalizedLayer\}[\s\S]*greasePencilLayer: normalizedLayer/);
  assert.match(source, /function addReferenceImage\(snapshot,[\s\S]*const drawingLayer = snapshot\.greasePencilLayer[\s\S]*greasePencilPanelForLayer\(drawingLayer\)[\s\S]*return existingDrawingPanel/);
  assert.match(source, /function restoreGreasePencilStroke\(snapshot,[\s\S]*savedPanelExists[\s\S]*!stroke\.panelId \|\| !savedPanelExists[\s\S]*stroke\.panelId = panel\?\.id \|\| null/);
  assert.match(source, /const drawingPanel = Boolean\(reference\.greasePencilLayer\);[\s\S]*colorWrite: !drawingPanel/);
  assert.match(source, /reference\.mesh\.material\.opacity = drawingPanel \? 0 : reference\.opacity;[\s\S]*reference\.mesh\.material\.colorWrite = !drawingPanel/);
  assert.match(source, /reference\.imageElement\.style\.opacity = reference\.greasePencilLayer[\s\S]*\? "0"[\s\S]*: String\(reference\.opacity\)/);
  assert.match(source, /function mirroredGreasePencilPoint\([\s\S]*worldPoint\.x \*= -1/);
  assert.match(source, /function beginReferenceShape\([\s\S]*operation: event\.shiftKey \? "trim" : "add"/);
  assert.match(source, /function readGreasePencilViewportPixels\([\s\S]*gl\.readPixels\([\s\S]*function refreshGreasePencilEyedropperFromRenderedFrame\([\s\S]*renderer\.render\(scene, camera\);[\s\S]*refreshGreasePencilEyedropperFromRenderedFrame\(\)/);
  assert.match(source, /function commitGreasePencilEyedropper\([\s\S]*renderer\.render\(scene, camera\);[\s\S]*dispatchEvent\(new Event\("change"/);
  assert.doesNotMatch(source, /window\.EyeDropper/);
  assert.match(source, /function drawReferenceShapePath\([\s\S]*destination-out[\s\S]*globalAlpha = stroke\.operation === "trim" \? 1 : 0\.5/);
  assert.match(source, /referenceImagePanel\.classList\.add\("panel-section", "reference-image-panel-docked"\)[\s\S]*attributeEditorContent\.prepend\(referenceImagePanel\)/);
  assert.match(source, /greasePencilLayer: reference\.greasePencilLayer \|\| null/);
  assert.match(css, /\.grease-pencil-background path\s*\{[\s\S]*stroke-linecap: round/);
  assert.match(css, /\.reference-shape-background\s*\{[\s\S]*pointer-events:\s*none/);
  assert.match(css, /\.tool-icon\.icon-grease-pencil::before\s*\{[\s\S]*rotate\(38deg\) scale\(0\.72\)/);
  assert.match(css, /\.tool-icon\.icon-reference-shape::before\s*\{[\s\S]*left:\s*50%;[\s\S]*top:\s*50%;[\s\S]*translate\(-50%, -50%\) rotate\(-8deg\) scale\(0\.72\)/);
  assert.match(css, /\.reference-image-panel\.reference-image-panel-docked\s*\{[\s\S]*position:\s*static/);
  assert.match(css, /\.grease-pencil-eyedropper-magnifier\s*\{[\s\S]*width:\s*84px[\s\S]*\.grease-pencil-eyedropper-magnifier canvas\s*\{[\s\S]*width:\s*84px[\s\S]*image-rendering:\s*pixelated/);
  assert.match(source, /function positionGreasePencilEyedropperMagnifier\(event\)[\s\S]*const magnifierWidth = 84;[\s\S]*const magnifierHeight = 108;/);
});

test("color controls use the in-app picker with a viewport grease pencil eyedropper", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="appColorPicker"[\s\S]*id="appColorSaturation"[\s\S]*id="appColorHue"[\s\S]*id="appColorHex"[\s\S]*id="confirmAppColorPicker"/);
  assert.match(source, /function openAppColorPicker\(target\)[\s\S]*positionAppColorPicker\(target\)/);
  assert.match(source, /const appColorPickerHome = appColorPicker\.parentElement[\s\S]*function closeAppColorPicker[\s\S]*appColorPickerHome\.insertBefore\(appColorPicker, appColorPickerHomeNextSibling\)/);
  assert.match(source, /function positionAppColorPicker\(target\)[\s\S]*target\.closest\("dialog\[open\]"\)[\s\S]*boundary\.right - pickerBounds\.width[\s\S]*boundary\.bottom - margin/);
  assert.match(source, /function openAppColorPicker\(target\)[\s\S]*target\.closest\("dialog\[open\]"\)[\s\S]*pickerHost\.append\(appColorPicker\)[\s\S]*positionAppColorPicker\(target\)/);
  assert.match(source, /document\.querySelectorAll\('input\[type="color"\]:not\(#greasePencilColor\)'\)\.forEach[\s\S]*event\.preventDefault\(\)[\s\S]*openAppColorPicker\(input\)/);
  assert.match(source, /function applyAppColorPickerValue\(\)[\s\S]*dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/);
  assert.match(css, /\.app-color-picker\s*\{[\s\S]*position:\s*fixed[\s\S]*z-index:\s*1400/);
  assert.match(html, /id="greasePencilToolPanel"[\s\S]*id="greasePencilInlineColorPicker"[\s\S]*id="greasePencilColorSaturation"[\s\S]*id="greasePencilColorHue"[\s\S]*id="greasePencilColorHex"/);
  assert.match(source, /bindInlineAppColorPicker\(\{[\s\S]*target:\s*greasePencilColorInput[\s\S]*saturation:\s*greasePencilColorSaturation[\s\S]*hue:\s*greasePencilColorHue/);
  assert.match(source, /function bindInlineAppColorPicker\([\s\S]*saturation\.style\.backgroundColor = `hsl\(\$\{hueValue\} 100% 50%\)`[\s\S]*saturationValue = horizontal;[\s\S]*brightnessValue = 1 - vertical/);
  assert.match(source, /greasePencilColorInput\.addEventListener\("pointerdown", \(event\) => event\.preventDefault\(\)\)/);
  assert.match(source, /greasePencilEyedropperButton\.addEventListener\("click"[\s\S]*setGreasePencilEyedropperActive/);
  assert.match(css, /\.inline-app-color-picker\s*\{[\s\S]*display:\s*grid/);
  assert.match(html, /id="greasePencilColorSaturation" class="app-color-saturation inline-app-color-square"/);
  assert.match(css, /\.inline-app-color-square\s*\{[\s\S]*width:\s*min\(156px, 100%\)[\s\S]*aspect-ratio:\s*1/);
});

test("project restore preserves authored strand and braid points while presets may remap attachments", async () => {
  const [source, projectState] = await Promise.all([
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/project-state.js", import.meta.url), "utf8")
  ]);
  const refreshStart = source.indexOf("function refreshLoadedRootAttachmentsOnAuthoredScalp()");
  const refreshEnd = source.indexOf("\n}\n\nfunction createRootAttachment", refreshStart) + 2;
  const refreshSource = source.slice(refreshStart, refreshEnd);

  assert.match(projectState, /function createProjectRestorePlan\(state,[\s\S]*counters:[\s\S]*visibility:[\s\S]*resources:[\s\S]*scene:[\s\S]*strandSelection:[\s\S]*selection:/);
  assert.match(source, /function restoreSharedStateForStateRestore\(state, restorePlan,[\s\S]*restorePlan\.selection\.point/);
  assert.match(source, /function restoreSceneCollectionsForStateRestore\(restorePlan,[\s\S]*restorePlan\.scene\.locks\.forEach[\s\S]*restorePlan\.scene\.guides\.forEach/);
  assert.match(source, /function restoreState\(state,[\s\S]*const restorePlan = createProjectRestorePlan\(state,[\s\S]*restoreSharedStateForStateRestore\(state, restorePlan[\s\S]*restoreSceneCollectionsForStateRestore\(restorePlan/);

  assert.match(
    source,
    /restoreLock\(snapshot,\s*\{\s*deferRootAttachment:\s*deferRootAttachments,\s*remapRootAttachment:\s*preservePlacement\s*\}\)/
  );
  assert.match(
    source,
    /rootAttachmentFromData\(snapshot\.rootAttachment \|\| null,\s*lock,\s*\{\s*resolveSurface:\s*remapRootAttachment\s*\}\)/
  );
  assert.match(source, /if \(remapRootAttachment\) applyRootAttachmentLocalCurves\(lock\)/);
  assert.notEqual(refreshStart, -1);
  assert.match(refreshSource, /createRootAttachment\(lock,\s*sourcePoint\)/);
  assert.match(refreshSource, /syncRootAttachmentMetadata\(lock\)/);
  assert.doesNotMatch(refreshSource, /applyRootAttachmentLocalCurves/);
});

test("strand width and depth curve editors expose draggable viewport mesh points", async () => {
  const [html, source, css, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(
    html,
    /id="taperMeshPointsToggleRow"[\s\S]*Show points on mesh[\s\S]*id="taperMeshPointsToggle"/
  );
  assert.match(
    html,
    /id="taperCurveSecondaryPath"[\s\S]*id="taperCurveCenterLine"[\s\S]*Asymmetric curve[\s\S]*id="taperAsymmetryToggle"/
  );
  assert.match(
    html,
    /id="centerAsymmetricProfileRow"[\s\S]*Center asymmetric profile[\s\S]*id="centerAsymmetricProfile"/
  );
  assert.match(
    html,
    /class="profile-dialog-actions taper-curve-actions"[\s\S]*id="addTaperPoint"[\s\S]*class="taper-toggle-stack"[\s\S]*id="taperAsymmetryToggle"[\s\S]*id="taperMeshPointsToggle"/
  );
  assert.doesNotMatch(html, /id="taperCurveSide"/);
  assert.match(html, /styles\.css\?v=\d{8}-\d+/);
  assert.match(html, /app\.js\?v=\d{8}-\d+/);
  assert.match(source, /localization\.js\?v=20260904-1/);
  assert.match(source, /new THREE\.SphereGeometry\(0\.016, 12, 8\)/);
  assert.match(source, /color: 0xe62bea/);
  assert.match(
    source,
    /const taperMeshPointCenterMaterial = new THREE\.MeshBasicMaterial\(\{[\s\S]*color: 0xffffff[\s\S]*center\.scale\.setScalar\(0\.46\)/
  );
  assert.match(
    source,
    /taperMeshPointsVisible && \["draw", "radial-draw", "procedural-draw", "braid", "panel"\]\.includes\(activeTool\)[\s\S]*setActiveTool\("select"\)/
  );
  assert.match(
    source,
    /function rebuildLockGeometry\(lock, options = \{\}\)[\s\S]*taperMeshPointsGroup\.visible && lock\.id === selectedId[\s\S]*updateTaperMeshPoints\(\)/
  );
  assert.match(
    source,
    /function beginStrandObjectTransform\(handle\)[\s\S]*taperPreviewLockId[\s\S]*taperMeshPointsPreview:[\s\S]*mesh: taperMeshPointsGroup[\s\S]*function updateStrandObjectTransform\(handle\)[\s\S]*taperMeshPointsPreview\?\.lockId === lock\.id[\s\S]*mesh: taperMeshPointsGroup[\s\S]*function finishStrandObjectTransform\(\)[\s\S]*restoreStrandObjectPreviewMeshes\(edit\)[\s\S]*commitStrandObjectTransform/
  );
  assert.match(
    source,
    /function releaseTaperCurveEditorFieldFocus\(\)[\s\S]*taperCurveEditor\.contains\(focused\)[\s\S]*tag === "input"[\s\S]*focused\.blur\(\)[\s\S]*taperCurveCanvas\.addEventListener\("pointerdown"[\s\S]*releaseTaperCurveEditorFieldFocus\(\)[\s\S]*function beginTaperMeshPointDrag\(event\)[\s\S]*releaseTaperCurveEditorFieldFocus\(\)/
  );
  assert.match(source, /sampleAsymmetricTaperCurve/);
  assert.match(
    source,
    /function selectionModifierCursorAvailable\(\)[\s\S]*strandWorkspaceActive\(\)[\s\S]*\["select", "move", "rotate", "scale", "relax", "poly"\]\.includes\(activeTool\)[\s\S]*!altOrbitDrag/
  );
  assert.match(source, /function updateCurvePointTopologyCursor\(event\)/);
  assert.match(
    source,
    /function updateCurvePointTopologyCursor\(event\)[\s\S]*const marqueeAdding = selectionMarqueeDrag\?\.selectionMode === "add"[\s\S]*const marqueeRemoving = selectionMarqueeDrag\?\.selectionMode === "remove"[\s\S]*const addingSelection[\s\S]*event\.ctrlKey && !event\.shiftKey && !event\.altKey && selectionAvailable[\s\S]*const removingSelection[\s\S]*event\.shiftKey && !event\.ctrlKey && !event\.altKey && selectionAvailable[\s\S]*const insertingPoint[\s\S]*event\.ctrlKey[\s\S]*event\.altKey[\s\S]*const removingPoint[\s\S]*event\.shiftKey[\s\S]*event\.altKey/
  );
  assert.match(
    source,
    /function beginSelectionMarquee\([\s\S]*selectionMarquee\.classList\.add\("hidden"\);[\s\S]*updateCurvePointTopologyCursor\(event\);[\s\S]*function finishSelectionMarquee\([\s\S]*selectionMarqueeDrag = null;[\s\S]*updateCurvePointTopologyCursor\(event\);/
  );
  assert.match(source, /"curve-point-insert-cursor"/);
  assert.match(source, /"curve-point-remove-cursor"/);
  assert.match(source, /window\.addEventListener\("keydown", updateCurvePointTopologyCursor, true\)/);
  assert.match(source, /window\.addEventListener\("keyup", \(event\) => \{[\s\S]*updateCurvePointTopologyCursor\(event\)/);
  assert.match(css, /canvas\.curve-point-insert-cursor[\s\S]*M27 18\.5v8[\s\S]*%3EPoint%3C/);
  assert.match(css, /canvas\.curve-point-remove-cursor[\s\S]*M23 22\.5h8[\s\S]*%3EPoint%3C/);
  assert.match(
    source,
    /taperCurveSecondary[\s\S]*depthCurveSecondary[\s\S]*asymmetricWidthCurve[\s\S]*asymmetricDepthCurve/
  );
  assert.match(source, /centerAsymmetricProfile:\s*false/);
  assert.match(
    source,
    /taperAsymmetryToggle\.addEventListener\("change"[\s\S]*target\[taperSecondaryKey\(\)\] = cloneShapePresetValue/
  );
  assert.match(
    source,
    /centerAsymmetricProfileToggle\.addEventListener\("change"[\s\S]*target\.centerAsymmetricProfile = centerAsymmetricProfileToggle\.checked/
  );
  assert.match(
    source,
    /function renderTaperCurveEditor\(\)[\s\S]*visibleCurves[\s\S]*handle\.dataset\.curveSide = side/
  );
  assert.match(
    source,
    /function refreshTaperCurveEditorAfterStateRestore\(\)[\s\S]*activeTaperTarget\(\)[\s\S]*taperCurveEdit\.selectedIndex = THREE\.MathUtils\.clamp[\s\S]*renderTaperCurveEditor\(\)/
  );
  assert.match(
    source,
    /function retargetOpenTaperCurveEditor\(lock\)[\s\S]*taperCurveEditor\.open[\s\S]*proceduralGuideForLock\(lock\)[\s\S]*taperCurveEdit\.id = nextTarget\.id[\s\S]*updateTaperCurveEditorTargetLabel\(\)[\s\S]*refreshTaperCurveEditorAfterStateRestore\(\)/
  );
  assert.match(
    source,
    /function refreshStrandSelectionConsumers\([\s\S]*const lock = getSelectedLock\(\);[\s\S]*retargetOpenTaperCurveEditor\(lock\)/
  );
  assert.match(
    source,
    /const restoreRefreshes = new RestoreRefreshRegistry\(\)[\s\S]*\.register\("display-visibility", applyDisplayVisibilityFilters\)[\s\S]*\.register\("sculpt-brush-debug", refreshSculptBrushDebugAfterStateRestore\)[\s\S]*\.register\("curve-editors", refreshTaperCurveEditorAfterStateRestore\)[\s\S]*function finalizeStateRestore\(state\)[\s\S]*restoreRefreshes\.run\(\{ state \}\)[\s\S]*function restoreState\(state,[\s\S]*finalizeStateRestore\(state\);[\s\S]*finally/
  );
  assert.match(
    source,
    /function refreshSculptBrushDebugAfterStateRestore\(\) \{[\s\S]*if \(!sculptBrushToolActive\(\)\) return;[\s\S]*updateSculptBrushViabilityPlane\(\);[\s\S]*refreshSculptBrushDebugView\(\);/
  );
  assert.match(source, /taperCurveEdit\.side = event\.target\.dataset\.curveSide === "secondary"/);
  assert.match(css, /\.taper-center-line[\s\S]*stroke: #e62bea/);
  assert.match(css, /\.taper-center-line\.hidden,[\s\S]*\.taper-path-secondary\.hidden[\s\S]*display: none/);
  assert.match(
    source,
    /function renderTaperPreview\(path, target, curveKey\)[\s\S]*secondaryCurve[\s\S]*previewValueMax[\s\S]*secondaryPath/
  );
  assert.match(css, /\.taper-preview-center[\s\S]*stroke: #e62bea/);
  assert.match(
    css,
    /\.taper-toggle-stack[\s\S]*gap: 4px[\s\S]*\.taper-toggle-stack \.profile-mesh-point-toggle[\s\S]*padding: 5px 8px/
  );
  assert.doesNotMatch(html, /Edit the two sides of this strand dimension independently\./);
  assert.doesNotMatch(html, /Shift interior topology so the profile center follows the mesh midpoint/);
  assert.doesNotMatch(html, /Drag the magenta points across or along the strand/);
  assert.match(
    source,
    /function strandProfileTopologyAt\([\s\S]*profileTopologyCenterWeight\([\s\S]*centerAsymmetricProfile/
  );
  assert.match(
    source,
    /centerAsymmetricProfile[\s\S]*snapshot\.centerAsymmetricProfile[\s\S]*source\.centerAsymmetricProfile/
  );
  assert.match(
    source,
    /function addTaperMeshPointsForCurve\(lock, curveKey\)[\s\S]*taperMeshPointFrame[\s\S]*taperMeshPointExtentPerValue[\s\S]*function updateTaperMeshPoints\(\)/
  );
  assert.match(
    source,
    /editingTwist \? "twist" : curveKey === "depthCurve" \? "z" : "x"[\s\S]*lock\.asymmetricDepthCurve[\s\S]*editingTwist \? twistMeshGraphAxis\(frame\) : frame\[frameAxis\]/
  );
  assert.match(
    source,
    /nextEdit\.type !== "strand"[\s\S]*function closeTaperCurveEditor/
  );
  assert.match(
    source,
    /function beginTaperMeshPointDrag\(event\)[\s\S]*screenExtentPerValue[\s\S]*pushUndoState\(\)/
  );
  assert.match(
    source,
    /function updateTaperMeshPointDrag\(event\)[\s\S]*point\.value = THREE\.MathUtils\.clamp[\s\S]*point\.position = THREE\.MathUtils\.clamp[\s\S]*applyTaperCurveEdit\(\)/
  );
  assert.match(source, /renderer\.domElement\.addEventListener\("pointerdown", beginTaperMeshPointDrag, true\)/);
  assert.match(source, /window\.addEventListener\("pointerup", finishTaperMeshPointDrag, true\)/);
  assert.match(source, /controls\.enabled = [^\n]*!taperMeshPointDrag/);
  assert.match(source, /transformControls\.enabled = [^\n]*!taperMeshPointDrag/);
  assert.match(css, /\.profile-mesh-point-toggle[\s\S]*accent-color: #63c7ff/);
  assert.match(localization, /"Show points on mesh":/);
  assert.doesNotMatch(localization, /Drag the magenta points across or along the strand/);
  assert.match(localization, /"Asymmetric curve":/);
  assert.doesNotMatch(localization, /Edit the two sides of this strand dimension independently\./);
  assert.doesNotMatch(localization, /Shift interior topology so the profile center follows the mesh midpoint/);
});

test("strand shape exposes a persistent uniform profile rotation", async () => {
  const [html, source] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /Rotation <input id="strandRotation" type="range" min="-180" max="180" step="1" value="0" \/><output id="strandRotationValue"/);
  assert.match(source, /const strandCreationDefaults = \{[\s\S]*strandRotation: 0,[\s\S]*twist: 0/);
  assert.match(source, /lock\.strandRotation = THREE\.MathUtils\.clamp\(Number\(base\.strandRotation \?\? 0\), -180, 180\)/);
  assert.match(source, /function strandTwistAt\(lock, t\) \{[\s\S]*degToRad\(Number\(lock\.strandRotation \?\? 0\)\)[\s\S]*Number\(lock\.twist \|\| 0\) \* THREE\.MathUtils\.clamp\(t, 0, 1\)/);
  assert.match(source, /strandRotation: Number\(lock\.strandRotation \?\? 0\),[\s\S]*twist: lock\.twist/);
  assert.match(source, /strandRotation: THREE\.MathUtils\.clamp\(Number\(snapshot\.strandRotation \?\? 0\), -180, 180\)/);
  assert.match(source, /strandRotation: -Number\(lock\.strandRotation \?\? 0\),[\s\S]*twist: -lock\.twist/);
  assert.match(source, /partner\.strandRotation = -Number\(lock\.strandRotation \?\? 0\)/);
  assert.match(source, /setMixedControl\(inputs\.strandRotation, strandRotationValue/);
  assert.match(source, /relativeRotation = Boolean\(lock && key === "strandRotation"\)[\s\S]*currentRotation \+ value - primaryRotation/);
  assert.match(source, /\["widthScale", "depthScale", "profileOffset", "rootScalpOffset", "strandRotation", "twist"/);
  assert.match(source, /strandRotation: presetNumber\(source\.strandRotation, 0\)/);
});

test("strand shape exposes an undoable signed twist curve envelope", async () => {
  const [html, source, config, curveMath, css, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/app-config.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/curve-math.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="twist"[\s\S]*id="strandTwistCurveControl"[\s\S]*data-curve-key="twistCurve"/);
  assert.match(html, /id="strandTwistCurvePreview"/);
  assert.match(config, /DEFAULT_TWIST_CURVE = \[[\s\S]*position: 0, value: 0[\s\S]*position: 1, value: 0/);
  assert.match(config, /TWIST_CURVE_VALUE_MAX = 4500/);
  assert.match(config, /TWIST_CURVE_DISPLAY_RANGE_DEFAULT = 4500/);
  assert.match(curveMath, /export function normalizeEnvelopeCurve\([\s\S]*valueMinimum[\s\S]*valueMaximum/);
  assert.match(curveMath, /export function blendEnvelopeCurves\([\s\S]*sampleTaperCurve/);
  assert.match(source, /lock\.twistCurve = normalizeEnvelopeCurve\([\s\S]*DEFAULT_TWIST_CURVE[\s\S]*-TWIST_CURVE_VALUE_MAX/);
  assert.match(source, /function strandTwistAt\(lock, t\) \{[\s\S]*sampleIntegratedEnvelopeCurve\(lock\.twistCurve \|\| DEFAULT_TWIST_CURVE, t\)/);
  assert.match(source, /function controlPointRotationAt\(lock, t\) \{[\s\S]*sampleArray\(lock\.pointTwists, t\)/);
  assert.match(source, /function strandProfileTwistAt\(lock, t\) \{[\s\S]*sampleIntegratedEnvelopeCurve\(lock\.twistCurve \|\| DEFAULT_TWIST_CURVE, t\)/);
  assert.match(source, /function curveFrameAtPoint\(lock, pointIndex\)[\s\S]*twistAt: \(position\) => controlPointRotationAt\(frameLock, position\)/);
  assert.match(source, /function transportedStrandFrameAt\(lock, curve, t, options = \{\}\)[\s\S]*twistOverrideAt\(clampedT \* step \/ stepCount\)/);
  assert.match(source, /twistCurve: lock\.twistCurve\.map\(\(point\) => \(\{ \.\.\.point, value: -Number\(point\.value \|\| 0\) \}\)\)/);
  assert.match(source, /twistCurve: lock\.twistCurve\.map\(\(point\) => \(\{ \.\.\.point \}\)\)/);
  assert.match(source, /twistCurve: normalizeEnvelopeCurve\([\s\S]*snapshot\.twistCurve/);
  assert.match(curveMath, /export function twistCurveDisplayRange\([\s\S]*defaultRange = 180[\s\S]*authoredMaximum/);
  assert.match(source, /function renderTwistCurvePreview\([\s\S]*twistCurveDisplayRange\([\s\S]*TWIST_CURVE_DISPLAY_RANGE_DEFAULT/);
  assert.match(source, /function renderTaperCurveEditor\(\)[\s\S]*editingTwist[\s\S]*taperPointValue\.min = editingTwist[\s\S]*taperPointValue\.max = editingTwist/);
  assert.match(source, /function updateViewportStatsVisibility\(\)[\s\S]*curveEditorOpen = taperCurveEditor\.open[\s\S]*above-curve-editor/);
  assert.match(css, /\.viewport-stats\s*\{[^}]*bottom:\s*18px;/);
  assert.match(css, /\.camera-view-cube\s*\{[^}]*top:\s*calc\(var\(--viewport-title-inset, 0px\) \+ 86px\)/);
  assert.doesNotMatch(css, /:is\(\.viewport-top-controls, \.viewport-edit-mode, \.viewport-stats\)/);
  assert.doesNotMatch(source, /viewportStats\.style\.bottom\s*=/);
  assert.match(css, /\.viewport-stats\.above-curve-editor\s*\{[\s\S]*z-index:\s*41/);
  assert.match(source, /function canvasToTaperPoint\([\s\S]*editingTwist[\s\S]*-TWIST_CURVE_VALUE_MAX[\s\S]*TWIST_CURVE_VALUE_MAX/);
  assert.match(source, /taperPointValue\.min = editingTwist \? String\(twistRateUnitsFromDegrees\(-TWIST_CURVE_VALUE_MAX\)\)/);
  assert.match(source, /twistRateDegreesFromUnits\(taperPointValue\.value\)/);
  assert.match(source, /function applyTaperCurveEdit\(\{ interactive = false \} = \{\}\)[\s\S]*item\.twistCurve = cloneShapePresetValue\(primaryCurve\)/);
  assert.match(source, /function scheduleTaperCurveEdit\(\)[\s\S]*requestAnimationFrame[\s\S]*applyTaperCurveEdit\(\{ interactive: true \}\)/);
  assert.match(source, /function flushScheduledTaperCurveEdit\(\)[\s\S]*taperCurveEditInteractiveDirty[\s\S]*applyTaperCurveEdit\(\)/);
  assert.match(source, /taperCurveCanvas\.addEventListener\("pointermove"[\s\S]*scheduleTaperCurveEdit\(\)[\s\S]*function finishTaperCurveDrag[\s\S]*flushScheduledTaperCurveEdit\(\)/);
  assert.match(source, /updateTaperMeshPointDrag\(event\)[\s\S]*scheduleTaperCurveEdit\(\)[\s\S]*finishTaperMeshPointDrag[\s\S]*flushScheduledTaperCurveEdit\(\)/);
  assert.match(html, /data-preference-anchor=["']viewportPerformance["'][\s\S]*id=["']viewportPerformance["'][\s\S]*data-twist-curve-preview=["']all["'][^>]*aria-pressed=["']true["'][\s\S]*data-twist-curve-preview=["']active["'][^>]*aria-pressed=["']false["']/);
  assert.match(source, /const TWIST_CURVE_ALL_STRANDS_PREVIEW_PREFERENCE_KEY = "anime-hair-studio-twist-curve-all-strands-preview"/);
  assert.match(source, /let twistCurveAllStrandsPreviewEnabled = readStoredBooleanPreference\([\s\S]*TWIST_CURVE_ALL_STRANDS_PREVIEW_PREFERENCE_KEY,[\s\S]*true[\s\S]*\)/);
  assert.match(source, /function setTwistCurveAllStrandsPreviewEnabled\(enabled,[\s\S]*twistCurvePreviewPreferenceButtons\.forEach[\s\S]*aria-pressed[\s\S]*TWIST_CURVE_ALL_STRANDS_PREVIEW_PREFERENCE_KEY/);
  assert.match(source, /if \(interactive\) \{[\s\S]*if \(twistCurveAllStrandsPreviewEnabled\)[\s\S]*editSelectedLocks[\s\S]*immediate: true[\s\S]*updateTopology: false[\s\S]*else \{[\s\S]*rebuildLockGeometry\(lock/);
  assert.doesNotMatch(source, /gpuTwist|GPU_TWIST|GpuTwist/);
  assert.match(source, /function rebuildLockGeometry\(lock, options = \{\}\)[\s\S]*options\.updateCurveObjects !== false[\s\S]*options\.updateClump !== false/);
  assert.match(source, /taperCurveEdit\.curveKey === "twistCurve"[\s\S]*DEFAULT_TWIST_CURVE/);
  assert.match(source, /taperCurveCanvas\.addEventListener\("pointerdown"[\s\S]*pushUndoState\(\)/);
  assert.match(source, /blendEnvelopeCurves\([\s\S]*first\.twistCurve[\s\S]*second\.twistCurve/);
  assert.match(source, /function taperMeshPointFrame\([\s\S]*curveKey === "twistCurve"[\s\S]*twistAt: \(parameter\) => controlPointRotationAt\(lock, parameter\)/);
  assert.match(source, /\["taperCurve", "depthCurve", "twistCurve"\]\.includes\(taperCurveEdit\?\.curveKey\)/);
  assert.match(source, /editingTwist[\s\S]*lock\.twistCurve[\s\S]*sides: \[1\][\s\S]*twistMeshPointDistancePerDegree\(lock, point\.position, twistDisplayRange\) \* point\.value/);
  assert.match(source, /dragDisplayRange = twistCurveEditing\(\)[\s\S]*TWIST_CURVE_DISPLAY_RANGE_DEFAULT/);
  assert.match(source, /const displayRange = editingTwist[\s\S]*twistCurveDisplayRange\([\s\S]*TWIST_CURVE_DISPLAY_RANGE_DEFAULT/);
  assert.match(source, /valueMinimum: editingTwist \? -TWIST_CURVE_VALUE_MAX : 0,[\s\S]*valueMaximum: editingTwist \? TWIST_CURVE_VALUE_MAX : TAPER_VALUE_MAX/);
  assert.match(source, /point\.value = THREE\.MathUtils\.clamp\([\s\S]*drag\.valueMinimum,[\s\S]*drag\.valueMaximum/);
  assert.match(source, /taperAsymmetryToggleRow\.classList\.toggle\([\s\S]*editingTwist \|\| editingProceduralBranch \|\| editingRadialDrawSize \|\| editingHairShellExtrusion/);
  assert.match(source, /taperMeshPointsToggleRow\.classList\.toggle\([\s\S]*nextEdit\.type !== "strand"/);
  assert.match(source, /const twistMeshCurvePositiveMaterial = new THREE\.LineBasicMaterial\([\s\S]*color: UI_ACCENT_COLOR/);
  assert.match(source, /const twistMeshCurveNegativeMaterial = new THREE\.LineBasicMaterial\([\s\S]*color: 0xe62bea/);
  assert.match(source, /const twistMeshCurvePositiveFillMaterial = new THREE\.MeshBasicMaterial\([\s\S]*color: 0x176873[\s\S]*opacity: 0\.48/);
  assert.match(source, /const twistMeshCurveNegativeFillMaterial = new THREE\.MeshBasicMaterial\([\s\S]*color: 0x701d62[\s\S]*opacity: 0\.48/);
  assert.match(source, /function addTwistMeshCurvePath\([\s\S]*sampleTaperCurve\(twistCurve, position\)[\s\S]*signedSegments\.positive[\s\S]*signedSegments\.negative/);
  assert.match(source, /function twistMeshGraphAxis\(frame\)[\s\S]*frame\.x\.clone\(\)\.negate\(\)/);
  assert.match(source, /function addTwistMeshCurvePath\([\s\S]*twistMeshGraphAxis\(frame\)[\s\S]*graphAxis/);
  assert.match(source, /const shapeAxis = editingTwist \? twistMeshGraphAxis\(frame\) : frame\[axis\]\.clone\(\)[\s\S]*const projectedAxis = shapeAxis\.addScaledVector/);
  assert.doesNotMatch(source, /twistMeshBillboard|updateTwistMeshBillboardForCamera/);
  assert.match(source, /signedFills\.positive[\s\S]*signedFills\.negative[\s\S]*fill\.renderOrder = 33[\s\S]*fill\.raycast = \(\) => \{\}/);
  assert.match(source, /line\.raycast = \(\) => \{\};[\s\S]*line\.userData\.twistMeshCurvePath = sign/);
  assert.match(source, /edge\.visible = lock\.id === selectedId[\s\S]*taperMeshPointsVisible && twistCurveEditing\(\)[\s\S]*moveCurveControlVisibility\.twistCurve/);
  assert.match(css, /\.twist-curve-zero[\s\S]*stroke: #e62bea/);
  assert.match(localization, /"Twist Curve":/);
  assert.match(localization, /"Twist Rate Curve":/);
});

test("dynamic density can add longitudinal loops to support twist curves", async () => {
  const [html, source, curveMath, clumpPresets, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/curve-math.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/clump-brush-presets.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="groupDynamicDensity"[\s\S]*Twist Density[\s\S]*id="groupTwistDensity"/);
  assert.match(html, /id="strandDynamicDensity"[\s\S]*Twist Density[\s\S]*id="strandTwistDensity"/);
  assert.match(curveMath, /export function adaptiveCurveParameters\([\s\S]*additionalDetailSampler/);
  assert.match(curveMath, /export function twistCurveDensityDetail\([\s\S]*sampleTaperCurve/);
  assert.match(source, /function strandCurveParameters\([\s\S]*twistCurveDensityDetail\([\s\S]*lock\.twistDensity,[\s\S]*segmentLimit/);
  assert.match(source, /const strandCreationDefaults = \{[\s\S]*twistDensity: 0\.5/);
  assert.match(source, /lock\.twistDensity = THREE\.MathUtils\.clamp\(Number\(base\.twistDensity \?\? 0\), 0, 1\)/);
  assert.match(source, /twistDensity: Number\(lock\.twistDensity \?\? 0\)/);
  assert.match(source, /twistDensity: THREE\.MathUtils\.clamp\(Number\(snapshot\.twistDensity \?\? 0\), 0, 1\)/);
  assert.match(source, /partner\.twistDensity = Number\(lock\.twistDensity \?\? 0\)/);
  assert.match(source, /inputs\.twistDensity\.disabled = !strandDynamicDensityInput\.checked/);
  assert.match(source, /groupInputs\.twistDensity\.disabled = !defaults\.dynamicDensity/);
  assert.match(clumpPresets, /"densityAggression",\s*"twistDensity"/);
  assert.match(localization, /"Twist Density":/);
});

test("compatible multi-strand selections share attribute edits", async () => {
  const [html, source, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="selectedStrandTitle">Selected Strand/);
  assert.match(html, /id="selectedStrandSelectionSummary" class="multi-edit-summary hidden"/);
  assert.match(html, /id="strandShapePanel"[\s\S]*id="strandShapeTitle">Shape<[\s\S]*id="selectedStrandSelectionSummary" class="multi-edit-summary hidden"[\s\S]*id="strandLayerControl"/);
  assert.equal((html.match(/id="selectedStrandSelectionSummary"/g) || []).length, 1);
  assert.match(css, /\.multi-edit-summary\.hidden\s*\{\s*display: none;/);
  assert.match(source, /function compatibleSelectedLocks\(primary = getSelectedLock\(\)\)/);
  assert.match(source, /function selectedEditRoots\(primary = getSelectedLock\(\)\)/);
  assert.match(source, /function editSelectedLocks\(mutator, options = \{\}\)/);
  assert.match(source, /partner && selectedIds\.has\(partner\.id\)[\s\S]*handled\.add\(partner\.id\)/);
  assert.match(source, /function syncMultiStrandInputs\(primary = getSelectedLock\(\)\)/);
  assert.match(source, /Changes apply to all of them/);
  assert.match(source, /inputs\.name\.disabled = multiple/);
  assert.match(source, /function bindLockInput[\s\S]*editSelectedLocks\(applyValue/);
  assert.match(source, /relativeEditValue\(currentDimension, primaryDimension, value/);
  assert.match(source, /relativeDimension = Boolean\(lock && \["widthScale", "depthScale"\]\.includes\(key\)\)/);
  assert.match(source, /dimensionTargets = relativeDimension[\s\S]*selectedLocksInOrder\(\)\.filter\(\(item\) => !\["poly", "hair-shell"\]\.includes\(item\.geometryType\)\)/);
  assert.match(source, /relativeDimension && key === "widthScale"[\s\S]*setStrandWidthDimension\(item, nextValue\)/);
  assert.match(source, /function setStrandWidthDimension\(target, width\)[\s\S]*target\.baseWidth = nextWidth/);
  assert.match(source, /setMixedControl\([\s\S]*drawStrandBrushSizeInput[\s\S]*values\(\(lock\) => editableStrandWidth\(lock\)\)/);
  assert.match(source, /drawStrandBrushSizeInput\.addEventListener\("input"[\s\S]*compatibleSelectedLocks\(selectedLock\)[\s\S]*relativeEditValue\(editableStrandWidth\(lock\), primaryWidth, nextWidth[\s\S]*applyEditableStrandWidth\(lock, width, null\)[\s\S]*immediate: true, targets/);
  assert.match(source, /function beginStrandWidthEdgeDrag[\s\S]*targetSnapshots: widthTargets\.map/);
  assert.match(source, /function updateStrandWidthEdgeDrag[\s\S]*dimensionDelta[\s\S]*snapshot\.startWidth \+ dimensionDelta[\s\S]*snapshot\.startDepth \+ dimensionDelta/);
  assert.match(source, /function finishStrandWidthEdgeDrag[\s\S]*targetSnapshots\.forEach/);
  assert.match(source, /strandLayerInput\.addEventListener\("change"[\s\S]*editSelectedLocks/);
  assert.match(source, /hairMaterialSelect\.addEventListener\("change"[\s\S]*editSelectedLocks/);
  assert.match(source, /strandDynamicDensityInput\.addEventListener\("change"[\s\S]*editSelectedLocks/);
  assert.match(source, /function applyTaperCurveEdit\(\{ interactive = false \} = \{\}\)[\s\S]*editSelectedLocks/);
  assert.match(source, /function applySweepProfileEdit\(\)[\s\S]*editSelectedLocks/);
  assert.match(source, /function applyShapePreset\(select\)[\s\S]*editSelectedLocks/);
  assert.match(source, /Object\.entries\(strandSplitInputs\)[\s\S]*editSelectedLocks/);
  assert.match(source, /hairCardInput\.addEventListener\("change"[\s\S]*editSelectedLocks/);
  assert.match(css, /\.multi-edit-summary[\s\S]*color: #9bdcff/);
  assert.match(css, /\.mixed-value[\s\S]*outline:/);
});

test("attached branches draw a persistent projected topology imprint on their parent", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(source, /branchChildrenFor\(lock\)\.forEach\(\(child\) => \{[\s\S]*projectBranchProfileToParent\(child, childProfile\)/);
  assert.match(source, /firstCandidateRow = Math\.max\(0, closestRow - 2\)[\s\S]*row <= lastCandidateRow/);
  assert.match(source, /indices\.push\(a, c, b, b, c, d\)[\s\S]*triangleEdgeMasks\.push\(\[0, 1, 1\], \[1, 1, 0\]\)/);
  assert.match(source, /function createBranchKnifeOverlayGeometry[\s\S]*sourceGeometry\.userData\.branchKnifeLoops[\s\S]*new THREE\.LineSegments/);
  assert.match(source, /function rebuildLockGeometry[\s\S]*syncBranchKnifeOverlay\(lock\.wireOverlay, lock\.mesh\.geometry\)/);
  assert.match(source, /function disposeBranchKnifeOverlay[\s\S]*knifeOverlay\.geometry\.dispose\(\)[\s\S]*knifeOverlay\.material\.dispose\(\)/);
  assert.match(source, /geometry\.userData\.branchKnifeImprintCount = branchKnifeLoops\.length/);
  assert.match(source, /lock\.branchParentId[\s\S]*rebuildLockGeometry\(branchParent,[\s\S]*updateBranches: false/);
  assert.match(source, /restorePlan\.scene\.locks\.forEach[\s\S]*branchChildrenFor\(lock\)\.length[\s\S]*rebuildLockGeometry\(parent/);
});

test("silhouette volume tool exposes a two-view drawing workflow backed by native hair-shell geometry", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(html, /data-tool="silhouette-volume"/);
  assert.match(html, /id="silhouetteVolumeToolPanel"/);
  assert.match(html, /Draw side silhouette/);
  assert.match(html, /Draw back silhouette/);
  assert.match(html, /id="confirmSilhouetteVolume"[\s\S]*Confirm Side/);
  assert.match(source, /createSilhouetteVolumeGrid/);
  assert.match(source, /resampleClosedSilhouette/);
  assert.match(source, /function beginSilhouetteVolumeStroke/);
  assert.match(source, /function beginSilhouetteVolumeHandleDrag/);
  assert.match(source, /function confirmSilhouetteVolumeCurve/);
  assert.match(source, /geometryType: "hair-shell"[\s\S]*hairShellBasePoints: points[\s\S]*hairShellBaseFaces: faces/);
  assert.match(source, /if \(mirrorXEditing && stage === "back"\)[\s\S]*mirrorLine\.name = mirrorName/);
  assert.match(source, /mirrorBackX: mirrorXEditing[\s\S]*mirrorCenterX: silhouetteVolumeDraft\.center\.x/);
  assert.doesNotMatch(source, /lock\.name = `Silhouette Volume \$\{lockIndex\}`;\s*createMirrorPartnerForNewLock\(lock\)/);
  assert.match(source, /pushUndoState\(\);[\s\S]*Silhouette Volume/);
});

test("scalp drawing creates one mirrored visual hair-shell mesh directly from the head", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(html, /data-tool="scalp-draw"/);
  assert.match(html, /id="scalpDrawToolPanel"[\s\S]*Draw one side of the scalp boundary/);
  assert.match(html, /id="confirmScalpDraw"[\s\S]*Create Scalp Mesh/);
  assert.match(source, /function beginScalpDrawStroke/);
  assert.match(source, /const existing = !guideMode && scalpDrawDraft\?\.rawPoints\?\.length[\s\S]*points: existing\.length \? existing : \[hit\.point\.clone\(\)\]/);
  assert.match(source, /scalpDrawDraft\.rawPoints = stroke\.points\.map/);
  assert.match(source, /function createDrawnScalpMesh/);
  assert.match(source, /function drawScalpSurfacePreview[\s\S]*active \? Math\.min\(12, requestedRows\)[\s\S]*geometry\.userData\.quadFaces/);
  assert.match(html, /id="scalpDrawBoundaryMode"[\s\S]*id="scalpDrawFilledSideMode"[\s\S]*id="scalpDrawGuideMode"[\s\S]*id="clearScalpDrawGuides"/);
  assert.match(source, /mode === "inside"[\s\S]*insidePoint = hit\.point\.clone\(\)/);
  assert.match(source, /scalpQuadWireEdges\(faces\)[\s\S]*scalp-surface-preview-wire/);
  assert.match(source, /kind: guideMode \? "guide" : "boundary"[\s\S]*scalpDrawDraft\.guides\.push/);
  assert.match(source, /createMirroredScalpGrid/);
  assert.match(source, /if \(enteringScalpDraw\) \{\s*setMirrorXEditing\(true\)/);
  assert.match(source, /lock\.name = `Scalp Mesh \$\{lockIndex\}`/);
  assert.doesNotMatch(source, /lock\.name = `Scalp Mesh \$\{lockIndex\}`;\s*createMirrorPartnerForNewLock/);
});
test("Auto Remesh Strands is non-destructive and can remain linked to editable source curves", async () => {
  const { html, source } = await settingsContractSources();
  assert.match(html, /id="curvesMenu"[\s\S]*id="openAutoRemeshStrands"[\s\S]*Auto Remesh Strands\.\.\./);
  assert.match(html, /id="autoRemeshStrandsPanel"[\s\S]*id="autoRemeshAxialLoops"[^>]*min="8" max="40"[\s\S]*id="autoRemeshFlowSmoothing"[^>]*min="0" max="100"[\s\S]*id="autoRemeshTipSeparation"[^>]*min="0" max="100"[^>]*value="0"[\s\S]*id="autoRemeshHideOriginals"[^>]*checked[\s\S]*Adaptive Remesh[\s\S]*id="autoRemeshAdaptive"[^>]*type="checkbox"[\s\S]*id="confirmAutoRemeshStrands"[^>]*>Confirm</);
  assert.match(source, /function autoRemeshStrandsAvailable\(\)[\s\S]*autoRemeshSourceStrands\(\)\.length > 1/);
  assert.match(source, /action: "open-auto-remesh-strands", label: "Remesh"/);
  assert.match(source, /function performStrandRadialAction\(action, lockId\)[\s\S]*action === "open-auto-remesh-strands"\) return openAutoRemeshStrandsPanel\(\)/);
  assert.match(source, /function openAutoRemeshStrandsPanel\(\)[\s\S]*scheduleAutoRemeshPreview\(\{ immediate: true \}\)/);
  assert.match(source, /async function generateAutoRemeshPreview\(\)[\s\S]*tipSeparation[\s\S]*createAutoRemeshPreviewMesh[\s\S]*Preview ready/);
  assert.match(source, /function confirmAutoRemeshStrands\(\)[\s\S]*pushUndoState\(\)[\s\S]*modelingMeshType = "auto-remesh"[\s\S]*adaptiveRemeshSourceIds = sources\.map[\s\S]*if \(hideOriginals\) sources\.forEach[\s\S]*lock\.outlinerVisible = false/);
  assert.match(source, /function isModelingMesh\(lock\)[\s\S]*!\(lock\?\.modelingMeshType === "auto-remesh" && lock\.adaptiveRemesh\)/);
  assert.match(source, /function createOutlinerAutoRemesh\(result\)[\s\S]*outliner-folder-icon[\s\S]*badge: "Remesh"[\s\S]*badge: "Source"/);
  assert.match(source, /function renderLockList\(\)[\s\S]*autoRemeshResultForSource\(lock\)[\s\S]*createOutlinerAutoRemesh\(lock\)/);
  assert.match(source, /function historyLocksToRebuild[\s\S]*expandHistoryDependencyIds\([\s\S]*currentSnapshots[\s\S]*restoredSnapshots/);
  assert.match(source, /function adaptiveRemeshControlPointHitFromEvent\([\s\S]*adaptiveRemeshSourceLocks\(result\)[\s\S]*strandControlPointHitFromEvent/);
  assert.match(source, /function adaptiveRemeshTransformGizmoActive\(\)[\s\S]*transformControls\.object\?\.userData\.lockId[\s\S]*adaptiveRemeshSourceLocks\(activeAdaptiveRemeshResult\(\)\)/);
  assert.match(source, /function strandPassesDisplayFilters\(lock\)[\s\S]*adaptiveRemeshEditSession\?\.resultId[\s\S]*adaptiveRemeshSourceIds\?\.includes\(lock\.id\)[\s\S]*lock\.outlinerVisible !== false \|\| adaptiveSourceEditing/);
  assert.match(source, /function pointerHitsTransformGizmo\(event\)[\s\S]*transformControls\.pointerHover\(\{[\s\S]*event\.clientX - rect\.left[\s\S]*event\.clientY - rect\.top[\s\S]*button: -1[\s\S]*if \(transformControls\.axis\) return true[\s\S]*transformControls\._gizmo\?\.picker[\s\S]*transformControls\._gizmo\?\.gizmo[\s\S]*intersectObjects\(targets, true\)/);
  assert.match(source, /function prepareCurvePointSelection\([\s\S]*adaptiveHandlesVisible[\s\S]*adaptiveRemeshControlPointHitFromEvent\(event\)[\s\S]*activateStrandControlPoint/);
  assert.match(source, /function prepareCurvePointSelection\([\s\S]*const gizmoHit = pointerHitsTransformGizmo\(event\)[\s\S]*const adaptiveGizmoHit = adaptiveRemeshTransformGizmoActive\(\) && gizmoHit[\s\S]*adaptiveGizmoHit \|\| \([\s\S]*gizmoHit/);
  assert.match(source, /function updateControlPointHover\([\s\S]*const adaptiveGizmoHit = adaptiveRemeshTransformGizmoActive\(\) && gizmoHit[\s\S]*unselectedStrandPointHasPriority\) && !adaptiveGizmoHit[\s\S]*if \(adaptiveGizmoHit \|\|/);
  assert.match(source, /function visibleControlPointHoverTargets\([\s\S]*adaptiveRemeshSourceLocks\(activeAdaptiveRemeshResult\(\)\)[\s\S]*source\.curveObjects\.handles/);
  assert.match(source, /function activateStrandControlPoint\([\s\S]*adaptiveSourceEditing = activeTool === "curve-sharpness"[\s\S]*beginAdaptiveRemeshSourceEdit\(sourceLock\)[\s\S]*adaptiveSourceEditing && activeTool === "select"[\s\S]*setActiveTool\("move"\)/);
  assert.match(source, /function beginHandleEdit\([\s\S]*selectedIndices,[\s\S]*changed: false/);
  assert.match(source, /transformControls\.addEventListener\("objectChange"[\s\S]*if \(activeHandleEdit\) activeHandleEdit\.changed = true/);
  assert.match(source, /function beginViewPlaneMove\(lock, handle, event\)[\s\S]*!viewPlaneMoveActiveForView\(\)[\s\S]*historyCaptured: false[\s\S]*didDrag: false/);
  assert.match(source, /function updateViewPlaneMove\(event\)[\s\S]*pointerDistance < 2[\s\S]*pushUndoState\(\)[\s\S]*historyCaptured = true/);
  assert.match(source, /function endViewPlaneMove\(event\)[\s\S]*const didDrag = viewPlaneMoveDrag\.didDrag[\s\S]*if \(didDrag\) finishAdaptiveRemeshSourceEdit\(editedLock\)/);
  assert.match(source, /activeTool === "move" && viewPlaneMoveActiveForView\(\)[\s\S]*beginViewPlaneMove\(getSelectedLock\(\), handle, event\)[\s\S]*configureTransformControls\(activeTool\)[\s\S]*attachTransformForCurvePoint\(getSelectedLock\(\), handle\.userData\.pointIndex, handle\)/);
  assert.doesNotMatch(source, /adaptiveSourceEditing \|\| viewPlaneMoveActiveForView\(\)/);
  assert.match(source, /function beginAdaptiveRemeshSourceEdit\([\s\S]*sourceId: source\.id[\s\S]*adaptiveRemeshEditSession\.sourceId = source\.id/);
  assert.match(source, /function adaptiveRemeshEditSource\([\s\S]*adaptiveRemeshResultForSource\(directSource\)[\s\S]*session\?\.sourceId/);
  assert.match(source, /function finishAdaptiveRemeshSourceEdit\([\s\S]*adaptiveRemeshEditSource\(source\)[\s\S]*regenerateAdaptiveRemeshAfterEdit\(resolvedSource\)/);
  assert.match(source, /transformControls\.addEventListener\("dragging-changed"[\s\S]*beginAdaptiveRemeshSourceEdit\([\s\S]*const handleEditChanged = Boolean\(activeHandleEdit\?\.changed\)[\s\S]*if \(handleEditChanged\) finishAdaptiveRemeshSourceEdit\(editedLock\)/);
  assert.match(source, /function activeAdaptiveRemeshResult\(\)[\s\S]*selectedAdaptiveRemeshResult\(\)[\s\S]*adaptiveRemeshResultForSource\(getSelectedLock\(\)\)/);
  assert.match(source, /async function regenerateAdaptiveRemeshAfterEdit\([\s\S]*unionAutoRemeshSweeps[\s\S]*applyAdaptiveRemeshOutput[\s\S]*const editedSource = adaptiveRemeshSourceLocks\(result\)[\s\S]*refreshStrandControlPointSelection\(editedSource\)/);
  assert.match(source, /adaptiveRemeshSourceIds:[\s\S]*adaptiveRemeshSettings:[\s\S]*adaptiveRemeshHideOriginals:/);
  assert.match(source, /modelingMeshType: \["primitive", "back-hair", "connected-strand-shell", "auto-remesh"\]\.includes/);
});

test("curve sharpness tool continuously blends strand points from smooth to linear", async () => {
  const { html, source, css } = await settingsContractSources();
  assert.match(html, /data-tool="curve-sharpness"[\s\S]*id="curveSharpnessToolPanel"[\s\S]*id="curvePointSharpness"[^>]*min="0"[^>]*max="1"[^>]*step="0\.01"[\s\S]*id="curvePointBevel"[^>]*type="checkbox"[\s\S]*id="curvePointBevelApexFlow"[^>]*min="0"[^>]*max="1"[^>]*step="0\.01"[\s\S]*id="curvePointBevelRemoveApex"[^>]*type="checkbox"/);
  assert.match(source, /function strandBaseCurve\([\s\S]*curveSegmentSharpness[\s\S]*target\.lerp\(linearPoint, weight\)/);
  assert.match(source, /function activateStrandControlPoint\([\s\S]*activeTool === "curve-sharpness"[\s\S]*beginCurveSharpnessDrag/);
  assert.match(source, /function updateCurveSharpnessDrag\([\s\S]*pushUndoState\(\)[\s\S]*setCurvePointSharpness/);
  assert.match(source, /curvePointSharpness: normalizeCurvePointSharpness\(lock\.curvePointSharpness[\s\S]*curvePointBevel: Boolean\(lock\.curvePointBevel\)[\s\S]*curvePointBevelRemoveApex: Boolean\(lock\.curvePointBevelRemoveApex\)[\s\S]*curvePointBevelApexFlow: THREE\.MathUtils\.clamp[\s\S]*function restoreLock\([\s\S]*curvePointSharpness: normalizeCurvePointSharpness\(snapshot\.curvePointSharpness[\s\S]*curvePointBevel: Boolean\(snapshot\.curvePointBevel\)[\s\S]*curvePointBevelRemoveApex: Boolean\(snapshot\.curvePointBevelRemoveApex\)[\s\S]*curvePointBevelApexFlow: THREE\.MathUtils\.clamp/);
  assert.match(source, /function strandCurveParameters\([\s\S]*alignCurveParametersToSharpControls\([\s\S]*lock\.curvePointBevel,[\s\S]*lock\.curvePointBevelRemoveApex,[\s\S]*lock\.curvePointBevelApexFlow/);
  assert.match(source, /curvePointBevelInput\?\.addEventListener\("change"[\s\S]*pushUndoState\(\)[\s\S]*lock\.curvePointBevel = bevel[\s\S]*syncActiveMirror\(lock\)/);
  assert.match(source, /curvePointBevelRemoveApexInput\?\.addEventListener\("change"[\s\S]*pushUndoState\(\)[\s\S]*lock\.curvePointBevelRemoveApex = removeApex[\s\S]*syncActiveMirror\(lock\)/);
  assert.match(source, /function updateCurvePointBevelApexFlowEdit\([\s\S]*lock\.curvePointBevelApexFlow = value[\s\S]*syncActiveMirror\(lock\)[\s\S]*curvePointBevelApexFlowInput\?\.addEventListener\("input", updateCurvePointBevelApexFlowEdit\)/);
  assert.match(source, /function strandGeometryFrameAt\([\s\S]*sharpCurveJointData[\s\S]*function miteredStrandRingOffset\([\s\S]*miterScale/);
  assert.match(css, /\.icon-curve-sharpness\s*\{[^}]*curve-sharpness-tool\.svg/);
});

test("retired physics workspace leaves no UI, shortcut, runtime, or styling entry points", async () => {
  const [html, source, css, shortcuts] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/shortcut-registry.js", import.meta.url), "utf8")
  ]);

  assert.doesNotMatch(html, /physicsPreview|value="physics"|Physics workspaces/);
  assert.doesNotMatch(source, /physicsPreview|strand-physics|viewportEditMode === "physics"|workspace-physics/);
  assert.doesNotMatch(shortcuts, /physics/);
  assert.doesNotMatch(css, /physicsPreview|physics-preview/);
});

test("brush workspace isolates a transient default strand preview driven by creation settings", async () => {
  const [html, source, shortcuts, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/shortcut-registry.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8")
  ]);

  assert.match(html, /<option value="brush">Brushes<\/option>/);
  assert.match(html, /id="brushWorkspaceNodeEditorPrototype"/);
  assert.doesNotMatch(html, /brushStrokePip|Stroke Preview|Preview Repetitions/);
  assert.match(html, /<span>Neighbour Segments<\/span>/);
  assert.doesNotMatch(html, /<span>Neighbor Segments<\/span>/);
  assert.match(html, /data-brush-pattern-section-split="root"[\s\S]*data-brush-pattern-section-enable="root"[\s\S]*data-brush-pattern-section-split="tip"[\s\S]*data-brush-pattern-section-enable="tip"/);
  assert.doesNotMatch(html, /brushWorkspaceSectionEnabled(?:Row|Label)?/);
  assert.match(html, /id="drawStrandToolPanel"[\s\S]*id="brushWorkspaceTypeTabs"[\s\S]*data-brush-workspace-style="pattern"[\s\S]*Pattern Brush[\s\S]*data-brush-workspace-style="accessory"[\s\S]*Accessory Brush[\s\S]*id="brushWorkspaceLayoutSettings"[\s\S]*id="brushWorkspacePatternPreset"[\s\S]*value="straight"[\s\S]*value="custom"[\s\S]*id="saveProceduralBrushPreset"[\s\S]*id="removeProceduralBrushPreset"[\s\S]*Pattern Type[\s\S]*id="brushWorkspacePattern"[\s\S]*value="radial"[\s\S]*value="linear"[\s\S]*value="braid"[\s\S]*id="brushWorkspaceSectionTabs"[\s\S]*data-brush-pattern-section="body"[\s\S]*data-brush-pattern-section="root"[\s\S]*data-brush-pattern-section-enable="root"[\s\S]*data-brush-pattern-section="tip"[\s\S]*data-brush-pattern-section-enable="tip"[\s\S]*id="brushWorkspaceNeighborSegments"[^>]*type="checkbox"[\s\S]*id="brushWorkspaceBodyScaleY"[^>]*min="0\.25"[^>]*max="4"[^>]*value="1"[\s\S]*id="brushWorkspaceStrandCount"[^>]*min="1"[^>]*max="16"[^>]*value="1"[\s\S]*id="brushWorkspaceActiveStrand"[\s\S]*id="brushWorkspaceResetSegment"[\s\S]*id="brushWorkspaceAccessorySettings"[\s\S]*Accessory Layout[\s\S]*id="brushWorkspaceAccessoryCount"[\s\S]*id="brushWorkspaceAccessoryRadius"[\s\S]*id="drawBrushPreset"[\s\S]*id="saveStrandToolPreset"/);
  assert.doesNotMatch(html, /<option value="three-strand-braid">/);
  assert.doesNotMatch(html, /id="brushWorkspaceCurveStep(?:Value)?"/);
  assert.doesNotMatch(html, /id="brushWorkspace(?:RootSpread|TipSpread|RootRotation|TipRotation)"/);
  assert.doesNotMatch(html, /id="brushWorkspaceHint"/);
  assert.match(shortcuts, /\["5", "brush"\]/);
  assert.match(source, /function strandWorkspaceActive\(mode = viewportEditMode\)[\s\S]*mode === "strand" \|\| mode === "brush"/);
  assert.match(source, /const BRUSH_WORKSPACE_TOOLS = new Set\(\["select", "move"\]\)[\s\S]*function setViewportEditMode\(mode, options = \{\}\)[\s\S]*if \(nextMode === "brush"\)[\s\S]*setActiveTool\("move"\)/);
  assert.match(source, /function updateViewportToolVisibility\(\)[\s\S]*brushMode = viewportEditMode === "brush"[\s\S]*brushToolAllowed = BRUSH_WORKSPACE_TOOLS\.has\(tool\)[\s\S]*brushMode && !brushToolAllowed[\s\S]*sculptBrushDock\.classList\.toggle\("hidden", viewportEditMode !== "strand"/);
  assert.match(source, /function setActiveTool\(tool\)[\s\S]*viewportEditMode === "brush" && !BRUSH_WORKSPACE_TOOLS\.has\(tool\)[\s\S]*tool = "move"/);
  assert.match(source, /const drawToolSettingsVisible = brushContext.settingsVisible[\s\S]*drawStrandToolPanel\.classList\.toggle\("hidden", !drawToolSettingsVisible\)/);
  assert.match(source, /let brushWorkspaceStyle = "pattern"/);
  assert.match(source, /function setBrushWorkspaceStyle\(style\)[\s\S]*style === "accessory"[\s\S]*updateAttributeEditorMode\(\)/);
  assert.match(source, /function rebuildBrushWorkspacePreview\(\)[\s\S]*brushWorkspaceStyle === "accessory"[\s\S]*proceduralAccessoryTemplateData\([\s\S]*brushWorkspaceAccessoryParentVisibleInput/);
  assert.doesNotMatch(source, /syncBrushWorkspaceNodeUi|updateBrushWorkspaceAccessoryNodeGraph|BRUSH_WORKSPACE_SIGNAL_META|updateBrushWorkspaceSignal/);
  assert.doesNotMatch(css, /body\.brush-workspace-active \.outliner-panel|body\.brush-workspace-active #viewport|body\.brush-workspace-active \.viewport-display-actions/);
  assert.match(source, /drawStrandToolTitle\.textContent = brushContext.title/);
  assert.match(source, /const brushTypeTabsVisible = brushContext.tabsVisible[\s\S]*brushWorkspaceTypeTabs\.hidden = !brushTypeTabsVisible[\s\S]*brushWorkspaceTypeTabs\.classList\.toggle\("hidden", !brushTypeTabsVisible\)/);
  assert.match(source, /brushWorkspaceTypeTabs\?\.addEventListener\("click", handleBrushWorkspaceTypeClick\)/);
  assert.match(css, /\.brush-type-tabs\.hidden\s*\{\s*display:\s*none/);
  assert.match(source, /strandShapePanel\.classList\.toggle\("brush-context", viewportEditMode === "brush"\)[\s\S]*strandShapeTitle\.textContent = viewportEditMode === "brush"[\s\S]*"Pattern Strand Shape"/);
  assert.match(source, /const brushWorkspacePreviewGroup = new THREE\.Group\(\)[\s\S]*brushWorkspacePreviewGroup\.visible = false/);
  assert.match(source, /function brushWorkspaceEditorRecipe\(\)[\s\S]*repeatCount: 1[\s\S]*rootStrandPatterns:[\s\S]*tipStrandPatterns:[\s\S]*function brushWorkspaceViewportRepeatCount\(\)[\s\S]*brushWorkspaceNeighborSegmentsInput\?\.checked \? 3 : 1[\s\S]*function brushWorkspaceComposedPreview\(strandIndex = 0, placement = null, repeatCount = 1\)[\s\S]*proceduralBrushCenteredPatternSections\(recipe, strandIndex, repeatCount\)[\s\S]*assemblyOffsets[\s\S]*function brushWorkspacePreviewPoints\(strandIndex = 0, placement = null\)[\s\S]*brushWorkspaceViewportRepeatCount\(\)/);
  assert.match(source, /function syncBrushWorkspaceSectionEnableButtons\(\)[\s\S]*data-brush-pattern-section-enable[\s\S]*aria-pressed[\s\S]*function toggleBrushWorkspacePatternSection\(section\)[\s\S]*brushWorkspaceRootPatternEnabled = !brushWorkspaceRootPatternEnabled[\s\S]*brushWorkspaceTipPatternEnabled = !brushWorkspaceTipPatternEnabled/);
  assert.match(source, /brushWorkspaceSectionTabs\?\.addEventListener\("click"[\s\S]*data-brush-pattern-section-enable[\s\S]*toggleBrushWorkspacePatternSection\(enableSection\)[\s\S]*setBrushWorkspacePatternSection\(section\)/);
  assert.doesNotMatch(source, /brushWorkspaceSectionEnabled(?:Row|Label|Input)/);
  assert.match(source, /function rebuildBrushWorkspacePreview\(\)[\s\S]*creationPresetSnapshot\(brushWorkspaceCreationDefaults, "strand"\)[\s\S]*proceduralBrushLayoutOffsets\([\s\S]*brushWorkspacePatternInput\?\.value[\s\S]*brushWorkspaceStrandCountInput\?\.value[\s\S]*placements\.map[\s\S]*addLock\("front"[\s\S]*transient: true/);
  assert.match(source, /let brushWorkspacePatternLayout = \{[\s\S]*rootSpread: 1[\s\S]*tipSpread: 1[\s\S]*function applyBrushWorkspaceRecipe\(recipeValue[\s\S]*brushWorkspacePatternLayout = \{ \.\.\.recipe\.layout \}/);
  assert.match(source, /function proceduralBrushRecipeFromControls\(\)[\s\S]*layout: \{[\s\S]*\.\.\.brushWorkspacePatternLayout[\s\S]*function rebuildBrushWorkspacePreview\(\)[\s\S]*proceduralBrushLayoutOffsets\(\{[\s\S]*\.\.\.brushWorkspacePatternLayout/);
  assert.match(source, /drawStrandBrushSizeInput\.addEventListener\("input"[\s\S]*const defaults = activeCreationShapeDefaults\(\)[\s\S]*defaults\.width = nextWidth[\s\S]*viewportEditMode === "brush"[\s\S]*scheduleBrushWorkspacePreview\(\)/);
  assert.match(source, /function bindLockInput\(key, parser = Number\)[\s\S]*const target = lock \|\| activeStrandShapeTarget\(\)[\s\S]*viewportEditMode === "brush"[\s\S]*scheduleBrushWorkspacePreview\(\)/);
  assert.match(source, /function applyShapePreset\(select\)[\s\S]*target\[targetKey\] = cloneShapePresetValue\(preset\.value\)[\s\S]*viewportEditMode === "brush"[\s\S]*scheduleBrushWorkspacePreview\(\)/);
  assert.match(source, /function brushWorkspaceForwardNormals\(points\)[\s\S]*points\.map\(\(\) => new THREE\.Vector3\(0, 0, 1\)\)[\s\S]*function rebuildBrushWorkspacePreview\([\s\S]*pointSurfaceNormals = brushWorkspaceForwardNormals\(points\)[\s\S]*surfaceNormalInfluence: 1/);
  assert.match(source, /function activeBrushWorkspaceStrandProfile\(\)[\s\S]*brushWorkspaceStrandProfiles\.length !== count[\s\S]*normalizeProceduralBrushStrandProfiles[\s\S]*return brushWorkspaceStrandProfiles\[brushWorkspaceActiveStrandIndex\][\s\S]*function openTaperCurveEditor\(curveKey = "taperCurve"\)[\s\S]*type: "brush-pattern"/);
  assert.match(source, /function proceduralBrushRecipeFromControls\(\)[\s\S]*strandProfiles: normalizeProceduralBrushStrandProfiles[\s\S]*function rebuildBrushWorkspacePreview\(\)[\s\S]*const profile = brushWorkspaceStrandProfiles\[index\][\s\S]*\.\.\.profile/);
  assert.match(source, /function syncBrushWorkspaceStrandCountBounds\(\)[\s\S]*value === "braid"[\s\S]*min = braid \? "2" : "1"[\s\S]*max = braid \? "5" : "16"[\s\S]*fallback = braid \? 3 : 1/);
  assert.match(source, /function applyBrushWorkspacePatternType\(patternValue\)[\s\S]*previousPattern = brushWorkspacePatternLayout\.pattern[\s\S]*nextPattern === "braid"[\s\S]*proceduralBrushBraidPreset\(3\)[\s\S]*brushWorkspaceStrandCountInput\.value = "3"[\s\S]*previousPattern === "braid"[\s\S]*proceduralBrushPatternPreset\("straight"\)[\s\S]*pattern: nextPattern,[\s\S]*strandCount[\s\S]*applyBrushWorkspacePatternType\(brushWorkspacePatternInput\.value\)/);
  assert.match(source, /input === brushWorkspaceStrandCountInput && brushWorkspacePatternInput\.value === "braid"[\s\S]*proceduralBrushBraidPreset\(input\.value\)[\s\S]*applyBrushWorkspaceRecipe\(braid/);
  assert.match(source, /function beginBrushWorkspacePatternDrag\(event\)[\s\S]*brushWorkspacePatternStrandIndex[\s\S]*brushWorkspacePatternPointIndex[\s\S]*function updateBrushWorkspacePatternDrag\(event\)[\s\S]*sectionPatterns\[drag\.strandIndex\] = moveProceduralBrushPatternPoint/);
  assert.match(source, /function beginBrushWorkspacePatternDrag\(event\)[\s\S]*selectableLines[\s\S]*brushWorkspacePreviewLocks\.map\(\(lock\) => lock\.mesh\)[\s\S]*brushWorkspaceActiveStrandIndex = selectedStrandIndex[\s\S]*syncBrushWorkspaceActiveStrandControls\(\)/);
  assert.match(source, /function rebuildBrushWorkspacePatternEditor\(placements = \[\]\)[\s\S]*strandIndex === activeStrandIndex[\s\S]*activeStrand \? 1\.14 : 0\.92/);
  assert.match(source, /function applyBrushWorkspacePatternTopologyEdit\(event\)[\s\S]*event\.ctrlKey && event\.altKey[\s\S]*event\.shiftKey && event\.altKey[\s\S]*removeProceduralBrushPatternPoint\([\s\S]*insertProceduralBrushPatternPoint\([\s\S]*function beginBrushWorkspacePatternDrag\(event\)[\s\S]*applyBrushWorkspacePatternTopologyEdit\(event\)/);
  assert.match(source, /function updateBrushWorkspacePatternDragPreview\(drag\)[\s\S]*brushWorkspacePendingGeometryDrag = drag[\s\S]*requestAnimationFrame[\s\S]*createHairGeometry\(pendingPreview\)[\s\S]*function updateBrushWorkspacePatternDrag\(event\)[\s\S]*updateBrushWorkspacePatternDragPreview\(drag\)/);
  assert.match(source, /function brushWorkspacePatternHandleScale\(\)[\s\S]*controlPointDisplaySize \* STRAND_CONTROL_POINT_DRAW_TOOL_SCALE[\s\S]*function rebuildBrushWorkspacePatternEditor\([\s\S]*new THREE\.SphereGeometry\([\s\S]*STRAND_CONTROL_POINT_RADIUS_SCALE[\s\S]*handle\.raycast = lockedPoint \? \(\) => \{\} : strandControlPointRaycast/);
  assert.match(source, /function rebuildBrushWorkspacePatternEditor\([\s\S]*proceduralBrushSectionPointLocked\([\s\S]*color: lockedPoint[\s\S]*brushWorkspacePatternPointLocked = lockedPoint[\s\S]*function beginBrushWorkspacePatternDrag\(event\)[\s\S]*hit\.object\.userData\.brushWorkspacePatternPointLocked/);
  assert.match(source, /function rebuildBrushWorkspacePatternEditor\([\s\S]*composed\.sections\.forEach[\s\S]*BRUSH_PATTERN_SECTION_COLORS\[segment\.section\][\s\S]*if \(!sectionActive \|\| !editableSegment\) return[\s\S]*brushWorkspacePatternPlacementT[\s\S]*brushWorkspacePatternAssemblyOffset/);
  assert.match(source, /const BRUSH_PATTERN_CURVE_SAMPLES_PER_SPAN = 8[\s\S]*function brushWorkspaceEvaluatedPatternSections\(composed\)[\s\S]*strandBaseCurve\(\{\}, controlPoints, \[\]\)[\s\S]*curve\.getPoint\([\s\S]*function rebuildBrushWorkspacePatternEditor\([\s\S]*brushWorkspaceEvaluatedPatternSections\(composed\)/);
  assert.match(source, /function beginBrushWorkspacePatternDrag\(event\)[\s\S]*placementT: hit\.object\.userData\.brushWorkspacePatternPlacementT[\s\S]*assemblyOffset:[\s\S]*function updateBrushWorkspacePatternDrag\(event\)[\s\S]*drag\.assemblyOffset[\s\S]*updateBrushWorkspacePatternDragPreview\(drag\)/);
  assert.match(source, /function applyBrushWorkspacePatternPreset\(presetId\)[\s\S]*presetId\.startsWith\("custom:"\)[\s\S]*normalizeProceduralBrushRecipe\(saved\.value\.proceduralBrushPattern\)[\s\S]*applyBrushWorkspaceRecipe\(recipe[\s\S]*proceduralBrushPatternPreset\(presetId\)[\s\S]*applyBrushWorkspaceRecipe\(preset[\s\S]*brushWorkspacePatternPresetInput\.value = preset\.id/);
  assert.match(source, /function applyBrushWorkspacePatternPreset\(presetId\)[\s\S]*applyCreationPresetSnapshot\(brushWorkspaceCreationDefaults, saved\.value, "strand"\)[\s\S]*applyCreationPresetSnapshot\(brushWorkspaceCreationDefaults, preset\.creationSettings, "strand"\)/);
  assert.doesNotMatch(source, /function applyBrushWorkspacePatternPreset\(presetId\)[\s\S]*?applyCreationPresetSnapshot\(strandCreationDefaults,[\s\S]*?\n\}/);
  assert.match(source, /const BRUSH_PATTERN_SECTION_COLORS = Object\.freeze\(\{[\s\S]*root: 0xffa34d[\s\S]*body: UI_ACCENT_COLOR[\s\S]*tip: 0xff4fd8/);
  assert.doesNotMatch(source, /brushStrokePip|BrushStrokePip|drawBrushWorkspaceStrokePreview|brushWorkspaceRepeatCount|brushPatternRepeatCount/);
  assert.match(source, /let brushWorkspacePatternCurveStep = 0\.8[\s\S]*function proceduralBrushRecipeFromControls\(\)[\s\S]*repeatCount: 4[\s\S]*curveStep: brushWorkspacePatternCurveStep[\s\S]*rootStrandPatterns:[\s\S]*tipStrandPatterns:/);
  assert.doesNotMatch(source, /brushWorkspaceCurveStep/);
  assert.match(source, /function proceduralBrushRecipeFromControls\(\)[\s\S]*bodyScaleY: brushWorkspaceBodyScaleYInput\?\.value[\s\S]*function applyBrushWorkspaceRecipe\(recipeValue[\s\S]*brushWorkspacePatternCurveStep = recipe\.curveStep[\s\S]*brushWorkspaceBodyScaleYInput\.value = String\(recipe\.bodyScaleY\)[\s\S]*brushWorkspaceBodyScaleYInput\?\.addEventListener\("input"[\s\S]*markBrushWorkspacePatternCustom\(\)[\s\S]*scheduleBrushWorkspacePreview\(\)/);
  assert.match(source, /function rebuildBrushWorkspacePatternEditor\(placements = \[\]\)[\s\S]*editableBodyRepeatIndex = Math\.floor\(repeatCount \/ 2\)[\s\S]*brushWorkspacePatternEditable = editableSegment/);
  assert.match(source, /function proceduralBrushTemplateForSamples\(template, samples\)[\s\S]*proceduralBrushRepeatCountForCurve\([\s\S]*strokeLength\(samples\)[\s\S]*recipe\.curveStep[\s\S]*proceduralBrushTemplateData\(recipe,[\s\S]*repeatCount/);
  assert.match(source, /function updateDrawStrandPreview\(\)[\s\S]*proceduralBrushTemplateForSamples\(activeDrawClumpTemplate\(drawStrandStroke\), samples\)[\s\S]*function createDrawnStrand\(stroke\)[\s\S]*proceduralBrushTemplateForSamples\(activeDrawClumpTemplate\(stroke\), processed\)/);
  assert.match(source, /function normalizeBrushWorkspacePatternSections\(strandCount\)[\s\S]*normalizeProceduralBrushSectionPatterns\([\s\S]*brushWorkspacePatternSections\.body[\s\S]*function applyBrushWorkspaceRecipe\(recipeValue[\s\S]*root: normalizeProceduralBrushSectionPatterns\([\s\S]*tip: normalizeProceduralBrushSectionPatterns\(/);
  assert.match(source, /function scheduleDrawStrandPreview\(\)[\s\S]*proceduralBrushTemplate[\s\S]*proceduralBrushPreviewUpdatedAt < 30/);
  assert.match(source, /function captureBrushWorkspaceViewport\(\)[\s\S]*brushWorkspaceVisibilitySnapshot = new Map\(\)[\s\S]*multiCameraEnabled[\s\S]*function restoreBrushWorkspaceViewport\(\)[\s\S]*brushWorkspaceVisibilitySnapshot\?\.forEach/);
  assert.match(source, /function addLock\(presetName, overrides = \{\}, options = \{\}\)[\s\S]*const transient = options\.transient === true[\s\S]*if \(transient\) \{[\s\S]*return lock/);
  assert.match(source, /if \(viewportEditMode === "brush"\) return;[\s\S]*beginDrawStrandStroke\(event, surfaceHit, extensionLock, branchStart\)/);
  assert.match(source, /function createCustomCreationPreset\(type\)[\s\S]*viewportEditMode === "brush" \? null : getSelectedLock\(\)[\s\S]*creationPresetSnapshot\(source, type\)/);
  assert.match(source, /if \(type === "strand" && viewportEditMode === "brush"\)[\s\S]*presetValue\.taperCurve = brushWorkspaceUniformProfileCurve\(\)[\s\S]*presetValue\.depthCurve = brushWorkspaceUniformProfileCurve\(\)/);
  assert.match(css, /body\.brush-workspace-active \.viewport-reference-images \{\s*display: none;/);
  assert.doesNotMatch(css, /brush-stroke-pip/);
  assert.match(css, /\.brush-pattern-section-tabs\s*\{[\s\S]*grid-template-columns: repeat\(3/);
  assert.match(css, /\.brush-type-tabs\s*\{[\s\S]*grid-template-columns: repeat\(2/);
});

test("preset workspace keeps the live hairstyle and exposes preset, strand, and mesh authoring views", async () => {
  const [html, source, css, shortcuts, localization] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../styles.css", import.meta.url), "utf8"),
    readFile(new URL("../modules/shortcut-registry.js", import.meta.url), "utf8"),
    readFile(new URL("../modules/localization.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /<option value="preset">Presets<\/option>/);
  assert.match(html, /id="presetWorkspaceBrowser"[\s\S]*data-preset-workspace-view="presets"[\s\S]*data-preset-workspace-view="strands"[\s\S]*data-preset-workspace-view="meshes"[\s\S]*id="presetWorkspacePresetView"[\s\S]*data-preset-workspace-tab="full"[\s\S]*data-preset-workspace-tab="front-bangs"[\s\S]*data-preset-workspace-tab="side-bangs"[\s\S]*data-preset-workspace-tab="sides"[\s\S]*data-preset-workspace-tab="back"[\s\S]*id="createPresetWorkspacePreset"[\s\S]*id="presetWorkspaceList"/);
  assert.match(shortcuts, /\["6", "preset"\]/);
  assert.match(source, /const nextMode = \["strand", "brush", "preset", "guide", "reference", "mesh"\]/);
  assert.match(source, /viewportEditMode = nextMode;[\s\S]*document\.body\.classList\.toggle\("preset-workspace-active", presetWorkspaceActive\)[\s\S]*presetWorkspaceBrowser\?\.classList\.toggle\("hidden", !presetWorkspaceActive\)[\s\S]*renderPresetWorkspaceBrowser\(\)/);
  assert.match(source, /if \(clearSelection && nextMode !== "preset"\)/);
  assert.doesNotMatch(source, /presetWorkspaceVisibilitySnapshot|capturePresetWorkspaceViewport|activatePresetWorkspaceViewport|restorePresetWorkspaceViewport/);
  assert.match(source, /function presetWorkspaceCatalog\(tab = activePresetWorkspaceTab\)[\s\S]*preset\.category === "full"[\s\S]*preset\.regions\.includes\(tab\)/);
  assert.match(source, /function syncPresetWorkspaceOutlinerView\(\)[\s\S]*presetWorkspacePresetView\?\.classList\.toggle\("hidden", activePresetWorkspaceView !== "presets"\)[\s\S]*lockList\.classList\.toggle\("hidden", activePresetWorkspaceView !== "strands"\)[\s\S]*meshOutliner\.classList\.toggle\("hidden", activePresetWorkspaceView !== "meshes"\)/);
  assert.match(source, /function renderPresetWorkspaceBrowser\(\)[\s\S]*preset-workspace-card[\s\S]*applyPresetSelection\(preset\.id\)[\s\S]*selectedPresetWorkspacePresetId = preset\.id/);
  assert.match(source, /async function deleteCustomHairstylePreset\(preset\)[\s\S]*window\.confirm[\s\S]*forgetHairstylePresetRecord\(preset\.id\)[\s\S]*presetCatalog\.splice[\s\S]*customHairstylePresetProjects\.delete[\s\S]*renderPresetWorkspaceBrowser\(\)[\s\S]*renderPresetLibrary\(\)/);
  assert.match(source, /function createCustomPresetDeleteButton\(preset\)[\s\S]*custom-preset-delete[\s\S]*Delete \$\{preset\.title\} preset[\s\S]*deleteCustomHairstylePreset\(preset\)/);
  const presetWorkspaceRenderer = source.match(/function renderPresetWorkspaceBrowser\(\)[\s\S]*?\n}\n\nfunction drawPresetThumbnail/)?.[0] || "";
  assert.doesNotMatch(presetWorkspaceRenderer, /createElement\("small"\)|Full Hair/);
  assert.match(html, /id="hairstylePresetSaveDialog"[\s\S]*id="hairstylePresetPreview"[\s\S]*id="hairstylePresetIncludeFull"[\s\S]*data-hairstyle-preset-region="front-bangs"[\s\S]*data-hairstyle-preset-region="side-bangs"[\s\S]*data-hairstyle-preset-region="sides"[\s\S]*data-hairstyle-preset-region="back"[\s\S]*id="confirmHairstylePresetSave"/);
  assert.match(source, /createPresetWorkspacePresetButton\.addEventListener\("click"[\s\S]*openHairstylePresetSaveDialog\(\)/);
  assert.match(source, /async function saveHairstylePresetFiles\(\)[\s\S]*hairstylePresetExportScopes\([\s\S]*captureHairstylePresetPreview\(scope\.lockIds, scope\.id\)[\s\S]*buildHairstylePresetFile\(scope, state, previewImage\)[\s\S]*downloadProjectFile[\s\S]*rememberHairstylePresetRecord/);
  assert.match(source, /function captureHairstylePresetPreviewModel\(lockIds\)[\s\S]*geometry\.attributes\.position\.array[\s\S]*lock\.mesh\.matrixWorld\.elements/);
  assert.match(source, /let presetPreviewRenderer = null;[\s\S]*function ensureInteractivePresetPreviewRenderer\(\)[\s\S]*new THREE\.WebGLRenderer[\s\S]*function animateInteractivePresetPreview\(timestamp\)[\s\S]*requestAnimationFrame[\s\S]*function configureInteractivePresetPreview\(shell, image, preset\)[\s\S]*Hover for a 3D preview/);
  const interactivePreview = source.match(/function configureInteractivePresetPreview\(shell, image, preset\)[\s\S]*?\n}/)?.[0] || "";
  assert.doesNotMatch(interactivePreview, /pointerdown|pointermove|wheel|setPointerCapture/);
  assert.match(source, /function renderPresetWorkspaceBrowser\(\)[\s\S]*preset-workspace-preview[\s\S]*configureInteractivePresetPreview\(previewShell, preview, preset\)/);
  assert.match(css, /\.preset-interactive-preview-canvas\s*\{[\s\S]*position: absolute;[\s\S]*inset: 0;/);
  assert.match(source, /function renderPresetLibrary\(\)[\s\S]*preset\.custom[\s\S]*customPresetCount[\s\S]*presetCatalog\.filter\(\(preset\) => preset\.custom\)/);
  assert.match(source, /async function applyPresetSelection\(presetName\)[\s\S]*customHairstylePresetProjects\.get\(presetName\)/);
  assert.match(source, /async function applyPresetSelection\(presetName\)[\s\S]*catalogPreset\?\.category === "elements"[\s\S]*mergeRegionalHairstylePresetState\(snapshotState\(\), presetState[\s\S]*regionIds: regionalScalpRegions[\s\S]*restoreState\(stateToRestore[\s\S]*if \(!regionalPreset\) currentProjectName/);
  assert.match(source, /function captureHairstylePresetPreview\(lockIds, scopeId = "full"\)[\s\S]*const width = 420;[\s\S]*const height = 420;[\s\S]*hairstylePresetPreviewView\(scopeId\)[\s\S]*preserveDrawingBuffer: true[\s\S]*toDataURL\("image\/jpeg", 0\.88\)/);
  assert.match(source, /\{ action: "workspace-preset", label: "Presets" \}/);
  assert.match(css, /body\.preset-workspace-active \.outliner-tabs\s*\{\s*display: none;/);
  assert.match(css, /\.preset-workspace-view-tabs\s*\{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.preset-workspace-tabs\s*\{[\s\S]*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.preset-workspace-list\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.preset-workspace-card\s*\{[\s\S]*grid-template-rows: minmax\(0, 1fr\) auto;[\s\S]*aspect-ratio: 1;/);
  assert.match(css, /\.preset-workspace-card > span:not\(\.preset-workspace-preview\)\s*\{[\s\S]*align-self: end;/);
  assert.match(css, /\.custom-preset-delete\s*\{[\s\S]*position: absolute;[\s\S]*\.custom-preset-delete svg\s*\{[\s\S]*stroke: currentColor;/);
  assert.match(localization, /"Presets":\s*"\\u30d7\\u30ea\\u30bb\\u30c3\\u30c8"/);
});

test("new project opens a guided cold-start flow and reuses the existing setup workspaces", async () => {
  const { html, source, css } = await settingsContractSources();

  assert.match(html, /id="newHairProject"[\s\S]*New Project/);
  assert.match(html, /id="newProjectSetupDialog"[\s\S]*data-new-project-step="0"[\s\S]*data-new-project-step="1"[\s\S]*data-new-project-step="2"[\s\S]*data-new-project-step="3"[\s\S]*data-new-project-step="4"/);
  assert.match(html, /name="newProjectCharacter"[\s\S]*id="newProjectImportHead"[\s\S]*id="newProjectImportBody"/);
  assert.match(html, /name="newProjectStart" value="blank"[\s\S]*name="newProjectStart" value="presets"/);
  assert.match(source, /async function beginNewProjectSetup\(\)[\s\S]*window\.confirm[\s\S]*restoreState\(JSON\.parse\(JSON\.stringify\(newProjectTemplateState\)\)\)[\s\S]*loadDefaultGuideModel\(\)[\s\S]*newProjectSetupDialog\.show\(\)/);
  assert.match(source, /function setNewProjectSetupStep\(step\)[\s\S]*newProjectSetupStep === 2[\s\S]*setHeadSetupEditing\(true\)[\s\S]*newProjectSetupStep === 3[\s\S]*setScalpBuilderEditing\(true\)/);
  assert.match(source, /function finishNewProjectSetup\(\)[\s\S]*start === "presets" \? "preset" : "strand"/);
  assert.match(css, /\.new-project-setup-dialog\s*\{[\s\S]*position: fixed;[\s\S]*bottom/);
});
