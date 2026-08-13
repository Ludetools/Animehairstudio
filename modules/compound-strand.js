function edgeMidpointX(points, index) {
  const next = (index + 1) % points.length;
  return (Number(points[index].x) + Number(points[next].x)) * 0.5;
}

function sideEdgeIndex(points, side) {
  let bestIndex = 0;
  for (let index = 1; index < points.length; index += 1) {
    const value = edgeMidpointX(points, index);
    const best = edgeMidpointX(points, bestIndex);
    if ((side === "left" && value < best) || (side === "right" && value > best)) {
      bestIndex = index;
    }
  }
  return bestIndex;
}

function nodeKey(controllerIndex, profileIndex) {
  return `${controllerIndex}:${profileIndex}`;
}

function addGraphEdge(graph, first, second) {
  if (!graph.has(first)) graph.set(first, []);
  if (!graph.has(second)) graph.set(second, []);
  graph.get(first).push(second);
  graph.get(second).push(first);
}

function slotFromKey(key) {
  const [controllerIndex, profileIndex] = key.split(":").map(Number);
  return { controllerIndex, profileIndex };
}

export function compoundConnectedSegmentCount(segmentCount, connectedFraction = 0.35) {
  const count = Math.max(0, Math.round(Number(segmentCount) || 0));
  if (count < 2) return count;
  const fraction = Math.min(1, Math.max(0, Number(connectedFraction) || 0));
  return Math.min(count - 1, Math.max(1, Math.round(count * fraction)));
}

export function normalizeCompoundBridgeZippers(zippers, seamCount = 2) {
  const count = Math.max(0, Math.round(Number(seamCount) || 0));
  const source = Array.isArray(zippers) ? zippers : [];
  return Array.from({ length: count }, (_, index) => ({
    parameter: Math.min(0.9, Math.max(0.05, Number(source[index]?.parameter ?? 0.35))),
    offset: Math.min(0.35, Math.max(-0.35, Number(source[index]?.offset) || 0))
  }));
}

export function compoundBridgeSegmentCounts(segmentCount, zippers, seamCount = 2) {
  const segments = Math.max(0, Math.round(Number(segmentCount) || 0));
  if (segments < 2) return Array.from({ length: Math.max(0, seamCount) }, () => segments);
  return normalizeCompoundBridgeZippers(zippers, seamCount).map((zipper) => (
    Math.min(segments - 1, Math.max(1, Math.round(segments * zipper.parameter)))
  ));
}

export function compoundControllerWidthScales(zippers, controllerCount = 3) {
  const count = Math.max(1, Math.round(Number(controllerCount) || 1));
  const normalized = normalizeCompoundBridgeZippers(zippers, Math.max(0, count - 1));
  const scales = Array.from({ length: count }, () => 1);
  normalized.forEach((zipper, seam) => {
    scales[seam] += zipper.offset;
    scales[seam + 1] -= zipper.offset;
  });
  return scales.map((scale) => Math.max(0.3, scale));
}

export function compoundBridgeParameters(verticalLoopCount = 0) {
  const loops = Math.min(8, Math.max(0, Math.round(Number(verticalLoopCount) || 0)));
  const segments = loops + 1;
  return Array.from({ length: segments + 1 }, (_, index) => index / segments);
}

export function compoundBridgeArchWeight(parameter, rowParameter, smoothing = 0) {
  const across = Math.min(1, Math.max(0, Number(parameter) || 0));
  const along = Math.min(1, Math.max(0, Number(rowParameter) || 0));
  const strength = Math.min(1, Math.max(0, Number(smoothing) || 0));
  const featherStart = 0.45;
  const featherParameter = Math.min(1, Math.max(0, (along - featherStart) / (1 - featherStart)));
  const feather = featherParameter * featherParameter * (3 - 2 * featherParameter);
  return Math.sin(Math.PI * across) * feather * strength;
}

/**
 * Describes a three-lobed strand made by removing the longitudinal quad strip
 * on every touching side and bridging the exposed upper and lower rails.
 */
export function compoundProfileBridgePlan(profilePoints, controllerCount = 3) {
  const points = Array.isArray(profilePoints) ? profilePoints : [];
  const count = Math.max(0, Math.round(Number(controllerCount) || 0));
  if (points.length < 4 || count < 2) return null;
  const leftEdge = sideEdgeIndex(points, "left");
  const rightEdge = sideEdgeIndex(points, "right");
  if (leftEdge === rightEdge) return null;

  const removedEdges = Array.from({ length: count }, (_, controllerIndex) => {
    const edges = [];
    if (controllerIndex > 0) edges.push(leftEdge);
    if (controllerIndex < count - 1) edges.push(rightEdge);
    return edges;
  });
  const bridges = [];
  for (let seam = 0; seam < count - 1; seam += 1) {
    const leftEndpoints = [rightEdge, (rightEdge + 1) % points.length]
      .sort((a, b) => Number(points[b].z) - Number(points[a].z));
    const rightEndpoints = [leftEdge, (leftEdge + 1) % points.length]
      .sort((a, b) => Number(points[b].z) - Number(points[a].z));
    bridges.push(
      {
        leftController: seam,
        rightController: seam + 1,
        leftProfileIndex: leftEndpoints[0],
        rightProfileIndex: rightEndpoints[0],
        surface: "upper"
      },
      {
        leftController: seam,
        rightController: seam + 1,
        leftProfileIndex: leftEndpoints[1],
        rightProfileIndex: rightEndpoints[1],
        surface: "lower"
      }
    );
  }

  const graph = new Map();
  for (let controllerIndex = 0; controllerIndex < count; controllerIndex += 1) {
    for (let profileIndex = 0; profileIndex < points.length; profileIndex += 1) {
      if (removedEdges[controllerIndex].includes(profileIndex)) continue;
      addGraphEdge(
        graph,
        nodeKey(controllerIndex, profileIndex),
        nodeKey(controllerIndex, (profileIndex + 1) % points.length)
      );
    }
  }
  bridges.forEach((bridge) => addGraphEdge(
    graph,
    nodeKey(bridge.leftController, bridge.leftProfileIndex),
    nodeKey(bridge.rightController, bridge.rightProfileIndex)
  ));
  if ([...graph.values()].some((neighbors) => neighbors.length !== 2)) return null;

  const start = [...graph.keys()][0];
  const perimeter = [];
  let previous = null;
  let current = start;
  do {
    perimeter.push(slotFromKey(current));
    const neighbors = graph.get(current);
    const next = neighbors[0] === previous ? neighbors[1] : neighbors[0];
    previous = current;
    current = next;
  } while (current !== start && perimeter.length <= graph.size);
  if (current !== start || perimeter.length !== graph.size) return null;
  return { leftEdge, rightEdge, removedEdges, bridges, perimeter };
}
