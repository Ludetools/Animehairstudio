# Lattice from strands

Curves > Create Lattice from Strands accepts two or more selected strand,
panel or braid curves in the Strands workspace. Spatial proximity along the
whole sampled curve determines adjacent columns, independent of selection order.
This is a shortest-neighbor-path heuristic for a single strip, not a general
solution for branched or intersecting strand collections.
Roots form the top boundary and tips form the bottom, irrespective of world Y.
The creation dialog chooses a common point count per curve (2–256, initially at
least 8); endpoints are exact. Across the surface, each source supplies one curve.
Canceling the dialog changes nothing. Crosswise helper lines join corresponding
control rows, including the root and tip boundaries, alongside longitudinal curves.
All control points are visible in component editing, not only the active column.
Selected lofts have a dedicated Curve Lattice panel replacing Strand Shape and
strand topology settings. Horizontal Loops and Vertical Loops include boundaries;
sliders, numeric inputs and reset buttons update automatically. Resets use 8
horizontal and 3 vertical loops. A slider drag creates one undo transaction and
resamples from its initial grid to avoid cumulative detail loss. Row samples follow
the current smooth curves; across-curve interpolation is linear. Reducing counts
can simplify the surface. Point attributes are resampled over the same 2D grid.
Edits affect the active lattice only; locked objects are rejected, point selection
is cleared after topology changes, and existing mirror/history persistence paths
receive the new row/column counts and points. Source strands are never modified.
Existing lattices are not silently reordered; recreate from their original strands.

The result is an independent editable curve-surface mesh, not a guide or live
link. It uses the first source's region, layer and material. Sources are only
hidden via their existing outliner visibility flag; no points are changed.
Creation and hiding share one undo boundary. Unhide sources with their eye icons.
Global mirror editing does not duplicate the selection automatically.

The existing curve-surface lifecycle handles editing, cloning, mirroring and
save/load. `curveSurfaceLoft` distinguishes this root-to-tip loft from the older
strip surface: it prevents automatic curve reversal and exterior strip margins.
Missing flags preserve the older surface behavior. No group defaults or built-in
presets change. The result is an open quad surface with existing UV, tangent,
normal and export handling, not a watertight remesh.

Checks: controller tests for selection gating, source preservation and one undo;
grid tests for opposite-direction controllers, boundaries and finite data.
User-led review: create from neighboring curved strands, edit a lattice point,
unhide originals, undo/redo, save/reopen, inspect front/back and wire overlay.
