import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useSubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import { getErrorMessage } from '../../../../../../http/errors';
import type { RequestOptions } from '../../../../../../http/client';
import { getHoursSessions, type SetHoursInput } from '../../../hours.api';
import type {
  StaffReference,
  HoursCategory,
  HoursProgram,
  HoursItem,
} from '../../../types';

type HoursSource = 'regular' | 'task' | 'session';

export interface HoursTaskOption {
  id: string;
  title: string;
  state: 'open' | 'completed' | 'cancelled';
  staffId: string;
}

interface HoursDraft {
  staffId: string;
  source: HoursSource;
  programId: string;
  date: string;
  category: HoursCategory | '';
  taskId: string;
  completeTask: boolean;
  sessionId: string;
  hours: string;
  note: string;
}

export interface UseHoursModalOptions {
  staff: readonly StaffReference[];
  programs: readonly HoursProgram[];
  loadTasks: (
    staffId: string,
    opts?: RequestOptions,
  ) => Promise<readonly HoursTaskOption[]>;
  onAdd: (input: SetHoursInput) => Promise<void>;
  initialStaffId?: string;
  initialDate?: string;
  initialSource?: HoursSource;
  initialTask?: HoursTaskOption;
  initialItem?: HoursItem;
  canCompleteTask?: boolean;
}

/**
 * Owns one mounted Hours draft, its selector choices and save feedback.
 * @param options - Supplied edit row or add context and the page's save callback.
 * @example useHoursModal({ ...options, initialItem }) // initializes the edit draft once
 */
export default function useHoursModal(options: UseHoursModalOptions) {
  const { loadTasks, onAdd, initialTask, initialItem, canCompleteTask = false } = options;
  const [draft, setDraft] = useState<HoursDraft>(() => {
    let source = options.initialSource ?? 'regular';
    if (initialItem?.sessionId) source = 'session';
    if (initialTask || initialItem?.taskId) source = 'task';

    return {
      staffId: initialItem?.staffId ?? initialTask?.staffId ?? options.initialStaffId ?? '',
      source,
      programId: initialItem?.programId ?? '',
      date: initialItem?.date ?? options.initialDate ?? '',
      category: initialItem?.category ?? '',
      taskId: initialTask?.id ?? initialItem?.taskId ?? '',
      completeTask: false,
      sessionId: initialItem?.sessionId ?? '',
      hours: initialItem ? String(initialItem.hours) : '',
      note: initialItem?.note ?? '',
    };
  });
  const { submitStatus, setSubmitStatus, error, setError } = useSubmitStatus();
  const taskLocked = Boolean(initialTask);
  const submitting = submitStatus === 'submitting';
  const submitLock = useSubmitLock();

  // Source-specific remote options.
  const taskQuery = useQuery({
    queryKey: ['tasks', 'hours-options', draft.staffId],
    queryFn: ({ signal }) => loadTasks(draft.staffId, { signal }),
    enabled: draft.source === 'task' && Boolean(draft.staffId) && !taskLocked,
  });
  const taskOptions = initialTask
    ? [initialTask]
    : (taskQuery.data ?? []).filter(task => task.state === 'open');

  const sessionQuery = useQuery({
    queryKey: ['hours-sessions', draft.staffId, draft.date],
    queryFn: ({ signal }) => getHoursSessions(draft.staffId, draft.date, signal),
    enabled: draft.source === 'session' && Boolean(draft.staffId) && Boolean(draft.date),
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
      sessionId: current.source === 'session' ? '' : current.sessionId,
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
      note: draft.note.trim(),
    };
    let input: SetHoursInput;
    if (draft.source === 'task') {
      input = {
        ...shared,
        source: 'task',
        date: draft.date,
        taskId: draft.taskId,
        completeTask: canCompleteTask && draft.completeTask,
      };
    } else if (draft.source === 'session') {
      input = { ...shared, source: 'session', sessionId: draft.sessionId };
    } else {
      if (!draft.category || draft.category === 'program_delivery') {
        setError('Select a category.');
        setSubmitStatus('error');
        return;
      }
      input = {
        ...shared,
        source: 'regular',
        date: draft.date,
        programId: draft.programId || null,
        category: draft.category,
      };
    }
    if (!submitLock.tryLock()) return;

    setSubmitStatus('submitting');
    setError('');
    try {
      await onAdd(input);
      setSubmitStatus('success');
    } catch (cause) {
      setError(getErrorMessage(
        cause,
        initialItem ? 'Unable to update logged hours' : 'Unable to log hours',
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
  if (draft.source === 'task' && !draft.taskId) return 'Select a task.';
  if (draft.source === 'session' && !draft.sessionId) return 'Select a session.';

  const hours = Number(draft.hours);
  if (!Number.isFinite(hours) || hours < 0.25 || hours > 24) {
    return 'Hours must be between 0.25 and 24.';
  }
  if (!draft.note.trim()) return 'Enter a note.';
  return '';
}
