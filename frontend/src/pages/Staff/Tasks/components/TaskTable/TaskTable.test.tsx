// Owns task-table query wiring, table state, empty messaging, and pagination ownership.
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TaskTable from './TaskTable';

const tableState = vi.hoisted(() => ({
  rows: [], loading: false, refreshing: false, error: null as string | null,
  hasNextPage: false, loadingNextPage: false, loadNextPage: vi.fn(),
  retry: vi.fn(),
}));
const useTaskTableData = vi.hoisted(() => vi.fn(() => tableState));
const tableProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('./hooks/useTaskTableData', () => ({ default: useTaskTableData }));
vi.mock('../../../../../common/components/Table/Table', () => ({
  default: (props: Record<string, unknown>) => {
    tableProps.current = props;
    return <div aria-label="Mock task table" />;
  },
}));

const baseProps = {
  queryKey: ['tasks', 'table'] as const,
  today: '2026-08-11',
  columns: [], hiddenColumnKeys: [],
  filters: { staffIds: [], programIds: [], categories: [], statuses: [], search: '' },
  sorting: { key: 'dueDate' as const, direction: 'asc' as const }, columnWidths: {}, selectedTaskId: null,
  onTaskSelect: vi.fn(), onSortingChange: vi.fn(), onColumnWidthsChange: vi.fn(),
  onErrorChange: vi.fn(),
};

describe('TaskTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(tableState, { rows: [], loading: false, refreshing: false, error: null });
    tableProps.current = null;
  });

  it('wires page controls and query state into the table', () => {
    const filters = { ...baseProps.filters, staffIds: ['staff-1'], statuses: ['active' as const] };
    render(<TaskTable {...baseProps} filters={filters} />);

    expect(useTaskTableData).toHaveBeenCalledWith(
      baseProps.queryKey,
      filters,
      baseProps.sorting,
      baseProps.today,
    );
    expect(tableProps.current).toEqual(expect.objectContaining({
      ariaLabel: 'Tasks',
      data: [],
      loading: false,
      refreshing: false,
      emptyMessage: 'No tasks match these filters',
      selectedKey: null,
      onRowSelect: baseProps.onTaskSelect,
      sorting: baseProps.sorting,
      columnWidths: baseProps.columnWidths,
      onColumnWidthsChange: baseProps.onColumnWidthsChange,
      hasNextPage: false,
      loadingNextPage: false,
      onLoadNextPage: tableState.loadNextPage,
    }));

    (tableProps.current?.onSortingChange as (value: unknown) => void)({ key: 'title', direction: 'asc' });
    expect(baseProps.onSortingChange).toHaveBeenCalledWith({ key: 'title', direction: 'asc' });
  });

  it('distinguishes unfiltered, filtered, and failed empty states', () => {
    const { rerender } = render(<TaskTable {...baseProps} />);
    expect(tableProps.current).toEqual(expect.objectContaining({ emptyMessage: 'No tasks assigned' }));

    tableState.error = 'Unable to load tasks.';
    rerender(<TaskTable {...baseProps} filters={{ ...baseProps.filters, search: 'missing' }} />);
    expect(tableProps.current).toEqual(expect.objectContaining({
      emptyMessage: 'No tasks match these filters',
      unavailable: { title: 'Tasks unavailable', onRetry: tableState.retry },
    }));
    expect(baseProps.onErrorChange).toHaveBeenLastCalledWith({
      message: 'Unable to load tasks.',
      action: { label: 'Retry', onClick: tableState.retry },
    });
  });
});
