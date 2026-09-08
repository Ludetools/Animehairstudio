# Agent workflow audit

## Purpose and evidence

This audit identifies reusable agent guidance for future Anime Hair Studio work. It is based on:

- The available project feature conversation covering presets, UV tools, exports, curve-lattice and loft experiments, clump experiments, interaction fixes, dynamic density, project files, and server regressions.
- The separate anime-hair shader iteration conversation.
- The current `AGENTS.md`, repo skills, architecture notes, propagation and geometry contracts, verification matrix, patch notes, tests, launcher, and verifier.

Conversation history is sampled from the project-relevant tasks available in Codex, so frequency labels below are directional rather than exhaustive counts.

## Executive summary

The existing `change-anime-hair-feature` skill correctly captures the production feature lifecycle. The largest remaining sources of repeated effort are operational:

1. Experimental ideas receive production-grade propagation before their interaction is proven.
2. Live browser checks repeatedly rediscover how to start, locate, reload, exercise, and clean the app.
3. Interaction regressions recur at the boundaries between hover, click priority, generated-handle rebuilds, gizmo attachment, and tool switching.
4. Small fixes sometimes receive geometry-feature-level verification.
5. Static DOM tests sometimes pin private implementation shapes, making safe refactors unnecessarily expensive.

The highest-value additions are:

- A staged experiment rule and focused `prototype-anime-hair-experiment` skill.
- A deterministic live-check workflow and `verify-anime-hair-live` skill.
- A risk-tiered validation rule.
- Reusable live fixtures and a lifecycle-search script.
- A few compact additions to `AGENTS.md`; the remaining detail should live in skills or references.

## Common actions

| Action | Frequency | Cost when repeated | Existing coverage | Recommended reuse |
|---|---:|---:|---|---|
| Define a feature contract and map its lifecycle | Very high | Medium | Strong | Keep in the existing feature skill |
| Add contextual controls and synchronize their readouts | High | Medium | Strong | Add a small control checklist/reference |
| Propagate authored values through construction, mirrors, undo, projects, and presets | Very high | High | Strong | Add a lifecycle-search script |
| Extract reusable geometry/data math and add focused tests | High | Medium | Strong | Keep current module boundary |
| Debug pointer priority, selection, and gizmo attachment | High | High | Partial | Add an interaction routing reference |
| Inspect geometry from multiple views and wire overlay | High | High | Strong conceptually, operationally weak | Add live-check scenarios and fixtures |
| Verify project save/load, legacy fallbacks, and undo | High | High | Strong conceptually | Add a repeatable persistence fixture |
| Add or revise exports and downstream metadata | Medium | High | Strong | Add representative export smoke scripts |
| Prototype, reject, retire, or selectively restore experiments | High | Very high | Partial | Add a staged experiment skill |
| Start/reuse the local server and connect a browser tab | High | High | Partial | Add a deterministic live-check skill |
| Add or retire localization strings and DOM contract tests | Medium | Medium | Partial | Add contract-testing rules |
| Diagnose a small asset/server regression | Medium | Low | Partial | Use proportional validation |

## Repeated workflow patterns

### 1. Production feature lifecycle

Successful feature work generally follows the same path:

1. State the applicable tool, authoritative owner, defaults, and compatibility.
2. Find the nearest feature with the same lifecycle.
3. Put reusable math or transformations in `modules/`.
4. Coordinate DOM, Three.js runtime objects, and authored state in `app.js`.
5. Add focused module tests and DOM contracts.
6. Complete mirror, undo, save/load, preset, preview, and export paths.
7. Run automated verification.
8. Exercise the feature in the browser and restore a clean scene.

This is already well represented by `change-anime-hair-feature`, `FEATURE_CHANGE_PLAYBOOK.md`, and `STATE_AND_PROPAGATION.md`. A second general feature skill would duplicate them.

### 2. Experimental geometry and interaction

The Surface, Loft Surface, Clump Conform, Compound Strand, and Boolean Match conversations show the most expensive pattern:

1. An uncertain interaction idea is implemented.
2. Production concerns such as localization, persistence, presets, mirroring, and tests are added.
3. The interaction is evaluated only after broad integration.
4. The idea is rejected or narrowed.
5. Many propagation paths must be removed.
6. A useful subset may later be restored selectively.

The existing rules say to isolate experiments, but they need a stronger stage boundary. The interaction or geometry proof should be reviewed before durable schema and full propagation are added.

Recommended stages:

```text
Proof
  transient state + one entry point + representative geometry
  -> user evaluates the interaction

Accept
  name the authoritative state and compatibility contract
  -> add undo, project, mirror, preset, localization, and export paths

Retire
  remove active entry points and runtime paths
  -> retain only explicitly valuable pure math or recovery notes
```

### 3. Live interaction verification

Live checks repeatedly perform the same setup:

- Determine whether the app is open through `file://` or the local server.
- Find or launch the correct server and port.
- Claim, open, or reload a browser tab.
- Create a representative scene, often by manually drawing an object.
- Locate contextual controls.
- Exercise click, drag, cancel, undo, or tool switching.
- Inspect screenshots and browser logs.
- Reload to clear the temporary scene.

Several conversations spent substantial time rediscovering browser API calls or recovering a stopped/incorrect preview process. This is procedural knowledge suitable for a skill and a small script, not repeated reasoning.

### 4. Interaction routing regressions

The same failure family appears across point handles, width edges, scalp controls, proportional editing, and transform tools:

- Hover sees a target that click handling excludes.
- A lower-priority handler yields, but the next handler never claims the gesture.
- Rebuilding handles invalidates a selected runtime object while authored selection remains.
- A visible gizmo is still attached to an obsolete handle.
- Switching tools leaves helpers or falloff colors visible in the wrong context.
- Drag completion and click selection compete for the same pointer sequence.

These should be documented as a routing stack:

```text
active modal gesture
  -> transform gizmo picker
  -> visible control point
  -> object-specific edge/loop handle
  -> selectable scene object
  -> empty-space deselect or camera gesture
```

Any handler that yields must have a known successor. Any operation that rebuilds runtime handles must restore selection by stable authored identity, then reattach or detach the gizmo.

### 5. Geometry and export preservation

Geometry work commonly changes center-curve sampling, width/depth profiles, frames, normals, density, UVs, or quad metadata. The successful pattern is:

- Test pure sampling/topology math independently.
- Preserve stable curve frames instead of recalculating orientation from world position.
- Treat render triangles and conceptual export quads separately.
- Inspect a representative mesh with wire overlay.
- Test output metadata, not only viewport appearance.

This is well covered by `GEOMETRY_CONTRACTS.md`. The gap is deterministic representative fixtures and export smoke scripts.

### 6. Verification proportionality

The conversations expose two competing needs:

- High-risk geometry, interaction, persistence, and export changes require broad automated and live checks.
- A one-line MIME or label fix should not trigger a long process investigation and restart unless the acceptance condition requires it.

The user explicitly asked to stop live testing in one feature turn and later objected to excessive verification for a small server fix. The agent should distinguish baseline safety from optional live depth and should stop optional verification promptly when asked.

## Recommended rules

The following are proposed additions or revisions, not yet applied to `AGENTS.md`.

### Adopt in `AGENTS.md`

```markdown
## Change sizing

- Classify work before editing as small contract, production feature, high-risk geometry/interaction, or experiment.
- Keep contracts proportional. For a small label, MIME, or constant change, state the affected surface and acceptance check without expanding every lifecycle item.
- When the user asks to stop or skip testing, stop optional live verification immediately. Run only the safe checks still required by explicit repository policy, and report what was skipped.

## Experiments

- For requests framed as try, experiment, prototype, or an uncertain interaction method, implement a proof stage first.
- In the proof stage, use one feature gate, transient runtime state, and the narrowest representative object path. Do not add project fields, presets, migrations, or broad localization until the user accepts the behavior.
- Define acceptance and retirement boundaries before broad integration.

## Live app operations

- Reuse a healthy Anime Hair Studio server and existing app tab when possible. Do not restart the server merely to verify an unrelated client-side change.
- Launch background processes without visible windows. Never leave an unexpected command prompt on the user's desktop.
- Use the local HTTP URL for live checks; treat `file://` as insufficient for native save/export and server behavior.
- Restore a clean scene and close temporary tabs after live verification. Keep temporary save/export artifacts inside the workspace or a disposable temp directory.

## Test contracts

- Prefer unit tests for pure behavior and DOM tests for user-visible controls, IDs, contextual visibility, shortcuts, and integration routes.
- Avoid DOM regex assertions that require a private helper's exact name or body when equivalent implementations preserve the contract.
- When runtime handles are rebuilt, restore selection by stable authored identity and explicitly reattach or detach transform controls.
```

### Revise validation policy

Use explicit risk tiers:

| Tier | Examples | Required validation |
|---|---|---|
| 0 | Documentation only | Link/reference check; no app tests |
| 1 | Label, constant, MIME map, isolated CSS | Relevant syntax or focused contract test; full verifier when repository policy or batching warrants it |
| 2 | UI control, state field, material setting, project action | Full verifier plus one targeted runtime scenario |
| 3 | Pointer/gizmo, geometry, shader, persistence, mirror, export | Full verifier plus the applicable live/persistence/geometry/export protocol |
| Experiment | Unaccepted interaction or geometry idea | Focused proof check first; production validation only after acceptance |

This requires an intentional update to the current unconditional “full verifier after every source change” rule.

## Recommended skills

### 1. `prototype-anime-hair-experiment`

Priority: highest.

Trigger on requests such as “try a different method,” “experiment with,” “could we see if,” or a feature whose interaction model is explicitly uncertain.

Responsibilities:

- Write a proof contract with acceptance and discard criteria.
- Select one removable entry point and one feature gate.
- Prefer transient state and an existing output object type.
- Delay schema, migrations, presets, and complete propagation.
- Get an early live result in front of the user.
- On acceptance, hand off to `change-anime-hair-feature`.
- On rejection, remove the proof path and retain only approved reusable math or a concise recovery note.

Suggested structure:

```text
.agents/skills/prototype-anime-hair-experiment/
  SKILL.md
  references/
    experiment-boundaries.md
```

The skill should stay concise. The reference can contain the proof/accept/retire checklist and examples from Surface, Loft, and Clump experiments.

### 2. `verify-anime-hair-live`

Priority: high.

Trigger when a feature requires live browser verification, the user asks to test the running app, or a regression must be reproduced interactively.

Responsibilities:

- Resolve the app URL through the existing launcher and health endpoint.
- Reuse a healthy server and existing tab.
- Choose a scenario from the verification matrix.
- Use a known fixture or preset instead of manually constructing a complex scene when possible.
- Capture exact control values, modes, logs, and relevant screenshots.
- Restore a clean state and remove temporary artifacts.
- Report checks performed without overstating visual coverage.

Suggested structure:

```text
.agents/skills/verify-anime-hair-live/
  SKILL.md
  references/
    interaction-scenarios.md
    geometry-scenarios.md
    persistence-scenarios.md
  scripts/
    resolve-app-url.ps1
```

`resolve-app-url.ps1` should reuse `Start Anime Hair Studio.ps1 -NoOpen`, validate `/api/health`, and print only the URL. It must not open a visible window.

### Skills not recommended

- Do not add another general feature-change skill; the existing one already covers that scope.
- Do not add a dedicated feature-removal skill yet. Strengthen the experiment skill and existing removal checklist first.
- Do not add separate skills for UVs, mirrors, presets, or exports until repeated work shows that their tool workflow cannot fit in the existing feature and live-verification skills.

## Recommended scripts and references

### `scripts/find-feature-surfaces.ps1`

Given one or more identifiers, print matches grouped by lifecycle surface:

- defaults/config
- HTML/control IDs
- construction and cloning
- group/default application
- mirroring/link synchronization
- undo snapshots and restoration
- serialization/loading
- presets
- geometry/material consumers
- export
- localization
- tests

This does not prove completeness, but it reduces repeated searches and makes omissions visible before editing.

### Stable live fixtures

Create small project fixtures under a test-specific folder for:

- One regular strand with asymmetric width/depth profiles.
- One panel with multiple splits.
- One braid using an authored mesh.
- A linked mirror pair.
- A capsule guide with an attached strand.
- A mixed scene for material, UV, and visibility checks.

Fixtures should be disposable, deterministic, and versioned with safe compatibility expectations. They should not be presented as user presets.

### `docs/INTERACTION_ROUTING.md`

Document:

- Pointer priority.
- Hover/click agreement.
- Pointer capture ownership and release.
- Drag-versus-click suppression.
- Runtime handle rebuild and gizmo reattachment.
- Tool-switch cleanup.
- Input-focus isolation.
- Empty-space deselection and Alt-orbit invariants.

This should be referenced conditionally from `change-anime-hair-feature` and `verify-anime-hair-live`.

### Export smoke tests

Add deterministic parsers or assertions for representative OBJ and USDA output:

- face arity and quad metadata
- UV indices and interpolation
- object names
- curve records
- mirrored winding
- required attributes

Keep downstream Maya checks explicitly separate because Maya is not available in the normal agent environment.

## Adoption order

1. Add the experiment stage rules to `AGENTS.md`.
2. Create `prototype-anime-hair-experiment`.
3. Add `docs/INTERACTION_ROUTING.md`.
4. Create `verify-anime-hair-live` and its URL resolver.
5. Add stable live fixtures.
6. Add the lifecycle-search script.
7. Revise validation tiers after agreeing how much baseline verification small changes require.
8. Add export smoke coverage as export work resumes.

## Expected savings

- Less propagation and rollback work for rejected experiments.
- Faster browser setup and fewer server/process detours.
- Earlier detection of interaction-model problems.
- Fewer regressions caused by stale gizmo targets or mismatched hover/click routing.
- Smaller test maintenance cost during behavior-preserving refactors.
- Verification effort better matched to risk and explicit user preference.

