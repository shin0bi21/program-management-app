import { useCallback, useEffect, useMemo, useState } from 'react';

import usePreferenceOptionRecovery from '../../../../common/features/preferences/hooks/usePreferenceOptionRecovery';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import { resolvePreferenceSorting } from '../../../../common/features/preferences/preferenceValues';
import type { StaffResource, TimeEntryProgram } from '../../../../common/features/timeEntries/types';
import type { ProgramCycle } from '../../../../common/types/cohort';

import type { TimesheetPreference, TimesheetPreferences, TimesheetSortKey } from '../types';

const DEFAULT_TIMESHEET_PREFERENCES: TimesheetPreferences = {
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
const DEFAULT_SORTING = DEFAULT_TIMESHEET_PREFERENCES.sorting;

function resolveTimesheetPreference(
  preference: TimesheetPreference | null,
  role: string,
  resources: readonly StaffResource[],
  programs: readonly TimeEntryProgram[],
  cycles: readonly ProgramCycle[],
  preserveSavedOptions: boolean,
  preserveSavedCycle: boolean,
  sortKeys: readonly TimesheetSortKey[],
): TimesheetPreferences {
  const savedCycleId = preference?.cycleId ?? null;
  const cycleId = preference
    ? (preserveSavedCycle || cycles.some(cycle => cycle.id === savedCycleId) ? savedCycleId : null)
    : cycles.find(cycle => cycle.state === 'active')?.id ?? cycles[0]?.id ?? null;
  const resourceIds = new Set(resources.map(resource => resource.id));
  const programIds = new Set(['general', ...programs.map(program => program.id)]);

  return {
    view: preference?.view ?? DEFAULT_TIMESHEET_PREFERENCES.view,
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
    sorting: resolvePreferenceSorting(preference?.sorting, sortKeys, DEFAULT_SORTING),
    columnWidths: preference?.columnWidths ?? {},
    hiddenColumns: preference?.hiddenColumns ?? [],
  };
}

export default function useTimesheetPreferences({
  role,
  resources,
  programs,
  cycles,
  loadingDependencies,
  optionsError,
  cyclesError,
  columnKeys,
  sortKeys,
}: {
  role: string | null;
  resources: readonly StaffResource[];
  programs: readonly TimeEntryProgram[];
  cycles: readonly ProgramCycle[];
  loadingDependencies: boolean;
  optionsError: boolean;
  cyclesError: boolean;
  columnKeys: readonly string[];
  sortKeys: readonly TimesheetSortKey[];
}) {
  const [preferences, setPreferences] = useState<TimesheetPreferences>(DEFAULT_TIMESHEET_PREFERENCES);
  const [ready, setReady] = useState(false);
  const { preference, loading, error, setBaseline, save } = useUserPreference<TimesheetPreference>(
    'timesheet-filters',
    columnKeys,
  );

  useEffect(() => {
    if (ready || loading || loadingDependencies || role === null) return;
    const restored = resolveTimesheetPreference(
      preference,
      role,
      resources,
      programs,
      cycles,
      optionsError,
      cyclesError,
      sortKeys,
    );
    setPreferences(restored);
    setBaseline(restored);
    setReady(true);
  }, [cycles, cyclesError, loading, loadingDependencies, optionsError, preference, programs, ready, resources, role, setBaseline, sortKeys]);

  const applyPreferencePatch = useCallback((patch: Partial<TimesheetPreferences>) => {
    setPreferences(current => ({ ...current, ...patch }));
    save(current => ({
      ...resolveTimesheetPreference(
        current,
        role ?? '',
        resources,
        programs,
        cycles,
        optionsError,
        cyclesError,
        sortKeys,
      ),
      ...patch,
    }));
  }, [cycles, cyclesError, optionsError, programs, resources, role, save, sortKeys]);

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

  const updatePreferences = useCallback((patch: Partial<TimesheetPreferences>) => {
    applyPreferencePatch(patch);
  }, [applyPreferencePatch]);

  return { preferences, ready, error, updatePreferences };
}
