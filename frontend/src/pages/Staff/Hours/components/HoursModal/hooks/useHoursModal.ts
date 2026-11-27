import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUser } from '../../../../../../auth/storage';

import { useSubmitStatus, type SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import { getErrorMessage } from '../../../../../../http/errors';
import { getDate } from '../../../../../../common/utils/date';
import type { RequestOptions } from '../../../../../../http/client';
import type { Task } from '../../../../Tasks/types';
import { getHoursSessions } from '../../../hours.api';
import type { ProgramReference, StaffReference } from '../../../../../../common/features/referenceData/referenceData.api';
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

export interface UseHoursModalOptions extends Partial<AddHoursFormContext> {
  staff: readonly StaffReference[];
  programs: readonly ProgramReference[];
  loadTasks: (
    staffId: Hours['staffId'],
    opts?: RequestOptions,
  ) => Promise<readonly Task[]>;
  onAdd: (input: Partial<Hours>, completeTask: boolean) => Promise<void>;
  task?: Task;
  item?: Hours;
  canCompleteTask?: boolean;
}

interface HoursModalResult {
  draft: HoursDraft;
  taskLocked: boolean;
  taskOptions: readonly Task[];
  tasksLoading: boolean;
  tasksError: string | undefined;
  sessionOptions: Awaited<ReturnType<typeof getHoursSessions>>;
  sessionsLoading: boolean;
  sessionsError: string | undefined;
  submitStatus: SubmitStatus;
  submitting: boolean;
  error: string;
  selectStaff: (staffId: HoursDraft['staffId']) => void;
  selectProgram: (programId: HoursDraft['programId']) => void;
  selectCategory: (category: Exclude<HoursCategory, 'program_delivery'>) => void;
  selectTask: (taskId: HoursDraft['taskId']) => void;
  selectSession: (sessionId: HoursDraft['sessionId']) => void;
  updateDate: (date: HoursDraft['date']) => void;
  updateHours: (hours: HoursDraft['hours']) => void;
  updateNote: (note: HoursDraft['note']) => void;
  setCompleteTask: (completeTask: boolean) => void;
  submit: (event: FormEvent) => Promise<void>;
}

/**
 * Owns one mounted Hours draft, its selector choices and save feedback.
 * @param options - Supplied edit row or add context and the page's save callback.
 * @param options.staffId - Contextual staff ID; omitted add context defaults to the signed-in staff member.
 * @param options.date - Contextual work date; omitted add dates default to today.
 * @example useHoursModal({ ...options, item }) // initializes the edit draft once
 */
export default function useHoursModal(options: UseHoursModalOptions): HoursModalResult {
  const { loadTasks, onAdd, task, item, canCompleteTask = false } = options;
  const [draft, setDraft] = useState<HoursDraft>(() => {
    const type = task ? 'task' : item?.type ?? options.type ?? 'regular';

    return {
      type,

      staffId: item?.staffId ?? task?.staffId ?? options.staffId ?? getUser()?.id ?? '',
      taskId: task?.id ?? item?.taskId ?? '',
      completeTask: false,
      sessionId: item?.sessionId ?? '',
      programId: item?.programId ?? '',
      category: item?.category ?? '',
      date: item?.date ?? options.date ?? getDate(),
      hours: item ? String(item.hours) : '',
      note: item?.note ?? '',
    };
  });
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
    setDraft(current => ({ ...current, staffId, taskId: '', sessionId: '' }));
  };
  const selectProgram = (programId: string) => {
    setDraft(current => ({ ...current, programId }));
  };
  const selectCategory = (category: Exclude<HoursCategory, 'program_delivery'>) => {
    setDraft(current => ({ ...current, category }));
  };
  const selectTask = (taskId: string) => {
    setDraft(current => ({ ...current, taskId }));
  };
  const selectSession = (sessionId: string) => {
    const session = sessionOptions.find(option => option.id === sessionId);
    setDraft(current => ({
      ...current,
      sessionId,
      date: session?.date ?? current.date,
    }));
  };
  const updateDate = (date: string) => {
    setDraft(current => ({
      ...current,
      date,
      sessionId: current.type === 'session' ? '' : current.sessionId,
    }));
  };
  const updateHours = (hours: string) => {
    setDraft(current => ({ ...current, hours }));
  };
  const updateNote = (note: string) => {
    setDraft(current => ({ ...current, note }));
  };
  const setCompleteTask = (completeTask: boolean) => {
    setDraft(current => ({ ...current, completeTask }));
  };

  // Submission boundary.
  const submit = async (event: FormEvent) => {
    event.preventDefault();

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
        await onAdd(input, draft.type === 'task' && canCompleteTask && draft.completeTask);
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
  };

  return {
    draft,
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
    selectProgram,
    selectCategory,
    selectTask,
    selectSession,
    updateDate,
    updateHours,
    updateNote,
    setCompleteTask,
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
