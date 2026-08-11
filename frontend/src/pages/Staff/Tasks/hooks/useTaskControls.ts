import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import {
  TASK_CATEGORY_OPTIONS,
  type TaskCategory,
  type TaskOptions,
  type TaskStatus,
} from '../../../../common/features/tasks/types';

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
  const [cycleIds, setCycleIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [statusFilters, setStatusFilters] = useState<TaskStatus[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const { preference, loading, error, save } = useUserPreference('task-filters');

  useEffect(() => {
    if (ready || loading || optionsLoading) return;
    setProgramIds(preference?.programIds ?? []);
    setView(preference?.view ?? 'calendar');
    setCycleIds(preference?.cycleIds ?? []);
    setCategories(preference?.categories ?? []);
    setStatusFilters(preference?.statuses ?? []);
    setColumnWidths(preference?.columnWidths ?? {});
    setReady(true);
  }, [loading, optionsLoading, preference, ready]);

  const persist = useCallback((
    nextPrograms: string[],
    nextCycles: string[],
    nextCategories: TaskCategory[],
    nextStatuses: TaskStatus[],
    widths = columnWidths,
  ) => {
    void save({
      view,
      programIds: nextPrograms,
      cycleIds: nextCycles,
      categories: nextCategories,
      statuses: nextStatuses,
      columnWidths: widths,
    });
  }, [columnWidths, save, view]);

  const availableCycles = useMemo(() => (options?.cycles ?? []).filter(
    cycle => !programIds.length || programIds.includes(cycle.programId),
  ), [options?.cycles, programIds]);

  useEffect(() => {
    if (!ready) return;
    const availableIds = new Set(availableCycles.map(cycle => cycle.id));
    const nextCycles = cycleIds.filter(id => availableIds.has(id));
    if (nextCycles.length === cycleIds.length) return;
    setCycleIds(nextCycles);
    persist(programIds, nextCycles, categories, statusFilters);
  }, [availableCycles, categories, cycleIds, persist, programIds, ready, statusFilters]);

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    { id: 'program', label: 'Program', options: (options?.programs ?? []).map(item => ({ value: item.id, label: item.name })) },
    { id: 'cycle', label: 'Cycle', options: availableCycles.map(item => ({ value: item.id, label: item.name })) },
    { id: 'category', label: 'Category', options: TASK_CATEGORY_OPTIONS },
    { id: 'status', label: 'Status', options: STATUS_OPTIONS },
  ], [availableCycles, options?.programs]);

  const applyFilter = useCallback((id: string, selected: string[]) => {
    const nextPrograms = id === 'program' ? selected : programIds;
    const nextCycles = id === 'cycle' ? selected : cycleIds;
    const nextCategories = id === 'category' ? selected as TaskCategory[] : categories;
    const nextStatuses = id === 'status' ? selected as TaskStatus[] : statusFilters;
    setProgramIds(nextPrograms);
    setCycleIds(nextCycles);
    setCategories(nextCategories);
    setStatusFilters(nextStatuses);
    persist(nextPrograms, nextCycles, nextCategories, nextStatuses);
  }, [categories, cycleIds, persist, programIds, statusFilters]);

  const clearFilters = useCallback(() => {
    setProgramIds([]);
    setCycleIds([]);
    setCategories([]);
    setStatusFilters([]);
    persist([], [], [], []);
  }, [persist]);

  const changeView = useCallback((nextView: TasksView) => {
    setView(nextView);
    void save({
      view: nextView,
      programIds,
      cycleIds,
      categories,
      statuses: statusFilters,
      columnWidths,
    });
  }, [categories, columnWidths, cycleIds, programIds, save, statusFilters]);

  const changeColumnWidths = useCallback((next: Record<string, number>) => {
    setColumnWidths(next);
    persist(programIds, cycleIds, categories, statusFilters, next);
  }, [categories, cycleIds, persist, programIds, statusFilters]);

  return {
    view,
    search,
    setSearch,
    programIds,
    cycleIds,
    categories,
    statusFilters,
    columnWidths,
    ready,
    error,
    filterCategories,
    applyFilter,
    clearFilters,
    changeView,
    changeColumnWidths,
  };
}
