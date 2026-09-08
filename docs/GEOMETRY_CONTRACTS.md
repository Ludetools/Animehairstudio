# Geometry contracts

Read this before changing generated meshes, curve sampling, guides, profiles, materials that require attributes, or exporters.

## Global invariants

- Editable mesh faces may be triangles, quads or n-gons. Preserve complete face arrays through normalization, history and export. Use the polygon triangulator and retain triangle-to-authored-face IDs for selection; do not assume two triangles per face. `renderQuadFaces` references split render vertices while `quadFaces` retains authored vertex indices. OBJ prefers render indices when present. Quad-only operations must stop safely at n-gons, retaining their boundary vertices.

- Rendered triangle buffers may represent a conceptual quad surface. Preserve `geometry.userData.quadFaces` or valid paired-side-triangle metadata when OBJ output is expected to contain quads.
- Use consistent outward winding. Verify front-face rendering with back-face culling enabled.
- Orient root and tip caps from the actual curve tangent, not assumed profile winding.
- Preserve required attributes: position, normal, UV, vertex color, and any tangent or custom shader data.
- Recalculate or intentionally preserve normals after welding or deformation.
- Distinguish genuine indexed welding from vertices that merely share a position.
- Keep topology rows and columns ordered. Parameters that can cross rows or create uneven boundaries need clamping or snapping.
- Preserve stable frames along curves. Use gradual/parallel-transport-style orientation through bends and inflections rather than recomputing an unstable frame independently at each sample.
- Validate mirrored winding, asymmetric controls, and profile orientation.
- Treat viewport wire overlays and exported topology as separate representations of the same authored structure.

## Strands

Authored inputs include the center curve, width/depth or taper curves, strand profile, density, material assignment, attachment data, and optional split controls.

Verify:

- Root remains attached while length and shape changes affect the intended curve region.
- Profile orientation changes smoothly through bends.
- Linear profile controls produce the promised crease on both adjacent segments where applicable.
- Taper remains ordered, bounded, and anchored at its endpoints.
- Root and tip caps face outward.
- UV length direction follows the strand and anisotropic/tangent data follows hair flow.
- Split branches are closed or explicitly documented otherwise.
- Radial and along-curve density changes preserve shape, profiles, caps, and export metadata.

## Panel strands

Panel meshes are procedurally thickened surfaces with lengthwise and crosswise topology.

Verify:

- Front and back winding face outward.
- Thickness sides connect the corresponding boundaries.
- Width and depth curves are sampled monotonically along the panel.
- Split/zipper positions respect topology rows when snapping is enabled.
- Minimum loop count remains compatible with zipper count.
- Connected regions that promise welding share actual indexed vertices before normal calculation.
- Intentional front/back normal separation is preserved while unwanted shading seams are smoothed.
- Edge trimming cannot reverse row order or produce self-crossing quads.
- Quad faces, UVs, colors, and OBJ metadata survive deformation and welding.

## Capsule and scalp guides

Keep the editable control cage separate from the smooth visible surface.

Verify:

- The source cage has welded, ordered quad topology.
- The visible subdivided surface follows cage edits without exposing low-poly triangle diagonals.
- Emphasized control loops follow the subdivided surface; subdivision-only loops remain visually subordinate.
- Control points and handles are raycastable only in applicable guide-edit modes.
- Occluded control points do not steal selections through the surface.
- Cage edits persist through undo and project save/load.
- A capsule selected as a strict live surface does not silently use contextual 2D fallback.
- Generated-from-scalp guides use the authored scalp deformation and transform, not a stale base mesh.

## Braids and instanced assets

- Align imported segments and controls to the local curve frame deliberately; document any source-axis correction.
- Preserve the source mesh aspect ratio unless a control explicitly changes it.
- Verify segment continuity, root/tip orientation, mirroring, and exported transforms.
- Treat imported OBJ assets as source files; do not overwrite them during runtime checks.

## Materials and shaders

- Keep hair nonmetallic unless the design explicitly changes.
- Verify roughness changes both the base response and any custom highlight response promised by the UI.
- Apply anisotropic noise to highlight direction/intensity, not unintentionally to base color.
- Ensure geometry supplies every attribute the shader reads.
- Test under changing light direction; a painted-on screen- or UV-fixed band is not a valid reactive anisotropic highlight.
- Check shader compilation and browser console errors after edits.

## OBJ and curve export

- `modules/obj-export.js` prefers `geometry.userData.quadFaces`, then reconstructs paired side triangles, and finally emits cap polygons or triangles.
- Keep vertex and UV indices aligned when merging or welding geometry.
- Export center curves as OBJ polylines only with the documented understanding that downstream importer support varies.
- After exporter changes, parse representative output and confirm face arity, winding, UV references, names, and curve records.

## Geometry review views

Inspect at least front, side, three-quarter, and rear angles when silhouette or layering changes. For topology work, also inspect wire overlay, back-face behavior, sharp bends, roots, tips, split boundaries, and mirrored instances.
