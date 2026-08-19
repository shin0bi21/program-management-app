import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { Program } from '../../../../common/features/programs/types';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import type { ProgramCohort, SessionSortKey, SessionType } from '../../../../common/types/cohort';
import type { ListSort } from '../../../../common/types/pagination';
import { getSingleActiveCohort, getSingleAssignedProgram } from '../../common/utils/staffProgrammingDefaults';
import type { SessionPreference, SessionStatusFilter, SessionsView } from '../types';

interface UseSessionControlsOptions {
  role: string | null;
  programs: Program[];
  programsLoading: boolean;
  programsError?: string | null;
  cohorts: ProgramCohort[];
  cohortsLoading: boolean;
  cohortsError?: string | null;
  sessionTypes: SessionType[];
  onFiltersChanged: () => void;
  columnKeys: readonly string[];
}

export function useSessionControls({
  role, programs, programsLoading, programsError, cohorts, cohortsLoading, cohortsError,
  sessionTypes, onFiltersChanged, columnKeys,
}: UseSessionControlsOptions) {
  // Search and filters.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [programIds, setProgramIds] = useState<string[]>([]);
  const [cohortId, setCohortId] = useState('');
  const [sessionTypeIds, setSessionTypeIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<SessionStatusFilter[]>([]);

  // View and table controls.
  const [view, setViewState] = useState<SessionsView>('calendar');
  const [sorting, setSortingState] = useState<ListSort<SessionSortKey>>({ key: 'date', direction: 'desc' });
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumnsState] = useState<string[]>([]);

  // Persisted preference initialization.
  const [ready, setReady] = useState(false);
  const {
    preference,
    loading: preferenceLoading,
    error,
    setBaseline,
    save,
  } = useUserPreference<SessionPreference>('session-filters', columnKeys);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (ready || preferenceLoading || programsLoading || cohortsLoading || role === null) return;
    const availableProgramIds = new Set(programs.map(program => program.id));
    const assignedProgram = getSingleAssignedProgram(role, programs);
    const restoredProgramIds = preference
      ? programsError
        ? preference.programIds
        : preference.programIds.filter(id => availableProgramIds.has(id))
      : assignedProgram ? [assignedProgram.id] : [];
    const restoredCohortId = preference
      ? cohortsError || cohorts.some(cohort => cohort.id === preference.cohortId)
        ? preference.cohortId ?? ''
        : ''
      : assignedProgram ? getSingleActiveCohort(cohorts, assignedProgram.id)?.id ?? '' : '';
    const restoredSorting = preference?.sorting ?? { key: 'date', direction: 'desc' };
    const restoredColumnWidths = preference?.columnWidths ?? {};
    const restoredHiddenColumns = preference?.hiddenColumns ?? [];
    const restored: SessionPreference = {
      view: preference?.view ?? 'calendar',
      programIds: restoredProgramIds,
      cohortId: restoredCohortId || null,
      sessionTypeIds: preference?.sessionTypeIds ?? [],
      statuses: preference?.statuses ?? [],
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
    setBaseline(restored);
    setReady(true);
  }, [cohorts, cohortsError, cohortsLoading, preference, preferenceLoading, programs, programsError, programsLoading, ready, role, setBaseline]);

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
    view?: SessionsView;
    programIds?: string[];
    cohortId?: string;
    sessionTypeIds?: string[];
    statuses?: SessionStatusFilter[];
    sorting?: ListSort<SessionSortKey>;
    columnWidths?: Record<string, number>;
    hiddenColumns?: string[];
  }) => save(current => ({
    view: next.view ?? current?.view ?? view,
    programIds: next.programIds ?? current?.programIds ?? programIds,
    cohortId: (next.cohortId ?? current?.cohortId ?? cohortId) || null,
    sessionTypeIds: next.sessionTypeIds ?? current?.sessionTypeIds ?? sessionTypeIds,
    statuses: next.statuses ?? current?.statuses ?? statuses,
    sorting: next.sorting ?? current?.sorting ?? sorting,
    columnWidths: next.columnWidths ?? current?.columnWidths ?? columnWidths,
    hiddenColumns: next.hiddenColumns ?? current?.hiddenColumns ?? hiddenColumns,
  })), [cohortId, columnWidths, hiddenColumns, programIds, save, sessionTypeIds, sorting, statuses, view]);

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
  const setView = useCallback((next: SessionsView) => { setViewState(next); void persist({ view: next }); }, [persist]);
  const setSorting = useCallback((next: ListSort<SessionSortKey>) => { setSortingState(next); void persist({ sorting: next }); }, [persist]);
  const setColumnWidths = useCallback((next: Record<string, number>) => { setColumnWidthsState(next); void persist({ columnWidths: next }); }, [persist]);
  const setHiddenColumns = useCallback((hiddenColumns: string[]) => { setHiddenColumnsState(hiddenColumns); void persist({ hiddenColumns }); }, [persist]);

  return {
    search, setSearch, debouncedSearch, view, setView, programIds, cohortId, sessionTypeIds, statuses,
    ready, sorting, setSorting, columnWidths, setColumnWidths, hiddenColumns, setHiddenColumns,
    error, filterCategories, applyFilter, clearFilters, schedulableCohorts,
  };
}
