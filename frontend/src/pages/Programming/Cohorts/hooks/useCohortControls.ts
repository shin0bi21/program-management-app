import { toFilterOptions } from '../../../../common/features/referenceData/filterOptions';
import { useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../../common/components/Table/Table.types';
import type { ProgramReference } from '../../../../common/features/referenceData/referenceData.api';
import usePreferences from '../../../../common/features/Preferences/usePreferences';
import useTableLayout from '../../../../common/features/Preferences/useTableLayout';
import {
  optionalPreferenceOption,
  optionalPreferenceId,
  preferenceSorting,
} from '../../../../common/features/Preferences/preferences';
import type { CohortSortKey } from '../types';
import type { ListSort } from '../../../../common/components/Table/Table.types';

export type CohortStatus = 'active' | 'upcoming' | 'completed';

export interface CohortPreference {
  programId: string | null;
  status: CohortStatus | null;
  sorting?: ListSort<CohortSortKey>;
}

const DEFAULT_SORTING: ListSort<CohortSortKey> = { key: 'start', direction: 'desc' };
export function useCohortControls(
  role: string | null,
  programs: ProgramReference[],
  programsLoading: boolean,
  tableKeys: readonly CohortSortKey[],
  programsError?: string | null,
) {
  // Search and filters.
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const layout = useTableLayout({ key: 'cohort-filters', tableKeys });
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'cohort-filters',
    waiting: role === null || programsLoading,
    fields: {
      programId: optionalPreferenceId(programsLoading || programsError ? undefined : programs.map(program => program.id)),
      status: optionalPreferenceOption(['active', 'upcoming', 'completed'] as const, role === 'staff' ? 'active' : null),
      sorting: preferenceSorting(tableKeys, DEFAULT_SORTING),
    },
  });
  const { sorting } = preferences;
  const programId = preferences.programId ?? '';
  const status = preferences.status ?? '';

  const applySearch = () => setAppliedSearch(search.trim().toLowerCase());
  const clearSearch = () => {
    setSearch('');
    setAppliedSearch('');
  };

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    {
      id: 'program', label: 'Program', selectionMode: 'single',
      options: toFilterOptions(programs),
    },
    {
      id: 'status', label: 'Status', selectionMode: 'single',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'upcoming', label: 'Upcoming' },
        { value: 'completed', label: 'Completed' },
      ],
    },
  ], [programs]);

  const applyFilter = (category: string, selected: string[]) => {
    if (category === 'program') {
      updatePreferences({ programId: selected[0] ?? null });
    }
    if (category === 'status') {
      updatePreferences({ status: (selected[0] as CohortStatus | undefined) ?? null });
    }
  };
  const clearFilters = () => updatePreferences({ programId: null, status: null });
  const setSorting = (sorting: TableSorting) => updatePreferences({ sorting: sorting as ListSort<CohortSortKey> });

  return {
    ready,
    error,
    search: {
      value: search,
      setValue: setSearch,
      appliedValue: appliedSearch,
      apply: applySearch,
      clear: clearSearch,
    },
    filters: {
      programId,
      status,
      definitions: filterCategories,
      apply: applyFilter,
      clear: clearFilters,
    },
    table: {
      sorting,
      setSorting,
      columnWidths: layout.columnWidths,
      setColumnWidths: layout.setColumnWidths,
      hiddenColumns: layout.hiddenColumns,
      setHiddenColumns: layout.setHiddenColumns,
    },
  };
}
