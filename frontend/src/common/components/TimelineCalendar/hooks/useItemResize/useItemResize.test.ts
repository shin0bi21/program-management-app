// This suite owns pointer and keyboard resize boundaries, commits, and session exclusivity.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CalendarPeriod } from '../../types';
import { usePointerSession } from '../usePointerSession/usePointerSession';
import { useItemResize } from './useItemResize';

const periods: CalendarPeriod[] = [
  { key: '2026-08-19', start: new Date(2026, 7, 19), end: new Date(2026, 7, 20) },
  { key: '2026-08-20', start: new Date(2026, 7, 20), end: new Date(2026, 7, 21) },
  { key: '2026-08-21', start: new Date(2026, 7, 21), end: new Date(2026, 7, 22) },
  { key: '2026-08-22', start: new Date(2026, 7, 22), end: new Date(2026, 7, 23) },
  { key: '2026-08-23', start: new Date(2026, 7, 23), end: new Date(2026, 7, 24) },
];

function dispatchPointer(type: string, values: Record<string, number>) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.entries(values).forEach(([key, value]) => {
    Object.defineProperty(event, key, { value });
  });
  window.dispatchEvent(event);
}

describe('useItemResize', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('resizes an item through the shared pointer session and item preview', () => {
    const viewport = document.createElement('div');
    document.body.appendChild(viewport);
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400,
      x: 0, y: 0, toJSON: () => undefined,
    });
    const source = document.createElement('button');
    const itemElement = document.createElement('div');
    itemElement.textContent = 'Calendar item';
    vi.spyOn(itemElement, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 50, right: 300, bottom: 80, width: 200, height: 30,
      x: 100, y: 50, toJSON: () => undefined,
    });
    const row = { id: 'staff-1' };
    const item = { id: 'item-1' };
    const range = { start: periods[0].key, end: periods[1].key };
    const onItemResize = vi.fn();
    const { result } = renderHook(() => {
      const pointer = usePointerSession();
      return useItemResize({
        viewportRef: { current: viewport },
        allPeriods: periods,
        periodWidth: 100,
        coveredLeftWidth: 0,
        onItemResize,
        dragEdgeSize: 40,
        dragScrollSpeed: 12,
        beginPointerSession: pointer.beginPointerSession,
      });
    });

    act(() => result.current.beginItemResize({
      pointerId: 9,
      startX: 200,
      sourceElement: source,
      itemElement,
      row,
      item,
      range,
      edge: 'end',
    }));
    act(() => dispatchPointer('pointermove', { pointerId: 9, clientX: 250, clientY: 60 }));

    expect(document.querySelector('.item-resize-preview')).toHaveTextContent('Calendar item');

    act(() => dispatchPointer('pointerup', { pointerId: 9, clientX: 250, clientY: 60 }));

    expect(onItemResize).toHaveBeenCalledWith({
      row,
      item,
      originalRange: range,
      nextRange: { start: periods[0].key, end: periods[2].key },
      edge: 'end',
    });
    expect(document.querySelector('.timeline-calendar-portal')).toBeNull();
  });

  it('keeps the accepted resize active when a second resize is rejected', () => {
    const viewport = document.createElement('div');
    document.body.appendChild(viewport);
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400,
      x: 0, y: 0, toJSON: () => undefined,
    });

    const firstItem = { id: 'item-1' };
    const firstItemElement = document.createElement('div');
    vi.spyOn(firstItemElement, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 50, right: 300, bottom: 80, width: 200, height: 30,
      x: 100, y: 50, toJSON: () => undefined,
    });
    const onItemResize = vi.fn();
    const { result } = renderHook(() => {
      const pointer = usePointerSession();
      return useItemResize({
        viewportRef: { current: viewport },
        allPeriods: periods,
        periodWidth: 100,
        coveredLeftWidth: 0,
        onItemResize,
        dragEdgeSize: 40,
        dragScrollSpeed: 12,
        beginPointerSession: pointer.beginPointerSession,
      });
    });

    act(() => {
      result.current.beginItemResize({
        pointerId: 9,
        startX: 200,
        sourceElement: document.createElement('button'),
        itemElement: firstItemElement,
        row: { id: 'staff-1' },
        item: firstItem,
        range: { start: periods[0].key, end: periods[1].key },
        edge: 'end',
      });
      result.current.beginItemResize({
        pointerId: 10,
        startX: 400,
        sourceElement: document.createElement('button'),
        itemElement: document.createElement('div'),
        row: { id: 'staff-1' },
        item: { id: 'item-2' },
        range: { start: periods[2].key, end: periods[3].key },
        edge: 'end',
      });
    });
    act(() => dispatchPointer('pointermove', { pointerId: 9, clientX: 250, clientY: 60 }));
    act(() => dispatchPointer('pointerup', { pointerId: 9, clientX: 250, clientY: 60 }));

    expect(onItemResize).toHaveBeenCalledOnce();
    expect(onItemResize).toHaveBeenCalledWith({
      row: { id: 'staff-1' },
      item: firstItem,
      originalRange: { start: periods[0].key, end: periods[1].key },
      nextRange: { start: periods[0].key, end: periods[2].key },
      edge: 'end',
    });
  });

  it.each([
    ['start', -1, { start: periods[0].key, end: periods[3].key }],
    ['start', 1, { start: periods[2].key, end: periods[3].key }],
    ['end', -1, { start: periods[1].key, end: periods[2].key }],
    ['end', 1, { start: periods[1].key, end: periods[4].key }],
  ] as const)('resizes the %s edge one full-calendar period in direction %s', (edge, direction, nextRange) => {
    const row = { id: 'staff-1' };
    const item = { id: 'item-1' };
    const range = { start: periods[1].key, end: periods[3].key };
    const onItemResize = vi.fn();
    const { result } = renderHook(() => {
      const pointer = usePointerSession();
      return useItemResize({
        viewportRef: { current: null },
        allPeriods: periods,
        periodWidth: 100,
        coveredLeftWidth: 0,
        onItemResize,
        dragEdgeSize: 40,
        dragScrollSpeed: 12,
        beginPointerSession: pointer.beginPointerSession,
      });
    });

    act(() => result.current.resizeByKeyboard({ row, item, range, edge }, direction));

    expect(onItemResize).toHaveBeenCalledWith({
      row,
      item,
      originalRange: range,
      nextRange,
      edge,
    });
  });

  it.each([
    ['calendar start', { start: periods[0].key, end: periods[2].key }, 'start', -1],
    ['calendar end', { start: periods[2].key, end: periods[4].key }, 'end', 1],
    ['start crossing end', { start: periods[2].key, end: periods[2].key }, 'start', 1],
    ['end crossing start', { start: periods[2].key, end: periods[2].key }, 'end', -1],
  ] as const)('does not resize past the %s bound', (_label, range, edge, direction) => {
    const onItemResize = vi.fn();
    const { result } = renderHook(() => {
      const pointer = usePointerSession();
      return useItemResize({
        viewportRef: { current: null },
        allPeriods: periods,
        periodWidth: 100,
        coveredLeftWidth: 0,
        onItemResize,
        dragEdgeSize: 40,
        dragScrollSpeed: 12,
        beginPointerSession: pointer.beginPointerSession,
      });
    });

    act(() => result.current.resizeByKeyboard({
      row: { id: 'staff-1' },
      item: { id: 'item-1' },
      range,
      edge,
    }, direction));

    expect(onItemResize).not.toHaveBeenCalled();
  });
});
