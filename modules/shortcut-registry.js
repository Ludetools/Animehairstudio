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
  ["2", "mesh"],
  ["3", "guide"],
  ["4", "reference"],
  ["5", "brush"],
  ["6", "preset"]
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

export const EDITABLE_SHORTCUTS = Object.freeze([
  ...TOOL_SHORTCUT_ENTRIES.map(([key, target]) => ({ id: `tool:${target}`, key, target, kind: 'tool' })),
  ...WORKSPACE_SHORTCUT_ENTRIES.map(([key, target]) => ({ id: `workspace:${target}`, key, target, kind: 'workspace' }))
].map(Object.freeze));
export const DEFAULT_SHORTCUT_BINDINGS = Object.freeze(Object.fromEntries(EDITABLE_SHORTCUTS.map(action => [action.id, action.key])));
const RESERVED_KEYS = new Set(['s', 'b', 'o', 'h', 'l', 'f', 'x', 'z']);
let shortcutBindings = { ...DEFAULT_SHORTCUT_BINDINGS };

export function validShortcutKey(key) {
  return typeof key === 'string' && /^[a-z0-9]$/.test(key) && !RESERVED_KEYS.has(key);
}

export function normalizeShortcutBindings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_SHORTCUT_BINDINGS };
  const candidate = Object.fromEntries(EDITABLE_SHORTCUTS.map(({ id, key }) => [id, typeof value[id] === 'string' ? value[id].toLowerCase() : key]));
  const keys = Object.values(candidate);
  return keys.every(validShortcutKey) && new Set(keys).size === keys.length ? candidate : { ...DEFAULT_SHORTCUT_BINDINGS };
}

export function changeShortcutBinding(bindings, id, key, swap = false) {
  key = String(key || '').toLowerCase();
  if (!Object.hasOwn(DEFAULT_SHORTCUT_BINDINGS, id) || !validShortcutKey(key)) {
    return { error: 'Use a single letter or number. S, B, O, H, L, F, X and Z are reserved for existing gestures and commands.' };
  }
  const conflict = EDITABLE_SHORTCUTS.find(action => action.id !== id && bindings[action.id] === key)?.id;
  if (conflict && !swap) return { conflict };
  const next = { ...bindings, [id]: key };
  if (conflict) next[conflict] = bindings[id];
  return { bindings: next };
}

export function setShortcutBindings(value) {
  shortcutBindings = normalizeShortcutBindings(value);
  return { ...shortcutBindings };
}

export function getShortcutBindings() { return { ...shortcutBindings }; }

export function shortcutToolForKey(key) {
  return EDITABLE_SHORTCUTS.find(action => action.kind === 'tool' && shortcutBindings[action.id] === String(key || '').toLowerCase())?.target || null;
}

export function workspaceForShortcutKey(key) {
  return EDITABLE_SHORTCUTS.find(action => action.kind === 'workspace' && shortcutBindings[action.id] === String(key || '').toLowerCase())?.target || null;
}

export function pointerControlShouldReturnViewportFocus(control) {
  const tag = control?.tagName?.toLowerCase();
  if (tag === "input") {
    return ["checkbox", "radio", "range"].includes(String(control.type || "").toLowerCase());
  }
  return tag === "button" && control?.getAttribute?.("aria-pressed") !== null;
}

export function focusedControlShouldYieldToShortcut(focused, event) {
  const tag = focused?.tagName?.toLowerCase();
  const yieldsAppShortcuts = tag === "select" || (tag === "input" && focused.type === "range");
  if (!yieldsAppShortcuts) return false;
  const key = String(event?.key || "").toLowerCase();
  if (event?.ctrlKey || event?.metaKey) return key === "z" || key === "y" || key === "d" || key === "h";
  if (event?.altKey) return key === "d";
  return event?.key === "Delete" || event?.code === "Space" || shortcutToolForKey(key) !== null
    || workspaceForShortcutKey(key) !== null || (APPLICATION_SHORTCUT_KEYS.has(key) && !TOOL_SHORTCUTS[key] && !WORKSPACE_SHORTCUTS[key]);
}
