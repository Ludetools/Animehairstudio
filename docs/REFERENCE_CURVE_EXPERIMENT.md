# Select to Curve experiment

Contract: in References, select an image of type 3D Plane and choose Select to Curve.
Outline one lock, mark root then tip, review the center-path preview, and confirm.
The lasso is the mask; this does not segment image colours or infer depth.
Coordinates follow the displayed crop/flip and the plane's world transform.
The mask and preview are dialog-local, discarded on cancel, and not serialized.

Confirm creates one ordinary strand using Draw Strand shape defaults, in Unassigned/Mid,
without root attachment, layer offset, automatic mirroring, or group inheritance.
It has one undo boundary and uses existing strand editing, save/load and export paths.
There is no new project schema or preset field. Existing strands/defaults are untouched.
The strand's depth remains on the reference plane and can be edited afterwards.

The path is deterministic for the same polygon, endpoints and simplification value.
A bounded raster mask and clearance-weighted shortest path favour the lock's center;
path simplification checks against cutting outside the selection. Narrow/disconnected
masks can fail, and the normal strand interpolation may need manual refinement.

Automated checks cover determinism, direction, bent masks, invalid input and UI wiring.
Live review remains user-led: cropped/flipped/rotated plane alignment, lasso cancellation,
preview versus created strand, undo/redo and save/reopen. No browser timing or image
quality claims are made. Remove the two reference-curve modules, modal/button/styles
and app integration together if the experiment is rejected.
