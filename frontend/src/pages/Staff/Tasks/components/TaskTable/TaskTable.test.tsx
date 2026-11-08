import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TaskTable from './TaskTable';

const tableState = vi.hoisted(() => ({
  rows: [], loading: false, refreshing: false, error: null as string | null,
  hasNextPage: false, loadingNextPage: false, loadNextPage: vi.fn(),
  retry: vi.fn(),
}));
const useTaskTableData = vi.hoisted(() => vi.fn(() => tableState));
const tableMessage = vi.hoisted(() => ({ current: undefined as string | undefined }));

vi.mock('./hooks/useTaskTableData', () => ({ default: useTaskTableData }));
vi.mock('../../../../../common/components/Table/Table', () => ({
  default: ({ emptyMessage }: { emptyMessage?: string }) => {
    tableMessage.current = emptyMessage;
    return null;
  },
}));

const baseProps = {
  records: {},
  queryKey: ['tasks', 'table'] as const,
  today: '2026-08-11',
  columns: [], hiddenColumnKeys: [],
  filters: { cycleIds: [], staffIds: [], programIds: [], categories: [], statuses: [], search: '' },
  sorting: { key: 'dueDate' as const, direction: 'asc' as const }, columnWidths: {}, selectedTaskId: null,
  onTaskSelect: vi.fn(), onSortingChange: vi.fn(), onColumnWidthsChange: vi.fn(),
  onMessageChange: vi.fn(),
};

describe('TaskTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(tableState, { rows: [], loading: false, refreshing: false, error: null });
    tableMessage.current = undefined;
  });

  it('chooses the empty message from the applied filters', () => {
    const { rerender } = render(<TaskTable {...baseProps} />);
    expect(tableMessage.current).toBe('No tasks assigned');

    rerender(<TaskTable {...baseProps} filters={{ ...baseProps.filters, search: 'missing' }} />);
    expect(tableMessage.current).toBe('No tasks match these filters');
  });
});
