import { useMemo } from 'react';
import createPreferenceFilters from '../../../../common/features/Preferences/createPreferenceFilters';
import type { ProgramReference } from '../../../../common/features/referenceData/referenceData.api';
import type { ProgramCycle } from '../../../../common/features/programming/cycles/types';
import usePreferences from '../../../../common/features/Preferences/usePreferences';
import useTableLayout from '../../../../common/features/Preferences/useTableLayout';
import {
  preferenceIds,
  preferenceText,
  preferenceSorting,
} from '../../../../common/features/Preferences/preferences';
import type { ListSort } from '../../../../common/components/Table/Table.types';
import type { YouthFilters, YouthSortKey } from '../../types';

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

/**
 * Restores youth controls and supplies applied filters with role-specific program defaults.
 * @param options - Role, available programs and cycles, dependency status, and table keys.
 * @example A staff user without saved controls starts with their available programs selected.
 */
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
  const layout = useTableLayout({ key: 'youth-profile-filters', tableKeys });
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
    },
  });

  const filterCategories = useMemo(() => [
    {
      id: 'programIds' as const,
      label: 'Program',
      options: programs.map(({ id, title }) => ({ id, label: title })),
    },
    {
      id: 'cycleIds' as const,
      label: 'Cycle',
      options: cycles.map(({ id, title }) => ({ id, label: title })),
    },
  ], [programs, cycles]);

  const appliedFilters: YouthFilters = {
    search: preferences.search,
    programIds: preferences.programIds,
    cycleIds: preferences.cycleIds,
  };

  return {
    ready,
    error,
    appliedFilters,
    search: {
      appliedValue: preferences.search,
      apply: (search: string) => updatePreferences({ search }),
    },
    filters: createPreferenceFilters({
      values: {
        programIds: preferences.programIds,
        cycleIds: preferences.cycleIds,
      },
      definitions: filterCategories,
      updatePreferences,
    }),
    table: {
      sorting: preferences.sorting,
      setSorting: (sorting: ListSort<YouthSortKey>) => updatePreferences({ sorting }),
      columnWidths: layout.columnWidths,
      setColumnWidths: layout.setColumnWidths,
      hiddenColumns: layout.hiddenColumns,
      setHiddenColumns: layout.setHiddenColumns,
    },
  };
}
