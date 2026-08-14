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
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [programIds, setProgramIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [statusFilters, setStatusFilters] = useState<TaskStatus[]>([]);
  const [sorting, setSorting] = useState<ListSort<TaskSortKey>>({ key: 'startDate', direction: 'asc' });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const { preference, loading, error, save } = useUserPreference('task-filters');

  useEffect(() => {
    if (ready || loading || optionsLoading) return;
    setStaffIds(preference?.staffIds ?? []);
    setProgramIds(preference?.programIds ?? []);
    setView(preference?.view ?? 'calendar');
    setCategories(preference?.categories ?? []);
    setStatusFilters(preference?.statuses ?? []);
    setSorting(preference?.sorting ?? { key: 'startDate', direction: 'asc' });
    setColumnWidths(preference?.columnWidths ?? {});
    setHiddenColumns(preference?.hiddenColumns ?? []);
    setReady(true);
  }, [loading, optionsLoading, preference, ready]);

  const persist = useCallback((
    nextStaffIds: string[],
    nextPrograms: string[],
    nextCategories: TaskCategory[],
    nextStatuses: TaskStatus[],
    widths = columnWidths,
    hidden = hiddenColumns,
  ) => {
    void save({
      view,
      staffIds: nextStaffIds,
      programIds: nextPrograms,
      categories: nextCategories,
      statuses: nextStatuses,
      sorting,
      columnWidths: widths,
      hiddenColumns: hidden,
    });
  }, [columnWidths, hiddenColumns, save, sorting, view]);

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
    persist(nextStaffIds, nextPrograms, nextCategories, nextStatuses);
  }, [categories, persist, programIds, staffIds, statusFilters]);

  const clearFilters = useCallback(() => {
    setStaffIds([]);
    setProgramIds([]);
    setCategories([]);
    setStatusFilters([]);
    persist([], [], [], []);
  }, [persist]);

  const changeView = useCallback((nextView: TasksView) => {
    setView(nextView);
    void save({
      view: nextView,
      staffIds,
      programIds,
      categories,
      statuses: statusFilters,
      sorting,
      columnWidths,
      hiddenColumns,
    });
  }, [categories, columnWidths, hiddenColumns, programIds, save, sorting, staffIds, statusFilters]);

  const changeSorting = useCallback((next: ListSort<TaskSortKey>) => {
    setSorting(next);
    void save({ view, staffIds, programIds, categories, statuses: statusFilters, sorting: next, columnWidths, hiddenColumns });
  }, [categories, columnWidths, hiddenColumns, programIds, save, staffIds, statusFilters, view]);

  const changeColumnWidths = useCallback((next: Record<string, number>) => {
    setColumnWidths(next);
    persist(staffIds, programIds, categories, statusFilters, next);
  }, [categories, persist, programIds, staffIds, statusFilters]);

  const changeHiddenColumns = useCallback((hiddenColumns: string[]) => {
    setHiddenColumns(hiddenColumns);
    void save({ view, staffIds, programIds, categories, statuses: statusFilters, sorting, columnWidths, hiddenColumns });
  }, [categories, columnWidths, programIds, save, sorting, staffIds, statusFilters, view]);

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
