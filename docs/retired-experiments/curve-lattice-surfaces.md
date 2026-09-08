# Retired curve-lattice surface experiments

Retired on 2026-07-27 after usability testing.

The following user-facing experiments are intentionally dormant:

- Curve Lattice Guide
- Surface tool
- Loft Surface tool

They were useful geometry prototypes, but the workflows required too much control-point
management to work well for quickly blocking out large anime-hair shapes.

The implementation remains in `app.js`, `modules/curve-lattice.js`, and
`modules/surface-lattice.js` as recovery reference. All creation entry points are
guarded, their UI is permanently hidden, standalone lattice guides are excluded from
the outliner and Live Surface menus, and their saved data is retained only for legacy
project compatibility.

The authored scalp lattice used by **Edit Scalp** is not part of this retirement.
It remains an active, separate feature.
