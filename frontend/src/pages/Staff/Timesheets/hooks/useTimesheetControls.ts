import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import { getProgramCycles } from '../../../../common/features/programming/api/programming.api';
import type { TimeEntryCategory, TimeEntryProgram, StaffResource } from '../../../../common/features/timeEntries/types';
import { TIME_ENTRY_CATEGORY_OPTIONS } from '../../../../common/features/timeEntries/timeEntryOptions';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import type { ProgramCycle } from '../../../../common/types/cohort';
import type { ListSort } from '../../../../common/types/pagination';
import { getErrorMessage } from '../../../../http/clientErrors';
import type { TimesheetEntryType, TimesheetSortKey } from '../timesheetViewData';
import type { TimesheetPreference } from '../types';

export type TimesheetView = 'calendar' | 'list';

interface UseTimesheetControlsOptions {
  role: string | null;
  resources: readonly StaffResource[];
  programs: readonly TimeEntryProgram[];
  columnKeys: readonly string[];
}

export function useTimesheetControls({
  role,
  resources,
  programs,
  columnKeys,
}: UseTimesheetControlsOptions) {
  const [staffFilters, setStaffFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<TimeEntryCategory[]>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<TimesheetEntryType[]>([]);
  const [view, setViewState] = useState<TimesheetView>('calendar');
  const [ready, setReady] = useState(false);
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const [hiddenColumns, setHiddenColumnsState] = useState<string[]>([]);
  const [sorting, setSortingState] = useState<ListSort<TimesheetSortKey>>({ key: 'date', direction: 'desc' });
  const [cycles, setCycles] = useState<ProgramCycle[]>([]);
  const [cyclesReady, setCyclesReady] = useState(false);
  const [cyclesError, setCyclesError] = useState<string | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const {
    preference,
    loading,
    error: preferenceError,
    setBaseline,
    save,
  } = useUserPreference<TimesheetPreference>('timesheet-filters', columnKeys);

  useEffect(() => {
    const controller = new AbortController();
    void getProgramCycles({ signal: controller.signal }).then(loaded => {
      if (controller.signal.aborted) return;
      setCycles(loaded);
      setCyclesError(null);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setCyclesError(getErrorMessage(cause, 'Could not load cycles.'));
    }).finally(() => {
      if (!controller.signal.aborted) setCyclesReady(true);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (ready || loading || !cyclesReady || role === null) return;
    const savedCycleId = preference?.cycleId ?? '';
    const restoredCycleId = preference
      ? (cyclesError || cycles.some(cycle => cycle.id === savedCycleId) ? savedCycleId : '')
      : cycles.find(cycle => cycle.state === 'active')?.id ?? cycles[0]?.id ?? '';
    const restoredSorting = preference?.sorting ?? { key: 'date', direction: 'desc' };
    const restoredColumnWidths = preference?.columnWidths ?? {};
    const restoredHiddenColumns = preference?.hiddenColumns ?? [];
    const restored: TimesheetPreference = {
      view: preference?.view ?? 'calendar',
      staffIds: role === 'admin' ? preference?.staffIds ?? [] : [],
      categories: preference?.categories ?? [],
      programIds: preference?.programIds ?? [],
      types: preference?.types ?? [],
      cycleId: restoredCycleId || null,
      sorting: restoredSorting,
      columnWidths: restoredColumnWidths,
      hiddenColumns: restoredHiddenColumns,
    };
    setViewState(restored.view);
    setStaffFilters(restored.staffIds);
    setCategoryFilters(restored.categories);
    setProgramFilters(restored.programIds);
    setTypeFilters(restored.types ?? []);
    setSelectedCycleId(restoredCycleId);
    setColumnWidthsState(restoredColumnWidths);
    setHiddenColumnsState(restoredHiddenColumns);
    setSortingState(restoredSorting);
    setBaseline(restored);
    setReady(true);
  }, [cycles, cyclesError, cyclesReady, loading, preference, ready, role, setBaseline]);

  const persist = useCallback((next: {
    view?: TimesheetView;
    staffIds?: string[];
    programIds?: string[];
    categories?: TimeEntryCategory[];
    types?: TimesheetEntryType[];
    cycleId?: string;
    columnWidths?: Record<string, number>;
    sorting?: ListSort<TimesheetSortKey>;
    hiddenColumns?: string[];
  }) => save(current => ({
    view: next.view ?? current?.view ?? view,
    staffIds: role === 'admin' ? next.staffIds ?? current?.staffIds ?? staffFilters : [],
    programIds: next.programIds ?? current?.programIds ?? programFilters,
    categories: next.categories ?? current?.categories ?? categoryFilters,
    types: next.types ?? current?.types ?? typeFilters,
    cycleId: (next.cycleId !== undefined ? next.cycleId : current ? current.cycleId : selectedCycleId) || null,
    columnWidths: next.columnWidths ?? current?.columnWidths ?? columnWidths,
    sorting: next.sorting ?? current?.sorting ?? sorting,
    hiddenColumns: next.hiddenColumns ?? current?.hiddenColumns ?? hiddenColumns,
  })), [categoryFilters, columnWidths, hiddenColumns, programFilters, role, save, selectedCycleId, sorting, staffFilters, typeFilters, view]);

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    ...(role === 'admin' ? [{
      id: 'staff', label: 'Staff', options: resources.map(resource => ({ value: resource.id, label: resource.name })),
    }] : []),
    { id: 'program', label: 'Program', options: [{ value: 'general', label: 'General' }, ...programs.map(program => ({ value: program.id, label: program.name }))] },
    { id: 'entryType', label: 'Category', options: TIME_ENTRY_CATEGORY_OPTIONS },
    { id: 'type', label: 'Type', options: [
      { value: 'task', label: 'Task' },
      { value: 'session', label: 'Session' },
      { value: 'other', label: 'Regular' },
    ] },
    { id: 'cycle', label: 'Cycle', selectionMode: 'single', options: cycles.map(cycle => ({ value: cycle.id, label: cycle.name })) },
  ], [cycles, programs, resources, role]);

  const applyFilter = useCallback((categoryId: string, values: string[]) => {
    const nextStaffIds = categoryId === 'staff' ? values : staffFilters;
    const nextCategories = categoryId === 'entryType' ? values as TimeEntryCategory[] : categoryFilters;
    const nextProgramIds = categoryId === 'program' ? values : programFilters;
    const nextTypes = categoryId === 'type' ? values as TimesheetEntryType[] : typeFilters;
    const nextCycleId = categoryId === 'cycle' ? values[0] ?? '' : selectedCycleId;
    setStaffFilters(nextStaffIds);
    setCategoryFilters(nextCategories);
    setProgramFilters(nextProgramIds);
    setTypeFilters(nextTypes);
    setSelectedCycleId(nextCycleId);
    persist({ staffIds: nextStaffIds, categories: nextCategories, programIds: nextProgramIds, types: nextTypes, cycleId: nextCycleId });
  }, [categoryFilters, persist, programFilters, selectedCycleId, staffFilters, typeFilters]);

  const clearFilters = useCallback(() => {
    setStaffFilters([]);
    setCategoryFilters([]);
    setProgramFilters([]);
    setTypeFilters([]);
    setSelectedCycleId('');
    persist({ staffIds: [], categories: [], programIds: [], types: [], cycleId: '' });
  }, [persist]);

  const setView = useCallback((nextView: TimesheetView) => {
    setViewState(nextView);
    persist({ view: nextView });
  }, [persist]);

  const setColumnWidths = useCallback((next: Record<string, number>) => {
    setColumnWidthsState(next);
    persist({ columnWidths: next });
  }, [persist]);

  const setHiddenColumns = useCallback((hiddenColumns: string[]) => {
    setHiddenColumnsState(hiddenColumns);
    persist({ hiddenColumns });
  }, [persist]);

  const setSorting = useCallback((next: ListSort<TimesheetSortKey>) => {
    setSortingState(next);
    persist({ sorting: next });
  }, [persist]);

  const selectCycle = useCallback((cycleId: string) => {
    setSelectedCycleId(cycleId);
    persist({ cycleId });
  }, [persist]);

  return {
    staffFilters, categoryFilters, programFilters, typeFilters, view, ready, columnWidths, hiddenColumns, sorting,
    cycles, cyclesError, selectedCycleId, preferenceError, filterCategories,
    applyFilter, clearFilters, setView, setColumnWidths, setHiddenColumns, setSorting, selectCycle,
  };
}
