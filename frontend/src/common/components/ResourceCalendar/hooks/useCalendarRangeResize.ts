import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { CalendarPeriod, ItemRange, RangeResizeContext } from '../types';
import { createCalendarPreviewHost } from '../utils/rangePreview';
import { getEdgeScrollDelta, getPeriodZoneBounds } from '../utils/edgeAutoScroll';
import { captureCalendarPointer, crossedPointerThreshold, releaseCalendarPointer } from '../utils/pointerInteraction';
import type { CalendarInteractionCoordinator } from './useCalendarInteractionCoordinator';

export interface CalendarRangeResize<TResource, TItemData> {
  pointerId: number;
  startX: number;
  sourceElement: HTMLElement;
  rangeElement: HTMLElement;
  resource: TResource;
  item: TItemData;
  range: ItemRange;
  edge: 'start' | 'end';
  startIndex: number;
  endIndex: number;
  nextIndex: number;
  nextPeriodKey?: string;
  resizing: boolean;
  previewElement?: HTMLElement;
  previewHost?: HTMLElement;
  previewLeft?: number;
  previewWidth?: number;
  x?: number;
}

interface KeyboardRangeResize<TResource, TItemData> {
  resource: TResource;
  item: TItemData;
  range: ItemRange;
  edge: 'start' | 'end';
  startIndex: number;
  endIndex: number;
}

export function useCalendarRangeResize<TResource, TItemData>({
  viewportRef,
  periods,
  periodWidth,
  coveredLeftWidth,
  onRangeResize,
  dragEdgeSize,
  dragScrollSpeed,
  interactionCoordinator,
}: {
  viewportRef: RefObject<HTMLElement | null>;
  periods: readonly CalendarPeriod[];
  periodWidth: number;
  coveredLeftWidth: number;
  onRangeResize?: (context: RangeResizeContext<TResource, TItemData>) => void | Promise<void>;
  dragEdgeSize: number;
  dragScrollSpeed: number;
  interactionCoordinator: CalendarInteractionCoordinator;
}) {
  const activeRef = useRef<CalendarRangeResize<TResource, TItemData> | null>(null);
  const suppressClickRef = useRef(false);
  const periodsRef = useRef(periods);
  const onRangeResizeRef = useRef(onRangeResize);
  periodsRef.current = periods;
  onRangeResizeRef.current = onRangeResize;

  useEffect(() => {
    let animationFrame: number | undefined;
    const updatePreview = (current: CalendarRangeResize<TResource, TItemData>, viewport: HTMLElement, x: number) => {
      const bounds = viewport.getBoundingClientRect();
      const rawIndex = Math.floor((x - bounds.left + viewport.scrollLeft - coveredLeftWidth) / periodWidth);
      const nextIndex = Math.max(0, Math.min(periodsRef.current.length - 1, rawIndex));
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
        nextIndex: bounded,
        nextPeriodKey: periodsRef.current[bounded]?.key,
      };
    };
    const tick = () => {
      const current = activeRef.current;
      const viewport = viewportRef.current;
      if (current?.resizing && viewport && current.x !== undefined) {
        const periodZone = getPeriodZoneBounds(viewport, coveredLeftWidth);
        const horizontal = getEdgeScrollDelta(
          current.x,
          periodZone.left,
          periodZone.right,
          dragEdgeSize,
          dragScrollSpeed,
        );
        if (horizontal) {
          viewport.scrollLeft += horizontal;
          activeRef.current = { ...current, ...updatePreview(current, viewport, current.x) };
        }
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    const move = (event: PointerEvent) => {
      const current = activeRef.current;
      const viewport = viewportRef.current;
      if (!current || !viewport || event.pointerId !== current.pointerId) return;
      const resizing = current.resizing
        || crossedPointerThreshold(current.startX, 0, event.clientX, 0, 'horizontal');
      if (!resizing) return;
      event.preventDefault();
      let previewElement = current.previewElement;
      let previewHost = current.previewHost;
      let previewLeft = current.previewLeft;
      let previewWidth = current.previewWidth;
      if (!current.resizing) {
        captureCalendarPointer(current.sourceElement, event.pointerId);
        const bounds = current.rangeElement.getBoundingClientRect();
        const preview = createCalendarPreviewHost(viewport);
        previewHost = preview.host;
        previewLeft = bounds.left - preview.bounds.left;
        previewWidth = bounds.width;
        previewElement = current.rangeElement.cloneNode(true) as HTMLElement;
        previewElement.classList.add('resource-calendar__range-preview');
        previewElement.setAttribute('aria-hidden', 'true');
        Object.assign(previewElement.style, { position: 'absolute', left: `${previewLeft}px`, top: `${bounds.top - preview.bounds.top}px`, width: `${previewWidth}px`, height: `${bounds.height}px`, gridColumn: '' });
        previewHost.appendChild(previewElement);
      }
      const previewState = { ...current, previewElement, previewHost, previewLeft, previewWidth };
      const previewUpdate = updatePreview(previewState, viewport, event.clientX);
      const next = { ...previewState, ...previewUpdate, resizing, x: event.clientX };
      activeRef.current = next;
    };
    const finish = (event: PointerEvent) => {
      const current = activeRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      interactionCoordinator.release('range-resize', event.pointerId);
      activeRef.current = null;
      releaseCalendarPointer(current.sourceElement, event.pointerId);
      current.previewHost?.remove();
      if (!current.resizing || event.type !== 'pointerup') return;
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
      if (!current.nextPeriodKey) return;
      const nextRange = current.edge === 'start'
        ? { ...current.range, start: current.nextPeriodKey }
        : { ...current.range, end: current.nextPeriodKey };
      void onRangeResizeRef.current?.({ resource: current.resource, item: current.item, originalRange: current.range, nextRange, edge: current.edge });
    };
    const lostCapture = (event: PointerEvent) => {
      const pointerId = event.pointerId;
      queueMicrotask(() => {
        const current = activeRef.current;
        if (!current || current.pointerId !== pointerId) return;
        interactionCoordinator.release('range-resize', pointerId);
        activeRef.current = null;
        current.previewHost?.remove();
      });
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('lostpointercapture', lostCapture);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('lostpointercapture', lostCapture);
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      const current = activeRef.current;
      if (current) interactionCoordinator.release('range-resize', current.pointerId);
      current?.previewHost?.remove();
      activeRef.current = null;
    };
  }, [coveredLeftWidth, dragEdgeSize, dragScrollSpeed, interactionCoordinator, periodWidth, viewportRef]);

  const beginResize = useCallback((value: CalendarRangeResize<TResource, TItemData>) => {
    const claimed = interactionCoordinator.claim('range-resize', value.pointerId);
    if (!claimed) return;
    const initialIndex = value.edge === 'start' ? value.startIndex : value.endIndex;
    const next = {
      ...value,
      nextPeriodKey: periodsRef.current[initialIndex]?.key,
    };
    activeRef.current = next;
  }, [interactionCoordinator, viewportRef]);
  const resizeByKeyboard = useCallback((
    value: KeyboardRangeResize<TResource, TItemData>,
    direction: -1 | 1,
  ) => {
    const currentIndex = value.edge === 'start' ? value.startIndex : value.endIndex;
    const candidate = Math.max(0, Math.min(periods.length - 1, currentIndex + direction));
    const nextIndex = value.edge === 'start'
      ? Math.min(candidate, value.endIndex)
      : Math.max(candidate, value.startIndex);
    if (nextIndex === currentIndex) return;
    const nextRange = value.edge === 'start'
      ? { ...value.range, start: periods[nextIndex].key }
      : { ...value.range, end: periods[nextIndex].key };
    void onRangeResize?.({
      resource: value.resource,
      item: value.item,
      originalRange: value.range,
      nextRange,
      edge: value.edge,
    });
  }, [onRangeResize, periods]);
  return { beginResize, resizeByKeyboard, suppressClickRef };
}
