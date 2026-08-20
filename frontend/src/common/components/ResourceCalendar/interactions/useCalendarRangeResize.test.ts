import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CalendarPeriod } from '../types';
import { useCalendarRangeResize } from './useCalendarRangeResize';

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

describe('useCalendarRangeResize', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('resizes the selected edge and removes its geometry preview on completion', () => {
    const viewport = document.createElement('div');
    document.body.appendChild(viewport);
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400,
      x: 0, y: 0, toJSON: () => undefined,
    });
    const source = document.createElement('button');
    const rangeElement = document.createElement('div');
    vi.spyOn(rangeElement, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 50, right: 200, bottom: 80, width: 200, height: 30,
      x: 0, y: 50, toJSON: () => undefined,
    });
    const onRangeResize = vi.fn();
    const interactionCoordinator = { claim: vi.fn(() => true), release: vi.fn() };
    const resource = { id: 'staff-1' };
    const { result } = renderHook(() => useCalendarRangeResize({
      viewportRef: { current: viewport },
      periods,
      periodWidth: 100,
      coveredLeftWidth: 0,
      onRangeResize,
      dragEdgeSize: 40,
      dragScrollSpeed: 12,
      interactionCoordinator,
      firstPeriodIndex: 0,
    }));

    act(() => result.current.beginResize({
      pointerId: 9,
      startX: 200,
      sourceElement: source,
      rangeElement,
      resource,
      item: { id: 'task-1' },
      range: { start: periods[0].key, end: periods[1].key },
      edge: 'end',
      startIndex: 0,
      endIndex: 1,
      nextIndex: 1,
      resizing: false,
    }));
    act(() => dispatchPointer('pointermove', { pointerId: 9, clientX: 250 }));

    expect(document.querySelector('.resource-calendar__range-resize-preview')).not.toBeNull();

    act(() => dispatchPointer('pointerup', { pointerId: 9, clientX: 250 }));

    expect(onRangeResize).toHaveBeenCalledWith({
      resource,
      item: { id: 'task-1' },
      originalRange: { start: periods[0].key, end: periods[1].key },
      nextRange: { start: periods[0].key, end: periods[2].key },
      edge: 'end',
    });
    expect(document.querySelector('.resource-calendar__preview-host')).toBeNull();
  });
});
