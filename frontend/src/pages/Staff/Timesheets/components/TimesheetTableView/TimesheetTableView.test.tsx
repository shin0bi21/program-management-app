import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TimesheetTableView from './TimesheetTableView';

const listState = vi.hoisted(() => ({
  rows: [] as Array<{ id: string }>,
  loading: false,
  refreshing: false,
  error: null as string | null,
  hasNextPage: false,
  loadingNextPage: false,
  loadNextPage: vi.fn(),
  appliedSearch: '',
}));
const useTimesheetList = vi.hoisted(() => vi.fn(() => listState));
const tableProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('./hooks/useTimesheetList', () => ({ default: useTimesheetList }));
vi.mock('../../../../../common/components/Table/Table', () => ({
  default: (props: Record<string, unknown>) => {
    tableProps.current = props;
    return <div aria-label="Mock hours table" />;
  },
}));

const baseProps = {
  queryKey: ['time-entries', 'list'] as const,
  columns: [],
  hiddenColumnKeys: [],
  staffIds: ['staff-1'],
  categories: ['meeting' as const],
  programIds: ['program-1'],
  types: ['other' as const],
  cycleId: 'cycle-1',
  search: '',
  sorting: { key: 'date' as const, direction: 'desc' as const },
  columnWidths: {},
  selectedRowId: null,
  onRowSelect: vi.fn(),
  onSortingChange: vi.fn(),
  onColumnWidthsChange: vi.fn(),
};

describe('TimesheetTableView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(listState, {
      rows: [], loading: false, refreshing: false, error: null,
      hasNextPage: false, loadingNextPage: false, appliedSearch: '',
    });
    tableProps.current = null;
  });

  it('passes page controls to its list hook and table boundary', () => {
    render(<TimesheetTableView {...baseProps} />);

    expect(useTimesheetList).toHaveBeenCalledWith(
      baseProps.queryKey,
      {
        staffIds: baseProps.staffIds,
        categories: baseProps.categories,
        programIds: baseProps.programIds,
        types: baseProps.types,
        cycleId: baseProps.cycleId,
        search: baseProps.search,
      },
      baseProps.sorting,
    );
    expect(tableProps.current).toEqual(expect.objectContaining({
      ariaLabel: 'Hours entries',
      data: [],
      loading: false,
      refreshing: false,
      error: undefined,
      hiddenColumnKeys: [],
      selectedKey: null,
      onRowSelect: baseProps.onRowSelect,
      sorting: baseProps.sorting,
      columnWidths: baseProps.columnWidths,
      onColumnWidthsChange: baseProps.onColumnWidthsChange,
      hasNextPage: false,
      loadingNextPage: false,
      onLoadNextPage: listState.loadNextPage,
      emptyMessage: 'No hours match these filters',
    }));

    (tableProps.current?.onLoadNextPage as () => void)();
    expect(listState.loadNextPage).toHaveBeenCalledOnce();
    (tableProps.current?.onSortingChange as (value: unknown) => void)({ key: 'hours', direction: 'asc' });
    expect(baseProps.onSortingChange).toHaveBeenCalledWith({ key: 'hours', direction: 'asc' });
  });

  it('uses the applied search to distinguish an empty search result', () => {
    listState.appliedSearch = 'planning';
    listState.error = 'Could not load hours.';
    render(<TimesheetTableView {...baseProps} search="planning" />);

    expect(tableProps.current).toEqual(expect.objectContaining({
      error: 'Could not load hours.',
      emptyMessage: 'No hours match your search',
    }));
  });

  it('distinguishes cycle-only and unfiltered empty results', () => {
    const noOtherFilters = {
      ...baseProps,
      staffIds: [],
      categories: [],
      programIds: [],
      types: [],
    };
    const { rerender } = render(<TimesheetTableView {...noOtherFilters} />);

    expect(tableProps.current).toEqual(expect.objectContaining({
      emptyMessage: 'No hours for this cycle',
    }));

    rerender(<TimesheetTableView {...noOtherFilters} cycleId={undefined} />);
    expect(tableProps.current).toEqual(expect.objectContaining({
      emptyMessage: 'No hours found',
    }));
  });
});
