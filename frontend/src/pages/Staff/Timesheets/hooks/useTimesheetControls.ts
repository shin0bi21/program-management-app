import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FilterCardCategory } from '../../../../common/components/FilterCard/FilterCard';
import { getProgramCycles } from '../../../../common/features/programming/api/programming.api';
import type { TimeEntryCategory, TimeEntryProgram, StaffResource } from '../../../../common/features/timeEntries/types';
import { TIME_ENTRY_CATEGORY_OPTIONS } from '../../../../common/features/timeEntries/timeEntryOptions';
import useUserPreference from '../../../../common/features/preferences/hooks/useUserPreference';
import type { ProgramCycle } from '../../../../common/types/cohort';
import { getErrorMessage } from '../../../../http/clientErrors';

export type TimesheetView = 'calendar' | 'list';

interface UseTimesheetControlsOptions {
  role: string | null;
  resources: readonly StaffResource[];
  programs: readonly TimeEntryProgram[];
}

export function useTimesheetControls({ role, resources, programs }: UseTimesheetControlsOptions) {
  const [staffFilters, setStaffFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<TimeEntryCategory[]>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [view, setViewState] = useState<TimesheetView>('calendar');
  const [ready, setReady] = useState(false);
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const [cycles, setCycles] = useState<ProgramCycle[]>([]);
  const [cyclesReady, setCyclesReady] = useState(false);
  const [cyclesError, setCyclesError] = useState<string | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const { preference, loading, error: preferenceError, save } = useUserPreference('timesheet-filters');

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
    if (ready || loading || !cyclesReady) return;
    setViewState(preference?.view ?? 'calendar');
    setStaffFilters(role === 'admin' ? preference?.staffIds ?? [] : []);
    setCategoryFilters(preference?.categories ?? []);
    setProgramFilters(preference?.programIds ?? []);
    setColumnWidthsState(preference?.columnWidths ?? {});
    const savedCycleId = preference?.cycleId ?? '';
    setSelectedCycleId(preference
      ? cycles.some(cycle => cycle.id === savedCycleId) ? savedCycleId : ''
      : cycles.find(cycle => cycle.state === 'active')?.id ?? cycles[0]?.id ?? '');
    setReady(true);
  }, [cycles, cyclesReady, loading, preference, ready, role]);

  const persist = useCallback((next: {
    view?: TimesheetView;
    staffIds?: string[];
    programIds?: string[];
    categories?: TimeEntryCategory[];
    cycleId?: string;
    columnWidths?: Record<string, number>;
  }) => save({
    view: next.view ?? view,
    staffIds: role === 'admin' ? next.staffIds ?? staffFilters : [],
    programIds: next.programIds ?? programFilters,
    categories: next.categories ?? categoryFilters,
    cycleId: (next.cycleId ?? selectedCycleId) || null,
    columnWidths: next.columnWidths ?? columnWidths,
  }), [categoryFilters, columnWidths, programFilters, role, save, selectedCycleId, staffFilters, view]);

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    ...(role === 'admin' ? [{
      id: 'staff', label: 'Staff', options: resources.map(resource => ({ value: resource.id, label: resource.name })),
    }] : []),
    { id: 'program', label: 'Program', options: [{ value: 'general', label: 'General' }, ...programs.map(program => ({ value: program.id, label: program.name }))] },
    { id: 'entryType', label: 'Category', options: TIME_ENTRY_CATEGORY_OPTIONS },
    { id: 'cycle', label: 'Cycle', selectionMode: 'single', options: cycles.map(cycle => ({ value: cycle.id, label: cycle.name })) },
  ], [cycles, programs, resources, role]);

  const applyFilter = useCallback((categoryId: string, values: string[]) => {
    const nextStaffIds = categoryId === 'staff' ? values : staffFilters;
    const nextCategories = categoryId === 'entryType' ? values as TimeEntryCategory[] : categoryFilters;
    const nextProgramIds = categoryId === 'program' ? values : programFilters;
    const nextCycleId = categoryId === 'cycle' ? values[0] ?? '' : selectedCycleId;
    setStaffFilters(nextStaffIds);
    setCategoryFilters(nextCategories);
    setProgramFilters(nextProgramIds);
    setSelectedCycleId(nextCycleId);
    persist({ staffIds: nextStaffIds, categories: nextCategories, programIds: nextProgramIds, cycleId: nextCycleId });
  }, [categoryFilters, persist, programFilters, selectedCycleId, staffFilters]);

  const clearFilters = useCallback(() => {
    setStaffFilters([]);
    setCategoryFilters([]);
    setProgramFilters([]);
    setSelectedCycleId('');
    persist({ staffIds: [], categories: [], programIds: [], cycleId: '' });
  }, [persist]);

  const setView = useCallback((nextView: TimesheetView) => {
    setViewState(nextView);
    persist({ view: nextView });
  }, [persist]);

  const setColumnWidths = useCallback((next: Record<string, number>) => {
    setColumnWidthsState(next);
    persist({ columnWidths: next });
  }, [persist]);

  const selectCycle = useCallback((cycleId: string) => {
    setSelectedCycleId(cycleId);
    persist({ cycleId });
  }, [persist]);

  return {
    staffFilters, categoryFilters, programFilters, view, ready, columnWidths,
    cycles, cyclesError, selectedCycleId, preferenceError, filterCategories,
    applyFilter, clearFilters, setView, setColumnWidths, selectCycle,
  };
}
