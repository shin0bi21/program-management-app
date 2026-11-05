import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User, UserFilters } from '../../types';
import useUserTableData from './hooks/useUserTableData';
import UserTable from './UserTable';

const tableState = vi.hoisted<ReturnType<typeof useUserTableData>>(() => ({
  rows: [] as User[],
  loading: false,
  refreshing: false,
  error: '',
  hasNextPage: false,
  loadingNextPage: false, nextPageError: '', retryNextPage: vi.fn(),
  loadNextPage: vi.fn(),
  retry: vi.fn(),
}));
const useTableData = vi.hoisted(() => vi.fn(() => tableState));

vi.mock('./hooks/useUserTableData', () => ({ default: useTableData }));
vi.mock('../../../../../common/components/Table/Table', () => ({ default: () => null }));

const queryKey = ['accounts', 'table'] as const;
const filters: UserFilters = { search: 'sam', roles: ['staff'], statuses: ['active'] };
const sorting = { key: 'name' as const, direction: 'asc' as const };
const onMessageChange = vi.fn();
const baseProps = {
  queryKey,
  filters,
  columns: [],
  hiddenColumnKeys: ['createdAt'],
  sorting,
  columnWidths: { name: 240 },
  onSortingChange: vi.fn(),
  onColumnWidthsChange: vi.fn(),
  onMessageChange,
};

describe('UserTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(tableState, {
      rows: [], loading: false, refreshing: false, error: '',
      hasNextPage: false, loadingNextPage: false, nextPageError: '',
    });
  });

  it('routes next-page failure recovery to the page overlay', () => {
    tableState.nextPageError = 'Unable to load more accounts.';
    render(<UserTable {...baseProps} />);

    expect(onMessageChange).toHaveBeenLastCalledWith({
      message: 'Unable to load more accounts.',
      action: { label: 'Retry', onClick: tableState.retryNextPage },
    });
  });

  it('maps query failures to the page error retry action', () => {
    tableState.error = 'Unable to load accounts.';
    render(<UserTable {...baseProps} />);

    expect(onMessageChange).toHaveBeenLastCalledWith({
      message: 'Unable to load accounts.',
      action: { label: 'Retry', onClick: tableState.retry },
    });
  });
});
