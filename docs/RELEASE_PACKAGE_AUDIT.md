# 0.2.1 package preparation audit

Read-only source audit, 2026-09-08. No release archive built or published. This is a proposed inclusion policy, not a verified package manifest.

## Before building

- Align `package.json`, `modules/app-config.js`, README current-release text, and the current patch-notes entry with 0.2.1. Preserve historical 0.1.5 notes as history.
- Reconcile README shortcuts: it currently says Alt-click removes selection, Shift+Ctrl-click inserts a point, and Z/X navigates points. Current in-app reference instead says Shift-click/drag removes, Ctrl+Alt-click inserts, and X toggles mirror editing. Confirm against handlers before editing documentation.
- Document the internet requirement: `index.html` imports Three.js 0.165.0 from unpkg. Isolated audit harnesses substitute a local copy; those passes do NOT demonstrate production offline startup or CDN availability.
- Confirm Node.js is installed on a clean target machine. The launcher also tries a developer-runtime fallback under the user's profile; that fallback must not be relied on in release instructions or smoke tests.
- Obtain owner confirmation of redistribution permissions for the included head, braid/chain models, sample hairstyle, images, and third-party dependencies. No asset-specific license/notice files were found by filename search under assets; that is not proof permission is absent.

## Proposed inclusion policy

Include the application entry files (`index.html`, `app.js`, `styles.css`, `favicon.svg`), runtime modules, `server.js`, `server/write-project.cjs`, both launchers, package metadata, LICENSE, current README and release notes. Resolve and include every runtime-referenced asset explicitly, including lazy-loaded features.

Observed runtime asset references include the default head, scalp guide, scalp topology template, braid segment, chain links, built-in layered-side-bun project and preview, and toolbar images. CSS and module asset dependencies still require a complete inventory. Do not assume the entire assets directory is necessary or cleared for redistribution.

Exclude `.git`, `.agents`, `.pnpm-store`, `node_modules`, `archive`, `output`, `promo`, test fixtures, recordings, logs, `.anime-hair-studio-port`, and private artist projects. Review `experiments` individually for runtime dependencies before exclusion. Development tests/scripts can be a separate source distribution if desired; they are not runtime requirements by default.

## Package acceptance

1. Freeze a recoverable candidate with required assets and an explicit manifest.
2. Build an archive from the approved manifest, not the workspace root.
3. Extract to a new path containing spaces, with no developer caches available.
4. Verify launcher, health endpoint, dependency loading, native save/open and export.
5. Repeat with default port occupied and missing Node; errors must be useful.
6. Run final tests on matching source; record archive checksum and owner sign-off.

Publication, distribution format, asset permissions, native dialogs, and downstream import sign-off remain pending.
