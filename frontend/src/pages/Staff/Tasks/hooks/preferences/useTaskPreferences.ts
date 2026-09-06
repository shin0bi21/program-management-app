import { useMemo, useState } from 'react';

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
import type { ListSort } from '../../../../../common/components/Table/Table.types';

import {
  type TaskCategory,
  type TaskStatus,
  type TaskReferenceData,
  type TaskSortKey,
} from '../../types';

type TasksView = 'calendar' | 'table';

interface TaskPreferences {
  view: TasksView;
  search: string;
  staffIds: string[];
  programIds: string[];
  categories: TaskCategory[];
  statuses: TaskStatus[];
  sorting: ListSort<TaskSortKey>;
  columnWidths: Record<string, number>;
  hiddenColumns: string[];
}

export type StoredTaskPreferences = Partial<TaskPreferences>;

interface UseTaskPreferencesOptions {
  referenceData: TaskReferenceData | undefined;
  referenceDataLoading: boolean;
  referenceDataError: boolean;
  tableKeys: readonly TaskSortKey[];
}

export default function useTaskPreferences({
  referenceData,
  referenceDataLoading,
  referenceDataError,
  tableKeys,
}: UseTaskPreferencesOptions) {
  const options = referenceDataLoading || referenceDataError ? undefined : referenceData;
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'task-preferences',
    waiting: referenceDataLoading,
    fields: {
      view: preferenceOption(['calendar', 'table'] as const, 'calendar'),
      search: preferenceText(),
      staffIds: preferenceIds(options?.resources.map(resource => resource.id)),
      programIds: preferenceIds(options?.programs.map(program => program.id)),
      categories: preferenceOptions<TaskCategory>(
        ['program_delivery', 'planning_prep', 'meeting', 'administration', 'outreach', 'maintenance', 'other'],
        [],
        options?.categories.map(category => category.value) ?? null,
      ),
      statuses: preferenceOptions<TaskStatus>(
        ['upcoming', 'active', 'overdue', 'completed', 'cancelled'],
        [],
        options?.statuses.map(status => status.value) ?? null,
      ),
      sorting: preferenceSorting(tableKeys, { key: 'startDate', direction: 'asc' }),
      columnWidths: preferenceColumnWidths(tableKeys),
      hiddenColumns: preferenceHiddenColumns(tableKeys),
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
      options: (referenceData?.resources ?? []).map(item => ({ value: item.id, label: item.name })),
    },
    {
      id: 'program',
      label: 'Program',
      options: (referenceData?.programs ?? []).map(item => ({ value: item.id, label: item.name })),
    },
    { id: 'category', label: 'Category', options: referenceData?.categories ?? [] },
    { id: 'status', label: 'Status', options: referenceData?.statuses ?? [] },
  ], [referenceData]);

  const applyFilter = (id: string, selected: string[]) => {
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
    staffIds: [],
    programIds: [],
    categories: [],
    statuses: [],
  });

  // Table sorting.
  const setSorting = (sorting: ListSort<TaskSortKey>) => {
    updatePreferences({ sorting });
  };

  // Column widths.
  const setColumnWidths = (columnWidths: Record<string, number>) => {
    updatePreferences({ columnWidths });
  };

  // Hidden columns.
  const setHiddenColumns = (hiddenColumns: string[]) => {
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
      statuses: preferences.statuses,
      definitions: filterDefinitions,
      apply: applyFilter,
      clear: clearFilters,
    },

    table: {
      sorting: preferences.sorting,
      setSorting,
      columnWidths: preferences.columnWidths,
      setColumnWidths,
      hiddenColumns: preferences.hiddenColumns,
      setHiddenColumns,
    },
  };
}
