import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeItemCalendarProps } from '../../../../../../../tests/factories/calendarItem';
import type { StartPointerSession } from '../../../../hooks/usePointerSession/usePointerSession';
import useItemMove from './useItemMove';

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

describe('item move workflow', () => {
  it.each([['touch', 0], ['mouse', 2]] as const)('ignores %s button %s', (pointerType, button) => {
    const fixture = setup();
    const { result } = renderHook(() => useItemMove(fixture.calendar, fixture.hideDetails));
    result.current.onPointerDown({ ...fixture.event, pointerType, button });
    expect(fixture.startPointerSession).not.toHaveBeenCalled();
    expect(fixture.hideDetails).not.toHaveBeenCalled();
  });

  it.each(['2026-08-19', '2026-08-20'])('moves an item ending %s through preview and commit', end => {
    const fixture = setup();
    fixture.calendar.layout = { ...fixture.calendar.layout, end };
    fixture.calendar.target.range = { ...fixture.calendar.target.range, end };
    const { result } = renderHook(() => useItemMove(fixture.calendar, fixture.hideDetails));
    result.current.onPointerDown(fixture.event);
    const session = fixture.startPointerSession.mock.calls[0]![0];

    act(() => { session.onActivate(pointer('pointermove')); session.onMove(pointer('pointermove')); });
    expect(document.querySelector('.item-move-preview')).toHaveTextContent('Calendar item');
    act(() => session.onEnd(pointer('pointerup')));

    expect(fixture.onMove).toHaveBeenCalledWith(expect.objectContaining({ nextRange: { start: '2026-08-20', end: end === '2026-08-19' ? '2026-08-20' : '2026-08-21' }, destinationRow: { id: 'row-2' } }));
    expect(fixture.suppressNextClick).toHaveBeenCalledOnce();
    expect(document.querySelector('.timeline-calendar-portal')).toBeNull();
  });

  it('keeps the accepted interaction when a second request is rejected', () => {
    const fixture = setup();
    fixture.startPointerSession.mockReturnValueOnce(true).mockReturnValue(false);
    const { result } = renderHook(() => useItemMove(fixture.calendar, fixture.hideDetails));
    result.current.onPointerDown(fixture.event);
    result.current.onPointerDown({ ...fixture.event, clientX: 300 });
    const session = fixture.startPointerSession.mock.calls[0]![0];
    act(() => { session.onActivate(pointer('pointermove')); session.onMove(pointer('pointermove')); session.onEnd(pointer('pointerup')); });
    expect(fixture.onMove).toHaveBeenCalledWith(expect.objectContaining({ nextRange: { start: '2026-08-20', end: '2026-08-21' }, destinationRow: { id: 'row-2' } }));
  });

  it('cancels without committing or retaining the preview', () => {
    const fixture = setup();
    const { result } = renderHook(() => useItemMove(fixture.calendar, fixture.hideDetails));
    result.current.onPointerDown(fixture.event);
    const session = fixture.startPointerSession.mock.calls[0]![0];
    act(() => { session.onActivate(pointer('pointermove')); session.onCancel('window-blur'); });
    expect(fixture.onMove).not.toHaveBeenCalled();
    expect(document.querySelector('.timeline-calendar-portal')).toBeNull();
    expect(fixture.source).not.toHaveClass('moving');
  });

  it('continues through the shared pointer service after the source item unmounts', () => {
    const fixture = setup();
    const { result, unmount } = renderHook(() => useItemMove(fixture.calendar, fixture.hideDetails));
    result.current.onPointerDown(fixture.event);
    const session = fixture.startPointerSession.mock.calls[0]![0];
    act(() => { session.onActivate(pointer('pointermove')); session.onMove(pointer('pointermove')); });
    unmount();
    act(() => session.onEnd(pointer('pointerup')));
    expect(fixture.onMove).toHaveBeenCalledOnce();
    expect(document.querySelector('.timeline-calendar-portal')).toBeNull();
  });

  it('suppresses the click even when the destination is rejected', () => {
    const fixture = setup();
    Object.assign(fixture.calendar.stateRef.current, { canItemMove: () => false });
    const { result } = renderHook(() => useItemMove(fixture.calendar, fixture.hideDetails));
    result.current.onPointerDown(fixture.event);
    const session = fixture.startPointerSession.mock.calls[0]![0];
    act(() => { session.onActivate(pointer('pointermove')); session.onMove(pointer('pointermove')); session.onEnd(pointer('pointerup')); });
    expect(fixture.onMove).not.toHaveBeenCalled();
    expect(fixture.suppressNextClick).toHaveBeenCalledOnce();
  });
});
