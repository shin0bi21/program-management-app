import { makeItemCalendarProps } from '../../../../../tests/factories/calendarItem';
import type { MutableRefObject } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HoursCalendar from './HoursCalendar';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';

import { buildInitialDayPeriods } from '../../../../../common/components/TimelineCalendar/utils/periods';
import type {
  CalendarPeriod,
  TimelineCalendarProps,
} from '../../../../../common/components/TimelineCalendar/types';
import {
  getHoursCalendarData,
} from '../../hours.api';
import type { StaffReference } from '../../../../../common/features/referenceData/referenceData.api';
import type { Hours, HoursFilters } from '../../types';
import { makeHoursItem } from '../../../../../tests/factories/hours';
import type { HoursCalendarIndex } from '../../types';

const staffMember: StaffReference = {
  id: 'staff-1',
  firstName: 'Zoe',
  lastName: 'Wilson',
  name: 'Zoe Wilson',
  role: 'staff',
  writable: true,
};
const coworker: StaffReference = {
  id: 'staff-2',
  firstName: 'Alex',
  lastName: 'Morgan',
  name: 'Alex Morgan',
  role: 'staff',
  writable: false,
};

type CalendarProps = TimelineCalendarProps<StaffReference, Hours>;
const calendarState = vi.hoisted(() => ({ props: null as CalendarProps | null }));

vi.mock('../../../../../common/components/TimelineCalendar/TimelineCalendar', () => ({
  default: (props: CalendarProps) => {
    calendarState.props = props;
    return (
      <div aria-label="Staff hours calendar">
        {props.rows.map((item, index) => (
          <div key={item.id}>{props.renderRow({ row: item, index })}</div>
        ))}
      </div>
    );
  },
}));

vi.mock('../../hours.api', () => ({
  getHoursCalendarData: vi.fn(),
}));

/**
 * Builds a complete regular-hours row with scenario-specific values.
 * @example buildItem({ hours: 3 }) // regular entry with three hours
 */
function buildItem(overrides: Partial<Hours> = {}): Hours {
  return makeHoursItem({
    id: 'entry-1',
    programId: 'program-1',
    program: 'Soft Skills',
    category: 'program_delivery',
    categoryLabel: 'Program Delivery',
    hours: 2,
    note: 'Workshop',
    ...overrides,
  });
}

/**
 * Mounts the Hours calendar with domain filters, staff, and command spies.
 * @example renderCalendar({ canWrite: false }) // read-only calendar and its callbacks
 */
function renderCalendar({
  data = [],
  staff = [staffMember],
  staffIds = [],
  search = '',
  filters = {},
  canWrite = true,
  onAdd = vi.fn(),
  onEdit = vi.fn(),
  onDelete = vi.fn(),
  onStaffSelect = vi.fn(),
  onMove = vi.fn().mockResolvedValue(undefined),
}: {
  data?: Hours[];
  staff?: StaffReference[];
  staffIds?: string[];
  search?: string;
  filters?: Partial<HoursFilters>;
  canWrite?: boolean;
  onAdd?: ReturnType<typeof vi.fn>;
  onEdit?: ReturnType<typeof vi.fn>;
  onDelete?: ReturnType<typeof vi.fn>;
  onStaffSelect?: ReturnType<typeof vi.fn>;
  onMove?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.mocked(getHoursCalendarData).mockResolvedValue(data);
  const calendarIndexRef: MutableRefObject<HoursCalendarIndex | null> = { current: null };
  const result = renderWithQueryClient(
      <HoursCalendar
        staff={staff}
        filters={{ staffIds, categories: [], programIds: [], types: [], cycleIds: ['cycle-1'], search, ...filters }}
        canWrite={canWrite}
        actions={{
          isItemPending: () => false,
          add: onAdd,
          edit: onEdit,
          requestDelete: onDelete,
          move: onMove,
        }}
        selectedStaffId="staff-1"
        calendarIndexRef={calendarIndexRef}
        onStaffSelect={onStaffSelect}
      />
  );
  return {
    ...result,
    calendarIndexRef,
    onAdd,
    onEdit,
    onDelete,
    onStaffSelect,
    onMove,
  };
}

/**
 * Supplies the initial visible periods and waits for the domain range request.
 * @example await initializeCalendar(periods) // request inputs are ready to inspect
 */
async function initializeCalendar(periods: CalendarPeriod[]) {
  act(() => calendarState.props?.onInitialPeriods?.(periods));
  await waitFor(() => expect(getHoursCalendarData).toHaveBeenCalled());
}

describe('HoursCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calendarState.props = null;
  });

  it('removes a moved or saved entry when its resolved cycle is outside the active selection', async () => {
    const { calendarIndexRef } = renderCalendar({ filters: { cycleIds: ['cycle-1', 'cycle-3'] } });
    const item = buildItem({ cycleId: 'cycle-1', date: '2026-08-10' });
    act(() => {
      calendarIndexRef.current!.upsert(item);
    });
    await waitFor(() => expect(calendarState.props!.items).toEqual({ 'staff-1': [item] }));

    act(() => calendarIndexRef.current!.upsert({ ...item, date: '2026-08-11', cycleId: 'cycle-2' }));
    expect(calendarState.props!.items?.[item.staffId] ?? []).toEqual([]);
  });

  it('filters staff and restricts dragging and cell actions by entry source', () => {
    const onAdd = vi.fn();
    renderCalendar({ staff: [staffMember, coworker], staffIds: ['staff-1'], onAdd });
    const props = calendarState.props!;
    const periods = buildInitialDayPeriods('2026-08-10', 3);
    const regularItem = buildItem();
    const sessionItem = buildItem({ sessionId: 'session-1', sessionTitle: 'Confidence' });

    expect(props.rows).toEqual([staffMember]);
    expect(props.selectedRowId).toBe('staff-1');
    expect(props.getItemCapabilities?.({
      row: staffMember,
      data: regularItem,
      range: { start: periods[1].key, end: periods[1].key },
    })).toEqual({ draggable: true });
    expect(props.getItemCapabilities?.({
      row: staffMember,
      data: sessionItem,
      range: { start: periods[1].key, end: periods[1].key },
    })).toEqual({ draggable: false });

    const actions = props.getCellActions?.({
      row: staffMember,
      rowIndex: 0,
      period: periods[1],
      items: [],
    });
    actions?.find(action => action.id === 'regular')?.onSelect();
    expect(onAdd).toHaveBeenCalledWith({
      staffId: 'staff-1',
      date: periods[1].key,
      type: 'regular',
    });
  });

  it('loads the initialized range with all page filters and adapts the returned records for display', async () => {
    const periods = buildInitialDayPeriods('2026-08-10', 3);
    const item = buildItem({ date: periods[1].key });
    renderCalendar({
      data: [item],
      search: 'workshop',
      filters: { staffIds: ['staff-1'], categories: ['program_delivery'], programIds: ['program-1'], types: ['regular'],
        dateRange: { start: '2026-08-01', end: '2026-08-31' } },
    });

    await initializeCalendar(periods);

    expect(calendarState.props?.dateRange).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(getHoursCalendarData).toHaveBeenCalledWith({
      staffIds: ['staff-1'], categories: ['program_delivery'], programIds: ['program-1'],
      types: ['regular'], cycleIds: ['cycle-1'], search: 'workshop',
      dateRange: { start: '2026-08-01', end: '2026-08-31' },
    }, {
      start: expect.any(String),
      end: expect.any(String),
    }, { signal: expect.any(AbortSignal) });
    await waitFor(() => expect(calendarState.props?.items).toEqual({ 'staff-1': [item] }));
  });

  it('clears the page-owned mutation callbacks when the calendar unmounts', () => {
    const { calendarIndexRef, unmount } = renderCalendar();
    expect(calendarIndexRef.current).not.toBeNull();

    unmount();

    expect(calendarIndexRef.current).toBeNull();
  });

  it('translates a calendar drop into the page-owned move action', async () => {
    const periods = buildInitialDayPeriods('2026-08-10', 3);
    const item = buildItem({ date: periods[1].key });
    const onMove = vi.fn().mockResolvedValue(undefined);
    const rendered = renderCalendar({
      data: [item],
      onMove,
    });
    await initializeCalendar(periods);

    await act(async () => calendarState.props?.onItemMove?.({
      row: staffMember,
      destinationRow: staffMember,
      item: item,
      originalRange: { start: periods[1].key, end: periods[1].key },
      nextRange: { start: periods[2].key, end: periods[2].key },
    }));

    expect(rendered.onMove).toHaveBeenCalledWith(item, periods[2].key);
  });

  it('removes calendar mutation callbacks in read-only mode', () => {
    renderCalendar({ canWrite: false });
    const props = calendarState.props!;
    const periods = buildInitialDayPeriods('2026-08-10', 3);

    expect(props.onItemMove).toBeUndefined();
    expect(props.getCellActions).toBeUndefined();
    const entry = buildItem();
    const data = entry;
    const range = { start: periods[1].key, end: periods[1].key };
    expect(props.getItemCapabilities?.({ row: staffMember, data, range })).toEqual({ draggable: false });
    const item = props.buildItem({
      row: staffMember,
      data,
      range,
      calendar: makeItemCalendarProps({ row: staffMember, data, range }),
      visibleStart: periods[1],
      visibleEnd: periods[1],
    });
    render(<>{item}</>);
    fireEvent.click(screen.getByRole('button', { name: /Program Delivery, 2 hours/ }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows a load error and retries the failed calendar range', async () => {
    const periods = buildInitialDayPeriods('2026-08-10', 3);
    vi.mocked(getHoursCalendarData)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([]);
    renderCalendar();

    act(() => calendarState.props?.onInitialPeriods?.(periods));
    expect(await screen.findByText('Hours calendar unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByLabelText('Staff hours calendar')).toBeInTheDocument();
    expect(screen.queryByText('Hours calendar unavailable')).not.toBeInTheDocument();
  });
});
