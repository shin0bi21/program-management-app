import type { DateRange } from '../../../../common/utils/dateRange';
import { useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { Program } from '../../../../common/features/programs/types';
import usePreferences from '../../../../common/features/Preferences/usePreferences';
import {
  preferenceDateRange,
  preferenceOption,
  preferenceOptions,
  preferenceIds,
  preferenceSorting,
  preferenceColumnWidths,
  preferenceHiddenColumns,
} from '../../../../common/features/Preferences/preferences';
import type { ProgramCycle } from '../../../../common/features/programming/cycles/types';
import type { SessionSortKey, SessionType } from '../types';
import type { ListSort } from '../../../../common/components/Table/Table.types';
import type { SessionStatusFilter } from '../types';

type SessionView = 'calendar' | 'table';

export interface SessionPreference {
  view: SessionView;
  dateRange?: DateRange;
  programIds: string[];
  cycleIds: string[];
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
  cycles: ProgramCycle[];
  cyclesLoading: boolean;
  cyclesError?: string | null;
  sessionTypes: SessionType[];
  sessionTypesLoading: boolean;
  sessionTypesError?: string | null;
  tableKeys: readonly SessionSortKey[];
}

const DEFAULT_SORTING: ListSort<SessionSortKey> = { key: 'date', direction: 'desc' };
export function useSessionControls({
  role, programs, programsLoading, programsError, cycles, cyclesLoading, cyclesError,
  sessionTypes, sessionTypesLoading, sessionTypesError, tableKeys,
}: UseSessionControlsOptions) {
  // Search and filters.
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'session-filters',
    waiting: role === null || programsLoading || cyclesLoading || sessionTypesLoading,
    fields: {
      dateRange: preferenceDateRange(),
      view: preferenceOption(['calendar', 'table'] as const, 'calendar'),
      programIds: preferenceIds(programsLoading || programsError ? undefined : programs.map(program => program.id)),
      cycleIds: preferenceIds(cyclesLoading || cyclesError ? undefined : cycles.map(cycle => cycle.id)),
      sessionTypeIds: preferenceIds(sessionTypesLoading || sessionTypesError ? undefined : sessionTypes.map(type => type.id)),
      statuses: preferenceOptions(['upcoming', 'completed'] as const),
      sorting: preferenceSorting(tableKeys, DEFAULT_SORTING),
      columnWidths: preferenceColumnWidths(tableKeys),
      hiddenColumns: preferenceHiddenColumns(tableKeys),
    },
  });
  const { view, dateRange, programIds, cycleIds, sessionTypeIds, statuses, sorting, columnWidths, hiddenColumns } = preferences;

  const applySearch = () => setAppliedSearch(search.trim());
  const clearSearch = () => {
    setSearch('');
    setAppliedSearch('');
  };

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    { id: 'program', label: 'Program', options: programs.map(program => ({ value: program.id, label: program.name })) },
    { id: 'cycle', label: 'Cycle', options: cycles.map(cycle => ({ value: cycle.id, label: cycle.name })) },
    { id: 'type', label: 'Type', options: sessionTypes.map(type => ({ value: type.id, label: type.name })) },
    { id: 'status', label: 'Status', options: [{ value: 'upcoming', label: 'Upcoming' }, { value: 'completed', label: 'Completed' }] },
  ], [cycles, programs, sessionTypes]);

  const applyFilter = (key: string, values: string[]) => {
    switch (key) {
      case 'program':
        updatePreferences({ programIds: values });
        break;
      case 'cycle':
        updatePreferences({ cycleIds: values });
        break;
      case 'type':
        updatePreferences({ sessionTypeIds: values });
        break;
      case 'status':
        updatePreferences({ statuses: values as SessionStatusFilter[] });
        break;
    }
  };
  const clearFilters = () => updatePreferences({ programIds: [], cycleIds: [], sessionTypeIds: [], statuses: [] });
  const setView = (view: SessionView) => updatePreferences({ view });
  const setSorting = (sorting: ListSort<SessionSortKey>) => updatePreferences({ sorting });
  const setColumnWidths = (columnWidths: Record<string, number>) => updatePreferences({ columnWidths });
  const setHiddenColumns = (hiddenColumns: string[]) => updatePreferences({ hiddenColumns });

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
      setDateRange: (dateRange: DateRange) => updatePreferences({ dateRange }),
      programIds,
      cycleIds,
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
