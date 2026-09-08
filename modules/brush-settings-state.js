// Session-only values for the shared stroke controls; no scene or preset objects.
export function strokeSettingsOwner(mode, tool, style) {
  if (mode === "brush") return `builder:${style === "accessory" ? "accessory" : "pattern"}`;
  if (tool === "radial-draw") return "pattern";
  if (tool === "procedural-draw") return "accessory";
  return "draw";
}

export function createStrokeSettingsState(defaults) {
  return { owner: "draw", defaults: { ...defaults }, values: {} };
}

export function switchStrokeSettingsOwner(state, owner, current) {
  if (state.owner === owner) return null;
  state.values[state.owner] = { ...current };
  state.owner = owner;
  return { ...(state.values[owner] || state.defaults) };
}
