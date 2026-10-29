import { toFilterOptions } from '../../../../../common/features/referenceData/filterOptions';
import Button from '../../../../../common/components/Button/Button';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';

import type { Task, TaskCategory, TaskModalState, TaskProgram, TaskResource } from '../../types';

import useTaskModal from './hooks/useTaskModal';

import './TaskModal.css';

export interface TaskModalProps {
  target: Exclude<TaskModalState, null>;
  resources: readonly TaskResource[];
  programs: readonly TaskProgram[];
  categories: ReadonlyArray<{ value: TaskCategory; label: string }>;
  onSaved: (task: Task) => void;
  onClose: () => void;
}

export default function TaskModal(props: TaskModalProps) {
  const {
    target,
    resources,
    programs,
    categories,
    onClose,
  } = props;
  const modal = useTaskModal(props);
  const isEdit = target.mode === 'edit';
  const staffId = target.mode === 'add' ? target.initialValues.staffId : undefined;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? 'Edit Task' : 'Add Task'}
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
            disabled={modal.submissionComplete || !modal.draft.staffId || !modal.draft.category || !modal.draft.startDate || !modal.draft.dueDate}
          >
            {isEdit ? 'Save task' : 'Add task'}
          </Button>
        </>
      )}
    >
      <form id="task-form" className="task-modal__form" onSubmit={modal.submit}>
        <FormField id="task-title" label="Task title *">
          <input
            id="task-title"
            value={modal.draft.title}
            onChange={event => modal.updateDraft('title', event.target.value)}
            maxLength={255}
            required
          />
        </FormField>

        {!staffId && <FormField id="task-staff" label="Staff *">
          <FloatingSelect
            id="task-staff"
            value={modal.draft.staffId}
            options={toFilterOptions(resources)}
            onChange={value => modal.updateDraft('staffId', value)}
            placeholder="Select staff"
            ariaLabel="Task staff"
            disabled={modal.submissionComplete}
          />
        </FormField>}

        <div className="task-modal__field-row">
          <FormField id="task-program" label="Program (optional)">
            <FloatingSelect
              id="task-program"
              value={modal.draft.programId}
              options={toFilterOptions(programs)}
              onChange={value => modal.updateDraft('programId', value)}
              placeholder="Select a program"
              ariaLabel="Task program"
              disabled={modal.submissionComplete}
              action={modal.draft.programId ? { label: 'Clear program', onSelect: () => modal.updateDraft('programId', '') } : undefined}
            />
          </FormField>

          <FormField id="task-category" label="Category *">
            <FloatingSelect
              id="task-category"
              value={modal.draft.category}
              options={categories}
              onChange={value => modal.updateDraft('category', value as TaskCategory)}
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
              value={modal.draft.startDate}
              onChange={event => modal.updateStartDate(event.target.value)}
              disabled={modal.submissionComplete}
              required
            />
          </FormField>
          <FormField id="task-due-date" label="Due date *">
            <input
              id="task-due-date"
              type="date"
              value={modal.draft.dueDate}
              min={modal.draft.startDate || undefined}
              onChange={event => modal.updateDraft('dueDate', event.target.value)}
              disabled={modal.submissionComplete}
              required
            />
          </FormField>
        </div>
        <FormField id="task-details" label="Details (optional)">
          <textarea
            id="task-details"
            value={modal.draft.details}
            onChange={event => modal.updateDraft('details', event.target.value)}
            rows={4}
            maxLength={2000}
          />
        </FormField>
      </form>
    </Modal>
  );
}
