// This suite owns item-move previews, range commits, and session exclusivity.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CalendarPeriod } from '../../types';
import { usePointerSession } from '../usePointerSession/usePointerSession';
import { useItemMove } from './useItemMove';

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

describe('useItemMove', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it.each([
    ['one-period', { start: periods[0].key, end: periods[0].key }, { start: periods[1].key, end: periods[1].key }],
    ['multi-period', { start: periods[0].key, end: periods[1].key }, { start: periods[1].key, end: periods[2].key }],
  ])('moves a %s item through the same preview and callback path', (_, range, nextRange) => {
    const viewport = document.createElement('div');
    const destinationRow = document.createElement('div');
    destinationRow.className = 'row';
    destinationRow.dataset.rowId = 'staff-2';
    viewport.appendChild(destinationRow);
    document.body.appendChild(viewport);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => destinationRow),
    });

    const source = document.createElement('div');
    source.textContent = 'Calendar item';
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 50, right: 300, bottom: 80, width: 200, height: 30,
      x: 100, y: 50, toJSON: () => undefined,
    });
    const rows = [{ id: 'staff-1' }, { id: 'staff-2' }];
    const item = { id: 'item-1' };
    const onItemMove = vi.fn();
    const { result } = renderHook(() => {
      const pointer = usePointerSession();
      return useItemMove({
        viewportRef: { current: viewport },
        periods,
        periodWidth: 100,
        rows,
        getRowId: row => row.id,
        onItemMove,
        dragEdgeSize: 40,
        dragScrollSpeed: 12,
        coveredLeftWidth: 100,
        beginPointerSession: pointer.beginPointerSession,
      });
    });

    act(() => result.current.beginItemMove({
      pointerId: 8,
      startX: 100,
      startY: 60,
      sourceElement: source,
      row: rows[0],
      item,
      range,
    }));
    act(() => dispatchPointer('pointermove', { pointerId: 8, clientX: 200, clientY: 120 }));

    const preview = document.querySelector<HTMLElement>('.item-move-preview');
    expect(preview).toHaveTextContent('Calendar item');
    expect(preview).toHaveAttribute('aria-hidden', 'true');
    expect(preview?.parentElement).toHaveProperty('inert', true);

    act(() => dispatchPointer('pointerup', { pointerId: 8, clientX: 200, clientY: 120 }));

    expect(onItemMove).toHaveBeenCalledWith({
      row: rows[0],
      destinationRow: rows[1],
      item,
      originalRange: range,
      nextRange,
    });
    expect(document.querySelector('.timeline-calendar-portal')).toBeNull();
  });

  it('keeps the accepted move active when a second move is rejected', () => {
    const viewport = document.createElement('div');
    const destinationRow = document.createElement('div');
    destinationRow.className = 'row';
    destinationRow.dataset.rowId = 'staff-2';
    viewport.appendChild(destinationRow);
    document.body.appendChild(viewport);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => destinationRow),
    });

    const rows = [{ id: 'staff-1' }, { id: 'staff-2' }];
    const firstItem = { id: 'item-1' };
    const onItemMove = vi.fn();
    const { result } = renderHook(() => {
      const pointer = usePointerSession();
      return useItemMove({
        viewportRef: { current: viewport },
        periods,
        periodWidth: 100,
        rows,
        getRowId: row => row.id,
        onItemMove,
        dragEdgeSize: 40,
        dragScrollSpeed: 12,
        coveredLeftWidth: 100,
        beginPointerSession: pointer.beginPointerSession,
      });
    });

    act(() => {
      result.current.beginItemMove({
        pointerId: 8,
        startX: 100,
        startY: 60,
        sourceElement: document.createElement('div'),
        row: rows[0],
        item: firstItem,
        range: { start: periods[0].key, end: periods[0].key },
      });
      result.current.beginItemMove({
        pointerId: 9,
        startX: 300,
        startY: 60,
        sourceElement: document.createElement('div'),
        row: rows[0],
        item: { id: 'item-2' },
        range: { start: periods[1].key, end: periods[1].key },
      });
    });
    act(() => dispatchPointer('pointermove', { pointerId: 8, clientX: 200, clientY: 120 }));
    act(() => dispatchPointer('pointerup', { pointerId: 8, clientX: 200, clientY: 120 }));

    expect(onItemMove).toHaveBeenCalledOnce();
    expect(onItemMove).toHaveBeenCalledWith({
      row: rows[0],
      destinationRow: rows[1],
      item: firstItem,
      originalRange: { start: periods[0].key, end: periods[0].key },
      nextRange: { start: periods[1].key, end: periods[1].key },
    });
  });
});
