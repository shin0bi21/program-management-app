import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../../common/components/Table/Table.types';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import type { AccountRole, AccountSortKey, AccountStatus } from '../../../../common/types/account';
import type { ListSort } from '../../../../common/types/pagination';
import type { AccountPreference } from '../types';

export function useAccountControls(isAdmin: boolean, columnKeys: readonly string[]) {
  // Search and filter state.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<AccountStatus[]>([]);
  const [roleFilters, setRoleFilters] = useState<AccountRole[]>([]);
  const [ready, setReady] = useState(false);

  // Table presentation state.
  const [sorting, setSortingState] = useState<ListSort<AccountSortKey>>({ key: 'name', direction: 'asc' });
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumnsState] = useState<string[]>([]);

  // Persisted preferences.
  const {
    preference,
    loading: preferenceLoading,
    error,
    setBaseline,
    save,
  } = useUserPreference<AccountPreference>('account-filters', columnKeys);

  // Delay query changes until the user pauses typing.
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  // Restore preferences before enabling the account query.
  useEffect(() => {
    if (ready || preferenceLoading) return;
    const restoredSorting = preference?.sorting ?? { key: 'name', direction: 'asc' };
    const restoredColumnWidths = preference?.columnWidths ?? {};
    const restoredHiddenColumns = preference?.hiddenColumns ?? [];
    const restored: AccountPreference = {
      statuses: preference?.statuses ?? [],
      roles: preference?.roles ?? [],
      sorting: restoredSorting,
      columnWidths: restoredColumnWidths,
      hiddenColumns: restoredHiddenColumns,
    };
    setStatusFilters(restored.statuses);
    setRoleFilters(restored.roles);
    setSortingState(restoredSorting);
    setColumnWidthsState(restoredColumnWidths);
    setHiddenColumnsState(restoredHiddenColumns);
    setBaseline(restored);
    setReady(true);
  }, [preference, preferenceLoading, ready, setBaseline]);

  // Keep query inputs and FilterCard configuration stable between unrelated renders.
  const queryFilters = useMemo(() => ready ? ({
    search: debouncedSearch,
    roles: roleFilters,
    statuses: statusFilters,
  }) : null, [debouncedSearch, ready, roleFilters, statusFilters]);
  const hasActiveQueryFilters = Boolean(debouncedSearch || roleFilters.length || statusFilters.length);
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
    search, setSearch, queryFilters, statusFilters, roleFilters, sorting, setSorting,
    columnWidths, setColumnWidths, hiddenColumns, setHiddenColumns,
    error, filterCategories, applyFilter, clearFilters, hasActiveQueryFilters,
  };
}
