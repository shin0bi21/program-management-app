import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../../common/components/Table/Table.types';
import type { Program } from '../../../../common/features/programs/types';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import type { ListSort } from '../../../../common/types/pagination';
import type { ExpressionOfInterest, ExpressionOfInterestFilters, ExpressionOfInterestSortKey } from '../types';

type SubmissionStatus = ExpressionOfInterest['status'];
const statuses: SubmissionStatus[] = ['new', 'reviewed', 'contacted', 'converted', 'signed_up', 'lost', 'spam'];

export function useExpressionOfInterestControls(programs: Program[], programsLoading: boolean, programsError: string | null) {
  // Search and filter state.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<SubmissionStatus[]>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // Table presentation state.
  const [sorting, setSortingState] = useState<ListSort<ExpressionOfInterestSortKey>>({ key: 'createdAt', direction: 'desc' });
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumnsState] = useState<string[]>([]);

  // Persisted preference state.
  const { preference, loading: preferenceLoading, error, save } = useUserPreference('expression-interest-filters');

  // Delay query changes until the user pauses typing.
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  // Restore preferences once their referenced program options are available.
  useEffect(() => {
    if (ready || preferenceLoading || programsLoading) return;
    const availableProgramIds = new Set(programs.map(program => program.id));
    setStatusFilters(preference?.statuses ?? []);
    setProgramFilters(programsError
      ? preference?.programIds ?? []
      : preference?.programIds.filter(id => availableProgramIds.has(id)) ?? []);
    setSortingState(preference?.sorting ?? { key: 'createdAt', direction: 'desc' });
    setColumnWidthsState(preference?.columnWidths ?? {});
    setHiddenColumnsState(preference?.hiddenColumns ?? []);
    setReady(true);
  }, [preference, preferenceLoading, programs, programsError, programsLoading, ready]);

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
  }) => save({
    statuses: next.statuses ?? statusFilters,
    programIds: next.programIds ?? programFilters,
    sorting: next.sorting ?? sorting,
    columnWidths: next.columnWidths ?? columnWidths,
    hiddenColumns: next.hiddenColumns ?? hiddenColumns,
  }), [columnWidths, hiddenColumns, programFilters, save, sorting, statusFilters]);

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
    error, filterCategories, applyFilter, clearFilters, hasActiveQueryFilters,
  };
}

function statusLabel(value: string) {
  return value
    .split('_')
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
