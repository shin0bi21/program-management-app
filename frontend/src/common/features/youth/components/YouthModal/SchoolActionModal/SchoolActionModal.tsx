import { type FormEvent, useEffect, useState } from 'react';

import Button from '../../../../../components/Button/Button';
import FormField from '../../../../../components/FormField/FormField';
import Modal from '../../../../../components/Modal/Modal';
import useSubmitLock from '../../../../../hooks/useSubmitLock';

import { createSchool, deleteSchool, setSchool } from '../schools/schools.api';
import type { School } from '../schools/types';
import { getErrorMessage } from '../../../../../../http/errors';

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

export default function SchoolActionModal({ action, onClose, onUpsert, onDelete }: Props) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submitLock = useSubmitLock();

  useEffect(() => {
    setName(action && action.type === 'edit' ? action.school.name : '');
    setSubmitting(false);
    setError('');
  }, [action]);

  if (!action) return null;

  const deleting = action.type === 'delete';
  const editing = action.type === 'edit';
  const school = action.type === 'add' ? undefined : action.school;

  const submit = async () => {
    const trimmedName = name.trim();
    if (!deleting && !trimmedName) return;
    if (!submitLock.tryLock()) return;

    setSubmitting(true);
    setError('');

    try {
      if (deleting && school) {
        await deleteSchool(school.id);
        onDelete(school);
      } else {
        onUpsert(editing && school
          ? await setSchool({ id: school.id, name: trimmedName })
          : await createSchool(trimmedName));
      }
    } catch (err) {
      setError(getErrorMessage(err, deleting ? 'Failed to delete school' : 'Failed to save school'));
    } finally {
      submitLock.unlock();
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const title = deleting ? 'Delete School' : editing ? 'Edit School' : 'Add School';
  const submitLabel = deleting ? 'Delete' : editing ? 'Save' : 'Add';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      status={error ? 'error' : submitting ? 'submitting' : 'idle'}
      statusMessage={error || (submitting ? (deleting ? 'Deleting school...' : 'Saving school...') : undefined)}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            type={deleting ? 'button' : 'submit'}
            form={deleting ? undefined : 'school-action-form'}
            variant={deleting ? 'danger' : 'primary'}
            onClick={deleting ? () => void submit() : undefined}
            disabled={submitting || (!deleting && !name.trim())}
          >
            {submitLabel}
          </Button>
        </>
      )}
    >
      {deleting ? (
        <p>Delete {school?.name}? Schools assigned to youth profiles cannot be deleted.</p>
      ) : (
        <form id="school-action-form" onSubmit={handleSubmit}>
          <FormField id="school-name" label="School Name *">
            <input
              id="school-name"
              autoFocus
              required
              value={name}
              onChange={event => setName(event.target.value)}
            />
          </FormField>
        </form>
      )}
    </Modal>
  );
}
