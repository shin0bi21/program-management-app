import { useMemo } from 'react';
import type { ProgramReference, SchoolReference } from '../../../../common/features/referenceData/referenceData.api';
import type { ProgramCycle } from '../../../../common/features/programming/cycles/types';
import usePreferences from '../../../../common/features/Preferences/hooks/usePreferences';
import useTableLayout from '../../../../common/features/Preferences/hooks/useTableLayout';
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
  schools: SchoolReference[];
  schoolsLoading: boolean;
  schoolsError?: string | null;
  tableKeys: readonly YouthSortKey[];
}

const DEFAULT_SORTING: ListSort<YouthSortKey> = { key: 'firstName', direction: 'asc' };

/**
 * Restores youth controls and supplies applied filters with role-specific program defaults.
 * @param options - Role, available programs, cycles, and schools, dependency status, and table keys.
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
  schools,
  schoolsLoading,
  schoolsError,
  tableKeys,
}: UseYouthControlsOptions) {
  const layout = useTableLayout({ key: 'youth-profile-filters', tableKeys });
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'youth-profile-filters',
    waiting: programsLoading || cyclesLoading || schoolsLoading || role === null,
    fields: {
      search: preferenceText(),
      programIds: preferenceIds(
        programsLoading || programsError ? undefined : programs.map(program => program.id),
        role === 'staff' ? programs.map(program => program.id) : [],
      ),
      cycleIds: preferenceIds(
        cyclesLoading || cyclesError ? undefined : cycles.map(cycle => cycle.id),
      ),
      schoolIds: preferenceIds(
        schoolsLoading || schoolsError ? undefined : schools.map(school => school.id),
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
    {
      id: 'schoolIds' as const,
      label: 'School',
      options: schools.map(({ id, name }) => ({ id, label: name })),
    },
  ], [programs, cycles, schools]);

  const appliedFilters: YouthFilters = {
    search: preferences.search,
    programIds: preferences.programIds,
    cycleIds: preferences.cycleIds,
    schoolIds: preferences.schoolIds,
  };

  return {
    ready,
    error,
    appliedFilters,
    search: {
      appliedValue: preferences.search,
      apply: (search: string) => updatePreferences({ search }),
    },
    filters: {
      values: {
        programIds: preferences.programIds,
        cycleIds: preferences.cycleIds,
        schoolIds: preferences.schoolIds,
      },
      definitions: filterCategories,
      update: updatePreferences,
    },
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
