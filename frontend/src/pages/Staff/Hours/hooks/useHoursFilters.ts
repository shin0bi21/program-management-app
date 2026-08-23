import { useCallback, useMemo, useState } from 'react';

import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import { HOURS_CATEGORY_OPTIONS } from '../../../../common/features/hours/hoursOptions';
import type {
  StaffResource,
  HoursCategory,
  HoursProgram,
} from '../../../../common/features/hours/types';
import type { ProgramCycle } from '../../../../common/types/cohort';

import type { HoursEntryType, HoursPreferences } from '../types';

export default function useHoursFilters({
  role,
  preferences,
  resources,
  programs,
  cycles,
  updatePreferences,
}: {
  role: string | null;
  preferences: HoursPreferences;
  resources: readonly StaffResource[];
  programs: readonly HoursProgram[];
  cycles: readonly ProgramCycle[];
  updatePreferences: (patch: Partial<HoursPreferences>) => void;
}) {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const applySearch = useCallback(() => setAppliedSearch(search.trim()), [search]);
  const clearSearch = useCallback(() => {
    setSearch('');
    setAppliedSearch('');
  }, []);

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    ...(role === 'admin' ? [{
      id: 'staff',
      label: 'Staff',
      options: resources.map(resource => ({ value: resource.id, label: resource.name })),
    }] : []),
    {
      id: 'program',
      label: 'Program',
      options: [
        { value: 'general', label: 'General' },
        ...programs.map(program => ({ value: program.id, label: program.name })),
      ],
    },
    { id: 'entryType', label: 'Category', options: HOURS_CATEGORY_OPTIONS },
    { id: 'type', label: 'Type', options: [
      { value: 'task', label: 'Task' },
      { value: 'session', label: 'Session' },
      { value: 'other', label: 'Regular' },
    ] },
    {
      id: 'cycle',
      label: 'Cycle',
      selectionMode: 'single',
      options: cycles.map(cycle => ({ value: cycle.id, label: cycle.name })),
    },
  ], [cycles, programs, resources, role]);

  const applyFilter = useCallback((id: string, selected: string[]) => {
    if (id === 'staff') updatePreferences({ staffIds: selected });
    if (id === 'program') updatePreferences({ programIds: selected });
    if (id === 'entryType') updatePreferences({ categories: selected as HoursCategory[] });
    if (id === 'type') updatePreferences({ types: selected as HoursEntryType[] });
    if (id === 'cycle') updatePreferences({ cycleId: selected[0] ?? null });
  }, [updatePreferences]);

  const clearFilters = useCallback(() => updatePreferences({
    staffIds: [],
    programIds: [],
    categories: [],
    types: [],
    cycleId: null,
  }), [updatePreferences]);

  const selectCycle = useCallback(
    (cycleId: string) => updatePreferences({ cycleId }),
    [updatePreferences],
  );

  return {
    search,
    setSearch,
    appliedSearch,
    applySearch,
    clearSearch,
    staffIds: preferences.staffIds,
    programIds: preferences.programIds,
    categories: preferences.categories,
    types: preferences.types,
    cycleId: preferences.cycleId,
    filterCategories,
    applyFilter,
    clearFilters,
    selectCycle,
  };
}
