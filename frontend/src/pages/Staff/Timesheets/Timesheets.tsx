import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../auth/authContext';
import { getUser } from '../../../auth/storage';
import Button from '../../../common/components/Button/Button';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import Table, { type TableColumn } from '../../../common/components/Table/Table';
import useTableSelection from '../../../common/components/Table/hooks/useTableSelection';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import Modal from '../../../common/components/Modal/Modal';
import { useConfirmModal, type ConfirmAction } from '../../../common/components/Modal/hooks/useConfirmModal';
import ResourceCalendar from '../../../common/components/ResourceCalendar/ResourceCalendar';
import PageBody from '../../../common/components/PageBody/PageBody';
import type { BuildItemContext, CalendarCellContext, ItemDropContext } from '../../../common/components/ResourceCalendar/types';
import type { PeriodRange } from '../../../common/components/ResourceCalendar/PeriodDataBuffer';
import TimeItem from './components/TimeItem/TimeItem';
import TimeEntryModal from '../../../common/features/timeEntries/components/TimeEntryModal/TimeEntryModal';
import { useTimesheetBuffer } from './hooks/useTimesheetBuffer';
import { useItemMutationQueue } from './hooks/useItemMutationQueue';
import { useFilteredTimesheetData } from './hooks/useFilteredTimesheetData';
import type { StaffResource, TimeEntryProgram, TimesheetItem } from '../../../common/features/timeEntries/types';
import {
  createTimeEntry,
  deleteTimeEntry,
  getTimeEntries,
  updateTimeEntry,
  updateTimeEntryPlacement,
  type SetTimeEntryInput,
} from '../../../common/features/timeEntries/api/timeEntries.api';
import { TIME_ENTRY_CATEGORY_OPTIONS } from '../../../common/features/timeEntries/timeEntryOptions';
import { formatShortDate } from '../../../common/utils/date';
import type { ListSort } from '../../../common/types/pagination';
import { formatCompactPersonName } from '../../../common/utils/name';
import { getErrorMessage } from '../../../http/clientErrors';
import TimesheetDashboard from './components/TimesheetDashboard/TimesheetDashboard';
import { useTimesheetOverview } from './hooks/useTimesheetOverview';
import { timesheetEntryType, useTimesheetListData, type TimesheetListRow, type TimesheetSortKey } from './hooks/useTimesheetListData';
import { useTimesheetControls } from './hooks/useTimesheetControls';
import './Timesheets.css';

const initialDate = new Date();
const TIMESHEET_CALENDAR_POSITION_KEY = 'resource-calendar:timesheets:position';
type EntryTarget = { resourceId: string; date: string; item: TimesheetItem };

const getStaffResourceId = (resource: StaffResource) => resource.id;
const getTimesheetItemId = (item: TimesheetItem) => item.id;
const canDropWithinStaff = ({ source, destination }: ItemDropContext<StaffResource, TimesheetItem>) => (
  source.resource.writable
  && destination.resource.writable
  && source.resource.id === destination.resource.id
);
const summarizeOverflow = ({ items, itemCount }: { items: readonly TimesheetItem[]; itemCount: number }) => (
  `${itemCount} ${itemCount === 1 ? 'Entry' : 'Entries'} - ${items.reduce((total, item) => total + item.hours, 0)} Hours`
);

export default function Timesheets() {
  const { permissions, role } = useAuth();
  const currentUserId = getUser()?.id;
  const canWriteTimesheets = permissions.includes('write:timesheets');
  const [resources, setResources] = useState<StaffResource[]>([]);
  const [programs, setPrograms] = useState<TimeEntryProgram[]>([]);
  const [listSearch, setListSearch] = useState('');
  const [selectedDashboardStaffId, setSelectedDashboardStaffId] = useState<string | null>(null);
  const [cycleData, setCycleData] = useState<Awaited<ReturnType<typeof getTimeEntries>>['data']>({});
  const [cycleLoading, setCycleLoading] = useState(true);
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<{ resourceId?: string; date?: string; source?: 'other' | 'task' | 'session' }>({});
  const [editTarget, setEditTarget] = useState<EntryTarget | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });
  const {
    staffFilters, categoryFilters, programFilters, typeFilters, view, ready: preferencesReady,
    columnWidths: listColumnWidths, sorting, cycles, cyclesError, selectedCycleId, preferenceError,
    filterCategories, applyFilter, clearFilters, setView, setColumnWidths, setSorting, selectCycle,
  } = useTimesheetControls({ role, resources, programs });
  const { enqueue, isLatest } = useItemMutationQueue();
  const confirmedMoveSourcesRef = useRef(new Map<string, EntryTarget>());
  const loadRange = useCallback(async ({ start, end }: PeriodRange) => {
    const response = await getTimeEntries({ start: start.key, end: end.key });
    setResources(current => {
      const unchanged = current.length === response.resources.length
        && current.every((resource, index) => resource.id === response.resources[index]?.id
          && resource.name === response.resources[index]?.name
          && resource.role === response.resources[index]?.role
          && resource.writable === response.resources[index]?.writable);
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
  const visibleResources = useMemo(() => staffFilters.length
    ? resources.filter(resource => staffFilters.includes(resource.id))
    : resources, [resources, staffFilters]);
  const writableResources = useMemo(() => resources.filter(resource => resource.writable), [resources]);
  const resourceById = useMemo(() => new Map(resources.map(resource => [resource.id, resource])), [resources]);
  const visibleData = useFilteredTimesheetData(data, categoryFilters, programFilters, typeFilters, selectedCycleId);
  const filteredCycleData = useFilteredTimesheetData(cycleData, categoryFilters, programFilters, typeFilters, selectedCycleId);
  const selectedCycle = cycles.find(cycle => cycle.id === selectedCycleId) ?? null;


  const cycleRequestRevisionRef = useRef(0);
  const refreshCycleData = useCallback(async (signal?: AbortSignal) => {
    const revision = ++cycleRequestRevisionRef.current;
    setCycleLoading(true);
    try {
      const response = await getTimeEntries({}, { signal });
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
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refreshCycleData(controller.signal);
    return () => controller.abort();
  }, [refreshCycleData]);

  const visibleListRows = useTimesheetListData(filteredCycleData, resources, staffFilters, listSearch, sorting);
  const {
    selectedKey: selectedListRowId,
    selectItem: selectListRow,
  } = useTableSelection(visibleListRows);
  const selectListRowWithContext = useCallback((row: TimesheetListRow) => {
    selectListRow(row);
    setSelectedDashboardStaffId(row.resourceId);
    if (row.item.cycleId === selectedCycleId) return;
    selectCycle(row.item.cycleId);
  }, [selectCycle, selectListRow, selectedCycleId]);

  const currentUserResource = resources.find(resource => resource.id === currentUserId) ?? null;
  const dashboardStaff = resources.find(resource => resource.id === selectedDashboardStaffId)
    ?? currentUserResource;
  const overviewCycle = selectedCycle
    ?? cycles.find(cycle => cycle.state === 'active')
    ?? cycles[0]
    ?? null;
  const dashboardStaffId = dashboardStaff?.id ?? null;
  const overviewCycleId = overviewCycle?.id ?? null;
  const dashboardOverview = useTimesheetOverview(dashboardStaffId, overviewCycleId, cycleData);

  const addTimeEntry = async (input: SetTimeEntryInput) => {
    const created = editTarget
      ? await updateTimeEntry(editTarget.item.id, input)
      : await createTimeEntry(input);
    const categoryLabel = TIME_ENTRY_CATEGORY_OPTIONS.find(option => option.value === created.category)?.label ?? created.category;
    upsertItem(created.staffId, created.workDate, { ...created, categoryLabel });
    await refreshCycleData();
  };

  const requestDelete = useCallback((target: EntryTarget) => {
    setConfirmAction({
      title: 'Delete time entry',
      message: `Delete this ${target.item.categoryLabel.toLowerCase()} entry?`,
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
    { key: 'firstName', sortKey: 'firstName', header: 'First Name', render: row => row.staffFirstName },
    { key: 'lastName', sortKey: 'lastName', header: 'Last Name', render: row => row.staffLastName },
    { key: 'date', sortKey: 'date', header: 'Date', width: 140, render: row => formatShortDate(row.date) },
    { key: 'cycle', sortKey: 'cycle', header: 'Cycle', render: row => row.item.cycleName ?? '—' },
    { key: 'program', sortKey: 'program', header: 'Program', render: row => row.item.programName ?? '—' },
    { key: 'category', sortKey: 'category', header: 'Category', render: row => row.item.categoryLabel },
    { key: 'session', sortKey: 'session', header: 'Session', render: row => row.item.sessionLabel ?? '—' },
    { key: 'hours', sortKey: 'hours', header: 'Hours', width: 100, render: row => row.item.hours },
    { key: 'note', sortKey: 'note', header: 'Note', render: row => row.item.note },
    { key: 'type', sortKey: 'type', header: 'Type', width: 110, render: row => {
      const type = timesheetEntryType(row.item);
      return <span className={`time-item__type time-item__type--${type.toLowerCase()}`}>{type}</span>;
    } },
    ...(canWriteTimesheets ? [{
      key: 'actions', header: '', width: 40, resizable: false, className: 'col-actions',
      render: (row: TimesheetListRow) => resourceById.get(row.resourceId)?.writable ? (
        <ActionsMenu
          ariaLabel={`Actions for ${row.item.taskTitle ?? row.item.categoryLabel} on ${row.date}`}
          items={[
            { id: 'edit', label: 'Edit', onClick: () => {
              setEditTarget(row);
              setAddTarget({ resourceId: row.resourceId, date: row.date });
              setAddOpen(true);
            } },
            { id: 'delete', label: 'Delete', variant: 'danger' as const, onClick: () => requestDelete(row) },
          ]}
        />
      ) : null,
    }] : []),
  ], [canWriteTimesheets, requestDelete, resourceById]);

  const moveTimeEntry = async ({ item, source, destination }: ItemDropContext<StaffResource, TimesheetItem>) => {
    setMoveError(null);
    const sourceResourceId = source.resource.id;
    const destinationResourceId = destination.resource.id;
    upsertItem(destinationResourceId, destination.period.key, item);
    const queuedMutation = enqueue(item.id, () => updateTimeEntryPlacement(item.id, {
      workDate: destination.period.key,
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
      const categoryLabel = TIME_ENTRY_CATEGORY_OPTIONS.find(option => option.value === updated.category)?.label ?? updated.category;
      confirmedMoveSourcesRef.current.set(item.id, {
        resourceId: destinationResourceId,
        date: destination.period.key,
        item: { ...updated, categoryLabel },
      });
      if (!isLatest(item.id, queuedMutation.revision)) return;
      upsertItem(destinationResourceId, destination.period.key, { ...updated, categoryLabel });
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
      onEdit={canWriteTimesheets && resource.writable ? () => {
        closeOverflow?.();
        setEditTarget({ resourceId: resource.id, date, item });
        setAddTarget({ resourceId: resource.id, date });
        setAddOpen(true);
      } : undefined}
      onDelete={canWriteTimesheets && resource.writable ? () => {
        closeOverflow?.();
        requestDelete({ resourceId: resource.id, date, item });
      } : undefined}
    />
  ), [canWriteTimesheets, requestDelete]);
  const renderCalendarResource = useCallback(({ resource }: { resource: StaffResource }) => (
    <div className="timesheets-resource">
      <span aria-label={resource.name}>{formatCompactPersonName(resource.firstName, resource.lastName)}</span>
    </div>
  ), []);
  const buildCalendarItem = useCallback(({ resource, period, data: item }: BuildItemContext<StaffResource, TimesheetItem>) => (
    renderTimeItem(resource, period.key, item)
  ), [renderTimeItem]);
  const buildOverflowItem = useCallback((
    { resource, period, data: item }: BuildItemContext<StaffResource, TimesheetItem>,
    { close }: { close: () => void },
  ) => renderTimeItem(resource, period.key, item, close), [renderTimeItem]);
  const openCellEntry = useCallback(({ resource, period }: CalendarCellContext<StaffResource, TimesheetItem>, source: 'other' | 'task' | 'session') => {
    setAddTarget({ resourceId: resource.id, date: period.key, source });
    setEditTarget(null);
    setAddOpen(true);
  }, []);

  return (
    <>
      <main className="page-container page-container--data timesheets-page">
        <PageHeader
          title="Timesheets"
          actions={canWriteTimesheets && writableResources.length ? (
            <ActionsMenu
              triggerLabel="+ Add"
              ariaLabel="Add time entry"
              items={[
                { id: 'session', label: 'Session Time', onClick: () => {
                  setEditTarget(null);
                  setAddTarget({ source: 'session' });
                  setAddOpen(true);
                } },
                { id: 'task', label: 'Task Time', onClick: () => {
                  setEditTarget(null);
                  setAddTarget({ source: 'task' });
                  setAddOpen(true);
                } },
                { id: 'other', label: 'Other Time', onClick: () => {
                  setEditTarget(null);
                  setAddTarget({ source: 'other' });
                  setAddOpen(true);
                } },
              ]}
            />
          ) : undefined}
          filters={(
            <FilterCard
              categories={filterCategories}
              values={{ staff: staffFilters, entryType: categoryFilters, program: programFilters, type: typeFilters, cycle: selectedCycleId ? [selectedCycleId] : [] }}
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
        {(error || moveError || cycleError || cyclesError || preferenceError) && (
          <div className="timesheets-page__error" role="alert">
            <span>{moveError ?? error ?? cycleError ?? cyclesError ?? preferenceError}</span>
            {error && <Button size="sm" variant="secondary" onClick={retry}>Retry</Button>}
          </div>
        )}
        {!preferencesReady ? <p role="status">Loading saved filters…</p> : <PageBody
          ariaLabel="Timesheet overview and entries"
          dashboard={<TimesheetDashboard staff={dashboardStaff} cycle={overviewCycle} overview={dashboardOverview} />}
          {...(view === 'calendar' ? { calendar: <ResourceCalendar
            resources={visibleResources}
            data={visibleData}
            initialDate={initialDate}
            positionStorageKey={TIMESHEET_CALENDAR_POSITION_KEY}
            ariaLabel="Staff timesheet calendar"
            resourceHeader="Name"
            onPeriodsBuilt={onPeriodsBuilt}
            onInitialPeriods={initialize}
            onPeriodsReset={reset}
            onItemDrop={canWriteTimesheets ? moveTimeEntry : undefined}
            canDropItem={canDropWithinStaff}
            getItemCapabilities={({ resource, data: item }) => ({
              draggable: canWriteTimesheets && resource.writable && !item.sessionId,
            })}
            maxVisibleItemsPerCell={3}
            rowHeight={112}
            renderOverflowSummary={summarizeOverflow}
            getCellActions={canWriteTimesheets ? context => context.resource.writable ? [
              { id: 'session', label: 'Session Time', onSelect: () => openCellEntry(context, 'session') },
              { id: 'task', label: 'Task Time', onSelect: () => openCellEntry(context, 'task') },
              { id: 'other', label: 'Other Time', onSelect: () => openCellEntry(context, 'other') },
            ] : [] : undefined}
            getResourceId={getStaffResourceId}
            getItemId={getTimesheetItemId}
            renderResource={renderCalendarResource}
            selectedResourceId={dashboardStaff?.id}
            onResourceSelect={resource => setSelectedDashboardStaffId(resource.id)}
            buildItem={buildCalendarItem}
            buildOverflowItem={buildOverflowItem}
          /> } : { table: <Table
            ariaLabel="Timesheet entries"
            columns={listColumns}
            data={visibleListRows}
            loading={cycleLoading}
            error={cycleError ?? undefined}
            keyExtractor={row => row.id}
            selectedKey={selectedListRowId}
            onRowSelect={selectListRowWithContext}
            sorting={sorting}
            onSortingChange={next => setSorting(next as ListSort<TimesheetSortKey>)}
            columnWidths={listColumnWidths}
            onColumnWidthsChange={setColumnWidths}
            emptyMessage={listSearch.trim()
              ? 'No time entries match your search'
              : selectedCycle ? 'No time entries for this cycle' : 'No time entries found'}
          /> })}
        />}
      </main>
      <TimeEntryModal
        isOpen={addOpen}
        resources={writableResources}
        programs={programs}
        cycles={cycles}
        onClose={() => setAddOpen(false)}
        onAdd={addTimeEntry}
        initialResourceId={addTarget.resourceId}
        initialDate={addTarget.date}
        initialSource={addTarget.source}
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
