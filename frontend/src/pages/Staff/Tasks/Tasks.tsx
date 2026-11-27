import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';

import PageContainer from '../../../common/components/PageContainer/PageContainer';
import Button from '../../../common/components/Button/Button';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import { type ConfirmAction } from '../../../common/components/ConfirmModal/types';
import { type PageMessageValue } from '../../../common/components/PageMessageOverlay/PageMessageOverlay';
import HoursModal from '../Hours/components/HoursModal/HoursModal';
import TaskCalendar from './components/TaskCalendar/TaskCalendar';
import TaskOverviewDashboardCard from './components/TaskDashboard/TaskOverviewDashboardCard/TaskOverviewDashboardCard';
import TaskHoursLoggedDashboardCard from './components/TaskDashboard/TaskHoursLoggedDashboardCard/TaskHoursLoggedDashboardCard';
import TaskTable from './components/TaskTable/TaskTable';
import TaskModal from './components/TaskModal/TaskModal';

import { useAuth } from '../../../auth/authContext';
import useTaskTable from './components/TaskTable/hooks/useTaskTable';
import useTaskActions from './hooks/actions/useTaskActions';
import useTaskReferenceData from './hooks/data/useTaskReferenceData';
import useTaskPreferences from './hooks/preferences/useTaskPreferences';
import useTaskSelection from './hooks/selection/useTaskSelection';

import { getDate } from '../../../common/utils/date';
import { getOpenTasks } from './api/tasks.api';
import {
  TASK_TABLE_KEYS,
  type AddTaskFormContext,
  type Task,
  type TaskActions,
  type TaskCalendarCache,
  type TaskModalState,
} from './types';

// Page-owned cache contracts.
const TASK_QUERY_KEY = ['tasks'] as const;
const TASK_TABLE_QUERY_KEY = [...TASK_QUERY_KEY, 'table'] as const;
const HOURS_QUERY_KEY = ['hours'] as const;

/**
 * Coordinates task controls, selected row context, drafts, and query views.
 * @example <Tasks /> // staff task route
 */
export default function Tasks(): ReactElement {
  const [viewError, setViewError] = useState<PageMessageValue>(null);

  // Permissions.
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:tasks');
  const today = getDate();

  // Reference data and preferences.
  const referenceData = useTaskReferenceData();
  const { staff, programs, cycles, taskOptions } = referenceData;
  const staffRows = staff.data ?? [];
  const categories = taskOptions.data?.categories ?? [];
  const writableStaff = useMemo(
    () => (staff.data ?? []).filter(staffMember => staffMember.writable),
    [staff.data],
  );
  const preferences = useTaskPreferences(referenceData, TASK_TABLE_KEYS);

  // Selection and actions.
  const selection = useTaskSelection({ staff: staffRows });
  const calendarCacheRef = useRef<TaskCalendarCache | null>(null);
  const { onTaskSynced, removeSelectedTask } = selection;

  const syncTaskViews = useCallback((task: Task) => {
    onTaskSynced(task);
    calendarCacheRef.current?.upsert(task);
  }, [onTaskSynced]);

  const removeTaskFromViews = useCallback((taskId: Task['id']) => {
    calendarCacheRef.current?.remove(taskId);
    removeSelectedTask(taskId);
  }, [removeSelectedTask]);

  const actions = useTaskActions({
    taskQueryKey: TASK_QUERY_KEY,
    taskTableQueryKey: TASK_TABLE_QUERY_KEY,
    hoursQueryKey: HOURS_QUERY_KEY,
    onTaskRemoved: removeTaskFromViews,
    onTaskSynced: syncTaskViews,
  });
  const { deleteTask: deleteTaskAction, isTaskPending, setState, setTaskRange } = actions;

  // Hours modal.
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const closeHoursModal = () => setHoursModalOpen(false);

  useEffect(() => {
    if (!selection.selectedTaskId) setHoursModalOpen(false);
  }, [selection.selectedTaskId]);

  // Task modal.
  const [taskModalState, setTaskModalState] = useState<TaskModalState>(null);
  const openAddTaskModal = (context: AddTaskFormContext) => {
    setTaskModalState({ mode: 'add', context });
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
    confirmVariant: 'danger',
    successMessage: 'Task deleted',
    onConfirm: () => deleteTaskAction(task),
  }), [deleteTaskAction]);

  const closeConfirmation = () => setConfirmationState(null);

  const taskActions = useMemo<TaskActions>(() => ({
    isTaskPending,
    setState,
    setTaskRange,
    edit: openEditTaskModal,
    requestDelete: openDeleteConfirmation,
  }), [isTaskPending, openDeleteConfirmation, openEditTaskModal, setState, setTaskRange]);
  const table = useTaskTable({ canWrite, actions: taskActions });

  // View configuration.
  const hoursModalTask = hoursModalOpen ? selection.selectedTask : null;

  const taskTable = (
    <TaskTable
      queryKey={TASK_TABLE_QUERY_KEY}
      columns={table.columns}
      hiddenColumnKeys={preferences.table.hiddenColumns}
      filters={preferences.appliedFilters}
      today={today}
      sorting={preferences.table.sorting}
      columnWidths={preferences.table.columnWidths}
      selectedTaskId={selection.selectedTaskId}
      onTaskSelect={selection.selectTask}
      onSortingChange={preferences.table.setSorting}
      onColumnWidthsChange={preferences.table.setColumnWidths}
      onMessageChange={setViewError}
    />
  );

  const taskCalendar = (
    <TaskCalendar
      key={JSON.stringify(preferences.appliedFilters)}
      staff={staffRows}
      filters={preferences.appliedFilters}
      dateRange={preferences.dateRange}
      canWrite={canWrite}
      selectedStaffId={selection.selectedStaffId}
      selectedTaskId={selection.selectedTaskId}
      actions={taskActions}
      calendarCacheRef={calendarCacheRef}
      onTaskSelect={selection.selectTask}
      onStaffSelect={selection.selectStaff}
      onAddTask={openAddTaskModal}
      onMessageChange={setViewError}
    />
  );

  const viewUnavailable = cycles.error ? <p>Cycles unavailable.</p> : <p>No cycles available.</p>;
  const hasCycleBounds = Boolean(preferences.dateRange) && !cycles.error;

  // Render.
  return <>
    <PageContainer
      title="Tasks"
      ariaLabel="Task overview and assignments"
      controls={preferences}
      loadingLabel="Loading saved task preferences…"

      actions={canWrite ? <Button
        onClick={() => {
          openAddTaskModal({});
        }}
      >+ Add</Button> : undefined}

      search={{ label: 'Search tasks', placeholder: 'Search tasks' }}
      columns={table.columns}
      messages={[
        actions.actionError,
        preferences.error,
        taskOptions.error ? {
          message: 'Unable to load task options.',
          details: 'Staff, programs, and task categories could not be loaded.',
        } : null,
        staff.error ? { message: 'Unable to load task staff.' } : null,
        programs.error ? { message: 'Unable to load task programs.' } : null,
        cycles.error ? {
          message: 'Unable to load cycles.',
          details: 'Cycle date bounds could not be loaded.',
        } : null,
        viewError,
      ]}
      dashboard={<>
        <TaskOverviewDashboardCard
          queryKey={TASK_QUERY_KEY}
          staff={selection.selectedStaff}
        />
        <TaskHoursLoggedDashboardCard
          task={selection.selectedTask}
          canWrite={canWrite}
          onLogHours={() => setHoursModalOpen(true)}
        />
      </>}
      table={hasCycleBounds ? taskTable : viewUnavailable}
      calendar={hasCycleBounds ? taskCalendar : viewUnavailable}
    />

    {canWrite && taskModalState && <TaskModal
      key={taskModalState.mode === 'edit' ? taskModalState.task.id : 'new'}
      target={taskModalState}
      staff={writableStaff}
      programs={programs.data ?? []}
      categories={categories}
      onSaved={task => actions.syncTask(task, taskModalState.mode === 'add' ? 'create' : 'update')}
      onClose={closeTaskModal}
    />}

    {hoursModalTask && <HoursModal
      isOpen
      task={hoursModalTask}
      canCompleteTask={canWrite}
      staff={staffRows}
      programs={programs.data ?? []}
      categories={categories}
      loadTasks={getOpenTasks}
      onAdd={actions.logHours}
      onClose={closeHoursModal}
    />}

    <ConfirmModal
      action={confirmationState}
      onClose={closeConfirmation}
    />
  </>;
}
