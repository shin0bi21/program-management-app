import { useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { Program } from '../../../../common/features/programs/types';
import usePreferences from '../../../../common/features/Preferences/usePreferences';
import {
  preferenceOption,
  preferenceOptions,
  preferenceIds,
  optionalPreferenceId,
  preferenceSorting,
  preferenceColumnWidths,
  preferenceHiddenColumns,
} from '../../../../common/features/Preferences/preferences';
import type { ProgramCohort } from '../../Cohorts/types';
import type { SessionSortKey, SessionType } from '../types';
import type { ListSort } from '../../../../common/components/Table/Table.types';
import type { SessionStatusFilter } from '../types';

type SessionView = 'calendar' | 'table';

export interface SessionPreference {
  view: SessionView;
  programIds: string[];
  cohortId: string | null;
  sessionTypeIds: string[];
  statuses: SessionStatusFilter[];
  sorting?: ListSort<SessionSortKey>;
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}

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
  tableKeys: readonly SessionSortKey[];
}

const DEFAULT_SORTING: ListSort<SessionSortKey> = { key: 'date', direction: 'desc' };
export function useSessionControls({
  role, programs, programsLoading, programsError, cohorts, cohortsLoading, cohortsError,
  sessionTypes, sessionTypesLoading, sessionTypesError, tableKeys,
}: UseSessionControlsOptions) {
  // Search and filters.
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'session-filters',
    waiting: role === null || programsLoading || cohortsLoading || sessionTypesLoading,
    fields: {
      view: preferenceOption(['calendar', 'table'] as const, 'calendar'),
      programIds: preferenceIds(programsLoading || programsError ? undefined : programs.map(program => program.id)),
      cohortId: optionalPreferenceId(cohortsLoading || cohortsError ? undefined : cohorts.map(cohort => cohort.id)),
      sessionTypeIds: preferenceIds(sessionTypesLoading || sessionTypesError ? undefined : sessionTypes.map(type => type.id)),
      statuses: preferenceOptions(['upcoming', 'completed'] as const),
      sorting: preferenceSorting(tableKeys, DEFAULT_SORTING),
      columnWidths: preferenceColumnWidths(tableKeys),
      hiddenColumns: preferenceHiddenColumns(tableKeys),
    },
  });
  const { view, programIds, sessionTypeIds, statuses, sorting, columnWidths, hiddenColumns } = preferences;
  const cohortId = preferences.cohortId ?? '';

  const applySearch = () => setAppliedSearch(search.trim());
  const clearSearch = () => {
    setSearch('');
    setAppliedSearch('');
  };

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

  const applyFilter = (key: string, values: string[]) => {
    switch (key) {
      case 'program':
        updatePreferences({ programIds: values, cohortId: null });
        break;
      case 'cohort':
        updatePreferences({ cohortId: values[0] ?? null });
        break;
      case 'type':
        updatePreferences({ sessionTypeIds: values });
        break;
      case 'status':
        updatePreferences({ statuses: values as SessionStatusFilter[] });
        break;
    }
  };
  const clearFilters = () => updatePreferences({ programIds: [], cohortId: null, sessionTypeIds: [], statuses: [] });
  const setView = (view: SessionView) => updatePreferences({ view });
  const setSorting = (sorting: ListSort<SessionSortKey>) => updatePreferences({ sorting });
  const setColumnWidths = (columnWidths: Record<string, number>) => updatePreferences({ columnWidths });
  const setHiddenColumns = (hiddenColumns: string[]) => updatePreferences({ hiddenColumns });

  return {
    ready,
    error,
    view,
    setView,
    schedulableCohorts,
    search: {
      value: search,
      setValue: setSearch,
      appliedValue: appliedSearch,
      apply: applySearch,
      clear: clearSearch,
    },
    filters: {
      programIds,
      cohortId,
      sessionTypeIds,
      statuses,
      definitions: filterCategories,
      apply: applyFilter,
      clear: clearFilters,
    },
    table: {
      sorting,
      setSorting,
      columnWidths,
      setColumnWidths,
      hiddenColumns,
      setHiddenColumns,
    },
  };
}
