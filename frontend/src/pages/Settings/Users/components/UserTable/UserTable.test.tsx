import type { ComponentProps } from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Table from '../../../../../common/components/Table/Table';
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
const tableProps = vi.hoisted(() => ({ current: null as ComponentProps<typeof Table<User>> | null }));

vi.mock('./hooks/useUserTableData', () => ({ default: useTableData }));
vi.mock('../../../../../common/components/Table/Table', () => ({
  default: (props: ComponentProps<typeof Table<User>>) => {
    tableProps.current = props;
    return <div aria-label="Mock account table" />;
  },
}));

const queryKey = ['accounts', 'table'] as const;
const filters: UserFilters = { search: 'sam', roles: ['staff'], statuses: ['active'] };
const sorting = { key: 'name' as const, direction: 'asc' as const };
const onSortingChange = vi.fn();
const onColumnWidthsChange = vi.fn();
const onErrorChange = vi.fn();
const baseProps = {
  queryKey,
  filters,
  columns: [],
  hiddenColumnKeys: ['createdAt'],
  sorting,
  columnWidths: { name: 240 },
  onSortingChange,
  onColumnWidthsChange,
  onErrorChange,
};

describe('UserTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(tableState, {
      rows: [], loading: false, refreshing: false, error: '',
      hasNextPage: false, loadingNextPage: false, nextPageError: '',
    });
    tableProps.current = null;
  });

  it('passes query inputs and loaded table state to the shared table', () => {
    const user: User = {
      id: 'user-1', firstName: 'Sam', lastName: 'Rivera', email: 'sam@example.com',
      role: 'staff', status: 'active', createdAt: '2026-01-01T00:00:00.000Z',
    };
    Object.assign(tableState, {
      rows: [user], loading: false, refreshing: true,
      hasNextPage: true, loadingNextPage: true,
    });
    render(<UserTable {...baseProps} />);

    expect(useTableData).toHaveBeenCalledWith(queryKey, filters, sorting);
    expect(tableProps.current).toEqual(expect.objectContaining({
      ariaLabel: 'Accounts',
      data: [user],
      loading: false,
      refreshing: true,
      emptyMessage: 'No accounts match these filters',
      hiddenColumnKeys: ['createdAt'],
      sorting,
      sortableColumns: ['name', 'email', 'role', 'status', 'createdAt'],
      columnWidths: { name: 240 },
      onColumnWidthsChange,
      hasNextPage: true,
      loadingNextPage: true,
      onLoadNextPage: tableState.loadNextPage,
      unavailable: undefined,
    }));

    tableProps.current?.onSortingChange?.({ key: 'email', direction: 'desc' });
    expect(onSortingChange).toHaveBeenCalledWith({ key: 'email', direction: 'desc' });
  });

  it('routes next-page failure recovery to the footer and page overlay while retaining rows', () => {
    tableState.nextPageError = 'Unable to load more accounts.';
    render(<UserTable {...baseProps} />);

    expect(tableProps.current?.unavailable).toBeUndefined();
    expect(tableProps.current?.data).toBe(tableState.rows);
    expect(tableProps.current?.nextPageUnavailable).toEqual({ onRetry: tableState.retryNextPage });
    expect(onErrorChange).toHaveBeenLastCalledWith({
      message: 'Unable to load more accounts.',
      action: { label: 'Retry', onClick: tableState.retryNextPage },
    });
  });

  it('maps query failures to the unavailable state and page error retry action', () => {
    tableState.error = 'Unable to load accounts.';
    render(<UserTable {...baseProps} />);

    expect(tableProps.current).toEqual(expect.objectContaining({
      unavailable: { title: 'Accounts unavailable', onRetry: tableState.retry },
    }));
    expect(onErrorChange).toHaveBeenLastCalledWith({
      message: 'Unable to load accounts.',
      action: { label: 'Retry', onClick: tableState.retry },
    });
  });
});
