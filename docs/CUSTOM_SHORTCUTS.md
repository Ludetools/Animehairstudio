# Custom shortcuts: first pass

Settings > Keyboard Shortcuts opens an independent modal editor. Fourteen existing tool/workspace bindings accept single letters/numbers. Fixed navigation, modifier combinations, Delete, Escape, Space, Tab and held gesture commands remain unchanged; reserved keys are rejected rather than silently shadowed.

The registry is authoritative for lookup, conflict detection, defaults and focused-slider/dropdown routing. Toolbar key labels, titles, the shortcut-help keys and reference-plane hint reflect committed bindings. Existing tool tap/hold/release handling consumes the reassigned key without synthesizing keyboard events.

The modal edits a draft: Save writes local browser storage before activating it; Cancel/Escape discards it. Capture Escape cancels capture only. Conflicts identify the other action and require an explicit swap; Reset uses the same conflict path. Reset All restores a complete default map. Corrupt/duplicate/reserved stored bindings fall back atomically to defaults. Blocked storage reports failure without changing the active map.

All workspaces retain their normal tool applicability. Scene data, object defaults, groups, mirrors, history, projects, presets, geometry and exports are unaffected. Shortcut settings are browser-local and not currently included in preference backup files. Modal key capture does not dispatch viewport actions; ordinary text and number inputs retain normal typing.

Checks: registry reassignment, conflict/swap/reset, case normalization, invalid storage, focus routing, draft cancellation, failed save, and production tap/hold/release controller fixtures. User-led live review remains necessary for actual keyboard layout, browser focus, displayed labels and held radial interaction.
