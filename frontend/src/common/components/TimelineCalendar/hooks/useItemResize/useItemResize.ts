import { useCallback, useRef, type RefObject } from 'react';
import type { CalendarPeriod, ItemRange, ItemResizeContext } from '../../types';
import { getEdgeScrollDelta, getPeriodZoneBounds } from '../../utils/edgeAutoScroll';
import { createItemPreview } from '../../utils/itemPreview';
import type { BeginPointerSession } from '../usePointerSession/usePointerSession';

export interface ItemResizeTarget<TRow, TItemData> {
  row: TRow;
  item: TItemData;
  range: ItemRange;
  edge: 'start' | 'end';
}

export interface ItemResize<TRow, TItemData> extends ItemResizeTarget<TRow, TItemData> {
  pointerId: number;
  startX: number;
  sourceElement: HTMLElement;
  itemElement: HTMLElement;
}

interface ActiveItemResize<TRow, TItemData> extends ItemResize<TRow, TItemData> {
  nextPeriodKey?: string;
  resizing: boolean;
  previewElement?: HTMLElement;
  previewHost?: HTMLElement;
  previewLeft?: number;
  previewWidth?: number;
  x?: number;
}

interface UseItemResizeOptions<TRow, TItemData> {
  viewportRef: RefObject<HTMLElement | null>;
  allPeriods: readonly CalendarPeriod[];
  periodWidth: number;
  coveredLeftWidth: number;
  onItemResize?: (context: ItemResizeContext<TRow, TItemData>) => void | Promise<void>;
  dragEdgeSize: number;
  dragScrollSpeed: number;
  beginPointerSession: BeginPointerSession;
}

export function useItemResize<TRow, TItemData>({
  viewportRef,
  allPeriods,
  periodWidth,
  coveredLeftWidth,
  onItemResize,
  dragEdgeSize,
  dragScrollSpeed,
  beginPointerSession,
}: UseItemResizeOptions<TRow, TItemData>) {
  const activeRef = useRef<ActiveItemResize<TRow, TItemData> | null>(null);
  const suppressClickRef = useRef(false);

  const periodsRef = useRef(allPeriods);
  const onItemResizeRef = useRef(onItemResize);

  periodsRef.current = allPeriods;
  onItemResizeRef.current = onItemResize;

  const updatePreview = useCallback((
    current: ActiveItemResize<TRow, TItemData>,
    viewport: HTMLElement,
    x: number,
  ) => {
    const bounds = viewport.getBoundingClientRect();
    const logicalIndex = Math.floor((x - bounds.left + viewport.scrollLeft - coveredLeftWidth) / periodWidth);
    const nextIndex = Math.max(0, Math.min(periodsRef.current.length - 1, logicalIndex));

    const currentStartIndex = periodsRef.current.findIndex(period => period.key === current.range.start);
    const currentEndIndex = periodsRef.current.findIndex(period => period.key === current.range.end);
    const bounded = current.edge === 'start'
      ? currentEndIndex >= 0 ? Math.min(nextIndex, currentEndIndex) : nextIndex
      : currentStartIndex >= 0 ? Math.max(nextIndex, currentStartIndex) : nextIndex;

    const previewHostBounds = current.previewHost?.getBoundingClientRect();
    const pointerLeft = previewHostBounds ? x - previewHostBounds.left : undefined;
    const previewLeft = current.previewLeft ?? 0;
    const previewWidth = current.previewWidth ?? 0;
    const oppositeRight = previewLeft + previewWidth;

    const draggedEdge = current.edge === 'start'
      ? Math.min(pointerLeft ?? previewLeft, oppositeRight)
      : Math.max(pointerLeft ?? oppositeRight, previewLeft);

    if (current.previewElement) {
      if (current.edge === 'start') {
        current.previewElement.style.left = `${draggedEdge}px`;
        current.previewElement.style.width = `${oppositeRight - draggedEdge}px`;
      } else current.previewElement.style.width = `${draggedEdge - previewLeft}px`;
    }

    return {
      nextPeriodKey: periodsRef.current[bounded]?.key,
    };
  }, [coveredLeftWidth, periodWidth]);

  const activate = useCallback(() => {
    const current = activeRef.current;
    const viewport = viewportRef.current;

    if (!current || !viewport) return;

    const preview = createItemPreview(viewport, current.itemElement, 'resize');

    activeRef.current = {
      ...current,
      resizing: true,
      previewElement: preview.element,
      previewHost: preview.host,
      previewLeft: preview.itemBounds.left - preview.bounds.left,
      previewWidth: preview.itemBounds.width,
    };
  }, [viewportRef]);

  const move = useCallback((event: PointerEvent) => {
    const current = activeRef.current;
    const viewport = viewportRef.current;

    if (!current?.resizing || !viewport) return;

    const next = {
      ...current,
      ...updatePreview(current, viewport, event.clientX),
      x: event.clientX,
    };

    activeRef.current = next;
  }, [updatePreview, viewportRef]);

  const frame = useCallback(() => {
    const current = activeRef.current;
    const viewport = viewportRef.current;

    if (!current?.resizing || !viewport || current.x === undefined) return;

    const periodZone = getPeriodZoneBounds(viewport, coveredLeftWidth);
    const horizontal = getEdgeScrollDelta(
      current.x,
      periodZone.left,
      periodZone.right,
      dragEdgeSize,
      dragScrollSpeed,
    );

    if (!horizontal) return;

    viewport.scrollLeft += horizontal;

    const next = { ...current, ...updatePreview(current, viewport, current.x) };

    activeRef.current = next;
  }, [coveredLeftWidth, dragEdgeSize, dragScrollSpeed, updatePreview, viewportRef]);

  const clear = useCallback(() => {
    const current = activeRef.current;
    activeRef.current = null;

    current?.previewHost?.remove();

    return current;
  }, []);

  const cancel = useCallback(() => {
    clear();
  }, [clear]);

  const end = useCallback((event: PointerEvent) => {
    const current = clear();

    if (!current?.resizing || event.type !== 'pointerup') return;

    // A completed resize owns the following click even when its snapped range is unchanged.
    suppressClickRef.current = true;
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);

    if (!current.nextPeriodKey) return;

    const nextRange = current.edge === 'start'
      ? { ...current.range, start: current.nextPeriodKey }
      : { ...current.range, end: current.nextPeriodKey };

    void onItemResizeRef.current?.({
      row: current.row,
      item: current.item,
      originalRange: current.range,
      nextRange,
      edge: current.edge,
    });
  }, [clear]);

  const beginItemResize = useCallback((value: ItemResize<TRow, TItemData>) => {
    const initialPeriodKey = value.edge === 'start' ? value.range.start : value.range.end;
    const initialPeriod = periodsRef.current.find(period => period.key === initialPeriodKey);

    if (!initialPeriod) return;

    const session: ActiveItemResize<TRow, TItemData> = {
      ...value,
      nextPeriodKey: initialPeriod.key,
      resizing: false,
    };

    // Claim coordination before publishing state so rejection cannot erase the active resize.
    const claimed = beginPointerSession({
      type: 'item-resize',
      pointerId: session.pointerId,
      startX: session.startX,
      startY: 0,
      axis: 'horizontal',
      captureElement: session.sourceElement,
      onActivate: activate,
      onMove: move,
      onEnd: end,
      onCancel: cancel,
      onFrame: frame,
    });

    if (!claimed) return;

    activeRef.current = session;
  }, [activate, beginPointerSession, cancel, end, frame, move]);

  const resizeByKeyboard = useCallback((
    value: ItemResizeTarget<TRow, TItemData>,
    direction: -1 | 1,
  ) => {
    const startIndex = allPeriods.findIndex(period => period.key === value.range.start);
    const endIndex = allPeriods.findIndex(period => period.key === value.range.end);

    if (startIndex < 0 || endIndex < 0) return;

    const currentIndex = value.edge === 'start' ? startIndex : endIndex;
    const candidate = Math.max(0, Math.min(allPeriods.length - 1, currentIndex + direction));
    const nextIndex = value.edge === 'start'
      ? Math.min(candidate, endIndex)
      : Math.max(candidate, startIndex);

    if (nextIndex === currentIndex) return;

    const nextRange = value.edge === 'start'
      ? { ...value.range, start: allPeriods[nextIndex].key }
      : { ...value.range, end: allPeriods[nextIndex].key };

    void onItemResize?.({
      row: value.row,
      item: value.item,
      originalRange: value.range,
      nextRange,
      edge: value.edge,
    });
  }, [allPeriods, onItemResize]);

  return { beginItemResize, resizeByKeyboard, suppressClickRef };
}
