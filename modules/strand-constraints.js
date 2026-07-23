function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function solvePulledStrand(points, pointIndex, target, elasticity = 0.18, rigidity = 0) {
  const solved = points.map((point) => point.clone());
  if (!points.length || pointIndex < 0 || pointIndex >= points.length) return solved;

  if (pointIndex === 0) {
    const delta = target.clone().sub(points[0]);
    return points.map((point) => point.clone().add(delta));
  }

  const chain = points.slice(0, pointIndex + 1).map((point) => point.clone());
  const root = chain[0].clone();
  const segmentLengths = [];
  let restLength = 0;
  for (let index = 0; index < pointIndex; index += 1) {
    const length = Math.max(0.0001, points[index].distanceTo(points[index + 1]));
    segmentLengths.push(length);
    restLength += length;
  }

  const requestedDistance = root.distanceTo(target);
  const elasticAmount = clamp(Number(elasticity) || 0, 0, 1);
  if (requestedDistance > restLength && elasticAmount > 0) {
    const capacities = segmentLengths.map((length, index) => {
      const hierarchyWeight = (index + 1) / segmentLengths.length;
      return length * elasticAmount * hierarchyWeight * hierarchyWeight;
    });
    const totalCapacity = capacities.reduce((sum, value) => sum + value, 0);
    const usedStretch = Math.min(requestedDistance - restLength, totalCapacity);
    if (totalCapacity > 0) {
      segmentLengths.forEach((length, index) => {
        segmentLengths[index] = length + usedStretch * (capacities[index] / totalCapacity);
      });
    }
  }

  const solvedLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  const rootToTarget = target.clone().sub(root);
  const constrainedTarget = requestedDistance > solvedLength
    ? root.clone().add(rootToTarget.normalize().multiplyScalar(solvedLength))
    : target.clone();

  if (requestedDistance >= solvedLength - 0.0001) {
    const direction = constrainedTarget.clone().sub(root).normalize();
    chain[0].copy(root);
    for (let index = 1; index < chain.length; index += 1) {
      chain[index].copy(chain[index - 1]).addScaledVector(direction, segmentLengths[index - 1]);
    }
  } else {
    for (let iteration = 0; iteration < 10; iteration += 1) {
      chain[pointIndex].copy(constrainedTarget);
      for (let index = pointIndex - 1; index >= 0; index -= 1) {
        const direction = chain[index].clone().sub(chain[index + 1]);
        if (direction.lengthSq() < 1e-10) direction.copy(points[index]).sub(points[index + 1]);
        chain[index].copy(chain[index + 1]).add(direction.normalize().multiplyScalar(segmentLengths[index]));
      }
      chain[0].copy(root);
      for (let index = 1; index <= pointIndex; index += 1) {
        const direction = chain[index].clone().sub(chain[index - 1]);
        if (direction.lengthSq() < 1e-10) direction.copy(points[index]).sub(points[index - 1]);
        chain[index].copy(chain[index - 1]).add(direction.normalize().multiplyScalar(segmentLengths[index - 1]));
      }
      if (chain[pointIndex].distanceToSquared(constrainedTarget) < 1e-8) break;
    }
  }

  const rigidityAmount = clamp(Number(rigidity) || 0, 0, 1);
  if (rigidityAmount > 0 && pointIndex > 1) {
    const targetDelta = constrainedTarget.clone().sub(points[pointIndex]);
    const preferred = chain.map((point, index) => {
      const hierarchyAmount = index / pointIndex;
      return points[index].clone().addScaledVector(targetDelta, hierarchyAmount);
    });
    const shapeStrength = rigidityAmount * 0.42;

    for (let iteration = 0; iteration < 14; iteration += 1) {
      for (let index = 1; index < pointIndex; index += 1) {
        chain[index].lerp(preferred[index], shapeStrength);
      }

      chain[0].copy(root);
      chain[pointIndex].copy(constrainedTarget);
      for (let pass = 0; pass < 2; pass += 1) {
        const start = pass === 0 ? 0 : pointIndex - 1;
        const end = pass === 0 ? pointIndex : -1;
        const step = pass === 0 ? 1 : -1;
        for (let index = start; index !== end; index += step) {
          const firstIndex = index;
          const secondIndex = index + 1;
          const first = chain[firstIndex];
          const second = chain[secondIndex];
          const delta = second.clone().sub(first);
          const distance = Math.max(0.0001, delta.length());
          const correction = delta.multiplyScalar((distance - segmentLengths[firstIndex]) / distance);
          const firstPinned = firstIndex === 0;
          const secondPinned = secondIndex === pointIndex;
          if (firstPinned && !secondPinned) second.sub(correction);
          else if (!firstPinned && secondPinned) first.add(correction);
          else if (!firstPinned && !secondPinned) {
            first.addScaledVector(correction, 0.5);
            second.addScaledVector(correction, -0.5);
          }
        }
        chain[0].copy(root);
        chain[pointIndex].copy(constrainedTarget);
      }
    }
  }

  chain.forEach((point, index) => solved[index].copy(point));
  const tailDelta = chain[pointIndex].clone().sub(points[pointIndex]);
  for (let index = pointIndex + 1; index < solved.length; index += 1) {
    solved[index].copy(points[index]).add(tailDelta);
  }
  return solved;
}

export function closestPointsOnSegments(startA, endA, startB, endB) {
  const directionA = endA.clone().sub(startA);
  const directionB = endB.clone().sub(startB);
  const offset = startA.clone().sub(startB);
  const lengthA = directionA.lengthSq();
  const lengthB = directionB.lengthSq();
  const epsilon = 0.000001;
  let amountA = 0;
  let amountB = 0;

  if (lengthA <= epsilon && lengthB <= epsilon) {
    return { amountA, amountB, pointA: startA.clone(), pointB: startB.clone() };
  }
  if (lengthA <= epsilon) {
    amountB = clamp(directionB.dot(offset) / lengthB, 0, 1);
  } else {
    const projectionB = directionB.dot(offset);
    if (lengthB <= epsilon) {
      amountA = clamp(-directionA.dot(offset) / lengthA, 0, 1);
    } else {
      const alignment = directionA.dot(directionB);
      const denominator = lengthA * lengthB - alignment * alignment;
      if (Math.abs(denominator) > epsilon) {
        amountA = clamp((alignment * projectionB - directionA.dot(offset) * lengthB) / denominator, 0, 1);
      }
      amountB = (alignment * amountA + projectionB) / lengthB;
      if (amountB < 0) {
        amountB = 0;
        amountA = clamp(-directionA.dot(offset) / lengthA, 0, 1);
      } else if (amountB > 1) {
        amountB = 1;
        amountA = clamp((alignment - directionA.dot(offset)) / lengthA, 0, 1);
      }
    }
  }
  return {
    amountA,
    amountB,
    pointA: startA.clone().addScaledVector(directionA, amountA),
    pointB: startB.clone().addScaledVector(directionB, amountB)
  };
}

export function findSpatialCollisionPairs(segments, cellSize = 0.38) {
  const grid = new Map();
  const pairs = new Set();
  segments.forEach((segment, segmentIndex) => {
    const minimum = [segment.min.x, segment.min.y, segment.min.z].map((value) => Math.floor(value / cellSize));
    const maximum = [segment.max.x, segment.max.y, segment.max.z].map((value) => Math.floor(value / cellSize));
    for (let x = minimum[0]; x <= maximum[0]; x += 1) {
      for (let y = minimum[1]; y <= maximum[1]; y += 1) {
        for (let z = minimum[2]; z <= maximum[2]; z += 1) {
          const key = `${x}|${y}|${z}`;
          const occupants = grid.get(key) || [];
          occupants.forEach((otherIndex) => {
            const other = segments[otherIndex];
            if (other.lock.id === segment.lock.id) return;
            if (other.lock.clumpId && other.lock.clumpId === segment.lock.clumpId) return;
            pairs.add(otherIndex < segmentIndex ? `${otherIndex}|${segmentIndex}` : `${segmentIndex}|${otherIndex}`);
          });
          occupants.push(segmentIndex);
          grid.set(key, occupants);
        }
      }
    }
  });
  return [...pairs].map((key) => key.split("|").map(Number));
}
