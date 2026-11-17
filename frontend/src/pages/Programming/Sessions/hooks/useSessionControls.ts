import { getCycleDateRange } from '../../../../common/features/programming/cycles/cycleDateRange';
import { useMemo } from 'react';
import createPreferenceFilters from '../../../../common/features/Preferences/createPreferenceFilters';
import type { Program } from '../../../../common/features/programs/types';
import usePreferences from '../../../../common/features/Preferences/usePreferences';
import useTableLayout from '../../../../common/features/Preferences/useTableLayout';
import {
  preferenceText,
  preferenceOption,
  preferenceOptions,
  preferenceIds,
  preferenceSorting,
} from '../../../../common/features/Preferences/preferences';
import type { ProgramCycle } from '../../../../common/features/programming/cycles/types';
import type { SessionSortKey, SessionType, SessionListFilters } from '../types';
import type { ListSort } from '../../../../common/components/Table/Table.types';
import type { SessionStatusFilter } from '../types';

type SessionView = 'calendar' | 'table';

export interface SessionPreference {
  search?: string;
  view: SessionView;
  programIds: string[];
  cycleIds: string[];
  sessionTypes: string[];
  statuses: SessionStatusFilter[];
  sorting?: ListSort<SessionSortKey>;
}

interface UseSessionControlsOptions {
  role: string | null;
  programs: Program[];
  programsLoading: boolean;
  programsError?: string | null;
  cycles: ProgramCycle[];
  cyclesLoading: boolean;
  cyclesError?: string | null;
  sessionTypes: SessionType[];
  sessionTypesLoading: boolean;
  sessionTypesError?: string | null;
  tableKeys: readonly SessionSortKey[];
}

const DEFAULT_SORTING: ListSort<SessionSortKey> = { key: 'date', direction: 'desc' };
const SESSION_COLUMN_KEY_ALIASES = { cohort: 'cycle', theme: 'title' };
/**
 * Restores saved session controls and supplies applied request filters with derived cycle bounds.
 * @param options - Role, reference choices, dependency status, and supported table keys.
 * @example search.apply('workshop') saves search alongside the existing session filters.
 */
export function useSessionControls({
  role, programs, programsLoading, programsError, cycles, cyclesLoading, cyclesError,
  sessionTypes: sessionTypeOptions, sessionTypesLoading, sessionTypesError, tableKeys,
}: UseSessionControlsOptions) {
  // Search and filters.
  const layout = useTableLayout({ key: 'session-filters', tableKeys, columnKeyAliases: SESSION_COLUMN_KEY_ALIASES });
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'session-filters',
    waiting: role === null || programsLoading || cyclesLoading || sessionTypesLoading,
    fields: {
      search: preferenceText(),
      view: preferenceOption(['calendar', 'table'] as const, 'calendar'),
      programIds: preferenceIds(programsLoading || programsError ? undefined : programs.map(program => program.id)),
      cycleIds: preferenceIds(cyclesLoading || cyclesError ? undefined : cycles.map(cycle => cycle.id)),
      sessionTypes: preferenceIds(sessionTypesLoading || sessionTypesError ? undefined : sessionTypeOptions.map(type => type.id)),
      statuses: preferenceOptions(['upcoming', 'completed'] as const),
      sorting: preferenceSorting(tableKeys, DEFAULT_SORTING),
    },
  });
  const { search, view, programIds, cycleIds, sessionTypes, statuses, sorting } = preferences;
  const dateRange = useMemo(() => getCycleDateRange(cycles, cycleIds), [cycles, cycleIds]);

  const filterCategories = useMemo(() => [
    { id: 'programIds' as const, label: 'Program', options: programs.map(({ id, title }) => ({ id, label: title })) },
    { id: 'cycleIds' as const, label: 'Cycle', options: cycles.map(({ id, title }) => ({ id, label: title })) },
    { id: 'sessionTypes' as const, label: 'Type', options: sessionTypeOptions.map(({ id, name }) => ({ id, label: name })) },
    { id: 'statuses' as const, label: 'Status', options: [{ id: 'upcoming', label: 'Upcoming' }, { id: 'completed', label: 'Completed' }] },
  ], [cycles, programs, sessionTypeOptions]);

  const appliedFilters: SessionListFilters = {
    programIds,
    cycleIds,
    sessionTypes,
    statuses,
    dateRange,
    search,
  };

  const setView = (view: SessionView) => updatePreferences({ view });
  const setSorting = (sorting: ListSort<SessionSortKey>) => updatePreferences({ sorting });

  return {
    ready,
    error,
    appliedFilters,
    view,
    setView,
    search: {
      appliedValue: search,
      apply: (search: string) => updatePreferences({ search }),
    },
    filters: createPreferenceFilters({
      values: { programIds, cycleIds, sessionTypes, statuses },
      definitions: filterCategories,
      updatePreferences,
    }),
    table: {
      sorting,
      setSorting,
      columnWidths: layout.columnWidths,
      setColumnWidths: layout.setColumnWidths,
      hiddenColumns: layout.hiddenColumns,
      setHiddenColumns: layout.setHiddenColumns,
    },
  };
}
