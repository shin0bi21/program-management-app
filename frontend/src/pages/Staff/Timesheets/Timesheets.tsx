import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../auth/authContext';
import { getUser } from '../../../auth/storage';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import Modal from '../../../common/components/Modal/Modal';
import { useConfirmModal, type ConfirmAction } from '../../../common/components/Modal/hooks/useConfirmModal';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import type { TableColumn } from '../../../common/components/Table/Table';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import TimeEntryModal from '../../../common/features/timeEntries/components/TimeEntryModal/TimeEntryModal';
import {
  deleteTimeEntry,
  getTimeEntryOptions,
  setTimeEntry,
  type SetTimeEntryInput,
} from '../../../common/features/timeEntries/api/timeEntries.api';
import { TIME_ENTRY_CATEGORY_OPTIONS } from '../../../common/features/timeEntries/timeEntryOptions';
import type { StaffResource, TimeEntryProgram } from '../../../common/features/timeEntries/types';
import { TASKS_QUERY_KEY } from '../../../common/features/tasks/queryKeys';
import { formatShortDate } from '../../../common/utils/date';
import TimesheetCalendarView, { type TimesheetCalendarMutationCache, type TimesheetEntryTarget } from './components/TimesheetCalendarView/TimesheetCalendarView';
import TimesheetDashboard from './components/TimesheetDashboard/TimesheetDashboard';
import TimesheetListView from './components/TimesheetListView/TimesheetListView';
import { useTimesheetControls } from './hooks/useTimesheetControls';
import { useTimesheetOverview } from './hooks/useTimesheetOverview';
import { TIME_ENTRY_LIST_QUERY_KEY } from './timesheetQueryKeys';
import { timesheetEntryType, type TimesheetListRow } from './timesheetViewData';
import './Timesheets.css';

export default function Timesheets() {
  // Application access and page-owned workflows.
  const queryClient = useQueryClient();
  const { permissions, role } = useAuth();
  const currentUserId = getUser()?.id;
  const canWriteTimesheets = permissions.includes('write:timesheets');
  const [listSearch, setListSearch] = useState('');
  const [selectedListRowId, setSelectedListRowId] = useState<string | null>(null);
  const [selectedDashboardStaffId, setSelectedDashboardStaffId] = useState<string | null>(null);
  const [overviewRefreshToken, setOverviewRefreshToken] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<{ resourceId?: string; date?: string; source?: 'regular' | 'task' | 'session' }>({});
  const [editTarget, setEditTarget] = useState<TimesheetEntryTarget | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });

  // Remote options and persisted page controls.
  const optionsQuery = useQuery({ queryKey: ['time-entry-options'], queryFn: ({ signal }) => getTimeEntryOptions({ signal }) });
  const resources = useMemo<StaffResource[]>(() => optionsQuery.data?.resources ?? [], [optionsQuery.data?.resources]);
  const programs = useMemo<TimeEntryProgram[]>(() => optionsQuery.data?.programs ?? [], [optionsQuery.data?.programs]);
  const {
    staffFilters, categoryFilters, programFilters, typeFilters, view, ready: preferencesReady,
    columnWidths: listColumnWidths, hiddenColumns, setHiddenColumns, sorting, cycles, cyclesError, selectedCycleId, preferenceError,
    filterCategories, applyFilter, clearFilters, setView, setColumnWidths, setSorting, selectCycle,
  } = useTimesheetControls({ role, resources, programs });

  // The calendar owns buffered range data outside TanStack Query.
  const emptyCalendarCache = useMemo<TimesheetCalendarMutationCache>(() => ({ upsert: () => undefined, remove: () => undefined }), []);
  const calendarMutationRef = useRef<TimesheetCalendarMutationCache>(emptyCalendarCache);
  const refreshList = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: TIME_ENTRY_LIST_QUERY_KEY });
  }, [queryClient]);
  const writableResources = useMemo(() => resources.filter(resource => resource.writable), [resources]);
  const resourceById = useMemo(() => new Map(resources.map(resource => [resource.id, resource])), [resources]);
  const selectedCycle = cycles.find(cycle => cycle.id === selectedCycleId) ?? null;

  // Selection keeps the list, calendar, and dashboard context aligned.
  const selectListRowWithContext = useCallback((row: TimesheetListRow) => {
    setSelectedListRowId(row.id);
    setSelectedDashboardStaffId(row.resourceId);
    if (row.item.cycleId === selectedCycleId) return;
    selectCycle(row.item.cycleId);
  }, [selectCycle, selectedCycleId]);

  const currentUserResource = resources.find(resource => resource.id === currentUserId) ?? null;
  const dashboardStaff = resources.find(resource => resource.id === selectedDashboardStaffId)
    ?? currentUserResource;
  const overviewCycle = selectedCycle
    ?? cycles.find(cycle => cycle.state === 'active')
    ?? cycles[0]
    ?? null;
  const dashboardStaffId = dashboardStaff?.id ?? null;
  const overviewCycleId = overviewCycle?.id ?? null;
  const dashboardOverview = useTimesheetOverview(dashboardStaffId, overviewCycleId, overviewRefreshToken);

  // Mutations reconcile the calendar first, then refresh server-derived lists and totals.
  const addTimeEntry = async (input: SetTimeEntryInput) => {
    const created = editTarget
      ? await setTimeEntry(input, editTarget.item.id)
      : await setTimeEntry(input);
    const categoryLabel = TIME_ENTRY_CATEGORY_OPTIONS.find(option => option.value === created.category)?.label ?? created.category;
    calendarMutationRef.current.upsert(created.staffId, created.workDate, { ...created, categoryLabel });
    setOverviewRefreshToken(current => current + 1);
    const refreshes = [refreshList()];
    if (created.taskId) refreshes.push(queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY }));
    await Promise.all(refreshes);
  };

  const requestDelete = useCallback((target: TimesheetEntryTarget) => {
    setConfirmAction({
      title: 'Delete logged hours',
      message: `Delete these ${target.item.categoryLabel.toLowerCase()} hours?`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        await deleteTimeEntry(target.item.id);
        calendarMutationRef.current.remove(target.item.id);
        setOverviewRefreshToken(current => current + 1);
        const refreshes = [refreshList()];
        if (target.item.taskId) refreshes.push(queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY }));
        await Promise.all(refreshes);
        setEditTarget(current => current?.item.id === target.item.id ? null : current);
      },
    });
  }, [queryClient, refreshList]);

  // Table presentation stays page-owned because its actions open page-owned dialogs.
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

  return (
    <>
      <main className="page-container page-container--data timesheets-page">
        <PageHeader
          title="Hours"
          actions={canWriteTimesheets && writableResources.length ? (
            <ActionsMenu
              triggerLabel="+ Add"
              ariaLabel="Add hours"
              items={[
                { id: 'session', label: 'Session Hours', onClick: () => {
                  setEditTarget(null);
                  setAddTarget({ source: 'session' });
                  setAddOpen(true);
                } },
                { id: 'task', label: 'Task Hours', onClick: () => {
                  setEditTarget(null);
                  setAddTarget({ source: 'task' });
                  setAddOpen(true);
                } },
                { id: 'regular', label: 'Regular Hours', onClick: () => {
                  setEditTarget(null);
                  setAddTarget({ source: 'regular' });
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
          columns={view === 'list'
            ? <ColumnVisibilityMenu columns={listColumns} hiddenColumnKeys={hiddenColumns} onHiddenColumnKeysChange={setHiddenColumns} />
            : undefined}
          search={view === 'list' ? (
            <SearchInput
              label="Search hours"
              value={listSearch}
              onChange={event => setListSearch(event.target.value)}
              placeholder="Search hours"
            />
          ) : undefined}
        />
        {(optionsQuery.error || cyclesError || preferenceError) && (
          <div className="timesheets-page__error" role="alert">
            <span>{(optionsQuery.error ? 'Could not load hour options.' : null) ?? cyclesError ?? preferenceError}</span>
          </div>
        )}
        {!preferencesReady ? <p role="status">Loading saved filters…</p> : <PageBody
          ariaLabel="Hours overview and entries"
          dashboard={<TimesheetDashboard staff={dashboardStaff} cycle={overviewCycle} overview={dashboardOverview} />}
          {...(view === 'calendar' ? { calendar: <TimesheetCalendarView
            resources={resources}
            staffIds={staffFilters}
            categories={categoryFilters}
            programIds={programFilters}
            types={typeFilters}
            cycleId={selectedCycleId}
            canWrite={canWriteTimesheets}
            selectedStaffId={dashboardStaff?.id}
            mutationCacheRef={calendarMutationRef}
            onStaffSelect={setSelectedDashboardStaffId}
            onEdit={target => {
              setEditTarget(target);
              setAddTarget({ resourceId: target.resourceId, date: target.date });
              setAddOpen(true);
            }}
            onDelete={requestDelete}
            onAdd={target => {
              setAddTarget(target);
              setEditTarget(null);
              setAddOpen(true);
            }}
            onOverviewRefresh={() => setOverviewRefreshToken(current => current + 1)}
          /> } : { table: <TimesheetListView
            columns={listColumns}
            hiddenColumnKeys={hiddenColumns}
            staffIds={staffFilters}
            categories={categoryFilters}
            programIds={programFilters}
            types={typeFilters}
            cycleId={selectedCycleId || undefined}
            search={listSearch}
            sorting={sorting}
            columnWidths={listColumnWidths}
            selectedRowId={selectedListRowId}
            onRowSelect={selectListRowWithContext}
            onSortingChange={setSorting}
            onColumnWidthsChange={setColumnWidths}
          /> })}
        />}
      </main>
      <TimeEntryModal
        isOpen={addOpen}
        resources={writableResources}
        programs={programs}
        onClose={() => setAddOpen(false)}
        onAdd={addTimeEntry}
        initialResourceId={addTarget.resourceId ?? (!editTarget ? currentUserId : undefined)}
        initialDate={addTarget.date}
        initialSource={addTarget.source}
        staffLocked={Boolean(addTarget.resourceId)}
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
