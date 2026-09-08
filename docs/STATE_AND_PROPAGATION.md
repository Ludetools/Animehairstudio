# State and propagation

This document describes how editable values should flow through Anime Hair Studio. It is a change checklist, not a claim that every legacy field already follows the ideal model.

## Ownership layers

```text
Application/configuration default
    -> group or shared-resource default
        -> individual strand, panel, braid, or guide value
            -> generated Three.js geometry/material/helper
                -> viewport preview and export

Editable authored state
    <-> undo snapshot
    <-> project serialization
    <-> mirror/link synchronization
    <-> preset construction
```

Choose one authoritative owner for a value. UI controls display and change that owner; generated geometry and previews consume it. Avoid keeping unrelated duplicate values synchronized by event ordering.

## Current durable state surfaces

- `modules/app-config.js`: stable region, layer, material, profile, and curve defaults.
- `app.js`: active application state, authored scene objects, selection, tools, runtime Three.js objects, built-in presets, and most serialization adapters.
- `modules/project-schema.js`: project envelope (`anime-hair-studio-project`, version `1`) and basic validation.
- `modules/history.js`: bounded undo entry storage. Snapshot completeness is determined by callers.
- `.ahs`: saved project data. Legacy `.animehair.json` and `.json` project files remain load-compatible.

The project envelope requires `state.locks` and `state.guides`. New saved fields need safe fallbacks because existing version-1 projects will not contain them.

## Editable-parameter checklist

For every new or changed parameter, decide and verify each applicable item:

- Canonical name, units, range, step, and neutral value.
- Default for new objects.
- Reset behavior.
- Existing-object behavior when the control changes.
- Group default and whether group edits update existing members.
- Individual override behavior.
- Shared-material or shared-resource behavior.
- Clone and duplicate behavior.
- Mirror creation, continuous synchronization, and decoupling behavior.
- Undo snapshot capture and restoration.
- Project save and load.
- Missing-field fallback for older files.
- Built-in preset construction.
- File-based preset loading.
- Attribute-editor value and numeric readout refresh.
- Sidebar/profile preview refresh.
- Geometry, material, helper, and transform refresh.
- Export behavior.
- Removal cleanup.

## Attachments and coordinate spaces

Root attachment data and the visible attachment surface must refer to the same authored surface.

- Preserve the root position together with the surface identity and the local data required to rebuild it, such as a normal or surface-relative coordinate.
- Rebuild the authored scalp or guide before rebinding loaded roots. Do not bind against stale or placeholder geometry during project loading.
- Distinguish strict guide conformance from contextual fallback behavior. A named live surface must not silently fall back to a different placement mode.
- When a strand is placed on a capsule or other guide, resolve its hair region separately from its attachment surface when required.
- Root scalp offsets move along the saved surface normal. Keep the authored neutral position unambiguous.
- Make World/Object transform-space controls authoritative for move, rotate, and scale.

## Groups, materials, mirrors, and presets

### Groups

Group defaults are artist-facing preview controls, not merely construction templates, when the UI promises that they update existing members. Preserve individual-versus-group ownership explicitly.

### Shared materials

Strands reference a material resource. Editing a shared material should update all users of that material without copying settings into each strand.

### Mirrors and linked instances

Differentiate temporary global mirror editing from persistent mirror-instance links. Persistent links must synchronize even when the global mirror toggle is off. Decoupling must remove the relationship without deleting either object.

### Presets

Built-in presets must use the same constructors and current authored attachment surfaces as interactive creation. Avoid temporary placement against the wrong scalp followed by remapping. Presets should not bypass naming, grouping, defaults, attachment, or serialization rules.

## Undo boundaries

- Capture state at the start of a committed interaction, not on every pointer-move frame.
- Restore both authored data and all derived runtime representations.
- Keep transient state out of saved projects and history, including pending placement IDs and active drag internals.
- Test undo after group edits, mirror edits, guide cage edits, material edits, and any gesture that changes multiple points.

## Loading order

Use this dependency order when restoring a project:

1. Validate the project envelope.
2. Restore head and scalp-guide assets and authored guide deformation.
3. Rebuild guide runtime geometry.
4. Restore shared resources and groups.
5. Restore guides and live surfaces.
6. Restore strands, panels, braids, and their attachments.
7. Resolve mirror/link relationships.
8. Rebuild derived geometry, helpers, previews, and selection-neutral UI.
9. Reset transient interaction state and history baseline.

## Removing state

When removing a feature, delete or neutralize all of its ownership paths: defaults, instance data, UI, events, geometry consumers, snapshots, project output, load fallback, presets, mirroring, helpers, raycasting, shortcuts, hints, and tests. Continue accepting an obsolete saved field only when compatibility requires it; ignore it rather than reviving the removed behavior.
