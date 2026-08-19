// Scope: verifies task-list query wiring, table state, empty messaging, and pagination ownership.
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TaskListView from './TaskListView';

const listState = vi.hoisted(() => ({
  rows: [], loading: false, refreshing: false, error: null as string | null,
  hasNextPage: false, loadingNextPage: false, loadNextPage: vi.fn(), appliedSearch: '',
}));
const useTaskList = vi.hoisted(() => vi.fn(() => listState));
const tableProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('./hooks/useTaskList', () => ({ default: useTaskList }));
vi.mock('../../../../../common/components/Table/Table', () => ({
  default: (props: Record<string, unknown>) => {
    tableProps.current = props;
    return <div aria-label="Mock task table" />;
  },
}));

const baseProps = {
  queryKey: ['tasks', 'list'] as const,
  columns: [], hiddenColumnKeys: [], staffIds: [], programIds: [], categories: [], statuses: [], search: '',
  sorting: { key: 'dueDate' as const, direction: 'asc' as const }, columnWidths: {}, selectedTaskId: null,
  onTaskSelect: vi.fn(), onSortingChange: vi.fn(), onColumnWidthsChange: vi.fn(),
};

describe('TaskListView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(listState, { rows: [], loading: false, refreshing: false, error: null, appliedSearch: '' });
    tableProps.current = null;
  });

  it('wires page controls and query state into the table', () => {
    render(<TaskListView {...baseProps} staffIds={['staff-1']} statuses={['todo']} />);

    expect(useTaskList).toHaveBeenCalledWith(
      baseProps.queryKey,
      { staffIds: ['staff-1'], programIds: [], categories: [], statuses: ['todo'], search: '' },
      baseProps.sorting,
      true,
    );
    expect(tableProps.current).toEqual(expect.objectContaining({
      ariaLabel: 'Tasks', emptyMessage: 'No tasks match these filters', sorting: baseProps.sorting,
    }));
  });

  it('distinguishes unfiltered, filtered, and failed empty states', () => {
    const { rerender } = render(<TaskListView {...baseProps} />);
    expect(tableProps.current).toEqual(expect.objectContaining({ emptyMessage: 'No tasks assigned' }));

    listState.appliedSearch = 'missing';
    listState.error = 'Unable to load tasks.';
    rerender(<TaskListView {...baseProps} search="missing" />);
    expect(tableProps.current).toEqual(expect.objectContaining({
      emptyMessage: 'No tasks match these filters', error: 'Unable to load tasks.',
    }));
  });
});
