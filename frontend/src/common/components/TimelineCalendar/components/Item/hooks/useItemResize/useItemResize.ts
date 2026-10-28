import { useRef, type ButtonHTMLAttributes, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { ItemRange, ItemCalendarProps, ItemEnvironment, ResizeEdge } from '../../../../types';
import { getEdgeScrollDelta, getPeriodZoneBounds } from '../../../../utils/edgeAutoScroll';
import { createItemPreview } from '../../../../utils/itemPreview';

interface ActiveResize {
  // Resize target
  edge: ResizeEdge;
  item: HTMLElement;
  originalRange: ItemRange;

  // Pending resize result
  nextPeriodKey: string;

  // Preview state
  resizing: boolean;
  x?: number;
  preview?: ReturnType<typeof createItemPreview>;
}

/**
 * Owns item resizing: visible handles, pointer and keyboard guards, preview, autoscroll, and completion.
 * Requires: the calendar retains the pointer service and supplies current periods through getPeriods.
 * Example: dragging the end handle changes only the end; cancellation removes the preview without committing.
 */
export default function useItemResize<TRow, TItemData>(
  calendar: ItemCalendarProps<TRow, TItemData> | undefined,
  hideDetails: () => void,
) {
  const activeRef = useRef<ActiveResize | null>(null);

  /** Validates pointer input and claims a pending resize without starting the preview. */
  function startResize(event: ReactPointerEvent<HTMLButtonElement>, edge: ResizeEdge): void {
    event.stopPropagation();
    if (!calendar?.resizable || event.pointerType === 'touch' || event.button !== 0) return;

    const { layout, environment } = calendar;
    const initialPeriodKey = edge === 'start' ? layout.start : layout.end;
    const initialPeriod = environment.getPeriods().find(period => period.key === initialPeriodKey);
    const item = event.currentTarget.parentElement;

    if (!initialPeriod || !item) return;

    hideDetails();

    const pending: ActiveResize = {
      edge,
      item,
      originalRange: { start: layout.start, end: layout.end },
      nextPeriodKey: initialPeriod.key,
      resizing: false,
    };

    const claimed = environment.onPointerSessionRequest({
      type: 'item-resize',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: 0,
      axis: 'horizontal',
      captureElement: event.currentTarget,
      onActivate: startResizePreview,
      onMove: updateResize,
      onFrame: updateResizeAutoScroll,
      onEnd: endResize,
      onCancel: cancelResize,
    });

    // A rejected second interaction must not replace an already active resize.
    if (claimed) activeRef.current = pending;
  }

  /** Creates the resize ghost after the drag threshold is crossed. */
  function startResizePreview(): void {
    const current = activeRef.current;
    const viewport = calendar?.environment.viewportRef.current;

    if (!current || !viewport) return;

    current.preview = createItemPreview(viewport, current.item, 'resize');
    current.resizing = true;
  }

  /** Updates the dragged endpoint and preview from the latest pointer position. */
  function updateResize(event: PointerEvent): void {
    const current = activeRef.current;
    const environment = calendar?.environment;
    const viewport = environment?.viewportRef.current;

    if (!current?.resizing || !viewport || !environment) return;

    current.x = event.clientX;
    updateResizePreview(current, environment, viewport);
  }

  /** Performs one horizontal edge-scroll frame and updates the endpoint for the new scroll position. */
  function updateResizeAutoScroll(): void {
    const current = activeRef.current;
    const environment = calendar?.environment;
    const viewport = environment?.viewportRef.current;

    if (!current?.resizing || !viewport || !environment || current.x === undefined) return;

    const zone = getPeriodZoneBounds(viewport, environment.coveredLeftWidth);
    const horizontal = getEdgeScrollDelta(current.x, zone.left, zone.right, environment.dragEdgeSize, environment.dragScrollSpeed);

    if (!horizontal) return;

    viewport.scrollLeft += horizontal;
    updateResizePreview(current, environment, viewport);
  }

  /** Cleans up the interaction, then reports the resized range when resizing is still enabled. */
  function endResize(event: PointerEvent): void {
    const current = activeRef.current;

    // Release the preview before validation or upstream callbacks, including rejected changes.
    cancelResize();

    if (!calendar || !current?.resizing || event.type !== 'pointerup') return;

    calendar.environment.onClickSuppressionRequest();
    if (!calendar.stateRef.current.resizeEnabled) return;

    const nextRange = current.edge === 'start'
      ? { ...current.originalRange, start: current.nextPeriodKey }
      : { ...current.originalRange, end: current.nextPeriodKey };

    const { row, data: item, range: originalRange } = calendar.target;
    calendar.onResize({ row, item, originalRange, nextRange, edge: current.edge });
  }

  /** Removes pending/active resize state and its preview without reporting a record update. */
  function cancelResize(): void {
    const current = activeRef.current;
    activeRef.current = null;

    current?.preview?.host.remove();
  }

  /** Moves one endpoint by one period for an arrow key, preserving its opposite endpoint. */
  function resizeByKeyboard(event: KeyboardEvent<HTMLButtonElement>, edge: ResizeEdge): void {
    if (!calendar?.resizable || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    if (!calendar.stateRef.current.resizeEnabled) return;

    event.preventDefault();

    const periods = calendar.environment.getPeriods();
    const { start, end } = calendar.layout;
    const startIndex = periods.findIndex(period => period.key === start);
    const endIndex = periods.findIndex(period => period.key === end);

    if (startIndex < 0 || endIndex < 0) return;

    const currentIndex = edge === 'start' ? startIndex : endIndex;
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const candidate = Math.max(0, Math.min(periods.length - 1, currentIndex + direction));
    const nextIndex = edge === 'start' ? Math.min(candidate, endIndex) : Math.max(candidate, startIndex);

    if (nextIndex === currentIndex) return;

    const nextRange = edge === 'start'
      ? { start: periods[nextIndex].key, end }
      : { start, end: periods[nextIndex].key };
    const { row, data: item, range: originalRange } = calendar.target;
    calendar.onResize({ row, item, originalRange, nextRange, edge });
  }

  const startHandle = calendar?.resizable && calendar.layout.startsInWindow
    ? buildResizeHandleProps('start', calendar.layout.id, startResize, resizeByKeyboard) : undefined;
  const endHandle = calendar?.resizable && calendar.layout.endsInWindow
    ? buildResizeHandleProps('end', calendar.layout.id, startResize, resizeByKeyboard) : undefined;

  return { startHandle, endHandle };
}

/** Updates the snapped endpoint and ghost geometry while preserving the opposite endpoint. */
function updateResizePreview(current: ActiveResize, environment: ItemEnvironment, viewport: HTMLElement): void {
  if (current.x === undefined) return;

  const periods = environment.getPeriods();
  const bounds = viewport.getBoundingClientRect();
  const logicalIndex = Math.floor((current.x - bounds.left + viewport.scrollLeft - environment.coveredLeftWidth) / environment.periodWidth);
  const nextIndex = Math.max(0, Math.min(periods.length - 1, logicalIndex));
  const startIndex = periods.findIndex(period => period.key === current.originalRange.start);
  const endIndex = periods.findIndex(period => period.key === current.originalRange.end);
  let boundedIndex = nextIndex;

  if (current.edge === 'start' && endIndex >= 0) {
    boundedIndex = Math.min(nextIndex, endIndex);
  } else if (current.edge === 'end' && startIndex >= 0) {
    boundedIndex = Math.max(nextIndex, startIndex);
  }

  current.nextPeriodKey = periods[boundedIndex].key;

  const preview = current.preview;

  if (!preview) return;

  const pointerLeft = current.x - preview.host.getBoundingClientRect().left;
  const previewLeft = preview.itemBounds.left - preview.bounds.left;
  const oppositeRight = previewLeft + preview.itemBounds.width;

  if (current.edge === 'start') {
    const draggedEdge = Math.min(pointerLeft, oppositeRight);
    preview.element.style.left = `${draggedEdge}px`;
    preview.element.style.width = `${oppositeRight - draggedEdge}px`;
  } else {
    preview.element.style.width = `${Math.max(pointerLeft, previewLeft) - previewLeft}px`;
  }
}

/** Produces an accessible handle that routes pointer and keyboard events for one resize edge. */
function buildResizeHandleProps(
  edge: ResizeEdge,
  id: string,
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, edge: ResizeEdge) => void,
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, edge: ResizeEdge) => void,
): ButtonHTMLAttributes<HTMLButtonElement> {
  return {
    type: 'button', className: `resize-handle ${edge}`, 'aria-label': `Resize ${edge} of ${id}`,
    onClick: stopResizeClickPropagation,
    onKeyDown: event => onKeyDown(event, edge),
    onPointerDown: event => onPointerDown(event, edge),
  };
}

/** Stops handle-click bubbling after row selection, preventing item activation. */
function stopResizeClickPropagation(event: MouseEvent<HTMLButtonElement>): void {
  event.stopPropagation();
}
