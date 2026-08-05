const TOOL_SHORTCUT_ENTRIES = Object.freeze([
  ["q", "select"],
  ["w", "move"],
  ["e", "rotate"],
  ["r", "scale"],
  ["t", "relax"],
  ["d", "draw"],
  ["p", "panel"],
  ["g", "braid"]
]);

const WORKSPACE_SHORTCUT_ENTRIES = Object.freeze([
  ["1", "strand"],
  ["2", "guide"],
  ["3", "reference"]
]);

const APPLICATION_SHORTCUT_KEYS = new Set([
  ...TOOL_SHORTCUT_ENTRIES.map(([key]) => key),
  ...WORKSPACE_SHORTCUT_ENTRIES.map(([key]) => key),
  "tab",
  "s",
  "b",
  "o",
  "h",
  "l",
  "f",
  "x"
]);

export const TOOL_SHORTCUTS = Object.freeze(Object.fromEntries(TOOL_SHORTCUT_ENTRIES));
export const WORKSPACE_SHORTCUTS = Object.freeze(Object.fromEntries(WORKSPACE_SHORTCUT_ENTRIES));

export function shortcutToolForKey(key) {
  return TOOL_SHORTCUTS[String(key || "").toLowerCase()] || null;
}

export function workspaceForShortcutKey(key) {
  return WORKSPACE_SHORTCUTS[String(key || "").toLowerCase()] || null;
}

export function focusedControlShouldYieldToShortcut(focused, event) {
  const tag = focused?.tagName?.toLowerCase();
  const yieldsAppShortcuts = tag === "select" || (tag === "input" && focused.type === "range");
  if (!yieldsAppShortcuts) return false;
  const key = String(event?.key || "").toLowerCase();
  if (event?.ctrlKey || event?.metaKey) return key === "z" || key === "y" || key === "d";
  if (event?.altKey) return key === "d";
  return event?.key === "Delete" || event?.code === "Space" || APPLICATION_SHORTCUT_KEYS.has(key);
}
