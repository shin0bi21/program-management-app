import { useState } from 'react';

import Button from '../../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import Modal from '../../../common/components/Modal/Modal';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import HoursModal from '../../../common/features/hours/components/HoursModal/HoursModal';
import TaskCalendar from './components/TaskCalendar/TaskCalendar';
import TaskDashboard from './components/TaskDashboard/TaskDashboard';
import TaskTable from './components/TaskTable/TaskTable';
import TaskModal from './components/TaskModal/TaskModal';

import { useAuth } from '../../../auth/authContext';
import { useConfirmModal } from '../../../common/components/Modal/hooks/useConfirmModal';
import useTaskTable from './components/TaskTable/hooks/useTaskTable';
import useTaskActions from './hooks/useTaskActions';
import useCurrentTaskDate from './hooks/useCurrentTaskDate';
import useTaskData from './hooks/useTaskData';
import useTaskFilters from './hooks/useTaskFilters';
import useTaskPreferences from './hooks/useTaskPreferences';
import useTaskSelection from './hooks/useTaskSelection';

import type { Task } from '../../../common/features/tasks/types';
import { TASK_TABLE_KEYS, type AddTaskModalInitialValues, type TaskModalState } from './types';

import './Tasks.css';

// Page-owned cache contracts.
const TASK_QUERY_KEY = ['tasks'] as const;
const TASK_TABLE_QUERY_KEY = [...TASK_QUERY_KEY, 'table'] as const;
const TASK_OPTIONS_QUERY_KEY = ['task-options'] as const;
const HOURS_QUERY_KEY = ['hours'] as const;

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
  const [taskModalState, setTaskModalState] = useState<TaskModalState>(null);

  // Page data and persisted controls.
  const pageData = useTaskData(TASK_OPTIONS_QUERY_KEY);
  const taskPreferences = useTaskPreferences({
    options: pageData.options,
    optionsLoading: pageData.optionsLoading,
    optionsError: Boolean(pageData.optionsError),
    tableKeys: TASK_TABLE_KEYS,
  });

  const filters = useTaskFilters({
    preferences: taskPreferences.preferences,
    options: pageData.options,
    updatePreferences: taskPreferences.updatePreferences,
  });

  const view = taskPreferences.preferences.view;

  // Selection, actions, and modal workflows.
  const selection = useTaskSelection({ resources: pageData.resources });

  const actions = useTaskActions({
    taskQueryKey: TASK_QUERY_KEY,
    taskTableQueryKey: TASK_TABLE_QUERY_KEY,
    hoursQueryKey: HOURS_QUERY_KEY,
    onTaskSynced: selection.updateSelectedTask,
    onTaskRemoved: selection.removeSelectedTask,
  });

  const openAddTaskModal = (initialValues: AddTaskModalInitialValues) => {
    setTaskModalState({ mode: 'add', initialValues });
  };

  const openEditTaskModal = (task: Task) => {
    setTaskModalState({ mode: 'edit', task });
  };

  const closeTaskModal = () => setTaskModalState(null);

  const table = useTaskTable({
    canWrite,
    today,
    actions: {
      isTaskPending: actions.isTaskPending,
      setStatus: actions.setStatus,
      edit: openEditTaskModal,
      requestDelete: actions.requestDelete,
    },
  });

  const confirmModal = useConfirmModal({
    action: actions.confirmAction,
    onClose: actions.closeConfirmation,
  });

  // View configuration.
  const taskError = getTaskError(
    actions.actionError,
    taskPreferences.error,
    pageData.optionsError,
  );
  const loggableTask = getLoggableTask(selection.selectedTask, canWrite);

  const logHoursAction = loggableTask
    ? () => setSelectedLogHoursTask(loggableTask)
    : undefined;

  const taskTable = (
    <TaskTable
      queryKey={TASK_TABLE_QUERY_KEY}
      columns={table.columns}
      hiddenColumnKeys={taskPreferences.preferences.hiddenColumns}
      staffIds={filters.staffIds}
      programIds={filters.programIds}
      categories={filters.categories}
      statuses={filters.statusFilters}
      search={filters.debouncedSearch}
      today={today}
      sorting={taskPreferences.preferences.sorting}
      columnWidths={taskPreferences.preferences.columnWidths}
      selectedTaskId={selection.selectedTaskId}
      onTaskSelect={selection.selectTask}
      onSortingChange={taskPreferences.updateSorting}
      onColumnWidthsChange={taskPreferences.updateColumnWidths}
    />
  );

  const taskCalendar = (
    <TaskCalendar
      resources={pageData.resources}
      filters={{
        staffIds: filters.staffIds,
        programIds: filters.programIds,
        categories: filters.categories,
        statuses: filters.statusFilters,
      }}
      canWrite={canWrite}
      selectedResourceId={selection.selectedResourceId}
      selectedTaskId={selection.selectedTaskId}
      today={today}
      actions={actions}
      calendarCacheRef={actions.calendarCacheRef}
      onTaskSelect={selection.selectTask}
      onResourceSelect={selection.selectResource}
      onAddTask={openAddTaskModal}
      onEditTask={openEditTaskModal}
    />
  );

  const viewContent = view === 'table'
    ? { table: taskTable }
    : { calendar: taskCalendar };

  // Render.
  return <>
    <main className="page-container page-container--data">
      <PageHeader
        title="Tasks"

        actions={canWrite && pageData.writableResources.length ? <Button
          disabled={pageData.optionsLoading || Boolean(pageData.optionsError)}
          onClick={() => {
            openAddTaskModal({ startDate: today, dueDate: today });
          }}
        >+ Add</Button> : undefined}

        search={taskPreferences.ready && view === 'table' ? <SearchInput
          label="Search tasks"
          value={filters.search}
          onChange={event => filters.setSearch(event.target.value)}
          placeholder="Search tasks"
        /> : undefined}

        view={taskPreferences.ready ? <ViewMenu
          value={view}
          options={[{ value: 'calendar', label: 'Calendar' }, { value: 'table', label: 'Table' }]}
          onChange={nextView => taskPreferences.updatePreferences({ view: nextView })}
        /> : undefined}

        columns={taskPreferences.ready && view === 'table'
          ? <ColumnVisibilityMenu
            columns={table.columns}
            hiddenColumnKeys={taskPreferences.preferences.hiddenColumns}
            onHiddenColumnKeysChange={taskPreferences.updateHiddenColumns}
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
        dashboard={selection.selectedResource ? <TaskDashboard
          queryKey={TASK_QUERY_KEY}
          resourceId={selection.selectedResource.id}
          resourceName={selection.selectedResource.name}
          today={today}
          selectedTask={selection.selectedTask}
          onLogHours={logHoursAction}
        /> : null}
        {...viewContent}
      />}
    </main>

    {canWrite && taskModalState && <TaskModal
      isOpen
      task={taskModalState.mode === 'edit' ? taskModalState.task : undefined}
      initialStartDate={taskModalState.mode === 'add' ? taskModalState.initialValues.startDate : undefined}
      initialDueDate={taskModalState.mode === 'add' ? taskModalState.initialValues.dueDate : undefined}
      fixedStaffId={taskModalState.mode === 'add' ? taskModalState.initialValues.fixedStaffId : undefined}
      resources={pageData.writableResources}
      programs={pageData.options?.programs ?? []}
      onSaved={actions.syncTask}
      onClose={closeTaskModal}
    />}

    {selectedLogHoursTask && <HoursModal
      isOpen
      initialSource="task"
      initialTask={selectedLogHoursTask}
      initialResourceId={selectedLogHoursTask.assignee.id}
      canCompleteTask={canWrite}
      resources={pageData.resources}
      programs={pageData.options?.programs ?? []}
      onAdd={actions.logHours}
      onClose={() => setSelectedLogHoursTask(null)}
    />}

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
