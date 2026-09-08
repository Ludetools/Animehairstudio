# Startup loading

The dependency-free AHS splash starts before the main module graph. It tracks
modules, UI setup, head, scalp and the next animation frame; the bar counts stages,
not downloaded bytes or estimated time. Catalog hydration remains background work.
All five milestones dismiss the splash. Head/scalp errors stay visible with a
dismiss button; a 20-second wait also offers dismissal without claiming readiness.
The editor is inert until completion or dismissal. No reload, scene clearing or
saved preference changes are performed by the splash.

- Custom preset startup reads the lightweight IndexedDB `catalog` store (v2).
  Full projects and 3D preview buffers load on apply or hover, deduplicated per id.
  Saving/deleting changes both stores in one transaction. Existing full records
  remain intact; the first v1 upgrade scans them once to populate the catalog.
  Preference/preset backup still uses the full-record listing.
- Curve Union 2.0 is dynamically imported on demand through a cancellable job
  facade. Legacy/adaptive remeshing does not load that runtime.
- Braid/chain OBJ assets are requested on their first geometry use. The existing
  fallback geometry remains until registration rebuilds locks using the asset.
- Three.js remains CDN-hosted. Bundling it locally is deferred; it needs a complete
  pinned dependency tree and a dedicated offline first-load check.

Startup stages appear under `AHS startup: …` in the browser Performance API:
modules-ready, ui-initialized, first-render-submitted, next-animation-frame,
template-snapshot-ready, head-ready, scalp-ready and preset-catalog-ready.
All durations start at the inline `ahs:start` mark. First-render-submitted is a
CPU submission milestone, not a guarantee that the GPU has presented a frame.
Use `performance.getEntriesByType('measure').filter(x => x.name.startsWith('AHS startup:'))`
to inspect them. Compare fresh profiles and warm-cache runs separately.

No project schema, geometry algorithm, undo policy or saved defaults changed.
Tests cover loading/cancellation, metadata migration routing, backup compatibility,
deduplication and timing marks. Browser storage durability, actual startup speed,
first-use previews and offline/CDN behaviour still need live verification.
