import { useCallback, useState } from 'react';

import Button from '../../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import Modal from '../../../common/components/Modal/Modal';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import HoursModal from '../Hours/components/HoursModal/HoursModal';
import TaskCalendar from './components/TaskCalendar/TaskCalendar';
import TaskDashboard from './components/TaskDashboard/TaskDashboard';
import TaskTable from './components/TaskTable/TaskTable';
import TaskModal from './components/TaskModal/TaskModal';

import { useAuth } from '../../../auth/authContext';
import {
  type ConfirmAction,
  useConfirmModal,
} from '../../../common/components/Modal/hooks/useConfirmModal';
import useTaskTable from './components/TaskTable/hooks/useTaskTable';
import useTaskActions from './hooks/useTaskActions';
import useTaskData from './hooks/useTaskData';
import useTaskPreferences from './hooks/useTaskPreferences';
import useTaskSelection from './hooks/useTaskSelection';

import { getDateKeyInTimeZone } from '../../../common/utils/date';
import { getTaskDashboardData } from './tasks.api';
import { TASK_TABLE_KEYS, type AddTaskModalInitialValues, type Task, type TaskModalState } from './types';

import './Tasks.css';

// Page-owned cache contracts.
const TASK_QUERY_KEY = ['tasks'] as const;
const TASK_TABLE_QUERY_KEY = [...TASK_QUERY_KEY, 'table'] as const;
const TASK_REFERENCE_DATA_QUERY_KEY = ['task-reference-data'] as const;
const HOURS_QUERY_KEY = ['hours'] as const;

export default function Tasks() {

  // Permissions.
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:tasks');
  const today = getDateKeyInTimeZone();

  // Page data and preferences.
  const pageData = useTaskData(TASK_REFERENCE_DATA_QUERY_KEY);
  const preferences = useTaskPreferences({
    referenceData: pageData.referenceData,
    referenceDataLoading: pageData.referenceDataLoading,
    referenceDataError: Boolean(pageData.referenceDataError),
    tableKeys: TASK_TABLE_KEYS,
  });

  // Selection and actions.
  const selection = useTaskSelection({ resources: pageData.resources });

  const actions = useTaskActions({
    taskQueryKey: TASK_QUERY_KEY,
    taskTableQueryKey: TASK_TABLE_QUERY_KEY,
    hoursQueryKey: HOURS_QUERY_KEY,
    onTaskSynced: selection.updateSelectedTask,
    onTaskRemoved: selection.removeSelectedTask,
  });
  const deleteTaskAction = actions.deleteTask;

  // Hours modal.
  const [hoursModalState, setHoursModalState] = useState(false);
  const openHoursModal = () => setHoursModalState(true);
  const closeHoursModal = () => setHoursModalState(false);

  // Task modal.
  const [taskModalState, setTaskModalState] = useState<TaskModalState>(null);
  const openAddTaskModal = (initialValues: AddTaskModalInitialValues) => {
    setTaskModalState({ mode: 'add', initialValues });
  };
  const openEditTaskModal = useCallback((task: Task) => {
    setTaskModalState({ mode: 'edit', task });
  }, []);
  const closeTaskModal = () => setTaskModalState(null);

  // Confirmation modal.
  const [confirmationState, setConfirmationState] = useState<ConfirmAction | null>(null);

  const openDeleteConfirmation = useCallback((task: Task) => setConfirmationState({
    title: 'Delete Task',
    message: `Delete “${task.title}”? Tasks with logged time cannot be deleted.`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    successMessage: 'Task deleted',
    onConfirm: () => deleteTaskAction(task),
  }), [deleteTaskAction]);

  const closeConfirmation = () => setConfirmationState(null);

  const table = useTaskTable({
    canWrite,
    actions: {
      isTaskPending: actions.isTaskPending,
      setState: actions.setState,
      edit: openEditTaskModal,
      requestDelete: openDeleteConfirmation,
    },
  });

  const confirmationModal = useConfirmModal({
    action: confirmationState,
    onClose: closeConfirmation,
  });

  // View configuration.
  const taskError = getTaskError(
    actions.actionError,
    preferences.error,
    pageData.referenceDataError,
  );
  const loggableTask = getLoggableTask(selection.selectedTask, canWrite);

  const taskTable = (
    <TaskTable
      queryKey={TASK_TABLE_QUERY_KEY}
      columns={table.columns}
      hiddenColumnKeys={preferences.table.hiddenColumns}
      staffIds={preferences.filters.staffIds}
      programIds={preferences.filters.programIds}
      categories={preferences.filters.categories}
      statuses={preferences.filters.statuses}
      search={preferences.search.appliedValue}
      today={today}
      sorting={preferences.table.sorting}
      columnWidths={preferences.table.columnWidths}
      selectedTaskId={selection.selectedTaskId}
      onTaskSelect={selection.selectTask}
      onSortingChange={preferences.table.setSorting}
      onColumnWidthsChange={preferences.table.setColumnWidths}
    />
  );

  const calendarDataKey = JSON.stringify([
    preferences.search.appliedValue,
    preferences.filters.staffIds,
    preferences.filters.programIds,
    preferences.filters.categories,
    preferences.filters.statuses,
  ]);

  const taskCalendar = (
    <TaskCalendar
      key={calendarDataKey}
      resources={pageData.resources}
      filters={{
        search: preferences.search.appliedValue,
        staffIds: preferences.filters.staffIds,
        programIds: preferences.filters.programIds,
        categories: preferences.filters.categories,
        statuses: preferences.filters.statuses,
      }}
      canWrite={canWrite}
      selectedResourceId={selection.selectedResourceId}
      selectedTaskId={selection.selectedTaskId}
      actions={{
        isTaskPending: actions.isTaskPending,
        requestDelete: openDeleteConfirmation,
        setState: actions.setState,
        setTaskRange: actions.setTaskRange,
      }}
      calendarCacheRef={actions.calendarCacheRef}
      onTaskSelect={selection.selectTask}
      onResourceSelect={selection.selectResource}
      onAddTask={openAddTaskModal}
      onEditTask={openEditTaskModal}
    />
  );

  const viewContent = preferences.view === 'table'
    ? { table: taskTable }
    : { calendar: taskCalendar };

  // Render.
  return <>
    <main className="page-container page-container--data">
      <PageHeader
        title="Tasks"

        actions={canWrite && pageData.writableResources.length ? <Button
          disabled={pageData.referenceDataLoading || Boolean(pageData.referenceDataError)}
          onClick={() => {
            openAddTaskModal({ startDate: today, dueDate: today });
          }}
        >+ Add</Button> : undefined}

        search={preferences.ready ? <SearchInput
          label="Search tasks"
          value={preferences.search.value}
          appliedValue={preferences.search.appliedValue}
          onChange={event => preferences.search.setValue(event.target.value)}
          onApply={preferences.search.apply}
          onClear={preferences.search.clear}
          placeholder="Search tasks"
        /> : undefined}

        view={preferences.ready ? <ViewMenu
          value={preferences.view}
          options={[{ value: 'calendar', label: 'Calendar' }, { value: 'table', label: 'Table' }]}
          onChange={preferences.setView}
        /> : undefined}

        columns={preferences.ready && preferences.view === 'table'
          ? <ColumnVisibilityMenu
            columns={table.columns}
            hiddenColumnKeys={preferences.table.hiddenColumns}
            onHiddenColumnKeysChange={preferences.table.setHiddenColumns}
          />
          : undefined}
        filters={preferences.ready ? <FilterCard
          categories={preferences.filters.definitions}
          values={{
            staff: preferences.filters.staffIds,
            program: preferences.filters.programIds,
            category: preferences.filters.categories,
            status: preferences.filters.statuses,
          }}
          onApply={preferences.filters.apply}
          onClearAll={preferences.filters.clear}
        /> : undefined}
      />

      {taskError && <p className="form-error" role="alert">{taskError}</p>}
      {!preferences.ready ? <p role="status">Loading saved task preferences…</p> : <PageBody
        ariaLabel="Task overview and assignments"
        dashboard={selection.selectedResource ? <TaskDashboard
          queryKey={TASK_QUERY_KEY}
          resourceId={selection.selectedResource.id}
          resourceName={selection.selectedResource.name}
          today={today}
          selectedTask={selection.selectedTask}
          onLogHours={loggableTask ? openHoursModal : undefined}
        /> : null}
        {...viewContent}
      />}
    </main>

    {canWrite && taskModalState && <TaskModal
      target={taskModalState}
      resources={pageData.writableResources}
      programs={pageData.referenceData?.programs ?? []}
      categories={pageData.referenceData?.categories ?? []}
      onSaved={actions.syncTask}
      onClose={closeTaskModal}
    />}

    {hoursModalState && loggableTask && <HoursModal
      isOpen
      initialSource="task"
      initialTask={loggableTask}
      initialResourceId={loggableTask.assignee.id}
      canCompleteTask={canWrite}
      resources={pageData.resources}
      programs={pageData.referenceData?.programs ?? []}
      categories={pageData.referenceData?.categories ?? []}
      loadTasks={getTaskDashboardData}
      onAdd={actions.logHours}
      onClose={closeHoursModal}
    />}

    <Modal
      isOpen={confirmationState !== null}
      onClose={closeConfirmation}
      title={confirmationState?.title ?? ''}
      status={confirmationModal.status}
      statusMessage={confirmationModal.statusMessage}
      footer={confirmationModal.footer}
      successDelay={confirmationModal.successDelay}
    >
      {confirmationState && <p>{confirmationState.message}</p>}
    </Modal>
  </>;
}

// Page helpers.
function getTaskError(
  actionError: string,
  preferenceError: string | null,
  referenceDataError: unknown,
) {
  return actionError
    || preferenceError
    || (referenceDataError ? 'Unable to load task reference data.' : '');
}

function getLoggableTask(task: Task | null, canWrite: boolean) {
  if (!canWrite || !task?.writable) return null;
  if (task.state !== 'open') return null;
  return task;
}
