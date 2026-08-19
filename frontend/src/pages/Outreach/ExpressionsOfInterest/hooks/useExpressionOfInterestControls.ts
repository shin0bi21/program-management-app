import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../../common/components/Table/Table.types';
import type { Program } from '../../../../common/features/programs/types';
import usePreferenceOptionRecovery from '../../../../common/features/preferences/hooks/usePreferenceOptionRecovery';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import { resolvePreferenceSorting } from '../../../../common/features/preferences/preferenceValues';
import type { ListSort } from '../../../../common/types/pagination';
import type {
  ExpressionInterestPreference,
  ExpressionOfInterest,
  ExpressionOfInterestFilters,
  ExpressionOfInterestSortKey,
} from '../types';

type SubmissionStatus = ExpressionOfInterest['status'];
const statuses: SubmissionStatus[] = ['new', 'reviewed', 'contacted', 'converted', 'signed_up', 'lost', 'spam'];
const DEFAULT_SORTING: ListSort<ExpressionOfInterestSortKey> = { key: 'createdAt', direction: 'desc' };

export function useExpressionOfInterestControls(
  programs: Program[],
  programsLoading: boolean,
  programsError: string | null,
  columnKeys: readonly string[],
  sortKeys: readonly ExpressionOfInterestSortKey[],
) {
  // Search and filter state.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<SubmissionStatus[]>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // Table presentation state.
  const [sorting, setSortingState] = useState<ListSort<ExpressionOfInterestSortKey>>(DEFAULT_SORTING);
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumnsState] = useState<string[]>([]);

  // Persisted preference state.
  const {
    preference,
    loading: preferenceLoading,
    error,
    setBaseline,
    save,
  } = useUserPreference<ExpressionInterestPreference>('expression-interest-filters', columnKeys);

  // Delay query changes until the user pauses typing.
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  // Restore preferences once their referenced program options are available.
  useEffect(() => {
    if (ready || preferenceLoading || programsLoading) return;
    const availableProgramIds = new Set(programs.map(program => program.id));
    const restoredProgramIds = programsError
      ? preference?.programIds ?? []
      : preference?.programIds.filter(id => availableProgramIds.has(id)) ?? [];
    const restoredSorting = resolvePreferenceSorting(preference?.sorting, sortKeys, DEFAULT_SORTING);
    const restoredColumnWidths = preference?.columnWidths ?? {};
    const restoredHiddenColumns = preference?.hiddenColumns ?? [];
    const restored: ExpressionInterestPreference = {
      statuses: preference?.statuses ?? [],
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
  }, [preference, preferenceLoading, programs, programsError, programsLoading, ready, setBaseline, sortKeys]);

  // Keep query inputs and FilterCard configuration stable between unrelated renders.
  const queryFilters = useMemo<ExpressionOfInterestFilters | null>(() => ready
    ? ({ search: debouncedSearch, statuses: statusFilters, programIds: programFilters })
    : null, [debouncedSearch, programFilters, ready, statusFilters]);
  const hasActiveQueryFilters = Boolean(debouncedSearch || statusFilters.length || programFilters.length);
  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    { id: 'program', label: 'Program', options: programs.map(program => ({ value: program.id, label: program.name })) },
    { id: 'status', label: 'Status', options: statuses.map(status => ({ value: status, label: statusLabel(status) })) },
  ], [programs]);

  // Save one changed control while preserving the rest of the preference object.
  const persist = useCallback((next: {
    statuses?: SubmissionStatus[];
    programIds?: string[];
    sorting?: ListSort<ExpressionOfInterestSortKey>;
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

  // Translate FilterCard's generic event into this page's typed controls.
  const applyFilter = useCallback((category: string, selected: string[]) => {
    if (category === 'status') {
      const nextStatuses = selected as SubmissionStatus[];
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
    const value = next as ListSort<ExpressionOfInterestSortKey>;
    setSortingState(value);
    void persist({ sorting: value });
  }, [persist]);
  const setColumnWidths = useCallback((next: Record<string, number>) => {
    setColumnWidthsState(next);
    void persist({ columnWidths: next });
  }, [persist]);
  const setHiddenColumns = useCallback((hiddenColumns: string[]) => { setHiddenColumnsState(hiddenColumns); void persist({ hiddenColumns }); }, [persist]);

  return {
    search, setSearch, queryFilters, statusFilters, programFilters, sorting, setSorting,
    columnWidths, setColumnWidths, hiddenColumns, setHiddenColumns,
    ready, error, filterCategories, applyFilter, clearFilters, hasActiveQueryFilters,
  };
}

function statusLabel(value: string) {
  return value
    .split('_')
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
