import { useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { TableSorting } from '../../../../common/components/Table/Table.types';
import usePreferences from '../../../../common/features/Preferences/usePreferences';
import {
  preferenceOptions,
  preferenceSorting,
  preferenceColumnWidths,
  preferenceHiddenColumns,
} from '../../../../common/features/Preferences/preferences';
import type { ListSort } from '../../../../common/components/Table/Table.types';
import type { UserRole, UserSortKey, UserStatus } from '../types';

const DEFAULT_SORTING: ListSort<UserSortKey> = { key: 'name', direction: 'asc' };

export function useAccountControls(
  isAdmin: boolean,
  tableKeys: readonly UserSortKey[],
) {
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'account-filters',
    waiting: false,
    fields: {
      statuses: preferenceOptions<UserStatus>(['invited', 'active', 'inactive']),
      roles: preferenceOptions<UserRole>(isAdmin ? ['admin', 'project_manager', 'staff', 'youth'] : []),
      sorting: preferenceSorting(tableKeys, DEFAULT_SORTING),
      columnWidths: preferenceColumnWidths(tableKeys),
      hiddenColumns: preferenceHiddenColumns(tableKeys),
    },
  });

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const applySearch = () => setAppliedSearch(search.trim());
  const clearSearch = () => {
    setSearch('');
    setAppliedSearch('');
  };

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    { id: 'status', label: 'Status', options: [
      { value: 'active', label: 'Active' },
      { value: 'invited', label: 'Invited' },
      { value: 'inactive', label: 'Inactive' },
    ] },
    ...(isAdmin ? [{ id: 'role', label: 'Role', options: [
      { value: 'admin', label: 'Admin' },
      { value: 'project_manager', label: 'Project Manager' },
      { value: 'staff', label: 'Staff' },
      { value: 'youth', label: 'Youth' },
    ] }] : []),
  ], [isAdmin]);

  const applyFilter = (category: string, selected: string[]) => {
    if (category === 'status') updatePreferences({ statuses: selected as UserStatus[] });
    if (category === 'role' && isAdmin) updatePreferences({ roles: selected as UserRole[] });
  };

  return {
    ready,
    error,
    search: {
      value: search,
      setValue: setSearch,
      appliedValue: appliedSearch,
      apply: applySearch,
      clear: clearSearch,
    },
    filters: {
      statuses: preferences.statuses,
      roles: preferences.roles,
      definitions: filterCategories,
      apply: applyFilter,
      clear: () => updatePreferences({ statuses: [], roles: [] }),
    },
    table: {
      sorting: preferences.sorting,
      setSorting: (sorting: TableSorting) => updatePreferences({ sorting: sorting as ListSort<UserSortKey> }),
      columnWidths: preferences.columnWidths,
      setColumnWidths: (columnWidths: Record<string, number>) => updatePreferences({ columnWidths }),
      hiddenColumns: preferences.hiddenColumns,
      setHiddenColumns: (hiddenColumns: string[]) => updatePreferences({ hiddenColumns }),
    },
  };
}
