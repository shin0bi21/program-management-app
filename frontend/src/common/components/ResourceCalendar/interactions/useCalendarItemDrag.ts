import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { BuildItemContext, CalendarPeriod, ItemDropContext } from '../types';
import { getEdgeScrollDelta, getPeriodZoneBounds } from './edgeAutoScroll';
import { captureCalendarPointer, crossedPointerThreshold, releaseCalendarPointer } from './pointerInteraction';
import { getCalendarPreviewBounds, type CalendarPreviewBounds } from '../items/rangePreview';
import type { CalendarInteractionCoordinator } from './useCalendarInteractionCoordinator';

export interface CalendarPointerDrag<TResource, TItemData> {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  grabOffsetX: number;
  grabOffsetY: number;
  sourceElement: HTMLElement;
  context: BuildItemContext<TResource, TItemData>;
  dragging: boolean;
  targetResourceId?: string;
  targetPeriodKey?: string;
  onEnd?: () => void;
  previewBounds?: CalendarPreviewBounds;
}

interface UseCalendarItemDragOptions<TResource, TItemData> {
  viewportRef: RefObject<HTMLElement | null>;
  resources: readonly TResource[];
  periods: readonly CalendarPeriod[];
  getResourceId: (resource: TResource) => string;
  canDropItem?: (context: ItemDropContext<TResource, TItemData>) => boolean;
  onItemDrop?: (context: ItemDropContext<TResource, TItemData>) => void | Promise<void>;
  dragEdgeSize: number;
  dragScrollSpeed: number;
  coveredLeftWidth: number;
  interactionCoordinator: CalendarInteractionCoordinator;
}

export function useCalendarItemDrag<TResource, TItemData>({
  viewportRef,
  resources,
  periods,
  getResourceId,
  canDropItem,
  onItemDrop,
  dragEdgeSize,
  dragScrollSpeed,
  coveredLeftWidth,
  interactionCoordinator,
}: UseCalendarItemDragOptions<TResource, TItemData>) {
  const [drag, setDrag] = useState<CalendarPointerDrag<TResource, TItemData> | null>(null);
  const dragRef = useRef<CalendarPointerDrag<TResource, TItemData> | null>(null);
  const suppressClickRef = useRef(false);
  const animationFrameRef = useRef<number>();
  const overlayRef = useRef<HTMLDivElement>(null);
  const resourcesRef = useRef(resources);
  const periodsRef = useRef(periods);
  const getResourceIdRef = useRef(getResourceId);
  const canDropItemRef = useRef(canDropItem);
  const onItemDropRef = useRef(onItemDrop);
  resourcesRef.current = resources;
  periodsRef.current = periods;
  getResourceIdRef.current = getResourceId;
  canDropItemRef.current = canDropItem;
  onItemDropRef.current = onItemDrop;

  const positionOverlay = useCallback((current: CalendarPointerDrag<TResource, TItemData>) => {
    if (!overlayRef.current || !current.previewBounds) return;
    const left = current.x - current.previewBounds.left - current.grabOffsetX;
    const top = current.y - current.previewBounds.top - current.grabOffsetY;
    overlayRef.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }, []);

  const setCurrentDrag = useCallback((next: CalendarPointerDrag<TResource, TItemData> | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const locateTarget = useCallback((x: number, y: number) => {
    const cell = document.elementFromPoint(x, y)?.closest<HTMLElement>(
      '.resource-calendar__cell, .resource-calendar__item-slot',
    );
    const viewport = viewportRef.current;
    if (!cell || !viewport?.contains(cell)) {
      return { targetResourceId: undefined, targetPeriodKey: undefined };
    }
    const itemSlot = cell.classList.contains('resource-calendar__item-slot');
    return {
      targetResourceId: itemSlot ? cell.dataset.itemResourceId : cell.dataset.resourceId,
      targetPeriodKey: itemSlot ? cell.dataset.itemPeriod : cell.dataset.period,
    };
  }, [viewportRef]);

  useEffect(() => {
    if (!drag?.dragging) return;
    const tick = () => {
      const current = dragRef.current;
      const viewport = viewportRef.current;
      if (!current?.dragging || !viewport) return;
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
        const next = { ...current, ...locateTarget(current.x, current.y) };
        dragRef.current = next;
        positionOverlay(next);
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current !== undefined) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [coveredLeftWidth, drag?.dragging, dragEdgeSize, dragScrollSpeed, locateTarget, positionOverlay, viewportRef]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const dragging = current.dragging
        || crossedPointerThreshold(current.startX, current.startY, event.clientX, event.clientY);
      if (dragging) event.preventDefault();
      const next = {
        ...current,
        x: event.clientX,
        y: event.clientY,
        dragging,
        previewBounds: current.previewBounds
          ?? (dragging && viewportRef.current ? getCalendarPreviewBounds(viewportRef.current) : undefined),
        ...(dragging ? locateTarget(event.clientX, event.clientY) : {}),
      };
      dragRef.current = next;
      if (dragging && !current.dragging) {
        captureCalendarPointer(current.sourceElement, event.pointerId);
        current.sourceElement.classList.add('dragging');
        setDrag(next);
      } else if (dragging) {
        positionOverlay(next);
      }
    };
    const finish = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      interactionCoordinator.release('item-drag', event.pointerId);
      setCurrentDrag(null);
      releaseCalendarPointer(current.sourceElement, event.pointerId);
      current.sourceElement.classList.remove('dragging');
      if (!current.dragging) return;
      current.onEnd?.();
      if (event.type !== 'pointerup') return;
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
      const destinationResource = resourcesRef.current.find(
        resource => getResourceIdRef.current(resource) === current.targetResourceId,
      );
      const destinationPeriod = periodsRef.current.find(period => period.key === current.targetPeriodKey);
      if (!destinationResource || !destinationPeriod) return;
      const dropContext = {
        item: current.context.data,
        source: { resource: current.context.resource, period: current.context.period },
        destination: { resource: destinationResource, period: destinationPeriod },
      };
      if (getResourceIdRef.current(dropContext.source.resource) === getResourceIdRef.current(destinationResource)
        && dropContext.source.period.key === destinationPeriod.key) return;
      if (canDropItemRef.current && !canDropItemRef.current(dropContext)) return;
      void onItemDropRef.current?.(dropContext);
    };
    const lostCapture = (event: PointerEvent) => {
      const pointerId = event.pointerId;
      queueMicrotask(() => {
        const current = dragRef.current;
        if (!current || current.pointerId !== pointerId) return;
        interactionCoordinator.release('item-drag', pointerId);
        current.sourceElement.classList.remove('dragging');
        current.onEnd?.();
        setCurrentDrag(null);
      });
    };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('lostpointercapture', lostCapture);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('lostpointercapture', lostCapture);
      const current = dragRef.current;
      if (current) interactionCoordinator.release('item-drag', current.pointerId);
      current?.sourceElement.classList.remove('dragging');
      dragRef.current = null;
    };
  }, [interactionCoordinator, locateTarget, positionOverlay, setCurrentDrag, viewportRef]);

  useEffect(() => {
    if (drag?.dragging) positionOverlay(drag);
  }, [drag, positionOverlay]);

  const beginDrag = useCallback((next: CalendarPointerDrag<TResource, TItemData>) => {
    if (!interactionCoordinator.claim('item-drag', next.pointerId)) return;
    dragRef.current = next;
  }, [interactionCoordinator]);

  return { drag, beginDrag, overlayRef, suppressClickRef };
}
