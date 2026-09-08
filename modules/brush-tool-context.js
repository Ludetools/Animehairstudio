// Historical tool IDs: radial-draw places patterns; procedural-draw places accessories.
export function brushToolContext(mode, tool, workspaceStyle) {
  const builder = mode === "brush";
  const pattern = tool === "radial-draw";
  const accessory = tool === "procedural-draw";
  return {
    builder,
    generatedDrawTool: pattern || accessory,
    settingsVisible: builder || tool === "draw" || pattern || accessory,
    tabsVisible: builder || pattern || accessory,
    activeStyle: builder ? workspaceStyle : accessory ? "accessory" : "pattern",
    title: builder ? "Brush Builder" : pattern ? "Procedural Brush Tool"
      : accessory ? "Accessory Brush Tool" : "Draw Strand Tool",
    patternEditorVisible: builder && workspaceStyle === "pattern",
    accessoryEditorVisible: builder && workspaceStyle === "accessory",
    patternPlacementVisible: pattern,
    accessoryPlacementVisible: accessory,
  };
}

export function brushStyleTransition(mode, tool, style) {
  if (!style) return null;
  const nextStyle = style === "accessory" ? "accessory" : "pattern";
  if (mode === "brush") return { workspaceStyle: nextStyle };
  if (tool !== "radial-draw" && tool !== "procedural-draw") return null;
  return { tool: nextStyle === "accessory" ? "procedural-draw" : "radial-draw" };
}
