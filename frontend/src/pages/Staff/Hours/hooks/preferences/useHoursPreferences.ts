import createPreferenceFilters from '../../../../../common/features/Preferences/createPreferenceFilters';
import { useMemo, useState } from 'react';
import { toFilterOptions } from '../../../../../common/features/referenceData/filterOptions';

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

export default function useHoursPreferences({
  role,
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
}: {
  role: string | null;
  staff: readonly StaffReference[];
  programs: readonly HoursProgram[];
  cycles: readonly CycleReference[];
  categories: ReadonlyArray<{ value: HoursCategory; label: string }>;
  types: ReadonlyArray<{ value: HoursItemType; label: string }>;
  loadingDependencies: boolean;
  optionsError: boolean;
  staffError?: boolean;
  programsError?: boolean;
  cyclesError: boolean;
  tableKeys: readonly HoursSortKey[];
}) {
  const canVerifyOptions = !loadingDependencies && !optionsError;
  const canVerifyCycles = !loadingDependencies && !cyclesError;
  const layout = useTableLayout({ key: 'hours-filters', tableKeys });
  const { preferences, updatePreferences, ready, error } = usePreferences({
    key: 'hours-filters',
    waiting: loadingDependencies || role === null,
    fields: {
      view: preferenceOption(['calendar', 'table'] as const, 'calendar'),
      search: preferenceText(),
      staffIds: preferenceIds(role !== 'admin' ? [] : !loadingDependencies && !staffError
        ? staff.map(staffMember => staffMember.id) : undefined),
      programIds: preferenceIds(!loadingDependencies && !programsError ? ['general', ...programs.map(program => program.id)] : undefined),
      categories: preferenceOptions<HoursCategory>(
        ['program_delivery', 'planning_prep', 'meeting', 'administration', 'outreach', 'maintenance', 'other'],
        [],
        canVerifyOptions ? categories.map(category => category.value) : null,
      ),
      types: preferenceOptions<HoursItemType>(
        ['task', 'session', 'regular'],
        [],
        canVerifyOptions ? types.map(type => type.value) : null,
      ),
      cycleIds: preferenceIds(canVerifyCycles ? cycles.map(cycle => cycle.id) : undefined),
      sorting: preferenceSorting(tableKeys, { key: 'date', direction: 'desc' }),
    },
  });
  const dateRange = useMemo(() => getCycleDateRange(cycles, preferences.cycleIds), [cycles, preferences.cycleIds]);
  const [searchDraft, setSearchValue] = useState<string | null>(null);
  const searchValue = searchDraft ?? preferences.search;

  // View preference.
  const setView = (view: HoursPreferences['view']) => {
    updatePreferences({ view });
  };

  // Search preference.
  const applySearch = () => {
    updatePreferences({ search: searchValue.trim() });
  };
  const clearSearch = () => {
    setSearchValue('');
    updatePreferences({ search: '' });
  };

  // Filter preferences.
  const filterDefinitions = useMemo(() => [
    ...(role === 'admin' ? [{
      id: 'staffIds' as const,
      label: 'Staff',
      options: toFilterOptions(staff),
    }] : []),
    {
      id: 'programIds' as const,
      label: 'Program',
      options: [
        { value: 'general', label: 'General' },
        ...toFilterOptions(programs),
      ],
    },
    {
      id: 'cycleIds' as const,
      label: 'Cycle',
      options: toFilterOptions(cycles),
    },
    { id: 'types' as const, label: 'Type', options: [...types] },
    { id: 'categories' as const, label: 'Category', options: [...categories] },
  ], [categories, cycles, programs, staff, role, types]);

  const updateSorting = (sorting: ListSort<HoursSortKey>) => {
    updatePreferences({ sorting });
  };

  return {
    ready,
    error,

    view: preferences.view,
    setView,

    search: {
      value: searchValue,
      appliedValue: preferences.search,
      setValue: setSearchValue,
      apply: applySearch,
      clear: clearSearch,
    },

    filters: {
      ...createPreferenceFilters({
        values: {
          staffIds: preferences.staffIds,
          programIds: preferences.programIds,
          categories: preferences.categories,
          types: preferences.types,
          cycleIds: preferences.cycleIds,
        },
        definitions: filterDefinitions,
        updatePreferences,
      }),
      dateRange,
    },

    table: {
      sorting: preferences.sorting,
      setSorting: updateSorting,
      columnWidths: layout.columnWidths,
      setColumnWidths: layout.setColumnWidths,
      hiddenColumns: layout.hiddenColumns,
      setHiddenColumns: layout.setHiddenColumns,
    },
  };
}
