# Feature change playbook

Use this workflow for new tools, controls, editable parameters, generated geometry, interaction changes, and removals.

## Micro-UI fast path

For isolated copy, static HTML, or CSS fixes, first confirm that no JavaScript behavior, controls/IDs, interaction, state, persistence, geometry, shader, export, or server path changes. Then inspect the existing authoritative UI logic, apply the smallest patch, update one focused DOM contract test, and use the micro-UI verifier. Skip the full lifecycle map and live browser automation when the result is unambiguous.

If any behavioral or ownership question remains, use the full workflow below.

## 1. Write the feature contract

Record the following before editing. Use `not applicable` deliberately rather than silently omitting an item.

```text
Goal and acceptance example:
Applicable tool and mode:
UI location and visibility:
Data owner / source of truth:
New-object default:
Existing-object behavior:
Group inheritance:
Mirror behavior:
Undo boundary:
Save/load behavior and compatibility:
Preset behavior:
Preview behavior:
Export/topology impact:
Keyboard and pointer interactions:
Acceptance checks:
```

Resolve ambiguous ownership before implementation. In particular, decide whether a value belongs to global configuration, a group, an individual strand/panel/guide, a shared material, or transient tool state.

### Regression-debugging route

For a bug, begin with the exact initial state, action, expected result and observed result. Test direct entry into a mode, not only entry after another tool has warmed up its state.

1. Capture the exception or incorrect state transition. Trace the first failed owner/consumer boundary.
2. Add an executable regression test that fails for that cause. Prefer running the production controller with explicit boundary doubles to asserting that a function name appears in source. Document what the doubles do not verify.
3. Apply the narrow fix and verify the reproduction plus a cancellation, re-entry or adjacent-mode case.
4. If an earlier fix did not work, collect fresh evidence before another patch. Do not layer speculative hit-testing fallbacks or refresh calls onto an unexplained failure.

Keep source-text contracts for static IDs, visibility wiring and removed entry points. Do not change geometry expectations merely to pass tests: explain the intended contract and preserve topology invariants.

## 2. Map the change

Search for the nearest existing feature with the same lifecycle. Trace its complete route through:

1. Defaults and construction.
2. Runtime state.
3. Geometry or shader generation.
4. Attribute-editor controls and readouts.
5. Live preview and viewport helpers.
6. Group updates and individual overrides.
7. Mirrored or linked instances.
8. Undo snapshots.
9. Project save/load and migration fallbacks.
10. Built-in and file-based presets.
11. Export and topology metadata.
12. Deletion, duplication, and reset behavior.

Do not copy an implementation blindly. Confirm that its ownership and update semantics match the new feature.

## 3. Choose the implementation boundary

- Keep DOM/Three.js/application-state coordination in `app.js`.
- Extract reusable geometry algorithms and data transformations into a focused `modules/` file.
- Put stable defaults shared across features in `modules/app-config.js`.
- Put project envelope validation in `modules/project-schema.js`.
- Keep OBJ face reconstruction and polyline output in `modules/obj-export.js`.
- Add unit tests alongside extracted logic.

Avoid adding a new abstraction for a one-line constant change. Extract logic when it is reusable, independently testable, or already being implemented in multiple places.

## 4. Implement in dependency order

Prefer this order:

1. Data shape and default.
2. Pure transformation or geometry logic.
3. Runtime update path.
4. UI and events.
5. Derived displays and helpers.
6. Undo and persistence.
7. Group, mirror, preset, and export integrations.
8. Tests and live verification.

For experimental behavior, start with the narrowest runtime and UI path. Delay permanent project-schema fields and built-in preset changes until the behavior is accepted.

## 5. Preserve interaction invariants

When changing a tool or gesture, explicitly check:

- Clicking another object selects it when appropriate.
- Clicking empty viewport space deselects without breaking camera orbit.
- Drag gestures do not also trigger click or tap actions.
- Pointer capture is released on completion and cancellation.
- Hotkey tap, hold, and repeat behavior do not conflict.
- Text and numeric inputs do not trigger viewport shortcuts.
- Gizmos detach or change mode when their target becomes invalid.
- Helpers and handles only appear in applicable modes.
- World/Object space settings match the actual transform implementation.

## 6. Complete propagation

Use the checklist in `STATE_AND_PROPAGATION.md`. For a new editable property, search for object construction, cloning, mirroring, snapshots, serialization, loading, resets, built-in presets, group application, and UI refresh functions.

If old project files will lack the property, define a compatibility fallback. Do not rewrite the historical archive.

## 7. Validate by risk

Run the baseline verifier, then use `VERIFICATION_MATRIX.md` for targeted checks. A qualifying micro-UI fix may use the focused verifier instead. Geometry and interaction changes require more than syntax validation.

Follow the canonical live-review policy and isolation requirements in `VERIFICATION_MATRIX.md`. Capture exact failures and fix the underlying behaviour rather than weakening the check.

## 8. Finish cleanly

- Search for stale labels, shortcuts, comments, IDs, event listeners, and state fields.
- Verify that removed features leave no visible, keyboard, raycast, serialization, or geometry entry point.
- Summarize the behavior delivered, propagation paths covered, and validation performed.
- Note intentionally deferred work.
