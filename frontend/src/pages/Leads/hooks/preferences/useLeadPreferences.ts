import { useMemo, useState } from 'react';
import createPreferenceFilters from '../../../../common/features/Preferences/createPreferenceFilters';
import type { TableSorting } from '../../../../common/components/Table/Table.types';
import type { ProgramReference } from '../../../../common/features/referenceData/referenceData.api';
import { toFilterOptions } from '../../../../common/features/referenceData/filterOptions';
import usePreferences from '../../../../common/features/Preferences/usePreferences';
import useTableLayout from '../../../../common/features/Preferences/useTableLayout';
import {
  preferenceOptions,
  preferenceIds,
  preferenceText,
  fixedPreference,
  preferenceSorting,
} from '../../../../common/features/Preferences/preferences';
import type { ListSort } from '../../../../common/components/Table/Table.types';
import type { LeadOrigin, LeadSortKey, LeadStatus, LeadSubmitterRole } from '../../types';

const statuses: LeadStatus[] = ['new', 'contacted', 'eligible', 'ineligible', 'deferred', 'closed', 'signed_up'];
const externalSubmitterRoles: LeadSubmitterRole[] = ['youth', 'parent', 'guardian'];
const DEFAULT_SORTING: ListSort<LeadSortKey> = { key: 'created', direction: 'desc' };

export function useLeadPreferences(
  origin: LeadOrigin,
  preferenceKey: 'outreach-external-leads-filters' | 'outreach-internal-leads-filters',
  programs: ProgramReference[],
  programsLoading: boolean,
  programsError: string | null,
  tableKeys: readonly LeadSortKey[],
) {
  const layout = useTableLayout({ key: preferenceKey, tableKeys });
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: preferenceKey,
    waiting: programsLoading,
    fields: {
      search: preferenceText(),
      statuses: preferenceOptions(statuses),
      programIds: preferenceIds(programsLoading || programsError ? undefined : programs.map(program => program.id)),
      origins: fixedPreference([origin]),
      submitterRoles: preferenceOptions(origin === 'external' ? externalSubmitterRoles : []),
      sorting: preferenceSorting(tableKeys, DEFAULT_SORTING),
    },
  });

  const [searchDraft, setSearchDraft] = useState<string | null>(null);
  const searchValue = searchDraft ?? preferences.search;

  const filterCategories = useMemo(() => [
    { id: 'programIds' as const, label: 'Program', options: toFilterOptions(programs) },
    { id: 'statuses' as const, label: 'Status', options: statuses.map(status => ({ value: status, label: statusLabel(status) })) },
    ...(origin === 'external' ? [{
      id: 'submitterRoles' as const,
      label: 'Filled Out By',
      options: externalSubmitterRoles.map(role => ({ value: role, label: statusLabel(role) })),
    }] : []),
  ], [origin, programs]);

  const applySearch = () => {
    updatePreferences({ search: searchValue });
    setSearchDraft(null);
  };

  const clearSearch = () => {
    updatePreferences({ search: '' });
    setSearchDraft(null);
  };

  return {
    ready,
    error,
    search: {
      value: searchValue,
      appliedValue: preferences.search,
      setValue: setSearchDraft,
      apply: applySearch,
      clear: clearSearch,
    },
    filters: createPreferenceFilters({
      values: {
        statuses: preferences.statuses,
        programIds: preferences.programIds,
        submitterRoles: preferences.submitterRoles,
      },
      definitions: filterCategories,
      updatePreferences,
    }),
    table: {
      sorting: preferences.sorting,
      setSorting: (sorting: TableSorting) => updatePreferences({ sorting: sorting as ListSort<LeadSortKey> }),
      columnWidths: layout.columnWidths,
      setColumnWidths: layout.setColumnWidths,
      hiddenColumns: layout.hiddenColumns,
      setHiddenColumns: layout.setHiddenColumns,
    },
  };
}

function statusLabel(value: string) {
  return value
    .split('_')
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
