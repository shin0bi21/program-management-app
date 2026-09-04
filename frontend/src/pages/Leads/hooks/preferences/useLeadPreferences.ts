import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../../common/components/Table/Table.types';
import type { Program } from '../../../../common/features/programs/types';
import usePreferenceOptionRecovery from '../../../../common/features/Preferences/hooks/usePreferenceOptionRecovery';
import useUserPreference from '../../../../common/features/Preferences/hooks/useUserPreference';
import {
  mergePreferenceDefaults,
  resolveAvailablePreferenceIds,
  resolvePreferenceSorting,
  resolvePreferenceStringArray,
} from '../../../../common/features/Preferences/preferenceValues';
import type { ListSort } from '../../../../common/components/Table/Table.types';
import type { LeadOrigin, LeadSortKey, LeadStatus, LeadSubmitterRole } from '../../types';

export interface LeadPreference {
  search: string;
  statuses: LeadStatus[];
  programIds: string[];
  origins: LeadOrigin[];
  submitterRoles: LeadSubmitterRole[];
  sorting?: ListSort<LeadSortKey>;
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}

const statuses: LeadStatus[] = ['new', 'contacted', 'eligible', 'ineligible', 'deferred', 'closed', 'signed_up'];
const externalSubmitterRoles: LeadSubmitterRole[] = ['youth', 'parent', 'guardian'];
const DEFAULT_SORTING: ListSort<LeadSortKey> = { key: 'created', direction: 'desc' };
const DEFAULT_LEAD_PREFERENCE: LeadPreference = {
  search: '', statuses: [], programIds: [], origins: [], submitterRoles: [], sorting: DEFAULT_SORTING, columnWidths: {}, hiddenColumns: [],
};

export function useLeadPreferences(
  origin: LeadOrigin,
  preferenceKey: 'outreach-external-leads-filters' | 'outreach-internal-leads-filters',
  programs: Program[],
  programsLoading: boolean,
  programsError: string | null,
  tableKeys: readonly LeadSortKey[],
) {
  // Search and filter state.
  const [searchValue, setSearchValue] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<LeadStatus[]>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [submitterRoleFilters, setSubmitterRoleFilters] = useState<LeadSubmitterRole[]>([]);
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
    loadError,
    initializePreference,
    save,
  } = useUserPreference<LeadPreference>(preferenceKey, tableKeys);

  // Restore preferences once their referenced program options are available.
  useEffect(() => {
    if (ready || preferenceLoading || programsLoading) return;
    const resolved = mergePreferenceDefaults(DEFAULT_LEAD_PREFERENCE, loadError ? null : preference);
    const restoredProgramIds = resolveAvailablePreferenceIds(resolved.programIds, programs, Boolean(programsError) === false);
    const restoredSubmitterRoles = origin === 'external'
      ? resolvePreferenceStringArray(resolved.submitterRoles)
          .filter(role => externalSubmitterRoles.includes(role as LeadSubmitterRole)) as LeadSubmitterRole[]
      : [];
    const restoredSorting = resolvePreferenceSorting(resolved.sorting, tableKeys, DEFAULT_SORTING);
    const restoredColumnWidths = resolved.columnWidths ?? {};
    const restoredHiddenColumns = resolvePreferenceStringArray(resolved.hiddenColumns);
    const restored: LeadPreference = {
      search: resolved.search,
      statuses: resolved.statuses,
      programIds: restoredProgramIds,
      origins: [origin],
      submitterRoles: restoredSubmitterRoles,
      sorting: restoredSorting,
      columnWidths: restoredColumnWidths,
      hiddenColumns: restoredHiddenColumns,
    };
    setSearchValue(restored.search);
    setAppliedSearch(restored.search);
    setStatusFilters(restored.statuses);
    setProgramFilters(restored.programIds);
    setSubmitterRoleFilters(restored.submitterRoles);
    setSortingState(restoredSorting);
    setColumnWidthsState(restoredColumnWidths);
    setHiddenColumnsState(restoredHiddenColumns);
    initializePreference(restored);
    setReady(true);
  }, [loadError, origin, preference, preferenceLoading, programs, programsError, programsLoading, ready, initializePreference, tableKeys]);

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    { id: 'program', label: 'Program', options: programs.map(program => ({ value: program.id, label: program.name })) },
    { id: 'status', label: 'Status', options: statuses.map(status => ({ value: status, label: statusLabel(status) })) },
    ...(origin === 'external' ? [{
      id: 'submitterRole',
      label: 'Filled Out By',
      options: externalSubmitterRoles.map(role => ({ value: role, label: statusLabel(role) })),
    }] : []),
  ], [origin, programs]);

  // Save one changed control while preserving the rest of the preference object.
  const persist = useCallback((next: {
    search?: string;
    statuses?: LeadStatus[];
    programIds?: string[];
    submitterRoles?: LeadSubmitterRole[];
    sorting?: ListSort<LeadSortKey>;
    columnWidths?: Record<string, number>;
    hiddenColumns?: string[];
    origins?: LeadOrigin[];
  }) => save(current => ({
    search: next.search ?? current?.search ?? appliedSearch,
    statuses: next.statuses ?? current?.statuses ?? statusFilters,
    programIds: next.programIds ?? current?.programIds ?? programFilters,
    submitterRoles: next.submitterRoles ?? current?.submitterRoles ?? submitterRoleFilters,
    sorting: next.sorting ?? current?.sorting ?? sorting,
    columnWidths: next.columnWidths ?? current?.columnWidths ?? columnWidths,
    hiddenColumns: next.hiddenColumns ?? current?.hiddenColumns ?? hiddenColumns,
    origins: [origin],
  })), [appliedSearch, columnWidths, hiddenColumns, origin, programFilters, save, sorting, statusFilters, submitterRoleFilters]);

  const applySearch = useCallback(() => {
    const search = searchValue.trim();
    setAppliedSearch(search);
    void persist({ search });
  }, [persist, searchValue]);
  const clearSearch = useCallback(() => {
    setSearchValue('');
    setAppliedSearch('');
    void persist({ search: '' });
  }, [persist]);

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
      return;
    }
    if (category === 'submitterRole' && origin === 'external') {
      const nextSubmitterRoles = selected as LeadSubmitterRole[];
      setSubmitterRoleFilters(nextSubmitterRoles);
      void persist({ submitterRoles: nextSubmitterRoles });
    }
  }, [origin, persist]);

  // Filter reset and persisted table controls.
  const clearFilters = useCallback(() => {
    setStatusFilters([]);
    setProgramFilters([]);
    setSubmitterRoleFilters([]);
    void persist({ statuses: [], programIds: [], submitterRoles: [] });
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
    ready,
    error,
    search: {
      value: searchValue,
      appliedValue: appliedSearch,
      setValue: setSearchValue,
      apply: applySearch,
      clear: clearSearch,
    },
    filters: {
      statuses: statusFilters,
      programIds: programFilters,
      submitterRoles: submitterRoleFilters,
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

function statusLabel(value: string) {
  return value
    .split('_')
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
