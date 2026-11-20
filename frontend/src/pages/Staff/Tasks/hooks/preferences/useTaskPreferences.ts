import createPreferenceFilters from '../../../../../common/features/Preferences/createPreferenceFilters';
import type { CycleReference, StaffReference, ProgramReference } from '../../../../../common/features/referenceData/referenceData.api';
import { getCycleDateRange } from '../../../../../common/features/programming/cycles/cycleDateRange';
import type { TaskReferenceData } from '../../api/tasks.api';
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

import {
  type TaskCategory,
  type TaskStatus,
  type TaskSortKey,
  type TasksFilters,
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
  staff: StaffReference[];
  programs: ProgramReference[];
  staffLoading: boolean;
  staffError: boolean;
  programsLoading: boolean;
  programsError: boolean;
  tableKeys: readonly TaskSortKey[];
  cycles: CycleReference[];
  cyclesLoading: boolean;
  cyclesError: boolean;
}

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
 * @param options - Reference choices, their availability, and supported table keys.
 * @example Submitting search.apply('workshop') saves the applied task search.
 */
export default function useTaskPreferences({
  referenceData,
  referenceDataLoading,
  referenceDataError,
  staff,
  programs,
  staffLoading,
  staffError,
  programsLoading,
  programsError,
  tableKeys,
  cycles,
  cyclesLoading,
  cyclesError,
}: UseTaskPreferencesOptions): TaskPreferencesResult {
  const options = referenceDataLoading || referenceDataError ? undefined : referenceData;
  const layout = useTableLayout({ key: 'task-preferences', tableKeys });
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'task-preferences',
    waiting: referenceDataLoading || cyclesLoading || staffLoading || programsLoading,
    fields: {
      cycleIds: preferenceIds(cyclesLoading || cyclesError ? undefined : cycles.map(cycle => cycle.id)),
      view: preferenceOption(['calendar', 'table'] as const, 'calendar'),
      search: preferenceText(),
      staffIds: preferenceIds(staffLoading || staffError ? undefined : staff.map(staffMember => staffMember.id)),
      programIds: preferenceIds(programsLoading || programsError ? undefined : programs.map(program => program.id)),
      categories: preferenceOptions<TaskCategory>(
        ['program_delivery', 'planning_prep', 'meeting', 'administration', 'outreach', 'maintenance', 'other'],
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
      options: staff.map(({ id, name }) => ({ id, label: name })),
    },
    {
      id: 'programIds' as const,
      label: 'Program',
      options: programs.map(({ id, title }) => ({ id, label: title })),
    },
    { id: 'cycleIds' as const, label: 'Cycle', options: cycles.map(({ id, title }) => ({ id, label: title })) },
    { id: 'categories' as const, label: 'Category', options: (referenceData?.categories ?? []).map(({ id, name }) => ({ id, label: name })) },
    { id: 'statuses' as const, label: 'Status', options: (referenceData?.statuses ?? []).map(({ id, name }) => ({ id, label: name })) },
  ], [referenceData, cycles, staff, programs]);

  const filterValues: TaskFilterValues = {
    cycleIds: preferences.cycleIds,
    staffIds: preferences.staffIds,
    programIds: preferences.programIds,
    categories: preferences.categories,
    statuses: preferences.statuses,
  };
  const appliedFilters: TasksFilters = { ...filterValues, search: preferences.search };
  const dateRange = useMemo(
    () => getCycleDateRange(cycles, preferences.cycleIds),
    [cycles, preferences.cycleIds],
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
