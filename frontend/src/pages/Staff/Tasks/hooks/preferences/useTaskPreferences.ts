import type { CycleReference, StaffReference, ProgramReference } from '../../../../../common/features/referenceData/referenceData.api';
import { toFilterOptions } from '../../../../../common/features/referenceData/filterOptions';
import type { TaskReferenceData } from '../../tasks.api';
import { useMemo, useState } from 'react';

import type { FilterCardCategory } from '../../../../../common/components/FilterCard/FilterCard';
import usePreferences from '../../../../../common/features/Preferences/usePreferences';
import useTableLayout from '../../../../../common/features/Preferences/useTableLayout';
import {
  preferenceOption,
  preferenceOptions,
  preferenceIds,
  preferenceText,
  preferenceSorting,
} from '../../../../../common/features/Preferences/preferences';
import type { ListSort } from '../../../../../common/components/Table/Table.types';

import {
  type TaskCategory,
  type TaskStatus,
  type TaskSortKey,
} from '../../types';

type TasksView = 'calendar' | 'table';

interface TaskPreferences {
  cycleIds: string[];
  view: TasksView;
  search: string;
  staffIds: string[];
  programIds: string[];
  categories: TaskCategory[];
  statuses: TaskStatus[];
  sorting: ListSort<TaskSortKey>;
}

export type StoredTaskPreferences = Partial<TaskPreferences>;

interface UseTaskPreferencesOptions {
  referenceData: TaskReferenceData | undefined;
  referenceDataLoading: boolean;
  referenceDataError: boolean;
  resources: StaffReference[];
  programs: ProgramReference[];
  resourcesLoading: boolean;
  resourcesError: boolean;
  programsLoading: boolean;
  programsError: boolean;
  tableKeys: readonly TaskSortKey[];
  cycles: CycleReference[];
  cyclesLoading: boolean;
  cyclesError: boolean;
}

export default function useTaskPreferences({
  referenceData,
  referenceDataLoading,
  referenceDataError,
  resources,
  programs,
  resourcesLoading,
  resourcesError,
  programsLoading,
  programsError,
  tableKeys,
  cycles,
  cyclesLoading,
  cyclesError,
}: UseTaskPreferencesOptions) {
  const options = referenceDataLoading || referenceDataError ? undefined : referenceData;
  const layout = useTableLayout({ key: 'task-preferences', tableKeys });
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'task-preferences',
    waiting: referenceDataLoading || cyclesLoading || resourcesLoading || programsLoading,
    fields: {
      cycleIds: preferenceIds(cyclesLoading || cyclesError ? undefined : cycles.map(cycle => cycle.id)),
      view: preferenceOption(['calendar', 'table'] as const, 'calendar'),
      search: preferenceText(),
      staffIds: preferenceIds(resourcesLoading || resourcesError ? undefined : resources.map(resource => resource.id)),
      programIds: preferenceIds(programsLoading || programsError ? undefined : programs.map(program => program.id)),
      categories: preferenceOptions<TaskCategory>(
        ['program_delivery', 'planning_prep', 'meeting', 'administration', 'outreach', 'maintenance', 'other'],
        [],
        options?.categories.map(category => category.value) ?? null,
      ),
      statuses: preferenceOptions<TaskStatus>(
        ['upcoming', 'in_progress', 'overdue', 'completed', 'cancelled'],
        [],
        options?.statuses.map(status => status.value) ?? null,
      ),
      sorting: preferenceSorting(tableKeys, { key: 'startDate', direction: 'asc' }),
    },
  });
  const [searchDraft, setSearchValue] = useState<string | null>(null);
  const searchValue = searchDraft ?? preferences.search;

  // View preference.
  const setView = (view: TasksView) => {
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
    {
      id: 'staff',
      label: 'Staff',
      options: toFilterOptions(resources),
    },
    {
      id: 'program',
      label: 'Program',
      options: toFilterOptions(programs),
    },
    { id: 'cycle', label: 'Cycle', options: toFilterOptions(cycles) },
    { id: 'category', label: 'Category', options: referenceData?.categories ?? [] },
    { id: 'status', label: 'Status', options: referenceData?.statuses ?? [] },
  ], [referenceData, cycles, resources, programs]);

  const applyFilter = (id: string, selected: string[]) => {
    if (id === 'cycle') updatePreferences({ cycleIds: selected });
    if (id === 'staff') updatePreferences({ staffIds: selected });
    if (id === 'program') updatePreferences({ programIds: selected });
    if (id === 'category') updatePreferences({
      categories: selected as TaskCategory[],
    });
    if (id === 'status') updatePreferences({
      statuses: selected as TaskStatus[],
    });
  };

  const clearFilters = () => updatePreferences({
    cycleIds: [],
    staffIds: [],
    programIds: [],
    categories: [],
    statuses: [],
  });

  // Table sorting.
  const setSorting = (sorting: ListSort<TaskSortKey>) => {
    updatePreferences({ sorting });
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
      cycleIds: preferences.cycleIds,
      staffIds: preferences.staffIds,
      programIds: preferences.programIds,
      categories: preferences.categories,
      statuses: preferences.statuses,
      definitions: filterDefinitions,
      apply: applyFilter,
      clear: clearFilters,
    },

    table: {
      sorting: preferences.sorting,
      setSorting,
      columnWidths: layout.columnWidths,
      setColumnWidths: layout.setColumnWidths,
      hiddenColumns: layout.hiddenColumns,
      setHiddenColumns: layout.setHiddenColumns,
    },
  };
}
