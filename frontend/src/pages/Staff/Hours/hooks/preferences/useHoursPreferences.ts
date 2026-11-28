import { useMemo } from 'react';

import { getCycleDateRange } from '../../../../../common/features/programming/cycles/cycleDateRange';
import usePreferences from '../../../../../common/features/Preferences/hooks/usePreferences';
import useTableLayout from '../../../../../common/features/Preferences/hooks/useTableLayout';
import {
  preferenceOption,
  preferenceOptions,
  preferenceIds,
  preferenceText,
  preferenceSorting,
} from '../../../../../common/features/Preferences/preferences';
import {
  HOURS_CATEGORIES,
  type Hours,
  type HoursCategory,
  type HoursFilters,
  type HoursSortKey,
} from '../../types';
import type { PageFilterControls, PageSearchControls } from '../../../../../common/components/PageContainer/PageContainer.types';
import type { ListSort } from '../../../../../common/components/Table/Table.types';
import type { HoursReferences } from '../data/useHoursReferenceData';

type HoursView = 'calendar' | 'table';

interface HoursPreferences extends Omit<HoursFilters, 'dateRange' | 'cycleIds'> {
  view: HoursView;
  cycleIds: NonNullable<HoursFilters['cycleIds']>;
  sorting: ListSort<HoursSortKey>;
}

export type StoredHoursPreferences = Partial<HoursPreferences>;

type HoursFilterValues = Pick<HoursPreferences, 'staffIds' | 'programIds' | 'categories' | 'types' | 'cycleIds'>;

type HoursTableControls = ReturnType<typeof useTableLayout> & {
  sorting: ListSort<HoursSortKey>;
  setSorting: (sorting: ListSort<HoursSortKey>) => void;
};

interface HoursPreferencesResult {
  ready: boolean;
  error: string | null;
  appliedFilters: HoursFilters;
  view: HoursView;
  setView: (view: HoursView) => void;
  search: PageSearchControls;
  filters: PageFilterControls<HoursFilterValues>;
  table: HoursTableControls;
}

/**
 * Restores hours controls and supplies applied filters with cycle-derived calendar bounds.
 * @param references - Reference choices and availability from the Hours data hook.
 * @param tableKeys - Supported sort and layout columns.
 * @example Submitting search.apply('workshop') saves the applied hours search.
 */
export default function useHoursPreferences(
  references: HoursReferences,
  tableKeys: readonly HoursSortKey[],
): HoursPreferencesResult {
  const { hoursOptions, staff, programs, cycles } = references;
  const categories = hoursOptions.data?.categories;
  const types = hoursOptions.data?.types;
  const loadingDependencies = hoursOptions.isLoading || staff.isLoading || programs.isLoading || cycles.isLoading;

  // Unavailable choices preserve saved selections; confirmed empty choices clear them.
  const availableStaffIds = !loadingDependencies && !staff.error
    ? (staff.data ?? []).map(member => member.id)
    : undefined;

  const availableProgramIds = !loadingDependencies && !programs.error
    ? ['general', ...(programs.data ?? []).map(program => program.id)]
    : undefined;

  const availableCycleIds = !loadingDependencies && !cycles.error
    ? (cycles.data ?? []).map(cycle => cycle.id)
    : undefined;

  const availableCategories = !loadingDependencies && !hoursOptions.error
    ? (categories ?? []).map(category => category.id)
    : null;

  const availableTypes = !loadingDependencies && !hoursOptions.error
    ? (types ?? []).map(type => type.id)
    : null;

  // Saved controls.
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'hours-filters',
    waiting: loadingDependencies,
    fields: {
      view: preferenceOption(['calendar', 'table'] as const, 'calendar'),
      search: preferenceText(),
      staffIds: preferenceIds(availableStaffIds),
      programIds: preferenceIds(availableProgramIds),
      categories: preferenceOptions<HoursCategory>(
        HOURS_CATEGORIES,
        [],
        availableCategories,
      ),
      types: preferenceOptions<Hours['type']>(
        ['task', 'session', 'regular'],
        [],
        availableTypes,
      ),
      cycleIds: preferenceIds(availableCycleIds),
      sorting: preferenceSorting(tableKeys, { key: 'date', direction: 'desc' }),
    },
  });

  // Filter controls and applied query inputs.
  const filterDefinitions = useMemo(() => [
    {
      id: 'staffIds' as const,
      label: 'Staff',
      options: (staff.data ?? []).map(({ id, name }) => ({ id, label: name })),
    },
    {
      id: 'programIds' as const,
      label: 'Program',
      options: [
        { id: 'general', label: 'General' },
        ...(programs.data ?? []).map(({ id, title }) => ({ id, label: title })),
      ],
    },
    {
      id: 'cycleIds' as const,
      label: 'Cycle',
      options: (cycles.data ?? []).map(({ id, title }) => ({ id, label: title })),
    },
    {
      id: 'types' as const,
      label: 'Type',
      options: (types ?? []).map(({ id, name }) => ({ id, label: name })),
    },
    {
      id: 'categories' as const,
      label: 'Category',
      options: (categories ?? []).map(({ id, name }) => ({ id, label: name })),
    },
  ], [categories, cycles.data, programs.data, staff.data, types]);

  const filterValues: HoursFilterValues = {
    staffIds: preferences.staffIds,
    programIds: preferences.programIds,
    categories: preferences.categories,
    types: preferences.types,
    cycleIds: preferences.cycleIds,
  };
  const dateRange = useMemo(() => getCycleDateRange(cycles.data ?? [], preferences.cycleIds), [cycles.data, preferences.cycleIds]);

  const appliedFilters: HoursFilters = {
    ...filterValues,
    dateRange,
    search: preferences.search,
  };

  // View, search, and table controls.
  const setView = (view: HoursView) => {
    updatePreferences({ view });
  };
  const search = {
    appliedValue: preferences.search,
    apply: (search: string) => updatePreferences({ search }),
  };
  const layout = useTableLayout({ key: 'hours-filters', tableKeys });
  const updateSorting = (sorting: ListSort<HoursSortKey>) => {
    updatePreferences({ sorting });
  };

  const table = {
    sorting: preferences.sorting,
    setSorting: updateSorting,
    columnWidths: layout.columnWidths,
    setColumnWidths: layout.setColumnWidths,
    hiddenColumns: layout.hiddenColumns,
    setHiddenColumns: layout.setHiddenColumns,
  };

  return {
    ready,
    error,
    appliedFilters,
    view: preferences.view,
    setView,
    search,
    filters: { values: filterValues, definitions: filterDefinitions, update: updatePreferences },
    table,
  };
}
