import { type FormEvent } from 'react';

import Button from '../../components/Button/Button';
import FormField from '../../components/FormField/FormField';
import Modal from '../../components/Modal/Modal';
import type { School } from './types';
import useSchoolModal from './hooks/useSchoolModal';

export type SchoolAction =
  | { type: 'add' }
  | { type: 'edit'; school: School }
  | { type: 'delete'; school: School };

interface Props {
  action: SchoolAction | null;
  onClose: () => void;
  onUpsert: (school: School) => void;
  onDelete: (school: School) => void;
}

export default function SchoolModal({ action, onClose, onUpsert, onDelete }: Props) {
  const workflow = useSchoolModal({ action, onUpsert, onDelete });

  if (!action) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void workflow.submit();
  };

  const title = workflow.deleting ? 'Delete School' : workflow.editing ? 'Edit School' : 'Add School';
  const submitLabel = workflow.deleting ? 'Delete' : workflow.editing ? 'Save' : 'Add';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      status={workflow.error ? 'error' : workflow.submitting ? 'submitting' : 'idle'}
      statusMessage={workflow.error || (workflow.submitting ? (workflow.deleting ? 'Deleting school...' : 'Saving school...') : undefined)}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={workflow.submitting}>Cancel</Button>
          <Button
            type={workflow.deleting ? 'button' : 'submit'}
            form={workflow.deleting ? undefined : 'school-action-form'}
            variant={workflow.deleting ? 'danger' : 'primary'}
            onClick={workflow.deleting ? () => void workflow.submit() : undefined}
            disabled={workflow.submitting || (!workflow.deleting && !workflow.name.trim())}
          >
            {submitLabel}
          </Button>
        </>
      )}
    >
      {workflow.deleting ? (
        <p>Delete {workflow.school?.name}? Schools assigned to youth profiles cannot be deleted.</p>
      ) : (
        <form id="school-action-form" onSubmit={handleSubmit}>
          <FormField id="school-name" label="School Name *">
            <input
              id="school-name"
              autoFocus
              required
              value={workflow.name}
              onChange={event => workflow.setName(event.target.value)}
              disabled={workflow.submitting}
            />
          </FormField>
        </form>
      )}
    </Modal>
  );
}
