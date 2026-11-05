import { toFilterOptions } from '../../../../common/features/referenceData/filterOptions';
import { getCycleDateRange } from '../../../../common/features/programming/cycles/cycleDateRange';
import { useMemo, useState } from 'react';
import createPreferenceFilters from '../../../../common/features/Preferences/createPreferenceFilters';
import type { Program } from '../../../../common/features/programs/types';
import usePreferences from '../../../../common/features/Preferences/usePreferences';
import useTableLayout from '../../../../common/features/Preferences/useTableLayout';
import {
  preferenceOption,
  preferenceOptions,
  preferenceIds,
  preferenceSorting,
} from '../../../../common/features/Preferences/preferences';
import type { ProgramCycle } from '../../../../common/features/programming/cycles/types';
import type { SessionSortKey, SessionType } from '../types';
import type { ListSort } from '../../../../common/components/Table/Table.types';
import type { SessionStatusFilter } from '../types';

type SessionView = 'calendar' | 'table';

export interface SessionPreference {
  view: SessionView;
  programIds: string[];
  cycleIds: string[];
  sessionTypeIds: string[];
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
const SESSION_COLUMN_KEY_ALIASES = { cohort: 'cycle' };
export function useSessionControls({
  role, programs, programsLoading, programsError, cycles, cyclesLoading, cyclesError,
  sessionTypes, sessionTypesLoading, sessionTypesError, tableKeys,
}: UseSessionControlsOptions) {
  // Search and filters.
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const layout = useTableLayout({ key: 'session-filters', tableKeys, columnKeyAliases: SESSION_COLUMN_KEY_ALIASES });
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'session-filters',
    waiting: role === null || programsLoading || cyclesLoading || sessionTypesLoading,
    fields: {
      view: preferenceOption(['calendar', 'table'] as const, 'calendar'),
      programIds: preferenceIds(programsLoading || programsError ? undefined : programs.map(program => program.id)),
      cycleIds: preferenceIds(cyclesLoading || cyclesError ? undefined : cycles.map(cycle => cycle.id)),
      sessionTypeIds: preferenceIds(sessionTypesLoading || sessionTypesError ? undefined : sessionTypes.map(type => type.id)),
      statuses: preferenceOptions(['upcoming', 'completed'] as const),
      sorting: preferenceSorting(tableKeys, DEFAULT_SORTING),
    },
  });
  const { view, programIds, cycleIds, sessionTypeIds, statuses, sorting } = preferences;
  const dateRange = useMemo(() => getCycleDateRange(cycles, cycleIds), [cycles, cycleIds]);

  const applySearch = () => setAppliedSearch(search.trim());
  const clearSearch = () => {
    setSearch('');
    setAppliedSearch('');
  };

  const filterCategories = useMemo(() => [
    { id: 'programIds' as const, label: 'Program', options: toFilterOptions(programs) },
    { id: 'cycleIds' as const, label: 'Cycle', options: toFilterOptions(cycles) },
    { id: 'sessionTypeIds' as const, label: 'Type', options: toFilterOptions(sessionTypes) },
    { id: 'statuses' as const, label: 'Status', options: [{ value: 'upcoming', label: 'Upcoming' }, { value: 'completed', label: 'Completed' }] },
  ], [cycles, programs, sessionTypes]);

  const setView = (view: SessionView) => updatePreferences({ view });
  const setSorting = (sorting: ListSort<SessionSortKey>) => updatePreferences({ sorting });

  return {
    ready,
    error,
    view,
    setView,
    search: {
      value: search,
      setValue: setSearch,
      appliedValue: appliedSearch,
      apply: applySearch,
      clear: clearSearch,
    },
    filters: {
      dateRange,
      ...createPreferenceFilters({
        values: {
          programIds,
          cycleIds,
          sessionTypeIds,
          statuses,
        },
        definitions: filterCategories,
        updatePreferences,
      }),
    },
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
