# Curve Union effort integration

Contract: Auto Remesh Strands offers Low (updated 1.0), Medium (updated 2.0),
and High (3.0) Effort. Medium remains the default. This is transient operation
state, not a new strand, group or preset property. Existing confirmed meshes
remain unchanged. Adaptive regeneration uses the updated Low kernel and retains
the existing source/settings schema; changing sources may improve/change its
generated result. Mirrors, undo, save/load and export use existing mesh paths.

All manual levels load on demand and run in cancellable self-contained workers.
High is additional guarded refinement, not a universal quality guarantee.
Malformed output cannot commit. High additionally respects its upstream strict
export-safety gate; Medium retains its existing advisory quality-warning policy.
No silent engine fallback. Adaptive uses Low and restores the selected manual
effort when switched off. Keyboard and pointer behavior is unchanged.

Source: C:/Users/feshb/Documents/ChatGPT/strandremesh. Import each version using
`node scripts/import-curve-union-v2.mjs <source-directory> <1|2|3>`.
Generated modules record source hashes and contain only the entry's declaration
dependency closure. The animation-frame yield uses a worker-safe timer.

Acceptance: routing/default/adaptive restoration; real AHS sweep geometry for
each engine; self-contained worker execution; cancellation/resource cleanup;
High safety rejection; full baseline. Live multi-angle visual review remains
user-led unless critical geometry/persistence investigation requires isolation.

Verification on 2026-09-08: full baseline passes. Real two-strand AHS sweeps run
through each imported engine and its self-contained worker, with matching
vertices/faces and unchanged input data. High rejects an over-budget coarse
fixture; a denser fixture passes its safety gate (154 result polygons against
388 source polygons). Worker cancellation/resource cleanup and UI labels are
covered. Browser visual review, adaptive edit/undo/save-load and downstream
export review were not rerun; these remain user-led checks for the updated
kernel. Existing automated remesh confirmation/history tests still pass.
