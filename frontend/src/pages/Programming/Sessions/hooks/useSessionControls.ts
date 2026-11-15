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
const SESSION_COLUMN_KEY_ALIASES = { cohort: 'cycle' };
/**
 * Restores session controls and derives cycle bounds, with applied search kept in memory.
 * @param options - Role, reference choices, dependency status, and supported table keys.
 * @example search.apply('workshop') updates the session search without changing saved filters.
 */
export function useSessionControls({
  role, programs, programsLoading, programsError, cycles, cyclesLoading, cyclesError,
  sessionTypes: sessionTypeOptions, sessionTypesLoading, sessionTypesError, tableKeys,
}: UseSessionControlsOptions) {
  // Search and filters.
  const [appliedSearch, setAppliedSearch] = useState('');
  const layout = useTableLayout({ key: 'session-filters', tableKeys, columnKeyAliases: SESSION_COLUMN_KEY_ALIASES });
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'session-filters',
    waiting: role === null || programsLoading || cyclesLoading || sessionTypesLoading,
    fields: {
      view: preferenceOption(['calendar', 'table'] as const, 'calendar'),
      programIds: preferenceIds(programsLoading || programsError ? undefined : programs.map(program => program.id)),
      cycleIds: preferenceIds(cyclesLoading || cyclesError ? undefined : cycles.map(cycle => cycle.id)),
      sessionTypes: preferenceIds(sessionTypesLoading || sessionTypesError ? undefined : sessionTypeOptions.map(type => type.id)),
      statuses: preferenceOptions(['upcoming', 'completed'] as const),
      sorting: preferenceSorting(tableKeys, DEFAULT_SORTING),
    },
  });
  const { view, programIds, cycleIds, sessionTypes, statuses, sorting } = preferences;
  const dateRange = useMemo(() => getCycleDateRange(cycles, cycleIds), [cycles, cycleIds]);

  const filterCategories = useMemo(() => [
    { id: 'programIds' as const, label: 'Program', options: programs },
    { id: 'cycleIds' as const, label: 'Cycle', options: cycles },
    { id: 'sessionTypes' as const, label: 'Type', options: sessionTypeOptions },
    { id: 'statuses' as const, label: 'Status', options: [{ id: 'upcoming', name: 'Upcoming' }, { id: 'completed', name: 'Completed' }] },
  ], [cycles, programs, sessionTypeOptions]);

  const setView = (view: SessionView) => updatePreferences({ view });
  const setSorting = (sorting: ListSort<SessionSortKey>) => updatePreferences({ sorting });

  return {
    ready,
    error,
    view,
    setView,
    search: {
      appliedValue: appliedSearch,
      apply: setAppliedSearch,
    },
    filters: {
      dateRange,
      ...createPreferenceFilters({
        values: {
          programIds,
          cycleIds,
          sessionTypes,
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
