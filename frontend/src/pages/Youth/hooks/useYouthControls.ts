import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../common/components/Table/Table.types';
import type { Program } from '../../../common/features/programs/types';
import useUserPreference from '../../../common/features/preferences/hooks/useUserPreference';
import type { ListSort } from '../../../common/types/pagination';
import type { YouthFilters, YouthSortKey } from '../../../common/types/youth';

type YouthStatusFilter = 'active' | 'inactive';

interface UseYouthControlsOptions {
  role: string | null;
  programs: Program[];
  programsLoading: boolean;
  programsError?: string | null;
}

export function useYouthControls({ role, programs, programsLoading, programsError }: UseYouthControlsOptions) {
  // Search and filter state.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<YouthStatusFilter[]>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // Table presentation state.
  const [sorting, setSortingState] = useState<ListSort<YouthSortKey>>({ key: 'firstName', direction: 'asc' });
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});

  // Persisted preference state.
  const { preference, loading: preferenceLoading, error, save } = useUserPreference('youth-profile-filters');

  // Delay query changes until the user pauses typing.
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  // Restore preferences once their referenced program options are available.
  useEffect(() => {
    if (ready || preferenceLoading || programsLoading || role === null) return;
    const availableProgramIds = new Set(programs.map(program => program.id));
    setStatusFilters(preference?.statuses ?? ['active']);
    setProgramFilters(preference
      ? programsError
        ? preference.programIds
        : preference.programIds.filter(programId => availableProgramIds.has(programId))
      : role === 'staff' ? programs.map(program => program.id) : []);
    setSortingState(preference?.sorting ?? { key: 'firstName', direction: 'asc' });
    setColumnWidthsState(preference?.columnWidths ?? {});
    setReady(true);
  }, [preference, preferenceLoading, programs, programsError, programsLoading, ready, role]);

  // Save one changed control while preserving the rest of the preference object.
  const persist = useCallback((next: {
    statuses?: YouthStatusFilter[];
    programIds?: string[];
    sorting?: ListSort<YouthSortKey>;
    columnWidths?: Record<string, number>;
    hiddenColumns?: string[];
  }) => save({
    statuses: next.statuses ?? statusFilters,
    programIds: next.programIds ?? programFilters,
    sorting: next.sorting ?? sorting,
    columnWidths: next.columnWidths ?? columnWidths,
    hiddenColumns: next.hiddenColumns ?? preference?.hiddenColumns ?? [],
  }), [columnWidths, preference?.hiddenColumns, programFilters, save, sorting, statusFilters]);

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
    hiddenColumns: preference?.hiddenColumns ?? [],
    setHiddenColumns,
    error,
    hasActiveQueryFilters,
    filterCategories,
    applyFilter,
    clearFilters,
  };
}
