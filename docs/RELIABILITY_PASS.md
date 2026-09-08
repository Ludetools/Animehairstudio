# Reliability pass — 2026-09-04

## Contract

Scope: verifier, regression tests, local save safety, support-edge topology, and project guidance. No new controls, project schema, defaults, brush settings, group inheritance or mirror rules. Preserve current native dialog and file formats. Changes to hair-shell derived topology retain triangle/quad rendering and indexed OBJ export. Existing authored projects regenerate through the existing geometry path; no migration is introduced.

## Delivered

- Created a local source-only Git checkpoint before changes. Assets, archives and experiments remain untracked and untouched; this is not a complete asset backup or a remote backup.
- All test files are discovered by the verifier. Added pinned ESLint/no-undef checks and corrected the two undefined names it found.
- Updated outdated plain-sweep/support-rail tests, retaining closed-edge/winding checks. Fixed the exposed support-edge T-junction; render-buffer retention, nondegenerate triangles and OBJ indices are checked too.
- Added controller execution tests for direct mesh edge-mode entry, selection/removal, re-entry, Alt bypass and leaving extrusion. Rendering and raycasting are fixture doubles, not browser verification.
- Extracted native file replacement into `server/write-project.cjs`. Writes use unique temporary files and flush before rename. Failed replacements never delete the original; completed recovery copies remain available.
- Added temporary-file failure injection and isolated HTTP tests. Restricted local origins/hosts and public static paths; malformed URLs and save payloads return errors instead of throwing.
- Consolidated live-review policy, shortened the feature skill, documented regression diagnosis and mesh-edit owners, and updated preset file guidance to `.ahs`.

## Deliberately staged follow-up

### Edge-loop CPU optimisation

Contract: optimise only `polyEdgeLoopEdges` while preserving ordered results, face validation/deduplication, seed orientation, and stopping at ambiguous junctions. No changes to geometry, UI, defaults, mirroring, undo, project files, presets, picking or gesture handling. Adjacency is rebuilt per query, avoiding cross-edit cache invalidation risks.

Each unique edge is now registered once per endpoint; traversal uses incident edge records directly instead of repeatedly allocating sets and looking up edge keys. A frozen pre-optimisation oracle under `tests/helpers/edge-loop-reference.mjs` checks result parity on grids, closed periodic surfaces, invalid/duplicate faces, nonmanifold junctions and same-array topology edits. Do not update that oracle to follow production optimisations.

The benchmark compares both implementations on the same fixtures. One local 16,384-quad run measured 22.8 ms versus 30.5 ms (about 25% less CPU time); the 4,096-quad case was effectively unchanged. These are diagnostic timings, not CI thresholds or end-to-end viewport speedups. Live browser picking was not exercised; review by double-clicking horizontal and vertical loops, including after a loop cut.

### Mesh-selection extraction follow-up

Extracted the polygon mesh's vertex/edge/face click-selection transition to `modules/mesh-selection.js`. Contract: preserve replacement/Ctrl-add/Shift-remove semantics, edge orientation identity, shared vertices, selection order, and ignore conflicting modifiers. No new controls or authored state; existing objects use the same adapter. Groups, mirroring, undo, project files, presets, geometry/export, raycasting and pointer capture are unchanged. The adapter still owns applying state and refreshing derived views.

Focused tests exercise all three component types, reversed/adjacent edges, cross-mesh isolation and input immutability; the production-controller runtime fixture imports the actual extracted module. Source-text contracts now check adapter wiring rather than reasserting the extracted implementation. Real viewport accuracy is not claimed by these tests. Review scenario: enter Edge mode directly on a primitive, select two adjacent edges with Ctrl, remove one with Shift, and confirm its shared vertex remains selected via the remaining edge.

Follow-up: polygon and hair-shell marquee and double-click edge loops now use the same pure batch transition. Contract: retain through-selection, loop traversal, Ctrl/Shift semantics, selection order and empty-drag behaviour. Adapters keep mesh/mode filtering, the separate hair-shell face source and all existing refresh/capture/undo calls. No geometry, UI, defaults or saved state changes. Added batch and production-adapter tests and a diagnostic CPU benchmark (`node scripts/benchmark-mesh-selection.mjs`) on fixed grids; no performance thresholds or renderer speedup claims.

This is not a completed extraction of the entire mesh controller. Hair-shell single-click selection, live rendering profiles and procedural-brush ownership remain follow-up work. Live review scenario: drag across each component mode (including back-facing components), then double-click an edge and Shift-double-click it to subtract the loop. Browser review was not run for these extractions.

### Brush tool-context extraction

Pattern-placement follow-up (builder separation explicitly excluded): `radial-draw` shape controls and template construction now resolve the same session-only, deep-copied preset settings. Missing preset fields use an initial independent fallback, never currently edited Draw Strand defaults. Preset selection/reapplication resets that working copy; invalid preset IDs preserve the active preset. Shape preset refresh recognises the placement owner. Both builders and selected-object/group behaviour are unchanged. No new controls, schema fields, undo semantics, mirror logic, preview geometry algorithms or export topology changes. Existing generated strands keep their authored values; new strokes consume the placement snapshot through the existing template path.

Executable production-function tests cover switching among Draw Strand, Pattern, Accessory and the builder; twist input edits/default resets; preset reapplication, invalid IDs, missing-field fallbacks and curve-copy isolation. Existing stroke-bank tests cover independent shared controls. These are controller tests, not live click/render/save/load verification. User-led check: change pattern twist, switch to Draw Strand and back, reset twist, then reapply the pattern preset; Draw Strand values should remain unchanged.

Follow-up contract: keep Draw Strand, Pattern placement, Accessory placement and the two builder styles' shared stroke controls in independent session banks. Preserve initial HTML defaults and existing-object behaviour; changing tools updates controls/readouts only, with no dispatched edits, history steps or geometry refresh. Surface selection remains intentionally shared. Banks are transient, not new project/preference/preset schema fields; existing object snapshots, undo, group inheritance, mirrors, export and pattern-step/size-curve owners are untouched. Builder shape targets now resolve to builder creation defaults rather than Draw Strand defaults. Applying an ordinary Draw Strand preset ignores its legacy pattern-editor fields; existing procedural preset loading still uses the dedicated recipe path. Verify tool/workspace round trips, preset isolation and independent curve copies with executable controller tests.

This pass does not replace the entire brush preset subsystem. Accessory and pattern builder shape defaults still share the existing builder owner, and legacy pattern-placement shape controls need a separate ownership audit. Live scene drawing/save/load was not exercised; session banks intentionally reset on a fresh application load. User-led review: set different sizes/smoothing/curve steps for Draw Strand, Pattern and Accessory, alternate tools and builder styles, and load a Draw Strand preset after editing a pattern. Confirm retained values and that the pattern and Draw Strand profiles remain independent.

Contract: consolidate existing panel visibility, tab selection and tab routing for Draw Strand, Pattern Brush and Accessory Brush. The source remains transient `viewportEditMode`, `activeTool` and `brushWorkspaceStyle`; retain current defaults and labels. Builder tabs change editor style without changing the viewport tool and finish an active pattern drag before refreshing the preview. Placement tabs switch only between the two procedural tools; Draw Strand ignores them. Existing objects, groups, mirrors, undo, save/load, presets and export/topology are unchanged; no geometry or new authored fields. Pointer capture and keyboard handlers remain untouched.

`modules/brush-tool-context.js` now owns the shared pure context/routing rules. Executable tests cover the mode/tool/style matrix and run the production tab controllers with boundary doubles for panel, preview and tool activation effects. They do not verify real DOM layout or downstream preset application. This is a context extraction, not full brush default/preset ownership separation. User-led review: alternate Pattern/Accessory tabs, return to Draw Strand, then switch builder tabs while editing; confirm contextual controls and previews remain correct. No live browser review was performed for this pass.

The broad application extraction and performance work from the audit is not complete. Do those as behaviour-preserving changes after this foundation:

1. Exercise real viewport picking, drag/cancel/orbit and undo in an isolated browser scene, following the verification matrix's approval policy.
2. Profile dense-scene selection, point drags and topology edits separately. Record overlay rebuild calls, allocations and frame timings before choosing cache boundaries.
3. Extract the mesh-selection controller and procedural-brush setting ownership one at a time. Reuse the executable regression scenarios; do not rewrite the whole application.
4. Establish an intentional policy for versioning large assets and a remote/offline backup, with user direction on destination and privacy.

The running server must be restarted to use the server changes; do not interrupt the user's process automatically. Native-dialog interaction, real browser picking and downstream DCC import remain live review items. Skill metadata was checked with the installed YAML parser; the system Python skill validator could not run because PyYAML was unavailable.
