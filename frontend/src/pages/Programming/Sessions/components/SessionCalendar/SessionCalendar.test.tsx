import { makeItemCalendarProps } from '../../../../../tests/factories/calendarItem';
import type { ReactElement } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import { makeProgramSession } from '../../../../../tests/factories/session';
import { buildDayPeriod } from '../../../../../common/components/TimelineCalendar/utils/periods';
import type { TimelineCalendarProps } from '../../../../../common/components/TimelineCalendar/types';
import type { Program } from '../../../Programs/types';
import type { ProgramSession, SessionCalendarCache, SessionListFilters } from '../../types';
import SessionCalendar from './SessionCalendar';
import SessionItem from './SessionItem/SessionItem';

type CalendarProps = TimelineCalendarProps<Program, ProgramSession>;
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
  { id: 'program-1', title: 'Future Ready', enrollmentRequired: true, minAge: null, maxAge: null, defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto' },
  { id: 'program-2', title: 'Job Readiness', enrollmentRequired: false, minAge: null, maxAge: null, defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto' },
];
const session = makeProgramSession();
const period = buildDayPeriod('2026-08-10');

/**
 * Mounts the session calendar with domain filters and optional write actions.
 * @example renderCalendar({ programIds: ['program-1'] }, false) // read-only filtered calendar
 */
function renderCalendar(filters: SessionListFilters = {}, editable = true) {
  const callbacks = {
    onSessionSelect: vi.fn(), onSessionEdit: vi.fn(), onSessionDelete: vi.fn(),
    onAddSession: vi.fn(), onProgramSelect: vi.fn(),
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

/**
 * Builds the selected session's item using the calendar's production callback.
 * @example buildSessionItem().props.selected // true for the selected fixture
 */
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

  it('loads date-only filters and groups saved-date placements by program', async () => {
    const filters: SessionListFilters = {
      programIds: ['program-1', 'program-2'], cycleIds: ['cycle-1'],
      sessionTypes: ['Regular'], statuses: ['upcoming'], search: 'Communication',
    };
    const otherSession = makeProgramSession({ id: 'session-2', programId: 'program-2' });
    api.getSessions.mockResolvedValue([session, otherSession]);
    renderCalendar(filters);
    act(() => calendarState.props!.onInitialPeriods!([period]));

    const requestFilters = {
      ...filters, start: expect.any(String), end: expect.any(String),
    };
    await waitFor(() => expect(api.getSessions).toHaveBeenCalledWith(requestFilters, { signal: expect.any(AbortSignal) }));
    await waitFor(() => expect(calendarState.props!.items).toEqual({
      'program-1': [session], 'program-2': [otherSession],
    }));
    expect(calendarState.props!.getItemRange(session)).toEqual({ start: '2026-08-10', end: '2026-08-10' });
  });

  it('keeps selected program rows and connects program/session selection and edit/delete actions', () => {
    const rendered = renderCalendar({ programIds: ['program-1'] });
    const calendar = calendarState.props!;
    const item = buildSessionItem();

    expect(calendar.rows).toEqual([programs[0]]);
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
  });

  it('omits write actions for a read-only consumer', () => {
    renderCalendar({}, false);
    const item = buildSessionItem();
    expect(calendarState.props!.onCellActivate).toBeUndefined();
    expect(item.props.onEdit).toBeUndefined();
    expect(item.props.onDelete).toBeUndefined();
  });

  it('allows eligible sessions to move only within the same program', async () => {
    const future = makeProgramSession({ movable: true, date: '2099-08-10', startTime: '17:00', endTime: '19:00' });
    const updated = { ...future, date: '2099-08-11' };
    const calendarCacheRef = { current: { upsert: vi.fn(), remove: vi.fn() } as SessionCalendarCache };
    const move = vi.fn().mockResolvedValue(updated);
    api.getSessions.mockResolvedValue([future]);
    const day = buildDayPeriod('2099-08-10');
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
  });

  it('reconciles saved rows through its cache adapter and excludes an unselected cycle', async () => {
    const { calendarCacheRef } = renderCalendar({ cycleIds: ['cycle-1'] });
    act(() => calendarState.props!.onInitialPeriods!([period]));
    await waitFor(() => expect(calendarState.props!.items['program-1']).toEqual([session]));

    act(() => calendarCacheRef.current.upsert(makeProgramSession({ cycleId: 'cycle-2' })));
    await waitFor(() => expect(calendarState.props!.items['program-1'] ?? []).toEqual([]));

    const saved = makeProgramSession({ title: 'Authoritative edit' });
    act(() => calendarCacheRef.current.upsert(saved));
    await waitFor(() => expect(calendarState.props!.items['program-1']).toEqual([saved]));

    act(() => calendarCacheRef.current.remove(saved.id));
    await waitFor(() => expect(calendarState.props!.items['program-1'] ?? []).toEqual([]));
  });

  it('offers recovery when the session calendar is unavailable', async () => {
    api.getSessions.mockRejectedValueOnce(new Error('Could not load sessions'));
    renderCalendar();
    act(() => calendarState.props!.onInitialPeriods!([period]));

    expect(await screen.findByText('Sessions calendar unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText('Sessions calendar unavailable')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Sessions calendar')).toBeInTheDocument();
  });

  it('bounds the timeline and buffered request to the same page dates', async () => {
    const dateRange = { start: '2026-08-01', end: '2026-08-31' };
    renderCalendar({ dateRange });
    act(() => calendarState.props!.onInitialPeriods!([period]));
    await waitFor(() => expect(api.getSessions).toHaveBeenCalledWith({
      dateRange, start: '2026-08-01', end: '2026-08-31',
    }, { signal: expect.any(AbortSignal) }));
  });
});
