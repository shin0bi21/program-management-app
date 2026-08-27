import { useCallback, useEffect, useMemo, useState } from 'react';

import type { FilterCardCategory } from '../../../../../common/components/FilterCard/FilterCard';
import usePreferenceOptionRecovery from '../../../../../common/features/preferences/hooks/usePreferenceOptionRecovery';
import useUserPreference from '../../../../../common/features/preferences/hooks/useUserPreference';
import {
  mergePreferenceDefaults,
  resolveAvailablePreferenceIds,
  resolveAvailablePreferenceValues,
  resolvePreferenceNumberRecord,
  resolvePreferenceSorting,
  resolvePreferenceString,
  resolvePreferenceStringArray,
  resolvePreferenceValue,
} from '../../../../../common/features/preferences/preferenceValues';
import type {
  StaffResource,
  HoursCategory,
  HoursEntryType,
  HoursProgram,
  HoursSortKey,
} from '../../types';
import type { ProgramCycle } from '../../../../../common/types/cohort';
import type { ListSort } from '../../../../../common/types/pagination';

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

const DEFAULT_HOURS_PREFERENCES: HoursPreferences = {
  view: 'calendar',
  search: '',
  staffIds: [],
  programIds: [],
  categories: [],
  types: [],
  cycleId: null,
  sorting: { key: 'date', direction: 'desc' },
  columnWidths: {},
  hiddenColumns: [],
};
const DEFAULT_SORTING = DEFAULT_HOURS_PREFERENCES.sorting;

function resolveHoursPreference(
  preference: StoredHoursPreferences | null,
  role: string,
  resources: readonly StaffResource[],
  programs: readonly HoursProgram[],
  cycles: readonly ProgramCycle[],
  categories: ReadonlyArray<{ value: HoursCategory }>,
  types: ReadonlyArray<{ value: HoursEntryType }>,
  preserveSavedOptions: boolean,
  preserveSavedCycle: boolean,
  tableKeys: readonly HoursSortKey[],
): HoursPreferences {
  const resolved = mergePreferenceDefaults(DEFAULT_HOURS_PREFERENCES, preference);
  const savedCycleId = resolved.cycleId;
  const cycleId = preference
    ? (preserveSavedCycle || cycles.some(cycle => cycle.id === savedCycleId) ? savedCycleId : null)
    : cycles.find(cycle => cycle.state === 'active')?.id ?? cycles[0]?.id ?? null;
  const availablePrograms = [{ id: 'general' }, ...programs];

  return {
    view: resolvePreferenceValue(resolved.view, ['calendar', 'table'], DEFAULT_HOURS_PREFERENCES.view),
    search: resolvePreferenceString(resolved.search),
    staffIds: role === 'admin'
      ? resolveAvailablePreferenceIds(resolved.staffIds, resources, !preserveSavedOptions)
      : [],
    programIds: resolveAvailablePreferenceIds(resolved.programIds, availablePrograms, !preserveSavedOptions),
    categories: resolveAvailablePreferenceValues(resolved.categories, categories, !preserveSavedOptions),
    types: resolveAvailablePreferenceValues(resolved.types, types, !preserveSavedOptions),
    cycleId,
    sorting: resolvePreferenceSorting(preference?.sorting, tableKeys, DEFAULT_SORTING),
    columnWidths: resolvePreferenceNumberRecord(resolved.columnWidths),
    hiddenColumns: resolvePreferenceStringArray(resolved.hiddenColumns),
  };
}

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
  const [preferences, setPreferences] = useState<HoursPreferences>(DEFAULT_HOURS_PREFERENCES);
  const [searchValue, setSearchValue] = useState('');
  const [ready, setReady] = useState(false);
  const { preference, loading, error, loadError, initializePreference, save } = useUserPreference<StoredHoursPreferences>(
    'hours-filters',
    tableKeys,
  );

  useEffect(() => {
    if (ready || loading || loadingDependencies || role === null) return;
    const restored = resolveHoursPreference(
      loadError ? null : preference,
      role,
      resources,
      programs,
      cycles,
      categories,
      types,
      optionsError,
      cyclesError,
      tableKeys,
    );
    setPreferences(restored);
    setSearchValue(restored.search);
    initializePreference(restored);
    setReady(true);
  }, [categories, cycles, cyclesError, loadError, loading, loadingDependencies, optionsError, preference, programs, ready, resources, role, initializePreference, tableKeys, types]);

  const applyPreferencePatch = useCallback((patch: Partial<HoursPreferences>) => {
    setPreferences(current => ({ ...current, ...patch }));
    save(current => ({
      ...resolveHoursPreference(
        current,
        role ?? '',
        resources,
        programs,
        cycles,
        categories,
        types,
        optionsError,
        cyclesError,
        tableKeys,
      ),
      ...patch,
    }));
  }, [categories, cycles, cyclesError, optionsError, programs, resources, role, save, tableKeys, types]);

  const availableResourceIds = useMemo(() => resources.map(resource => resource.id), [resources]);
  const availableProgramIds = useMemo(
    () => ['general', ...programs.map(program => program.id)],
    [programs],
  );
  const availableCycleIds = useMemo(() => cycles.map(cycle => cycle.id), [cycles]);
  const availableCategoryValues = useMemo(() => categories.map(category => category.value), [categories]);
  const availableTypeValues = useMemo(() => types.map(type => type.value), [types]);
  const selectedCycleIds = useMemo(
    () => preferences.cycleId ? [preferences.cycleId] : [],
    [preferences.cycleId],
  );

  const reconcileStaff = useCallback((staffIds: string[]) => {
    applyPreferencePatch({ staffIds });
  }, [applyPreferencePatch]);
  const reconcilePrograms = useCallback((programIds: string[]) => {
    applyPreferencePatch({ programIds });
  }, [applyPreferencePatch]);
  const reconcileCycle = useCallback((cycleIds: string[]) => {
    applyPreferencePatch({ cycleId: cycleIds[0] ?? null });
  }, [applyPreferencePatch]);
  const reconcileCategories = useCallback((nextCategories: string[]) => {
    applyPreferencePatch({ categories: nextCategories as HoursCategory[] });
  }, [applyPreferencePatch]);
  const reconcileTypes = useCallback((nextTypes: string[]) => {
    applyPreferencePatch({ types: nextTypes as HoursEntryType[] });
  }, [applyPreferencePatch]);

  usePreferenceOptionRecovery({
    ready: ready && role === 'admin',
    loading: loadingDependencies,
    error: optionsError,
    selectedIds: preferences.staffIds,
    availableIds: availableResourceIds,
    onReconcile: reconcileStaff,
  });
  usePreferenceOptionRecovery({
    ready,
    loading: loadingDependencies,
    error: optionsError,
    selectedIds: preferences.programIds,
    availableIds: availableProgramIds,
    onReconcile: reconcilePrograms,
  });
  usePreferenceOptionRecovery({
    ready,
    loading: loadingDependencies,
    error: cyclesError,
    selectedIds: selectedCycleIds,
    availableIds: availableCycleIds,
    onReconcile: reconcileCycle,
  });
  usePreferenceOptionRecovery({
    ready,
    loading: loadingDependencies,
    error: optionsError,
    selectedIds: preferences.categories,
    availableIds: availableCategoryValues,
    onReconcile: reconcileCategories,
  });
  usePreferenceOptionRecovery({
    ready,
    loading: loadingDependencies,
    error: optionsError,
    selectedIds: preferences.types,
    availableIds: availableTypeValues,
    onReconcile: reconcileTypes,
  });

  // View preference.
  const setView = useCallback((view: HoursPreferences['view']) => {
    applyPreferencePatch({ view });
  }, [applyPreferencePatch]);

  // Search preference.
  const applySearch = useCallback(() => {
    applyPreferencePatch({ search: searchValue.trim() });
  }, [applyPreferencePatch, searchValue]);
  const clearSearch = useCallback(() => {
    setSearchValue('');
    applyPreferencePatch({ search: '' });
  }, [applyPreferencePatch]);

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

  const applyFilter = useCallback((id: string, selected: string[]) => {
    if (id === 'staff') applyPreferencePatch({ staffIds: selected });
    if (id === 'program') applyPreferencePatch({ programIds: selected });
    if (id === 'entryType') applyPreferencePatch({ categories: selected as HoursCategory[] });
    if (id === 'type') applyPreferencePatch({ types: selected as HoursEntryType[] });
    if (id === 'cycle') applyPreferencePatch({ cycleId: selected[0] ?? null });
  }, [applyPreferencePatch]);

  const clearFilters = useCallback(() => applyPreferencePatch({
    staffIds: [],
    programIds: [],
    categories: [],
    types: [],
    cycleId: null,
  }), [applyPreferencePatch]);

  const selectCycle = useCallback((cycleId: string) => {
    applyPreferencePatch({ cycleId });
  }, [applyPreferencePatch]);

  const updateSorting = useCallback((sorting: ListSort<HoursSortKey>) => {
    applyPreferencePatch({ sorting });
  }, [applyPreferencePatch]);
  const updateColumnWidths = useCallback((columnWidths: Record<string, number>) => {
    applyPreferencePatch({ columnWidths });
  }, [applyPreferencePatch]);
  const updateHiddenColumns = useCallback((hiddenColumns: string[]) => {
    applyPreferencePatch({ hiddenColumns });
  }, [applyPreferencePatch]);

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
