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

export type TasksView = 'calendar' | 'list';

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function useTaskControls(options: TaskOptions | undefined, optionsLoading: boolean) {
  const [view, setView] = useState<TasksView>('calendar');
  const [search, setSearch] = useState('');
  const [programIds, setProgramIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [statusFilters, setStatusFilters] = useState<TaskStatus[]>([]);
  const [sorting, setSorting] = useState<ListSort<TaskSortKey>>({ key: 'startDate', direction: 'asc' });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const { preference, loading, error, save } = useUserPreference('task-filters');

  useEffect(() => {
    if (ready || loading || optionsLoading) return;
    setProgramIds(preference?.programIds ?? []);
    setView(preference?.view ?? 'calendar');
    setCategories(preference?.categories ?? []);
    setStatusFilters(preference?.statuses ?? []);
    setSorting(preference?.sorting ?? { key: 'startDate', direction: 'asc' });
    setColumnWidths(preference?.columnWidths ?? {});
    setReady(true);
  }, [loading, optionsLoading, preference, ready]);

  const persist = useCallback((
    nextPrograms: string[],
    nextCategories: TaskCategory[],
    nextStatuses: TaskStatus[],
    widths = columnWidths,
  ) => {
    void save({
      view,
      programIds: nextPrograms,
      categories: nextCategories,
      statuses: nextStatuses,
      sorting,
      columnWidths: widths,
    });
  }, [columnWidths, save, sorting, view]);

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    { id: 'program', label: 'Program', options: (options?.programs ?? []).map(item => ({ value: item.id, label: item.name })) },
    { id: 'category', label: 'Category', options: TASK_CATEGORY_OPTIONS },
    { id: 'status', label: 'Status', options: STATUS_OPTIONS },
  ], [options?.programs]);

  const applyFilter = useCallback((id: string, selected: string[]) => {
    const nextPrograms = id === 'program' ? selected : programIds;
    const nextCategories = id === 'category' ? selected as TaskCategory[] : categories;
    const nextStatuses = id === 'status' ? selected as TaskStatus[] : statusFilters;
    setProgramIds(nextPrograms);
    setCategories(nextCategories);
    setStatusFilters(nextStatuses);
    persist(nextPrograms, nextCategories, nextStatuses);
  }, [categories, persist, programIds, statusFilters]);

  const clearFilters = useCallback(() => {
    setProgramIds([]);
    setCategories([]);
    setStatusFilters([]);
    persist([], [], []);
  }, [persist]);

  const changeView = useCallback((nextView: TasksView) => {
    setView(nextView);
    void save({
      view: nextView,
      programIds,
      categories,
      statuses: statusFilters,
      sorting,
      columnWidths,
    });
  }, [categories, columnWidths, programIds, save, sorting, statusFilters]);

  const changeSorting = useCallback((next: ListSort<TaskSortKey>) => {
    setSorting(next);
    void save({ view, programIds, categories, statuses: statusFilters, sorting: next, columnWidths });
  }, [categories, columnWidths, programIds, save, statusFilters, view]);

  const changeColumnWidths = useCallback((next: Record<string, number>) => {
    setColumnWidths(next);
    persist(programIds, categories, statusFilters, next);
  }, [categories, persist, programIds, statusFilters]);

  const changeHiddenColumns = useCallback((hiddenColumns: string[]) => {
    void save({ hiddenColumns });
  }, [save]);

  return {
    view,
    search,
    setSearch,
    programIds,
    categories,
    statusFilters,
    sorting,
    columnWidths,
    hiddenColumns: preference?.hiddenColumns ?? [],
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
