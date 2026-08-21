// Scope: verifies Hours calendar data, capabilities, and domain action wiring.
import type { MutableRefObject } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HoursCalendar from './HoursCalendar';

import { buildInitialDayPeriods } from '../../../../../common/components/ResourceCalendar/periods/periods';
import type {
  CalendarPeriod,
  ResourceCalendarProps,
  ResourcePeriodData,
} from '../../../../../common/components/ResourceCalendar/types';
import {
  getHours,
} from '../../../../../common/features/hours/hours.api';
import type { StaffResource, HoursItem } from '../../../../../common/features/hours/types';
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

type CalendarProps = ResourceCalendarProps<StaffResource, HoursItem>;
const calendarState = vi.hoisted(() => ({ props: null as CalendarProps | null }));

vi.mock('../../../../../common/components/ResourceCalendar/ResourceCalendar', () => ({
  default: (props: CalendarProps) => {
    calendarState.props = props;
    return (
      <div aria-label="Staff hours calendar">
        {props.resources.map((item, index) => (
          <div key={item.id}>{props.renderResource({ resource: item, index })}</div>
        ))}
      </div>
    );
  },
}));

vi.mock('../../../../../common/features/hours/hours.api', () => ({
  getHours: vi.fn(),
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
  canWrite = true,
  onAdd = vi.fn(),
  onEdit = vi.fn(),
  onDelete = vi.fn(),
  onStaffSelect = vi.fn(),
  onMove = vi.fn().mockResolvedValue(undefined),
}: {
  data?: ResourcePeriodData<HoursItem>;
  resources?: StaffResource[];
  staffIds?: string[];
  canWrite?: boolean;
  onAdd?: ReturnType<typeof vi.fn>;
  onEdit?: ReturnType<typeof vi.fn>;
  onDelete?: ReturnType<typeof vi.fn>;
  onStaffSelect?: ReturnType<typeof vi.fn>;
  onMove?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.mocked(getHours).mockResolvedValue({ resources, programs: [], data });
  const calendarCacheRef: MutableRefObject<HoursCalendarCache> = {
    current: { upsert: vi.fn(), remove: vi.fn() },
  };
  const result = render(
      <HoursCalendar
        resources={resources}
        staffIds={staffIds}
        categories={[]}
        programIds={[]}
        types={[]}
        cycleId="cycle-1"
        canWrite={canWrite}
        isEntryPending={() => false}
        moveError={null}
        selectedStaffId="staff-1"
        calendarCacheRef={calendarCacheRef}
        onStaffSelect={onStaffSelect}
        onEdit={onEdit}
        onDelete={onDelete}
        onAdd={onAdd}
        onMove={onMove}
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
  };
}

async function initializeCalendar(periods: CalendarPeriod[]) {
  act(() => calendarState.props?.onInitialPeriods?.(periods));
  await waitFor(() => expect(getHours).toHaveBeenCalled());
}

describe('HoursCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calendarState.props = null;
  });

  it('configures resources, item density, capabilities, and cell actions', () => {
    const onAdd = vi.fn();
    renderCalendar({ resources: [resource, coworker], staffIds: ['staff-1'], onAdd });
    const props = calendarState.props!;
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    const regularItem = buildItem();
    const sessionItem = buildItem({ sessionId: 'session-1', sessionLabel: 'Confidence' });

    expect(props.resources).toEqual([resource]);
    expect(props.rowHeight).toBe(112);
    expect(props.maxVisibleItemsPerCell).toBe(7);
    expect(props.positionStorageKey).toBe('resource-calendar:hours:position');
    expect(props.selectedResourceId).toBe('staff-1');
    expect(props.getItemCapabilities?.({ resource, period: periods[1], data: regularItem })).toEqual({ draggable: true });
    expect(props.getItemCapabilities?.({ resource, period: periods[1], data: sessionItem })).toEqual({ draggable: false });

    const actions = props.getCellActions?.({
      resource,
      resourceIndex: 0,
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

  it('loads the initialized calendar range and exposes it through the calendar data prop', async () => {
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    const item = buildItem();
    renderCalendar({ data: { 'staff-1': { [periods[1].key]: [item] } } });

    await initializeCalendar(periods);

    expect(getHours).toHaveBeenCalledWith({
      start: expect.any(String),
      end: expect.any(String),
    });
    await waitFor(() => expect(calendarState.props?.data['staff-1'][periods[1].key]).toEqual([item]));
  });

  it('closes overflow before emitting an edit target', async () => {
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    const item = buildItem();
    const close = vi.fn();
    const onEdit = vi.fn();
    renderCalendar({ onEdit });
    const overflowItem = calendarState.props?.buildOverflowItem?.(
      { resource, period: periods[1], data: item },
      { close },
    );
    render(<>{overflowItem}</>);

    fireEvent.click(screen.getByRole('button', { name: /Program Delivery, 2 hours/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(close).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith({ resourceId: 'staff-1', date: periods[1].key, item });
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

    await act(async () => calendarState.props?.onItemDrop?.({
      item,
      source: { resource, period: periods[1] },
      destination: { resource, period: periods[2] },
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

    expect(props.onItemDrop).toBeUndefined();
    expect(props.getCellActions).toBeUndefined();
    expect(props.getItemCapabilities?.({ resource, period: periods[1], data: buildItem() })).toEqual({ draggable: false });
    const item = props.buildItem({ resource, period: periods[1], data: buildItem() });
    render(<>{item}</>);
    fireEvent.click(screen.getByRole('button', { name: /Program Delivery, 2 hours/ }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows a load error and retries the failed calendar range', async () => {
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    vi.mocked(getHours)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ resources: [resource], programs: [], data: {} });
    renderCalendar();

    act(() => calendarState.props?.onInitialPeriods?.(periods));
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(getHours).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
