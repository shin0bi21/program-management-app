import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../../common/components/Table/Table.types';
import type { Program } from '../../../../common/features/programs/types';
import usePreferenceOptionRecovery from '../../../../common/features/preferences/hooks/usePreferenceOptionRecovery';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import { resolvePreferenceSorting } from '../../../../common/features/preferences/preferenceValues';
import type { ListSort } from '../../../../common/types/pagination';
import type { LeadFilters, LeadOrigin, LeadPreference, LeadSortKey, LeadStatus } from '../types';

const statuses: LeadStatus[] = ['new', 'contacted', 'eligible', 'ineligible', 'signed_up'];
const DEFAULT_SORTING: ListSort<LeadSortKey> = { key: 'created', direction: 'desc' };

export function useLeadControls(
  origin: LeadOrigin,
  preferenceKey: 'outreach-external-leads-filters' | 'outreach-internal-leads-filters',
  programs: Program[],
  programsLoading: boolean,
  programsError: string | null,
  tableKeys: readonly LeadSortKey[],
) {
  // Search and filter state.
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<LeadStatus[]>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // Table presentation state.
  const [sorting, setSortingState] = useState<ListSort<LeadSortKey>>(DEFAULT_SORTING);
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumnsState] = useState<string[]>([]);

  // Persisted preference state.
  const {
    preference,
    loading: preferenceLoading,
    error,
    setBaseline,
    save,
  } = useUserPreference<LeadPreference>(preferenceKey, tableKeys);

  const applySearch = useCallback(() => setAppliedSearch(search.trim()), [search]);
  const clearSearch = useCallback(() => {
    setSearch('');
    setAppliedSearch('');
  }, []);

  // Restore preferences once their referenced program options are available.
  useEffect(() => {
    if (ready || preferenceLoading || programsLoading) return;
    const availableProgramIds = new Set(programs.map(program => program.id));
    const restoredProgramIds = programsError
      ? preference?.programIds ?? []
      : preference?.programIds.filter(id => availableProgramIds.has(id)) ?? [];
    const restoredSorting = resolvePreferenceSorting(preference?.sorting, tableKeys, DEFAULT_SORTING);
    const restoredColumnWidths = preference?.columnWidths ?? {};
    const restoredHiddenColumns = preference?.hiddenColumns ?? [];
    const restored: LeadPreference = {
      statuses: preference?.statuses ?? [],
      programIds: restoredProgramIds,
      origins: [origin],
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
  }, [origin, preference, preferenceLoading, programs, programsError, programsLoading, ready, setBaseline, tableKeys]);

  // Keep query inputs and FilterCard configuration stable between unrelated renders.
  const queryFilters = useMemo<LeadFilters | null>(() => ready
    ? ({ search: appliedSearch, statuses: statusFilters, programIds: programFilters, origins: [origin] })
    : null, [appliedSearch, origin, programFilters, ready, statusFilters]);
  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    { id: 'program', label: 'Program', options: programs.map(program => ({ value: program.id, label: program.name })) },
    { id: 'status', label: 'Status', options: statuses.map(status => ({ value: status, label: statusLabel(status) })) },
  ], [programs]);

  // Save one changed control while preserving the rest of the preference object.
  const persist = useCallback((next: {
    statuses?: LeadStatus[];
    programIds?: string[];
    sorting?: ListSort<LeadSortKey>;
    columnWidths?: Record<string, number>;
    hiddenColumns?: string[];
    origins?: LeadOrigin[];
  }) => save(current => ({
    statuses: next.statuses ?? current?.statuses ?? statusFilters,
    programIds: next.programIds ?? current?.programIds ?? programFilters,
    sorting: next.sorting ?? current?.sorting ?? sorting,
    columnWidths: next.columnWidths ?? current?.columnWidths ?? columnWidths,
    hiddenColumns: next.hiddenColumns ?? current?.hiddenColumns ?? hiddenColumns,
    origins: [origin],
  })), [columnWidths, hiddenColumns, origin, programFilters, save, sorting, statusFilters]);

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

  // Translate FilterCard's generic event into this page's typed controls.
  const applyFilter = useCallback((category: string, selected: string[]) => {
    if (category === 'status') {
      const nextStatuses = selected as LeadStatus[];
      setStatusFilters(nextStatuses);
      void persist({ statuses: nextStatuses });
      return;
    }
    if (category === 'program') {
      setProgramFilters(selected);
      void persist({ programIds: selected });
    }
  }, [persist]);

  // Filter reset and persisted table controls.
  const clearFilters = useCallback(() => {
    setStatusFilters([]);
    setProgramFilters([]);
    void persist({ statuses: [], programIds: [] });
  }, [persist]);
  const setSorting = useCallback((next: TableSorting) => {
    const value = next as ListSort<LeadSortKey>;
    setSortingState(value);
    void persist({ sorting: value });
  }, [persist]);
  const setColumnWidths = useCallback((next: Record<string, number>) => {
    setColumnWidthsState(next);
    void persist({ columnWidths: next });
  }, [persist]);
  const setHiddenColumns = useCallback((hiddenColumns: string[]) => { setHiddenColumnsState(hiddenColumns); void persist({ hiddenColumns }); }, [persist]);
  return {
    search, setSearch, appliedSearch, applySearch, clearSearch, queryFilters, statusFilters, programFilters, sorting, setSorting,
    columnWidths, setColumnWidths, hiddenColumns, setHiddenColumns,
    origins: [origin] as LeadOrigin[],
    ready, error, filterCategories, applyFilter, clearFilters,
  };
}

function statusLabel(value: string) {
  return value
    .split('_')
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
