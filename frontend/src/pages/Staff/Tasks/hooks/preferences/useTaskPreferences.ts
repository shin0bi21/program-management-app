import createPreferenceFilters from '../../../../../common/features/Preferences/createPreferenceFilters';
import { getCycleDateRange } from '../../../../../common/features/programming/cycles/cycleDateRange';
import type { TaskReferences } from '../data/useTaskReferenceData';
import { useMemo } from 'react';
import type { DateRange } from '../../../../../common/utils/dateRange';
import type { PageSearchControls } from '../../../../../common/components/PageContainer/PageContainer.types';

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
import { HOURS_CATEGORIES } from '../../../Hours/types';

import {
  type TaskStatus,
  type TaskSortKey,
  type TasksFilters,
} from '../../types';

type TasksView = 'calendar' | 'table';

interface TaskPreferences extends TasksFilters {
  view: TasksView;
  sorting: ListSort<TaskSortKey>;
}

export type StoredTaskPreferences = Partial<TaskPreferences>;

type TaskFilterValues = Omit<TasksFilters, 'search'>;

type TaskTableControls = ReturnType<typeof useTableLayout> & {
  sorting: ListSort<TaskSortKey>;
  setSorting: (sorting: ListSort<TaskSortKey>) => void;
};

interface TaskPreferencesResult {
  ready: boolean;
  error: string | null;
  appliedFilters: TasksFilters;
  dateRange: DateRange | undefined;
  view: TasksView;
  setView: (view: TasksView) => void;
  search: PageSearchControls;
  filters: ReturnType<typeof createPreferenceFilters<TaskFilterValues>>;
  table: TaskTableControls;
}

/**
 * Restores task controls and supplies applied request filters with derived calendar bounds.
 * @param referenceData - Task reference choices and availability.
 * @param tableKeys - Supported sort and layout columns.
 * @example Submitting search.apply('workshop') saves the applied task search.
 */
export default function useTaskPreferences(
  referenceData: TaskReferences,
  tableKeys: readonly TaskSortKey[],
): TaskPreferencesResult {
  const { taskOptions, staff, programs, cycles } = referenceData;
  const options = taskOptions.isLoading || taskOptions.error ? undefined : taskOptions.data;
  const layout = useTableLayout({ key: 'task-preferences', tableKeys });
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'task-preferences',
    waiting: taskOptions.isLoading || cycles.isLoading || staff.isLoading || programs.isLoading,
    fields: {
      cycleIds: preferenceIds(cycles.isLoading || cycles.error ? undefined : (cycles.data ?? []).map(cycle => cycle.id)),
      view: preferenceOption(['calendar', 'table'] as const, 'calendar'),
      search: preferenceText(),
      staffIds: preferenceIds(staff.isLoading || staff.error ? undefined : (staff.data ?? []).map(staffMember => staffMember.id)),
      programIds: preferenceIds(programs.isLoading || programs.error ? undefined : (programs.data ?? []).map(program => program.id)),
      categories: preferenceOptions(
        HOURS_CATEGORIES,
        [],
        options?.categories.map(category => category.id) ?? null,
      ),
      statuses: preferenceOptions<TaskStatus>(
        ['upcoming', 'in_progress', 'overdue', 'completed', 'cancelled'],
        [],
        options?.statuses.map(status => status.id) ?? null,
      ),
      sorting: preferenceSorting(tableKeys, { key: 'startDate', direction: 'asc' }),
    },
  });

  // View preference.
  const setView = (view: TasksView) => {
    updatePreferences({ view });
  };

  // Filter preferences.
  const filterDefinitions = useMemo(() => [
    {
      id: 'staffIds' as const,
      label: 'Staff',
      options: (staff.data ?? []).map(({ id, name }) => ({ id, label: name })),
    },
    {
      id: 'programIds' as const,
      label: 'Program',
      options: (programs.data ?? []).map(({ id, title }) => ({ id, label: title })),
    },
    { id: 'cycleIds' as const, label: 'Cycle', options: (cycles.data ?? []).map(({ id, title }) => ({ id, label: title })) },
    { id: 'categories' as const, label: 'Category', options: (taskOptions.data?.categories ?? []).map(({ id, name }) => ({ id, label: name })) },
    { id: 'statuses' as const, label: 'Status', options: (taskOptions.data?.statuses ?? []).map(({ id, name }) => ({ id, label: name })) },
  ], [taskOptions.data, cycles.data, staff.data, programs.data]);

  const filterValues: TaskFilterValues = {
    cycleIds: preferences.cycleIds,
    staffIds: preferences.staffIds,
    programIds: preferences.programIds,
    categories: preferences.categories,
    statuses: preferences.statuses,
  };
  const appliedFilters: TasksFilters = { ...filterValues, search: preferences.search };
  const dateRange = useMemo(
    () => getCycleDateRange(cycles.data ?? [], preferences.cycleIds),
    [cycles.data, preferences.cycleIds],
  );

  // Table sorting.
  const setSorting = (sorting: ListSort<TaskSortKey>) => {
    updatePreferences({ sorting });
  };

  return {
    ready,
    error,
    appliedFilters,
    dateRange,

    view: preferences.view,
    setView,

    search: {
      appliedValue: preferences.search,
      apply: (search: string) => updatePreferences({ search }),
    },

    filters: createPreferenceFilters({
      values: filterValues,
      definitions: filterDefinitions,
      updatePreferences,
    }),

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
