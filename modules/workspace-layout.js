export const PANEL_DEFAULTS = Object.freeze({ left: 280, right: 360 });

export function dockedToolSettingsLayout(viewport, rail, workspace, scale = 1) {
  const zoom = scale > 0 ? scale : 1;
  const w = viewport.width / zoom, h = viewport.height / zoom;
  const edge = 8, gap = 4;
  const left = Math.min(Math.max(edge, (rail.right - viewport.left) / zoom + gap), Math.max(0, w - edge));
  const top = Math.min(Math.max(edge, (rail.top - viewport.top) / zoom), Math.max(0, h - edge));
  const right = Math.min(w - edge, (workspace.right - viewport.left) / zoom);
  return { left, top, width: Math.max(0, right - left), maxHeight: Math.max(0, h - top - edge) };
}

export function normalizePanelWidths(value) {
  const width = side => Number.isFinite(value?.[side])
    ? Math.round(Math.max(side === 'left' ? 220 : 280, Math.min(520, value[side])))
    : PANEL_DEFAULTS[side];
  return { left: width('left'), right: width('right') };
}

export function draggedPanelWidth(side, width, delta, scale = 1) {
  return normalizePanelWidths({ [side]: width + delta / (scale > 0 ? scale : 1) * (side === 'left' ? 1 : -1) })[side];
}

export function panelDragShouldCollapse(side, width, delta, scale = 1) {
  return width + delta / (scale > 0 ? scale : 1) * (side === 'left' ? 1 : -1) < 140;
}
