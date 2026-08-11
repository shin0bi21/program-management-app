import { useEffect, useState, type FormEvent } from 'react';
import Button from '../../../../../common/components/Button/Button';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import { createTask, updateTask } from '../../../../../common/features/tasks/api/tasks.api';
import { TASK_CATEGORY_OPTIONS, type Task, type TaskCategory, type TaskCycle, type TaskProgram, type TaskResource, type TaskStatus } from '../../../../../common/features/tasks/types';
import { getErrorMessage } from '../../../../../http/clientErrors';
import './TaskManagementModal.css';

interface TaskManagementModalProps {
  isOpen: boolean;
  resources: readonly TaskResource[];
  programs: readonly TaskProgram[];
  cycles: readonly TaskCycle[];
  task?: Task;
  initialStartDate?: string;
  initialDueDate?: string;
  fixedStaffId?: string;
  onSaved: (task: Task) => void;
  onClose: () => void;
}

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function TaskManagementModal({ isOpen, resources, programs, cycles, task, initialStartDate, initialDueDate, fixedStaffId, onSaved, onClose }: TaskManagementModalProps) {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [category, setCategory] = useState<TaskCategory>('outreach');
  const [programId, setProgramId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [staffId, setStaffId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const availableCycles = programId
    ? cycles.filter(cycle => cycle.programId === programId)
    : Array.from(new Map(cycles.map(cycle => [cycle.id, cycle])).values());
  const availableStatuses = task?.status === 'in_progress'
    ? STATUS_OPTIONS.filter(option => option.value !== 'cancelled')
    : STATUS_OPTIONS;

  useEffect(() => {
    if (!isOpen) return;
    setTitle(task?.title ?? '');
    setDetails(task?.details ?? '');
    setCategory(task?.category ?? 'outreach');
    setProgramId(task?.programId ?? '');
    setCycleId(task?.cycleId ?? '');
    setStatus(task?.status ?? 'todo');
    setStartDate(task?.startDate ?? initialStartDate ?? '');
    setDueDate(task?.dueDate ?? initialDueDate ?? '');
    setStaffId(task?.assignee.id ?? fixedStaffId ?? '');
    setError('');
  }, [fixedStaffId, initialDueDate, initialStartDate, isOpen, task]);

  useEffect(() => {
    if (cycleId && !availableCycles.some(cycle => cycle.id === cycleId)) setCycleId('');
  }, [availableCycles, cycleId]);

  useEffect(() => {
    if (!isOpen || task || cycleId) return;
    const activeCycle = availableCycles.find(cycle => cycle.state === 'active');
    if (activeCycle) setCycleId(activeCycle.id);
  }, [availableCycles, cycleId, isOpen, task]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const input = {
        title: title.trim(),
        details: details.trim() || null,
        category,
        programId: programId || null,
        cycleId,
        status,
        startDate,
        dueDate,
        staffId,
      };
      const saved = task ? await updateTask(task.id, input) : await createTask(input);
      onSaved(saved);
      onClose();
    } catch (cause) {
      setError(getErrorMessage(cause, task ? 'Unable to update task' : 'Unable to create task'));
    } finally {
      setSubmitting(false);
    }
  };

  const statusMessage = error || (submitting ? (task ? 'Updating task…' : 'Creating task…') : undefined);

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? 'Edit task' : 'Add task'}
      maxWidth="620px"
      status={error ? 'error' : submitting ? 'submitting' : 'idle'}
      statusMessage={statusMessage}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="task-form" disabled={submitting || !staffId || !cycleId || !startDate || !dueDate}>
            {task ? 'Save task' : 'Add task'}
          </Button>
        </>
      )}
    >
        <form id="task-form" className="task-management__form" onSubmit={submit}>
          <FormField id="task-title" label="Task title *">
            <input id="task-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={255} required />
          </FormField>
          {!fixedStaffId && <FormField id="task-staff" label="Staff *">
            <FloatingSelect id="task-staff" value={staffId} options={resources.map(resource => ({ value: resource.id, label: resource.name }))} onChange={setStaffId} placeholder="Select staff" ariaLabel="Task staff" disabled={submitting} />
          </FormField>}
          <div className="task-management__field-row">
            <FormField id="task-program" label="Program (optional)">
              <FloatingSelect
                id="task-program"
                value={programId}
                options={programs.map(program => ({ value: program.id, label: program.name }))}
                onChange={value => { setProgramId(value); if (value) setCycleId(''); }}
                placeholder="Select a program"
                ariaLabel="Task program"
                disabled={submitting}
                action={programId ? { label: 'Clear program', onSelect: () => setProgramId('') } : undefined}
              />
            </FormField>
            <FormField id="task-cycle" label="Cycle *">
              <FloatingSelect
                id="task-cycle"
                value={cycleId}
                options={availableCycles.map(cycle => ({ value: cycle.id, label: cycle.name }))}
                onChange={setCycleId}
                placeholder={availableCycles.length ? 'Select a cycle' : programId ? 'No cycles for this program' : 'No cycles available'}
                ariaLabel="Task cycle"
                disabled={submitting || availableCycles.length === 0}
              />
            </FormField>
          </div>
          <div className="task-management__field-row">
            <FormField id="task-category" label="Category *">
              <FloatingSelect id="task-category" value={category} options={TASK_CATEGORY_OPTIONS} onChange={value => setCategory(value as TaskCategory)} ariaLabel="Task category" disabled={submitting} />
            </FormField>
            <FormField id="task-status" label="Status *">
              <FloatingSelect id="task-status" value={status} options={availableStatuses} onChange={value => setStatus(value as TaskStatus)} ariaLabel="Task status" disabled={submitting} />
            </FormField>
          </div>
          <div className="task-management__field-row">
            <FormField id="task-start-date" label="Start date *">
              <input id="task-start-date" type="date" value={startDate} onChange={event => { setStartDate(event.target.value); setDueDate(event.target.value); }} disabled={submitting} required />
            </FormField>
            <FormField id="task-due-date" label="Due date *">
              <input id="task-due-date" type="date" value={dueDate} min={startDate || undefined} onChange={event => setDueDate(event.target.value)} disabled={submitting} required />
            </FormField>
          </div>
          <FormField id="task-details" label="Details (optional)">
            <textarea id="task-details" value={details} onChange={event => setDetails(event.target.value)} rows={4} maxLength={2000} />
          </FormField>
        </form>
    </Modal>
    </>
  );
}
