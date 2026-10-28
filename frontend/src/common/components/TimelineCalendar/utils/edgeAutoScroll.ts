/**
 * Produces signed scroll speed inside either edge zone, or zero outside those zones.
 * Requires: ordered bounds, edgeSize > 0, and maxSpeed >= 2.
 * Example: (5, 0, 100, 20, 10) produces -7.5 toward the starting edge.
 */
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

/** Produces scroll-zone bounds excluding the row header; e.g. width 125 skips the first 125 viewport pixels. */
export function getPeriodZoneBounds(viewport: HTMLElement, rowColumnWidth: number) {
  const bounds = viewport.getBoundingClientRect();
  return {
    viewportBounds: bounds,
    left: bounds.left + rowColumnWidth,
    right: bounds.right,
  };
}
