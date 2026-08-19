import Button from '../../../../../common/components/Button/Button';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';

import { TASK_CATEGORY_OPTIONS, type TaskCategory, type TaskProgram, type TaskResource } from '../../../../../common/features/tasks/types';

import useTaskModal, { type UseTaskModalOptions } from './hooks/useTaskModal';

import './TaskModal.css';

interface TaskModalProps extends UseTaskModalOptions {
  resources: readonly TaskResource[];
  programs: readonly TaskProgram[];
  onClose: () => void;
}

export default function TaskModal({
  isOpen,
  resources,
  programs,
  task,
  initialStartDate,
  initialDueDate,
  fixedStaffId,
  onSaved,
  onClose,
}: TaskModalProps) {
  const modal = useTaskModal({
    isOpen,
    task,
    initialStartDate,
    initialDueDate,
    fixedStaffId,
    onSaved,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? 'Edit Task' : 'Add Task'}
      maxWidth="620px"
      status={modal.status}
      statusMessage={modal.statusMessage}
      successDelay={1200}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={modal.submissionComplete}>Cancel</Button>
          <Button
            type="submit"
            form="task-form"
            disabled={modal.submissionComplete || !modal.staffId || !modal.startDate || !modal.dueDate}
          >
            {task ? 'Save task' : 'Add task'}
          </Button>
        </>
      )}
    >
      <form id="task-form" className="task-modal__form" onSubmit={modal.submit}>
        <FormField id="task-title" label="Task title *">
          <input
            id="task-title"
            value={modal.title}
            onChange={event => modal.setTitle(event.target.value)}
            maxLength={255}
            required
          />
        </FormField>
        {!fixedStaffId && <FormField id="task-staff" label="Staff *">
          <FloatingSelect
            id="task-staff"
            value={modal.staffId}
            options={resources.map(resource => ({ value: resource.id, label: resource.name }))}
            onChange={modal.setStaffId}
            placeholder="Select staff"
            ariaLabel="Task staff"
            disabled={modal.submissionComplete}
          />
        </FormField>}
        <div className="task-modal__field-row">
          <FormField id="task-program" label="Program (optional)">
            <FloatingSelect
              id="task-program"
              value={modal.programId}
              options={programs.map(program => ({ value: program.id, label: program.name }))}
              onChange={modal.setProgramId}
              placeholder="Select a program"
              ariaLabel="Task program"
              disabled={modal.submissionComplete}
              action={modal.programId ? { label: 'Clear program', onSelect: () => modal.setProgramId('') } : undefined}
            />
          </FormField>
          <FormField id="task-category" label="Category *">
            <FloatingSelect
              id="task-category"
              value={modal.category}
              options={TASK_CATEGORY_OPTIONS}
              onChange={value => modal.setCategory(value as TaskCategory)}
              ariaLabel="Task category"
              disabled={modal.submissionComplete}
            />
          </FormField>
        </div>
        <div className="task-modal__field-row">
          <FormField id="task-start-date" label="Start date *">
            <input
              id="task-start-date"
              type="date"
              value={modal.startDate}
              onChange={event => modal.updateStartDate(event.target.value)}
              disabled={modal.submissionComplete}
              required
            />
          </FormField>
          <FormField id="task-due-date" label="Due date *">
            <input
              id="task-due-date"
              type="date"
              value={modal.dueDate}
              min={modal.startDate || undefined}
              onChange={event => modal.setDueDate(event.target.value)}
              disabled={modal.submissionComplete}
              required
            />
          </FormField>
        </div>
        <FormField id="task-details" label="Details (optional)">
          <textarea
            id="task-details"
            value={modal.details}
            onChange={event => modal.setDetails(event.target.value)}
            rows={4}
            maxLength={2000}
          />
        </FormField>
      </form>
    </Modal>
  );
}
