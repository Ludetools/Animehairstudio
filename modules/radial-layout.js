const TOP = -Math.PI * 0.5;

export function radialMenuAngles(optionCount) {
  const count = Math.max(0, Math.floor(Number(optionCount) || 0));
  if (!count) return [];
  if (count === 1) return [TOP];
  if (count === 2) return [Math.PI, 0];
  if (count === 3) {
    // Optical centering: lower the base pair so the triangle's visible bounds
    // feel centered around the gesture origin rather than only its centroid.
    return [TOP, Math.PI * 5 / 18, Math.PI * 13 / 18];
  }
  if (count === 4) {
    return [TOP, 0, Math.PI * 0.5, Math.PI];
  }
  const step = Math.PI * 2 / count;
  return Array.from({ length: count }, (_, index) => TOP + step * index);
}

function positiveAngleDifference(from, to) {
  const fullTurn = Math.PI * 2;
  return ((to - from) % fullTurn + fullTurn) % fullTurn;
}

export function radialOptionSector(angles = [], index = 0, {
  gap = Math.PI / 90
} = {}) {
  const normalizedAngles = angles.map((angle) => Number(angle) || 0);
  const count = normalizedAngles.length;
  if (!count || index < 0 || index >= count) return null;
  const angle = normalizedAngles[index];
  if (count === 1) {
    const boundaryStart = angle - Math.PI;
    return {
      boundaryStart,
      start: boundaryStart + gap * 0.5,
      span: Math.PI * 2 - gap
    };
  }
  const ordered = normalizedAngles
    .map((value, optionIndex) => ({ value, optionIndex }))
    .sort((first, second) => first.value - second.value);
  const orderedIndex = ordered.findIndex((entry) => entry.optionIndex === index);
  const previous = ordered[(orderedIndex - 1 + count) % count].value;
  const next = ordered[(orderedIndex + 1) % count].value;
  const previousGap = positiveAngleDifference(previous, angle);
  const nextGap = positiveAngleDifference(angle, next);
  const availableSpan = (previousGap + nextGap) * 0.5;
  const safeGap = Math.min(Math.max(0, Number(gap) || 0), availableSpan * 0.4);
  const boundaryStart = angle - previousGap * 0.5;
  return {
    boundaryStart,
    start: boundaryStart + safeGap * 0.5,
    span: availableSpan - safeGap
  };
}

function buttonsOverlapAtRadius(angles, radius, buttonWidth, buttonHeight, gap) {
  const points = angles.map((angle) => ({
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  }));
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      if (
        Math.abs(points[first].x - points[second].x) < buttonWidth + gap
        && Math.abs(points[first].y - points[second].y) < buttonHeight + gap
      ) return true;
    }
  }
  return false;
}

export function radialMenuDimensions(optionCount, {
  buttonWidth = 104,
  buttonHeight = 40,
  gap = 8
} = {}) {
  const count = Math.max(1, Math.floor(Number(optionCount) || 1));
  if (count === 1) return { size: 210, radius: 76 };
  if (count === 2) return { size: 232, radius: 84 };
  if (count === 3) return { size: 332, radius: 112 };
  if (count === 4) return { size: 270, radius: 104 };
  const angles = radialMenuAngles(count);
  let radius = 112;
  while (radius < 320 && buttonsOverlapAtRadius(angles, radius, buttonWidth, buttonHeight, gap)) {
    radius += 2;
  }
  return {
    size: Math.max(270, Math.ceil((radius + 34) * 2)),
    radius
  };
}

export function radialButtonRayExtent(angle, {
  buttonWidth = 104,
  buttonHeight = 40
} = {}) {
  const absoluteCosine = Math.abs(Math.cos(angle));
  const absoluteSine = Math.abs(Math.sin(angle));
  const horizontalTravel = absoluteCosine > 1e-6
    ? buttonWidth * 0.5 / absoluteCosine
    : Number.POSITIVE_INFINITY;
  const verticalTravel = absoluteSine > 1e-6
    ? buttonHeight * 0.5 / absoluteSine
    : Number.POSITIVE_INFINITY;
  return Math.min(horizontalTravel, verticalTravel);
}

export function radialButtonEntryDistance(angle, {
  radius,
  radiusOffset = 0,
  buttonWidth = 104,
  buttonHeight = 40,
  deadzone = 34
} = {}) {
  const inwardExtent = radialButtonRayExtent(angle, { buttonWidth, buttonHeight });
  return Math.max(deadzone, Number(radius) + Number(radiusOffset || 0) - inwardExtent);
}

export function layoutRadialOptions(options = [], {
  anchorAction = null,
  anchorAngle = null,
  reserveBottomForList = false
} = {}) {
  const angles = radialMenuAngles(options.length);
  const anchorIndex = anchorAction === null
    ? -1
    : options.findIndex((option) => option.action === anchorAction);
  const rotation = anchorIndex >= 0 && Number.isFinite(anchorAngle)
    ? anchorAngle - angles[anchorIndex]
    : 0;
  const rotatedAngles = angles.map((angle) => angle + rotation);
  let assignedAngles = rotatedAngles;
  if (reserveBottomForList && options.some((option) => option?.submenu)) {
    const submenuIndexes = options
      .map((option, index) => option?.submenu ? index : -1)
      .filter((index) => index >= 0);
    if (submenuIndexes.length === options.length) {
      assignedAngles = options.length === 3
        ? [TOP, 0, Math.PI]
        : options.map((_, index) => (
          -Math.PI + Math.PI * (index + 1) / (options.length + 1)
        ));
    } else {
      const angularDistanceFromBottom = (angle) => Math.abs(Math.atan2(
        Math.sin(angle - Math.PI * 0.5),
        Math.cos(angle - Math.PI * 0.5)
      ));
      const anchoredSubmenuIsSafe = anchorIndex >= 0
        && options[anchorIndex]?.submenu
        && angularDistanceFromBottom(rotatedAngles[anchorIndex]) > Math.PI / 6;
      const safestAngles = rotatedAngles
        .filter((_, index) => !anchoredSubmenuIsSafe || index !== anchorIndex)
        .sort((first, second) => (
        angularDistanceFromBottom(second) - angularDistanceFromBottom(first)
      ));
      const directIndexes = options
        .map((option, index) => option?.submenu ? -1 : index)
        .filter((index) => index >= 0);
      assignedAngles = [...rotatedAngles];
      const movableSubmenuIndexes = submenuIndexes
        .filter((index) => !anchoredSubmenuIsSafe || index !== anchorIndex);
      movableSubmenuIndexes.forEach((optionIndex, index) => {
        assignedAngles[optionIndex] = safestAngles[index];
      });
      directIndexes.forEach((optionIndex, index) => {
        assignedAngles[optionIndex] = safestAngles[movableSubmenuIndexes.length + index];
      });
    }
  }
  return options.map((option, index) => {
    const placedOption = { ...option, angle: assignedAngles[index] };
    if (options.length === 3 && index > 0) placedOption.radiusOffset = 20;
    return placedOption;
  });
}

export function layoutRadialSubmenuSlots(options = [], anchorAngle = TOP, {
  slotCount = 8
} = {}) {
  const capacity = Math.max(1, Math.floor(Number(slotCount) || 8));
  const anchor = Number.isFinite(Number(anchorAngle)) ? Number(anchorAngle) : TOP;
  const step = Math.PI * 2 / capacity;
  const slotAngles = Array.from({ length: capacity }, (_, index) => anchor + step * index);
  const slotOrder = [0];
  for (let distance = 1; slotOrder.length < capacity; distance += 1) {
    slotOrder.push(distance);
    if (slotOrder.length < capacity) slotOrder.push(capacity - distance);
  }
  const placedOptions = options.slice(0, capacity).map((option, index) => {
    const radialSlotIndex = slotOrder[index];
    return {
      ...option,
      angle: slotAngles[radialSlotIndex],
      radialSlotIndex
    };
  });
  const optionsBySlot = new Map(placedOptions.map((option) => [option.radialSlotIndex, option]));
  const hitOptions = slotAngles.map((angle, radialSlotIndex) => (
    optionsBySlot.get(radialSlotIndex) || {
      action: null,
      angle,
      enabled: false,
      radialSlotIndex,
      radialPlaceholder: true
    }
  ));
  return { options: placedOptions, hitOptions, slotAngles };
}

export function radialListCorridorContains(deltaX, deltaY, {
  halfAngle = Math.PI / 6
} = {}) {
  if (!(deltaY > 0)) return false;
  const angle = Math.atan2(deltaY, deltaX);
  const difference = Math.abs(Math.atan2(
    Math.sin(angle - Math.PI * 0.5),
    Math.cos(angle - Math.PI * 0.5)
  ));
  return difference <= halfAngle;
}

export function radialSubmenuTravelAngle(entryAngle, {
  bottomHalfAngle = Math.PI / 6
} = {}) {
  const angle = Number(entryAngle) || 0;
  const backAngle = angle + Math.PI;
  const differenceFromBottom = Math.abs(Math.atan2(
    Math.sin(backAngle - Math.PI * 0.5),
    Math.cos(backAngle - Math.PI * 0.5)
  ));
  if (differenceFromBottom > bottomHalfAngle) return angle;
  return Math.cos(angle) < -1e-6 ? -Math.PI * 0.75 : -Math.PI * 0.25;
}

export function partitionRadialOptions(
  options = [],
  maximumRadialOptions = 8,
  maximumSubmenuOptions = 5
) {
  const capacity = Math.max(1, Math.floor(Number(maximumRadialOptions) || 8));
  const submenuCapacity = Math.max(0, Math.floor(Number(maximumSubmenuOptions) || 0));
  const submenuOptions = options
    .filter((option) => Boolean(option?.submenu))
    .slice(0, submenuCapacity);
  const primaryDirectOptions = options.filter((option) => !option?.submenu && option?.list !== true);
  const radialOptions = [...submenuOptions, ...primaryDirectOptions].slice(0, capacity);
  const radialSet = new Set(radialOptions);
  const listOptions = options.filter((option) => !radialSet.has(option));
  return { radialOptions, listOptions };
}
