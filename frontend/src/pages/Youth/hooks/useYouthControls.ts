import { useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../common/components/Table/Table.types';
import type { Program } from '../../../common/features/programs/types';
import usePreferences from '../../../common/features/Preferences/usePreferences';
import {
  preferenceOptions,
  preferenceIds,
  preferenceSorting,
  preferenceColumnWidths,
  preferenceHiddenColumns,
} from '../../../common/features/Preferences/preferences';
import type { ListSort } from '../../../common/components/Table/Table.types';
import type { YouthSortKey } from '../types';

export type YouthStatusFilter = 'active' | 'inactive';

interface UseYouthControlsOptions {
  role: string | null;
  programs: Program[];
  programsLoading: boolean;
  programsError?: string | null;
  tableKeys: readonly YouthSortKey[];
}

const DEFAULT_SORTING: ListSort<YouthSortKey> = { key: 'firstName', direction: 'asc' };

export function useYouthControls({
  role,
  programs,
  programsLoading,
  programsError,
  tableKeys,
}: UseYouthControlsOptions) {
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'youth-profile-filters',
    waiting: programsLoading || role === null,
    fields: {
      statuses: preferenceOptions<YouthStatusFilter>(['active', 'inactive'], ['active']),
      programIds: preferenceIds(
        programsLoading || programsError ? undefined : programs.map(program => program.id),
        role === 'staff' ? programs.map(program => program.id) : [],
      ),
      sorting: preferenceSorting(tableKeys, DEFAULT_SORTING),
      columnWidths: preferenceColumnWidths(tableKeys),
      hiddenColumns: preferenceHiddenColumns(tableKeys),
    },
  });

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const applySearch = () => setAppliedSearch(search.trim());
  const clearSearch = () => {
    setSearch('');
    setAppliedSearch('');
  };

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    {
      id: 'program',
      label: 'Program',
      options: programs.map(program => ({ value: program.id, label: program.name })),
    },
    {
      id: 'status',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
  ], [programs]);

  const applyFilter = (category: string, selected: string[]) => {
    if (category === 'status') updatePreferences({ statuses: selected as YouthStatusFilter[] });
    if (category === 'program') updatePreferences({ programIds: selected });
  };

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
      statuses: preferences.statuses,
      programIds: preferences.programIds,
      definitions: filterCategories,
      apply: applyFilter,
      clear: () => updatePreferences({ statuses: [], programIds: [] }),
    },
    table: {
      sorting: preferences.sorting,
      setSorting: (sorting: TableSorting) => updatePreferences({ sorting: sorting as ListSort<YouthSortKey> }),
      columnWidths: preferences.columnWidths,
      setColumnWidths: (columnWidths: Record<string, number>) => updatePreferences({ columnWidths }),
      hiddenColumns: preferences.hiddenColumns,
      setHiddenColumns: (hiddenColumns: string[]) => updatePreferences({ hiddenColumns }),
    },
  };
}
