import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { Program } from '../../../../common/features/programs/types';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import type { ProgramCohort, SessionSortKey, SessionType } from '../../../../common/types/cohort';
import type { ListSort } from '../../../../common/types/pagination';
import { getSingleActiveCohort, getSingleAssignedProgram } from '../../common/utils/staffProgrammingDefaults';
import type { SessionStatusFilter, SessionsView } from '../sessionViewTypes';

interface UseSessionControlsOptions {
  role: string | null;
  programs: Program[];
  programsLoading: boolean;
  cohorts: ProgramCohort[];
  cohortsLoading: boolean;
  sessionTypes: SessionType[];
  onFiltersChanged: () => void;
}

export function useSessionControls({
  role, programs, programsLoading, cohorts, cohortsLoading, sessionTypes, onFiltersChanged,
}: UseSessionControlsOptions) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [view, setViewState] = useState<SessionsView>('calendar');
  const [programIds, setProgramIds] = useState<string[]>([]);
  const [cohortId, setCohortId] = useState('');
  const [sessionTypeIds, setSessionTypeIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<SessionStatusFilter[]>([]);
  const [ready, setReady] = useState(false);
  const [sorting, setSortingState] = useState<ListSort<SessionSortKey>>({ key: 'date', direction: 'desc' });
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const { preference, loading: preferenceLoading, error, save } = useUserPreference('session-filters');

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (ready || preferenceLoading || programsLoading || cohortsLoading || role === null) return;
    const availableProgramIds = new Set(programs.map(program => program.id));
    if (preference) {
      const savedProgramIds = preference.programIds.filter(id => availableProgramIds.has(id));
      setViewState(preference.view);
      setProgramIds(savedProgramIds);
      setCohortId(cohorts.some(cohort => cohort.id === preference.cohortId) ? preference.cohortId ?? '' : '');
      setSessionTypeIds(preference.sessionTypeIds);
      setStatuses(preference.statuses);
      setSortingState(preference.sorting ?? { key: 'date', direction: 'desc' });
      setColumnWidthsState(preference.columnWidths ?? {});
    } else {
      const assignedProgram = getSingleAssignedProgram(role, programs);
      setProgramIds(assignedProgram ? [assignedProgram.id] : []);
      setCohortId(assignedProgram ? getSingleActiveCohort(cohorts, assignedProgram.id)?.id ?? '' : '');
    }
    setReady(true);
  }, [cohorts, cohortsLoading, preference, preferenceLoading, programs, programsLoading, ready, role]);

  const persist = useCallback((next: {
    view?: SessionsView;
    programIds?: string[];
    cohortId?: string;
    sessionTypeIds?: string[];
    statuses?: SessionStatusFilter[];
    sorting?: ListSort<SessionSortKey>;
    columnWidths?: Record<string, number>;
    hiddenColumns?: string[];
  }) => save({
    view: next.view ?? view,
    programIds: next.programIds ?? programIds,
    cohortId: (next.cohortId ?? cohortId) || null,
    sessionTypeIds: next.sessionTypeIds ?? sessionTypeIds,
    statuses: next.statuses ?? statuses,
    sorting: next.sorting ?? sorting,
    columnWidths: next.columnWidths ?? columnWidths,
    hiddenColumns: next.hiddenColumns ?? preference?.hiddenColumns ?? [],
  }), [cohortId, columnWidths, preference?.hiddenColumns, programIds, save, sessionTypeIds, sorting, statuses, view]);

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
  const setHiddenColumns = useCallback((hiddenColumns: string[]) => { void persist({ hiddenColumns }); }, [persist]);

  return {
    search, setSearch, debouncedSearch, view, setView, programIds, cohortId, sessionTypeIds, statuses,
    ready, sorting, setSorting, columnWidths, setColumnWidths, hiddenColumns: preference?.hiddenColumns ?? [], setHiddenColumns,
    error, filterCategories, applyFilter, clearFilters, schedulableCohorts,
  };
}
