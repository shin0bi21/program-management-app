// Scope: verifies Hours table query-state wiring and domain empty-state copy.
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HoursTable from './HoursTable';

const tableState = vi.hoisted(() => ({
  rows: [] as Array<{ id: string }>,
  loading: false,
  refreshing: false,
  error: null as string | null,
  hasNextPage: false,
  loadingNextPage: false,
  loadNextPage: vi.fn(),
  appliedSearch: '',
}));
const useHoursTableData = vi.hoisted(() => vi.fn(() => tableState));
const tableProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('./hooks/useHoursTableData', () => ({ default: useHoursTableData }));
vi.mock('../../../../../common/components/Table/Table', () => ({
  default: (props: Record<string, unknown>) => {
    tableProps.current = props;
    return <div aria-label="Mock hours table" />;
  },
}));

const baseProps = {
  queryKey: ['hours', 'table'] as const,
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

describe('HoursTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(tableState, {
      rows: [], loading: false, refreshing: false, error: null,
      hasNextPage: false, loadingNextPage: false, appliedSearch: '',
    });
    tableProps.current = null;
  });

  it('passes page controls to its table-data hook and table boundary', () => {
    render(<HoursTable {...baseProps} />);

    expect(useHoursTableData).toHaveBeenCalledWith(
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
      onLoadNextPage: tableState.loadNextPage,
      emptyMessage: 'No hours found',
    }));

    (tableProps.current?.onLoadNextPage as () => void)();
    expect(tableState.loadNextPage).toHaveBeenCalledOnce();
    (tableProps.current?.onSortingChange as (value: unknown) => void)({ key: 'hours', direction: 'asc' });
    expect(baseProps.onSortingChange).toHaveBeenCalledWith({ key: 'hours', direction: 'asc' });
  });

  it('forwards table-data errors while keeping the standard empty message', () => {
    tableState.appliedSearch = 'planning';
    tableState.error = 'Could not load hours.';
    render(<HoursTable {...baseProps} search="planning" />);

    expect(tableProps.current).toEqual(expect.objectContaining({
      error: 'Could not load hours.',
      emptyMessage: 'No hours found',
    }));
  });

  it('uses the standard empty message for cycle-only and unfiltered results', () => {
    const noOtherFilters = {
      ...baseProps,
      staffIds: [],
      categories: [],
      programIds: [],
      types: [],
    };
    const { rerender } = render(<HoursTable {...noOtherFilters} />);

    expect(tableProps.current).toEqual(expect.objectContaining({
      emptyMessage: 'No hours found',
    }));

    rerender(<HoursTable {...noOtherFilters} cycleId={undefined} />);
    expect(tableProps.current).toEqual(expect.objectContaining({
      emptyMessage: 'No hours found',
    }));
  });
});
