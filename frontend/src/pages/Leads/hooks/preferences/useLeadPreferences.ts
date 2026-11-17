import { useMemo } from 'react';
import createPreferenceFilters from '../../../../common/features/Preferences/createPreferenceFilters';
import type { ProgramReference } from '../../../../common/features/referenceData/referenceData.api';
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
import type { LeadFilters, LeadOrigin, LeadSortKey, LeadStatus, LeadSubmitterRole } from '../../types';

const statuses: LeadStatus[] = ['new', 'contacted', 'eligible', 'ineligible', 'deferred', 'closed', 'signed_up'];
const externalSubmitterRoles: LeadSubmitterRole[] = ['youth', 'parent', 'guardian'];
const DEFAULT_SORTING: ListSort<LeadSortKey> = { key: 'created', direction: 'desc' };

/**
 * Restores lead controls and supplies applied filters restricted to the selected origin.
 * @param origin - Lead collection whose filters are being edited.
 * @param preferenceKey - Account preference record for that collection.
 * @param programs - Available program choices.
 * @param programsLoading - Whether program choices are still loading.
 * @param programsError - Failed program lookup; preserves unverified selections.
 * @param tableKeys - Supported sorting and layout columns.
 * @example Internal leads discard saved external submitter-role filters.
 */
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

  const filterCategories = useMemo(() => [
    { id: 'programIds' as const, label: 'Program', options: programs.map(({ id, title }) => ({ id, label: title })) },
    { id: 'statuses' as const, label: 'Status', options: statuses.map(status => ({ id: status, label: statusLabel(status) })) },
    ...(origin === 'external' ? [{
      id: 'submitterRoles' as const,
      label: 'Filled Out By',
      options: externalSubmitterRoles.map(role => ({ id: role, label: statusLabel(role) })),
    }] : []),
  ], [origin, programs]);

  const appliedFilters: LeadFilters = {
    search: preferences.search,
    statuses: preferences.statuses,
    programIds: preferences.programIds,
    origins: preferences.origins,
    submitterRoles: preferences.submitterRoles,
  };

  return {
    ready,
    error,
    appliedFilters,
    search: {
      appliedValue: preferences.search,
      apply: (search: string) => updatePreferences({ search }),
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
      setSorting: (sorting: ListSort<LeadSortKey>) => updatePreferences({ sorting }),
      columnWidths: layout.columnWidths,
      setColumnWidths: layout.setColumnWidths,
      hiddenColumns: layout.hiddenColumns,
      setHiddenColumns: layout.setHiddenColumns,
    },
  };
}

/**
 * Displays an underscore-separated filter value as capitalized words.
 * @param value - A nonempty status or submitter-role key.
 * @example statusLabel('signed_up') // "Signed Up"
 */
function statusLabel(value: string) {
  return value
    .split('_')
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
