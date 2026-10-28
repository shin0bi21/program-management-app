import useDateRangePresets from '../../../common/features/programming/cycles/useDateRangePresets';
import { useCallback, useMemo, useState } from 'react';

import Button from '../../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import { type ConfirmAction } from '../../../common/components/ConfirmModal/types';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageErrorOverlay, { type PageErrorItem } from '../../../common/components/PageErrorOverlay/PageErrorOverlay';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import HoursModal from '../Hours/components/HoursModal/HoursModal';
import TaskCalendar from './components/TaskCalendar/TaskCalendar';
import TaskDashboard from './components/TaskDashboard/TaskDashboard';
import TaskTable from './components/TaskTable/TaskTable';
import TaskModal from './components/TaskModal/TaskModal';

import { useAuth } from '../../../auth/authContext';
import useTaskTable from './components/TaskTable/hooks/useTaskTable';
import useTaskActions from './hooks/actions/useTaskActions';
import useTaskData from './hooks/data/useTaskData';
import useTaskPreferences from './hooks/preferences/useTaskPreferences';
import useTaskSelection from './hooks/selection/useTaskSelection';

import { getDateKeyInTimeZone } from '../../../common/utils/date';
import { getTaskDashboardData } from './tasks.api';
import {
  TASK_TABLE_KEYS,
  type AddTaskModalInitialValues,
  type Task,
  type TaskModalState,
  type TasksFilters,
} from './types';

import './Tasks.css';

// Page-owned cache contracts.
const TASK_QUERY_KEY = ['tasks'] as const;
const TASK_TABLE_QUERY_KEY = [...TASK_QUERY_KEY, 'table'] as const;
const TASK_REFERENCE_DATA_QUERY_KEY = ['task-reference-data'] as const;
const HOURS_QUERY_KEY = ['hours'] as const;

export default function Tasks() {
  const [viewError, setViewError] = useState<PageErrorItem | null>(null);
  const dateRangePresets = useDateRangePresets();
  const [dashboardError, setDashboardError] = useState<PageErrorItem | null>(null);

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

  // Filter configuration.
  const taskFilters = useMemo<TasksFilters>(() => ({
    dateRange: preferences.filters.dateRange,
    search: preferences.search.appliedValue,
    staffIds: preferences.filters.staffIds,
    programIds: preferences.filters.programIds,
    categories: preferences.filters.categories,
    statuses: preferences.filters.statuses,
  }), [
    preferences.filters.dateRange,
    preferences.filters.categories,
    preferences.filters.programIds,
    preferences.filters.staffIds,
    preferences.filters.statuses,
    preferences.search.appliedValue,
  ]);

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
  const [hoursModalTask, setHoursModalTask] = useState<Task | null>(null);
  const openHoursModal = (task: Task) => setHoursModalTask(task);
  const closeHoursModal = () => setHoursModalTask(null);

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

  // View configuration.
  const loggableTask = getLoggableTask(selection.selectedTask, canWrite);

  const taskTable = (
    <TaskTable
      queryKey={TASK_TABLE_QUERY_KEY}
      columns={table.columns}
      hiddenColumnKeys={preferences.table.hiddenColumns}
      filters={taskFilters}
      today={today}
      sorting={preferences.table.sorting}
      columnWidths={preferences.table.columnWidths}
      selectedTaskId={selection.selectedTaskId}
      onTaskSelect={selection.selectTask}
      onSortingChange={preferences.table.setSorting}
      onColumnWidthsChange={preferences.table.setColumnWidths}
      onErrorChange={setViewError}
    />
  );

  const taskCalendar = (
    <TaskCalendar
      key={JSON.stringify(taskFilters)}
      resources={pageData.resources}
      filters={taskFilters}
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
      onErrorChange={setViewError}
    />
  );

  const viewContent = preferences.view === 'table'
    ? { table: taskTable }
    : { calendar: taskCalendar };

  // Render.
  return <>
    <main className="page-container">
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
          dateRange={{ presets: dateRangePresets, value: preferences.filters.dateRange, onApply: preferences.filters.setDateRange }}
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

      <PageErrorOverlay errors={[
        actions.actionError,
        preferences.error,
        pageData.referenceDataError ? {
          message: 'Unable to load task options.',
          details: 'Staff, programs, and task categories could not be loaded.',
        } : null,
        viewError,
        dashboardError,
      ]} />
      {!preferences.ready ? <p role="status">Loading saved task preferences…</p> : <PageBody
        ariaLabel="Task overview and assignments"
        dashboard={selection.selectedResource ? <TaskDashboard
          queryKey={TASK_QUERY_KEY}
          resourceId={selection.selectedResource.id}
          resourceName={selection.selectedResource.name}
          today={today}
          selectedTask={selection.selectedTask}
          onLogHours={loggableTask ? () => openHoursModal(loggableTask) : undefined}
          onErrorChange={setDashboardError}
        /> : null}
        {...viewContent}
      />}
    </main>

    {canWrite && taskModalState && <TaskModal
      target={taskModalState}
      resources={pageData.writableResources}
      programs={pageData.referenceData?.programs ?? []}
      categories={pageData.referenceData?.categories ?? []}
      onSaved={task => actions.syncTask(task, taskModalState.mode === 'add')}
      onClose={closeTaskModal}
    />}

    {hoursModalTask && <HoursModal
      isOpen
      initialSource="task"
      initialTask={hoursModalTask}
      initialResourceId={hoursModalTask.assignee.id}
      canCompleteTask={canWrite}
      resources={pageData.resources}
      programs={pageData.referenceData?.programs ?? []}
      categories={pageData.referenceData?.categories ?? []}
      loadTasks={getTaskDashboardData}
      onAdd={actions.logHours}
      onClose={closeHoursModal}
    />}

    <ConfirmModal
      action={confirmationState}
      onClose={closeConfirmation}
    />
  </>;
}

function getLoggableTask(task: Task | null, canWrite: boolean) {
  if (!canWrite || !task?.writable) return null;
  if (task.state !== 'open') return null;
  return task;
}
