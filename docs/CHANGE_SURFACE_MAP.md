# Targeted change surfaces

Use this map before searching broadly through `app.js`. Start with the owning boundary, then inspect only its callers and listed consumers. Expand the search only when the feature contract crosses another surface.

## Keyboard shortcuts

- Owner: `modules/shortcut-registry.js` for tool-key lookup and focused-control policy.
- Coordinator: the capture-phase key handlers in `app.js` execute commands and manage pointer/tool state.
- Consumers: shortcut help in `index.html`, navigation tips, localization, radial tool handling, and DOM contract tests.
- Rule: add or rename a shortcut in the registry first, then update its visible help and focused-input behavior in the same change.

## History and restoration

- Owner: `modules/history.js` stores bounded history and the ordered restore-refresh registry.
- Coordinator: `snapshotState`, `pushUndoState`, `undoLastAction`, `redoLastAction`, and `restoreState` in `app.js`.
- Consumers: registered `restoreRefreshes` callbacks near history initialization.
- Rule: capture one undo boundary per committed gesture. When a derived editor or helper must reflect restored state, register its refresh once instead of adding an isolated call inside `restoreState`.

## Selection

- State transitions: `modules/selection-state.js` owns strand-selection replacement, Ctrl-add, Alt-remove, restoration, clearing, and active-target changes.
- Coordinator: selection identifiers, raycasting, and object-type routing remain in `app.js`; `refreshStrandSelectionConsumers` is the single strand-selection refresh boundary.
- Workspace routing: `viewportEditMode` chooses Strands, Guides, or References. `viewportSelectionMode` chooses Object or Component editing inside that workspace; References are object-only.
- Inputs: Three.js raycasting, outliner actions, marquee selection, and keyboard modifiers.
- Consumers: viewport highlights, curve/control handles, transform controls, attribute editor, outliner, status text, and contextual windows.
- Rule: keep hit testing separate from selection semantics. Add selection behavior to the pure state transition first, route its result through `applyStrandSelectionState`, then call `refreshStrandSelectionConsumers` once after the committed selection change.
- Object-transform rule: the active strand root hosts the gizmo. Rotation and scale use each selected strand root as its pivot (or the shared clump root for whole-clump selection), and one gizmo drag creates one undo step while refreshing attachment, clump-rest, mirror, and geometry consumers.

## Mesh component editing

- Mode owner: `setMeshEditMode`; `meshEditModeActive` routes object, vertex, edge, face and curve modes within the Mesh workspace.
- Entry refresh: `refreshSelectionModeVisuals` clears transient edits, detaches gizmos and refreshes selected overlays. It calls `clearHairShellComponentSelection`, which also refreshes the operations panel. Exceptions there can prevent picker creation.
- Picking: `polyTargetAtEvent` / `polyScreenEdgeHitAtEvent`; click-selection semantics: `modules/mesh-selection.js`; adapter: `selectPolyMeshComponentAtEvent`; operation context: `selectedMeshEdgeOperationContext`.
- The click adapter passes the current component and control-point selections into `meshComponentSelectionAfterPick`, applies its result once, then keeps the existing overlay and marquee refresh order. A null result ignores the gesture; a result with `component: null` clears selection.
- `meshComponentSelectionAfterMatches` owns batch merging for polygon/hair-shell marquee and double-click edge loops. Adapters retain mode/mesh filtering, hair-shell face-selection ownership, loop traversal, screen-space matching, and refresh/gesture sequencing. Hair-shell single-click selection remains separate.
- `node scripts/benchmark-mesh-selection.mjs` measures pure batch merging and loop traversal on fixed grids. It excludes viewport projection, raycasting, overlay allocation and GPU cost; use a separate live profile before optimising those.
- Display: `populatePolyEditObjects`, `rebuildPolyEditObjects`, `syncPolyEditObjectKinds` and `refreshPolyMeshComponentSelection`.
- Topology operations: `meshOperationTopology`, `meshTopologyOperationAllowed`, `commitMeshOperationTopology`; pure algorithms: `modules/poly-topology.js`.
- Regression fixture: `tests/mesh-mode-runtime.test.mjs`. Test direct Object -> Edge entry with nothing selected, selecting/removing an edge, repeated entry, and leaving extrusion. Keep raycast accuracy distinct from controller correctness.
- Future extraction: move one controller/owner at a time with the same transition tests; measure overlay rebuild costs before introducing caching or dirty flags.

## Materials

- Defaults: `modules/app-config.js`.
- Shader algorithms: `modules/anime-hair-shaders.js`.
- Current coordinator: material definitions, Three.js construction, user refresh, editor synchronization, snapshots, and restoration in `app.js`.
- Rule: shared material edits update the resource once and refresh every user; do not copy material settings into individual strands.

## Project loading

- Envelope validation: `modules/project-schema.js`.
- Current data adapters and restoration: `snapshotState`, `buildHairProjectFile`, and `restoreState` in `app.js`.
- Required order: assets/scalp, shared resources, guides/surfaces, strands, links, derived UI, transient-state reset.
- Rule: loading and undo share authored-state restoration, but project loading may additionally restore assets and establish a new history baseline.

## Generated geometry

- Reusable algorithms already live in focused `modules/` files.
- Current Three.js buffer construction and geometry dispatch remain in `app.js`.
- Consumers: viewport mesh, wire overlays, raycasting, UV inspection, mirroring, snapshots, OBJ, and USDA export.
- Rule: extract one geometry family at a time. A generator should accept plain authored data and return geometry data plus required topology metadata without reading DOM or global application state.

## Safe extraction order

1. Shortcut lookup and restore refresh orchestration.
2. Selection state transitions and centralized selection-consumer refresh.
3. Material state transformations and user calculation.
4. Project snapshot normalization and phased restoration plans.
5. Geometry families, extracted only alongside focused topology tests.
