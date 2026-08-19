import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CalendarPeriod } from '../types';
import { useCalendarRangeMove } from './useCalendarRangeMove';

const periods: CalendarPeriod[] = [
  { key: '2026-08-19', start: new Date(2026, 7, 19), end: new Date(2026, 7, 20) },
  { key: '2026-08-20', start: new Date(2026, 7, 20), end: new Date(2026, 7, 21) },
  { key: '2026-08-21', start: new Date(2026, 7, 21), end: new Date(2026, 7, 22) },
];

function dispatchPointer(type: string, values: Record<string, number>) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.entries(values).forEach(([key, value]) => {
    Object.defineProperty(event, key, { value });
  });
  window.dispatchEvent(event);
}

describe('useCalendarRangeMove', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('moves a range and owns the complete preview lifecycle', () => {
    const viewport = document.createElement('div');
    const destinationRow = document.createElement('div');
    destinationRow.className = 'resource-calendar__row';
    destinationRow.dataset.resourceId = 'staff-2';
    viewport.appendChild(destinationRow);
    document.body.appendChild(viewport);
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400,
      x: 0, y: 0, toJSON: () => undefined,
    });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => destinationRow),
    });

    const source = document.createElement('div');
    source.textContent = 'Task range';
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 50, right: 300, bottom: 80, width: 200, height: 30,
      x: 100, y: 50, toJSON: () => undefined,
    });
    const resources = [{ id: 'staff-1' }, { id: 'staff-2' }];
    const onRangeMove = vi.fn();
    const interactionCoordinator = { claim: vi.fn(() => true), release: vi.fn() };
    const { result } = renderHook(() => useCalendarRangeMove({
      viewportRef: { current: viewport },
      periods,
      periodWidth: 100,
      resources,
      getResourceId: resource => resource.id,
      onRangeMove,
      dragEdgeSize: 40,
      dragScrollSpeed: 12,
      coveredLeftWidth: 100,
      interactionCoordinator,
    }));

    act(() => result.current.beginRangeMove({
      pointerId: 8,
      startX: 100,
      startY: 60,
      sourceElement: source,
      resource: resources[0],
      item: { id: 'task-1' },
      range: { start: periods[0].key, end: periods[1].key },
      startIndex: 0,
      endIndex: 1,
      delta: 0,
      moving: false,
    }));
    act(() => dispatchPointer('pointermove', { pointerId: 8, clientX: 200, clientY: 120 }));

    const preview = document.querySelector<HTMLElement>('.resource-calendar__range-move-preview');
    expect(preview).toHaveTextContent('Task range');
    expect(preview).toHaveAttribute('aria-hidden', 'true');
    expect(preview?.parentElement).toHaveProperty('inert', true);

    act(() => dispatchPointer('pointerup', { pointerId: 8, clientX: 200, clientY: 120 }));

    expect(onRangeMove).toHaveBeenCalledWith({
      resource: resources[0],
      destinationResource: resources[1],
      item: { id: 'task-1' },
      originalRange: { start: periods[0].key, end: periods[1].key },
      nextRange: { start: periods[1].key, end: periods[2].key },
    });
    expect(document.querySelector('.resource-calendar__preview-host')).toBeNull();
  });
});
