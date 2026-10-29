import type { ComponentProps } from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Table from '../../../../../common/components/Table/Table';
import type { CohortListFilters, ProgramCohort } from '../../types';
import useCohortTableData from './hooks/useCohortTableData';
import CohortTable from './CohortTable';

const tableState = vi.hoisted<ReturnType<typeof useCohortTableData>>(() => ({
  rows: [] as ProgramCohort[],
  loading: true,
  refreshing: false,
  error: '',
  hasNextPage: false,
  loadingNextPage: false,
  loadNextPage: vi.fn(),
  retry: vi.fn(),
}));
const useTableData = vi.hoisted(() => vi.fn(() => tableState));
const tableProps = vi.hoisted(() => ({ current: null as ComponentProps<typeof Table<ProgramCohort>> | null }));

vi.mock('./hooks/useCohortTableData', () => ({ default: useTableData }));
vi.mock('../../../../../common/components/Table/Table', () => ({
  default: (props: ComponentProps<typeof Table<ProgramCohort>>) => {
    tableProps.current = props;
    return <div aria-label="Mock cohort table" />;
  },
}));

const queryKey = ['cohorts', 'table'] as const;
const filters: CohortListFilters = { programId: 'program-1', search: 'leadership', status: 'active' };
const sorting = { key: 'start' as const, direction: 'desc' as const };
const onRowSelect = vi.fn();
const onSortingChange = vi.fn();
const onColumnWidthsChange = vi.fn();
const onErrorChange = vi.fn();
const baseProps = {
  queryKey,
  filters,
  columns: [],
  hiddenColumnKeys: ['end'],
  sorting,
  columnWidths: { cohort: 220 },
  selectedKey: 'cohort-1',
  onRowSelect,
  onSortingChange,
  onColumnWidthsChange,
  onErrorChange,
};

const cohort: ProgramCohort = {
  id: 'cohort-1', programId: 'program-1', programName: 'Leadership',
  enrollmentRequired: false, minAge: null, maxAge: null, cycleId: 'cycle-1', cycleName: 'Fall',
  name: 'Group A', startsOn: '2026-09-01', endsOn: '2026-12-01', state: 'active',
  enrolledCount: 8, nextSessionAt: null, nextSessionId: null, averageAttendance: null,
  attendanceAttendedCount: 0, attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
};

describe('CohortTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(tableState, {
      rows: [], loading: true, refreshing: false, error: '',
      hasNextPage: false, loadingNextPage: false,
    });
    tableProps.current = null;
  });

  it('wires cohort query, selection and loaded table state', () => {
    Object.assign(tableState, {
      rows: [cohort], loading: false, refreshing: true,
      hasNextPage: true, loadingNextPage: true,
    });
    render(<CohortTable {...baseProps} />);

    expect(useTableData).toHaveBeenCalledWith(queryKey, filters, sorting);
    expect(onRowSelect).not.toHaveBeenCalled();
    expect(tableProps.current).toEqual(expect.objectContaining({
      ariaLabel: 'Cohorts',
      data: [cohort],
      loading: false,
      refreshing: true,
      emptyMessage: 'No cohorts match your search and filters',
      hiddenColumnKeys: ['end'],
      selectedKey: 'cohort-1',
      sorting,
      sortableColumns: ['program', 'cohort', 'start', 'end', 'status'],
      columnWidths: { cohort: 220 },
      onColumnWidthsChange,
      hasNextPage: true,
      loadingNextPage: true,
      onLoadNextPage: tableState.loadNextPage,
      unavailable: undefined,
    }));

    tableProps.current?.onRowSelect?.(cohort);
    tableProps.current?.onSortingChange?.({ key: 'end', direction: 'asc' });
    expect(onRowSelect).toHaveBeenCalledWith(cohort);
    expect(onSortingChange).toHaveBeenCalledWith({ key: 'end', direction: 'asc' });
  });

  it('clears selection only after loaded rows confirm the selected cohort is missing', () => {
    const view = render(<CohortTable {...baseProps} />);
    expect(onRowSelect).not.toHaveBeenCalled();

    Object.assign(tableState, { loading: false, rows: [cohort] });
    view.rerender(<CohortTable {...baseProps} />);
    expect(onRowSelect).not.toHaveBeenCalled();

    Object.assign(tableState, { rows: [] });
    view.rerender(<CohortTable {...baseProps} />);
    expect(onRowSelect).toHaveBeenCalledOnce();
    expect(onRowSelect).toHaveBeenCalledWith(null);
  });

  it('maps query failures to the unavailable state and page error retry action', () => {
    tableState.error = 'Unable to load cohorts.';
    render(<CohortTable {...baseProps} />);

    expect(tableProps.current).toEqual(expect.objectContaining({
      unavailable: { title: 'Cohorts unavailable', onRetry: tableState.retry },
    }));
    expect(onErrorChange).toHaveBeenLastCalledWith({
      message: 'Unable to load cohorts.',
      action: { label: 'Retry', onClick: tableState.retry },
    });
  });
});
