import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeItemCalendarProps } from '../../../../../../../tests/factories/calendarItem';
import type { StartPointerSession } from '../../../../hooks/usePointerSession/usePointerSession';
import useItemResize from './useItemResize';

const periods = [19, 20, 21, 22].map(day => ({
  key: `2026-08-${day}`, start: new Date(2026, 7, day), end: new Date(2026, 7, day + 1),
}));

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

function pointer(type: string, x = 200, y = 60): PointerEvent {
  return Object.assign(new Event(type), { clientX: x, clientY: y, pointerId: 7 }) as PointerEvent;
}

function setup() {
  const viewport = document.createElement('div');
  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.rowId = 'row-2';
  const source = document.createElement('div');
  source.textContent = 'Calendar item';
  row.appendChild(source);
  viewport.appendChild(row);
  document.body.appendChild(viewport);
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => row });
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 400));
  vi.spyOn(source, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 200, 30));
  const startPointerSession = vi.fn<StartPointerSession>(() => true);
  const hideDetails = vi.fn();
  const onMove = vi.fn();
  const onResize = vi.fn();
  const suppressNextClick = vi.fn();
  const rows = [{ id: 'row-1' }, { id: 'row-2' }];
  const calendar = makeItemCalendarProps({ row: rows[0], data: { id: 'item-1' }, range: { start: '2026-08-19', end: '2026-08-20' } }, { movable: true, resizable: true, onMove, onResize });
  Object.assign(calendar.stateRef.current, { rows, getRowId: (value: { id: string }) => value.id, moveEnabled: true, resizeEnabled: true });
  calendar.environment = { ...calendar.environment, viewportRef: { current: viewport }, getPeriods: () => periods, onPointerSessionRequest: startPointerSession, onClickSuppressionRequest: suppressNextClick };
  const event = {
    button: 0, pointerType: 'mouse', pointerId: 7, clientX: 100, clientY: 60,
    currentTarget: source, stopPropagation: vi.fn(),
  } as unknown as ReactPointerEvent<HTMLDivElement>;
  return { calendar, viewport, source, startPointerSession, hideDetails, onMove, onResize, suppressNextClick, event };
}

describe('item resize workflow', () => {
  it.each([['touch', 0], ['mouse', 2]] as const)('ignores %s button %s while preventing move propagation', (pointerType, button) => {
    const fixture = setup();
    const { result } = renderHook(() => useItemResize(fixture.calendar, fixture.hideDetails));
    const stopPropagation = vi.fn();
    result.current.endHandle?.onPointerDown?.({ ...fixture.event, pointerType, button, stopPropagation } as unknown as ReactPointerEvent<HTMLButtonElement>);
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(fixture.startPointerSession).not.toHaveBeenCalled();
  });

  it('resizes the end through preview and commit without changing its start', () => {
    const fixture = setup();
    const handle = document.createElement('button');
    fixture.source.appendChild(handle);
    const { result } = renderHook(() => useItemResize(fixture.calendar, fixture.hideDetails));
    result.current.endHandle?.onPointerDown?.({ ...fixture.event, currentTarget: handle } as unknown as ReactPointerEvent<HTMLButtonElement>);
    const session = fixture.startPointerSession.mock.calls[0]![0];

    expect(session.captureElement).toBe(fixture.viewport);
    act(() => { session.onActivate(pointer('pointermove', 250)); session.onMove(pointer('pointermove', 250)); });
    expect(document.querySelector('.item-resize-preview')).toHaveTextContent('Calendar item');
    act(() => session.onEnd(pointer('pointerup', 250)));

    expect(fixture.onResize).toHaveBeenCalledWith(expect.objectContaining({ nextRange: { start: '2026-08-19', end: '2026-08-21' }, edge: 'end' }));
    expect(fixture.suppressNextClick).toHaveBeenCalledOnce();
    expect(document.querySelector('.timeline-calendar-portal')).toBeNull();
  });

  it.each(['start', 'end'] as const)('skips an unchanged %s resize while suppressing its click', edge => {
    const fixture = setup();
    const handle = document.createElement('button');
    fixture.source.appendChild(handle);
    const { result } = renderHook(() => useItemResize(fixture.calendar, fixture.hideDetails));
    const handleProps = edge === 'start' ? result.current.startHandle : result.current.endHandle;
    handleProps?.onPointerDown?.({ ...fixture.event, currentTarget: handle } as unknown as ReactPointerEvent<HTMLButtonElement>);
    const session = fixture.startPointerSession.mock.calls[0]![0];
    const originalX = edge === 'start' ? 30 : 130;

    act(() => {
      session.onActivate(pointer('pointermove', 250));
      session.onMove(pointer('pointermove', 250));
      session.onMove(pointer('pointermove', originalX));
      session.onEnd(pointer('pointerup', originalX));
    });

    expect(fixture.onResize).not.toHaveBeenCalled();
    expect(fixture.suppressNextClick).toHaveBeenCalledOnce();
    expect(document.querySelector('.timeline-calendar-portal')).toBeNull();
  });

  it('cancels without committing and cleans up its preview', () => {
    const fixture = setup();
    const handle = document.createElement('button');
    fixture.source.appendChild(handle);
    const { result } = renderHook(() => useItemResize(fixture.calendar, fixture.hideDetails));
    result.current.endHandle?.onPointerDown?.({ ...fixture.event, currentTarget: handle } as unknown as ReactPointerEvent<HTMLButtonElement>);
    const session = fixture.startPointerSession.mock.calls[0]![0];
    act(() => { session.onActivate(pointer('pointermove')); session.onCancel('pointer-cancel'); });
    expect(fixture.onResize).not.toHaveBeenCalled();
    expect(document.querySelector('.timeline-calendar-portal')).toBeNull();
  });

  it.each([
    ['start', 'ArrowLeft', '2026-08-20', '2026-08-21', { start: '2026-08-19', end: '2026-08-21' }],
    ['start', 'ArrowRight', '2026-08-20', '2026-08-21', { start: '2026-08-21', end: '2026-08-21' }],
    ['end', 'ArrowLeft', '2026-08-20', '2026-08-21', { start: '2026-08-20', end: '2026-08-20' }],
    ['end', 'ArrowRight', '2026-08-20', '2026-08-21', { start: '2026-08-20', end: '2026-08-22' }],
  ] as const)('resizes the %s with %s', (edge, key, start, end, nextRange) => {
    const fixture = setup();
    fixture.calendar.layout = { ...fixture.calendar.layout, start, end };
    const { result } = renderHook(() => useItemResize(fixture.calendar, fixture.hideDetails));
    const handle = edge === 'start' ? result.current.startHandle : result.current.endHandle;
    const preventDefault = vi.fn();
    handle?.onKeyDown?.({ key, preventDefault } as unknown as React.KeyboardEvent<HTMLButtonElement>);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(fixture.onResize).toHaveBeenCalledWith(expect.objectContaining({ nextRange, edge }));
  });

  it.each([
    ['start', 'ArrowLeft', '2026-08-19', '2026-08-20'],
    ['end', 'ArrowRight', '2026-08-20', '2026-08-22'],
    ['start', 'ArrowRight', '2026-08-20', '2026-08-20'],
    ['end', 'ArrowLeft', '2026-08-20', '2026-08-20'],
  ] as const)('keeps %s inside valid bounds for %s', (edge, key, start, end) => {
    const fixture = setup();
    fixture.calendar.layout = { ...fixture.calendar.layout, start, end };
    const { result } = renderHook(() => useItemResize(fixture.calendar, fixture.hideDetails));
    const handle = edge === 'start' ? result.current.startHandle : result.current.endHandle;
    handle?.onKeyDown?.({ key, preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLButtonElement>);
    expect(fixture.onResize).not.toHaveBeenCalled();
  });

  it('omits clipped, disabled, and standalone handles', () => {
    const fixture = setup();
    fixture.calendar.layout.startsInWindow = false;
    const { result, rerender } = renderHook(({ value }) => useItemResize(value, fixture.hideDetails), { initialProps: { value: fixture.calendar as typeof fixture.calendar | undefined } });
    expect(result.current.startHandle).toBeUndefined();
    expect(result.current.endHandle).toBeDefined();
    rerender({ value: { ...fixture.calendar, resizable: false } });
    expect(result.current.endHandle).toBeUndefined();
    rerender({ value: undefined });
    expect(result.current.startHandle).toBeUndefined();
    expect(result.current.endHandle).toBeUndefined();
  });
});
