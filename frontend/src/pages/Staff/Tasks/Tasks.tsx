import { useCallback, useEffect, useState } from 'react';

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
import useTaskData from './hooks/data/useTaskData';
import useTaskPreferences from './hooks/preferences/useTaskPreferences';
import useTaskSelection from './hooks/selection/useTaskSelection';

import { getDate } from '../../../common/utils/date';
import { getTaskDashboardData } from './tasks.api';
import {
  TASK_TABLE_KEYS,
  type AddTaskContext,
  type Task,
  type TaskModalState,
} from './types';

import './Tasks.css';

// Page-owned cache contracts.
const TASK_QUERY_KEY = ['tasks'] as const;
const TASK_TABLE_QUERY_KEY = [...TASK_QUERY_KEY, 'table'] as const;
const TASK_REFERENCE_DATA_QUERY_KEY = ['task-reference-data'] as const;
const HOURS_QUERY_KEY = ['hours'] as const;

/**
 * Coordinates task controls, selected row context, drafts, and query views.
 * @example <Tasks /> // staff task route
 */
export default function Tasks() {
  const [viewError, setViewError] = useState<PageMessageValue>(null);

  // Permissions.
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:tasks');
  const today = getDate();

  // Page data and preferences.
  const pageData = useTaskData(TASK_REFERENCE_DATA_QUERY_KEY);

  const preferences = useTaskPreferences({
    referenceData: pageData.referenceData,
    referenceDataLoading: pageData.referenceDataLoading,
    referenceDataError: Boolean(pageData.referenceDataError),
    staff: pageData.staff,
    programs: pageData.programs,
    staffLoading: pageData.staffLoading,
    staffError: Boolean(pageData.staffError),
    programsLoading: pageData.programsLoading,
    programsError: Boolean(pageData.programsError),
    tableKeys: TASK_TABLE_KEYS,
    cycles: pageData.cycles,
    cyclesLoading: pageData.cyclesLoading,
    cyclesError: Boolean(pageData.cyclesError),
  });

  // Selection and actions.
  const selection = useTaskSelection({ staff: pageData.staff });

  const actions = useTaskActions({
    taskQueryKey: TASK_QUERY_KEY,
    taskTableQueryKey: TASK_TABLE_QUERY_KEY,
    hoursQueryKey: HOURS_QUERY_KEY,
    onTaskRemoved: selection.removeSelectedTask,
    onTaskSynced: selection.onTaskSynced,
  });
  const deleteTaskAction = actions.deleteTask;

  // Hours modal.
  const [hoursModalOpen, setHoursModalOpen] = useState(false);
  const closeHoursModal = () => setHoursModalOpen(false);

  useEffect(() => {
    if (!selection.selectedTaskId) setHoursModalOpen(false);
  }, [selection.selectedTaskId]);

  // Task modal.
  const [taskModalState, setTaskModalState] = useState<TaskModalState>(null);
  const openAddTaskModal = (context: AddTaskContext) => {
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
      staff={pageData.staff}
      filters={preferences.appliedFilters}
      dateRange={preferences.dateRange}
      canWrite={canWrite}
      selectedStaffId={selection.selectedStaffId}
      selectedTaskId={selection.selectedTaskId}
      actions={{
        isTaskPending: actions.isTaskPending,
        requestDelete: openDeleteConfirmation,
        setState: actions.setState,
        setTaskRange: actions.setTaskRange,
      }}
      calendarCacheRef={actions.calendarCacheRef}
      onTaskSelect={selection.selectTask}
      onStaffSelect={selection.selectStaff}
      onAddTask={openAddTaskModal}
      onEditTask={openEditTaskModal}
      onMessageChange={setViewError}
    />
  );

  const viewUnavailable = pageData.cyclesError ? <p>Cycles unavailable.</p> : <p>No cycles available.</p>;
  const hasCycleBounds = Boolean(preferences.dateRange) && !pageData.cyclesError;

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
        pageData.referenceDataError ? {
          message: 'Unable to load task options.',
          details: 'Staff, programs, and task categories could not be loaded.',
        } : null,
        pageData.staffError ? { message: 'Unable to load task staff.' } : null,
        pageData.programsError ? { message: 'Unable to load task programs.' } : null,
        pageData.cyclesError ? {
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
      staff={pageData.writableStaff}
      programs={pageData.programs}
      categories={pageData.referenceData?.categories ?? []}
      onSaved={task => actions.syncTask(task, taskModalState.mode === 'add' ? 'create' : 'update')}
      onClose={closeTaskModal}
    />}

    {hoursModalTask && <HoursModal
      isOpen
      task={hoursModalTask}
      canCompleteTask={canWrite}
      staff={pageData.staff}
      programs={pageData.programs}
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
