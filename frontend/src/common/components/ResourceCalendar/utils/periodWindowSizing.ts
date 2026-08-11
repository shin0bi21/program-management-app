export function normalizePeriodGroupSize(groupSize: number | undefined): number {
  return Math.max(1, Math.floor(groupSize ?? 1) || 1);
}

export function calculateGroupedPeriodWindow(
  visiblePeriodCount: number,
  groupSize: number,
): number {
  const safeVisibleCount = Math.max(1, Math.ceil(visiblePeriodCount) || 1);
  const safeGroupSize = normalizePeriodGroupSize(groupSize);
  const groupedVisibleCount = Math.ceil(safeVisibleCount / safeGroupSize) * safeGroupSize;
  return groupedVisibleCount + safeGroupSize * 2;
}

export function calculateVisiblePeriodCount(
  viewportWidth: number,
  coveredWidth: number,
  periodWidth: number,
): number {
  const availableWidth = Math.max(periodWidth, viewportWidth - coveredWidth);
  return Math.ceil(availableWidth / periodWidth);
}
