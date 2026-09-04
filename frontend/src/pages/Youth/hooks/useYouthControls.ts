import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../common/components/Table/Table.types';
import type { Program } from '../../../common/features/programs/types';
import usePreferenceOptionRecovery from '../../../common/features/Preferences/hooks/usePreferenceOptionRecovery';
import useUserPreference from '../../../common/features/Preferences/hooks/useUserPreference';
import {
  mergePreferenceDefaults,
  resolveAvailablePreferenceIds,
  resolveAvailablePreferenceValues,
  resolvePreferenceNumberRecord,
  resolvePreferenceSorting,
  resolvePreferenceStringArray,
} from '../../../common/features/Preferences/preferenceValues';
import type { ListSort } from '../../../common/components/Table/Table.types';
import type { YouthSortKey } from '../types';

export type YouthStatusFilter = 'active' | 'inactive';

export interface YouthPreference {
  statuses: YouthStatusFilter[];
  programIds: string[];
  sorting?: ListSort<YouthSortKey>;
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}

interface UseYouthControlsOptions {
  role: string | null;
  programs: Program[];
  programsLoading: boolean;
  programsError?: string | null;
  tableKeys: readonly YouthSortKey[];
}

const DEFAULT_SORTING: ListSort<YouthSortKey> = { key: 'firstName', direction: 'asc' };
const DEFAULT_YOUTH_PREFERENCE: YouthPreference = {
  statuses: ['active'], programIds: [], sorting: DEFAULT_SORTING, columnWidths: {}, hiddenColumns: [],
};

export function useYouthControls({
  role,
  programs,
  programsLoading,
  programsError,
  tableKeys,
}: UseYouthControlsOptions) {
  // Search and filter state.
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<YouthStatusFilter[]>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // Table presentation state.
  const [sorting, setSortingState] = useState<ListSort<YouthSortKey>>(DEFAULT_SORTING);
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumnsState] = useState<string[]>([]);

  // Persisted preference state.
  const {
    preference,
    loading: preferenceLoading,
    error,
    loadError,
    initializePreference,
    save,
  } = useUserPreference<YouthPreference>('youth-profile-filters', tableKeys);

  const applySearch = useCallback(() => setAppliedSearch(search.trim()), [search]);
  const clearSearch = useCallback(() => {
    setSearch('');
    setAppliedSearch('');
  }, []);

  // Restore preferences once their referenced program options are available.
  useEffect(() => {
    if (ready || preferenceLoading || programsLoading || role === null) return;
    const preferenceSource = loadError ? null : preference;
    const resolved = mergePreferenceDefaults(DEFAULT_YOUTH_PREFERENCE, preferenceSource);
    const restoredProgramIds = preferenceSource
      ? resolveAvailablePreferenceIds(resolved.programIds, programs, !programsError)
      : role === 'staff' ? programs.map(program => program.id) : [];
    const restoredSorting = resolvePreferenceSorting(resolved.sorting, tableKeys, DEFAULT_SORTING);
    const restoredStatuses = resolveAvailablePreferenceValues(
      resolved.statuses,
      [{ value: 'active' }, { value: 'inactive' }],
      true,
    );
    const restoredColumnWidths = resolvePreferenceNumberRecord(resolved.columnWidths);
    const restoredHiddenColumns = resolvePreferenceStringArray(resolved.hiddenColumns);
    const restored: YouthPreference = {
      statuses: restoredStatuses,
      programIds: restoredProgramIds,
      sorting: restoredSorting,
      columnWidths: restoredColumnWidths,
      hiddenColumns: restoredHiddenColumns,
    };
    setStatusFilters(restored.statuses);
    setProgramFilters(restored.programIds);
    setSortingState(restoredSorting);
    setColumnWidthsState(restoredColumnWidths);
    setHiddenColumnsState(restoredHiddenColumns);
    initializePreference(restored);
    setReady(true);
  }, [loadError, preference, preferenceLoading, programs, programsError, programsLoading, ready, role, initializePreference, tableKeys]);

  // Save one changed control while preserving the rest of the preference object.
  const persist = useCallback((next: {
    statuses?: YouthStatusFilter[];
    programIds?: string[];
    sorting?: ListSort<YouthSortKey>;
    columnWidths?: Record<string, number>;
    hiddenColumns?: string[];
  }) => save(current => ({
    statuses: next.statuses ?? current?.statuses ?? statusFilters,
    programIds: next.programIds ?? current?.programIds ?? programFilters,
    sorting: next.sorting ?? current?.sorting ?? sorting,
    columnWidths: next.columnWidths ?? current?.columnWidths ?? columnWidths,
    hiddenColumns: next.hiddenColumns ?? current?.hiddenColumns ?? hiddenColumns,
  })), [columnWidths, hiddenColumns, programFilters, save, sorting, statusFilters]);

  const availableProgramIds = useMemo(() => programs.map(program => program.id), [programs]);
  const reconcileProgramFilters = useCallback((nextProgramFilters: string[]) => {
    setProgramFilters(nextProgramFilters);
    void persist({ programIds: nextProgramFilters });
  }, [persist]);
  usePreferenceOptionRecovery({
    ready,
    loading: programsLoading,
    error: Boolean(programsError),
    selectedIds: programFilters,
    availableIds: availableProgramIds,
    onReconcile: reconcileProgramFilters,
  });

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    {
      id: 'program',
      label: 'Program',
      options: programs.map(program => ({ value: program.id, label: program.name })),
    },
    {
      id: 'status',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
  ], [programs]);

  // Translate FilterCard's generic event into this page's typed controls.
  const applyFilter = useCallback((category: string, selected: string[]) => {
    if (category === 'status') {
      const nextStatuses = selected as YouthStatusFilter[];
      setStatusFilters(nextStatuses);
      void persist({ statuses: nextStatuses });
      return;
    }
    if (category === 'program') {
      setProgramFilters(selected);
      void persist({ programIds: selected });
    }
  }, [persist]);

  const clearFilters = useCallback(() => {
    setStatusFilters([]);
    setProgramFilters([]);
    void persist({ statuses: [], programIds: [] });
  }, [persist]);

  // Persisted table controls.
  const setSorting = useCallback((next: TableSorting) => {
    const value = next as ListSort<YouthSortKey>;
    setSortingState(value);
    void persist({ sorting: value });
  }, [persist]);
  const setColumnWidths = useCallback((next: Record<string, number>) => {
    setColumnWidthsState(next);
    void persist({ columnWidths: next });
  }, [persist]);
  const setHiddenColumns = useCallback((hiddenColumns: string[]) => {
    setHiddenColumnsState(hiddenColumns);
    void persist({ hiddenColumns });
  }, [persist]);

  return {
    search,
    setSearch,
    appliedSearch,
    applySearch,
    clearSearch,
    statusFilters,
    programFilters,
    sorting,
    setSorting,
    columnWidths,
    setColumnWidths,
    hiddenColumns,
    setHiddenColumns,
    ready,
    error,
    filterCategories,
    applyFilter,
    clearFilters,
  };
}
