import { useCallback, useEffect, useMemo, useState } from 'react';

import type { FilterCardCategory } from '../../../../../common/components/FilterCard/FilterCard';
import useUserPreference from '../../../../../common/features/Preferences/hooks/useUserPreference';
import {
  haveSamePreferenceValues,
  mergePreferenceDefaults,
  resolveAvailablePreferenceIds,
  resolveAvailablePreferenceValues,
  resolvePreferenceNumberRecord,
  resolvePreferenceSorting,
  resolvePreferenceString,
  resolvePreferenceStringArray,
  resolvePreferenceValue,
} from '../../../../../common/features/Preferences/preferenceValues';
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

const DEFAULT_TASK_PREFERENCES: TaskPreferences = {
  view: 'calendar',
  search: '',
  staffIds: [],
  programIds: [],
  categories: [],
  statuses: [],
  sorting: { key: 'startDate', direction: 'asc' },
  columnWidths: {},
  hiddenColumns: [],
};
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

  // Preference lifecycle.
  const [ready, setReady] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const {
    preference: storedPreferences,
    loading,
    error,
    loadError,
    initializePreference,
    save,
  } = useUserPreference<StoredTaskPreferences>('task-preferences', tableKeys);

  const canVerifyOptions = !referenceDataError;
  const preferenceSource = loadError ? null : storedPreferences;
  const preferences = useMemo(() => normalizeTaskPreferences(
    preferenceSource,
    referenceData,
    canVerifyOptions,
    tableKeys,
  ), [canVerifyOptions, preferenceSource, referenceData, tableKeys]);

  const buildNextPreferences = useCallback((
    current: StoredTaskPreferences | TaskPreferences | null,
    patch: Partial<TaskPreferences>,
  ) => ({
    ...normalizeTaskPreferences(
      current,
      referenceData,
      canVerifyOptions,
      tableKeys,
    ),
    ...patch,
  }), [canVerifyOptions, referenceData, tableKeys]);

  useEffect(() => {
    if (ready || loading || referenceDataLoading) return;
    setSearchValue(preferences.search);
    initializePreference(preferences);
    setReady(true);
  }, [loading, referenceDataLoading, preferences, ready, initializePreference]);

  const updatePreferences = useCallback((patch: Partial<TaskPreferences>) => {
    save(current => buildNextPreferences(current, patch));
  }, [buildNextPreferences, save]);

  // View preference.
  const setView = useCallback((view: TasksView) => {
    updatePreferences({ view });
  }, [updatePreferences]);

  // Search preference.
  const applySearch = useCallback(() => {
    updatePreferences({ search: searchValue.trim() });
  }, [searchValue, updatePreferences]);

  const clearSearch = useCallback(() => {
    setSearchValue('');
    updatePreferences({ search: '' });
  }, [updatePreferences]);

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

  const applyFilter = useCallback((id: string, selected: string[]) => {
    if (id === 'staff') updatePreferences({ staffIds: selected });
    if (id === 'program') updatePreferences({ programIds: selected });
    if (id === 'category') updatePreferences({
      categories: resolveAvailablePreferenceValues(selected, referenceData?.categories, true),
    });
    if (id === 'status') updatePreferences({
      statuses: resolveAvailablePreferenceValues(selected, referenceData?.statuses, true),
    });
  }, [referenceData, updatePreferences]);

  const clearFilters = useCallback(() => updatePreferences({
    staffIds: [],
    programIds: [],
    categories: [],
    statuses: [],
  }), [updatePreferences]);

  useEffect(() => {
    if (!ready || loadError || referenceDataLoading || referenceDataError) return;
    const normalized = normalizeTaskPreferences(storedPreferences, referenceData, true, tableKeys);
    if (
      haveSamePreferenceValues(storedPreferences?.staffIds ?? [], normalized.staffIds)
      && haveSamePreferenceValues(storedPreferences?.programIds ?? [], normalized.programIds)
      && haveSamePreferenceValues(storedPreferences?.categories ?? [], normalized.categories)
      && haveSamePreferenceValues(storedPreferences?.statuses ?? [], normalized.statuses)
    ) return;

    updatePreferences({
      staffIds: normalized.staffIds,
      programIds: normalized.programIds,
      categories: normalized.categories,
      statuses: normalized.statuses,
    });
  }, [loadError, ready, referenceData, referenceDataError, referenceDataLoading, storedPreferences, tableKeys, updatePreferences]);

  // Table sorting.
  const setSorting = useCallback((sorting: ListSort<TaskSortKey>) => {
    updatePreferences({ sorting });
  }, [updatePreferences]);

  // Column widths.
  const setColumnWidths = useCallback((columnWidths: Record<string, number>) => {
    updatePreferences({ columnWidths });
  }, [updatePreferences]);

  // Hidden columns.
  const setHiddenColumns = useCallback((hiddenColumns: string[]) => {
    updatePreferences({ hiddenColumns });
  }, [updatePreferences]);

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

function normalizeTaskPreferences(
  preference: StoredTaskPreferences | TaskPreferences | null,
  referenceData: TaskReferenceData | undefined,
  canVerifyOptions: boolean,
  tableKeys: readonly TaskSortKey[],
): TaskPreferences {
  const resolved = mergePreferenceDefaults(DEFAULT_TASK_PREFERENCES, preference);

  return {
    ...resolved,
    view: resolvePreferenceValue(resolved.view, ['calendar', 'table'], DEFAULT_TASK_PREFERENCES.view),
    search: resolvePreferenceString(resolved.search),
    staffIds: resolveAvailablePreferenceIds(resolved.staffIds, referenceData?.resources, canVerifyOptions),
    programIds: resolveAvailablePreferenceIds(resolved.programIds, referenceData?.programs, canVerifyOptions),
    categories: resolveAvailablePreferenceValues(resolved.categories, referenceData?.categories, canVerifyOptions),
    statuses: resolveAvailablePreferenceValues(resolved.statuses, referenceData?.statuses, canVerifyOptions),
    sorting: resolvePreferenceSorting(
      resolved.sorting,
      tableKeys,
      DEFAULT_TASK_PREFERENCES.sorting,
    ),
    columnWidths: resolvePreferenceNumberRecord(resolved.columnWidths),
    hiddenColumns: resolvePreferenceStringArray(resolved.hiddenColumns),
  };
}
