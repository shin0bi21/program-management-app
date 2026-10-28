import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { ItemRange, ItemCalendarProps, ItemEnvironment } from '../../../../types';
import { getEdgeScrollDelta, getPeriodZoneBounds } from '../../../../utils/edgeAutoScroll';
import { createItemPreview } from '../../../../utils/itemPreview';

interface ActiveMove {
  // Source element and initial pointer position
  source: HTMLElement;
  startX: number;
  startY: number;
  startScrollLeft: number;

  // Original period placement
  startIndex: number;
  endIndex: number;
  originalRange: ItemRange;

  // Pending move result
  nextRange: ItemRange;
  delta: number;
  destinationRowId?: string;

  // Preview state
  moving: boolean;
  x?: number;
  y?: number;
  preview?: ReturnType<typeof createItemPreview>;
}

/**
 * Owns item movement from pointer initiation through preview, autoscroll, commit, or cancellation.
 * Requires: the calendar retains the pointer service and supplies current periods through getPeriods.
 * Example: moving a two-day item one period preserves its duration and reports its destination row.
 */
export default function useItemMove<TRow, TItemData>(
  calendar: ItemCalendarProps<TRow, TItemData> | undefined,
  hideDetails: () => void,
) {
  const activeRef = useRef<ActiveMove | null>(null);

  /** Validates pointer input and claims a pending session without starting the preview. */
  function startMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!calendar?.movable || event.pointerType === 'touch' || event.button !== 0) return;

    const { environment, layout } = calendar;
    const viewport = environment.viewportRef.current;
    const periods = environment.getPeriods();
    const startIndex = periods.findIndex(period => period.key === layout.start);
    const endIndex = periods.findIndex(period => period.key === layout.end);

    if (!viewport || startIndex < 0 || endIndex < 0) return;

    hideDetails();

    const range = { start: layout.start, end: layout.end };
    const pending: ActiveMove = {
      source: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      startIndex,
      endIndex,
      originalRange: range,
      nextRange: range,
      delta: 0,
      moving: false,
    };

    const claimed = environment.onPointerSessionRequest({
      type: 'item-move',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      captureElement: viewport,
      onActivate: startMovePreview,
      onMove: updateMove,
      onFrame: updateMoveAutoScroll,
      onEnd: endMove,
      onCancel: cancelMove,
    });

    // A rejected second interaction must not replace an already active move.
    if (claimed) activeRef.current = pending;
  }

  /** Creates the ghost and marks the source as moving after the drag threshold is crossed. */
  function startMovePreview(): void {
    const current = activeRef.current;
    const viewport = calendar?.environment.viewportRef.current;

    if (!current || !viewport) return;

    current.preview = createItemPreview(viewport, current.source, 'move');
    current.source.classList.add('moving');
    current.moving = true;
  }

  /** Updates the snapped destination and positions the preview beneath the pointer. */
  function updateMove(event: PointerEvent): void {
    const current = activeRef.current;
    const environment = calendar?.environment;
    const viewport = environment?.viewportRef.current;

    if (!current?.moving || !viewport || !environment) return;

    current.x = event.clientX;
    current.y = event.clientY;
    updateMoveDestination(current, environment, viewport);

    current.preview?.element.style.setProperty(
      'transform',
      `translate(${event.clientX - current.startX}px, ${event.clientY - current.startY}px)`,
    );
  }

  /** Performs one edge-scroll frame and updates the destination for the new scroll position. */
  function updateMoveAutoScroll(): void {
    const current = activeRef.current;
    const environment = calendar?.environment;
    const viewport = environment?.viewportRef.current;

    if (!current?.moving || !viewport || !environment || current.x === undefined || current.y === undefined) return;

    const zone = getPeriodZoneBounds(viewport, environment.coveredLeftWidth);
    const horizontal = getEdgeScrollDelta(current.x, zone.left, zone.right, environment.dragEdgeSize, environment.dragScrollSpeed);
    const vertical = getEdgeScrollDelta(current.y, zone.viewportBounds.top, zone.viewportBounds.bottom, environment.dragEdgeSize, environment.dragScrollSpeed);

    if (!horizontal && !vertical) return;

    viewport.scrollLeft += horizontal;
    viewport.scrollTop += vertical;
    updateMoveDestination(current, environment, viewport);
  }

  /** Cleans up the interaction, then reports a changed destination allowed by current props. */
  function endMove(event: PointerEvent): void {
    const current = activeRef.current;

    // Release visuals before validation or upstream callbacks, including rejected drops.
    cancelMove();

    if (!calendar || !current?.moving || event.type !== 'pointerup' || !current.destinationRowId) return;

    const sameRow = current.destinationRowId === calendar.layout.rowId;

    if (current.delta === 0 && sameRow) return;

    calendar.environment.onClickSuppressionRequest();

    const state = calendar.stateRef.current;
    const destinationRow = state.rows.find(row => state.getRowId(row) === current.destinationRowId);

    if (!destinationRow || !state.moveEnabled) return;

    const target = calendar.target;
    const context = {
      row: target.row,
      item: target.data,
      originalRange: target.range,
      nextRange: current.nextRange,
      destinationRow,
    };

    if (state.canItemMove && !state.canItemMove(context)) return;

    calendar.onMove(context);
  }

  /** Removes pending/active move state and visuals without reporting a record update. */
  function cancelMove(): void {
    const current = activeRef.current;
    activeRef.current = null;

    current?.source.classList.remove('moving');
    current?.preview?.host.remove();
  }

  return { onPointerDown: startMove };
}

/** Updates the supplied session's snapped range and row from pointer and scroll coordinates. */
function updateMoveDestination(current: ActiveMove, environment: ItemEnvironment, viewport: HTMLElement): void {
  if (current.x === undefined || current.y === undefined) return;

  const periods = environment.getPeriods();
  const requested = Math.round((current.x - current.startX
    + viewport.scrollLeft - current.startScrollLeft) / environment.periodWidth);
  const delta = Math.max(-current.startIndex, Math.min(periods.length - 1 - current.endIndex, requested));
  const row = document.elementFromPoint(current.x, current.y)?.closest<HTMLElement>('.row');

  current.delta = delta;
  current.nextRange = {
    start: periods[current.startIndex + delta].key,
    end: periods[current.endIndex + delta].key,
  };
  current.destinationRowId = row && viewport.contains(row) ? row.dataset.rowId : undefined;
}
