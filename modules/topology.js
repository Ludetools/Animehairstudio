export function parseObjFaceVertexCounts(content) {
  return String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("f "))
    .map((line) => line.split(/\s+/).length - 1)
    .filter((count) => count >= 3);
}

export function fanTriangleEdgeMasks(vertexCount) {
  const count = Math.max(3, Math.round(Number(vertexCount) || 3));
  return Array.from({ length: count - 2 }, (_, triangleIndex) => {
    const fanIndex = triangleIndex + 1;
    return [
      1,
      fanIndex === count - 2 ? 1 : 0,
      fanIndex === 1 ? 1 : 0
    ];
  });
}
