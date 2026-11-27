import { type FormEvent, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import Button from '../../components/Button/Button';
import FormField from '../../components/FormField/FormField';
import Modal from '../../components/Modal/Modal';
import useSubmitLock from '../../hooks/useSubmitLock';
import { getErrorMessage } from '../../../http/errors';
import type { SchoolModalState } from './hooks/useSchoolModal';
import { referenceDataKeys } from '../referenceData/hooks/useReferenceData';
import { createSchool, deleteSchool, setSchool } from './schoolModal.api';
import type { School, SchoolAction, SchoolSelection } from './types';

interface Props {
  workflow: SchoolModalState;
}

/**
 * Mounts a school form only while its selector has an active action.
 * @param props.workflow - Active action, supplied selector, and close callback.
 * @example <SchoolModal workflow={schoolModal} />
 */
export default function SchoolModal({ workflow }: Props) {
  if (!workflow.session) return null;

  const { action, selection } = workflow.session;
  const targetKey = action.type === 'add' ? 'add' : `${action.type}:${action.school.id}`;
  return <SchoolForm key={targetKey} action={action} selection={selection} onClose={workflow.close} />;
}

/**
 * Owns and saves one mounted school draft.
 * @param props - Supplied action/selection and the callback that unmounts this form.
 * @example <SchoolForm action={{ type: 'edit', school }} selection={selection} onClose={close} />
 */
function SchoolForm({ action, selection, onClose }: {
  action: SchoolAction;
  selection: SchoolSelection;
  onClose: () => void;
}) {
  const [name, setName] = useState(action.type === 'edit' ? action.school.name : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { tryLock, unlock } = useSubmitLock();
  const queryClient = useQueryClient();
  const deleting = action.type === 'delete';

  /** Saves the selected school action, then unmounts on success. @example await submit() */
  const submit = async () => {
    const trimmedName = name.trim();
    if ((!deleting && !trimmedName) || !tryLock()) return;

    setSubmitting(true);
    setError('');

    try {
      if (action.type === 'delete') {
        const schoolId = action.school.id;
        await deleteSchool(schoolId);
        queryClient.setQueryData<School[]>(referenceDataKeys.schools, current => (
          (current ?? []).filter(school => school.id !== schoolId)
        ));
        if (selection.schoolId === schoolId) selection.onChange('');
      } else {
        const savedSchool = action.type === 'edit'
          ? await setSchool({ id: action.school.id, name: trimmedName })
          : await createSchool(trimmedName);
        queryClient.setQueryData<School[]>(referenceDataKeys.schools, current => {
          const schools = current ?? [];
          return schools.some(school => school.id === savedSchool.id)
            ? schools.map(school => school.id === savedSchool.id ? savedSchool : school)
            : [...schools, savedSchool];
        });
        if (action.type === 'add') selection.onChange(savedSchool.id);
      }
    } catch (cause) {
      setError(getErrorMessage(cause, deleting ? 'Failed to delete school' : 'Failed to save school'));
      setSubmitting(false);
      unlock();
      return;
    }

    onClose();
  };

  /** Prevents native navigation before saving this draft. @example handleSubmit(event) */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  let title = 'Add School';
  if (action.type === 'edit') title = 'Edit School';
  if (deleting) title = 'Delete School';
  const pendingMessage = deleting ? 'Deleting school...' : 'Saving school...';
  const submissionStatus = submitting ? 'submitting' : 'idle';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      status={error ? 'error' : submissionStatus}
      statusMessage={error || (submitting ? pendingMessage : undefined)}
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
            {deleting ? 'Confirm' : 'Save'}
          </Button>
        </>
      )}
    >
      {action.type === 'delete' ? (
        <p>Delete {action.school.name}? Schools assigned to youth profiles cannot be deleted.</p>
      ) : (
        <form id="school-action-form" onSubmit={handleSubmit}>
          <FormField id="school-name" label="School Name *">
            <input
              id="school-name"
              autoFocus
              required
              value={name}
              onChange={event => setName(event.target.value)}
              disabled={submitting}
            />
          </FormField>
        </form>
      )}
    </Modal>
  );
}
