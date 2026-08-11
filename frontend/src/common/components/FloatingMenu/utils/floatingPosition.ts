export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Alignment = 'start' | 'end' | 'center';

export interface Placement {
  side: Side;
  align?: Alignment;
}

export interface FloatingPosition {
  top: number;
  left: number;
}

export interface PlacementOptions {
  /** Gap between anchor and menu edge. Default: 4 */
  offset?: number;
  /** Estimated menu width for collision detection. Default: 160 */
  widthEstimate?: number;
  /** Estimated menu height for collision detection. Default: 200 */
  heightEstimate?: number;
}

const DEFAULT_OFFSET = 4;
const DEFAULT_WIDTH_ESTIMATE = 160;
const DEFAULT_HEIGHT_ESTIMATE = 200;

function resolveSide(
  preferred: Side,
  rect: DOMRect,
  heightEstimate: number,
  widthEstimate: number,
  offset: number,
): Side {
  switch (preferred) {
    case 'bottom':
      return window.innerHeight - rect.bottom - offset < heightEstimate && rect.top >= heightEstimate
        ? 'top'
        : 'bottom';
    case 'top':
      return rect.top - offset < heightEstimate && window.innerHeight - rect.bottom >= heightEstimate
        ? 'bottom'
        : 'top';
    case 'right':
      return window.innerWidth - rect.right - offset < widthEstimate && rect.left >= widthEstimate
        ? 'left'
        : 'right';
    case 'left':
      return rect.left - offset < widthEstimate && window.innerWidth - rect.right >= widthEstimate
        ? 'right'
        : 'left';
  }
}

function resolveAlignment(
  preferred: Alignment,
  side: Side,
  rect: DOMRect,
  heightEstimate: number,
  widthEstimate: number,
): Alignment {
  const isVerticalSide = side === 'top' || side === 'bottom';

  if (isVerticalSide) {
    // alignment affects left/right position of the menu
    if (preferred === 'start') {
      // left-aligned: check if menu fits to the right of rect.left
      return rect.left + widthEstimate <= window.innerWidth ? 'start' : 'end';
    }
    if (preferred === 'end') {
      // right-aligned: check if menu fits to the left of rect.right
      return rect.right - widthEstimate >= 0 ? 'end' : 'start';
    }
  } else {
    // alignment affects top/bottom position of the menu
    if (preferred === 'start') {
      return rect.top + heightEstimate <= window.innerHeight ? 'start' : 'end';
    }
    if (preferred === 'end') {
      return rect.bottom - heightEstimate >= 0 ? 'end' : 'start';
    }
  }

  return preferred; // 'center' — handled in computePosition with clamping
}

function computePosition(
  side: Side,
  align: Alignment,
  rect: DOMRect,
  offset: number,
  widthEstimate: number,
  heightEstimate: number,
): FloatingPosition {
  let top = 0;
  let left = 0;

  // Primary axis (side)
  switch (side) {
    case 'bottom': top = rect.bottom + offset; break;
    case 'top':    top = rect.top - heightEstimate - offset; break;
    case 'right':  left = rect.right + offset; break;
    case 'left':   left = rect.left - widthEstimate - offset; break;
  }

  const isVerticalSide = side === 'top' || side === 'bottom';

  // Secondary axis (alignment)
  if (isVerticalSide) {
    switch (align) {
      case 'start':  left = rect.left; break;
      case 'end':    left = rect.right - widthEstimate; break;
      case 'center': {
        const centered = rect.left + rect.width / 2 - widthEstimate / 2;
        left = Math.max(0, Math.min(centered, window.innerWidth - widthEstimate));
        break;
      }
    }
  } else {
    switch (align) {
      case 'start':  top = rect.top; break;
      case 'end':    top = rect.bottom - heightEstimate; break;
      case 'center': {
        const centered = rect.top + rect.height / 2 - heightEstimate / 2;
        top = Math.max(0, Math.min(centered, window.innerHeight - heightEstimate));
        break;
      }
    }
  }

  return { top, left };
}

export function calculateFloatingPosition(
  anchor: HTMLElement,
  placement: Placement = { side: 'bottom', align: 'start' },
  options: PlacementOptions = {},
): FloatingPosition {
  const offset = options.offset ?? DEFAULT_OFFSET;
  const widthEstimate = options.widthEstimate ?? DEFAULT_WIDTH_ESTIMATE;
  const heightEstimate = options.heightEstimate ?? DEFAULT_HEIGHT_ESTIMATE;
  const align = placement.align ?? 'start';

  const rect = anchor.getBoundingClientRect();

  const resolvedSide = resolveSide(placement.side, rect, heightEstimate, widthEstimate, offset);
  const resolvedAlign = resolveAlignment(align, resolvedSide, rect, heightEstimate, widthEstimate);

  return computePosition(resolvedSide, resolvedAlign, rect, offset, widthEstimate, heightEstimate);
}

export function calculateFloatingPositionFromPoint(
  x: number,
  y: number,
  placement: Placement = { side: 'bottom', align: 'start' },
  options: PlacementOptions = {},
): FloatingPosition {
  const point = new DOMRect(x, y, 0, 0);
  const offset = options.offset ?? DEFAULT_OFFSET;
  const widthEstimate = options.widthEstimate ?? DEFAULT_WIDTH_ESTIMATE;
  const heightEstimate = options.heightEstimate ?? DEFAULT_HEIGHT_ESTIMATE;
  const resolvedSide = resolveSide(placement.side, point, heightEstimate, widthEstimate, offset);
  const resolvedAlign = resolveAlignment(placement.align ?? 'start', resolvedSide, point, heightEstimate, widthEstimate);
  return computePosition(resolvedSide, resolvedAlign, point, offset, widthEstimate, heightEstimate);
}
