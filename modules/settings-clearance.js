// Screen-space clearance; callers convert the returned displacement to CSS units.
export function settingsClearance(panel, stats, viewport, gap = 12) {
  const overlaps=panel.left<stats.right+gap&&panel.right>stats.left-gap
    &&panel.top<stats.bottom+gap&&panel.bottom>stats.top-gap;
  if(!overlaps)return null;
  const top=stats.bottom+gap;
  return {dy:top-panel.top,maxHeight:Math.max(40,viewport.bottom-top-gap)};
}
