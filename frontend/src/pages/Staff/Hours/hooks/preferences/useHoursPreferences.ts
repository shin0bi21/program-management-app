import { useMemo } from 'react';

import createPreferenceFilters from '../../../../../common/features/Preferences/createPreferenceFilters';
import { getCycleDateRange } from '../../../../../common/features/programming/cycles/cycleDateRange';
import usePreferences from '../../../../../common/features/Preferences/usePreferences';
import useTableLayout from '../../../../../common/features/Preferences/useTableLayout';
import {
  preferenceOption,
  preferenceOptions,
  preferenceIds,
  preferenceText,
  preferenceSorting,
} from '../../../../../common/features/Preferences/preferences';
import type {
  StaffReference,
  HoursCategory,
  HoursFilters,
  HoursItemType,
  HoursProgram,
  HoursSortKey,
} from '../../types';
import type { CycleReference } from '../../../../../common/features/referenceData/referenceData.api';
import type { ListSort } from '../../../../../common/components/Table/Table.types';

type HoursView = 'calendar' | 'table';

interface HoursPreferences {
  view: HoursView;
  search: string;
  staffIds: string[];
  programIds: string[];
  categories: HoursCategory[];
  types: HoursItemType[];
  cycleIds: string[];
  sorting: ListSort<HoursSortKey>;
}

export type StoredHoursPreferences = Partial<HoursPreferences>;

interface UseHoursPreferencesOptions {
  staff: readonly StaffReference[];
  programs: readonly HoursProgram[];
  cycles: readonly CycleReference[];
  categories: ReadonlyArray<{ id: HoursCategory; name: string }>;
  types: ReadonlyArray<{ id: HoursItemType; name: string }>;
  loadingDependencies: boolean;
  optionsError: boolean;
  staffError?: boolean;
  programsError?: boolean;
  cyclesError: boolean;
  tableKeys: readonly HoursSortKey[];
}

/**
 * Restores hours controls and supplies applied filters with cycle-derived calendar bounds.
 * @param options - Available filter choices, dependency status, and table keys.
 * @example Submitting search.apply('workshop') saves the applied hours search.
 */
export default function useHoursPreferences({
  staff,
  programs,
  cycles,
  categories,
  types,
  loadingDependencies,
  optionsError,
  staffError = optionsError,
  programsError = optionsError,
  cyclesError,
  tableKeys,
}: UseHoursPreferencesOptions) {
  // Unavailable choices preserve saved selections; confirmed empty choices clear them.
  const availableStaffIds = !loadingDependencies && !staffError
    ? staff.map(member => member.id)
    : undefined;

  const availableProgramIds = !loadingDependencies && !programsError
    ? ['general', ...programs.map(program => program.id)]
    : undefined;

  const availableCycleIds = !loadingDependencies && !cyclesError
    ? cycles.map(cycle => cycle.id)
    : undefined;

  const availableCategories = !loadingDependencies && !optionsError
    ? categories.map(category => category.id)
    : null;

  const availableTypes = !loadingDependencies && !optionsError
    ? types.map(type => type.id)
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
        ['program_delivery', 'planning_prep', 'meeting', 'administration', 'outreach', 'maintenance', 'other'],
        [],
        availableCategories,
      ),
      types: preferenceOptions<HoursItemType>(
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
      options: staff.map(({ id, name }) => ({ id, label: name })),
    },
    {
      id: 'programIds' as const,
      label: 'Program',
      options: [
        { id: 'general', label: 'General' },
        ...programs.map(({ id, title }) => ({ id, label: title })),
      ],
    },
    {
      id: 'cycleIds' as const,
      label: 'Cycle',
      options: cycles.map(({ id, title }) => ({ id, label: title })),
    },
    {
      id: 'types' as const,
      label: 'Type',
      options: types.map(({ id, name }) => ({ id, label: name })),
    },
    {
      id: 'categories' as const,
      label: 'Category',
      options: categories.map(({ id, name }) => ({ id, label: name })),
    },
  ], [categories, cycles, programs, staff, types]);

  const filterControls = createPreferenceFilters({
    values: {
      staffIds: preferences.staffIds,
      programIds: preferences.programIds,
      categories: preferences.categories,
      types: preferences.types,
      cycleIds: preferences.cycleIds,
    },
    definitions: filterDefinitions,
    updatePreferences,
  });
  const dateRange = useMemo(() => getCycleDateRange(cycles, preferences.cycleIds), [cycles, preferences.cycleIds]);

  const appliedFilters: HoursFilters = {
    dateRange,
    staffIds: preferences.staffIds,
    categories: preferences.categories,
    programIds: preferences.programIds,
    types: preferences.types,
    cycleIds: preferences.cycleIds,
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
    filters: filterControls,
    table,
  };
}
