import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../../common/components/Table/Table.types';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import type { AccountRole, AccountSortKey, AccountStatus } from '../../../../common/types/account';
import type { ListSort } from '../../../../common/types/pagination';
import { resolvePreferenceSorting } from '../../../../common/features/preferences/preferenceValues';
import type { AccountPreference } from '../types';

const DEFAULT_SORTING: ListSort<AccountSortKey> = { key: 'name', direction: 'asc' };

export function useAccountControls(
  isAdmin: boolean,
  tableKeys: readonly AccountSortKey[],
) {
  // Search and filter state.
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<AccountStatus[]>([]);
  const [roleFilters, setRoleFilters] = useState<AccountRole[]>([]);
  const [ready, setReady] = useState(false);

  // Table presentation state.
  const [sorting, setSortingState] = useState<ListSort<AccountSortKey>>(DEFAULT_SORTING);
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumnsState] = useState<string[]>([]);

  // Persisted preferences.
  const {
    preference,
    loading: preferenceLoading,
    error,
    initializePreference,
    save,
  } = useUserPreference<AccountPreference>('account-filters', tableKeys);

  const applySearch = useCallback(() => setAppliedSearch(search.trim()), [search]);
  const clearSearch = useCallback(() => {
    setSearch('');
    setAppliedSearch('');
  }, []);

  // Restore preferences before enabling the account query.
  useEffect(() => {
    if (ready || preferenceLoading) return;
    const restoredSorting = resolvePreferenceSorting(preference?.sorting, tableKeys, DEFAULT_SORTING);
    const restoredColumnWidths = preference?.columnWidths ?? {};
    const restoredHiddenColumns = preference?.hiddenColumns ?? [];
    const restored: AccountPreference = {
      statuses: preference?.statuses ?? [],
      roles: isAdmin ? preference?.roles ?? [] : [],
      sorting: restoredSorting,
      columnWidths: restoredColumnWidths,
      hiddenColumns: restoredHiddenColumns,
    };
    setStatusFilters(restored.statuses);
    setRoleFilters(restored.roles);
    setSortingState(restoredSorting);
    setColumnWidthsState(restoredColumnWidths);
    setHiddenColumnsState(restoredHiddenColumns);
    initializePreference(restored);
    setReady(true);
  }, [isAdmin, preference, preferenceLoading, ready, initializePreference, tableKeys]);

  // Keep query inputs and FilterCard configuration stable between unrelated renders.
  const queryFilters = useMemo(() => ready ? ({
    search: appliedSearch,
    roles: roleFilters,
    statuses: statusFilters,
  }) : null, [appliedSearch, ready, roleFilters, statusFilters]);
  const hasActiveQueryFilters = Boolean(appliedSearch || roleFilters.length || statusFilters.length);
  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    { id: 'status', label: 'Status', options: [
      { value: 'active', label: 'Active' },
      { value: 'invited', label: 'Invited' },
      { value: 'inactive', label: 'Inactive' },
    ] },
    ...(isAdmin ? [{ id: 'role', label: 'Role', options: [
      { value: 'admin', label: 'Admin' },
      { value: 'staff', label: 'Staff' },
      { value: 'youth', label: 'Youth' },
    ] }] : []),
  ], [isAdmin]);

  // Save one changed control while preserving the rest of the preference object.
  const persist = useCallback((next: {
    statuses?: AccountStatus[];
    roles?: AccountRole[];
    sorting?: ListSort<AccountSortKey>;
    columnWidths?: Record<string, number>;
    hiddenColumns?: string[];
  }) => save(current => ({
    statuses: next.statuses ?? current?.statuses ?? statusFilters,
    roles: next.roles ?? current?.roles ?? roleFilters,
    sorting: next.sorting ?? current?.sorting ?? sorting,
    columnWidths: next.columnWidths ?? current?.columnWidths ?? columnWidths,
    hiddenColumns: next.hiddenColumns ?? current?.hiddenColumns ?? hiddenColumns,
  })), [columnWidths, hiddenColumns, roleFilters, save, sorting, statusFilters]);

  // Translate FilterCard's generic event into this page's typed controls.
  const applyFilter = useCallback((category: string, selected: string[]) => {
    if (category === 'status') {
      const nextStatuses = selected as AccountStatus[];
      setStatusFilters(nextStatuses);
      void persist({ statuses: nextStatuses });
      return;
    }
    if (category === 'role') {
      const nextRoles = selected as AccountRole[];
      setRoleFilters(nextRoles);
      void persist({ roles: nextRoles });
    }
  }, [persist]);

  // Filter reset and persisted table controls.
  const clearFilters = useCallback(() => {
    setStatusFilters([]);
    setRoleFilters([]);
    void persist({ statuses: [], roles: [] });
  }, [persist]);
  const setSorting = useCallback((next: TableSorting) => {
    const value = next as ListSort<AccountSortKey>;
    setSortingState(value);
    void persist({ sorting: value });
  }, [persist]);
  const setColumnWidths = useCallback((next: Record<string, number>) => {
    setColumnWidthsState(next);
    void persist({ columnWidths: next });
  }, [persist]);
  const setHiddenColumns = useCallback((hiddenColumns: string[]) => { setHiddenColumnsState(hiddenColumns); void persist({ hiddenColumns }); }, [persist]);

  return {
    search, setSearch, appliedSearch, applySearch, clearSearch, queryFilters, statusFilters, roleFilters, sorting, setSorting,
    columnWidths, setColumnWidths, hiddenColumns, setHiddenColumns,
    ready, error, filterCategories, applyFilter, clearFilters, hasActiveQueryFilters,
  };
}
