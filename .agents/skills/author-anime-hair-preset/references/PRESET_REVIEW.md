# Preset authoring and review

## Reference intake

- List each image angle and note missing views.
- Identify the head/model scale and orientation.
- Separate structural facts from lighting or drawing stylization.
- Note parting, hairline, dominant masses, negative spaces, layer order, tip language, symmetry, and accessories.
- Use the model file as geometric evidence when available; use images for silhouette and styling.

## Construction plan

Plan every hairstyle by region:

| Region | Questions |
|---|---|
| Crown/top | What establishes volume and parting? Which layer sits furthest outward? |
| Fringe/bangs | One split panel, several panels, or individual strands? Where are the gaps? |
| Side locks | Do they frame the face, cover ears, or sit behind them? |
| Side/rear shell | Is coverage continuous from front to rear at both temple and ear height? |
| Nape | Is the lower rear silhouette covered without floating roots? |
| Braids/accents | Where do they start, pass the ears, overlap the shell, and terminate? |

Choose the simplest tool that expresses each form:

- Panel strand: broad flat lock, fringe sheet, controlled split, or straight-cut edge.
- Draw strand: individual tapered lock, curved spike, side lock, or layered accent.
- Braid: repeated woven structure following a guide curve.
- Capsule/live surface: conformance guide, not a substitute for hair-region assignment.

## Authoring order

1. Establish attachment surfaces and scalp regions.
2. Block the crown and rear coverage shell.
3. Establish overall length and widest silhouette.
4. Build fringe and face-framing forms.
5. Fill side and nape gaps.
6. Add braids and major accents.
7. Add restrained root orientation and tip variation.
8. Correct layer offsets so upper hair lies above lower hair.
9. Tune profiles, taper, density, and materials.
10. Remove redundant or hidden geometry.

## Four-angle review

### Front

- Parting and fringe read clearly.
- Face framing is intentional and balanced.
- No accidental scalp gaps around the hairline or temples.
- Broad locks have readable separation without excessive fragmentation.

### Side

- Crown volume, forehead clearance, ear relationship, and rear projection match the target.
- Roots do not float above or tunnel visibly through the guide.
- Upper layers sit outside lower layers.

### Three-quarter

- Transitions between fringe, side locks, crown, and rear shell are continuous.
- Negative spaces and overlaps match the intended anime silhouette.
- Braids and accents sit in the correct depth order.

### Rear

- Crown-to-nape coverage is complete.
- Mirrored repetition is not distractingly mechanical.
- Braids or rear accents originate and terminate plausibly.

## Data and reproducibility

- Use group-derived names and valid scalp-region IDs.
- Confirm shared material assignments.
- Confirm mirror instances are intentionally linked or decoupled.
- Save attachments against the authored active surface.
- For built-in presets, create the preset from a clean scene and compare all four angles.
- Prefer `.ahs` for new project files; retain loading compatibility for legacy `.animehair.json` and `.json` projects. Verify save/reload in an isolated scene without clearing the user's unsaved work.
- Save or update a preview image only when requested or when the preset library requires it.

## Performance and topology

- Start with moderate density; increase only where silhouette or deformation needs it.
- Avoid hidden duplicate strands and panels.
- Check caps, normals, wire overlay, sharp bends, and split boundaries on representative forms.
- Preserve quad export intent and required UV/color attributes.

## Completion report

State:

- References used.
- Construction by tool and region.
- Preset location and name.
- Four-angle review result.
- Reload/recreation result.
- Verification performed and any known compromises.
