import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CalendarPeriod } from '../types';
import { useCalendarItemDrag } from './useCalendarItemDrag';

const periods: CalendarPeriod[] = [
  { key: '2026-08-19', start: new Date(2026, 7, 19), end: new Date(2026, 7, 20) },
  { key: '2026-08-20', start: new Date(2026, 7, 20), end: new Date(2026, 7, 21) },
];

function dispatchPointer(type: string, values: Record<string, number>) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.entries(values).forEach(([key, value]) => {
    Object.defineProperty(event, key, { value });
  });
  window.dispatchEvent(event);
}

describe('useCalendarItemDrag', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('preserves the cursor pickup offset and emits the resolved drop', () => {
    const viewport = document.createElement('div');
    const target = document.createElement('div');
    target.className = 'resource-calendar__item-slot';
    target.dataset.itemResourceId = 'staff-2';
    target.dataset.itemPeriod = periods[1].key;
    viewport.appendChild(target);
    document.body.appendChild(viewport);
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      left: 10, top: 20, right: 610, bottom: 420, width: 600, height: 400,
      x: 10, y: 20, toJSON: () => undefined,
    });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => target),
    });

    const source = document.createElement('div');
    const overlay = document.createElement('div');
    const onItemDrop = vi.fn();
    const interactionCoordinator = { claim: vi.fn(() => true), release: vi.fn() };
    const resources = [{ id: 'staff-1' }, { id: 'staff-2' }];
    const viewportRef = { current: viewport };
    const { result } = renderHook(() => useCalendarItemDrag({
      viewportRef,
      resources,
      periods,
      getResourceId: resource => resource.id,
      onItemDrop,
      dragEdgeSize: 40,
      dragScrollSpeed: 12,
      coveredLeftWidth: 100,
      interactionCoordinator,
    }));
    Object.defineProperty(result.current.overlayRef, 'current', { value: overlay, writable: true });

    act(() => result.current.beginDrag({
      pointerId: 7,
      startX: 140,
      startY: 90,
      x: 140,
      y: 90,
      width: 120,
      grabOffsetX: 40,
      grabOffsetY: 20,
      sourceElement: source,
      context: { resource: resources[0], period: periods[0], data: { id: 'task-1' } },
      dragging: false,
    }));
    act(() => dispatchPointer('pointermove', { pointerId: 7, clientX: 240, clientY: 150 }));

    expect(overlay.style.transform).toBe('translate3d(190px, 110px, 0)');

    act(() => dispatchPointer('pointerup', { pointerId: 7, clientX: 240, clientY: 150 }));

    expect(onItemDrop).toHaveBeenCalledWith({
      item: { id: 'task-1' },
      source: { resource: resources[0], period: periods[0] },
      destination: { resource: resources[1], period: periods[1] },
    });
    expect(interactionCoordinator.release).toHaveBeenCalledWith('item-drag', 7);
  });
});
