import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { CalendarPeriod, ItemRange, RangeMoveContext } from '../types';
import { createCalendarPreviewHost } from '../items/rangePreview';
import { getEdgeScrollDelta, getPeriodZoneBounds } from './edgeAutoScroll';
import { captureCalendarPointer, crossedPointerThreshold, releaseCalendarPointer } from './pointerInteraction';
import type { CalendarInteractionCoordinator } from './useCalendarInteractionCoordinator';

export interface CalendarRangeMove<TResource, TItemData> {
  pointerId: number;
  startX: number;
  startY: number;
  sourceElement: HTMLElement;
  resource: TResource;
  item: TItemData;
  range: ItemRange;
  startIndex: number;
  endIndex: number;
  delta: number;
  nextRange?: ItemRange;
  moving: boolean;
  targetResourceId?: string;
  x?: number;
  y?: number;
  startScrollLeft?: number;
  previewElement?: HTMLElement;
  previewHost?: HTMLElement;
}

export function useCalendarRangeMove<TResource, TItemData>({
  viewportRef,
  periods,
  periodWidth,
  resources,
  getResourceId,
  canRangeMove,
  onRangeMove,
  dragEdgeSize,
  dragScrollSpeed,
  coveredLeftWidth,
  interactionCoordinator,
}: {
  viewportRef: RefObject<HTMLElement | null>;
  periods: readonly CalendarPeriod[];
  periodWidth: number;
  resources: readonly TResource[];
  getResourceId: (resource: TResource) => string;
  canRangeMove?: (context: RangeMoveContext<TResource, TItemData>) => boolean;
  onRangeMove?: (context: RangeMoveContext<TResource, TItemData>) => void | Promise<void>;
  dragEdgeSize: number;
  dragScrollSpeed: number;
  coveredLeftWidth: number;
  interactionCoordinator: CalendarInteractionCoordinator;
}) {
  const activeRef = useRef<CalendarRangeMove<TResource, TItemData> | null>(null);
  const suppressClickRef = useRef(false);
  const periodsRef = useRef(periods);
  const resourcesRef = useRef(resources);
  const canRangeMoveRef = useRef(canRangeMove);
  const onRangeMoveRef = useRef(onRangeMove);
  periodsRef.current = periods;
  resourcesRef.current = resources;
  canRangeMoveRef.current = canRangeMove;
  onRangeMoveRef.current = onRangeMove;

  useEffect(() => {
    let animationFrame: number | undefined;
    const locateResource = (x: number, y: number) => {
      const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('.resource-calendar__row');
      const viewport = viewportRef.current;
      return row && viewport?.contains(row) ? row.dataset.resourceId : undefined;
    };
    const calculateDelta = (current: CalendarRangeMove<TResource, TItemData>, viewport: HTMLElement, x: number) => {
      const requested = Math.round((x - current.startX
        + viewport.scrollLeft - (current.startScrollLeft ?? viewport.scrollLeft)) / periodWidth);
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
    };
    const tick = () => {
      const current = activeRef.current;
      const viewport = viewportRef.current;
      if (current?.moving && viewport && current.x !== undefined && current.y !== undefined) {
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
        if (horizontal || vertical) {
          viewport.scrollLeft += horizontal;
          viewport.scrollTop += vertical;
          activeRef.current = {
            ...current,
            ...calculateDelta(current, viewport, current.x),
            targetResourceId: locateResource(current.x, current.y),
          };
        }
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    const move = (event: PointerEvent) => {
      const current = activeRef.current;
      const viewport = viewportRef.current;
      if (!current || !viewport || event.pointerId !== current.pointerId) return;
      const moving = current.moving
        || crossedPointerThreshold(current.startX, current.startY, event.clientX, event.clientY);
      if (!moving) return;
      event.preventDefault();
      let previewElement = current.previewElement;
      let previewHost = current.previewHost;
      if (!current.moving) {
        captureCalendarPointer(viewport, event.pointerId);
        const bounds = current.sourceElement.getBoundingClientRect();
        const preview = createCalendarPreviewHost(viewport);
        previewHost = preview.host;
        previewElement = current.sourceElement.cloneNode(true) as HTMLElement;
        previewElement.classList.add(
          'resource-calendar__range-preview',
          'resource-calendar__range-move-preview',
        );
        previewElement.setAttribute('aria-hidden', 'true');
        Object.assign(previewElement.style, { position: 'absolute', left: `${bounds.left - preview.bounds.left}px`, top: `${bounds.top - preview.bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, transform: '' });
        previewHost.appendChild(previewElement);
      }
      const rangeUpdate = calculateDelta(current, viewport, event.clientX);
      const targetResourceId = locateResource(event.clientX, event.clientY);
      const next = { ...current, moving, ...rangeUpdate, previewElement, previewHost, targetResourceId, x: event.clientX, y: event.clientY };
      activeRef.current = next;
      if (previewElement) previewElement.style.transform = `translate(${event.clientX - current.startX}px, ${event.clientY - current.startY}px)`;
    };
    const finish = (event: PointerEvent) => {
      const current = activeRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      interactionCoordinator.release('range-move', event.pointerId);
      activeRef.current = null;
      current.previewHost?.remove();
      if (viewportRef.current) releaseCalendarPointer(viewportRef.current, event.pointerId);
      if (!current.moving || event.type !== 'pointerup') return;
      const destinationResource = resourcesRef.current.find(resource => getResourceId(resource) === current.targetResourceId);
      if (!destinationResource || !current.nextRange) return;
      if (current.delta === 0 && getResourceId(destinationResource) === getResourceId(current.resource)) return;
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
      const context = {
        resource: current.resource,
        destinationResource,
        item: current.item,
        originalRange: current.range,
        nextRange: current.nextRange,
      };
      if (canRangeMoveRef.current && !canRangeMoveRef.current(context)) return;
      void onRangeMoveRef.current?.(context);
    };
    const lostCapture = (event: PointerEvent) => {
      const pointerId = event.pointerId;
      queueMicrotask(() => {
        const current = activeRef.current;
        if (!current || current.pointerId !== pointerId) return;
        interactionCoordinator.release('range-move', pointerId);
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
      if (current) interactionCoordinator.release('range-move', current.pointerId);
      current?.previewHost?.remove();
      activeRef.current = null;
    };
  }, [coveredLeftWidth, dragEdgeSize, dragScrollSpeed, getResourceId, interactionCoordinator, periodWidth, viewportRef]);

  return {
    beginRangeMove: useCallback((value: CalendarRangeMove<TResource, TItemData>) => {
      if (!interactionCoordinator.claim('range-move', value.pointerId)) return;
      const startIndex = periodsRef.current.findIndex(period => period.key === value.range.start);
      const endIndex = periodsRef.current.findIndex(period => period.key === value.range.end);
      if (startIndex < 0 || endIndex < 0) {
        interactionCoordinator.release('range-move', value.pointerId);
        return;
      }
      const next = {
        ...value,
        startIndex,
        endIndex,
        startScrollLeft: viewportRef.current?.scrollLeft ?? 0,
        nextRange: value.range,
      };
      activeRef.current = next;
    }, [interactionCoordinator, viewportRef]),
    suppressRangeMoveClickRef: suppressClickRef,
  };
}
