import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../common/components/Button/Button';
import FilterCard, { type FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import FloatingSelect from '../../../common/components/FloatingSelect/FloatingSelect';
import Modal from '../../../common/components/Modal/Modal';
import { useConfirmModal, type ConfirmAction } from '../../../common/components/Modal/hooks/useConfirmModal';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import Table, { type TableColumn } from '../../../common/components/Table/Table';
import ResourceCalendar from '../../../common/components/ResourceCalendar/ResourceCalendar';
import PageBody from '../../../common/components/PageBody/PageBody';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import useUserPreference from '../../../common/features/preferences/hooks/useUserPreference';
import { deleteTask, getTaskOptions, getTasks, updateTaskPlacement, updateTaskStatus } from '../../../common/features/tasks/api/tasks.api';
import { dayKey } from '../../../common/components/ResourceCalendar/periods';
import { TASK_CATEGORY_LABELS, TASK_CATEGORY_OPTIONS, TASK_STATUS_LABELS, type Task, type TaskCategory, type TaskStatus } from '../../../common/features/tasks/types';
import { useAuth } from '../../../auth/authContext';
import TaskManagementModal from './components/TaskManagementModal/TaskManagementModal';
import TaskItem from './components/TaskItem/TaskItem';
import TaskHoursLoggedCard from './components/TaskHoursLoggedCard/TaskHoursLoggedCard';
import TaskOverviewCard from './components/TaskOverviewCard/TaskOverviewCard';
import TimeEntryModal from '../../../common/features/timeEntries/components/TimeEntryModal/TimeEntryModal';
import { createTimeEntry, type SetTimeEntryInput } from '../../../common/features/timeEntries/api/timeEntries.api';
import { canMoveTaskToResource, getTaskCalendarCapabilities } from './taskCalendarCapabilities';
import useTaskViewData from './hooks/useTaskViewData';

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'todo', label: 'To do' }, { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' },
];
const TASKS_QUERY_KEY = ['tasks'] as const;
const TASK_CALENDAR_POSITION_KEY = 'resource-calendar:tasks:position';
type TaskModalTarget = Task | { startDate: string; dueDate: string; fixedStaffId?: string };

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
  const queryClient = useQueryClient();
  const canWrite = permissions.includes('write:tasks');
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [search, setSearch] = useState('');
  const [programIds, setProgramIds] = useState<string[]>([]);
  const [cycleIds, setCycleIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [statusFilters, setStatusFilters] = useState<TaskStatus[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [modalTarget, setModalTarget] = useState<TaskModalTarget | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [statusError, setStatusError] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [logHoursTask, setLogHoursTask] = useState<Task | null>(null);
  const { preference, loading: preferenceLoading, error: preferenceError, save } = useUserPreference('task-filters');
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });
  const tasksQuery = useQuery({ queryKey: TASKS_QUERY_KEY, queryFn: ({ signal }) => getTasks({ includeClosed: true }, { signal }) });
  const optionsQuery = useQuery({ queryKey: ['task-options'], queryFn: ({ signal }) => getTaskOptions({ signal }) });

  useEffect(() => {
    if (preferencesReady || preferenceLoading || optionsQuery.isLoading) return;
    setProgramIds(preference?.programIds ?? []);
    setView(preference?.view ?? 'calendar');
    setCycleIds(preference?.cycleIds ?? []);
    setCategories(preference?.categories ?? []);
    setStatusFilters(preference?.statuses ?? []);
    setColumnWidths(preference?.columnWidths ?? {});
    setPreferencesReady(true);
  }, [optionsQuery.isLoading, preference, preferenceLoading, preferencesReady]);

  const persist = useCallback((nextPrograms: string[], nextCycles: string[], nextCategories: TaskCategory[], nextStatuses: TaskStatus[], widths = columnWidths) => {
    void save({ view, programIds: nextPrograms, cycleIds: nextCycles, categories: nextCategories, statuses: nextStatuses, columnWidths: widths });
  }, [columnWidths, save, view]);
  const availableFilterCycles = useMemo(() => (optionsQuery.data?.cycles ?? []).filter(
    cycle => !programIds.length || programIds.includes(cycle.programId),
  ), [optionsQuery.data?.cycles, programIds]);
  useEffect(() => {
    if (!preferencesReady) return;
    const availableIds = new Set(availableFilterCycles.map(cycle => cycle.id));
    const nextCycles = cycleIds.filter(id => availableIds.has(id));
    if (nextCycles.length !== cycleIds.length) {
      setCycleIds(nextCycles);
      persist(programIds, nextCycles, categories, statusFilters);
    }
  }, [availableFilterCycles, categories, cycleIds, persist, preferencesReady, programIds, statusFilters]);
  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    { id: 'program', label: 'Program', options: (optionsQuery.data?.programs ?? []).map(item => ({ value: item.id, label: item.name })) },
    { id: 'cycle', label: 'Cycle', options: availableFilterCycles.map(item => ({ value: item.id, label: item.name })) },
    { id: 'category', label: 'Category', options: TASK_CATEGORY_OPTIONS },
    { id: 'status', label: 'Status', options: STATUS_OPTIONS },
  ], [availableFilterCycles, optionsQuery.data?.programs]);
  const resources = useMemo(() => optionsQuery.data?.resources ?? [], [optionsQuery.data?.resources]);
  const writableResources = useMemo(() => resources.filter(resource => resource.writable), [resources]);
  useEffect(() => {
    if (!selectedResourceId && writableResources.length) setSelectedResourceId(writableResources[0].id);
  }, [selectedResourceId, writableResources]);
  const taskFilters = useMemo(() => ({ search, programIds, cycleIds, categories, statuses: statusFilters }), [categories, cycleIds, programIds, search, statusFilters]);
  const { rows, rangeData, dashboardTasks, resourceTasks } = useTaskViewData(
    tasksQuery.data ?? [], resources, taskFilters, selectedResourceId,
  );
  const selectedResource = resources.find(resource => resource.id === selectedResourceId) ?? null;
  const selectedTask = dashboardTasks.find(task => task.id === selectedTaskId) ?? null;
  const logTaskHours = async (input: SetTimeEntryInput) => {
    await createTimeEntry(input);
    await queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
  };

  const replaceTask = useCallback((task: Task) => queryClient.setQueryData<Task[]>(TASKS_QUERY_KEY, current => current?.map(item => item.id === task.id ? task : item) ?? [task]), [queryClient]);
  const setTaskRange = useCallback(async (task: Task, nextRange: { start: string; end: string }, action: 'move' | 'resize', staffId = task.assignee.id) => {
    setStatusError('');
    try {
      replaceTask(await updateTaskPlacement(task.id, {
        startDate: nextRange.start, dueDate: nextRange.end,
        ...(staffId !== task.assignee.id ? { staffId } : {}),
      }));
    } catch { setStatusError(`Unable to ${action} task.`); }
  }, [replaceTask]);
  const setStatus = useCallback(async (task: Task, status: TaskStatus) => {
    setStatusError('');
    try { replaceTask(await updateTaskStatus(task.id, status)); }
    catch { setStatusError('Unable to update task status.'); }
  }, [replaceTask]);
  const requestDelete = useCallback((task: Task) => setConfirmAction({
    title: 'Delete task', message: `Delete “${task.title}”? Tasks with logged time cannot be deleted.`,
    confirmLabel: 'Delete', confirmVariant: 'danger', successMessage: 'Task deleted',
    onConfirm: async () => { await deleteTask(task.id); queryClient.setQueryData<Task[]>(TASKS_QUERY_KEY, current => current?.filter(item => item.id !== task.id) ?? []); },
  }), [queryClient]);
  const applyFilter = useCallback((id: string, selected: string[]) => {
    let nextPrograms = programIds;
    let nextCycles = cycleIds;
    let nextCategories = categories;
    let nextStatuses = statusFilters;

    if (id === 'program') nextPrograms = selected;
    if (id === 'cycle') nextCycles = selected;
    if (id === 'category') nextCategories = selected as TaskCategory[];
    if (id === 'status') nextStatuses = selected as TaskStatus[];

    setProgramIds(nextPrograms);
    setCycleIds(nextCycles);
    setCategories(nextCategories);
    setStatusFilters(nextStatuses);
    persist(nextPrograms, nextCycles, nextCategories, nextStatuses);
  }, [categories, cycleIds, persist, programIds, statusFilters]);
  const clearFilters = useCallback(() => {
    setProgramIds([]);
    setCycleIds([]);
    setCategories([]);
    setStatusFilters([]);
    persist([], [], [], []);
  }, [persist]);
  const changeView = useCallback((nextView: 'calendar' | 'list') => {
    setView(nextView);
    void save({
      view: nextView,
      programIds,
      cycleIds,
      categories,
      statuses: statusFilters,
      columnWidths,
    });
  }, [categories, columnWidths, cycleIds, programIds, save, statusFilters]);
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
      replaceTask(task);
      return;
    }
    queryClient.setQueryData<Task[]>(TASKS_QUERY_KEY, current => [...(current ?? []), task]);
  }, [modalTarget, queryClient, replaceTask]);
  const columns = useMemo<TableColumn<Task>[]>(() => [
    { key: 'assignee', header: 'Staff', width: 190, render: task => task.assignee.name },
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
      render: task => <TaskStatusCell task={task} canWrite={canWrite} onChange={(item, status) => void setStatus(item, status)} />,
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
          { id: 'delete', label: 'Delete', variant: 'danger' as const, onClick: () => requestDelete(task) },
        ]}
      /> : null,
    }] : []),
  ], [canWrite, requestDelete, setStatus]);

  const taskError = statusError
    || preferenceError
    || (optionsQuery.error ? 'Unable to load task form options.' : '')
    || (tasksQuery.error ? 'Unable to load tasks.' : '');
  const hasFilters = programIds.length > 0 || cycleIds.length > 0 || categories.length > 0 || statusFilters.length > 0;
  const editingTask = modalTarget && 'id' in modalTarget ? modalTarget : undefined;
  const newTaskTarget = modalTarget && !('id' in modalTarget) ? modalTarget : undefined;
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
        search={<SearchInput
          label="Search tasks"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search tasks"
        />}
        view={<ViewMenu
          value={view}
          options={[{ value: 'calendar', label: 'Calendar' }, { value: 'list', label: 'List' }]}
          onChange={changeView}
        />}
        filters={<FilterCard
          categories={filterCategories}
          values={{ program: programIds, cycle: cycleIds, category: categories, status: statusFilters }}
          onApply={applyFilter}
          onClearAll={clearFilters}
        />}
      />
      {taskError && <p className="form-error" role="alert">{taskError}</p>}
      {preferencesReady && <PageBody
        ariaLabel="Task overview and assignments"
        dashboard={selectedResource ? <>
          <TaskOverviewCard tasks={resourceTasks} resourceName={selectedResource.name} />
          <TaskHoursLoggedCard task={selectedTask} onLogHours={logHoursAction} />
        </> : null}
        {...(view === 'list' ? { table: <Table
          ariaLabel="Tasks"
          columns={columns}
          data={rows}
          loading={tasksQuery.isLoading}
          error={tasksQuery.error ? 'Unable to load tasks.' : undefined}
          emptyMessage={search.trim() || hasFilters ? 'No tasks match these filters' : 'No tasks assigned'}
          keyExtractor={task => task.id}
          selectedKey={selectedTaskId}
          onRowSelect={selectTask}
          columnWidths={columnWidths}
          onColumnWidthsChange={next => {
            setColumnWidths(next);
            persist(programIds, cycleIds, categories, statusFilters, next);
          }}
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
            onDelete={canWrite && task.writable ? () => requestDelete(task) : undefined}
          />}
          onCellActivate={canWrite ? ({ resource, period }) => {
            if (!resource.writable) return;
            setModalTarget({ startDate: period.key, dueDate: period.key, fixedStaffId: resource.id });
          } : undefined}
          onRangeResize={canWrite
            ? ({ item: task, nextRange }) => setTaskRange(task, nextRange, 'resize')
            : undefined}
          canRangeMove={({ item: task, resource, destinationResource }) => (
            task.writable
            && destinationResource.writable
            && canMoveTaskToResource(task, resource.id, destinationResource.id)
          )}
          onRangeMove={canWrite
            ? ({ item: task, nextRange, destinationResource }) => (
              setTaskRange(task, nextRange, 'move', destinationResource.id)
            )
            : undefined}
          ariaLabel="Task calendar"
          positionStorageKey={TASK_CALENDAR_POSITION_KEY}
          resourceHeader="Staff"
          rowHeight={112}
        /> : null })}
      />}
    </main>
    {canWrite && modalTarget && <TaskManagementModal
      isOpen
      task={editingTask}
      initialStartDate={newTaskTarget?.startDate}
      initialDueDate={newTaskTarget?.dueDate}
      fixedStaffId={newTaskTarget?.fixedStaffId}
      resources={writableResources}
      programs={optionsQuery.data?.programs ?? []}
      cycles={optionsQuery.data?.cycles ?? []}
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
      cycles={optionsQuery.data?.cycles ?? []}
      onAdd={logTaskHours}
      onClose={() => setLogHoursTask(null)}
    />}
    <Modal
      isOpen={!!confirmAction}
      onClose={() => setConfirmAction(null)}
      title={confirmAction?.title ?? ''}
      status={confirmModal.status}
      statusMessage={confirmModal.statusMessage}
      footer={confirmModal.footer}
      successDelay={confirmModal.successDelay}
    ><p>{confirmAction?.message}</p></Modal>
  </>;
}
