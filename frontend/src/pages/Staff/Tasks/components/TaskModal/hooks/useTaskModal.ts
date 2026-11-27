import { useForm, type UseFormHandleSubmit, type UseFormSetValue, type UseFormRegister } from 'react-hook-form';

import { setTask, type SetTaskInput } from '../../../api/tasks.api';
import type { Task, TaskModalState } from '../../../types';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import { getSubmitStatusMessage, useSubmitStatus, type SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/errors';
import { getDate } from '../../../../../../common/utils/date';

export interface UseTaskModalOptions {
  target: NonNullable<TaskModalState>;
  onSaved: (task: Task) => void;
}

type TaskDraft = Pick<Task, 'title' | 'staffId' | 'startDate' | 'dueDate'> & {
  programId: string;
  category: Task['category'] | '';
  details: string;
};

interface TaskModalResult {
  draft: TaskDraft;
  register: UseFormRegister<TaskDraft>;
  setValue: UseFormSetValue<TaskDraft>;
  updateStartDate: (value: Task['startDate']) => void;
  submissionComplete: boolean;
  status: SubmitStatus;
  statusMessage: string | undefined;
  submit: ReturnType<UseFormHandleSubmit<TaskDraft>>;
}

/**
 * Owns one mounted task draft and its submission lock.
 * Missing add dates default to today for the start and the start date for the due date.
 * @example useTaskModal({ target, onSaved }) // saved record updates preserve the draft
 */
export default function useTaskModal({
  target,
  onSaved,
}: UseTaskModalOptions): TaskModalResult {
  const task = target.mode === 'edit' ? target.task : undefined;
  const addContext = target.mode === 'add' ? target.context : undefined;
  const startDate = task?.startDate ?? addContext?.startDate ?? getDate();
  const { register, watch, setValue, handleSubmit } = useForm<TaskDraft>({
    defaultValues: {
      title: task?.title ?? '',
      staffId: task?.staffId ?? addContext?.staffId ?? '',
      programId: task?.programId ?? '',
      category: task?.category ?? '',
      startDate,
      dueDate: task?.dueDate ?? addContext?.dueDate ?? startDate,
      details: task?.details ?? '',
    },
  });
  const draft = watch();
  const { tryLock, unlock } = useSubmitLock();
  const { submitStatus, setSubmitStatus, error, setError } = useSubmitStatus();

  const updateStartDate = (value: string) => {
    setValue('startDate', value);
    setValue('dueDate', value);
  };

  const submit = handleSubmit(async draft => {
    if (!tryLock()) return;
    if (!draft.category) {
      unlock();
      setError('Select a category.');
      setSubmitStatus('error');
      return;
    }

    setSubmitStatus('submitting');
    setError('');

    try {
      const input: SetTaskInput = {
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
      unlock();
      setError(getErrorMessage(cause, task ? 'Unable to update task' : 'Unable to create task'));
      setSubmitStatus('error');
    }
  });

  const statusMessage = getSubmitStatusMessage(submitStatus, error, {
    submitting: task ? 'Updating task…' : 'Creating task…',
    success: task ? 'Task updated.' : 'Task created.',
  });

  return {
    draft,
    register,
    setValue,
    updateStartDate,
    submissionComplete: submitStatus === 'submitting' || submitStatus === 'success',
    status: submitStatus,
    statusMessage,
    submit,
  };
}
