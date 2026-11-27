import type { ReactElement } from 'react';
import Button from '../../../../../common/components/Button/Button';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';

import type { TaskReferenceData } from '../../api/tasks.api';
import type { ProgramReference, StaffReference } from '../../../../../common/features/referenceData/referenceData.api';
import type { Task } from '../../types';

import useTaskModal, { type UseTaskModalOptions } from './hooks/useTaskModal';

import './TaskModal.css';

interface TaskModalProps extends UseTaskModalOptions {
  staff: readonly StaffReference[];
  programs: readonly ProgramReference[];
  categories: Readonly<TaskReferenceData['categories']>;
  onClose: () => void;
}

/**
 * Displays one mounted task editor using its supplied row or add context.
 * @param props - Edit/add target, page reference choices, and close/save callbacks.
 * @example <TaskModal target={{ mode: 'edit', task }} {...options} />
 */
export default function TaskModal(props: TaskModalProps): ReactElement {
  const {
    target,
    staff,
    programs,
    categories,
    onClose,
  } = props;
  const modal = useTaskModal(props);
  const isEdit = target.mode === 'edit';
  const staffId = target.mode === 'add' ? target.context.staffId : undefined;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? 'Edit Task' : 'Add Task'}
      maxWidth="620px"
      status={modal.status}
      statusMessage={modal.statusMessage}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={modal.submissionComplete}>Cancel</Button>
          <Button
            type="submit"
            form="task-form"
            disabled={modal.submissionComplete || !modal.draft.staffId || !modal.draft.category || !modal.draft.startDate || !modal.draft.dueDate}
          >
            Save
          </Button>
        </>
      )}
    >
      <form id="task-form" className="task-modal__form" onSubmit={modal.submit}>
        <FormField id="task-title" label="Task title *">
          <input
            id="task-title"
            {...modal.register('title')}
            maxLength={255}
            disabled={modal.submissionComplete}
            required
          />
        </FormField>

        {!staffId && <FormField id="task-staff" label="Staff *">
          <FloatingSelect
            id="task-staff"
            value={modal.draft.staffId}
            options={staff.map(({ id, name }) => ({ id, label: name }))}
            onChange={value => modal.setValue('staffId', value)}
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
              options={programs.map(({ id, title }) => ({ id, label: title }))}
              onChange={value => modal.setValue('programId', value)}
              placeholder="Select a program"
              ariaLabel="Task program"
              disabled={modal.submissionComplete}
              action={modal.draft.programId ? { label: 'Clear program', onSelect: () => modal.setValue('programId', '') } : undefined}
            />
          </FormField>

          <FormField id="task-category" label="Category *">
            <FloatingSelect
              id="task-category"
              value={modal.draft.category}
              options={categories.map(({ id, name }) => ({ id, label: name }))}
              onChange={value => modal.setValue('category', value as Task['category'])}
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
              {...modal.register('startDate', { onChange: event => modal.updateStartDate(event.target.value) })}
              disabled={modal.submissionComplete}
              required
            />
          </FormField>
          <FormField id="task-due-date" label="Due date *">
            <input
              id="task-due-date"
              type="date"
              min={modal.draft.startDate || undefined}
              {...modal.register('dueDate')}
              disabled={modal.submissionComplete}
              required
            />
          </FormField>
        </div>
        <FormField id="task-details" label="Details (optional)">
          <textarea
            id="task-details"
            {...modal.register('details')}
            rows={4}
            maxLength={2000}
            disabled={modal.submissionComplete}
          />
        </FormField>
      </form>
    </Modal>
  );
}
