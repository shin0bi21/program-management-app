import { useCallback, useMemo, useState } from 'react';

import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import {
  TASK_CATEGORY_OPTIONS,
  type TaskCategory,
  type TaskListStatus,
  type TaskOptions,
} from '../../../../common/features/tasks/types';

import type { TaskPreferences } from '../types';

const STATUS_OPTIONS: Array<{ value: TaskListStatus; label: string }> = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface UseTaskFiltersOptions {
  preferences: TaskPreferences;
  options: TaskOptions | undefined;
  updatePreferences: (patch: Partial<TaskPreferences>) => void;
}

export default function useTaskFilters({
  preferences,
  options,
  updatePreferences,
}: UseTaskFiltersOptions) {
  // Search is intentionally local; the remaining filters are persisted.
  const [search, setSearch] = useState('');

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    {
      id: 'staff',
      label: 'Staff',
      options: (options?.resources ?? []).map(item => ({ value: item.id, label: item.name })),
    },
    {
      id: 'program',
      label: 'Program',
      options: (options?.programs ?? []).map(item => ({ value: item.id, label: item.name })),
    },
    { id: 'category', label: 'Category', options: TASK_CATEGORY_OPTIONS },
    { id: 'status', label: 'Status', options: STATUS_OPTIONS },
  ], [options?.programs, options?.resources]);

  const applyFilter = useCallback((id: string, selected: string[]) => {
    if (id === 'staff') updatePreferences({ staffIds: selected });
    if (id === 'program') updatePreferences({ programIds: selected });
    if (id === 'category') updatePreferences({ categories: selected as TaskCategory[] });
    if (id === 'status') updatePreferences({ statuses: selected as TaskListStatus[] });
  }, [updatePreferences]);

  const clearFilters = useCallback(() => updatePreferences({
    staffIds: [],
    programIds: [],
    categories: [],
    statuses: [],
  }), [updatePreferences]);

  return {
    search,
    setSearch,
    staffIds: preferences.staffIds,
    programIds: preferences.programIds,
    categories: preferences.categories,
    statusFilters: preferences.statuses,
    filterCategories,
    applyFilter,
    clearFilters,
  };
}
