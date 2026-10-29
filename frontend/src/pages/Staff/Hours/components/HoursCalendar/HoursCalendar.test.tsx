import { makeItemCalendarProps } from '../../../../../tests/factories/calendarItem';
import type { MutableRefObject } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HoursCalendar, { type HoursCalendarItem } from './HoursCalendar';

import { buildInitialDayPeriods } from '../../../../../common/components/TimelineCalendar/utils/periods';
import type {
  CalendarPeriod,
  TimelineCalendarProps,
  RowPeriodData,
} from '../../../../../common/components/TimelineCalendar/types';
import {
  getHoursCalendarData,
} from '../../hours.api';
import type { StaffResource, HoursItem, HoursFilters } from '../../types';
import { makeHoursItem } from '../../../../../tests/factories/hours';
import type { HoursCalendarCache } from '../../types';

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

type CalendarProps = TimelineCalendarProps<StaffResource, HoursCalendarItem>;
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
    programName: 'Soft Skills',
    category: 'program_delivery',
    categoryLabel: 'Program Delivery',
    hours: 2,
    note: 'Workshop',
    ...overrides,
  });
}

function renderCalendar({
  data = {},
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
  onMessageChange = vi.fn(),
}: {
  data?: RowPeriodData<HoursItem>;
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
  onMessageChange?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.mocked(getHoursCalendarData).mockResolvedValue(data);
  const calendarCacheRef: MutableRefObject<HoursCalendarCache> = {
    current: { upsert: vi.fn(), remove: vi.fn() },
  };
  const result = render(
      <HoursCalendar
        resources={resources}
        filters={{ staffIds, categories: [], programIds: [], types: [], cycleIds: ['cycle-1'], search, ...filters }}
        canWrite={canWrite}
        isEntryPending={() => false}
        selectedStaffId="staff-1"
        calendarCacheRef={calendarCacheRef}
        onStaffSelect={onStaffSelect}
        onEdit={onEdit}
        onDelete={onDelete}
        onAdd={onAdd}
        onMove={onMove}
        onMessageChange={onMessageChange}
      />
  );
  return {
    ...result,
    calendarCacheRef,
    onAdd,
    onEdit,
    onDelete,
    onStaffSelect,
    onMove,
    onMessageChange,
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

  it('removes a moved or saved entry when its resolved cycle is outside the active selection', () => {
    const { calendarCacheRef } = renderCalendar({ filters: { cycleIds: ['cycle-1', 'cycle-3'] } });
    const item = buildItem({ cycleId: 'cycle-1' });
    act(() => calendarCacheRef.current.upsert(resource.id, '2026-08-10', item));
    expect(calendarState.props!.items[resource.id]).toEqual([{ date: '2026-08-10', item }]);

    act(() => calendarCacheRef.current.upsert(resource.id, '2026-08-11', { ...item, cycleId: 'cycle-2' }));
    expect(calendarState.props!.items[resource.id] ?? []).toEqual([]);
  });

  it('configures resources, item density, capabilities, and cell actions', () => {
    const onAdd = vi.fn();
    renderCalendar({ resources: [resource, coworker], staffIds: ['staff-1'], onAdd });
    const props = calendarState.props!;
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    const regularItem = buildItem();
    const sessionItem = buildItem({ sessionId: 'session-1', sessionLabel: 'Confidence' });

    expect(props.rows).toEqual([resource]);
    expect(props.rowHeight).toBe(112);
    expect(props.positionStorageKey).toBe('resource-calendar:hours:position');
    expect(props.selectedRowId).toBe('staff-1');
    expect(props.getItemCapabilities?.({
      row: resource,
      data: { date: periods[1].key, item: regularItem },
      range: { start: periods[1].key, end: periods[1].key },
    })).toEqual({ draggable: true });
    expect(props.getItemCapabilities?.({
      row: resource,
      data: { date: periods[1].key, item: sessionItem },
      range: { start: periods[1].key, end: periods[1].key },
    })).toEqual({ draggable: false });

    const actions = props.getCellActions?.({
      row: resource,
      rowIndex: 0,
      period: periods[1],
      items: [],
    });
    expect(actions?.map(action => action.label)).toEqual(['Session Hours', 'Task Hours', 'Regular Hours']);
    actions?.find(action => action.id === 'regular')?.onSelect();
    expect(onAdd).toHaveBeenCalledWith({
      resourceId: 'staff-1',
      date: periods[1].key,
      source: 'regular',
    });
  });

  it('loads the initialized range with all page filters and adapts the returned records for display', async () => {
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    const item = buildItem();
    renderCalendar({
      data: { 'staff-1': { [periods[1].key]: [item] } },
      search: 'workshop',
      filters: { staffIds: ['staff-1'], categories: ['program_delivery'], programIds: ['program-1'], types: ['other'],
        dateRange: { start: '2026-08-01', end: '2026-08-31' } },
    });

    await initializeCalendar(periods);

    expect(calendarState.props?.dateRange).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(getHoursCalendarData).toHaveBeenCalledWith({
      staffIds: ['staff-1'], categories: ['program_delivery'], programIds: ['program-1'],
      types: ['other'], cycleIds: ['cycle-1'], search: 'workshop',
      dateRange: { start: '2026-08-01', end: '2026-08-31' },
    }, {
      start: expect.any(String),
      end: expect.any(String),
    });
    await waitFor(() => expect(calendarState.props?.items['staff-1']).toEqual([
      { date: periods[1].key, item },
    ]));
  });

  it('translates a calendar drop into the page-owned move action', async () => {
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    const item = buildItem();
    const onMove = vi.fn().mockResolvedValue(undefined);
    const rendered = renderCalendar({
      data: { 'staff-1': { [periods[1].key]: [item] } },
      onMove,
    });
    await initializeCalendar(periods);

    await act(async () => calendarState.props?.onItemMove?.({
      row: resource,
      destinationRow: resource,
      item: { date: periods[1].key, item },
      originalRange: { start: periods[1].key, end: periods[1].key },
      nextRange: { start: periods[2].key, end: periods[2].key },
    }));

    expect(rendered.onMove).toHaveBeenCalledWith({
      item,
      source: { resourceId: 'staff-1', date: periods[1].key },
      destination: { resourceId: 'staff-1', date: periods[2].key },
    });
  });

  it('removes calendar mutation callbacks in read-only mode', () => {
    renderCalendar({ canWrite: false });
    const props = calendarState.props!;
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);

    expect(props.onItemMove).toBeUndefined();
    expect(props.getCellActions).toBeUndefined();
    const entry = buildItem();
    const data = { date: periods[1].key, item: entry };
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
      .mockResolvedValueOnce({});
    const { onMessageChange } = renderCalendar();

    act(() => calendarState.props?.onInitialPeriods?.(periods));
    await waitFor(() => expect(onMessageChange).toHaveBeenLastCalledWith(expect.objectContaining({
      message: 'offline',
      action: expect.objectContaining({ label: 'Retry' }),
    })));
    const reportedError = onMessageChange.mock.calls[onMessageChange.mock.calls.length - 1]?.[0];
    act(() => reportedError.action.onClick());

    await waitFor(() => expect(getHoursCalendarData).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onMessageChange).toHaveBeenLastCalledWith(null));
  });
});
