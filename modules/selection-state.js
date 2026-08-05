function uniqueValidIds(ids, validIds) {
  const valid = validIds == null ? null : new Set(validIds);
  return [...new Set(ids || [])].filter((id) => id != null && (!valid || valid.has(id)));
}

export function screenBoundsOverlap(first, second) {
  if (!first || !second) return false;
  return Number(first.left) <= Number(second.right)
    && Number(first.right) >= Number(second.left)
    && Number(first.top) <= Number(second.bottom)
    && Number(first.bottom) >= Number(second.top);
}

function pointInsideScreenBounds(point, bounds) {
  return point.x >= bounds.left && point.x <= bounds.right
    && point.y >= bounds.top && point.y <= bounds.bottom;
}

function screenCross(a, b, point) {
  return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
}

function pointInsideScreenTriangle(point, triangle) {
  const [a, b, c] = triangle;
  const ab = screenCross(a, b, point);
  const bc = screenCross(b, c, point);
  const ca = screenCross(c, a, point);
  return (ab >= 0 && bc >= 0 && ca >= 0) || (ab <= 0 && bc <= 0 && ca <= 0);
}

function screenSegmentsIntersect(a, b, c, d) {
  if (!screenBoundsOverlap(
    { left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) },
    { left: Math.min(c.x, d.x), right: Math.max(c.x, d.x), top: Math.min(c.y, d.y), bottom: Math.max(c.y, d.y) }
  )) return false;
  const abC = screenCross(a, b, c);
  const abD = screenCross(a, b, d);
  const cdA = screenCross(c, d, a);
  const cdB = screenCross(c, d, b);
  return ((abC <= 0 && abD >= 0) || (abC >= 0 && abD <= 0))
    && ((cdA <= 0 && cdB >= 0) || (cdA >= 0 && cdB <= 0));
}

export function triangleIntersectsScreenBounds(triangle, bounds) {
  if (!Array.isArray(triangle) || triangle.length !== 3 || !bounds) return false;
  const triangleBounds = {
    left: Math.min(...triangle.map((point) => point.x)),
    right: Math.max(...triangle.map((point) => point.x)),
    top: Math.min(...triangle.map((point) => point.y)),
    bottom: Math.max(...triangle.map((point) => point.y))
  };
  if (!screenBoundsOverlap(triangleBounds, bounds)) return false;
  if (triangle.some((point) => pointInsideScreenBounds(point, bounds))) return true;
  const corners = [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom }
  ];
  if (corners.some((corner) => pointInsideScreenTriangle(corner, triangle))) return true;
  const triangleEdges = triangle.map((point, index) => [point, triangle[(index + 1) % 3]]);
  const boundsEdges = corners.map((point, index) => [point, corners[(index + 1) % 4]]);
  return triangleEdges.some(([a, b]) => boundsEdges.some(([c, d]) => screenSegmentsIntersect(a, b, c, d)));
}

export function emptyStrandSelection() {
  return { activeId: undefined, selectedIds: [] };
}

export function resolveStrandSelection({
  activeId,
  selectedIds,
  requestedId,
  requestedIds,
  explicitSelectedIds,
  selectionMode,
  validIds
} = {}) {
  const valid = validIds == null ? null : new Set(validIds);
  const requestedActiveId = requestedId != null && (!valid || valid.has(requestedId))
    ? requestedId
    : undefined;
  const requested = uniqueValidIds(requestedIds, validIds);

  if (selectionMode === "add" || selectionMode === "remove") {
    const nextIds = new Set(uniqueValidIds(selectedIds, validIds));
    const primaryId = nextIds.has(activeId) ? activeId : undefined;
    requested.forEach((id) => {
      if (selectionMode === "remove") nextIds.delete(id);
      else nextIds.add(id);
    });
    const nextSelectedIds = [...nextIds];
    return {
      activeId: primaryId && nextIds.has(primaryId) ? primaryId : nextSelectedIds[0],
      selectedIds: nextSelectedIds
    };
  }

  if (Array.isArray(explicitSelectedIds)) {
    const nextIds = new Set(uniqueValidIds(explicitSelectedIds, validIds));
    if (requestedActiveId) nextIds.add(requestedActiveId);
    return { activeId: requestedActiveId, selectedIds: [...nextIds] };
  }

  return { activeId: requestedActiveId, selectedIds: requested };
}

export function restoreStrandSelection({ activeId, selectedIds, validIds } = {}) {
  const valid = validIds == null ? null : new Set(validIds);
  if (activeId == null || (valid && !valid.has(activeId))) return emptyStrandSelection();
  const restoredIds = uniqueValidIds(
    Array.isArray(selectedIds) ? selectedIds : [activeId],
    validIds
  );
  if (!restoredIds.includes(activeId)) restoredIds.push(activeId);
  return { activeId, selectedIds: restoredIds };
}

export function activateStrandSelection({ selectedIds } = {}, activeId) {
  return {
    activeId,
    selectedIds: uniqueValidIds(selectedIds)
  };
}
