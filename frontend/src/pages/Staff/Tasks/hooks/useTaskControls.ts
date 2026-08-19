import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import type { ListSort } from '../../../../common/types/pagination';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import {
  TASK_CATEGORY_OPTIONS,
  type TaskCategory,
  type TaskOptions,
  type TaskStatus,
} from '../../../../common/features/tasks/types';
import type { TaskSortKey } from '../taskViewTypes';
import type { TaskPreference } from '../types';

export type TasksView = 'calendar' | 'list';

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function useTaskControls(
  options: TaskOptions | undefined,
  optionsLoading: boolean,
  columnKeys: readonly string[],
) {
  const [view, setView] = useState<TasksView>('calendar');
  const [search, setSearch] = useState('');
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [programIds, setProgramIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [statusFilters, setStatusFilters] = useState<TaskStatus[]>([]);
  const [sorting, setSorting] = useState<ListSort<TaskSortKey>>({ key: 'startDate', direction: 'asc' });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const {
    preference,
    loading,
    error,
    setBaseline,
    save,
  } = useUserPreference<TaskPreference>('task-filters', columnKeys);

  useEffect(() => {
    if (ready || loading || optionsLoading) return;
    const restoredView = preference?.view ?? 'calendar';
    const restoredStaffIds = preference?.staffIds ?? [];
    const restoredSorting = preference?.sorting ?? { key: 'startDate', direction: 'asc' };
    const restoredColumnWidths = preference?.columnWidths ?? {};
    const restoredHiddenColumns = preference?.hiddenColumns ?? [];
    const restored: TaskPreference = {
      view: restoredView,
      staffIds: restoredStaffIds,
      programIds: preference?.programIds ?? [],
      categories: preference?.categories ?? [],
      statuses: preference?.statuses ?? [],
      sorting: restoredSorting,
      columnWidths: restoredColumnWidths,
      hiddenColumns: restoredHiddenColumns,
    };
    setStaffIds(restoredStaffIds);
    setProgramIds(restored.programIds);
    setView(restoredView);
    setCategories(restored.categories);
    setStatusFilters(restored.statuses);
    setSorting(restoredSorting);
    setColumnWidths(restoredColumnWidths);
    setHiddenColumns(restoredHiddenColumns);
    setBaseline(restored);
    setReady(true);
  }, [loading, optionsLoading, preference, ready, setBaseline]);

  const persist = useCallback((next: {
    view?: TasksView;
    staffIds?: string[];
    programIds?: string[];
    categories?: TaskCategory[];
    statuses?: TaskStatus[];
    sorting?: ListSort<TaskSortKey>;
    columnWidths?: Record<string, number>;
    hiddenColumns?: string[];
  }) => save(current => ({
    view: next.view ?? current?.view ?? view,
    staffIds: next.staffIds ?? current?.staffIds ?? staffIds,
    programIds: next.programIds ?? current?.programIds ?? programIds,
    categories: next.categories ?? current?.categories ?? categories,
    statuses: next.statuses ?? current?.statuses ?? statusFilters,
    sorting: next.sorting ?? current?.sorting ?? sorting,
    columnWidths: next.columnWidths ?? current?.columnWidths ?? columnWidths,
    hiddenColumns: next.hiddenColumns ?? current?.hiddenColumns ?? hiddenColumns,
  })), [categories, columnWidths, hiddenColumns, programIds, save, sorting, staffIds, statusFilters, view]);

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    { id: 'staff', label: 'Staff', options: (options?.resources ?? []).map(item => ({ value: item.id, label: item.name })) },
    { id: 'program', label: 'Program', options: (options?.programs ?? []).map(item => ({ value: item.id, label: item.name })) },
    { id: 'category', label: 'Category', options: TASK_CATEGORY_OPTIONS },
    { id: 'status', label: 'Status', options: STATUS_OPTIONS },
  ], [options?.programs, options?.resources]);

  const applyFilter = useCallback((id: string, selected: string[]) => {
    const nextStaffIds = id === 'staff' ? selected : staffIds;
    const nextPrograms = id === 'program' ? selected : programIds;
    const nextCategories = id === 'category' ? selected as TaskCategory[] : categories;
    const nextStatuses = id === 'status' ? selected as TaskStatus[] : statusFilters;
    setStaffIds(nextStaffIds);
    setProgramIds(nextPrograms);
    setCategories(nextCategories);
    setStatusFilters(nextStatuses);
    persist({
      staffIds: nextStaffIds,
      programIds: nextPrograms,
      categories: nextCategories,
      statuses: nextStatuses,
    });
  }, [categories, persist, programIds, staffIds, statusFilters]);

  const clearFilters = useCallback(() => {
    setStaffIds([]);
    setProgramIds([]);
    setCategories([]);
    setStatusFilters([]);
    persist({ staffIds: [], programIds: [], categories: [], statuses: [] });
  }, [persist]);

  const changeView = useCallback((nextView: TasksView) => {
    setView(nextView);
    void persist({ view: nextView });
  }, [persist]);

  const changeSorting = useCallback((next: ListSort<TaskSortKey>) => {
    setSorting(next);
    void persist({ sorting: next });
  }, [persist]);

  const changeColumnWidths = useCallback((next: Record<string, number>) => {
    setColumnWidths(next);
    persist({ columnWidths: next });
  }, [persist]);

  const changeHiddenColumns = useCallback((hiddenColumns: string[]) => {
    setHiddenColumns(hiddenColumns);
    void persist({ hiddenColumns });
  }, [persist]);

  return {
    view,
    search,
    setSearch,
    staffIds,
    programIds,
    categories,
    statusFilters,
    sorting,
    columnWidths,
    hiddenColumns,
    ready,
    error,
    filterCategories,
    applyFilter,
    clearFilters,
    changeView,
    changeSorting,
    changeColumnWidths,
    changeHiddenColumns,
  };
}
