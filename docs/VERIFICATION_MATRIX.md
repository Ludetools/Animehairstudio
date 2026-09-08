# Verification matrix

Run the baseline verifier after non-micro source changes:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-project.ps1
```

Install development dependencies with `pnpm install --frozen-lockfile`. The baseline checks JavaScript syntax, ESLint `no-undef`, and every discovered `tests/**/*.test.mjs` file. New tests must not require adding a filename to a whitelist. Add the targeted checks below according to risk.

During implementation, the same verifier can run a focused preflight before the final baseline:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-project.ps1 `
  -TestFiles tests/object-transform.test.mjs,tests/dom-contract.test.mjs `
  -TestNamePattern "object transform|settings preferences"
```

Focused inputs do not replace the final baseline. Test runs report every test over the default one-second slow-test threshold; set `AHS_SLOW_TEST_MS` to tune that diagnostic locally.

For an isolated copy, static HTML, or CSS change with no behavioral or control-ID impact, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-micro-ui.ps1 -TestNamePattern "<focused DOM test name>"
```

Add `-IncludeLocalization` when translation data changes. Run the full baseline before releases and after batching micro changes.

## Live-review policy

This section is the canonical live-review policy; other project documents should link here instead of copying it.

The live checks below describe useful review scenarios, not automatic authorization to run the browser. Leave ordinary visual and interaction review to the user. Ask before running a noncritical live test. Run without approval only when the check is critical for crashes, data loss/corruption, undo or persistence integrity, destructive behavior, or geometry/export failure that static checks cannot meaningfully cover. State why before starting. When deferring a live check, provide its scenario to the user.

Node-based controller tests and temporary-file/server fixtures run automatically. They do not manipulate the user's scene. Browser automation remains subject to the policy above even in a separate browser. Never reload or clear the user's unsaved working scene for verification; use a separate isolated scene/profile, and close only resources created by the test.

`tests/mesh-mode-runtime.test.mjs` executes production mesh-mode controllers with rendering and raycasting doubles. It checks entry/selection orchestration, not screen-space picking, orbit, gesture timing or visual appearance; those still need the appropriate live scenario.

| Change | Required checks |
|---|---|
| Micro UI: isolated copy/static HTML/CSS, no behavior or control-ID change | Focused DOM contract via micro-UI verifier; leave visual review to the user unless requested |
| Constant, label, or default | Baseline; confirm every duplicate default/readout is intentionally updated |
| HTML control or ID | Baseline; control visible in the intended context; no duplicate IDs |
| CSS visibility or layout | Baseline; live check in applicable and non-applicable modes |
| Pointer interaction or gizmo | Baseline; live click, drag, cancel, orbit, deselect, and tool-switch scenarios |
| Hotkey | Baseline; tap/hold/repeat as applicable; input-focus isolation; shortcut label/hint |
| Reusable math/data transformation | Add focused `node:test` coverage; baseline |
| Strand/panel geometry | Baseline; live multi-angle and wire-overlay review; caps, winding, normals, UV/color, density extremes |
| Guide/cage geometry | Baseline; control visibility/raycasting; edit/update; undo; save/load; subdivision overlay |
| Shader/material | Baseline; shader/console errors; visual response under moving light; all material users update |
| Group default | Baseline; new member; existing members; individual selection/readout; warning preference if applicable |
| Mirror/link behavior | Baseline; create, edit both directions, global mirror off, decouple, delete, save/load |
| Undo | Baseline; one committed step per gesture; derived geometry and UI restore |
| Project schema/state | Baseline; current round trip; older missing-field fallback; transient state excluded |
| Built-in preset | Baseline; clean-scene creation; names/groups; attachments; four-angle review; save/reload |
| File-based preset | Baseline; validation/fallback; attachment remap; missing assets handled |
| OBJ/export geometry | Baseline; export representative object; parse faces/UVs/names/curves; inspect downstream if available |
| Server or native save/export | Baseline; `/api/health`; native dialog flow; correct extension/filter; error path |
| Feature removal | Baseline; search for stale state/UI/events/shortcuts/raycast/serialization; DOM retirement test when useful |

## Baseline interpretation

The verifier passing means static syntax and current regression contracts passed. It does not prove visual correctness, interaction correctness, topology quality, or successful downstream import.

## Live-browser protocol

Use this protocol only after user approval or when the check meets the critical exception above.

1. Launch the app through the local server, not `file://`.
2. Reload to ensure the changed source is active.
3. Start from a known clean scene or named preset.
4. Test the primary acceptance scenario.
5. Test one boundary or cancellation scenario.
6. Check browser console and shader errors.
7. Inspect relevant contextual settings and hidden states.
8. Reload or restore the clean scene after destructive verification.

Avoid using vague visual confirmation such as “looks fine.” State the angles, controls, values, modes, and error logs checked.

## Persistence protocol

For a new saved property:

1. Set a non-default value.
2. Save the project.
3. Reload or reopen from a clean app state.
4. Confirm the control, authored data, and generated result.
5. Undo and redo an edit after load when the feature supports history.
6. Load data without the new field and confirm the intended fallback.

## Geometry boundary values

Exercise meaningful minima, defaults, and maxima for loop counts, taper/curve controls, offsets, split positions, and densities. Check sharp bends and near-degenerate cases. Clamp invalid combinations explicitly rather than relying on the renderer to tolerate them.

## Skipped checks

If the user asks to skip a check, still run safe static checks unless they explicitly prohibit them. Report what was skipped and what risk remains. Never claim visual, runtime, save/load, or export verification that was not performed.
