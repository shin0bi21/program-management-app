export function getEdgeScrollDelta(
  pointer: number,
  start: number,
  end: number,
  edgeSize: number,
  maxSpeed: number,
) {
  const startDistance = pointer - start;
  if (startDistance >= 0 && startDistance < edgeSize) {
    return -Math.max(2, maxSpeed * (1 - startDistance / edgeSize));
  }
  const endDistance = end - pointer;
  if (endDistance >= 0 && endDistance < edgeSize) {
    return Math.max(2, maxSpeed * (1 - endDistance / edgeSize));
  }
  return 0;
}

export function getPeriodZoneBounds(viewport: HTMLElement, rowColumnWidth: number) {
  const bounds = viewport.getBoundingClientRect();
  return {
    viewportBounds: bounds,
    left: bounds.left + rowColumnWidth,
    right: bounds.right,
  };
}
