import { useMemo, useState } from 'react';
import createPreferenceFilters from '../../../../common/features/Preferences/createPreferenceFilters';
import type { TableSorting } from '../../../../common/components/Table/Table.types';
import usePreferences from '../../../../common/features/Preferences/usePreferences';
import useTableLayout from '../../../../common/features/Preferences/useTableLayout';
import {
  preferenceOptions,
  preferenceSorting,
} from '../../../../common/features/Preferences/preferences';
import type { ListSort } from '../../../../common/components/Table/Table.types';
import type { UserRole, UserSortKey, UserStatus } from '../types';

const DEFAULT_SORTING: ListSort<UserSortKey> = { key: 'name', direction: 'asc' };

/**
 * Restores account filters and layout while keeping applied search in this page session.
 * @param isAdmin - Whether role filters are available.
 * @param tableKeys - Supported sorting and layout columns.
 * @example search.apply('Alex') changes the session search without saving an account preference.
 */
export function useAccountControls(
  isAdmin: boolean,
  tableKeys: readonly UserSortKey[],
) {
  const layout = useTableLayout({ key: 'account-filters', tableKeys });
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'account-filters',
    waiting: false,
    fields: {
      statuses: preferenceOptions<UserStatus>(['invited', 'active', 'inactive']),
      roles: preferenceOptions<UserRole>(isAdmin ? ['admin', 'project_manager', 'staff', 'youth'] : []),
      sorting: preferenceSorting(tableKeys, DEFAULT_SORTING),
    },
  });

  const [appliedSearch, setAppliedSearch] = useState('');

  const filterCategories = useMemo(() => [
    { id: 'statuses' as const, label: 'Status', options: [
      { id: 'active', name: 'Active' },
      { id: 'invited', name: 'Invited' },
      { id: 'inactive', name: 'Inactive' },
    ] },
    ...(isAdmin ? [{ id: 'roles' as const, label: 'Role', options: [
      { id: 'admin', name: 'Admin' },
      { id: 'project_manager', name: 'Project Manager' },
      { id: 'staff', name: 'Staff' },
      { id: 'youth', name: 'Youth' },
    ] }] : []),
  ], [isAdmin]);

  return {
    ready,
    error,
    search: {
      appliedValue: appliedSearch,
      apply: setAppliedSearch,
    },
    filters: createPreferenceFilters({
      values: {
        statuses: preferences.statuses,
        roles: preferences.roles,
      },
      definitions: filterCategories,
      updatePreferences,
    }),
    table: {
      sorting: preferences.sorting,
      setSorting: (sorting: TableSorting) => updatePreferences({ sorting: sorting as ListSort<UserSortKey> }),
      columnWidths: layout.columnWidths,
      setColumnWidths: layout.setColumnWidths,
      hiddenColumns: layout.hiddenColumns,
      setHiddenColumns: layout.setHiddenColumns,
    },
  };
}
