import { useCallback, useEffect, useMemo, useState } from 'react';

import usePreferenceOptionRecovery from '../../../../common/features/preferences/hooks/usePreferenceOptionRecovery';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import { resolvePreferenceSorting } from '../../../../common/features/preferences/preferenceValues';
import type { TaskOptions } from '../../../../common/features/tasks/types';

import type { TaskPreference, TaskPreferences, TaskSortKey } from '../types';

const DEFAULT_TASK_PREFERENCES: TaskPreferences = {
  view: 'calendar',
  staffIds: [],
  programIds: [],
  categories: [],
  statuses: [],
  sorting: { key: 'startDate', direction: 'asc' },
  columnWidths: {},
  hiddenColumns: [],
};
const DEFAULT_SORTING = DEFAULT_TASK_PREFERENCES.sorting;

function resolveTaskPreference(
  preference: TaskPreference | null,
  options: TaskOptions | undefined,
  preserveSavedOptions: boolean,
  tableKeys: readonly TaskSortKey[],
): TaskPreferences {
  const resourceIds = new Set(options?.resources.map(resource => resource.id) ?? []);
  const programIds = new Set(options?.programs.map(program => program.id) ?? []);

  return {
    view: preference?.view ?? DEFAULT_TASK_PREFERENCES.view,
    staffIds: preserveSavedOptions
      ? preference?.staffIds ?? []
      : preference?.staffIds?.filter(id => resourceIds.has(id)) ?? [],
    programIds: preserveSavedOptions
      ? preference?.programIds ?? []
      : preference?.programIds?.filter(id => programIds.has(id)) ?? [],
    categories: preference?.categories ?? [],
    statuses: preference?.statuses ?? [],
    sorting: resolvePreferenceSorting(preference?.sorting, tableKeys, DEFAULT_SORTING),
    columnWidths: preference?.columnWidths ?? {},
    hiddenColumns: preference?.hiddenColumns ?? [],
  };
}

export default function useTaskPreferences({
  options,
  optionsLoading,
  optionsError,
  tableKeys,
}: {
  options: TaskOptions | undefined;
  optionsLoading: boolean;
  optionsError: boolean;
  tableKeys: readonly TaskSortKey[];
}) {
  // State and persistence dependency.
  const [preferences, setPreferences] = useState<TaskPreferences>(DEFAULT_TASK_PREFERENCES);
  const [ready, setReady] = useState(false);
  const {
    preference,
    loading,
    error,
    setBaseline,
    save,
  } = useUserPreference<TaskPreference>('task-filters', tableKeys);

  // Restore one complete canonical value before preferences become interactive.
  useEffect(() => {
    if (ready || loading || optionsLoading) return;
    const restored = resolveTaskPreference(preference, options, optionsError, tableKeys);
    setPreferences(restored);
    setBaseline(restored);
    setReady(true);
  }, [loading, options, optionsError, optionsLoading, preference, ready, setBaseline, tableKeys]);

  // Every section patches only its owned fields into the latest complete value.
  const updatePreferences = useCallback((patch: Partial<TaskPreferences>) => {
    setPreferences(current => ({ ...current, ...patch }));
    save(current => ({
      ...resolveTaskPreference(current, options, optionsError, tableKeys),
      ...patch,
    }));
  }, [options, optionsError, save, tableKeys]);

  const availableStaffIds = useMemo(
    () => options?.resources.map(resource => resource.id) ?? [],
    [options?.resources],
  );
  const availableProgramIds = useMemo(
    () => options?.programs.map(program => program.id) ?? [],
    [options?.programs],
  );

  const reconcileStaff = useCallback((staffIds: string[]) => {
    updatePreferences({ staffIds });
  }, [updatePreferences]);
  const reconcilePrograms = useCallback((programIds: string[]) => {
    updatePreferences({ programIds });
  }, [updatePreferences]);

  usePreferenceOptionRecovery({
    ready,
    loading: optionsLoading,
    error: optionsError,
    selectedIds: preferences.staffIds,
    availableIds: availableStaffIds,
    onReconcile: reconcileStaff,
  });
  usePreferenceOptionRecovery({
    ready,
    loading: optionsLoading,
    error: optionsError,
    selectedIds: preferences.programIds,
    availableIds: availableProgramIds,
    onReconcile: reconcilePrograms,
  });

  return {
    preferences,
    ready,
    error,
    updatePreferences,
  };
}
