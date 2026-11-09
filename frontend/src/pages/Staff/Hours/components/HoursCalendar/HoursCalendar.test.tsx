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
import type { StaffResource, HoursItem, HoursFilters } from '../../types';
import { makeHoursItem } from '../../../../../tests/factories/hours';
import type { HoursCalendarIndex } from '../../types';

const resource: StaffResource = {
  id: 'staff-1',
  firstName: 'Zoe',
  lastName: 'Wilson',
  name: 'Zoe Wilson',
  role: 'staff',
  writable: true,
};
const coworker: StaffResource = {
  id: 'staff-2',
  firstName: 'Alex',
  lastName: 'Morgan',
  name: 'Alex Morgan',
  role: 'staff',
  writable: false,
};

type CalendarProps = TimelineCalendarProps<StaffResource, HoursItem>;
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

function buildItem(overrides: Partial<HoursItem> = {}): HoursItem {
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

function renderCalendar({
  data = [],
  resources = [resource],
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
  data?: HoursItem[];
  resources?: StaffResource[];
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
  const calendarIndexRef: MutableRefObject<HoursCalendarIndex> = {
    current: { upsert: vi.fn(), remove: vi.fn() },
  };
  const result = renderWithQueryClient(
      <HoursCalendar
        resources={resources}
        filters={{ staffIds, categories: [], programIds: [], types: [], cycleIds: ['cycle-1'], search, ...filters }}
        canWrite={canWrite}
        isItemPending={() => false}
        selectedStaffId="staff-1"
        calendarIndexRef={calendarIndexRef}
        onStaffSelect={onStaffSelect}
        onEdit={onEdit}
        onDelete={onDelete}
        onAdd={onAdd}
        onMove={onMove}
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

async function initializeCalendar(periods: CalendarPeriod[]) {
  act(() => calendarState.props?.onInitialPeriods?.(periods));
  await waitFor(() => expect(getHoursCalendarData).toHaveBeenCalled());
}

describe('HoursCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calendarState.props = null;
  });

  it('cancels its range request when unmounted', () => {
    const { unmount } = renderCalendar();
    act(() => calendarState.props?.onInitialPeriods?.(buildInitialDayPeriods(new Date(2026, 7, 10), 1)));
    const signal = vi.mocked(getHoursCalendarData).mock.calls[0][2]?.signal;

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('removes a moved or saved entry when its resolved cycle is outside the active selection', async () => {
    const { calendarIndexRef } = renderCalendar({ filters: { cycleIds: ['cycle-1', 'cycle-3'] } });
    const item = buildItem({ cycleId: 'cycle-1', date: '2026-08-10' });
    act(() => {
      calendarIndexRef.current.upsert(item);
    });
    await waitFor(() => expect(calendarState.props!.items).toEqual({ 'staff-1': [item] }));

    act(() => calendarIndexRef.current.upsert({ ...item, date: '2026-08-11', cycleId: 'cycle-2' }));
    expect(calendarState.props!.items).toEqual({});
  });

  it('filters resources and restricts dragging and cell actions by entry source', () => {
    const onAdd = vi.fn();
    renderCalendar({ resources: [resource, coworker], staffIds: ['staff-1'], onAdd });
    const props = calendarState.props!;
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    const regularItem = buildItem();
    const sessionItem = buildItem({ sessionId: 'session-1', sessionLabel: 'Confidence' });

    expect(props.rows).toEqual([resource]);
    expect(props.selectedRowId).toBe('staff-1');
    expect(props.getItemCapabilities?.({
      row: resource,
      data: regularItem,
      range: { start: periods[1].key, end: periods[1].key },
    })).toEqual({ draggable: true });
    expect(props.getItemCapabilities?.({
      row: resource,
      data: sessionItem,
      range: { start: periods[1].key, end: periods[1].key },
    })).toEqual({ draggable: false });

    const actions = props.getCellActions?.({
      row: resource,
      rowIndex: 0,
      period: periods[1],
      items: [],
    });
    actions?.find(action => action.id === 'regular')?.onSelect();
    expect(onAdd).toHaveBeenCalledWith({
      staffId: 'staff-1',
      date: periods[1].key,
      source: 'regular',
    });
  });

  it('loads the initialized range with all page filters and adapts the returned records for display', async () => {
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
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

  it('updates a buffered row through the mounted calendar callback', async () => {
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    const item = buildItem({ date: periods[1].key });
    const { calendarIndexRef } = renderCalendar({ data: [item] });
    await initializeCalendar(periods);
    await waitFor(() => expect(calendarState.props?.items).toEqual({ 'staff-1': [item] }));

    const saved = { ...item, note: 'Edited from table', hours: 3 };
    act(() => calendarIndexRef.current.upsert(saved));

    await waitFor(() => expect(calendarState.props!.items!['staff-1']![0].note).toBe('Edited from table'));
    expect(calendarState.props!.items!['staff-1']![0]).toEqual(saved);
    expect(getHoursCalendarData).toHaveBeenCalledOnce();
  });

  it('translates a calendar drop into the page-owned move action', async () => {
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    const item = buildItem({ date: periods[1].key });
    const onMove = vi.fn().mockResolvedValue(undefined);
    const rendered = renderCalendar({
      data: [item],
      onMove,
    });
    await initializeCalendar(periods);

    await act(async () => calendarState.props?.onItemMove?.({
      row: resource,
      destinationRow: resource,
      item: item,
      originalRange: { start: periods[1].key, end: periods[1].key },
      nextRange: { start: periods[2].key, end: periods[2].key },
    }));

    expect(rendered.onMove).toHaveBeenCalledWith({
      item,
      date: periods[2].key,
    });
  });

  it('removes calendar mutation callbacks in read-only mode', () => {
    renderCalendar({ canWrite: false });
    const props = calendarState.props!;
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);

    expect(props.onItemMove).toBeUndefined();
    expect(props.getCellActions).toBeUndefined();
    const entry = buildItem();
    const data = entry;
    const range = { start: periods[1].key, end: periods[1].key };
    expect(props.getItemCapabilities?.({ row: resource, data, range })).toEqual({ draggable: false });
    const item = props.buildItem({
      row: resource,
      data,
      range,
      calendar: makeItemCalendarProps({ row: resource, data, range }),
      visibleStart: periods[1],
      visibleEnd: periods[1],
    });
    render(<>{item}</>);
    fireEvent.click(screen.getByRole('button', { name: /Program Delivery, 2 hours/ }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows a load error and retries the failed calendar range', async () => {
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    vi.mocked(getHoursCalendarData)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([]);
    renderCalendar();

    act(() => calendarState.props?.onInitialPeriods?.(periods));
    expect(await screen.findByText('Hours calendar unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(getHoursCalendarData).toHaveBeenCalledTimes(2));
  });
});
