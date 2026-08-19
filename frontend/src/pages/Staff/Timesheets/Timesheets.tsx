import { useCallback, useState } from 'react';

import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import Modal from '../../../common/components/Modal/Modal';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import TimeEntryModal from '../../../common/features/timeEntries/components/TimeEntryModal/TimeEntryModal';
import TimesheetCalendarView from './components/TimesheetCalendarView/TimesheetCalendarView';
import TimesheetDashboard from './components/TimesheetDashboard/TimesheetDashboard';
import TimesheetTableView from './components/TimesheetTableView/TimesheetTableView';

import { useAuth } from '../../../auth/authContext';
import { getUser } from '../../../auth/storage';
import { useConfirmModal } from '../../../common/components/Modal/hooks/useConfirmModal';
import useTimesheetTable from './components/TimesheetTableView/hooks/useTimesheetTable';
import useTimesheetActions from './hooks/useTimesheetActions';
import useTimesheetData from './hooks/useTimesheetData';
import useTimesheetFilters from './hooks/useTimesheetFilters';
import useTimesheetPreferences from './hooks/useTimesheetPreferences';
import useTimesheetSelection from './hooks/useTimesheetSelection';

import type { SetTimeEntryInput } from '../../../common/features/timeEntries/timeEntries.api';
import type { TimesheetAddTarget, TimesheetEntryTarget } from './types';

import './Timesheets.css';

// Page-owned cache and persisted-column contracts.
const TASK_QUERY_KEY = ['tasks'] as const;
const TIME_ENTRY_QUERY_KEY = ['time-entries'] as const;
const TIME_ENTRY_LIST_QUERY_KEY = [...TIME_ENTRY_QUERY_KEY, 'list'] as const;
const TIME_ENTRY_OPTIONS_QUERY_KEY = ['time-entry-options'] as const;
const PROGRAM_CYCLES_QUERY_KEY = ['program-cycles'] as const;

const TIMESHEET_COLUMN_KEYS = [
  'date',
  'firstName',
  'lastName',
  'program',
  'cycle',
  'category',
  'session',
  'hours',
  'note',
  'type',
] as const;
const TIMESHEET_SORT_KEYS = [
  'firstName', 'lastName', 'date', 'program', 'cycle', 'category', 'session', 'hours', 'note', 'type',
] as const;

function getTimesheetError(
  optionsError: unknown,
  cyclesError: unknown,
  preferenceError: string | null,
) {
  return (optionsError ? 'Could not load hour options.' : '')
    || (cyclesError ? 'Could not load cycles.' : '')
    || preferenceError;
}

export default function Timesheets() {
  // Permissions.
  const { permissions, role } = useAuth();
  const currentUserId = getUser()?.id;
  const canWrite = permissions.includes('write:timesheets');
  const canCompleteTask = permissions.includes('write:tasks');

  // Modal state.
  const [modalOpen, setModalOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<TimesheetAddTarget>({});
  const [editTarget, setEditTarget] = useState<TimesheetEntryTarget | null>(null);

  // Page data and persisted controls.
  const pageData = useTimesheetData(
    TIME_ENTRY_OPTIONS_QUERY_KEY,
    PROGRAM_CYCLES_QUERY_KEY,
    currentUserId,
  );

  const timesheetPreferences = useTimesheetPreferences({
    role,
    resources: pageData.resources,
    programs: pageData.programs,
    cycles: pageData.cycles,
    loadingDependencies: pageData.optionsLoading || pageData.cyclesLoading,
    optionsError: Boolean(pageData.optionsError),
    cyclesError: Boolean(pageData.cyclesError),
    columnKeys: TIMESHEET_COLUMN_KEYS,
    sortKeys: TIMESHEET_SORT_KEYS,
  });

  const filters = useTimesheetFilters({
    role,
    preferences: timesheetPreferences.preferences,
    resources: pageData.resources,
    programs: pageData.programs,
    cycles: pageData.cycles,
    updatePreferences: timesheetPreferences.updatePreferences,
  });

  const view = timesheetPreferences.preferences.view;

  // Selection, actions, and modal workflows.
  const selection = useTimesheetSelection({
    resources: pageData.resources,
    currentUserResource: pageData.currentUserResource,
    cycleId: filters.cycleId,
    onCycleSelect: filters.selectCycle,
  });

  const actions = useTimesheetActions({
    timeEntryQueryKey: TIME_ENTRY_QUERY_KEY,
    timeEntryListQueryKey: TIME_ENTRY_LIST_QUERY_KEY,
    taskQueryKey: TASK_QUERY_KEY,
    onEntryRemoved: entryId => {
      setEditTarget(current => current?.item.id === entryId ? null : current);
    },
  });

  const openAddTarget = useCallback((target: TimesheetAddTarget) => {
    setEditTarget(null);
    setAddTarget(target);
    setModalOpen(true);
  }, []);

  const openEditTarget = useCallback((target: TimesheetEntryTarget) => {
    setEditTarget(target);
    setAddTarget({ resourceId: target.resourceId, date: target.date });
    setModalOpen(true);
  }, []);

  const table = useTimesheetTable({
    canWrite,
    resourcesById: pageData.resourcesById,
    preferences: timesheetPreferences.preferences,
    updatePreferences: timesheetPreferences.updatePreferences,
    isEntryPending: actions.isEntryPending,
    onEdit: openEditTarget,
    onDelete: actions.requestDelete,
  });

  const confirmModal = useConfirmModal({
    action: actions.confirmAction,
    onClose: actions.closeConfirmation,
  });

  // View configuration.
  const selectedCycle = pageData.cycles.find(cycle => cycle.id === filters.cycleId) ?? null;
  const overviewCycle = selectedCycle
    ?? pageData.cycles.find(cycle => cycle.state === 'active')
    ?? pageData.cycles[0]
    ?? null;
  const timesheetError = getTimesheetError(
    pageData.optionsError,
    pageData.cyclesError,
    timesheetPreferences.error,
  );
  const viewContent = view === 'list'
    ? { table: <TimesheetTableView
      queryKey={TIME_ENTRY_LIST_QUERY_KEY}
      columns={table.columns}
      hiddenColumnKeys={table.hiddenColumns}
      staffIds={filters.staffIds}
      categories={filters.categories}
      programIds={filters.programIds}
      types={filters.types}
      cycleId={filters.cycleId ?? undefined}
      search={filters.search}
      sorting={table.sorting}
      columnWidths={table.columnWidths}
      selectedRowId={selection.selectedRowId}
      onRowSelect={selection.selectRow}
      onSortingChange={table.updateSorting}
      onColumnWidthsChange={table.updateColumnWidths}
    /> }
    : { calendar: <TimesheetCalendarView
      resources={pageData.resources}
      staffIds={filters.staffIds}
      categories={filters.categories}
      programIds={filters.programIds}
      types={filters.types}
      cycleId={filters.cycleId ?? ''}
      canWrite={canWrite}
      moveError={actions.moveError}
      selectedStaffId={selection.selectedStaff?.id}
      mutationCacheRef={actions.calendarCacheRef}
      isEntryPending={actions.isEntryPending}
      onStaffSelect={selection.selectStaff}
      onEdit={openEditTarget}
      onDelete={actions.requestDelete}
      onAdd={openAddTarget}
      onMove={actions.moveTimeEntry}
    /> };

  const submitTimeEntry = (input: SetTimeEntryInput) => (
    actions.saveTimeEntry(input, editTarget?.item.id)
  );

  // Render.
  return <>
    <main className="page-container page-container--data timesheets-page">
      <PageHeader
        title="Hours"
        actions={canWrite && pageData.writableResources.length ? <ActionsMenu
          triggerLabel="+ Add"
          ariaLabel="Add hours"
          items={[
            { id: 'session', label: 'Session Hours', onClick: () => openAddTarget({ source: 'session' }) },
            { id: 'task', label: 'Task Hours', onClick: () => openAddTarget({ source: 'task' }) },
            { id: 'regular', label: 'Regular Hours', onClick: () => openAddTarget({ source: 'regular' }) },
          ]}
        /> : undefined}

        search={timesheetPreferences.ready && view === 'list' ? <SearchInput
          label="Search hours"
          value={filters.search}
          onChange={event => filters.setSearch(event.target.value)}
          placeholder="Search hours"
        /> : undefined}

        view={timesheetPreferences.ready ? <ViewMenu
          label="View"
          value={view}
          onChange={nextView => timesheetPreferences.updatePreferences({ view: nextView })}
          options={[{ value: 'calendar', label: 'Calendar' }, { value: 'list', label: 'List' }]}
        /> : undefined}

        columns={timesheetPreferences.ready && view === 'list' ? <ColumnVisibilityMenu
          columns={table.columns}
          hiddenColumnKeys={table.hiddenColumns}
          onHiddenColumnKeysChange={table.updateHiddenColumns}
        /> : undefined}

        filters={timesheetPreferences.ready ? <FilterCard
          categories={filters.filterCategories}
          values={{
            staff: filters.staffIds,
            entryType: filters.categories,
            program: filters.programIds,
            type: filters.types,
            cycle: filters.cycleId ? [filters.cycleId] : [],
          }}
          onApply={filters.applyFilter}
          onClearAll={filters.clearFilters}
        /> : undefined}
      />
      {timesheetError && <p className="timesheets-page__error" role="alert">{timesheetError}</p>}
      {!timesheetPreferences.ready ? <p role="status">Loading saved filters…</p> : <PageBody
        ariaLabel="Hours overview and entries"
        dashboard={<TimesheetDashboard
          queryKey={TIME_ENTRY_QUERY_KEY}
          staff={selection.selectedStaff}
          cycle={overviewCycle}
        />}
        {...viewContent}
      />}
    </main>

    <TimeEntryModal
      isOpen={modalOpen}
      resources={pageData.writableResources}
      programs={pageData.programs}
      onClose={() => setModalOpen(false)}
      onAdd={submitTimeEntry}
      initialResourceId={addTarget.resourceId ?? (!editTarget ? currentUserId : undefined)}
      initialDate={addTarget.date}
      initialSource={addTarget.source}
      canCompleteTask={canCompleteTask}
      staffLocked={Boolean(addTarget.resourceId)}
      initialItem={editTarget?.item}
    />

    <Modal
      isOpen={actions.confirmAction !== null}
      onClose={actions.closeConfirmation}
      title={actions.confirmAction?.title ?? ''}
      status={confirmModal.status}
      statusMessage={confirmModal.statusMessage}
      footer={confirmModal.footer}
      successDelay={confirmModal.successDelay}
    >
      {actions.confirmAction && <p>{actions.confirmAction.message}</p>}
    </Modal>
  </>;
}
