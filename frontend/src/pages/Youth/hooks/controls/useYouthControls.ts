import { useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../../common/components/Table/Table.types';
import type { ProgramReference } from '../../../../common/features/referenceData/referenceData.api';
import { toFilterOptions } from '../../../../common/features/referenceData/filterOptions';
import type { ProgramCycle } from '../../../../common/features/programming/cycles/types';
import usePreferences from '../../../../common/features/Preferences/usePreferences';
import {
  preferenceIds,
  preferenceText,
  preferenceSorting,
  preferenceColumnWidths,
  preferenceHiddenColumns,
} from '../../../../common/features/Preferences/preferences';
import type { ListSort } from '../../../../common/components/Table/Table.types';
import type { YouthSortKey } from '../../types';

interface UseYouthControlsOptions {
  role: string | null;
  programs: ProgramReference[];
  programsLoading: boolean;
  programsError?: string | null;
  cycles: ProgramCycle[];
  cyclesLoading: boolean;
  cyclesError?: string | null;
  tableKeys: readonly YouthSortKey[];
}

const DEFAULT_SORTING: ListSort<YouthSortKey> = { key: 'firstName', direction: 'asc' };

export function useYouthControls({
  role,
  programs,
  programsLoading,
  programsError,
  cycles,
  cyclesLoading,
  cyclesError,
  tableKeys,
}: UseYouthControlsOptions) {
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'youth-profile-filters',
    waiting: programsLoading || cyclesLoading || role === null,
    fields: {
      search: preferenceText(),
      programIds: preferenceIds(
        programsLoading || programsError ? undefined : programs.map(program => program.id),
        role === 'staff' ? programs.map(program => program.id) : [],
      ),
      cycleIds: preferenceIds(
        cyclesLoading || cyclesError ? undefined : cycles.map(cycle => cycle.id),
      ),
      sorting: preferenceSorting(tableKeys, DEFAULT_SORTING),
      columnWidths: preferenceColumnWidths(tableKeys),
      hiddenColumns: preferenceHiddenColumns(tableKeys),
    },
  });

  const [searchDraft, setSearchValue] = useState<string | null>(null);
  const searchValue = searchDraft ?? preferences.search;

  const applySearch = () => updatePreferences({ search: searchValue.trim() });
  const clearSearch = () => {
    setSearchValue('');
    updatePreferences({ search: '' });
  };

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    {
      id: 'program',
      label: 'Program',
      options: toFilterOptions(programs),
    },
    {
      id: 'cycle',
      label: 'Cycle',
      options: toFilterOptions(cycles),
    },
  ], [programs, cycles]);

  const applyFilter = (category: string, selected: string[]) => {
    if (category === 'program') updatePreferences({ programIds: selected });
    if (category === 'cycle') updatePreferences({ cycleIds: selected });
  };

  return {
    ready,
    error,
    search: {
      value: searchValue,
      setValue: setSearchValue,
      appliedValue: preferences.search,
      apply: applySearch,
      clear: clearSearch,
    },
    filters: {
      programIds: preferences.programIds,
      cycleIds: preferences.cycleIds,
      definitions: filterCategories,
      apply: applyFilter,
      clear: () => updatePreferences({ programIds: [], cycleIds: [] }),
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
