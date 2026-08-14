import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../../common/components/Table/Table.types';
import type { Program } from '../../../../common/features/programs/types';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import type { CohortSortKey } from '../../../../common/types/cohort';
import type { ListSort } from '../../../../common/types/pagination';
import { getSingleAssignedProgram } from '../../common/utils/staffProgrammingDefaults';

type CohortStatus = 'active' | 'upcoming' | 'completed';

export function useCohortControls(
  role: string | null,
  programs: Program[],
  programsLoading: boolean,
  programsError?: string | null,
) {
  // Search and filters.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [programId, setProgramId] = useState('');
  const [status, setStatus] = useState<CohortStatus | ''>('');

  // Table controls and persisted initialization.
  const [sorting, setSortingState] = useState<ListSort<CohortSortKey>>({ key: 'start', direction: 'desc' });
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const { preference, loading: preferenceLoading, error, save } = useUserPreference('cohort-filters');

  // Delay query changes until the user pauses typing.
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  // Restore preferences once their referenced program options are available.
  useEffect(() => {
    if (ready || preferenceLoading || programsLoading || role === null) return;
    const availableProgramIds = new Set(programs.map(program => program.id));
    const defaultProgram = getSingleAssignedProgram(role, programs)?.id ?? '';
    setProgramId(
      preference?.programId && (programsError || availableProgramIds.has(preference.programId))
        ? preference.programId
        : preference ? '' : defaultProgram,
    );
    setStatus(preference?.status ?? (role === 'staff' ? 'active' : ''));
    setSortingState(preference?.sorting ?? { key: 'start', direction: 'desc' });
    setColumnWidthsState(preference?.columnWidths ?? {});
    setReady(true);
  }, [preference, preferenceLoading, programs, programsError, programsLoading, ready, role]);

  // Stable query and filter-card values.
  const tableFilters = useMemo(() => ready ? {
    programId: programId || undefined,
    search: debouncedSearch,
    status: status || undefined,
  } : null, [debouncedSearch, programId, ready, status]);
  const hasActiveQueryFilters = Boolean(programId || status || debouncedSearch);
  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    {
      id: 'program', label: 'Program', selectionMode: 'single',
      options: programs.map(program => ({ value: program.id, label: program.name })),
    },
    {
      id: 'status', label: 'Status', selectionMode: 'single',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'upcoming', label: 'Upcoming' },
        { value: 'completed', label: 'Completed' },
      ],
    },
  ], [programs]);

  // UI handlers persist complete preference values.
  const persist = useCallback((next: {
    programId?: string;
    status?: CohortStatus | '';
    sorting?: ListSort<CohortSortKey>;
    columnWidths?: Record<string, number>;
    hiddenColumns?: string[];
  }) => save({
    programId: (next.programId ?? programId) || null,
    status: next.status === undefined ? (status || null) : (next.status || null),
    sorting: next.sorting ?? sorting,
    columnWidths: next.columnWidths ?? columnWidths,
    hiddenColumns: next.hiddenColumns ?? preference?.hiddenColumns ?? [],
  }), [columnWidths, preference?.hiddenColumns, programId, save, sorting, status]);

  const applyFilter = useCallback((category: string, selected: string[]) => {
    if (category === 'program') {
      const nextProgramId = selected[0] ?? '';
      setProgramId(nextProgramId);
      void persist({ programId: nextProgramId });
      return;
    }
    if (category === 'status') {
      const nextStatus = (selected[0] as CohortStatus | undefined) ?? '';
      setStatus(nextStatus);
      void persist({ status: nextStatus });
    }
  }, [persist]);

  const clearFilters = useCallback(() => {
    setProgramId('');
    setStatus('');
    void persist({ programId: '', status: '' });
  }, [persist]);
  const setSorting = useCallback((next: TableSorting) => {
    const value = next as ListSort<CohortSortKey>;
    setSortingState(value);
    void persist({ sorting: value });
  }, [persist]);
  const setColumnWidths = useCallback((next: Record<string, number>) => {
    setColumnWidthsState(next);
    void persist({ columnWidths: next });
  }, [persist]);
  const setHiddenColumns = useCallback((hiddenColumns: string[]) => void persist({ hiddenColumns }), [persist]);

  return {
    search, setSearch, tableFilters, programId, status, sorting, setSorting,
    columnWidths, setColumnWidths, hiddenColumns: preference?.hiddenColumns ?? [], setHiddenColumns,
    error, filterCategories, applyFilter, clearFilters, hasActiveQueryFilters,
  };
}
