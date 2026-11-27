import { useForm, type UseFormHandleSubmit, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { getUser } from '../../../../../../auth/storage';

import { useSubmitStatus, type SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import { getErrorMessage } from '../../../../../../http/errors';
import { getDate } from '../../../../../../common/utils/date';
import type { RequestOptions } from '../../../../../../http/client';
import type { Task } from '../../../../Tasks/types';
import { getHoursSessions } from '../../../hours.api';
import type {
  AddHoursFormContext,
  HoursCategory,
  Hours,
} from '../../../types';

type HoursDraft = AddHoursFormContext & {
  taskId: string;
  completeTask: boolean;
  sessionId: string;
  programId: string;
  category: HoursCategory | '';
  hours: string;
  note: Hours['note'];
};

export type HoursFormTarget =
  | { mode: 'add'; context: Partial<AddHoursFormContext> }
  | { mode: 'edit'; item: Hours }
  | { mode: 'task'; task: Pick<Task, 'id' | 'staffId' | 'title'> };

export type UseHoursModalOptions = {
  target: HoursFormTarget;
  loadTasks: (
    staffId: Hours['staffId'],
    opts?: RequestOptions,
  ) => Promise<readonly Task[]>;
  onSave: (input: Partial<Hours>, completeTask: boolean) => Promise<void>;
  canCompleteTask?: boolean;
};

interface HoursModalResult {
  draft: HoursDraft;
  register: UseFormRegister<HoursDraft>;
  setValue: UseFormSetValue<HoursDraft>;
  taskLocked: boolean;
  taskOptions: readonly Pick<Task, 'id' | 'title'>[];
  tasksLoading: boolean;
  tasksError: string | undefined;
  sessionOptions: Awaited<ReturnType<typeof getHoursSessions>>;
  sessionsLoading: boolean;
  sessionsError: string | undefined;
  submitStatus: SubmitStatus;
  submitting: boolean;
  error: string;
  selectStaff: (staffId: HoursDraft['staffId']) => void;
  selectSession: (sessionId: HoursDraft['sessionId']) => void;
  updateDate: (date: HoursDraft['date']) => void;
  submit: ReturnType<UseFormHandleSubmit<HoursDraft>>;
}

/**
 * Owns one mounted Hours draft, its selector choices and save feedback.
 * @param options - Form target, task lookup, and save callback. Add targets default to the signed-in staff member and today's date.
 * @example useHoursModal({ ...options, target: { mode: 'edit', item } }) // initializes the edit draft once
 */
export default function useHoursModal(options: UseHoursModalOptions): HoursModalResult {
  const { target, loadTasks, onSave, canCompleteTask = false } = options;
  const item = target.mode === 'edit' ? target.item : undefined;
  const task = target.mode === 'task' ? target.task : undefined;
  const context = target.mode === 'add' ? target.context : undefined;
  const type = task ? 'task' : item?.type ?? context?.type ?? 'regular';
  const { register, watch, getValues, setValue, handleSubmit } = useForm<HoursDraft>({
    defaultValues: {
      type,

      staffId: item?.staffId ?? task?.staffId ?? context?.staffId ?? getUser()?.id ?? '',
      taskId: task?.id ?? item?.taskId ?? '',
      completeTask: false,
      sessionId: item?.sessionId ?? '',
      programId: item?.programId ?? '',
      category: item?.category ?? '',
      date: item?.date ?? context?.date ?? getDate(),
      hours: item ? String(item.hours) : '',
      note: item?.note ?? '',
    },
  });
  const draft = watch();
  const { submitStatus, setSubmitStatus, error, setError } = useSubmitStatus();
  const taskLocked = Boolean(task);
  const submitting = submitStatus === 'submitting';
  const submitLock = useSubmitLock();

  // Source-specific remote options.
  const taskQuery = useQuery({
    queryKey: ['tasks', 'hours-options', draft.staffId],
    queryFn: ({ signal }) => loadTasks(draft.staffId, { signal }),
    enabled: draft.type === 'task' && Boolean(draft.staffId) && !taskLocked,
  });
  const taskOptions = task
    ? [task]
    : (taskQuery.data ?? []).filter(task => task.state === 'open');

  const sessionQuery = useQuery({
    queryKey: ['hours-sessions', draft.staffId, draft.date],
    queryFn: ({ signal }) => getHoursSessions(draft.staffId, draft.date, signal),
    enabled: draft.type === 'session' && Boolean(draft.staffId) && Boolean(draft.date),
  });
  const sessionOptions = sessionQuery.data ?? [];

  // Dependent field events.
  const selectStaff = (staffId: string) => {
    setValue('staffId', staffId);
    setValue('taskId', '');
    setValue('sessionId', '');
  };
  const selectSession = (sessionId: string) => {
    const session = sessionOptions.find(option => option.id === sessionId);
    setValue('sessionId', sessionId);
    if (session) setValue('date', session.date);
  };
  const updateDate = (date: string) => {
    setValue('date', date);
    if (getValues('type') === 'session') setValue('sessionId', '');
  };

  // Submission boundary.
  const submit = handleSubmit(async draft => {
    const validationError = getDraftError(draft);
    if (validationError) {
      setError(validationError);
      setSubmitStatus('error');
      return;
    }

    const shared = {
      staffId: draft.staffId,
      hours: Number(draft.hours),
      note: draft.note,
    };
    let input: Partial<Hours>;
    if (draft.type === 'task') {
      input = {
        ...shared,
        type: 'task',
        date: draft.date,
        taskId: draft.taskId,
      };
    } else if (draft.type === 'session') {
      input = { ...shared, type: 'session', sessionId: draft.sessionId };
    } else {
      if (!draft.category || draft.category === 'program_delivery') {
        setError('Select a category.');
        setSubmitStatus('error');
        return;
      }
      input = {
        ...shared,
        type: 'regular',
        date: draft.date,
        programId: draft.programId || null,
        category: draft.category,
      };
    }
    if (item) {
      const changedFields = Object.entries(input).filter(([field, value]) => item[field as keyof Hours] !== value);
      input = Object.fromEntries(changedFields);
    }
    if (!submitLock.tryLock()) return;

    setSubmitStatus('submitting');
    setError('');
    try {
      if (!item || Object.keys(input).length) {
        await onSave(input, draft.type === 'task' && canCompleteTask && draft.completeTask);
      }
      setSubmitStatus('success');
    } catch (cause) {
      setError(getErrorMessage(
        cause,
        item ? 'Unable to update logged hours' : 'Unable to log hours',
      ));
      setSubmitStatus('error');
    } finally {
      submitLock.unlock();
    }
  });

  return {
    draft,
    register,
    setValue,
    taskLocked,
    taskOptions,
    tasksLoading: taskQuery.isLoading,
    tasksError: taskQuery.error ? 'Unable to load assigned tasks' : undefined,
    sessionOptions,
    sessionsLoading: sessionQuery.isLoading,
    sessionsError: sessionQuery.error ? 'Unable to load sessions' : undefined,
    submitStatus,
    submitting,
    error,
    selectStaff,
    selectSession,
    updateDate,
    submit,
  };
}

/** Validates the command fields before saving. @example getDraftError(draft) // empty when valid */
function getDraftError(draft: HoursDraft) {
  if (!draft.staffId) return 'Select a staff member.';
  if (draft.type === 'task' && !draft.taskId) return 'Select a task.';
  if (draft.type === 'session' && !draft.sessionId) return 'Select a session.';

  const hours = Number(draft.hours);
  if (!Number.isFinite(hours) || hours < 0.25 || hours > 24) {
    return 'Hours must be between 0.25 and 24.';
  }
  if (!draft.note.trim()) return 'Enter a note.';
  return '';
}
