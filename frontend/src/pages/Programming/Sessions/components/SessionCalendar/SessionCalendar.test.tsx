import { makeItemCalendarProps } from '../../../../../tests/factories/calendarItem';
import type { ReactElement } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import { makeCohortSession } from '../../../../../tests/factories/session';
import { buildDayPeriod } from '../../../../../common/components/TimelineCalendar/utils/periods';
import type { TimelineCalendarProps } from '../../../../../common/components/TimelineCalendar/types';
import type { Program } from '../../../../../common/features/programs/types';
import type { CohortSession, SessionCalendarCache, SessionListFilters } from '../../types';
import SessionCalendar from './SessionCalendar';
import SessionItem from './SessionItem/SessionItem';

type CalendarProps = TimelineCalendarProps<Program, CohortSession>;
const calendarState = vi.hoisted(() => ({ props: null as CalendarProps | null }));
const api = vi.hoisted(() => ({ getSessions: vi.fn() }));
vi.mock('../../../../../common/components/TimelineCalendar/TimelineCalendar', () => ({
  default: (props: CalendarProps) => {
    calendarState.props = props;
    return <div aria-label="Sessions calendar" />;
  },
}));
vi.mock('../../sessions.api', () => ({ getSessions: api.getSessions }));

const programs: Program[] = [
  { id: 'program-1', name: 'Future Ready', enrollmentRequired: true, minAge: null, maxAge: null, defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto' },
  { id: 'program-2', name: 'Job Readiness', enrollmentRequired: false, minAge: null, maxAge: null, defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto' },
];
const session = makeCohortSession();
const period = buildDayPeriod(new Date(2026, 7, 10));

function renderCalendar(filters: SessionListFilters = {}, editable = true) {
  const callbacks = {
    onSessionSelect: vi.fn(), onSessionEdit: vi.fn(), onSessionDelete: vi.fn(),
    onAddSession: vi.fn(), onProgramSelect: vi.fn(), onSessionsLoaded: vi.fn(), onMessageChange: vi.fn(),
  };
  const calendarCacheRef = { current: { upsert: vi.fn(), remove: vi.fn() } as SessionCalendarCache };
  const rendered = render(<SessionCalendar
    calendarCacheRef={calendarCacheRef}
    filters={filters}
    programs={programs}
    selectedSessionId={session.id}
    selectedProgramId={programs[0].id}
    {...callbacks}
    onAddSession={editable ? callbacks.onAddSession : undefined}
    onSessionEdit={editable ? callbacks.onSessionEdit : undefined}
    onSessionDelete={editable ? callbacks.onSessionDelete : undefined}
  />);
  return { ...rendered, ...callbacks, calendarCacheRef };
}

function buildSessionItem(): ReactElement<Parameters<typeof SessionItem>[0]> {
  return calendarState.props!.buildItem({
    row: programs[0], data: session,
    range: { start: '2026-08-10', end: '2026-08-10' },
    calendar: makeItemCalendarProps({ row: programs[0], data: session, range: { start: '2026-08-10', end: '2026-08-10' } }),
    visibleStart: period, visibleEnd: period,
  }) as ReactElement<Parameters<typeof SessionItem>[0]>;
}

describe('SessionCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calendarState.props = null;
    api.getSessions.mockResolvedValue([session]);
  });

  it('cancels its own range read when unmounted', () => {
    const { unmount } = renderCalendar();
    act(() => calendarState.props?.onInitialPeriods?.([period]));
    const signal = api.getSessions.mock.calls[0][1].signal as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it('loads complete filters with a Toronto range, groups sessions by program and resolves buffered selection records', async () => {
    const filters: SessionListFilters = {
      programIds: ['program-1', 'program-2'], cycleIds: ['cycle-1'],
      sessionTypeIds: ['type-1'], statuses: ['upcoming'], search: 'Communication',
    };
    const otherSession = makeCohortSession({ id: 'session-2', programId: 'program-2' });
    api.getSessions.mockResolvedValue([session, otherSession]);
    const rendered = renderCalendar(filters);
    act(() => calendarState.props!.onInitialPeriods!([period]));

    const requestFilters = {
      ...filters, start: '2026-06-29T04:00:00Z', end: '2026-09-22T04:00:00Z',
    };
    await waitFor(() => expect(api.getSessions).toHaveBeenCalledWith(requestFilters, { signal: expect.any(AbortSignal) }));
    await waitFor(() => expect(calendarState.props!.items).toEqual({
      'program-1': [session], 'program-2': [otherSession],
    }));
    expect(rendered.onSessionsLoaded).toHaveBeenLastCalledWith([session, otherSession]);
    expect(calendarState.props!.rows).toEqual(programs);
    expect(calendarState.props!.getItemRange(session)).toEqual({ start: '2026-08-10', end: '2026-08-10' });
  });

  it('keeps selected program rows and connects program/session selection and edit/delete actions', () => {
    const rendered = renderCalendar({ programIds: ['program-1'] });
    const calendar = calendarState.props!;
    const item = buildSessionItem();

    expect(calendar.rows).toEqual([programs[0]]);
    expect(calendar.selectedRowId).toBe(programs[0].id);
    expect(item.props.selected).toBe(true);
    calendar.onCellActivate!({ row: programs[0], rowIndex: 0, period, items: [] });
    expect(rendered.onAddSession).toHaveBeenCalledWith(programs[0], period.key);
    calendar.onRowSelect!(programs[0]);
    calendar.onItemActivate!({ row: programs[0], data: session, range: calendar.getItemRange(session) });
    item.props.onEdit!();
    item.props.onDelete!();

    expect(rendered.onProgramSelect).toHaveBeenCalledWith(programs[0]);
    expect(rendered.onSessionSelect).toHaveBeenCalledWith(session);
    expect(rendered.onSessionEdit).toHaveBeenCalledWith(session);
    expect(rendered.onSessionDelete).toHaveBeenCalledWith(session);
    expect(calendar.getItemCapabilities!({ row: programs[0], data: session, range: calendar.getItemRange(session) }))
      .toEqual({ draggable: false, resizable: false });
    expect(calendar.onItemMove).toBeUndefined();
    expect(calendar.onItemResize).toBeUndefined();
  });

  it('omits write actions for a read-only consumer', () => {
    renderCalendar({}, false);
    const item = buildSessionItem();
    expect(calendarState.props!.onCellActivate).toBeUndefined();
    expect(item.props.onEdit).toBeUndefined();
    expect(item.props.onDelete).toBeUndefined();
  });

  it('enables future session moves within the same program and reconciles the visible buffer', async () => {
    const future = makeCohortSession({ startsAt: '2099-08-10T21:00:00Z', endsAt: '2099-08-10T23:00:00Z' });
    const updated = { ...future, cycleId: 'cycle-1', startsAt: '2099-08-11T21:00:00Z', endsAt: '2099-08-11T23:00:00Z' };
    const calendarCacheRef = { current: { upsert: vi.fn(), remove: vi.fn() } as SessionCalendarCache };
    const move = vi.fn().mockImplementation(async () => {
      calendarCacheRef.current.upsert(updated);
      return updated;
    });
    api.getSessions.mockResolvedValue([future]);
    const day = buildDayPeriod(new Date(2099, 7, 10));
    render(<SessionCalendar calendarCacheRef={calendarCacheRef} filters={{}} programs={programs}
      selectedSessionId={future.id} onSessionSelect={vi.fn()} onSessionMove={move} />);
    act(() => calendarState.props!.onInitialPeriods!([day]));
    await waitFor(() => expect(calendarState.props!.items['program-1']).toEqual([future]));
    const calendar = calendarState.props!;
    const context = { row: programs[0], data: future, range: calendar.getItemRange(future) };
    expect(calendar.getItemCapabilities!(context)).toEqual({ draggable: true, resizable: false });
    expect(calendar.getItemCapabilities!({ ...context, data: session }).draggable).toBe(false);
    expect(calendar.getItemCapabilities!({ ...context, data: { ...future, cancelledAt: '2099-01-01T00:00:00Z' } }).draggable).toBe(false);
    const drop = { row: programs[0], destinationRow: programs[0], item: future,
      originalRange: context.range, nextRange: { start: '2099-08-11', end: '2099-08-11' } };
    expect(calendar.canItemMove!(drop)).toBe(true);
    expect(calendar.canItemMove!({ ...drop, destinationRow: programs[1] })).toBe(false);
    await act(async () => { await calendar.onItemMove!(drop); });
    expect(move).toHaveBeenCalledWith(future, '2099-08-11');
    await waitFor(() => expect(calendarState.props!.items['program-1']).toEqual([updated]));
  });

  it('reconciles saved rows through its cache adapter and excludes an unselected cycle', async () => {
    const { calendarCacheRef } = renderCalendar({ cycleIds: ['cycle-1'] });
    act(() => calendarState.props!.onInitialPeriods!([period]));
    await waitFor(() => expect(calendarState.props!.items['program-1']).toEqual([session]));

    act(() => calendarCacheRef.current.upsert(makeCohortSession({ cycleId: 'cycle-2' })));
    await waitFor(() => expect(calendarState.props!.items['program-1'] ?? []).toEqual([]));

    const saved = makeCohortSession({ theme: 'Authoritative edit' });
    act(() => calendarCacheRef.current.upsert(saved));
    await waitFor(() => expect(calendarState.props!.items['program-1']).toEqual([saved]));

    act(() => calendarCacheRef.current.remove(saved.id));
    await waitFor(() => expect(calendarState.props!.items['program-1'] ?? []).toEqual([]));
  });

  it('reports load failure and retries the range through the page error owner', async () => {
    api.getSessions.mockRejectedValueOnce(new Error('Could not load sessions'));
    const rendered = renderCalendar();
    act(() => calendarState.props!.onInitialPeriods!([period]));

    expect(await screen.findByText('Sessions calendar unavailable')).toBeInTheDocument();
    await waitFor(() => expect(rendered.onMessageChange).toHaveBeenLastCalledWith(expect.objectContaining({
      message: 'Could not load sessions', action: expect.objectContaining({ label: 'Retry' }),
    })));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(rendered.onSessionsLoaded).toHaveBeenLastCalledWith([session]));
    expect(screen.queryByText('Sessions calendar unavailable')).not.toBeInTheDocument();
  });
  it('bounds the timeline and buffered request to the same page dates', async () => {
    const dateRange = { start: '2026-08-01', end: '2026-08-31' };
    renderCalendar({ dateRange });
    expect(calendarState.props!.dateRange).toEqual(dateRange);
    act(() => calendarState.props!.onInitialPeriods!([period]));
    await waitFor(() => expect(api.getSessions).toHaveBeenCalledWith({
      dateRange, start: '2026-08-01T04:00:00Z', end: '2026-09-01T04:00:00Z',
    }, { signal: expect.any(AbortSignal) }));
  });

});
