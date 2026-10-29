import { useMemo, useState } from 'react';
import { toFilterOptions } from '../../../../../common/features/referenceData/filterOptions';

import { getCycleDateRange } from '../../../../../common/features/programming/cycles/cycleDateRange';
import type { FilterCardCategory } from '../../../../../common/components/FilterCard/FilterCard';
import usePreferences from '../../../../../common/features/Preferences/usePreferences';
import {
  preferenceOption,
  preferenceOptions,
  preferenceIds,
  preferenceText,
  preferenceSorting,
  preferenceColumnWidths,
  preferenceHiddenColumns,
} from '../../../../../common/features/Preferences/preferences';
import type {
  StaffResource,
  HoursCategory,
  HoursEntryType,
  HoursProgram,
  HoursSortKey,
} from '../../types';
import type { CycleReference } from '../../../../../common/features/referenceData/referenceData.api';
import type { ListSort } from '../../../../../common/components/Table/Table.types';

type HoursView = 'calendar' | 'table';

interface HoursPreferences {
  view: HoursView;
  search: string;
  staffIds: string[];
  programIds: string[];
  categories: HoursCategory[];
  types: HoursEntryType[];
  cycleIds: string[];
  sorting: ListSort<HoursSortKey>;
  columnWidths: Record<string, number>;
  hiddenColumns: string[];
}

export type StoredHoursPreferences = Partial<HoursPreferences>;

export default function useHoursPreferences({
  role,
  resources,
  programs,
  cycles,
  categories,
  types,
  loadingDependencies,
  optionsError,
  resourcesError = optionsError,
  programsError = optionsError,
  cyclesError,
  tableKeys,
}: {
  role: string | null;
  resources: readonly StaffResource[];
  programs: readonly HoursProgram[];
  cycles: readonly CycleReference[];
  categories: ReadonlyArray<{ value: HoursCategory; label: string }>;
  types: ReadonlyArray<{ value: HoursEntryType; label: string }>;
  loadingDependencies: boolean;
  optionsError: boolean;
  resourcesError?: boolean;
  programsError?: boolean;
  cyclesError: boolean;
  tableKeys: readonly HoursSortKey[];
}) {
  const canVerifyOptions = !loadingDependencies && !optionsError;
  const canVerifyCycles = !loadingDependencies && !cyclesError;
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'hours-filters',
    waiting: loadingDependencies || role === null,
    fields: {
      view: preferenceOption(['calendar', 'table'] as const, 'calendar'),
      search: preferenceText(),
      staffIds: preferenceIds(role !== 'admin' ? [] : !loadingDependencies && !resourcesError
        ? resources.map(resource => resource.id) : undefined),
      programIds: preferenceIds(!loadingDependencies && !programsError ? ['general', ...programs.map(program => program.id)] : undefined),
      categories: preferenceOptions<HoursCategory>(
        ['program_delivery', 'planning_prep', 'meeting', 'administration', 'outreach', 'maintenance', 'other'],
        [],
        canVerifyOptions ? categories.map(category => category.value) : null,
      ),
      types: preferenceOptions<HoursEntryType>(
        ['task', 'session', 'other'],
        [],
        canVerifyOptions ? types.map(type => type.value) : null,
      ),
      cycleIds: preferenceIds(canVerifyCycles ? cycles.map(cycle => cycle.id) : undefined),
      sorting: preferenceSorting(tableKeys, { key: 'date', direction: 'desc' }),
      columnWidths: preferenceColumnWidths(tableKeys),
      hiddenColumns: preferenceHiddenColumns(tableKeys),
    },
  });
  const dateRange = useMemo(() => getCycleDateRange(cycles, preferences.cycleIds), [cycles, preferences.cycleIds]);
  const [searchDraft, setSearchValue] = useState<string | null>(null);
  const searchValue = searchDraft ?? preferences.search;

  // View preference.
  const setView = (view: HoursPreferences['view']) => {
    updatePreferences({ view });
  };

  // Search preference.
  const applySearch = () => {
    updatePreferences({ search: searchValue.trim() });
  };
  const clearSearch = () => {
    setSearchValue('');
    updatePreferences({ search: '' });
  };

  // Filter preferences.
  const filterDefinitions = useMemo<FilterCardCategory[]>(() => [
    ...(role === 'admin' ? [{
      id: 'staff',
      label: 'Staff',
      options: toFilterOptions(resources),
    }] : []),
    {
      id: 'program',
      label: 'Program',
      options: [
        { value: 'general', label: 'General' },
        ...toFilterOptions(programs),
      ],
    },
    {
      id: 'cycle',
      label: 'Cycle',
      options: toFilterOptions(cycles),
    },
    { id: 'type', label: 'Type', options: [...types] },
    { id: 'entryType', label: 'Category', options: [...categories] },
  ], [categories, cycles, programs, resources, role, types]);

  const applyFilter = (id: string, selected: string[]) => {
    if (id === 'staff') updatePreferences({ staffIds: selected });
    if (id === 'program') updatePreferences({ programIds: selected });
    if (id === 'entryType') updatePreferences({ categories: selected as HoursCategory[] });
    if (id === 'type') updatePreferences({ types: selected as HoursEntryType[] });
    if (id === 'cycle') updatePreferences({ cycleIds: selected });
  };

  const clearFilters = () => updatePreferences({
    staffIds: [],
    programIds: [],
    categories: [],
    types: [],
    cycleIds: [],
  });

  const updateSorting = (sorting: ListSort<HoursSortKey>) => {
    updatePreferences({ sorting });
  };
  const updateColumnWidths = (columnWidths: Record<string, number>) => {
    updatePreferences({ columnWidths });
  };
  const updateHiddenColumns = (hiddenColumns: string[]) => {
    updatePreferences({ hiddenColumns });
  };

  return {
    ready,
    error,

    view: preferences.view,
    setView,

    search: {
      value: searchValue,
      appliedValue: preferences.search,
      setValue: setSearchValue,
      apply: applySearch,
      clear: clearSearch,
    },

    filters: {
      staffIds: preferences.staffIds,
      programIds: preferences.programIds,
      categories: preferences.categories,
      types: preferences.types,
      cycleIds: preferences.cycleIds,
      dateRange,
      definitions: filterDefinitions,
      apply: applyFilter,
      clear: clearFilters,
    },

    table: {
      sorting: preferences.sorting,
      setSorting: updateSorting,
      columnWidths: preferences.columnWidths,
      setColumnWidths: updateColumnWidths,
      hiddenColumns: preferences.hiddenColumns,
      setHiddenColumns: updateHiddenColumns,
    },
  };
}
