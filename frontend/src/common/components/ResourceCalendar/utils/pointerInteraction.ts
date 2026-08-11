export const CALENDAR_POINTER_THRESHOLD = 5;

export function crossedPointerThreshold(
  startX: number,
  startY: number,
  x: number,
  y: number,
  axis: 'both' | 'horizontal' = 'both',
) {
  return axis === 'horizontal'
    ? Math.abs(x - startX) >= CALENDAR_POINTER_THRESHOLD
    : Math.hypot(x - startX, y - startY) >= CALENDAR_POINTER_THRESHOLD;
}

export function captureCalendarPointer(element: HTMLElement, pointerId: number) {
  element.setPointerCapture?.(pointerId);
}

export function releaseCalendarPointer(element: HTMLElement, pointerId: number) {
  if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
}
