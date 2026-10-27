import { useMemo, useState } from 'react';

import type { FilterCardCategory } from '../../../../../common/components/FilterCard/FilterCard';
import usePreferences from '../../../../../common/features/Preferences/usePreferences';
import {
  preferenceOption,
  preferenceOptions,
  preferenceIds,
  optionalPreferenceId,
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
import type { ProgramCycle } from '../../../../../common/features/programming/cycles/types';
import type { ListSort } from '../../../../../common/components/Table/Table.types';

type HoursView = 'calendar' | 'table';

interface HoursPreferences {
  view: HoursView;
  search: string;
  staffIds: string[];
  programIds: string[];
  categories: HoursCategory[];
  types: HoursEntryType[];
  cycleId: string | null;
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
  cyclesError,
  tableKeys,
}: {
  role: string | null;
  resources: readonly StaffResource[];
  programs: readonly HoursProgram[];
  cycles: readonly ProgramCycle[];
  categories: ReadonlyArray<{ value: HoursCategory; label: string }>;
  types: ReadonlyArray<{ value: HoursEntryType; label: string }>;
  loadingDependencies: boolean;
  optionsError: boolean;
  cyclesError: boolean;
  tableKeys: readonly HoursSortKey[];
}) {
  const canVerifyOptions = !loadingDependencies && !optionsError;
  const canVerifyCycles = !loadingDependencies && !cyclesError;
  const defaultCycleId = cycles.find(cycle => cycle.state === 'active')?.id ?? cycles[0]?.id ?? null;
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'hours-filters',
    waiting: loadingDependencies || role === null,
    fields: {
      view: preferenceOption(['calendar', 'table'] as const, 'calendar'),
      search: preferenceText(),
      staffIds: preferenceIds(role !== 'admin' ? [] : canVerifyOptions
        ? resources.map(resource => resource.id) : undefined),
      programIds: preferenceIds(canVerifyOptions ? ['general', ...programs.map(program => program.id)] : undefined),
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
      cycleId: optionalPreferenceId(canVerifyCycles ? cycles.map(cycle => cycle.id) : undefined, defaultCycleId),
      sorting: preferenceSorting(tableKeys, { key: 'date', direction: 'desc' }),
      columnWidths: preferenceColumnWidths(tableKeys),
      hiddenColumns: preferenceHiddenColumns(tableKeys),
    },
  });
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
      options: resources.map(resource => ({ value: resource.id, label: resource.name })),
    }] : []),
    {
      id: 'program',
      label: 'Program',
      options: [
        { value: 'general', label: 'General' },
        ...programs.map(program => ({ value: program.id, label: program.name })),
      ],
    },
    {
      id: 'cycle',
      label: 'Cycle',
      selectionMode: 'single',
      options: cycles.map(cycle => ({ value: cycle.id, label: cycle.name })),
    },
    { id: 'type', label: 'Type', options: [...types] },
    { id: 'entryType', label: 'Category', options: [...categories] },
  ], [categories, cycles, programs, resources, role, types]);

  const applyFilter = (id: string, selected: string[]) => {
    if (id === 'staff') updatePreferences({ staffIds: selected });
    if (id === 'program') updatePreferences({ programIds: selected });
    if (id === 'entryType') updatePreferences({ categories: selected as HoursCategory[] });
    if (id === 'type') updatePreferences({ types: selected as HoursEntryType[] });
    if (id === 'cycle') updatePreferences({ cycleId: selected[0] ?? null });
  };

  const clearFilters = () => updatePreferences({
    staffIds: [],
    programIds: [],
    categories: [],
    types: [],
    cycleId: null,
  });

  const selectCycle = (cycleId: string) => {
    updatePreferences({ cycleId });
  };

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
      cycleId: preferences.cycleId,
      definitions: filterDefinitions,
      apply: applyFilter,
      clear: clearFilters,
      selectCycle,
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
