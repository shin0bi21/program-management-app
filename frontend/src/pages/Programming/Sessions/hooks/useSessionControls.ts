import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { Program } from '../../../../common/features/programs/types';
import usePreferenceOptionRecovery from '../../../../common/features/preferences/hooks/usePreferenceOptionRecovery';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import {
  mergePreferenceDefaults,
  resolveAvailablePreferenceIds,
  resolveAvailablePreferenceValues,
  resolvePreferenceNumberRecord,
  resolvePreferenceSorting,
  resolvePreferenceStringArray,
  resolvePreferenceValue,
} from '../../../../common/features/preferences/preferenceValues';
import type { ProgramCohort, SessionSortKey, SessionType } from '../../../../common/types/cohort';
import type { ListSort } from '../../../../common/types/pagination';
import { getSingleActiveCohort, getSingleAssignedProgram } from '../../common/utils/staffProgrammingDefaults';
import type { SessionPreference, SessionStatusFilter, SessionView } from '../types';

interface UseSessionControlsOptions {
  role: string | null;
  programs: Program[];
  programsLoading: boolean;
  programsError?: string | null;
  cohorts: ProgramCohort[];
  cohortsLoading: boolean;
  cohortsError?: string | null;
  sessionTypes: SessionType[];
  sessionTypesLoading: boolean;
  sessionTypesError?: string | null;
  onFiltersChanged: () => void;
  tableKeys: readonly SessionSortKey[];
}

const DEFAULT_SORTING: ListSort<SessionSortKey> = { key: 'date', direction: 'desc' };
const DEFAULT_SESSION_PREFERENCE: SessionPreference = {
  view: 'calendar',
  programIds: [],
  cohortId: null,
  sessionTypeIds: [],
  statuses: [],
  sorting: DEFAULT_SORTING,
  columnWidths: {},
  hiddenColumns: [],
};

export function useSessionControls({
  role, programs, programsLoading, programsError, cohorts, cohortsLoading, cohortsError,
  sessionTypes, sessionTypesLoading, sessionTypesError, onFiltersChanged, tableKeys,
}: UseSessionControlsOptions) {
  // Search and filters.
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [programIds, setProgramIds] = useState<string[]>([]);
  const [cohortId, setCohortId] = useState('');
  const [sessionTypeIds, setSessionTypeIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<SessionStatusFilter[]>([]);

  // View and table controls.
  const [view, setViewState] = useState<SessionView>('calendar');
  const [sorting, setSortingState] = useState<ListSort<SessionSortKey>>(DEFAULT_SORTING);
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumnsState] = useState<string[]>([]);

  // Persisted preference initialization.
  const [ready, setReady] = useState(false);
  const {
    preference,
    loading: preferenceLoading,
    error,
    loadError,
    initializePreference,
    save,
  } = useUserPreference<SessionPreference>('session-filters', tableKeys);

  const applySearch = useCallback(() => setAppliedSearch(search.trim()), [search]);
  const clearSearch = useCallback(() => {
    setSearch('');
    setAppliedSearch('');
  }, []);

  useEffect(() => {
    if (
      ready
      || preferenceLoading
      || programsLoading
      || cohortsLoading
      || sessionTypesLoading
      || role === null
    ) return;
    const preferenceSource = loadError ? null : preference;
    const resolved = mergePreferenceDefaults(DEFAULT_SESSION_PREFERENCE, preferenceSource);
    const assignedProgram = getSingleAssignedProgram(role, programs);
    const restoredProgramIds = preferenceSource
      ? resolveAvailablePreferenceIds(resolved.programIds, programs, !programsError)
      : assignedProgram ? [assignedProgram.id] : [];
    const restoredCohortId = preferenceSource
      ? cohortsError || cohorts.some(cohort => cohort.id === resolved.cohortId)
        ? resolved.cohortId ?? ''
        : ''
      : assignedProgram ? getSingleActiveCohort(cohorts, assignedProgram.id)?.id ?? '' : '';
    const restoredSessionTypeIds = preferenceSource
      ? resolveAvailablePreferenceIds(resolved.sessionTypeIds, sessionTypes, !sessionTypesError)
      : [];
    const restoredSorting = resolvePreferenceSorting(resolved.sorting, tableKeys, DEFAULT_SORTING);
    const restoredStatuses = resolveAvailablePreferenceValues(
      resolved.statuses,
      [{ value: 'upcoming' }, { value: 'completed' }],
      true,
    );
    const restoredColumnWidths = resolvePreferenceNumberRecord(resolved.columnWidths);
    const restoredHiddenColumns = resolvePreferenceStringArray(resolved.hiddenColumns);
    const restored: SessionPreference = {
      view: resolvePreferenceValue(resolved.view, ['calendar', 'table'], DEFAULT_SESSION_PREFERENCE.view),
      programIds: restoredProgramIds,
      cohortId: restoredCohortId || null,
      sessionTypeIds: restoredSessionTypeIds,
      statuses: restoredStatuses,
      sorting: restoredSorting,
      columnWidths: restoredColumnWidths,
      hiddenColumns: restoredHiddenColumns,
    };
    setViewState(restored.view);
    setProgramIds(restored.programIds);
    setCohortId(restored.cohortId ?? '');
    setSessionTypeIds(restored.sessionTypeIds);
    setStatuses(restored.statuses);
    setSortingState(restoredSorting);
    setColumnWidthsState(restoredColumnWidths);
    setHiddenColumnsState(restoredHiddenColumns);
    initializePreference(restored);
    setReady(true);
  }, [cohorts, cohortsError, cohortsLoading, loadError, preference, preferenceLoading, programs, programsError, programsLoading, ready, role, sessionTypes, sessionTypesError, sessionTypesLoading, initializePreference, tableKeys]);

  // Stable option sets shared by the header and Add Sessions modal.
  const filteredCohorts = useMemo(() => programIds.length
    ? cohorts.filter(cohort => programIds.includes(cohort.programId))
    : cohorts, [cohorts, programIds]);
  const schedulableCohorts = useMemo(() => filteredCohorts.filter(cohort => cohort.state !== 'completed'), [filteredCohorts]);
  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    { id: 'program', label: 'Program', options: programs.map(program => ({ value: program.id, label: program.name })) },
    { id: 'cohort', label: 'Cohort', selectionMode: 'single', options: filteredCohorts.map(cohort => ({ value: cohort.id, label: `${cohort.programName} · ${cohort.name}` })) },
    { id: 'type', label: 'Type', options: sessionTypes.map(type => ({ value: type.id, label: type.name })) },
    { id: 'status', label: 'Status', options: [{ value: 'upcoming', label: 'Upcoming' }, { value: 'completed', label: 'Completed' }] },
  ], [filteredCohorts, programs, sessionTypes]);

  // UI handlers persist complete preference values.
  const persist = useCallback((next: {
    view?: SessionView;
    programIds?: string[];
    cohortId?: string;
    sessionTypeIds?: string[];
    statuses?: SessionStatusFilter[];
    sorting?: ListSort<SessionSortKey>;
    columnWidths?: Record<string, number>;
    hiddenColumns?: string[];
  }) => save(current => ({
    view: resolvePreferenceValue(
      next.view ?? current?.view ?? view,
      ['calendar', 'table'],
      DEFAULT_SESSION_PREFERENCE.view,
    ),
    programIds: next.programIds ?? current?.programIds ?? programIds,
    cohortId: (next.cohortId ?? current?.cohortId ?? cohortId) || null,
    sessionTypeIds: next.sessionTypeIds ?? current?.sessionTypeIds ?? sessionTypeIds,
    statuses: next.statuses ?? current?.statuses ?? statuses,
    sorting: next.sorting ?? current?.sorting ?? sorting,
    columnWidths: next.columnWidths ?? current?.columnWidths ?? columnWidths,
    hiddenColumns: next.hiddenColumns ?? current?.hiddenColumns ?? hiddenColumns,
  })), [cohortId, columnWidths, hiddenColumns, programIds, save, sessionTypeIds, sorting, statuses, view]);

  const availableProgramIds = useMemo(() => programs.map(program => program.id), [programs]);
  const availableCohortIds = useMemo(() => cohorts.map(cohort => cohort.id), [cohorts]);
  const availableSessionTypeIds = useMemo(() => sessionTypes.map(type => type.id), [sessionTypes]);
  const selectedCohortIds = useMemo(() => cohortId ? [cohortId] : [], [cohortId]);

  const reconcilePrograms = useCallback((nextProgramIds: string[]) => {
    setProgramIds(nextProgramIds);
    void persist({ programIds: nextProgramIds });
  }, [persist]);
  const reconcileCohort = useCallback((nextCohortIds: string[]) => {
    const nextCohortId = nextCohortIds[0] ?? '';
    setCohortId(nextCohortId);
    void persist({ cohortId: nextCohortId });
  }, [persist]);
  const reconcileSessionTypes = useCallback((nextSessionTypeIds: string[]) => {
    setSessionTypeIds(nextSessionTypeIds);
    void persist({ sessionTypeIds: nextSessionTypeIds });
  }, [persist]);

  usePreferenceOptionRecovery({
    ready,
    loading: programsLoading,
    error: Boolean(programsError),
    selectedIds: programIds,
    availableIds: availableProgramIds,
    onReconcile: reconcilePrograms,
  });
  usePreferenceOptionRecovery({
    ready,
    loading: cohortsLoading,
    error: Boolean(cohortsError),
    selectedIds: selectedCohortIds,
    availableIds: availableCohortIds,
    onReconcile: reconcileCohort,
  });
  usePreferenceOptionRecovery({
    ready,
    loading: sessionTypesLoading,
    error: Boolean(sessionTypesError),
    selectedIds: sessionTypeIds,
    availableIds: availableSessionTypeIds,
    onReconcile: reconcileSessionTypes,
  });

  const applyFilter = useCallback((key: string, values: string[]) => {
    const nextProgramIds = key === 'program' ? values : programIds;
    const nextCohortId = key === 'program' ? '' : key === 'cohort' ? values[0] ?? '' : cohortId;
    const nextSessionTypeIds = key === 'type' ? values : sessionTypeIds;
    const nextStatuses = key === 'status' ? values as SessionStatusFilter[] : statuses;
    setProgramIds(nextProgramIds);
    setCohortId(nextCohortId);
    setSessionTypeIds(nextSessionTypeIds);
    setStatuses(nextStatuses);
    void persist({ programIds: nextProgramIds, cohortId: nextCohortId, sessionTypeIds: nextSessionTypeIds, statuses: nextStatuses });
    onFiltersChanged();
  }, [cohortId, onFiltersChanged, persist, programIds, sessionTypeIds, statuses]);
  const clearFilters = useCallback(() => {
    setProgramIds([]);
    setCohortId('');
    setSessionTypeIds([]);
    setStatuses([]);
    void persist({ programIds: [], cohortId: '', sessionTypeIds: [], statuses: [] });
    onFiltersChanged();
  }, [onFiltersChanged, persist]);
  const setView = useCallback((next: SessionView) => { setViewState(next); void persist({ view: next }); }, [persist]);
  const setSorting = useCallback((next: ListSort<SessionSortKey>) => { setSortingState(next); void persist({ sorting: next }); }, [persist]);
  const setColumnWidths = useCallback((next: Record<string, number>) => { setColumnWidthsState(next); void persist({ columnWidths: next }); }, [persist]);
  const setHiddenColumns = useCallback((hiddenColumns: string[]) => { setHiddenColumnsState(hiddenColumns); void persist({ hiddenColumns }); }, [persist]);

  return {
    search, setSearch, appliedSearch, applySearch, clearSearch, view, setView, programIds, cohortId, sessionTypeIds, statuses,
    ready, sorting, setSorting, columnWidths, setColumnWidths, hiddenColumns, setHiddenColumns,
    error, filterCategories, applyFilter, clearFilters, schedulableCohorts,
  };
}
