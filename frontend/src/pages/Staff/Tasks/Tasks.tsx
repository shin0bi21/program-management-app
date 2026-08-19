import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../auth/authContext';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import Modal from '../../../common/components/Modal/Modal';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import { dayKey } from '../../../common/components/ResourceCalendar/periods/periods';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import type { TableColumn } from '../../../common/components/Table/Table';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import TimeEntryModal from '../../../common/features/timeEntries/components/TimeEntryModal/TimeEntryModal';
import { getTaskOptions, getTasks } from '../../../common/features/tasks/api/tasks.api';
import { TASK_CATEGORY_LABELS, type Task } from '../../../common/features/tasks/types';
import TaskCalendarView from './components/TaskCalendarView/TaskCalendarView';
import TaskDashboard from './components/TaskDashboard/TaskDashboard';
import TaskListView from './components/TaskListView/TaskListView';
import TaskManagementModal from './components/TaskManagementModal/TaskManagementModal';
import TaskStatusBadge from './components/TaskStatusBadge/TaskStatusBadge';
import { useConfirmModal } from '../../../common/components/Modal/hooks/useConfirmModal';
import useTaskControls from './hooks/useTaskControls';
import useTaskMutations from './hooks/useTaskMutations';
import type { TaskModalTarget, TaskViewMutationCache } from './types';
import {
  canCancelTask, canCompleteTask, canDeleteTask, canEditTask, canReopenTask, reopenedTaskStatus,
} from './utils/taskCapabilities';
import './Tasks.css';

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
const TASK_QUERY_KEY = ['tasks'] as const;
const TASK_LIST_QUERY_KEY = [...TASK_QUERY_KEY, 'list'] as const;
const TIME_ENTRY_QUERY_KEY = ['time-entries'] as const;

export default function Tasks() {
  // Application permissions and selected page workflows.
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:tasks');
  const [modalTarget, setModalTarget] = useState<TaskModalTarget | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskSnapshot, setSelectedTaskSnapshot] = useState<Task | null>(null);
  const [logHoursTask, setLogHoursTask] = useState<Task | null>(null);

  // The calendar owns buffered range data outside TanStack Query.
  const emptyMutationCache = useMemo<TaskViewMutationCache>(() => ({
    upsert: (_task: Task) => undefined,
    remove: (_taskId: string) => undefined,
  }), []);

  const calendarMutationRef = useRef<TaskViewMutationCache>(emptyMutationCache);
  const mutations = useTaskMutations({
    taskQueryKey: TASK_QUERY_KEY,
    taskListQueryKey: TASK_LIST_QUERY_KEY,
    timeEntryQueryKey: TIME_ENTRY_QUERY_KEY,
    onUpsert: task => {
      calendarMutationRef.current.upsert(task);
      setSelectedTaskSnapshot(current => current?.id === task.id ? task : current);
    },
    onRemove: taskId => {
      calendarMutationRef.current.remove(taskId);
      setSelectedTaskSnapshot(current => current?.id === taskId ? null : current);
    },
  });

  const confirmModal = useConfirmModal({
    action: mutations.confirmAction,
    onClose: mutations.closeConfirmation,
  });

  // Remote options, persisted controls, and selected resource data.
  const optionsQuery = useQuery({ queryKey: ['task-options'], queryFn: ({ signal }) => getTaskOptions({ signal }) });
  const controls = useTaskControls(optionsQuery.data, optionsQuery.isLoading, TASK_COLUMN_KEYS);
  const resources = optionsQuery.data?.resources ?? [];
  const writableResources = resources.filter(resource => resource.writable);
  const defaultWritableResourceId = writableResources[0]?.id;

  useEffect(() => {
    if (!selectedResourceId && defaultWritableResourceId) setSelectedResourceId(defaultWritableResourceId);
  }, [defaultWritableResourceId, selectedResourceId]);
  const selectedResource = resources.find(resource => resource.id === selectedResourceId) ?? null;

  const selectedResourceTasksQuery = useQuery({
    queryKey: [...TASK_QUERY_KEY, 'overview', selectedResourceId],
    queryFn: ({ signal }) => getTasks({ staffId: selectedResourceId! }, { signal }),
    enabled: selectedResourceId !== null,
    placeholderData: previous => previous,
  });

  const resourceTasks = selectedResourceTasksQuery.data ?? [];
  const selectedTask = resourceTasks.find(task => task.id === selectedTaskId)
    ?? (selectedTaskSnapshot?.id === selectedTaskId ? selectedTaskSnapshot : null);

  // Page actions and selection transitions.
  const openAddTask = useCallback(() => {
    const today = dayKey(new Date());
    setModalTarget({ startDate: today, dueDate: today });
  }, []);
  const selectTask = useCallback((task: Task) => {
    setSelectedResourceId(task.assignee.id);
    setSelectedTaskId(task.id);
    setSelectedTaskSnapshot(task);
  }, []);
  const selectResource = useCallback((resourceId: string) => {
    setSelectedResourceId(resourceId);
    setSelectedTaskId(null);
    setSelectedTaskSnapshot(null);
  }, []);
  const saveTask = useCallback((task: Task) => {
    if (modalTarget && 'id' in modalTarget) {
      mutations.reconcileTask(task);
      return;
    }
    mutations.addTask(task);
  }, [modalTarget, mutations]);

  // List presentation and page-level status.
  const columns = useMemo<TableColumn<Task>[]>(() => [
    { key: 'firstName', sortKey: 'firstName', header: 'First Name', width: 150, render: task => task.assignee.firstName },
    { key: 'lastName', sortKey: 'lastName', header: 'Last Name', width: 150, render: task => task.assignee.lastName },
    { key: 'title', sortKey: 'title', header: 'Task', render: task => task.title },
    { key: 'program', sortKey: 'program', header: 'Program', width: 160, render: task => task.programName ?? '—' },
    { key: 'category', sortKey: 'category', header: 'Category', width: 150, render: task => TASK_CATEGORY_LABELS[task.category] },
    { key: 'startDate', sortKey: 'startDate', header: 'Start', width: 120, render: task => task.startDate },
    { key: 'dueDate', sortKey: 'dueDate', header: 'Due', width: 120, render: task => task.dueDate },
    {
      key: 'status',
      sortKey: 'status',
      header: 'Status',
      width: 150,
      render: task => <TaskStatusBadge status={task.status} />,
    },
    ...(canWrite ? [{
      key: 'actions',
      header: '',
      width: 40,
      resizable: false,
      className: 'col-actions',
      render: (task: Task) => task.writable ? <ActionsMenu
        ariaLabel={`Actions for ${task.title}`}
        items={[
          ...(canCompleteTask(task) ? [{ id: 'complete', label: 'Set Completed', onClick: () => void mutations.setStatus(task, 'completed') }] : []),
          ...(canCancelTask(task) ? [{ id: 'cancel', label: 'Set Cancelled', onClick: () => void mutations.setStatus(task, 'cancelled') }] : []),
          ...(canReopenTask(task) ? [{ id: 'reopen', label: 'Reopen task', onClick: () => void mutations.setStatus(task, reopenedTaskStatus(task)) }] : []),
          ...(canEditTask(task) ? [{ id: 'edit', label: 'Edit', onClick: () => setModalTarget(task) }] : []),
          ...(canDeleteTask(task) ? [{ id: 'delete', label: 'Delete', variant: 'danger' as const, onClick: () => mutations.requestDelete(task) }] : []),
        ]}
      /> : null,
    }] : []),
  ], [canWrite, mutations]);

  const taskError = mutations.statusError
    || controls.error
    || (optionsQuery.error ? 'Unable to load task form options.' : '')
    || (selectedResourceTasksQuery.error ? 'Unable to load task overview.' : '');
  const logHoursAction = canWrite && selectedTask?.writable && (selectedTask.status === 'todo' || selectedTask.status === 'in_progress')
    ? () => setLogHoursTask(selectedTask)
    : undefined;

  return <>
    <main className="page-container page-container--data">
      <PageHeader
        title="Tasks"
        actions={canWrite && writableResources.length ? <Button
          disabled={optionsQuery.isLoading || Boolean(optionsQuery.error)}
          onClick={openAddTask}
        >+ Add</Button> : undefined}
        search={controls.view === 'list' ? <SearchInput
          label="Search tasks"
          value={controls.search}
          onChange={event => controls.setSearch(event.target.value)}
          placeholder="Search tasks"
        /> : undefined}
        view={<ViewMenu
          value={controls.view}
          options={[{ value: 'calendar', label: 'Calendar' }, { value: 'list', label: 'List' }]}
          onChange={controls.changeView}
        />}
        columns={controls.view === 'list'
          ? <ColumnVisibilityMenu columns={columns} hiddenColumnKeys={controls.hiddenColumns} onHiddenColumnKeysChange={controls.changeHiddenColumns} />
          : undefined}
        filters={<FilterCard
          categories={controls.filterCategories}
          values={{ staff: controls.staffIds, program: controls.programIds, category: controls.categories, status: controls.statusFilters }}
          onApply={controls.applyFilter}
          onClearAll={controls.clearFilters}
        />}
      />
      {taskError && <p className="form-error" role="alert">{taskError}</p>}
      {controls.ready && <PageBody
        ariaLabel="Task overview and assignments"
        dashboard={selectedResource ? <TaskDashboard
          tasks={resourceTasks}
          resourceName={selectedResource.name}
          selectedTask={selectedTask}
          onLogHours={logHoursAction}
        /> : null}
        {...(controls.view === 'list' ? { table: <TaskListView
          queryKey={TASK_LIST_QUERY_KEY}
          columns={columns}
          hiddenColumnKeys={controls.hiddenColumns}
          staffIds={controls.staffIds}
          programIds={controls.programIds}
          categories={controls.categories}
          statuses={controls.statusFilters}
          search={controls.search}
          sorting={controls.sorting}
          columnWidths={controls.columnWidths}
          selectedTaskId={selectedTaskId}
          onTaskSelect={selectTask}
          onSortingChange={controls.changeSorting}
          onColumnWidthsChange={controls.changeColumnWidths}
        /> } : { calendar: <TaskCalendarView
          resources={resources}
          filters={{ staffIds: controls.staffIds, programIds: controls.programIds, categories: controls.categories, statuses: controls.statusFilters }}
          canWrite={canWrite}
          selectedResourceId={selectedResourceId}
          selectedTaskId={selectedTaskId}
          mutations={mutations}
          mutationCacheRef={calendarMutationRef}
          onTaskSelect={selectTask}
          onResourceSelect={selectResource}
          onModalTargetChange={setModalTarget}
        /> })}
      />}
    </main>

    {canWrite && modalTarget && <TaskManagementModal
      isOpen
      task={'id' in modalTarget ? modalTarget : undefined}
      initialStartDate={'id' in modalTarget ? undefined : modalTarget.startDate}
      initialDueDate={'id' in modalTarget ? undefined : modalTarget.dueDate}
      fixedStaffId={'id' in modalTarget ? undefined : modalTarget.fixedStaffId}
      resources={writableResources}
      programs={optionsQuery.data?.programs ?? []}
      onSaved={saveTask}
      onClose={() => setModalTarget(null)}
    />}

    {logHoursTask && <TimeEntryModal
      isOpen
      initialSource="task"
      initialTask={logHoursTask}
      initialResourceId={logHoursTask.assignee.id}
      resources={resources}
      programs={optionsQuery.data?.programs ?? []}
      onAdd={mutations.logHours}
      onClose={() => setLogHoursTask(null)}
    />}

    <Modal
      isOpen={mutations.confirmAction !== null}
      onClose={mutations.closeConfirmation}
      title={mutations.confirmAction?.title ?? ''}
      status={confirmModal.status}
      statusMessage={confirmModal.statusMessage}
      footer={confirmModal.footer}
      successDelay={confirmModal.successDelay}
    >
      {mutations.confirmAction && <p>{mutations.confirmAction.message}</p>}
    </Modal>
  </>;
}
