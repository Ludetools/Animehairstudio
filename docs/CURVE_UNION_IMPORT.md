# Curve Union import (2026-09-04)

> Superseded on 2026-09-08 by [Effort integration](CURVE_UNION_EFFORTS.md):
> refreshed 1.0/2.0 plus 3.0, named Low/Medium/High Effort. The details below
> document the earlier import. Adaptive now uses the refreshed Low worker.

The Auto Remesh Strands floating panel defaults to **Curve Union 2.0**.
**Curve Union Legacy** retains the existing AHS kernel unchanged.
Adaptive Remesh always uses Legacy, both for the initial preview and subsequent
source edits. Enabling Adaptive displays and locks Legacy; disabling it restores
the preferred manual method.

The method choice belongs to the transient operation, not strand defaults or
presets. Confirmed non-adaptive results retain the existing editable mesh format.
Adaptive objects retain their existing source IDs and settings schema. Existing
projects therefore continue rebuilding with Legacy. Undo, mirroring and export
continue using the existing mesh/state paths.

2.0 runs in a dedicated, self-contained Blob worker, including when the app is
opened from `file://`. No external script imports occur inside that worker.
Worker and Blob URL resources are released on completion, failure or cancellation.
Settings changes invalidate pending output
and cancel that worker. Cancel closes it too. Failed or stale results cannot be
confirmed. Non-finite coordinates and invalid face indices also block confirmation.
The upstream `curveUnionV2ExportSafe` grade is advisory: a visible quality warning
allows users to inspect and confirm usable output without claiming it is watertight
or export-safe. Legacy remains an explicit
user choice, never a silent fallback after a 2.0 failure.

## Provenance and refresh

Source: the local Strand Remesh project's `core.js` and `curve-union-v2.js`.
The imported module records SHA-256 hashes of both source files. Run:

```powershell
node scripts/import-curve-union-v2.mjs <strandremesh-directory>
```

The importer selects only the global declaration dependency closure rooted at
`curveUnionV2`. It does not import the other application's UI, worker bootstrap,
or unrelated remesher entry points. Do not hand-edit the generated module.

## Acceptance checks

Non-adaptive objects intentionally have null adaptive settings. The shared
normalizer treats null like omitted settings, so history snapshots and project
loading remain safe after a manual remesh. Regression tests reproduce confirming
a second remesh while the previous non-adaptive object is included in the undo
snapshot. Rendering and native save-dialog review remain user-led.

The floating remesh panel displays transient progress while preparing or running:
an indeterminate bar before the first update, then reported stage progress and a
spinner. Progress is not a time estimate and is capped at 99% until preview
construction finishes. It resets on settings changes and disappears on completion,
failure or cancellation; stale generations cannot update it. Cancel remains
available. Reduced-motion preferences disable the spinner animation. This UI adds
no defaults, preset fields, history state, geometry or export changes.

- Default manual method: 2.0; explicit Legacy works independently.
- Adaptive always routes to the original kernel.
- Pending/cancelled/malformed output cannot be confirmed; quality warnings allow confirmation.
- Real AHS sweeps produce finite vertices and valid indexed topology.
- Worker success, cancellation and errors release resources.
- User-led live review: preview both modes, enable Adaptive, edit a source,
  inspect caps/winding from multiple angles, confirm/undo and save/reload.

The automated tests cover routing, worker lifecycle and representative topology;
they do not substitute for visual review of complex hairstyles. Use the normal
local HTTP launcher for native save/export. Background remeshing also supports
direct file opening. The generated worker payload is executed in an isolated
test context and compared against the same input through the module entry point.
