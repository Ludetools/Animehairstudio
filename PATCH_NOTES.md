# Anime Hair Studio - Patch Notes

## Changes since the Braid Tool baseline

These notes describe the current net state of Anime Hair Studio compared with the archived pre-modularization build from July 19, 2026, which already included the Braid Tool. Superseded experiments, intermediate implementations, and features that were later removed are intentionally omitted.

## New Features

- Added the **Panel Strand Tool** (`P`) for drawing broad procedural hair cards from an editable center curve.
  - Controls include width, thickness, lengthwise and crosswise topology loops, horizontal curvature, and independent left/right edge trimming.
  - Panels support multiple editable zipper splits, adjustable split spacing, loop snapping, mirroring, undo/redo, project persistence, and export.
- Added editable **Capsule Guides** as live drawing surfaces.
  - Capsules can be created from the scalp, resized, retopologized, subdivided for display, and edited by control point or horizontal loop.
  - Guide controls include radius, length, loop counts, opacity, Fresnel transparency, and center visibility.
  - Capsule edits support X symmetry, undo/redo, save/load, and use as an explicit live surface.
- Added **persistent mirror instances** from the outliner.
  - Linked pairs stay synchronized even when global X-mirror editing is off.
  - Instances can be edited from either side or decoupled without deleting either object.
- Added reusable **Strand Presets** and **Braid Presets**.
  - Current creation settings can be saved under a custom name and restored later.
  - Braid presets store the mesh choice, dimensions, strand profile, and width/depth curves as one recipe.
- Expanded the Draw Strand brush with:
  - A **Ponytail Clump** brush preset.
  - A global brush-size multiplier.
  - Surface-normal influence for controlling profile orientation along a live surface.
- Added finished **split-tip geometry** for regular strands.
  - The strand profile is divided into two closed branches with adjustable spacing.
- Added **multi-split panel tips** with independent viewport zipper handles.
  - Zippers can be added, removed, moved laterally, and moved along the panel.
- Added a **Pull Strand** mode to the Move tool.
  - Pulling can preserve curve rigidity and keep moved points outside the reference head.
- Added **group length scaling** so an entire scalp region can be lengthened or shortened while retaining its authored curve character.
- Added a project-level **hair material library**.
  - Projects can contain multiple named materials with independent color and roughness.
  - Materials can be created, selected, assigned to strands, mirrored, saved, and restored.
- Expanded the strand-profile editor with:
  - Per-point smooth or linear interpolation.
  - X-axis profile mirroring.
  - Non-destructive left/right trimming and trim roundness controls.
  - A reference outline for comparing edits with the original profile.
- Added full **Redo** support alongside Undo, including menu commands and keyboard shortcuts.
- Added **Maya export** as a generated Python importer containing hair meshes and editable center curves.
- Added browser-download workflows for projects, OBJ files, and Maya Python files.
  - Local native save/export remains available for development workflows.
- Added display visibility filtering by:
  - Scalp region.
  - Hair layer.
  - Guide type.
- Added a transparent-head option to the scalp setup workflow so control points can be selected through the reference head.
- Added automated project checks for reusable math, pull constraints, OBJ face reconstruction, bounded history, and UI contracts.

## Bug Fixes

- Fixed strand roots losing their intended relationship to the authored scalp after scalp changes, preset loading, mirroring, save/load, and undo/redo.
  - Root attachments now retain surface-relative data and rebuild curve points in scalp-local coordinates.
- Fixed older presets attaching to the wrong or temporary scalp state by remapping legacy root data to the active authored scalp.
- Fixed explicit live-surface drawing modes silently falling back to a different projection surface.
- Fixed drawn strand and panel orientation on curved surfaces by retaining sampled surface normals and applying a controllable normal influence.
- Fixed Pull Strand edits stretching or moving the root unpredictably.
  - Pulling now preserves the root, respects rigidity, and can constrain non-root points outside the head.
- Fixed linked mirror pairs becoming stale when global mirror editing was disabled.
  - Geometry type, materials, dimensions, profiles, splits, surface data, attachments, and generated shape settings now propagate between linked partners.
- Fixed mirrored asymmetric values such as braid rotation, panel edge trims, split positions, profile edits, and surface normals.
- Fixed repeated group-length changes compounding from already-modified curves.
  - Length changes now use retained baselines and update clump and mirror state consistently.
- Replaced the earlier experimental strand split with closed split-tip geometry that follows the current strand profile and width/depth curves.
- Improved panel topology at splits, caps, and front/back seams.
  - Panel welding and normal handling now reduce unwanted shading seams while preserving intended hard boundaries.
- Fixed braid deformation that could collapse or distort the authored segment profile.
  - Braid generation now preserves source topology and aspect ratio while applying width and depth controls.
- Improved braid continuity and endpoint handling for repeated body segments and authored caps.
- Fixed OBJ output losing authored quad structure or UV references.
  - Export now prefers stored quad faces, reconstructs compatible side quads, and emits cap polygons with triangle fallback.
- Added center-curve polyline output to OBJ/Maya export paths where supported.
- Fixed Undo history growing without a bound and added matching bounded Redo history.
- Improved state restoration so guide edits, materials, mirror links, creation settings, panel settings, and derived geometry return consistently.
- Fixed hidden display categories continuing to behave like visible scene content in selection and viewport presentation.
- Added safe compatibility fallbacks for projects created before the current material, attachment, panel, mirror, and guide fields existed.
- Improved native save dialogs so project, OBJ, and Maya exports use the correct filename extension and file filter.

## UI Changes

- Replaced the former header action layout with application-style **File**, **Edit**, **Guides**, and **Materials** menus.
- Reorganized the right-side attribute editor into **Main**, **Display**, and **Materials** tabs.
- Added a dedicated Display tab with parent/child visibility controls for regions, layers, scalp guides, and capsule guides.
- Added a Materials tab with a project-material outliner and focused color/roughness controls.
- Moved tool-specific settings ahead of object attributes and made them visible only in the applicable editing context.
- Added the Panel Strand Tool to the main toolbar and assigned it the `P` shortcut.
- Retired the visible **Place Strand** tool and its keyboard entry point.
- Folded the former standalone Pull tool behavior into an optional **Pull Strand** setting for the Move tool.
- Reworked the Braid Tool panel:
  - Complete braid presets are separated from the repeated mesh selector.
  - Added a braid-size multiplier.
  - Kept braid geometry controls with the selected braid's shape attributes.
- Reworked the Draw Strand panel:
  - Brush behavior, saved strand presets, overall brush size, projection, smoothing, and continuation settings are grouped together.
  - Coil and split-tip settings appear with strand shape controls.
- Added a contextual Panel Shape section with topology, curvature, edge trim, thickness, and zipper controls.
- Added a Capsule Guide entry to the Guides menu and a contextual guide editor with viewport handles.
- Added an Edit menu containing Undo, Redo, and Delete with visible shortcuts and disabled-state feedback.
- Added clearer File menu separation between standard downloadable exports and development-only local save/export commands.
- Added confirmation dialogs for:
  - Applying group defaults to existing strands.
  - Disabling topology-loop snapping for panel zipper splits.
- Added creation-preset naming dialogs for custom strand and braid recipes.
- Updated profile and curve editors with clearer previews, interpolation controls, mirroring, trimming, and target labels.
- Simplified hair material presentation to the current project-material model and removed the obsolete custom highlight/shadow shader controls.
- Improved contextual tool hints, active-state styling, guide visibility controls, and selection feedback throughout the viewport and outliner.
