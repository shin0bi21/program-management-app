// Scope: verifies Youth table state, pagination, selection, and preference wiring.
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import YouthTable from './YouthTable';

const tableProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const youthTableData = vi.hoisted(() => ({
  rows: [] as ReturnType<typeof makeYouthProfile>[],
  loading: false,
  refreshing: false,
  error: null as string | null,
  hasNextPage: false,
  loadingNextPage: false,
  loadNextPage: vi.fn(),
}));

vi.mock('./hooks/useYouthTableData', () => ({
  default: () => youthTableData,
}));

vi.mock('../../../../common/components/Table/Table', () => ({
  default: (props: Record<string, unknown>) => {
    tableProps.current = props;
    return <div aria-label="Mock youth table" />;
  },
}));

describe('YouthTable', () => {
  it('passes page-owned state and callbacks to the shared table', () => {
    const profile = makeYouthProfile();
    const onRowSelect = vi.fn();
    const onSortingChange = vi.fn();
    const onColumnWidthsChange = vi.fn();
    const onSelectedProfileResolved = vi.fn();
    youthTableData.rows = [profile];
    youthTableData.refreshing = true;
    youthTableData.hasNextPage = true;

    render(<YouthTable
      columns={[]}
      filters={{ search: '', statuses: [], programIds: [] }}
      hiddenColumnKeys={['school']}
      sorting={{ key: 'firstName', direction: 'asc' }}
      columnWidths={{ firstName: 180 }}
      selectedProfileId={profile.id}
      hasActiveQueryFilters
      onSelectedProfileResolved={onSelectedProfileResolved}
      onRowSelect={onRowSelect}
      onSortingChange={onSortingChange}
      onColumnWidthsChange={onColumnWidthsChange}
    />);

    expect(tableProps.current).toEqual(expect.objectContaining({
      ariaLabel: 'Youth profiles',
      data: [profile],
      refreshing: true,
      emptyMessage: 'No youth profiles match these filters',
      hiddenColumnKeys: ['school'],
      selectedKey: profile.id,
      onRowSelect,
      columnWidths: { firstName: 180 },
      onColumnWidthsChange,
      hasNextPage: true,
      onLoadNextPage: youthTableData.loadNextPage,
    }));
    expect(onSelectedProfileResolved).toHaveBeenCalledWith(profile);

    (tableProps.current?.onSortingChange as (sorting: unknown) => void)({ key: 'lastName', direction: 'desc' });
    expect(onSortingChange).toHaveBeenCalledWith({ key: 'lastName', direction: 'desc' });
  });
});
