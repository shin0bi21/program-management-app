import { useCallback, useEffect, useMemo, useState } from 'react';

import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import { resolvePreferenceSorting } from '../../../../common/features/preferences/preferenceValues';
import type { ListSort } from '../../../../common/types/pagination';

import {
  type TaskCategory,
  type TaskStatus,
  type TaskReferenceData,
  type TaskSortKey,
} from '../types';

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
    initializePreference,
    save,
  } = useUserPreference<StoredTaskPreferences>('task-preferences', tableKeys);

  const preserveUnverifiedSelections = referenceDataError;
  const preferences = useMemo(() => normalizeTaskPreferences(
    storedPreferences,
    referenceData,
    preserveUnverifiedSelections,
    tableKeys,
  ), [referenceData, preserveUnverifiedSelections, storedPreferences, tableKeys]);

  const buildNextPreferences = useCallback((
    current: StoredTaskPreferences | TaskPreferences | null,
    patch: Partial<TaskPreferences>,
  ) => ({
    ...normalizeTaskPreferences(
      current,
      referenceData,
      preserveUnverifiedSelections,
      tableKeys,
    ),
    ...patch,
  }), [referenceData, preserveUnverifiedSelections, tableKeys]);

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
      categories: filterAvailableValues(selected, referenceData?.categories),
    });
    if (id === 'status') updatePreferences({
      statuses: filterAvailableValues(selected, referenceData?.statuses),
    });
  }, [referenceData, updatePreferences]);

  const clearFilters = useCallback(() => updatePreferences({
    staffIds: [],
    programIds: [],
    categories: [],
    statuses: [],
  }), [updatePreferences]);

  useEffect(() => {
    if (!ready || referenceDataLoading || referenceDataError) return;
    const normalized = normalizeTaskPreferences(storedPreferences, referenceData, false, tableKeys);
    if (
      haveSameValues(storedPreferences?.staffIds ?? [], normalized.staffIds)
      && haveSameValues(storedPreferences?.programIds ?? [], normalized.programIds)
      && haveSameValues(storedPreferences?.categories ?? [], normalized.categories)
      && haveSameValues(storedPreferences?.statuses ?? [], normalized.statuses)
    ) return;

    updatePreferences({
      staffIds: normalized.staffIds,
      programIds: normalized.programIds,
      categories: normalized.categories,
      statuses: normalized.statuses,
    });
  }, [ready, referenceData, referenceDataError, referenceDataLoading, storedPreferences, tableKeys, updatePreferences]);

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
  preserveUnverifiedSelections: boolean,
  tableKeys: readonly TaskSortKey[],
): TaskPreferences {
  const resolved = {
    ...DEFAULT_TASK_PREFERENCES,
    ...preference,
  };
  const resourceIds = new Set(referenceData?.resources.map(resource => resource.id) ?? []);
  const programIds = new Set(referenceData?.programs.map(program => program.id) ?? []);
  const categories = preserveUnverifiedSelections
    ? resolved.categories
    : filterAvailableValues(resolved.categories, referenceData?.categories);
  const statuses = preserveUnverifiedSelections
    ? resolved.statuses
    : filterAvailableValues(resolved.statuses, referenceData?.statuses);

  return {
    ...resolved,
    view: resolved.view,
    search: resolved.search.trim(),

    staffIds: preserveUnverifiedSelections
      ? resolved.staffIds
      : resolved.staffIds.filter(id => resourceIds.has(id)),
    programIds: preserveUnverifiedSelections
      ? resolved.programIds
      : resolved.programIds.filter(id => programIds.has(id)),
    categories,
    statuses,

    sorting: resolvePreferenceSorting(
      resolved.sorting,
      tableKeys,
      DEFAULT_TASK_PREFERENCES.sorting,
    ),
    columnWidths: resolved.columnWidths ?? {},
    hiddenColumns: resolved.hiddenColumns ?? [],
  };
}

function filterAvailableValues<T extends string>(
  values: readonly string[],
  options: ReadonlyArray<{ value: T }> | undefined,
): T[] {
  return (options ?? [])
    .filter(option => values.includes(option.value))
    .map(option => option.value);
}

function haveSameValues(current: readonly string[], next: readonly string[]) {
  return current.length === next.length
    && current.every((value, index) => value === next[index]);
}
