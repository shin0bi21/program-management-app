import { useEffect, useRef, useState, type FormEvent } from 'react';

import { setTask } from '../../../tasks.api';
import type { TaskCategory } from '../../../types';
import { getSubmitStatusMessage, useSubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/errors';
import type { TaskModalProps } from '../TaskModal';

type UseTaskModalOptions = Pick<TaskModalProps,
  | 'target'
  | 'onSaved'
>;

interface TaskDraft {
  title: string;
  details: string;
  category: TaskCategory | '';
  programId: string;
  startDate: string;
  dueDate: string;
  staffId: string;
}

function getInitialDraft(target: TaskModalProps['target']): TaskDraft {
  if (target.mode === 'add') {
    return {
      title: '',
      details: '',
      category: '',
      programId: '',
      startDate: target.initialValues.startDate,
      dueDate: target.initialValues.dueDate,
      staffId: target.initialValues.staffId ?? '',
    };
  }

  return {
    title: target.task.title,
    details: target.task.details ?? '',
    category: target.task.category,
    programId: target.task.programId ?? '',
    startDate: target.task.startDate,
    dueDate: target.task.dueDate,
    staffId: target.task.assignee.id,
  };
}

export default function useTaskModal({
  target,
  onSaved,
}: UseTaskModalOptions) {
  const initialDraftRef = useRef(getInitialDraft(target));
  initialDraftRef.current = getInitialDraft(target);
  const targetKey = target.mode === 'edit'
    ? target.task
    : `${target.initialValues.startDate}:${target.initialValues.dueDate}:${target.initialValues.staffId ?? ''}`;
  const submittingRef = useRef(false);
  const [draft, setDraft] = useState(initialDraftRef.current);
  const {
    submitStatus,
    setSubmitStatus,
    error,
    setError,
    resetStatus,
  } = useSubmitStatus();

  // Reset the create/edit form whenever a modal lifecycle begins.
  useEffect(() => {
    submittingRef.current = false;
    setDraft(initialDraftRef.current);
    resetStatus();
  }, [resetStatus, targetKey]);

  const updateDraft = <Key extends keyof TaskDraft>(key: Key, value: TaskDraft[Key]) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  const updateStartDate = (value: string) => {
    setDraft(current => ({ ...current, startDate: value, dueDate: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!draft.category) {
      setError('Select a category.');
      setSubmitStatus('error');
      return;
    }

    submittingRef.current = true;
    setSubmitStatus('submitting');
    setError('');

    try {
      const input = {
        title: draft.title.trim(),
        details: draft.details.trim() || null,
        category: draft.category,
        programId: draft.programId || null,
        startDate: draft.startDate,
        dueDate: draft.dueDate,
        staffId: draft.staffId,
      };

      const savedTask = target.mode === 'edit'
        ? await setTask(input, target.task.id)
        : await setTask(input);

      setSubmitStatus('success');
      onSaved(savedTask);
    } catch (cause) {
      submittingRef.current = false;
      setError(getErrorMessage(cause, target.mode === 'edit' ? 'Unable to update task' : 'Unable to create task'));
      setSubmitStatus('error');
    }
  };

  const statusMessage = getSubmitStatusMessage(submitStatus, error, {
    submitting: target.mode === 'edit' ? 'Updating task…' : 'Creating task…',
    success: target.mode === 'edit' ? 'Task updated.' : 'Task created.',
  });

  return {
    draft,
    updateDraft,
    updateStartDate,
    submissionComplete: submitStatus === 'submitting' || submitStatus === 'success',
    status: submitStatus,
    statusMessage,
    submit,
  };
}
