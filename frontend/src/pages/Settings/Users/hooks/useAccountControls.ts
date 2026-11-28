import { useMemo } from 'react';
import usePreferences from '../../../../common/features/Preferences/hooks/usePreferences';
import useTableLayout from '../../../../common/features/Preferences/hooks/useTableLayout';
import {
  preferenceText,
  preferenceOptions,
  preferenceSorting,
} from '../../../../common/features/Preferences/preferences';
import type { ListSort } from '../../../../common/components/Table/Table.types';
import type { UserFilters, UserRole, UserSortKey, UserStatus } from '../types';

const DEFAULT_SORTING: ListSort<UserSortKey> = { key: 'name', direction: 'asc' };

/**
 * Restores saved account search, filters, and layout and supplies applied request filters.
 * @param isAdmin - Whether role filters are available.
 * @param tableKeys - Supported sorting and layout columns.
 * @example search.apply('Alex') saves the applied account search alongside other controls.
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
      search: preferenceText(),
      statuses: preferenceOptions<UserStatus>(['invited', 'active', 'inactive']),
      roles: preferenceOptions<UserRole>(isAdmin ? ['admin', 'project_manager', 'staff', 'youth'] : []),
      sorting: preferenceSorting(tableKeys, DEFAULT_SORTING),
    },
  });

  const filterCategories = useMemo(() => [
    { id: 'statuses' as const, label: 'Status', options: [
      { id: 'active', label: 'Active' },
      { id: 'invited', label: 'Invited' },
      { id: 'inactive', label: 'Inactive' },
    ] },
    ...(isAdmin ? [{ id: 'roles' as const, label: 'Role', options: [
      { id: 'admin', label: 'Admin' },
      { id: 'project_manager', label: 'Project Manager' },
      { id: 'staff', label: 'Staff' },
      { id: 'youth', label: 'Youth' },
    ] }] : []),
  ], [isAdmin]);

  const appliedFilters: UserFilters = {
    search: preferences.search,
    roles: preferences.roles,
    statuses: preferences.statuses,
  };

  return {
    ready,
    error,
    appliedFilters,
    search: {
      appliedValue: preferences.search,
      apply: (search: string) => updatePreferences({ search }),
    },
    filters: {
      values: {
        statuses: preferences.statuses,
        roles: preferences.roles,
      },
      definitions: filterCategories,
      update: updatePreferences,
    },
    table: {
      sorting: preferences.sorting,
      setSorting: (sorting: ListSort<UserSortKey>) => updatePreferences({ sorting }),
      columnWidths: layout.columnWidths,
      setColumnWidths: layout.setColumnWidths,
      hiddenColumns: layout.hiddenColumns,
      setHiddenColumns: layout.setHiddenColumns,
    },
  };
}
