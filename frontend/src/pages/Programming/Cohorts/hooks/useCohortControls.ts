import { useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../../common/components/Table/Table.types';
import type { Program } from '../../../../common/features/programs/types';
import usePreferences from '../../../../common/features/Preferences/usePreferences';
import {
  optionalPreferenceOption,
  optionalPreferenceId,
  preferenceSorting,
  preferenceColumnWidths,
  preferenceHiddenColumns,
} from '../../../../common/features/Preferences/preferences';
import type { CohortSortKey } from '../types';
import type { ListSort } from '../../../../common/components/Table/Table.types';

export type CohortStatus = 'active' | 'upcoming' | 'completed';

export interface CohortPreference {
  programId: string | null;
  status: CohortStatus | null;
  sorting?: ListSort<CohortSortKey>;
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}

const DEFAULT_SORTING: ListSort<CohortSortKey> = { key: 'start', direction: 'desc' };
export function useCohortControls(
  role: string | null,
  programs: Program[],
  programsLoading: boolean,
  tableKeys: readonly CohortSortKey[],
  programsError?: string | null,
) {
  // Search and filters.
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'cohort-filters',
    waiting: role === null || programsLoading,
    fields: {
      programId: optionalPreferenceId(programsLoading || programsError ? undefined : programs.map(program => program.id)),
      status: optionalPreferenceOption(['active', 'upcoming', 'completed'] as const, role === 'staff' ? 'active' : null),
      sorting: preferenceSorting(tableKeys, DEFAULT_SORTING),
      columnWidths: preferenceColumnWidths(tableKeys),
      hiddenColumns: preferenceHiddenColumns(tableKeys),
    },
  });
  const { sorting, columnWidths, hiddenColumns } = preferences;
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
      options: programs.map(program => ({ value: program.id, label: program.name })),
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
  const setColumnWidths = (columnWidths: Record<string, number>) => updatePreferences({ columnWidths });
  const setHiddenColumns = (hiddenColumns: string[]) => updatePreferences({ hiddenColumns });

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
      columnWidths,
      setColumnWidths,
      hiddenColumns,
      setHiddenColumns,
    },
  };
}
