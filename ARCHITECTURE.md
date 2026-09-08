# Anime Hair Studio architecture

`app.js` remains the application coordinator while reusable, state-free logic lives in `modules/`.

- `modules/strand-constraints.js`: pull-chain solving.
- `modules/curve-math.js`: taper interpolation, attribute sampling, and adaptive curve density.
- `modules/curve-lattice.js`: reusable default lattice layouts.
- `modules/obj-export.js`: quad-aware OBJ face reconstruction.
- `modules/project-schema.js`: project envelope creation, naming, and validation.
- `modules/project-state.js`: snapshot filtering/cloning and normalized restore plans for counters, visibility, resources, scene collections, and transient selection targets.
- `modules/file-drop.js`: file-name routing for application-level `.ahs` and `.obj` drops.
- `modules/recent-projects.js`: bounded, deduplicated recent-project snapshots stored in IndexedDB.
- `modules/hairstyle-preset-storage.js`: full custom preset records plus an atomic lightweight catalog; startup reads catalog metadata and loads details on demand.
- `modules/lazy-remesh-job.js`: cancellable first-use import of Curve Union Low/Medium/High Effort runtimes; see `docs/STARTUP_LOADING.md` for loading boundaries and timing stages and `docs/CURVE_UNION_EFFORTS.md` for engine mapping.
- `modules/preference-storage.js`: resilient browser preference reads, normalization, and writes.
- `modules/workspace-layout.js`: bounded panel widths and zoom-aware resize arithmetic; DOM coordination stays in `app.js`. See `docs/WORKSPACE_LAYOUT.md`.
- `modules/object-transform.js`: normalized object-transform deltas and legacy transform restoration adjustments.
- `modules/poly-topology.js`: authored polygon validation, bridging, deletion, boundaries, and render buffers. `modules/polygon-triangulation.js` triangulates concave n-gons without changing authored faces; see `docs/MESH_NGONS.md`.
- `modules/app-config.js`: immutable regions, layers, material defaults, and shape profiles.
- `modules/history.js`: bounded undo history storage and the ordered registry of derived views refreshed after restoration.
- `modules/shortcut-registry.js`: authoritative tool-key lookup and focused-control shortcut policy.
- `modules/selection-state.js`: pure strand-selection replacement, modifier, restoration, and active-target transitions.
- `modules/mesh-selection.js`: pure vertex/edge/face click-selection and batch marquee/edge-loop transitions, including additive/subtractive modifiers and component identity. Raycasting, gesture capture and derived-view refresh stay in `app.js`.
- `modules/brush-tool-context.js`: brush panel visibility and tab routing.
- `modules/brush-settings-state.js`: session-only ownership of shared stroke controls; DOM readouts and switching remain in `app.js`.
- `modules/selection-sets.js`: pure selection-set naming, member normalization, and record creation.
- `modules/radial-layout.js`: count-aware radial-menu angles and adaptive menu dimensions.
- `modules/material-state.js`: normalized material definitions, fallback resolution, and material-user counts.
- `tests/core-math.test.mjs`: regression coverage for these modules.
- `server/write-project.cjs`: flushed, unique temporary saves with non-destructive replacement failure; CommonJS like the server.
- `tests/mesh-mode-runtime.test.mjs`: executable mesh-mode controller regressions with explicit rendering/picking doubles.
- `tests/server.test.mjs`: isolated HTTP and temporary-file save failure tests.

The canonical verifier discovers every `tests/**/*.test.mjs` and runs undefined-name linting. Development dependencies are pinned in `package.json` and `pnpm-lock.yaml`; the application and local server still require no installed npm runtime dependencies.

New code should stay in `app.js` only when it directly coordinates DOM controls, Three.js scene objects, or application state. Geometry algorithms and data transformations should be added to a focused module and tested independently.

`restoreState` is the restoration coordinator. Its named phases reset transient interactions, clear the old editable scene, restore shared/scalp state, rebuild scene collections, validate and reapply selection, then run the registered derived-view refreshes. Preserve that call order when extending project loading or undo restoration.

The pre-refactor application is archived under `archive/pre-modularization-2026-07-19/`.
