import { useCallback, useEffect, useMemo, useState } from 'react';

import usePreferenceOptionRecovery from '../../../../common/features/preferences/hooks/usePreferenceOptionRecovery';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import { resolvePreferenceSorting } from '../../../../common/features/preferences/preferenceValues';
import type { StaffResource, HoursProgram } from '../types';
import type { ProgramCycle } from '../../../../common/types/cohort';
import type { ListSort } from '../../../../common/types/pagination';

import type { HoursPreferences, HoursSortKey, HoursView } from '../types';

export type StoredHoursPreferences = Partial<HoursPreferences>;

const DEFAULT_HOURS_PREFERENCES: HoursPreferences = {
  view: 'calendar',
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

function resolveHoursView(value: unknown): HoursView {
  return value === 'calendar' || value === 'table'
    ? value
    : DEFAULT_HOURS_PREFERENCES.view;
}

function resolveHoursPreference(
  preference: StoredHoursPreferences | null,
  role: string,
  resources: readonly StaffResource[],
  programs: readonly HoursProgram[],
  cycles: readonly ProgramCycle[],
  preserveSavedOptions: boolean,
  preserveSavedCycle: boolean,
  tableKeys: readonly HoursSortKey[],
): HoursPreferences {
  const savedCycleId = preference?.cycleId ?? null;
  const cycleId = preference
    ? (preserveSavedCycle || cycles.some(cycle => cycle.id === savedCycleId) ? savedCycleId : null)
    : cycles.find(cycle => cycle.state === 'active')?.id ?? cycles[0]?.id ?? null;
  const resourceIds = new Set(resources.map(resource => resource.id));
  const programIds = new Set(['general', ...programs.map(program => program.id)]);

  return {
    view: resolveHoursView(preference?.view),
    staffIds: role === 'admin'
      ? preserveSavedOptions
        ? preference?.staffIds ?? []
        : preference?.staffIds?.filter(id => resourceIds.has(id)) ?? []
      : [],
    programIds: preserveSavedOptions
      ? preference?.programIds ?? []
      : preference?.programIds?.filter(id => programIds.has(id)) ?? [],
    categories: preference?.categories ?? [],
    types: preference?.types ?? [],
    cycleId,
    sorting: resolvePreferenceSorting(preference?.sorting, tableKeys, DEFAULT_SORTING),
    columnWidths: preference?.columnWidths ?? {},
    hiddenColumns: preference?.hiddenColumns ?? [],
  };
}

export default function useHoursPreferences({
  role,
  resources,
  programs,
  cycles,
  loadingDependencies,
  optionsError,
  cyclesError,
  tableKeys,
}: {
  role: string | null;
  resources: readonly StaffResource[];
  programs: readonly HoursProgram[];
  cycles: readonly ProgramCycle[];
  loadingDependencies: boolean;
  optionsError: boolean;
  cyclesError: boolean;
  tableKeys: readonly HoursSortKey[];
}) {
  const [preferences, setPreferences] = useState<HoursPreferences>(DEFAULT_HOURS_PREFERENCES);
  const [ready, setReady] = useState(false);
  const { preference, loading, error, initializePreference, save } = useUserPreference<StoredHoursPreferences>(
    'hours-filters',
    tableKeys,
  );

  useEffect(() => {
    if (ready || loading || loadingDependencies || role === null) return;
    const restored = resolveHoursPreference(
      preference,
      role,
      resources,
      programs,
      cycles,
      optionsError,
      cyclesError,
      tableKeys,
    );
    setPreferences(restored);
    initializePreference(restored);
    setReady(true);
  }, [cycles, cyclesError, loading, loadingDependencies, optionsError, preference, programs, ready, resources, role, initializePreference, tableKeys]);

  const applyPreferencePatch = useCallback((patch: Partial<HoursPreferences>) => {
    setPreferences(current => ({ ...current, ...patch }));
    save(current => ({
      ...resolveHoursPreference(
        current,
        role ?? '',
        resources,
        programs,
        cycles,
        optionsError,
        cyclesError,
        tableKeys,
      ),
      ...patch,
    }));
  }, [cycles, cyclesError, optionsError, programs, resources, role, save, tableKeys]);

  const availableResourceIds = useMemo(() => resources.map(resource => resource.id), [resources]);
  const availableProgramIds = useMemo(
    () => ['general', ...programs.map(program => program.id)],
    [programs],
  );
  const availableCycleIds = useMemo(() => cycles.map(cycle => cycle.id), [cycles]);
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

  const updatePreferences = useCallback((patch: Partial<HoursPreferences>) => {
    applyPreferencePatch(patch);
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
    preferences,
    ready,
    error,
    updatePreferences,
    updateSorting,
    updateColumnWidths,
    updateHiddenColumns,
  };
}
