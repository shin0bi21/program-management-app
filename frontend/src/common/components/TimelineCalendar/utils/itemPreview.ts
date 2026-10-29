export interface ItemPreviewBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ItemPreview {
  host: HTMLElement;
  element: HTMLElement;
  bounds: ItemPreviewBounds;
  itemBounds: DOMRect;
}

/**
 * Produces a non-interactive item ghost clipped to the calendar viewport.
 * Requires: the caller removes the returned host on completion or cancellation.
 * Example: a move uses the returned element for pointer feedback without duplicating live controls.
 */
export function createItemPreview(
  viewport: HTMLElement,
  sourceElement: HTMLElement,
  variant: 'move' | 'resize',
): ItemPreview {
  const bounds = getPreviewBounds(viewport);
  const itemBounds = sourceElement.getBoundingClientRect();
  const host = document.createElement('div');
  host.className = 'timeline-calendar-portal';
  host.inert = true;
  Object.assign(host.style, getPreviewHostStyle(bounds));

  const element = sourceElement.cloneNode(true) as HTMLElement;
  element.classList.add('item-preview', `item-${variant}-preview`);
  element.setAttribute('aria-hidden', 'true');
  Object.assign(element.style, {
    position: 'absolute',
    left: `${itemBounds.left - bounds.left}px`,
    top: `${itemBounds.top - bounds.top}px`,
    width: `${itemBounds.width}px`,
    height: `${itemBounds.height}px`,
    gridColumn: '',
    transform: '',
  });
  host.appendChild(element);
  document.body.appendChild(host);
  return { host, element, bounds, itemBounds };
}

/** Measures the clipping rectangle shared by the preview host and item ghost. */
function getPreviewBounds(viewport: HTMLElement): ItemPreviewBounds {
  const bounds = viewport.getBoundingClientRect();
  return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
}

/** Converts viewport bounds into fixed portal coordinates. */
function getPreviewHostStyle(bounds: ItemPreviewBounds) {
  return {
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
  };
}
