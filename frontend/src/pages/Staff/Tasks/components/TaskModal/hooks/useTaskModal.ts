import { useRef, useState, type FormEvent } from 'react';

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

/**
 * Owns one mounted task draft and its submission lock.
 * @example useTaskModal({ target, onSaved }) // saved record updates preserve the draft
 */
export default function useTaskModal({
  target,
  onSaved,
}: UseTaskModalOptions) {
  const task = target.mode === 'edit' ? target.task : undefined;
  const addContext = target.mode === 'add' ? target.initialValues : undefined;
  const [draft, setDraft] = useState<TaskDraft>(() => ({
    title: task?.title ?? '',
    details: task?.details ?? '',
    category: task?.category ?? '',
    programId: task?.programId ?? '',
    startDate: task?.startDate ?? addContext?.startDate ?? '',
    dueDate: task?.dueDate ?? addContext?.dueDate ?? '',
    staffId: task?.staffId ?? addContext?.staffId ?? '',
  }));
  const submittingRef = useRef(false);
  const { submitStatus, setSubmitStatus, error, setError } = useSubmitStatus();

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

      const savedTask = await setTask(input, task?.id);

      setSubmitStatus('success');
      onSaved(savedTask);
    } catch (cause) {
      submittingRef.current = false;
      setError(getErrorMessage(cause, task ? 'Unable to update task' : 'Unable to create task'));
      setSubmitStatus('error');
    }
  };

  const statusMessage = getSubmitStatusMessage(submitStatus, error, {
    submitting: task ? 'Updating task…' : 'Creating task…',
    success: task ? 'Task updated.' : 'Task created.',
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
