import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import FloatingSelect from '../../../common/components/FloatingSelect/FloatingSelect';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import Table, { type TableColumn } from '../../../common/components/Table/Table';
import ResourceCalendar from '../../../common/components/ResourceCalendar/ResourceCalendar';
import PageBody from '../../../common/components/PageBody/PageBody';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import { getTaskOptions, getTasks } from '../../../common/features/tasks/api/tasks.api';
import { dayKey } from '../../../common/components/ResourceCalendar/periods';
import { TASK_CATEGORY_LABELS, TASK_STATUS_LABELS, type Task, type TaskStatus } from '../../../common/features/tasks/types';
import { useAuth } from '../../../auth/authContext';
import TaskItem from './components/TaskItem/TaskItem';
import TaskHoursLoggedCard from './components/TaskHoursLoggedCard/TaskHoursLoggedCard';
import TaskOverviewCard from './components/TaskOverviewCard/TaskOverviewCard';
import { canMoveTaskToResource, getTaskCalendarCapabilities } from './taskCalendarCapabilities';
import useTaskViewData from './hooks/useTaskViewData';
import useTaskControls from './hooks/useTaskControls';
import useTaskMutations, { TASKS_QUERY_KEY } from './hooks/useTaskMutations';
import TaskDialogs, { type TaskModalTarget } from './components/TaskDialogs/TaskDialogs';

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'todo', label: 'To do' }, { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' },
];
const TASK_CALENDAR_POSITION_KEY = 'resource-calendar:tasks:position';

function getStatusOptions(task: Task) {
  if (task.status !== 'in_progress') return STATUS_OPTIONS;
  return STATUS_OPTIONS.filter(option => option.value !== 'cancelled');
}

function TaskStatusCell({ task, canWrite, onChange }: {
  task: Task;
  canWrite: boolean;
  onChange: (task: Task, status: TaskStatus) => void;
}) {
  if (!canWrite || !task.writable) return TASK_STATUS_LABELS[task.status];
  return <FloatingSelect
    id={`task-status-${task.id}`}
    value={task.status}
    options={getStatusOptions(task)}
    onChange={value => onChange(task, value as TaskStatus)}
    ariaLabel={`Status for ${task.title}`}
  />;
}

export default function Tasks() {
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:tasks');
  const [modalTarget, setModalTarget] = useState<TaskModalTarget | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [logHoursTask, setLogHoursTask] = useState<Task | null>(null);
  const mutations = useTaskMutations();
  const tasksQuery = useQuery({ queryKey: TASKS_QUERY_KEY, queryFn: ({ signal }) => getTasks({ includeClosed: true }, { signal }) });
  const optionsQuery = useQuery({ queryKey: ['task-options'], queryFn: ({ signal }) => getTaskOptions({ signal }) });
  const controls = useTaskControls(optionsQuery.data, optionsQuery.isLoading);
  const resources = useMemo(() => optionsQuery.data?.resources ?? [], [optionsQuery.data?.resources]);
  const writableResources = useMemo(() => resources.filter(resource => resource.writable), [resources]);
  useEffect(() => {
    if (!selectedResourceId && writableResources.length) setSelectedResourceId(writableResources[0].id);
  }, [selectedResourceId, writableResources]);
  const taskFilters = useMemo(() => ({
    search: controls.view === 'list' ? controls.search : '',
    programIds: controls.programIds,
    cycleIds: controls.cycleIds,
    categories: controls.categories,
    statuses: controls.statusFilters,
  }), [controls.categories, controls.cycleIds, controls.programIds, controls.search, controls.statusFilters, controls.view]);
  const { rows, rangeData, dashboardTasks, resourceTasks } = useTaskViewData(
    tasksQuery.data ?? [], resources, taskFilters, selectedResourceId,
  );
  const selectedResource = resources.find(resource => resource.id === selectedResourceId) ?? null;
  const selectedTask = dashboardTasks.find(task => task.id === selectedTaskId) ?? null;
  const openAddTask = useCallback(() => {
    const today = dayKey(new Date());
    setModalTarget({ startDate: today, dueDate: today });
  }, []);
  const selectTask = useCallback((task: Task) => {
    setSelectedResourceId(task.assignee.id);
    setSelectedTaskId(task.id);
  }, []);
  const selectResource = useCallback((resourceId: string) => {
    setSelectedResourceId(resourceId);
    setSelectedTaskId(null);
  }, []);
  const saveTask = useCallback((task: Task) => {
    if (modalTarget && 'id' in modalTarget) {
      mutations.reconcileTask(task);
      return;
    }
    mutations.addTask(task);
  }, [modalTarget, mutations]);
  const columns = useMemo<TableColumn<Task>[]>(() => [
    { key: 'firstName', header: 'First Name', width: 150, render: task => task.assignee.firstName },
    { key: 'lastName', header: 'Last Name', width: 150, render: task => task.assignee.lastName },
    { key: 'title', header: 'Task', render: task => task.title },
    { key: 'category', header: 'Category', width: 150, render: task => TASK_CATEGORY_LABELS[task.category] },
    { key: 'program', header: 'Program', width: 160, render: task => task.programName ?? 'General' },
    { key: 'cycle', header: 'Cycle', width: 160, render: task => task.cycleName },
    { key: 'startDate', header: 'Start', width: 120, render: task => task.startDate },
    { key: 'dueDate', header: 'Due', width: 120, render: task => task.dueDate },
    {
      key: 'status',
      header: 'Status',
      width: 150,
      render: task => <TaskStatusCell task={task} canWrite={canWrite} onChange={(item, status) => void mutations.setStatus(item, status)} />,
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
          { id: 'edit', label: 'Edit', onClick: () => setModalTarget(task) },
          { id: 'delete', label: 'Delete', variant: 'danger' as const, onClick: () => mutations.requestDelete(task) },
        ]}
      /> : null,
    }] : []),
  ], [canWrite, mutations]);

  const taskError = mutations.statusError
    || controls.error
    || (optionsQuery.error ? 'Unable to load task form options.' : '')
    || (tasksQuery.error ? 'Unable to load tasks.' : '');
  const hasFilters = controls.programIds.length > 0 || controls.cycleIds.length > 0
    || controls.categories.length > 0 || controls.statusFilters.length > 0;
  const logHoursAction = canWrite && selectedTask?.writable && selectedTask.status !== 'cancelled'
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
        filters={<FilterCard
          categories={controls.filterCategories}
          values={{ program: controls.programIds, cycle: controls.cycleIds, category: controls.categories, status: controls.statusFilters }}
          onApply={controls.applyFilter}
          onClearAll={controls.clearFilters}
        />}
      />
      {taskError && <p className="form-error" role="alert">{taskError}</p>}
      {controls.ready && <PageBody
        ariaLabel="Task overview and assignments"
        dashboard={selectedResource ? <>
          <TaskOverviewCard tasks={resourceTasks} resourceName={selectedResource.name} />
          <TaskHoursLoggedCard task={selectedTask} onLogHours={logHoursAction} />
        </> : null}
        {...(controls.view === 'list' ? { table: <Table
          ariaLabel="Tasks"
          columns={columns}
          data={rows}
          loading={tasksQuery.isLoading}
          error={tasksQuery.error ? 'Unable to load tasks.' : undefined}
          emptyMessage={controls.search.trim() || hasFilters ? 'No tasks match these filters' : 'No tasks assigned'}
          keyExtractor={task => task.id}
          selectedKey={selectedTaskId}
          onRowSelect={selectTask}
          columnWidths={controls.columnWidths}
          onColumnWidthsChange={controls.changeColumnWidths}
        /> } : { calendar: tasksQuery.isLoading ? <p>Loading tasks…</p> : !tasksQuery.error ? <ResourceCalendar
          resources={resources}
          data={{}}
          rangeData={rangeData}
          getResourceId={resource => resource.id}
          getItemId={task => task.id}
          getItemRange={task => ({ start: task.startDate, end: task.dueDate })}
          getItemCapabilities={({ data: task, range }) => range
            ? getTaskCalendarCapabilities(task, canWrite && task.writable)
            : { draggable: canWrite && task.writable }}
          renderResource={({ resource }) => resource.name}
          selectedResourceId={selectedResourceId}
          onResourceSelect={resource => selectResource(resource.id)}
          buildItem={() => null}
          buildRangeItem={({ data: task }) => <TaskItem
            task={task}
            onActivate={() => selectTask(task)}
            onEdit={canWrite && task.writable ? () => setModalTarget(task) : undefined}
            onDelete={canWrite && task.writable ? () => mutations.requestDelete(task) : undefined}
          />}
          onCellActivate={canWrite ? ({ resource, period }) => {
            if (!resource.writable) return;
            setModalTarget({ startDate: period.key, dueDate: period.key, fixedStaffId: resource.id });
          } : undefined}
          onRangeResize={canWrite
            ? ({ item: task, nextRange }) => mutations.setTaskRange(task, nextRange, 'resize')
            : undefined}
          canRangeMove={({ item: task, resource, destinationResource }) => (
            task.writable
            && destinationResource.writable
            && canMoveTaskToResource(task, resource.id, destinationResource.id)
          )}
          onRangeMove={canWrite
            ? ({ item: task, nextRange, destinationResource }) => (
              mutations.setTaskRange(task, nextRange, 'move', destinationResource.id)
            )
            : undefined}
          ariaLabel="Task calendar"
          positionStorageKey={TASK_CALENDAR_POSITION_KEY}
          resourceHeader="Staff"
          rowHeight={112}
        /> : null })}
      />}
    </main>
    <TaskDialogs
      canWrite={canWrite}
      modalTarget={modalTarget}
      logHoursTask={logHoursTask}
      confirmAction={mutations.confirmAction}
      resources={resources}
      writableResources={writableResources}
      programs={optionsQuery.data?.programs ?? []}
      cycles={optionsQuery.data?.cycles ?? []}
      onTaskSaved={saveTask}
      onCloseTask={() => setModalTarget(null)}
      onLogHours={mutations.logHours}
      onCloseLogHours={() => setLogHoursTask(null)}
      onCloseConfirmation={mutations.closeConfirmation}
    />
  </>;
}
