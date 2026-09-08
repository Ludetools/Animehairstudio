# Anime Hair Studio Version 1.0.0 Patch Notes

Versioned September 8, 2026. Not yet packaged or published by this update.

## New features

- **Grease Pencil**  
The References workspace now includes Grease Pencil for sketching hairstyle ideas directly in the viewport. Draw on the background or the Front, Back, Left and Right reference layers, with adjustable brush size, smoothing and colour. An eraser removes unwanted strokes, and the viewport eyedropper lets you sample a colour from the scene.

- **Reference Shape Tool**  
The Shape tool lets you block out filled reference silhouettes with a closed lasso. Draw to add a shape and hold Shift while drawing to trim it, making it easier to plan larger hair masses alongside line sketches.

- **Mesh Editing Workspace**  
The Meshes workspace provides direct object, vertex, edge and face editing for modelling meshes. Work on the underlying polygon shape rather than only adjusting a strand’s center curve, with contextual tools and component selection.

- **Mesh Primitives**  
Cube, Plane, Cylinder and Sphere primitives can be added from the mesh toolbar. Their initialization settings provide a starting shape for mesh modelling inside AHS.

- **Poly Brush**  
Poly Brush lets you place and edit quad geometry on the active Live Surface. Add vertices, move components along the surface, draw connected strips, insert loops, relax geometry, and weld nearby vertices. Supported gaps can be previewed and filled while building the mesh.

- **Curve-Driven Face Extrusion**  
Face Extrude extends a selected mesh face along a drawn curve. This gives the extrusion an editable path for shaping longer forms instead of restricting it to a straight extrusion.

- **Standard Face Extrusion**  
Standard Extrude lets you drag a selected mesh face along its normal. A dedicated settings panel keeps the extrusion controls together while you work in the viewport.

- **Loop Cut and Edge Operations**  
Loop Cut previews and inserts a loop through compatible quad topology. Mesh Operations also includes Bridge Two Boundary Edges for connecting open edges and Set Edge Flow for relaxing selected edge vertices toward the surrounding quad flow.

- **Back Hair Mesh and Connected Strand Shell**  
The Meshes menu includes Back Hair Mesh and Connected Strand Shell creation commands. These provide additional starting points for building larger connected hair forms with mesh-editing tools.

- **Draw Capsule Guide**  
Capsule guides can now be drawn along a curve. Curve Step controls the spacing of the lengthwise cage loops, while Root, Middle and Tip profile settings shape the guide’s width and depth along its length.

- **Adaptive Remeshing**  
Auto Remesh Strands can retain a relationship to its source strands through Adaptive Remesh. Editing a source regenerates the connected result using Low Effort, so the original curves remain useful for shaping the remeshed form.

- **Pattern Types and Sections**  
Pattern brushes support Linear, Radial and Braid arrangements with editable strand counts and reusable pattern presets. Body, Root and Tip sections let you work on the repeating portion and optional end sections separately.


- **Curve Lattice Meshes**  
Selected strands can now be connected into an editable curve lattice mesh. Strand roots form the top edge and tips form the bottom, with the curves ordered across the surface. The original strands are retained and can be hidden while you work on the lattice.

- **Curve Lattice Guides**  
You can also create a guide from selected strands and use its smooth surface as a Live Surface. Guide creation leaves the original strands visible by default, with an option to hide them. Horizontal and Vertical Loops can be adjusted directly from the guide settings.

- **Pattern Brush Editing**  
The Brushes workspace lets you shape the strands that make up a repeating pattern. Neighbour Segments shows a repetition above and below the editable body, making it easier to check how the pattern connects as you move its control points.

- **Mesh Bevel Tool**  
The Meshes workspace includes a Bevel tool for selected edges, available from the toolbar and radial menu. Drag to adjust the bevel width and use the segment setting to add smoother transitions. Preview changes before committing, cancel an edit, or undo the completed operation.

- **Remeshing Effort Levels**  
Auto Remesh Strands now offers Low, Medium and High Effort. Low prioritizes speed, Medium balances speed and quality, and High adds further guarded topology refinement. Medium is the default, while Adaptive Remesh uses Low for faster updates. All three levels run in the background, and pending manual jobs can be cancelled.

- **Export Selection to OBJ**  
Selected strands and meshes can now be exported without exporting the whole hairstyle. The selection determines what is included, so selected hidden objects are still eligible for export.

- **Curve Normal Repair**  
Fix Curve Normals is available for selected strand, panel and braid curves. Rebuild Curve can also rebuild normals, and Reset Point Rotations clears unwanted point rotation that can continue to twist a strand after its normals are rebuilt.

- **Green Backface Debug View**  
The Debug menu can highlight back-facing geometry in bright green. This makes it easier to inspect reversed surfaces and unwanted twists while checking a strand or mesh.

- **Experimental Reference-to-Curve Tool**  
Selected portions of a reference image can be traced into curves through the experimental Select to Curve workflow. This provides a starting point for reference-driven shaping rather than automatically reconstructing an entire hairstyle.

- **Experimental Accessory Brush Builder**  
Accessory Brushes can be enabled through the experimental dev-test settings. The builder provides bundle recipes for a main shape and supporting strands, with straight, curved and side-by-side previews. This remains an experimental workflow.

## UI changes

- **Dedicated Keyboard Shortcut Settings**  
Keyboard Shortcuts has its own entry in Settings. Tool and workspace bindings can be customized, with a reorganized shortcut reference for looking up commands.

- **Refined Panel Controls**  
Panel tabs, sliders and reset controls use a more consistent layout. Sliders use a slim light-grey fill, while active tools and toggles share the blue selection colour.

- **Collapsible Side Panels**  
Side panels can be collapsed by dragging their edge past the collapse threshold. Small edge tabs remain available to expand them again without leaving a full-height collapsed panel in the viewport.

- **Startup Progress**  
A compact AHS loading panel shows the stages of workspace preparation, making it easier to see what the application is loading before the editor is ready.

- **Attached Glass Panel Style**  
Preferences includes an Attached Glass appearance that connects the upper panels and viewport controls to the title bar. The separate Glass Panels style remains available for the floating-panel layout.

- **Better Tool Settings Placement**  
Floating tool settings use the available viewport space more carefully and avoid covering the performance box. Longer settings panels can scroll instead of extending beyond their available height.

- **Clearer Selection Feedback**  
The attribute editor identifies the current selection and provides an empty-state explanation when no strand is selected. Workspace and tool context are shown in the status area, and unequal numeric settings display Mixed instead of implying that every selected object has the same value.

## Tweaks and quality of life

- Horizontal and Vertical Loop settings update curve lattices automatically without an Apply button.
- Lattice meshes and guides have a normal-offset control for pushing control points outward or inward along their normals.
- Selected guides can be seen through strands, and guide control points follow the shared control-point size preference.
- Curve rebuilding includes an option to rebuild normals, with point-rotation reset available for correcting unwanted authored rotation.
- Mixed numeric values are identified when a selection contains objects with different settings.
- Accessory Brush and Curvy remain available as experimental dev-test features rather than being part of the standard workflow.
- Shortcut editing includes conflict detection, explicit key swaps, individual resets and Reset All. Save activates the changes; Cancel leaves the current bindings intact.
- Ctrl adds to selection and Shift removes from selection in the updated click and drag-selection workflows.
- Multi-strand width and depth edits apply the same change across the selection, preserving differences between the starting values.
- Shared sliders and their numeric fields group an edit into one Undo step. Escape cancels an active supported control edit, and simply focusing a field no longer adds an Undo entry.
- Connected mesh edges, loops and corners can be beveled together. Hold Shift during a bevel drag for finer width adjustment.
- Curve lattice creation is available from the strand radial menu as well as the Curves menu.
- Draw Strand, Pattern and Accessory stroke settings retain independent session values when switching between their tools.
- Custom hairstyle presets load their catalog first, with full project data and preview buffers requested when needed.
- Braid and chain OBJ assets load on first use, and the larger remeshing runtimes load when requested rather than during startup.

## Bug fixes

- Curve lattice ordering and control-point visibility have been corrected, including mirrored lattice wireframes.
- Curve lattice settings no longer remain visible when an unrelated object is selected.
- Tested malformed project files are rejected without clearing the active scene, and later restoration failures attempt to restore the previous state.
- Manual remesh results with no adaptive settings can be included safely in subsequent history snapshots.
- Cancelled or superseded remesh jobs cannot replace the current preview. High Effort results that fail its geometry safety checks cannot be confirmed.
- Mesh bevel now replaces the selected crease with bevel faces rather than only inserting a support loop.
- Changing lattice loop counts several times during one edit retains the starting grid for cancellation and Undo.
- Draw Strand presets no longer overwrite pattern-builder data through legacy preset fields.
- Procedural brush tabs respect the active workspace and no longer redirect unrelated Draw Strand controls.
- Viewport totals count visible authored meshes, respecting hidden parent objects instead of reporting hidden geometry as visible.
