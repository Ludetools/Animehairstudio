# Anime Hair Studio agent guidance

## Start here

- Read `ARCHITECTURE.md` before changing application structure.
- For ordinary feature work, follow `docs/FEATURE_CHANGE_PLAYBOOK.md`.
- Read `docs/STATE_AND_PROPAGATION.md` when a change affects defaults, groups, instances, mirroring, undo, presets, or project files.
- Read `docs/GEOMETRY_CONTRACTS.md` before changing generated geometry, profiles, guides, shading attributes, or export topology.
- Use `docs/CHANGE_SURFACE_MAP.md` to begin recurring selection, shortcut, history, material, loading, or geometry work at its narrowest owner.
- Use `docs/VERIFICATION_MATRIX.md` to choose the required checks.
- Use the repo skill `$change-anime-hair-feature` for feature changes and `$author-anime-hair-preset` for hairstyle preset work.

## Project shape

- `app.js` coordinates DOM controls, Three.js scene objects, interactions, and application state.
- Put reusable state-free geometry algorithms and data transformations in focused files under `modules/`, with tests.
- Keep HTML structure in `index.html` and presentation in `styles.css`.
- `server.js` is CommonJS and provides the local save/export service. Do not convert the root project to ESM.
- Treat `archive/pre-modularization-2026-07-19/` as read-only historical recovery material.
- Do not edit `.pnpm-store/`, runtime logs, or `.anime-hair-studio-port` as part of source changes.

## Change rules

- Use the micro-UI fast path only for isolated copy, static HTML, or CSS changes that do not alter JavaScript behavior, controls/IDs, interactions, state, undo, persistence, geometry, shaders, exports, or server behavior. Inspect the authoritative visibility/readout logic, make the smallest patch, update one focused contract test, and skip unrelated lifecycle work.
- Define the feature contract before editing: applicable tool/mode, UI location, source of truth, default, existing-object behavior, group inheritance, mirroring, undo, save/load, presets, preview, export/topology impact, interaction, and acceptance checks.
- Make contextual tool settings appear before object attributes in the right attribute editor. Hide settings outside the modes where they apply.
- Never expose a control unless its value is authoritative in the underlying behavior.
- When adding an editable parameter, trace every applicable propagation surface. Do not assume updating the UI and geometry is sufficient.
- For multi-strand width or depth edits, keep generated number inputs, range sliders, and viewport width-edge drags on the same full-selection transaction; verify that unequal starting dimensions all receive the same delta.
- Preserve selection, camera orbit, pointer capture, keyboard shortcuts, transform space, undo boundaries, and contextual visibility when changing interactions.
- Treat focused dropdowns and range sliders as transient focus for recognized viewport shortcuts; preserve normal editing behavior for text and number fields and for slider navigation keys.
- Preserve winding, normals, welding, UVs, vertex colors, quad metadata, caps, watertightness claims, and export behavior when changing geometry.
- Keep experiments isolated behind one removable path. Do not add durable schema or preset fields until the behavior is accepted unless the experiment specifically requires persistence.
- When removing a failed feature, remove its UI, events, state, serialization, mirroring, raycasting, geometry path, hints, and tests together.
- Update these instructions when the same correction is needed more than once.

## Validation

- For a qualifying micro-UI change, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-micro-ui.ps1 -TestNamePattern "<focused DOM test name>"`. Add `-IncludeLocalization` when translation data changes. A live browser check is optional when the existing JavaScript behavior is already authoritative and the CSS/copy result is unambiguous.
- Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-project.ps1` after every non-micro source change and before releases or after batching micro changes.
- Add or update focused module tests for reusable algorithms and data transformations.
- Add or update DOM contract tests when controls, IDs, shortcuts, or retired entry points change.
- Follow the canonical live-review and isolated-test policy in `docs/VERIFICATION_MATRIX.md`.
- For regressions, follow the playbook's debugging route. After a failed fix, gather fresh evidence and execute the failing transition; source-text matches alone do not verify interactions.
- For persistence changes, exercise save/load and undo; also exercise mirroring, groups, and presets when affected.
- For geometry or export changes, inspect representative output rather than relying only on a syntax check.
- Report checks actually performed and any checks skipped.
- A secondary agent may run the full verifier in parallel with other useful work on a larger task. Do not spawn an agent solely to run the roughly ten-second baseline; run it directly and inspect its exit code and failures.

## Running the app

- Launch with `Start Anime Hair Studio.cmd`, or run `Start Anime Hair Studio.ps1` directly.
- The launcher finds an available port from 5173 through 5189 and exposes `/api/health`.
- Use the local HTTP URL for native save and export flows; opening `index.html` directly does not provide the save service.
