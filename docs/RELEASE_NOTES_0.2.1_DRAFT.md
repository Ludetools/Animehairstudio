# Anime Hair Studio 0.2.1 — draft release notes

Unreleased; verification and release-owner approval pending. This document does not announce availability or certify the build.

## Candidate highlights

- Mesh bevel workflow with adjustable width and segments, preview, cancellation and undo.
- Editable polygon meshes can retain n-gons through supported editing and export paths.
- Curve-lattice mesh creation from selected strands, with editable loop counts.
- OBJ export for selected strands and meshes.
- Customizable tool/workspace shortcuts and continued interface refinements.
- Safer project loading: tested malformed projects are rejected without clearing the active scene; late restoration failures attempt rollback.

Final advertised features must match the release checklist and actual packaged build. Accessory Brush and other dev-test tools are not promises of production-ready functionality.

## Before updating

Keep untouched copies of projects and download a preferences/presets backup. Projects containing newer geometry such as n-gons may not behave correctly in older AHS builds.

Use the Windows launcher with Node.js installed for native save/export. This build currently loads Three.js from the internet and is not a fully offline package.

## Known limitations and review still pending

- Bevel is not claimed to have full Blender/Maya parity or general overlap clamping. Linked-partner bevel preview is not live.
- Export includes hidden objects; selection export is filtered by selection, not visibility.
- OBJ center curves are polylines; support varies by importer. USDA bones and skin weights are unavailable.
- Native save dialogs, clean-package startup, downstream import, visual shading and broader artist workflow sign-off remain pending. See RELEASE_CHECKLIST.md for exact evidence and gaps.

## Reporting a problem

Include the AHS version, browser and Windows version, workspace/tool, numbered reproduction steps, expected versus actual behavior, and a screenshot where helpful. Share a disposable project copy only if you have permission and it contains no private content. Keep the original safe. The release owner still needs to confirm the preferred reporting channel.
