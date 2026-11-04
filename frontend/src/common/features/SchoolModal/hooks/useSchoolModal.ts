import { useState } from 'react';

import useSubmitLock from '../../../hooks/useSubmitLock';
import { getErrorMessage } from '../../../../http/errors';
import { createSchool, deleteSchool, setSchool } from '../schoolModal.api';
import type { SchoolAction, SchoolSelection } from '../types';
import { useSchools } from './useSchools';

interface SchoolSession {
  action: SchoolAction;
  selection: SchoolSelection;
}

export default function useSchoolModal() {
  const [session, setSession] = useState<SchoolSession | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { tryLock, unlock } = useSubmitLock();
  // The selector owns loading; this hook only reconciles its shared cache.
  const { upsertSchool, removeSchool } = useSchools({ enabled: false });

  const open = (action: SchoolAction, selection: SchoolSelection) => {
    if (submitting) return;

    setSession({ action, selection });
    setName(action.type === 'edit' ? action.school.name : '');
    setError('');
  };

  const reset = () => {
    setSession(null);
    setName('');
    setSubmitting(false);
    setError('');
    unlock();
  };

  const close = () => {
    if (submitting) return;

    reset();
  };

  const action = session?.action ?? null;
  const deleting = action?.type === 'delete';
  const editing = action?.type === 'edit';
  const school = action && action.type !== 'add' ? action.school : undefined;

  const submit = async () => {
    const trimmedName = name.trim();
    if (!session || (!deleting && !trimmedName) || !tryLock()) return;

    setSubmitting(true);
    setError('');

    try {
      if (deleting && school) {
        await deleteSchool(school.id);
        removeSchool(school.id);

        if (session.selection.schoolId === school.id) {
          session.selection.onChange('');
        }
      } else {
        const savedSchool = editing && school
          ? await setSchool({ id: school.id, name: trimmedName })
          : await createSchool(trimmedName);
        upsertSchool(savedSchool);

        if (session.action.type === 'add') {
          session.selection.onChange(savedSchool.id);
        }
      }
    } catch (cause) {
      setError(getErrorMessage(cause, deleting ? 'Failed to delete school' : 'Failed to save school'));
      unlock();
      setSubmitting(false);
      return;
    }

    reset();
  };

  return { action, open, close, name, setName, submitting, error, deleting, editing, school, submit };
}

export type SchoolModalState = ReturnType<typeof useSchoolModal>;
