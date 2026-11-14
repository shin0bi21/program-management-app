import createPreferenceFilters from '../../../../../common/features/Preferences/createPreferenceFilters';
import type { CycleReference, StaffReference, ProgramReference } from '../../../../../common/features/referenceData/referenceData.api';
import { toFilterOptions } from '../../../../../common/features/referenceData/filterOptions';
import type { TaskReferenceData } from '../../tasks.api';
import { useMemo } from 'react';

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

/**
 * Restores task controls and saves submitted search, filters, view, and sorting.
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
}: UseTaskPreferencesOptions) {
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

  // View preference.
  const setView = (view: TasksView) => {
    updatePreferences({ view });
  };

  // Filter preferences.
  const filterDefinitions = useMemo(() => [
    {
      id: 'staffIds' as const,
      label: 'Staff',
      options: toFilterOptions(staff),
    },
    {
      id: 'programIds' as const,
      label: 'Program',
      options: toFilterOptions(programs),
    },
    { id: 'cycleIds' as const, label: 'Cycle', options: toFilterOptions(cycles) },
    { id: 'categories' as const, label: 'Category', options: referenceData?.categories ?? [] },
    { id: 'statuses' as const, label: 'Status', options: referenceData?.statuses ?? [] },
  ], [referenceData, cycles, staff, programs]);

  const filterValues = useMemo(() => ({
    cycleIds: preferences.cycleIds,
    staffIds: preferences.staffIds,
    programIds: preferences.programIds,
    categories: preferences.categories,
    statuses: preferences.statuses,
  }), [preferences]);

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
