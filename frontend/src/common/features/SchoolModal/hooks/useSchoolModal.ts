import { useEffect, useState } from 'react';

import useSubmitLock from '../../../hooks/useSubmitLock';
import { getErrorMessage } from '../../../../http/errors';
import { createSchool, deleteSchool, setSchool } from '../schoolModal.api';
import type { School } from '../types';
import type { SchoolAction } from '../SchoolModal';

export default function useSchoolModal({ action, onUpsert, onDelete }: {
  action: SchoolAction | null;
  onUpsert: (school: School) => void;
  onDelete: (school: School) => void;
}) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { tryLock, unlock } = useSubmitLock();

  useEffect(() => {
    setName(action?.type === 'edit' ? action.school.name : '');
    setSubmitting(false);
    setError('');
    unlock();
  }, [action, unlock]);

  const deleting = action?.type === 'delete';
  const editing = action?.type === 'edit';
  const school = action && action.type !== 'add' ? action.school : undefined;

  const submit = async () => {
    const trimmedName = name.trim();
    if (!action || (!deleting && !trimmedName) || !tryLock()) return;

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
    } catch (cause) {
      setError(getErrorMessage(cause, deleting ? 'Failed to delete school' : 'Failed to save school'));
      unlock();
      setSubmitting(false);
    }
  };

  return { name, setName, submitting, error, deleting, editing, school, submit };
}
