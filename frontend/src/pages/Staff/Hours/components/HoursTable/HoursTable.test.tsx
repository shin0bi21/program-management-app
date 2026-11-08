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
  retry: vi.fn(),
}));
const useHoursTableData = vi.hoisted(() => vi.fn(() => tableState));

vi.mock('./hooks/useHoursTableData', () => ({ default: useHoursTableData }));
vi.mock('../../../../../common/components/Table/Table', () => ({ default: () => null }));

const baseProps = {
  records: {},
  queryKey: ['hours', 'table'] as const,
  columns: [],
  hiddenColumnKeys: [],
  filters: {
    staffIds: ['staff-1'],
    categories: ['meeting' as const],
    programIds: ['program-1'],
    types: ['regular' as const],
    cycleIds: ['cycle-1'],
    search: '',
  },
  sorting: { key: 'date' as const, direction: 'desc' as const },
  columnWidths: {},
  selectedRowId: null,
  onRowSelect: vi.fn(),
  onSortingChange: vi.fn(),
  onColumnWidthsChange: vi.fn(),
  onMessageChange: vi.fn(),
};

describe('HoursTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(tableState, {
      rows: [], loading: false, refreshing: false, error: null,
      hasNextPage: false, loadingNextPage: false,
    });
  });

  it('reports table-data errors with a retry action', () => {
    tableState.error = 'Could not load hours.';
    render(<HoursTable {...baseProps} filters={{ ...baseProps.filters, search: 'planning' }} />);

    expect(baseProps.onMessageChange).toHaveBeenLastCalledWith({
      message: 'Could not load hours.',
      action: { label: 'Retry', onClick: tableState.retry },
    });
  });
});
