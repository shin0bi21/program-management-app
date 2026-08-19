import { useState } from 'react';

import Button from '../../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import Modal from '../../../common/components/Modal/Modal';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import TimeEntryModal from '../../../common/features/timeEntries/components/TimeEntryModal/TimeEntryModal';
import TaskCalendarView from './components/TaskCalendarView/TaskCalendarView';
import TaskDashboard from './components/TaskDashboard/TaskDashboard';
import TaskTableView from './components/TaskTableView/TaskTableView';
import TaskModal from './components/TaskModal/TaskModal';

import { useAuth } from '../../../auth/authContext';
import { useConfirmModal } from '../../../common/components/Modal/hooks/useConfirmModal';
import useTaskTable from './components/TaskTableView/hooks/useTaskTable';
import useTaskActions from './hooks/useTaskActions';
import useCurrentTaskDate from './hooks/useCurrentTaskDate';
import useTaskData from './hooks/useTaskData';
import useTaskFilters from './hooks/useTaskFilters';
import useTaskPreferences from './hooks/useTaskPreferences';
import useTaskSelection from './hooks/useTaskSelection';

import type { Task } from '../../../common/features/tasks/types';
import type { TaskModalTarget } from './types';

import './Tasks.css';

// Page-owned cache and persisted-column contracts.
const TASK_COLUMN_KEYS = [
  'title',
  'category',
  'firstName',
  'lastName',
  'program',
  'startDate',
  'dueDate',
  'status',
] as const;
const TASK_SORT_KEYS = [
  'firstName', 'lastName', 'title', 'category', 'program', 'startDate', 'dueDate', 'status',
] as const;

const TASK_QUERY_KEY = ['tasks'] as const;
const TASK_LIST_QUERY_KEY = [...TASK_QUERY_KEY, 'list'] as const;
const TASK_OPTIONS_QUERY_KEY = ['task-options'] as const;
const TIME_ENTRY_QUERY_KEY = ['time-entries'] as const;

// Page helpers.
function getTaskError(
  actionError: string,
  preferenceError: string | null,
  optionsError: unknown,
) {
  return actionError
    || preferenceError
    || (optionsError ? 'Unable to load task form options.' : '');
}

function getLoggableTask(task: Task | null, canWrite: boolean) {
  if (!canWrite || !task?.writable) return null;
  if (task.status !== 'open') return null;
  return task;
}

export default function Tasks() {
  // Permissions.
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:tasks');
  const today = useCurrentTaskDate();

  // Modal state.
  const [selectedLogHoursTask, setSelectedLogHoursTask] = useState<Task | null>(null);
  const [taskModalTarget, setTaskModalTarget] = useState<TaskModalTarget | null>(null);

  // Page data and persisted controls.
  const pageData = useTaskData(TASK_OPTIONS_QUERY_KEY);
  const taskPreferences = useTaskPreferences({
    options: pageData.options,
    optionsLoading: pageData.optionsLoading,
    optionsError: Boolean(pageData.optionsError),
    columnKeys: TASK_COLUMN_KEYS,
    sortKeys: TASK_SORT_KEYS,
  });

  const filters = useTaskFilters({
    preferences: taskPreferences.preferences,
    options: pageData.options,
    updatePreferences: taskPreferences.updatePreferences,
  });

  const view = taskPreferences.preferences.view;

  // Selection, actions, and modal workflows.
  const selection = useTaskSelection({
    onResourceSelect: pageData.setSelectedResourceId,
  });

  const taskActions = useTaskActions({
    taskQueryKey: TASK_QUERY_KEY,
    taskListQueryKey: TASK_LIST_QUERY_KEY,
    timeEntryQueryKey: TIME_ENTRY_QUERY_KEY,
    onTaskSynced: selection.updateSelectedTask,
    onTaskRemoved: selection.removeSelectedTask,
  });

  const table = useTaskTable({
    canWrite,
    today,
    preferences: taskPreferences.preferences,
    updatePreferences: taskPreferences.updatePreferences,
    actions: {
      isTaskPending: taskActions.isTaskPending,
      setStatus: taskActions.setStatus,
      edit: setTaskModalTarget,
      requestDelete: taskActions.requestDelete,
    },
  });

  const confirmModal = useConfirmModal({
    action: taskActions.confirmAction,
    onClose: taskActions.closeConfirmation,
  });

  // View configuration.
  const taskError = getTaskError(
    taskActions.statusError,
    taskPreferences.error,
    pageData.optionsError,
  );
  const loggableTask = getLoggableTask(selection.selectedTask, canWrite);

  const logHoursAction = loggableTask
    ? () => setSelectedLogHoursTask(loggableTask)
    : undefined;

  const viewContent = view === 'list'
    ? { table: <TaskTableView
      queryKey={TASK_LIST_QUERY_KEY}
      columns={table.columns}
      hiddenColumnKeys={table.hiddenColumns}
      staffIds={filters.staffIds}
      programIds={filters.programIds}
      categories={filters.categories}
      statuses={filters.statusFilters}
      search={filters.search}
      today={today}
      sorting={table.sorting}
      columnWidths={table.columnWidths}
      selectedTaskId={selection.selectedTaskId}
      onTaskSelect={selection.selectTask}
      onSortingChange={table.updateSorting}
      onColumnWidthsChange={table.updateColumnWidths}
    /> }
    : { calendar: <TaskCalendarView
      resources={pageData.resources}
      filters={{
        staffIds: filters.staffIds,
        programIds: filters.programIds,
        categories: filters.categories,
        statuses: filters.statusFilters,
      }}
      canWrite={canWrite}
      selectedResourceId={pageData.selectedResourceId}
      selectedTaskId={selection.selectedTaskId}
      today={today}
      actions={taskActions}
      calendarCacheRef={taskActions.calendarCacheRef}
      onTaskSelect={selection.selectTask}
      onResourceSelect={selection.selectResource}
      onModalTargetChange={setTaskModalTarget}
    /> };

  // Render.
  return <>
    <main className="page-container page-container--data">
      <PageHeader
        title="Tasks"
        actions={canWrite && pageData.writableResources.length ? <Button
          disabled={pageData.optionsLoading || Boolean(pageData.optionsError)}
          onClick={() => {
            setTaskModalTarget({ startDate: today, dueDate: today });
          }}
        >+ Add</Button> : undefined}
        search={taskPreferences.ready && view === 'list' ? <SearchInput
          label="Search tasks"
          value={filters.search}
          onChange={event => filters.setSearch(event.target.value)}
          placeholder="Search tasks"
        /> : undefined}
        view={taskPreferences.ready ? <ViewMenu
          value={view}
          options={[{ value: 'calendar', label: 'Calendar' }, { value: 'list', label: 'List' }]}
          onChange={nextView => taskPreferences.updatePreferences({ view: nextView })}
        /> : undefined}
        columns={taskPreferences.ready && view === 'list'
          ? <ColumnVisibilityMenu
            columns={table.columns}
            hiddenColumnKeys={table.hiddenColumns}
            onHiddenColumnKeysChange={table.updateHiddenColumns}
          />
          : undefined}
        filters={taskPreferences.ready ? <FilterCard
          categories={filters.filterCategories}
          values={{
            staff: filters.staffIds,
            program: filters.programIds,
            category: filters.categories,
            status: filters.statusFilters,
          }}
          onApply={filters.applyFilter}
          onClearAll={filters.clearFilters}
        /> : undefined}
      />
      {taskError && <p className="form-error" role="alert">{taskError}</p>}
      {!taskPreferences.ready ? <p role="status">Loading saved task preferences…</p> : <PageBody
        ariaLabel="Task overview and assignments"
        dashboard={pageData.selectedResource ? <TaskDashboard
          queryKey={TASK_QUERY_KEY}
          resourceId={pageData.selectedResource.id}
          resourceName={pageData.selectedResource.name}
          today={today}
          selectedTask={selection.selectedTask}
          onLogHours={logHoursAction}
        /> : null}
        {...viewContent}
      />}
    </main>

    {canWrite && taskModalTarget && <TaskModal
      isOpen
      task={'id' in taskModalTarget ? taskModalTarget : undefined}
      initialStartDate={'id' in taskModalTarget ? undefined : taskModalTarget.startDate}
      initialDueDate={'id' in taskModalTarget ? undefined : taskModalTarget.dueDate}
      fixedStaffId={'id' in taskModalTarget ? undefined : taskModalTarget.fixedStaffId}
      resources={pageData.writableResources}
      programs={pageData.options?.programs ?? []}
      onSaved={taskActions.syncTask}
      onClose={() => setTaskModalTarget(null)}
    />}

    {selectedLogHoursTask && <TimeEntryModal
      isOpen
      initialSource="task"
      initialTask={selectedLogHoursTask}
      initialResourceId={selectedLogHoursTask.assignee.id}
      canCompleteTask={canWrite}
      resources={pageData.resources}
      programs={pageData.options?.programs ?? []}
      onAdd={taskActions.logHours}
      onClose={() => setSelectedLogHoursTask(null)}
    />}

    <Modal
      isOpen={taskActions.confirmAction !== null}
      onClose={taskActions.closeConfirmation}
      title={taskActions.confirmAction?.title ?? ''}
      status={confirmModal.status}
      statusMessage={confirmModal.statusMessage}
      footer={confirmModal.footer}
      successDelay={confirmModal.successDelay}
    >
      {taskActions.confirmAction && <p>{taskActions.confirmAction.message}</p>}
    </Modal>
  </>;
}
