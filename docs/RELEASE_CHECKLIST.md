# AHS next-release checklist

Created: 2026-09-08. Status: audit in progress; reproduced project-load blocker fixed and retested, broader sign-off pending.

Target version: **1.0.0** · Target: **this week, possibly 2026-09-08** · Candidate build/commit: **not frozen** · Release owner: **user**

User changed the target from 0.2.1 to 1.0 on 2026-09-08. Package, application version and current notes now identify 1.0.0. Packaging and publication remain pending. This checklist is not certification that the current build is ready.

## How we use this

- Work in order: protect projects → core workflow → recent features → presentation → packaging.
- Check an item only after testing the named release candidate. Record evidence below, including scene, result and tester.
- A failure becomes an issue with reproduction steps and a fix, hide, defer or document decision. Fixes must be retested.
- P0: data loss/corruption or security failure. P1: crash, broken advertised workflow, wrong export or lost edits. Neither ships unresolved; a P1 feature may instead be removed from release scope and tested as hidden.
- P2: non-blocking visual/usability defect with an acceptable workaround. It may ship only with an explicit owner decision.
- Freeze new features once the candidate is chosen. A later code/asset change invalidates affected checks; run the final baseline and package smoke test again.
- Follow [the verification policy](VERIFICATION_MATRIX.md): hands-on review is user-led unless approved or required for critical integrity checks. Use disposable project copies, never the artist's only copy.

Suggested division: assistant handles automated checks, code audits and approved isolated integrity tests; artist handles interaction feel, visual sign-off and target-DCC review. Release owner approves scope and publication.

## 1. Scope and test setup

- [ ] R01 — Confirm version, intended release date, supported Windows/browser versions, delivery format and advertised export targets.
- [ ] R02 — List every shipping feature versus experimental/hidden features. Explicitly decide the status of Accessory Brush, Curvy, reference-to-curve tools and other dev-test options; inspect current controls rather than relying on old notes.
- [ ] R03 — Make a recoverable candidate backup including required assets, not just tracked source. Record build ID and asset manifest; preserve unrelated working changes.
- [ ] R04 — Prepare disposable fixtures: empty project; basic strands/panel/braid; mesh with n-gons; guides/references/materials; linked mirrors; an older .ahs; and large artist-authored projects (braidgirl (3) and belle v1 if available). Keep untouched originals.
- [ ] R05 — Run the full verifier on the candidate. Record test count, failures and log; existing passes from earlier edits are background evidence only.

## 2. Project safety — release blockers

- [ ] R06 — New → create → Save → close → launch → Open restores geometry, names, materials, guides, references, groups, visibility and links. Test native HTTP service and any advertised browser-download path separately.
- [ ] R07 — Save As, overwrite confirmation and cancellation behave correctly. Simulated permission/failed-write errors preserve the original file and explain recovery.
- [ ] R08 — Autosave/recovery restores a recent disposable session; accepting/dismissing recovery never overwrites another project unexpectedly. Unsaved New/Open/close behavior is clear.
- [ ] R09 — Older project loads correctly; malformed/truncated project fails safely without losing the current scene. Document new-project compatibility with older app builds, especially n-gons.
- [ ] R10 — Undo/Redo restores creation, deletion, duplication, transforms, material edits and topology edits. A drag is one step; Escape produces no committed edit. Repeated undo/redo and undo after reopening do not corrupt the scene.
- [ ] R11 — Linked mirrors update from either side with global mirror off; global X editing, decouple, hide and delete remain correct through undo and save/reopen.
- [ ] R12 — Changes to one preset, brush, group or material affect only their intended users. Custom presets and preferences survive restart; fresh preferences produce usable defaults.

## 3. Everyday artist workflow

- [ ] R13 — From a clean launch, draw and edit a strand, panel and braid; insert/remove points; adjust width/depth curves; smooth and rebuild; preserve root attachment and tip shape.
- [ ] R14 — Click, empty-click, marquee and double-click loop selection work in applicable workspaces and component modes. Verify Ctrl-add and Shift-remove, shared vertices, hidden/locked objects and back-facing selection rules.
- [ ] R15 — Move/Rotate/Scale, World/Object space, multi-selection, mixed-value inputs and reset buttons edit the intended targets. Unequal widths/depths receive the intended common delta.
- [ ] R16 — Tool switching, radial menus, custom shortcuts and tap/hold behavior agree. Text fields don't trigger tools; dropdown/slider focus doesn't trap viewport shortcuts. Orbit/pan/zoom remain available after cancelled drags.
- [ ] R17 — Guides and live surfaces behave as labeled; explicit surface selection doesn't silently use a fallback. Reference import, crop, transform, visibility and deletion work.
- [ ] R18 — Pattern brush/builder preset changes and workspace switches don't leak settings into Draw Strand or another brush. If Accessory ships experimentally, switching it off removes all normal entry points without harming existing projects.
- [ ] R19 — Complete a short real styling session using an artist-authored project: edit → organize → save → reopen → export, with no blocking errors or unexplained state changes.

## 4. Recent changes — highest regression risk

- [ ] R20 — Mesh bevel: single edge, adjacent chain, closed loop and three-way corner. Test width extremes, 1/2/6/12 segments, precision drag, Apply/Enter, Escape, focus loss and tool/workspace switching.
- [ ] R21 — Bevel preview matches committed shape; unsupported selections fail clearly without mutation. Verify linked-mirror commit and disclose that linked-partner preview is not currently live. Do not advertise full Maya/Blender bevel parity or general overlap clamping.
- [ ] R22 — N-gons: convex and concave faces render completely, retain perimeter-only wire lines and select as whole faces. Verify normal direction, front/back views and selection after bevel/undo/reopen. Quad-only tools must stop safely, not discard faces.
- [ ] R23 — Curve normal rebuild and reset point rotations fix intended cases without changing unrelated curve shape. Inspect difficult braid tips, sharp bends and mirrored results with back-face debug on/off.
- [ ] R24 — Confirm which lattice features actually ship. For lattice-from-strands if exposed: ordering, root/tip boundaries, all control points, automatic loop changes, source preservation/hiding, selection-only settings, mirrored wireframe and save/reopen.
- [ ] R25 — Width/segment/settings drags cancel cleanly; no stale preview, hidden original, stuck pointer capture or disabled camera remains. Test restarting the same operation immediately after cancellation.

## 5. Export and geometry — release blockers for advertised formats

- [ ] R26 — Export All and Export Selection contain exactly the intended objects, with documented hidden-object and mirror behavior. Empty selection gives a useful message.
- [ ] R27 — Parse exported indices, UV references, face sizes and transforms; inspect normals, materials where supported, n-gons, caps and scale in an advertised downstream application. Test both a small fixture and an artist project.
- [ ] R28 — Exercise each additional advertised export format separately (for example Maya/USDA if included); don't infer success from OBJ. Verify curve records where advertised.
- [ ] R29 — Inspect representative strands, braids, panels and edited meshes from front, side, rear and three-quarter views with wireframe/back-face checks. Reject missing faces, inverted winding and invalid coordinates; distinguish intentionally open surfaces from watertight meshes.

## 6. Presentation, performance and clean defaults

- [ ] R30 — Settings, popups and dialogs fit small and large supported windows/UI scales. Performance box stays readable; panel collapse/expand/resize, tooltips and title-bar styles work without overlap or clipped controls.
- [ ] R31 — No-selection and unavailable-operation states explain what to do. Tool settings appear only in their workspace and before object attributes. Sliders, toggles, resets and active-tool colors are consistent.
- [ ] R32 — Fresh-user startup and upgraded preferences show no debug overlays, dev tools, unwanted mascot, missing assets or stuck splash. Recheck experimental gating through menus, shortcuts and radial menus.
- [ ] R33 — Record cold/warm startup to usable viewport on named hardware and browser. Compare to a known build; agree acceptable thresholds instead of relying on an FPS screenshot.
- [ ] R34 — Measure orbit, selection, geometry edits, save and undo on the large fixtures. Repeat edits/load/unload and inspect sustained memory growth, freezes, console errors and shader failures.

## 7. Documentation and package

- [ ] R35 — Align version strings, README, Help, shortcut reference and release notes with the candidate. Check modifier descriptions against actual behavior; distinguish retired lattice experiments from current tools. Superseded quad-only bevel notes must not describe the new n-gon path as current.
- [ ] R36 — Publish concise known limitations and backup/compatibility guidance. Include a quick start and reproducible bug-report instructions (build, steps, expected/actual result, optional project/screenshot).
- [ ] R37 — Build from an explicit inclusion list. Include required runtime assets, licenses and notices; exclude artist/private projects, personal paths, recordings, temporary output, logs, caches and unused experiments unless deliberately shipped.
- [ ] R38 — Verify redistribution permissions for included heads, hairstyles, braid assets, fonts, images and third-party code. Confirm sample-project permissions separately from test-fixture use.
- [ ] R39 — Extract the actual package to a clean directory and run the launcher without development caches. Test missing prerequisites, occupied default port and paths with spaces. Confirm documented network/offline requirements and local save-service health.
- [ ] R40 — Smoke-test the packaged build: launch → create → save → reopen → edit → undo → export. Record package filename and checksum; keep a rollback copy of the previous release.

## 8. Go / no-go

- [ ] R41 — Every checklist item is passed or explicitly excluded with a reason. No open P0/P1 issue remains in shipping scope; deferred P2 items have owner approval and known-issue notes where needed.
- [ ] R42 — Final verifier and packaged smoke test match the exact candidate being released. Artist signs off visual quality and interaction feel; release owner approves version, notes and package.
- [ ] R43 — Confirm distribution link and support/reporting channel, then publish only with explicit approval. Preserve candidate evidence for follow-up fixes.

## Evidence and issue log

Use `pass`, `fail`, `pending` or `excluded`; an unchecked item is not a pass. Copy rows as needed.

| ID | Build / fixture / environment | Status and evidence | Issue / next action | Tester / date |
|---|---|---|---|---|
| R01 | 0.2.1 / this week, possibly today | Version and timing confirmed; supported targets/delivery format still pending. | Finish scope decision | User / 2026-09-08 |
| R03 | Working tree over 057d35ff395b52ba81e3483b4a8534758a2c734a | Numerous modified and untracked files/assets. Tested-file SHA256 inventory recorded; this is NOT a backup or frozen candidate. | Recoverable source + asset backup and package inclusion list | Assistant / 2026-09-08 |
| R05 | 2026-09-08 working-tree audit | PASS for this audit: syntax/lint and 562 tests, zero failures. Log: ../output/release-review/2026-09-08/baseline.log; fingerprint: tested-files-sha256.csv in same directory. Candidate checkbox remains open until frozen and rerun. | Repeat on final candidate | Assistant / 2026-09-08 |
| R07 | Baseline temporary-file tests | Partial: complete replacement, failed replacement recovery, disk-flush failure and invalid HTTP payload tests passed. Native dialogs not exercised. | Hands-on Save As/overwrite/cancel | Assistant / 2026-09-08 |
| R06/R09 | Isolated Chrome; layered-side-bun (88 strands), braidgirl (3) (31), bellev1 (44) | Partial PASS: originals read without edits; production loader and serializer → production atomic disk writer → reopen preserved all serialized state within numeric tolerance 1e-10. No uncaught browser errors. [Harness](../output/release-review/2026-09-08/persistence-check.cjs), [results](../output/release-review/2026-09-08/persistence-check.log). | Native Save As/download UI, full browser restart, visual checks and additional asset combinations remain pending. Loaded legacy state round-tripped; not proof every original legacy field migrated correctly. | Assistant / 2026-09-08 |
| R08 | Isolated Chrome / bellev1 | Partial PASS: production autosave flush wrote browser recovery; page reload offered recovery; accepting restored serialized state within 1e-10 and retained the recovery copy. Reload offered it again; explicit discard removed the copy without altering the current scene. | Timer scheduling, unsaved New/Open/close prompts, OS/browser crash, quota/write failure and full browser restart remain pending. | Assistant / 2026-09-08 |
| R10/R11 | Isolated Chrome / disposable linked strand pair | Partial PASS: reciprocal mirror creation; undo/redo creation; width-input edits from either side with global mirror off; three undo/redo cycles per edit; project serialization/reopen retains links and editable history behavior; decouple/undo/redo; decoupled width isolation; delete-one clears survivor link, undo restores pair, redo preserves survivor. [Harness](../output/release-review/2026-09-08/mirror-history-check.cjs), [results](../output/release-review/2026-09-08/mirror-history-check.log). | Controller calls and dispatched input events, not physical pointer/menu review. Global-X point editing, hide/unhide, transforms, materials, and additional object types remain pending. | Assistant / 2026-09-08 |
| R10/R12 | Isolated Chrome / three strands, two material resources, two stored presets | Partial PASS: color-input edit changes both shared-material users, not separate-material strand; undo/redo and project reopen retain colors. Preset A title update leaves B unchanged; both survive page reload; deleting A retains B. Autosave-disabled preference survives reload in storage and checkbox. No uncaught page errors. [Harness](../output/release-review/2026-09-08/resource-isolation.cjs), [results](../output/release-review/2026-09-08/resource-isolation.log). | Preset tests call production storage API, not save/apply dialogs; no full browser restart, preset-geometry application, group editing, all preferences, shader visual review or fresh-install sign-off. | Assistant / 2026-09-08 |
| R10/R20/R24/R25 | Isolated Chrome / existing edit integrity harness rerun | Partial PASS: width/lattice/curve-control edit cancellation and undo/redo assertions; bevel single and multi-edge commits, preview cancel and one-step history checks. No uncaught page errors. [Results](../output/release-review/2026-09-08/edit-history-check.log), [harness](../output/brush-review/edit-check.cjs). Log field `quads` checks exported face arities, not an all-quad claim. | Does not certify pointer timing, all segment extremes, mirrored preview, visual topology or DCC imports. | Assistant / 2026-09-08 |
| R09 | Isolated browser / disposable one-strand scene | FAIL: REL-001 below. Truncated JSON and null lock were rejected without removing the strand; invalid point data removed it before returning failure. | Fix load transaction safety, add regression, retest | Assistant / 2026-09-08 |
| R09/R22/R27 | N-gon release path | Pending release review. Prior isolated checks cover snapshot restoration and OBJ face arities, not native file dialogs or downstream import. | Native round trip + DCC review | — |
| R26/R27 | Isolated Chrome / braidgirl (3), bellev1 | Partial PASS: production OBJ builder mesh-only, curve-only, combined, one selected object and empty selection. Finite exported position/UV numbers, valid positive vertex/UV references and minimum face/line sizes. Mesh counts match 31/44 scene objects; 6,152/11,333 faces; 39/41 curve records. Hidden selected object remains included. [Harness](../output/release-review/2026-09-08/export-check.cjs), [results](../output/release-review/2026-09-08/export-check.log). | Builder-level checks, not download/Save As UI. Hidden objects are not filtered by exporter; document policy. Normals/winding, scale/transforms, degeneracy, materials, multiple-selection UI, USDA and DCC import remain pending. | Assistant / 2026-09-08 |
| R35 | Current docs | Pending. README/package say 0.1.5; historical bevel notes still describe quad-only behavior. | Choose version and reconcile documentation | — |
| R35/R36 | Documentation pass | README selection/insertion/mirror shortcuts corrected against current handlers; obsolete Alt+D description removed; internet requirement and hidden-object export policy documented. Added explicitly unreleased [0.2.1 draft notes](RELEASE_NOTES_0.2.1_DRAFT.md) with backup and limitation guidance. | Final version bump, complete shortcut/doc sweep, support channel and owner-approved release notes remain pending. No app/version mutation in this pass. | Assistant / 2026-09-08 |
| R35/R37/R38/R39 | Read-only packaging audit | Identified runtime APP_VERSION also at 0.1.5, outdated README modifiers, CDN-loaded Three.js, developer-runtime launcher fallback, and workspace directories that must not ship wholesale. [Audit and proposed inclusion policy](RELEASE_PACKAGE_AUDIT.md). | Complete dependency manifest, confirm asset permissions and distribution format, reconcile docs/version, build and smoke-test actual package. No archive created. | Assistant / 2026-09-08 |
| R27/R28 | Isolated Chrome / first strand of braidgirl (3) and bellev1 | Partial PASS: after translation, sequential panel-controller edits Z rotation=35°, scale-X=0.4 and scale-Y=-0.2 (AHS additive scale values). Each changes geometry; OBJ coordinates match world positions within 0.000006, USDA coordinates within 0.000001, and USDA normals match normalized world-space viewport normals within 0.000002. [Results](../output/release-review/2026-09-08/export-rotation-scale.log), export-check.cjs. No uncaught page errors. | Tests export fidelity, not independent correctness of the transform algorithm or outward normals. Mirrored/negative-determinant transforms, all geometry types, DCC parsing and visual shading still pending. | Assistant / 2026-09-08 |
| R27/R28 | Isolated Chrome / braidgirl (3), bellev1 | Partial PASS: USDA text checks found expected 31/44 meshes and 39/41 curves, finite points, valid face indices and consistent face/curve counts. Applied +0.25 X through production object-transform panel controller; exported selected OBJ vertices match resulting world-space mesh positions within 0.000006. [Results](../output/release-review/2026-09-08/export-transform-usda.log), extended export-check.cjs harness. No uncaught page errors. | Lightweight emitted-array checks, NOT an OpenUSD parser or DCC import. Rotation/nonuniform scale, normal orientation, USDA primvar interpretation and transformed USDA comparison remain pending. | Assistant / 2026-09-08 |

Issue record: `ID · severity · build/fixture · steps · expected/actual · evidence · owner · fix/hide/defer/document decision · retest result`.

### REL-001 — P0: rejected project can clear the current scene

- Build: 2026-09-08 working-tree audit; isolated browser with a single disposable strand. User's open scene was not used.
- Reproduction: open a correctly enveloped version-1 project whose strand `points` is an object (`{"invalid":true}`), rather than an array. The fixture uses the production `openHairProjectFile` and restoration code.
- Expected: reject the malformed project, retaining current strands and scene state.
- Actual: loader returned false but strand count fell from 1 to 0. Snapshot strand data changed. This is loss of the active scene on rejection; recoverability through Undo was not tested and is not a substitute for safe loading.
- Evidence: [test script](../output/release-review/2026-09-08/project-safety.cjs) and [results](../output/release-review/2026-09-08/project-safety.log). No uncaught page error; the loader catches the error after mutation.
- Disposition: release-blocking. Next work: validate nested scene data before mutation and make project replacement transactional, covering assets and failure during restoration; preserve history/current scene on failure. Add permanent regression coverage and rerun invalid + valid project cases.
- Status: fixed and retested on 2026-09-08 by assistant. Nested point/face preflight now precedes mutation; late failures roll back the saved project and undo/redo checkpoints. Existing head geometry is retained until commit. Autosave waits during loading, and pending scalp work settles before rollback. If rollback itself fails, a recovery project download is attempted rather than silently claiming success.
- Retest: [results](../output/release-review/2026-09-08/project-safety-retest.log) show truncated JSON, null lock, invalid points, late restoration failure and late failure after head removal all rejected with exact strand snapshot, head identity and history preserved. A valid load also succeeded. Full baseline: 564 tests, zero failures ([log](../output/release-review/2026-09-08/baseline-after-load-fix.log)). Added permanent nested-data validation tests.
- R09 remains unchecked pending broader legacy-project coverage. Custom scalp/reference combinations, native file-dialog review and catastrophic rollback-failure download behavior were not exercised. This closes the reproduced failure, not the whole release safety checklist.

Next recommended pass: additional export-format/transform checks and remaining workflow checks. OBJ has partial builder-level evidence, not downstream sign-off. R10–R12 have partial runtime evidence, not complete sign-off. Native Save As/overwrite/cancel still needs hands-on review; automated persistence checks bypassed the OS dialog. Do not spend the release window polishing appearance before project-safety checks are complete.
