/**
 * Finds the visible portion of an item beneath the pointer for floating content.
 * Requires: clientX, when supplied, is a viewport coordinate.
 * Example: a ranged item anchors floating content to the hovered visible cell.
 */
export function getVisibleItemAnchor(trigger: HTMLElement | null, clientX?: number) {
  if (!trigger) return null;

  const periodCells = trigger.closest('.row')
    ?.querySelectorAll<HTMLElement>('.cell');
  // Ranged items can extend offscreen, so anchor details to the hovered visible period.
  const hoveredPeriod = clientX === undefined || clientX <= 0
    ? undefined
    : [...(periodCells ?? [])].find(cell => {
      const bounds = cell.getBoundingClientRect();

      return clientX >= bounds.left && clientX < bounds.right;
    });

  const itemBounds = trigger.getBoundingClientRect();
  const periodBounds = hoveredPeriod?.getBoundingClientRect();
  const anchorLeft = periodBounds ? Math.max(periodBounds.left, itemBounds.left) : itemBounds.left;
  const anchorRight = periodBounds ? Math.min(periodBounds.right, itemBounds.right) : itemBounds.right;

  return new DOMRect(
    anchorLeft,
    itemBounds.top,
    anchorRight - anchorLeft,
    itemBounds.height,
  );
}
