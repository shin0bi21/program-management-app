import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../auth/authContext';
import Button from '../../../common/components/Button/Button';
import FilterCard, { type FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import Table, { type TableColumn } from '../../../common/components/Table/Table';
import useTableSelection from '../../../common/components/Table/hooks/useTableSelection';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import Modal from '../../../common/components/Modal/Modal';
import { useConfirmModal, type ConfirmAction } from '../../../common/components/Modal/hooks/useConfirmModal';
import ResourceCalendar from '../../../common/components/ResourceCalendar/ResourceCalendar';
import type { BuildItemContext, CalendarCellContext, ItemDropContext } from '../../../common/components/ResourceCalendar/types';
import type { PeriodRange } from '../../../common/components/ResourceCalendar/PeriodDataBuffer';
import TimeItem from './components/TimeItem/TimeItem';
import TimeEntryModal from './components/TimeEntryModal/TimeEntryModal';
import { useTimesheetBuffer } from './hooks/useTimesheetBuffer';
import { useItemMutationQueue } from './hooks/useItemMutationQueue';
import { useFilteredTimesheetData } from './hooks/useFilteredTimesheetData';
import type { StaffResource, TimeEntryProgram, TimesheetItem, TimeEntryTask } from './types';
import { createTimeEntry, deleteTimeEntry, getTimeEntries, updateTimeEntry, type SetTimeEntryInput } from './api/timeEntries.api';
import { TIME_ENTRY_TASK_OPTIONS } from './timeEntryOptions';
import { getProgramCycles } from '../../../common/features/programming/api/programming.api';
import type { ProgramCycle } from '../../../common/types/cohort';
import { formatShortDate } from '../../../common/utils/date';
import { getErrorMessage } from '../../../http/clientErrors';
import { summarizeCycleHours } from './timesheetSummary';
import useUserPreference from '../../../common/features/preferences/hooks/useUserPreference';
import TimesheetOverviewCard from './components/TimesheetOverviewCard/TimesheetOverviewCard';
import './Timesheets.css';

const initialDate = new Date();
type EntryTarget = { resourceId: string; date: string; item: TimesheetItem };
type TimesheetView = 'calendar' | 'list';
type TimesheetListRow = EntryTarget & { id: string; staffName: string };

const getStaffResourceId = (resource: StaffResource) => resource.id;
const getTimesheetItemId = (item: TimesheetItem) => item.id;
const canDropWithinStaff = ({ source, destination }: ItemDropContext<StaffResource, TimesheetItem>) => (
  source.resource.id === destination.resource.id
);
const summarizeOverflow = ({ items, itemCount }: { items: readonly TimesheetItem[]; itemCount: number }) => (
  `${itemCount} ${itemCount === 1 ? 'Entry' : 'Entries'} - ${items.reduce((total, item) => total + item.hours, 0)} Hours`
);

export default function Timesheets() {
  const { permissions, role } = useAuth();
  const canWriteTimesheets = permissions.includes('write:timesheets');
  const [resources, setResources] = useState<StaffResource[]>([]);
  const [programs, setPrograms] = useState<TimeEntryProgram[]>([]);
  const [staffFilters, setStaffFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<TimeEntryTask[]>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [view, setViewState] = useState<TimesheetView>('calendar');
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [cycles, setCycles] = useState<ProgramCycle[]>([]);
  const [cyclesReady, setCyclesReady] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [cycleData, setCycleData] = useState<Awaited<ReturnType<typeof getTimeEntries>>['data']>({});
  const [cycleLoading, setCycleLoading] = useState(true);
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<{ resourceId?: string; date?: string }>({});
  const [editTarget, setEditTarget] = useState<EntryTarget | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });
  const { preference, loading: preferenceLoading, error: preferenceError, save } = useUserPreference('timesheet-filters');
  const { enqueue, isLatest } = useItemMutationQueue();
  const confirmedMoveSourcesRef = useRef(new Map<string, EntryTarget>());
  const loadRange = useCallback(async ({ start, end }: PeriodRange) => {
    const response = await getTimeEntries({ start: start.key, end: end.key });
    setResources(current => {
      const unchanged = current.length === response.resources.length
        && current.every((resource, index) => resource.id === response.resources[index]?.id
          && resource.name === response.resources[index]?.name
          && resource.role === response.resources[index]?.role);
      return unchanged ? current : response.resources;
    });
    setPrograms(current => {
      const unchanged = current.length === response.programs.length
        && current.every((program, index) => program.id === response.programs[index]?.id
          && program.name === response.programs[index]?.name);
      return unchanged ? current : response.programs;
    });
    return response.data;
  }, []);
  const { data, error, upsertItem, removeItem, initialize, reset, onPeriodsBuilt, retry } = useTimesheetBuffer({
    load: loadRange,
  });
  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    ...(role === 'admin' ? [{
      id: 'staff',
      label: 'Staff',
      options: resources.map(resource => ({ value: resource.id, label: resource.name })),
    }] : []),
    {
      id: 'program',
      label: 'Program',
      options: [{ value: 'general', label: 'General' }, ...programs.map(program => ({ value: program.id, label: program.name }))],
    },
    {
      id: 'entryType',
      label: 'Task',
      options: TIME_ENTRY_TASK_OPTIONS,
    },
    {
      id: 'cycle',
      label: 'Cycle',
      selectionMode: 'single',
      options: cycles.map(cycle => ({ value: cycle.id, label: cycle.name })),
    },
  ], [cycles, programs, resources, role]);
  const visibleResources = useMemo(() => staffFilters.length
    ? resources.filter(resource => staffFilters.includes(resource.id))
    : resources, [resources, staffFilters]);
  const visibleData = useFilteredTimesheetData(data, typeFilters, programFilters, selectedCycleId);
  const filteredCycleData = useFilteredTimesheetData(cycleData, typeFilters, programFilters, selectedCycleId);
  const selectedCycle = cycles.find(cycle => cycle.id === selectedCycleId) ?? null;

  useEffect(() => {
    const controller = new AbortController();
    void getProgramCycles({ signal: controller.signal }).then(loaded => {
      setCycles(loaded);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setCycleError(getErrorMessage(cause, 'Could not load cycles.'));
    }).finally(() => {
      if (!controller.signal.aborted) setCyclesReady(true);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (preferencesReady || preferenceLoading || !cyclesReady) return;
    setViewState(preference?.view ?? 'calendar');
    setStaffFilters(role === 'admin' ? preference?.staffIds ?? [] : []);
    setTypeFilters(preference?.tasks ?? []);
    setProgramFilters(preference?.programIds ?? []);
    const savedCycleId = preference?.cycleId ?? '';
    setSelectedCycleId(
      preference
        ? cycles.some(cycle => cycle.id === savedCycleId) ? savedCycleId : ''
        : cycles.find(cycle => cycle.state === 'active')?.id ?? cycles[0]?.id ?? '',
    );
    setPreferencesReady(true);
  }, [cycles, cyclesReady, preference, preferenceLoading, preferencesReady, role]);

  const setView = (nextView: TimesheetView) => {
    setViewState(nextView);
    save({
      view: nextView,
      staffIds: role === 'admin' ? staffFilters : [],
      programIds: programFilters,
      tasks: typeFilters,
      cycleId: selectedCycleId || null,
    });
  };

  const cycleRequestRevisionRef = useRef(0);
  const refreshCycleData = useCallback(async (signal?: AbortSignal) => {
    const revision = ++cycleRequestRevisionRef.current;
    if (view !== 'list') {
      setCycleLoading(false);
      return;
    }
    setCycleLoading(true);
    try {
      const response = await getTimeEntries(
        selectedCycle ? { cycleId: selectedCycle.id } : {},
        { signal },
      );
      if (signal?.aborted || revision !== cycleRequestRevisionRef.current) return;
      setCycleData(response.data);
      setResources(response.resources);
      setPrograms(response.programs);
      setCycleError(null);
    } catch (cause) {
      if (signal?.aborted || revision !== cycleRequestRevisionRef.current) return;
      setCycleError(getErrorMessage(cause, 'Could not load timesheets for this cycle.'));
    } finally {
      if (!signal?.aborted && revision === cycleRequestRevisionRef.current) setCycleLoading(false);
    }
  }, [selectedCycle, view]);

  useEffect(() => {
    const controller = new AbortController();
    void refreshCycleData(controller.signal);
    return () => controller.abort();
  }, [refreshCycleData]);

  const listRows = useMemo<TimesheetListRow[]>(() => {
    const resourceNames = new Map(resources.map(resource => [resource.id, resource.name]));
    return Object.entries(filteredCycleData).flatMap(([resourceId, periods]) => {
      if (staffFilters.length && !staffFilters.includes(resourceId)) return [];
      return Object.entries(periods).flatMap(([date, items]) => items.map(item => ({
        id: item.id,
        resourceId,
        date,
        item,
        staffName: resourceNames.get(resourceId) ?? 'Staff member',
      })));
    }).sort((left, right) => right.date.localeCompare(left.date) || left.staffName.localeCompare(right.staffName));
  }, [filteredCycleData, resources, staffFilters]);
  const visibleListRows = useMemo(() => {
    const query = listSearch.trim().toLocaleLowerCase();
    if (!query) return listRows;
    return listRows.filter(row => [
      row.date,
      row.staffName,
      row.item.programName ?? 'General',
      row.item.cycleName ?? '',
      row.item.label,
      row.item.note,
    ].some(value => value.toLocaleLowerCase().includes(query)));
  }, [listRows, listSearch]);
  const {
    selectedItem: selectedListRow,
    selectedKey: selectedListRowId,
    selectItem: selectListRow,
  } = useTableSelection(visibleListRows);
  const selectListRowWithContext = useCallback((row: TimesheetListRow) => {
    selectListRow(row);
    if (row.item.cycleId === selectedCycleId) return;
    setSelectedCycleId(row.item.cycleId);
    save({
      view,
      staffIds: role === 'admin' ? staffFilters : [],
      programIds: programFilters,
      tasks: typeFilters,
      cycleId: row.item.cycleId,
    });
  }, [programFilters, role, save, selectListRow, selectedCycleId, staffFilters, typeFilters, view]);

  const dashboardStaff = role === 'staff'
    ? resources[0] ?? null
    : selectedListRow
      ? resources.find(resource => resource.id === selectedListRow.resourceId) ?? null
      : null;
  const dashboardRows = useMemo(
    () => dashboardStaff ? listRows.filter(row => row.resourceId === dashboardStaff.id) : [],
    [dashboardStaff, listRows],
  );

  const summary = useMemo(() => {
    const result = summarizeCycleHours(
      dashboardRows.map(row => ({ date: row.date, label: row.item.label, hours: row.item.hours })),
      selectedCycle,
    );
    return { ...result, periodLabel: result.periodStart && result.periodEnd
      ? `${formatShortDate(result.periodStart)} – ${formatShortDate(result.periodEnd)}`
      : 'No cycle selected' };
  }, [dashboardRows, selectedCycle]);
  const hasOverviewContext = dashboardStaff !== null && selectedCycle !== null;
  const overviewEmptyMessage = dashboardStaff
    ? 'Select a cycle to view this staff member’s overview.'
    : 'Select a time entry to view this staff member’s overview.';

  const applyFilter = (categoryId: string, values: string[]) => {
    const nextStaffIds = categoryId === 'staff' ? values : staffFilters;
    const nextTasks = categoryId === 'entryType' ? values as TimeEntryTask[] : typeFilters;
    const nextProgramIds = categoryId === 'program' ? values : programFilters;
    const nextCycleId = categoryId === 'cycle' ? values[0] ?? '' : selectedCycleId;
    setStaffFilters(nextStaffIds);
    setTypeFilters(nextTasks);
    setProgramFilters(nextProgramIds);
    setSelectedCycleId(nextCycleId);
    save({
      view,
      staffIds: role === 'admin' ? nextStaffIds : [],
      programIds: nextProgramIds,
      tasks: nextTasks,
      cycleId: nextCycleId || null,
    });
  };

  const clearFilters = () => {
    setStaffFilters([]);
    setTypeFilters([]);
    setProgramFilters([]);
    setSelectedCycleId('');
    save({ view, staffIds: [], programIds: [], tasks: [], cycleId: null });
  };

  const addTimeEntry = async (input: SetTimeEntryInput) => {
    const created = editTarget
      ? await updateTimeEntry(editTarget.item.id, input)
      : await createTimeEntry(input);
    const label = TIME_ENTRY_TASK_OPTIONS.find(option => option.value === created.task)?.label ?? created.task;
    upsertItem(created.staffId, created.workDate, { ...created, label });
    await refreshCycleData();
  };

  const requestDelete = useCallback((target: EntryTarget) => {
    setConfirmAction({
      title: 'Delete time entry',
      message: `Delete this ${target.item.label.toLowerCase()} entry?`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        await deleteTimeEntry(target.item.id);
        removeItem(target.item.id);
        await refreshCycleData();
        setEditTarget(current => current?.item.id === target.item.id ? null : current);
      },
    });
  }, [refreshCycleData, removeItem]);

  const listColumns = useMemo<TableColumn<TimesheetListRow>[]>(() => [
    { key: 'date', header: 'Date', width: 140, render: row => formatShortDate(row.date) },
    { key: 'staff', header: 'Staff', render: row => row.staffName },
    { key: 'program', header: 'Program', render: row => row.item.programName ?? 'General' },
    { key: 'cycle', header: 'Cycle', render: row => row.item.cycleName ?? '—' },
    { key: 'task', header: 'Task', render: row => row.item.label },
    { key: 'hours', header: 'Hours', width: 100, render: row => row.item.hours },
    { key: 'note', header: 'Note', render: row => row.item.note },
    ...(canWriteTimesheets ? [{
      key: 'actions', header: '', width: 40, resizable: false, className: 'col-actions',
      render: (row: TimesheetListRow) => (
        <ActionsMenu
          ariaLabel={`Actions for ${row.item.label} on ${row.date}`}
          items={[
            { id: 'edit', label: 'Edit', onClick: () => {
              setEditTarget(row);
              setAddTarget({ resourceId: row.resourceId, date: row.date });
              setAddOpen(true);
            } },
            { id: 'delete', label: 'Delete', variant: 'danger' as const, onClick: () => requestDelete(row) },
          ]}
        />
      ),
    }] : []),
  ], [canWriteTimesheets, requestDelete]);

  const moveTimeEntry = async ({ item, source, destination }: ItemDropContext<StaffResource, TimesheetItem>) => {
    setMoveError(null);
    const sourceResourceId = source.resource.id;
    const destinationResourceId = destination.resource.id;
    upsertItem(destinationResourceId, destination.period.key, item);
    const queuedMutation = enqueue(item.id, () => updateTimeEntry(item.id, {
      staffId: destinationResourceId,
      programId: item.programId,
      cycleId: item.cycleId,
      task: item.task,
      workDate: destination.period.key,
      hours: item.hours,
      note: item.note,
    }));
    if (!queuedMutation.hadPending) {
      confirmedMoveSourcesRef.current.set(item.id, {
        resourceId: sourceResourceId,
        date: source.period.key,
        item,
      });
    }
    try {
      const updated = await queuedMutation.result;
      const label = TIME_ENTRY_TASK_OPTIONS.find(option => option.value === updated.task)?.label ?? updated.task;
      confirmedMoveSourcesRef.current.set(item.id, {
        resourceId: destinationResourceId,
        date: destination.period.key,
        item: { ...updated, label },
      });
      if (!isLatest(item.id, queuedMutation.revision)) return;
      upsertItem(destinationResourceId, destination.period.key, { ...updated, label });
      confirmedMoveSourcesRef.current.delete(item.id);
      await refreshCycleData();
    } catch {
      if (!isLatest(item.id, queuedMutation.revision)) return;
      const confirmed = confirmedMoveSourcesRef.current.get(item.id);
      if (confirmed) upsertItem(confirmed.resourceId, confirmed.date, confirmed.item);
      confirmedMoveSourcesRef.current.delete(item.id);
      setMoveError('Unable to move time entry. The entry was returned to its original day.');
    }
  };

  const renderTimeItem = useCallback((
    resource: StaffResource,
    date: string,
    item: TimesheetItem,
    closeOverflow?: () => void,
  ) => (
    <TimeItem
      item={item}
      onEdit={canWriteTimesheets ? () => {
        closeOverflow?.();
        setEditTarget({ resourceId: resource.id, date, item });
        setAddTarget({ resourceId: resource.id, date });
        setAddOpen(true);
      } : undefined}
      onDelete={canWriteTimesheets ? () => {
        closeOverflow?.();
        requestDelete({ resourceId: resource.id, date, item });
      } : undefined}
    />
  ), [canWriteTimesheets, requestDelete]);
  const renderCalendarResource = useCallback(({ resource }: { resource: StaffResource }) => (
    <div className="timesheets-resource">{resource.name}</div>
  ), []);
  const buildCalendarItem = useCallback(({ resource, period, data: item }: BuildItemContext<StaffResource, TimesheetItem>) => (
    renderTimeItem(resource, period.key, item)
  ), [renderTimeItem]);
  const buildOverflowItem = useCallback((
    { resource, period, data: item }: BuildItemContext<StaffResource, TimesheetItem>,
    { close }: { close: () => void },
  ) => renderTimeItem(resource, period.key, item, close), [renderTimeItem]);
  const openCellEntry = useCallback(({ resource, period }: CalendarCellContext<StaffResource, TimesheetItem>) => {
    setAddTarget({ resourceId: resource.id, date: period.key });
    setEditTarget(null);
    setAddOpen(true);
  }, []);

  return (
    <>
      <main className="page-container page-container--data timesheets-page">
        <PageHeader
          title="Timesheets"
          actions={canWriteTimesheets
            ? <Button onClick={() => { setEditTarget(null); setAddTarget({}); setAddOpen(true); }}>+ Add</Button>
            : undefined}
          filters={(
            <FilterCard
              categories={filterCategories}
              values={{ staff: staffFilters, entryType: typeFilters, program: programFilters, cycle: selectedCycleId ? [selectedCycleId] : [] }}
              onApply={applyFilter}
              onClearAll={clearFilters}
            />
          )}
          view={preferencesReady ? (
            <ViewMenu
              label="View"
              value={view}
              onChange={setView}
              options={[{ value: 'calendar', label: 'Calendar' }, { value: 'list', label: 'List' }]}
            />
          ) : undefined}
          search={view === 'list' ? (
            <SearchInput
              label="Search time entries"
              value={listSearch}
              onChange={event => setListSearch(event.target.value)}
              placeholder="Search time entries"
            />
          ) : undefined}
        />
        {(error || moveError || cycleError || preferenceError) && (
          <div className="timesheets-page__error" role="alert">
            <span>{moveError ?? error ?? cycleError ?? preferenceError}</span>
            {error && <Button size="sm" variant="secondary" onClick={retry}>Retry</Button>}
          </div>
        )}
        {!preferencesReady ? <p role="status">Loading saved filters…</p> : view === 'list' && <section className="timesheets-page__overview" aria-label="Timesheet overview">
          <TimesheetOverviewCard
            title="Hours This Pay Period"
            total={summary.periodTotal}
            context={`${dashboardStaff?.name ?? ''} · ${summary.periodLabel}`}
            breakdown={summary.periodTaskHours}
            emptyMessage={overviewEmptyMessage}
            hasStaff={hasOverviewContext}
          />
          <TimesheetOverviewCard
            title="Average Biweekly Hours This Cycle"
            total={summary.average}
            context={`${dashboardStaff?.name ?? ''} · ${selectedCycle?.name ?? 'No cycle selected'}`}
            breakdown={summary.taskHours.map(
              ([label, hours]): [string, number] => [label, hours / summary.periodCount],
            )}
            emptyMessage={overviewEmptyMessage}
            hasStaff={hasOverviewContext}
          />
        </section>}
        {preferencesReady && (view === 'calendar' ? <div className="timesheets-page__calendar">
          <ResourceCalendar
            resources={visibleResources}
            data={visibleData}
            initialDate={initialDate}
            ariaLabel="Staff timesheet calendar"
            resourceHeader="Staff member"
            onPeriodsBuilt={onPeriodsBuilt}
            onInitialPeriods={initialize}
            onPeriodsReset={reset}
            onItemDrop={canWriteTimesheets ? moveTimeEntry : undefined}
            canDropItem={canDropWithinStaff}
            maxVisibleItemsPerCell={2}
            renderOverflowSummary={summarizeOverflow}
            onCellClick={canWriteTimesheets ? openCellEntry : undefined}
            getResourceId={getStaffResourceId}
            getItemId={getTimesheetItemId}
            renderResource={renderCalendarResource}
            buildItem={buildCalendarItem}
            buildOverflowItem={buildOverflowItem}
          />
        </div> : (
          <Table
            ariaLabel="Timesheet entries"
            columns={listColumns}
            data={visibleListRows}
            loading={cycleLoading}
            error={cycleError ?? undefined}
            keyExtractor={row => row.id}
            selectedKey={selectedListRowId}
            onRowSelect={selectListRowWithContext}
            emptyMessage={listSearch.trim()
              ? 'No time entries match your search'
              : selectedCycle ? 'No time entries for this cycle' : 'No time entries found'}
          />
        ))}
      </main>
      <TimeEntryModal
        isOpen={addOpen}
        resources={resources}
        programs={programs}
        cycles={cycles}
        onClose={() => setAddOpen(false)}
        onAdd={addTimeEntry}
        initialResourceId={addTarget.resourceId}
        initialDate={addTarget.date}
        initialItem={editTarget?.item}
      />
      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.title ?? ''}
        status={confirmModal.status}
        statusMessage={confirmModal.statusMessage}
        footer={confirmModal.footer}
        successDelay={confirmModal.successDelay}
      >
        <p>{confirmAction?.message}</p>
      </Modal>
    </>
  );
}
