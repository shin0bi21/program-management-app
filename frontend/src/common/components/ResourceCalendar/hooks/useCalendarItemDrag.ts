import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { BuildItemContext, CalendarPeriod, ItemDropContext } from '../types';

const DRAG_THRESHOLD = 5;

export interface CalendarPointerDrag<TResource, TItemData> {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  sourceElement: HTMLElement;
  context: BuildItemContext<TResource, TItemData>;
  dragging: boolean;
  targetResourceId?: string;
  targetPeriodKey?: string;
  onEnd?: () => void;
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
}: UseCalendarItemDragOptions<TResource, TItemData>) {
  const [drag, setDrag] = useState<CalendarPointerDrag<TResource, TItemData> | null>(null);
  const dragRef = useRef<CalendarPointerDrag<TResource, TItemData> | null>(null);
  const suppressClickRef = useRef(false);
  const animationFrameRef = useRef<number>();
  const overlayRef = useRef<HTMLDivElement>(null);

  const positionOverlay = useCallback((current: CalendarPointerDrag<TResource, TItemData>) => {
    if (!overlayRef.current) return;
    overlayRef.current.style.transform = `translate3d(${current.x}px, ${current.y + 12}px, 0) rotate(1deg)`;
  }, []);

  const setCurrentDrag = useCallback((next: CalendarPointerDrag<TResource, TItemData> | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const locateTarget = useCallback((x: number, y: number) => {
    const cell = document.elementFromPoint(x, y)?.closest<HTMLElement>('.resource-calendar__cell');
    const viewport = viewportRef.current;
    if (!cell || !viewport?.contains(cell)) {
      return { targetResourceId: undefined, targetPeriodKey: undefined };
    }
    return {
      targetResourceId: cell.dataset.resourceId,
      targetPeriodKey: cell.dataset.period,
    };
  }, [viewportRef]);

  useEffect(() => {
    if (!drag?.dragging) return;
    const tick = () => {
      const current = dragRef.current;
      const viewport = viewportRef.current;
      if (!current?.dragging || !viewport) return;
      const bounds = viewport.getBoundingClientRect();
      const leftDistance = current.x - (bounds.left + coveredLeftWidth);
      const rightDistance = bounds.right - current.x;
      let direction = 0;
      let intensity = 0;
      if (leftDistance >= 0 && leftDistance < dragEdgeSize) {
        direction = -1;
        intensity = 1 - leftDistance / dragEdgeSize;
      } else if (rightDistance >= 0 && rightDistance < dragEdgeSize) {
        direction = 1;
        intensity = 1 - rightDistance / dragEdgeSize;
      }
      if (direction) {
        viewport.scrollLeft += direction * Math.max(2, dragScrollSpeed * intensity);
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
    if (!drag) return;
    const onPointerMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const dragging = current.dragging
        || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) >= DRAG_THRESHOLD;
      if (dragging) event.preventDefault();
      const next = {
        ...current,
        x: event.clientX,
        y: event.clientY,
        dragging,
        ...(dragging ? locateTarget(event.clientX, event.clientY) : {}),
      };
      dragRef.current = next;
      if (dragging && !current.dragging) {
        current.sourceElement.classList.add('resource-calendar__item--dragging');
        setDrag(next);
      } else if (dragging) {
        positionOverlay(next);
      }
    };
    const finish = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      setCurrentDrag(null);
      current.sourceElement.classList.remove('resource-calendar__item--dragging');
      if (!current.dragging) return;
      current.onEnd?.();
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
      const destinationResource = resources.find(resource => getResourceId(resource) === current.targetResourceId);
      const destinationPeriod = periods.find(period => period.key === current.targetPeriodKey);
      if (!destinationResource || !destinationPeriod) return;
      const dropContext = {
        item: current.context.data,
        source: { resource: current.context.resource, period: current.context.period },
        destination: { resource: destinationResource, period: destinationPeriod },
      };
      if (getResourceId(dropContext.source.resource) === getResourceId(destinationResource)
        && dropContext.source.period.key === destinationPeriod.key) return;
      if (canDropItem && !canDropItem(dropContext)) return;
      void onItemDrop?.(dropContext);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [canDropItem, drag, getResourceId, locateTarget, onItemDrop, periods, positionOverlay, resources, setCurrentDrag]);

  useEffect(() => {
    if (drag?.dragging) positionOverlay(drag);
  }, [drag, positionOverlay]);

  const beginDrag = useCallback((next: CalendarPointerDrag<TResource, TItemData>) => {
    setCurrentDrag(next);
  }, [setCurrentDrag]);

  return { drag, beginDrag, overlayRef, suppressClickRef };
}
