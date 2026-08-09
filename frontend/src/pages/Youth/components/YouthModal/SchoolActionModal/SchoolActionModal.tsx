import { useEffect, useState } from 'react';
import Button from '../../../../../common/components/Button/Button';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import { createSchool, deleteSchool, setSchool } from '../schools/api/schools.api';
import type { School } from '../schools/types';
import { getErrorMessage } from '../../../../../http/clientErrors';

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
    setSubmitting(true);
    setError('');
    try {
      if (deleting && school) {
        await deleteSchool(school.id);
        onDelete(school);
      } else {
        const trimmedName = name.trim();
        if (!trimmedName) return;
        onUpsert(editing && school
          ? await setSchool({ id: school.id, name: trimmedName })
          : await createSchool(trimmedName));
      }
    } catch (err) {
      setError(getErrorMessage(err, deleting ? 'Failed to delete school' : 'Failed to save school'));
    } finally {
      setSubmitting(false);
    }
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
      disableClose={submitting}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant={deleting ? 'danger' : 'primary'} onClick={submit} disabled={submitting || (!deleting && !name.trim())}>{submitLabel}</Button>
        </>
      )}
    >
      {deleting ? (
        <p>Delete {school?.name}? Schools assigned to youth profiles cannot be deleted.</p>
      ) : (
        <FormField id="school-name" label="School Name *">
          <input id="school-name" autoFocus value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void submit(); } }} />
        </FormField>
      )}
    </Modal>
  );
}
