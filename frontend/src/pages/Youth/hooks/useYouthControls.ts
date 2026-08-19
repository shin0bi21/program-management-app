import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../common/components/Table/Table.types';
import type { Program } from '../../../common/features/programs/types';
import useUserPreference from '../../../common/features/preferences/hooks/useUserPreference';
import type { ListSort } from '../../../common/types/pagination';
import type { YouthFilters, YouthSortKey } from '../../../common/types/youth';
import type { YouthPreference, YouthStatusFilter } from '../types';

interface UseYouthControlsOptions {
  role: string | null;
  programs: Program[];
  programsLoading: boolean;
  programsError?: string | null;
  columnKeys: readonly string[];
}

export function useYouthControls({
  role,
  programs,
  programsLoading,
  programsError,
  columnKeys,
}: UseYouthControlsOptions) {
  // Search and filter state.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<YouthStatusFilter[]>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // Table presentation state.
  const [sorting, setSortingState] = useState<ListSort<YouthSortKey>>({ key: 'firstName', direction: 'asc' });
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumnsState] = useState<string[]>([]);

  // Persisted preference state.
  const {
    preference,
    loading: preferenceLoading,
    error,
    setBaseline,
    save,
  } = useUserPreference<YouthPreference>('youth-profile-filters', columnKeys);

  // Delay query changes until the user pauses typing.
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  // Restore preferences once their referenced program options are available.
  useEffect(() => {
    if (ready || preferenceLoading || programsLoading || role === null) return;
    const availableProgramIds = new Set(programs.map(program => program.id));
    const restoredProgramIds = preference
      ? programsError
        ? preference.programIds
        : preference.programIds.filter(programId => availableProgramIds.has(programId))
      : role === 'staff' ? programs.map(program => program.id) : [];
    const restoredSorting = preference?.sorting ?? { key: 'firstName', direction: 'asc' };
    const restoredColumnWidths = preference?.columnWidths ?? {};
    const restoredHiddenColumns = preference?.hiddenColumns ?? [];
    const restored: YouthPreference = {
      statuses: preference?.statuses ?? ['active'],
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
    setBaseline(restored);
    setReady(true);
  }, [preference, preferenceLoading, programs, programsError, programsLoading, ready, role, setBaseline]);

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

  // Keep query inputs and FilterCard configuration stable between unrelated renders.
  const queryFilters = useMemo<YouthFilters | null>(() => ready ? ({
    search: debouncedSearch,
    statuses: statusFilters,
    programIds: programFilters,
  }) : null, [debouncedSearch, programFilters, ready, statusFilters]);
  const hasActiveQueryFilters = Boolean(debouncedSearch || statusFilters.length || programFilters.length);

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
    queryFilters,
    statusFilters,
    programFilters,
    sorting,
    setSorting,
    columnWidths,
    setColumnWidths,
    hiddenColumns,
    setHiddenColumns,
    error,
    hasActiveQueryFilters,
    filterCategories,
    applyFilter,
    clearFilters,
  };
}
