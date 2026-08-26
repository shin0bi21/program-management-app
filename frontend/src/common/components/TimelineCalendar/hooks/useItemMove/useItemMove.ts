import { useCallback, useRef, type RefObject } from 'react';
import type { CalendarPeriod, ItemMoveContext, ItemRange } from '../../types';
import { getEdgeScrollDelta, getPeriodZoneBounds } from '../../utils/edgeAutoScroll';
import { createItemPreview } from '../../utils/itemPreview';
import type { BeginPointerSession } from '../usePointerSession/usePointerSession';

export interface ItemMoveStart<TRow, TItemData> {
  pointerId: number;
  startX: number;
  startY: number;
  sourceElement: HTMLElement;
  row: TRow;
  item: TItemData;
  range: ItemRange;
}

interface ActiveItemMove<TRow, TItemData> extends ItemMoveStart<TRow, TItemData> {
  startIndex: number;
  endIndex: number;
  delta: number;
  nextRange: ItemRange;
  moving: boolean;
  targetRowId?: string;
  x?: number;
  y?: number;
  startScrollLeft: number;
  previewElement?: HTMLElement;
  previewHost?: HTMLElement;
}

interface UseItemMoveOptions<TRow, TItemData> {
  viewportRef: RefObject<HTMLElement | null>;
  periods: readonly CalendarPeriod[];
  periodWidth: number;
  rows: readonly TRow[];
  getRowId: (row: TRow) => string;
  canItemMove?: (context: ItemMoveContext<TRow, TItemData>) => boolean;
  onItemMove?: (context: ItemMoveContext<TRow, TItemData>) => void | Promise<void>;
  dragEdgeSize: number;
  dragScrollSpeed: number;
  coveredLeftWidth: number;
  beginPointerSession: BeginPointerSession;
}

export function useItemMove<TRow, TItemData>({
  viewportRef,
  periods,
  periodWidth,
  rows,
  getRowId,
  canItemMove,
  onItemMove,
  dragEdgeSize,
  dragScrollSpeed,
  coveredLeftWidth,
  beginPointerSession,
}: UseItemMoveOptions<TRow, TItemData>) {
  const activeRef = useRef<ActiveItemMove<TRow, TItemData> | null>(null);
  const suppressClickRef = useRef(false);

  const periodsRef = useRef(periods);
  const rowsRef = useRef(rows);
  const getRowIdRef = useRef(getRowId);
  const canItemMoveRef = useRef(canItemMove);
  const onItemMoveRef = useRef(onItemMove);

  periodsRef.current = periods;
  rowsRef.current = rows;
  getRowIdRef.current = getRowId;
  canItemMoveRef.current = canItemMove;
  onItemMoveRef.current = onItemMove;

  const locateRow = useCallback((x: number, y: number) => {
    const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('.row');
    const viewport = viewportRef.current;

    return row && viewport?.contains(row) ? row.dataset.rowId : undefined;
  }, [viewportRef]);

  const calculateDelta = useCallback((
    current: ActiveItemMove<TRow, TItemData>,
    viewport: HTMLElement,
    x: number,
  ) => {
    const requested = Math.round((x - current.startX
      + viewport.scrollLeft - current.startScrollLeft) / periodWidth);

    const delta = Math.max(-current.startIndex, Math.min(
      periodsRef.current.length - 1 - current.endIndex,
      requested,
    ));

    return {
      delta,
      nextRange: {
        start: periodsRef.current[current.startIndex + delta].key,
        end: periodsRef.current[current.endIndex + delta].key,
      },
    };
  }, [periodWidth]);

  const activate = useCallback(() => {
    const current = activeRef.current;
    const viewport = viewportRef.current;

    if (!current || !viewport) return;

    const preview = createItemPreview(viewport, current.sourceElement, 'move');

    current.sourceElement.classList.add('moving');
    activeRef.current = {
      ...current,
      moving: true,
      previewElement: preview.element,
      previewHost: preview.host,
    };
  }, [viewportRef]);

  const move = useCallback((event: PointerEvent) => {
    const current = activeRef.current;
    const viewport = viewportRef.current;

    if (!current?.moving || !viewport) return;

    const next = {
      ...current,
      ...calculateDelta(current, viewport, event.clientX),
      targetRowId: locateRow(event.clientX, event.clientY),
      x: event.clientX,
      y: event.clientY,
    };

    activeRef.current = next;

    current.previewElement?.style.setProperty(
      'transform',
      `translate(${event.clientX - current.startX}px, ${event.clientY - current.startY}px)`,
    );
  }, [calculateDelta, locateRow, viewportRef]);

  const frame = useCallback(() => {
    const current = activeRef.current;
    const viewport = viewportRef.current;

    if (!current?.moving || !viewport || current.x === undefined || current.y === undefined) return;

    const periodZone = getPeriodZoneBounds(viewport, coveredLeftWidth);
    const horizontal = getEdgeScrollDelta(
      current.x,
      periodZone.left,
      periodZone.right,
      dragEdgeSize,
      dragScrollSpeed,
    );

    const vertical = getEdgeScrollDelta(
      current.y,
      periodZone.viewportBounds.top,
      periodZone.viewportBounds.bottom,
      dragEdgeSize,
      dragScrollSpeed,
    );

    if (!horizontal && !vertical) return;

    viewport.scrollLeft += horizontal;
    viewport.scrollTop += vertical;

    const next = {
      ...current,
      ...calculateDelta(current, viewport, current.x),
      targetRowId: locateRow(current.x, current.y),
    };

    activeRef.current = next;
  }, [calculateDelta, coveredLeftWidth, dragEdgeSize, dragScrollSpeed, locateRow, viewportRef]);

  const clear = useCallback(() => {
    const current = activeRef.current;
    activeRef.current = null;

    current?.sourceElement.classList.remove('moving');
    current?.previewHost?.remove();

    return current;
  }, []);

  const cancel = useCallback(() => {
    clear();
  }, [clear]);

  const end = useCallback((event: PointerEvent) => {
    const current = clear();

    if (!current?.moving || event.type !== 'pointerup') return;

    const destinationRow = rowsRef.current.find(
      row => getRowIdRef.current(row) === current.targetRowId,
    );

    if (!destinationRow) return;

    const sameRow = getRowIdRef.current(destinationRow) === getRowIdRef.current(current.row);

    if (current.delta === 0 && sameRow) return;

    // A completed drag owns the following click even when domain validation rejects the drop.
    suppressClickRef.current = true;
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);

    const context = {
      row: current.row,
      destinationRow,
      item: current.item,
      originalRange: current.range,
      nextRange: current.nextRange,
    };

    if (canItemMoveRef.current && !canItemMoveRef.current(context)) return;

    void onItemMoveRef.current?.(context);
  }, [clear]);

  const beginItemMove = useCallback((value: ItemMoveStart<TRow, TItemData>) => {
    const startIndex = periodsRef.current.findIndex(period => period.key === value.range.start);
    const endIndex = periodsRef.current.findIndex(period => period.key === value.range.end);

    const viewport = viewportRef.current;

    if (startIndex < 0 || endIndex < 0 || !viewport) return;

    const session: ActiveItemMove<TRow, TItemData> = {
      ...value,
      startIndex,
      endIndex,
      delta: 0,
      moving: false,
      startScrollLeft: viewport.scrollLeft,
      nextRange: value.range,
    };

    // Claim coordination before publishing state so rejection cannot erase the active move.
    const claimed = beginPointerSession({
      type: 'item-move',
      pointerId: session.pointerId,
      startX: session.startX,
      startY: session.startY,
      captureElement: viewport,
      onActivate: activate,
      onMove: move,
      onEnd: end,
      onCancel: cancel,
      onFrame: frame,
    });

    if (!claimed) return;

    activeRef.current = session;
  }, [activate, beginPointerSession, cancel, end, frame, move, viewportRef]);

  return { beginItemMove, suppressClickRef };
}
