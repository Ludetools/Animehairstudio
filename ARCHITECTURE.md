# Anime Hair Studio architecture

`app.js` remains the application coordinator while reusable, state-free logic lives in `modules/`.

- `modules/strand-constraints.js`: pull-chain solving and lightweight collision math.
- `modules/curve-math.js`: taper interpolation, attribute sampling, and adaptive curve density.
- `modules/obj-export.js`: quad-aware OBJ face reconstruction.
- `modules/project-schema.js`: project envelope creation, naming, and validation.
- `modules/app-config.js`: immutable regions, layers, material defaults, and shape profiles.
- `modules/history.js`: bounded undo history storage.
- `tests/core-math.test.mjs`: regression coverage for these modules.

New code should stay in `app.js` only when it directly coordinates DOM controls, Three.js scene objects, or application state. Geometry algorithms and data transformations should be added to a focused module and tested independently.

The pre-refactor application is archived under `archive/pre-modularization-2026-07-19/`.
