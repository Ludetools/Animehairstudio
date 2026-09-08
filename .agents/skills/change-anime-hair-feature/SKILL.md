---
name: change-anime-hair-feature
description: Implement or debug Anime Hair Studio editor features and interactions. Use for application, module, server, or test changes; use author-anime-hair-preset for hairstyle design rather than editor capabilities.
---

# Change Anime Hair Feature

Read root `AGENTS.md` and `ARCHITECTURE.md`. Follow `docs/FEATURE_CHANGE_PLAYBOOK.md` for the feature contract and implementation lifecycle; start searches at `docs/CHANGE_SURFACE_MAP.md`.

## Route by change

- **Regression or repeated failed fix:** use the playbook's regression-debugging route before patching. Establish the failing transition and capture the error before adding another workaround.
- **Authored state, defaults, groups, mirrors, undo, projects or presets:** read `docs/STATE_AND_PROPAGATION.md`.
- **Curves, meshes, profiles, guides, shading or export:** read `docs/GEOMETRY_CONTRACTS.md`.
- **Isolated static copy/HTML/CSS:** use the playbook's micro-UI path only if JavaScript behaviour, control IDs and state are unaffected.

## Verification

`docs/VERIFICATION_MATRIX.md` is the authoritative verification and live-review policy. Choose its relevant scenarios, including what must remain user-led. Do not treat a source-text match as evidence of runtime behaviour.

Run the canonical baseline for non-micro changes:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-project.ps1
```

Install development dependencies with `pnpm install --frozen-lockfile` if needed. The baseline runs undefined-name linting and discovers all `tests/**/*.test.mjs`; focused runs do not replace it. The compatibility wrapper under this skill's `scripts/` forwards to the same verifier.

Finish with the behaviour delivered, checks actually performed, and remaining verification gaps. Preserve user assets and unrelated edits; experiments must remain recoverable and removable.
