---
name: author-anime-hair-preset
description: Create, tune, review, or save an Anime Hair Studio hairstyle preset from references, models, or an existing .ahs project (including legacy .animehair.json files). Use for hairstyle design and multi-angle review; use change-anime-hair-feature when the editor needs a new capability.
---

# Author Anime Hair Preset

Build presets with the editor's existing tools and save a reproducible authored result rather than leaving the hairstyle only in transient scene state.

## Workflow

1. Read the root `AGENTS.md` and `references/PRESET_REVIEW.md`.
2. Inventory every supplied reference image, model, and existing preset. Inspect images and models before authoring.
3. Write a short style target: silhouette, parting, fringe, side locks, crown, rear/nape coverage, braids or ornaments, symmetry, and intentional asymmetry.
4. Confirm the active head and authored scalp/guide surfaces before placing roots.
5. Plan construction by region. Choose panels for broad sheet-like locks and split fringes; choose strands for individual locks; choose braids for repeated interwoven forms.
6. Author from large forms to small forms: coverage shell, major silhouette, fringe/side locks, rear/nape, accents, then variance.
7. Use existing constructors, naming, groups, materials, attachments, and mirror-instance behavior. Do not bypass application lifecycle rules with ad hoc scene-only objects.
8. Review front, side, three-quarter, and rear views after each major pass. Correct coverage and layering before adding detail.
9. Save the accepted result into the requested preset location. If it becomes built-in, verify clean-scene recreation; if file-based, verify save and reload.
10. Run the root verifier when source files change and use the review checklist before reporting completion.

## Boundaries

- Do not invent a new editor capability merely to finish one preset. If a genuine missing capability blocks the design, stop preset authoring, describe the requirement, and switch to `$change-anime-hair-feature` only when implementation is in scope.
- Do not modify supplied reference assets.
- Keep roots assigned to the intended hair regions even when attached to a capsule or alternate live surface.
- Prefer a few readable overlapping forms over dense detail that does not improve the silhouette.
- Treat accidental results as experiments until the user accepts them; do not silently make them defaults.
- Preserve reasonable topology and performance budgets while matching the references.

## Completion

Deliver a preset only after confirming construction, attachments, naming/grouping, materials, four-angle coverage, layering, clean recreation or reload, and any requested preview asset.
