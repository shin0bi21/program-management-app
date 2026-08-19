import { useEffect, useRef, useState, type FormEvent } from 'react';

import { setTask } from '../../../../../../common/features/tasks/tasks.api';
import type { Task, TaskCategory } from '../../../../../../common/features/tasks/types';
import { getSubmitStatusMessage, useSubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../../http/clientErrors';

export interface UseTaskModalOptions {
  isOpen: boolean;
  task?: Task;
  initialStartDate?: string;
  initialDueDate?: string;
  fixedStaffId?: string;
  onSaved: (task: Task) => void;
}

export default function useTaskModal({
  isOpen,
  task,
  initialStartDate,
  initialDueDate,
  fixedStaffId,
  onSaved,
}: UseTaskModalOptions) {
  const submittingRef = useRef(false);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [category, setCategory] = useState<TaskCategory>('outreach');
  const [programId, setProgramId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [staffId, setStaffId] = useState('');
  const {
    submitStatus,
    setSubmitStatus,
    error,
    setError,
    resetStatus,
  } = useSubmitStatus();

  // Reset the create/edit form whenever a modal lifecycle begins.
  useEffect(() => {
    if (!isOpen) return;
    submittingRef.current = false;
    setTitle(task?.title ?? '');
    setDetails(task?.details ?? '');
    setCategory(task?.category ?? 'outreach');
    setProgramId(task?.programId ?? '');
    setStartDate(task?.startDate ?? initialStartDate ?? '');
    setDueDate(task?.dueDate ?? initialDueDate ?? '');
    setStaffId(task?.assignee.id ?? fixedStaffId ?? '');
    resetStatus();
  }, [fixedStaffId, initialDueDate, initialStartDate, isOpen, resetStatus, task]);

  const updateStartDate = (value: string) => {
    setStartDate(value);
    setDueDate(value);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitStatus('submitting');
    setError('');

    try {
      const input = {
        title: title.trim(),
        details: details.trim() || null,
        category,
        programId: programId || null,
        startDate,
        dueDate,
        staffId,
      };

      const savedTask = task
        ? await setTask(input, task.id)
        : await setTask(input);

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
    title,
    setTitle,
    details,
    setDetails,
    category,
    setCategory,
    programId,
    setProgramId,
    startDate,
    updateStartDate,
    dueDate,
    setDueDate,
    staffId,
    setStaffId,
    submissionComplete: submitStatus === 'submitting' || submitStatus === 'success',
    status: submitStatus,
    statusMessage,
    submit,
  };
}
