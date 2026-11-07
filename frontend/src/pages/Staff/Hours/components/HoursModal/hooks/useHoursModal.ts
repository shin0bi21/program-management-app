import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';

import { dayKey } from '../../../../../../common/components/TimelineCalendar/utils/periods';
import { useSubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import { getErrorMessage } from '../../../../../../http/errors';
import type { RequestOptions } from '../../../../../../http/client';
import { getHoursSessions, type SetHoursInput } from '../../../hours.api';
import type {
  StaffResource,
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
  category: Exclude<HoursCategory, 'program_delivery'>;
  taskId: string;
  completeTask: boolean;
  sessionId: string;
  hours: string;
  note: string;
}

export interface UseHoursModalOptions {
  isOpen: boolean;
  resources: readonly StaffResource[];
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

type InitialDraftOptions = Pick<UseHoursModalOptions,
  | 'resources'
  | 'programs'
  | 'initialStaffId'
  | 'initialDate'
  | 'initialSource'
  | 'initialTask'
  | 'initialItem'>;

function buildInitialDraft({
  resources,
  programs,
  initialStaffId,
  initialDate,
  initialSource = 'regular',
  initialTask,
  initialItem,
}: InitialDraftOptions): HoursDraft {
  const preferredStaffId = initialTask?.staffId ?? initialStaffId;
  const staffId = preferredStaffId
    && resources.some(resource => resource.id === preferredStaffId)
    ? preferredStaffId
    : resources[0]?.id ?? '';
  const programId = initialItem?.programId
    && programs.some(program => program.id === initialItem.programId)
    ? initialItem.programId
    : '';
  const source = initialTask || initialItem?.taskId
    ? 'task'
    : initialItem?.sessionId
      ? 'session'
      : initialSource;

  return {
    staffId,
    source,
    programId,
    date: initialDate ?? dayKey(new Date()),
    category: initialItem?.category && initialItem.category !== 'program_delivery'
      ? initialItem.category
      : 'planning_prep',
    taskId: initialTask?.id ?? initialItem?.taskId ?? '',
    completeTask: false,
    sessionId: initialItem?.sessionId ?? '',
    hours: initialItem ? String(initialItem.hours) : '1',
    note: initialItem?.note ?? '',
  };
}

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

export default function useHoursModal(options: UseHoursModalOptions) {
  const {
    isOpen,
    resources,
    programs,
    loadTasks,
    onAdd,
    initialStaffId,
    initialDate,
    initialSource = 'regular',
    initialTask,
    initialItem,
    canCompleteTask = false,
  } = options;
  const initialDraft = useMemo(() => buildInitialDraft({
    resources,
    programs,
    initialStaffId,
    initialDate,
    initialSource,
    initialTask,
    initialItem,
  }), [
    initialDate,
    initialItem,
    initialStaffId,
    initialSource,
    initialTask,
    programs,
    resources,
  ]);
  const initialDraftRef = useRef(initialDraft);
  const [draft, setDraft] = useState(initialDraft);
  const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
  const taskLocked = Boolean(initialTask);
  const submitting = submitStatus === 'submitting';
  const targetKey = initialItem
    ? `entry:${initialItem.id}`
    : initialTask
      ? `task:${initialTask.id}`
      : `new:${initialSource}:${initialStaffId ?? ''}:${initialDate ?? ''}`;
  const initializationKey = `${targetKey}:${initialDraft.staffId}:${initialDraft.programId}`;
  const submitLock = useSubmitLock();
  initialDraftRef.current = initialDraft;

  // Reopening or changing the target starts a fresh form lifecycle.
  useEffect(() => {
    if (isOpen) {
      setDraft(initialDraftRef.current);
      resetStatus();
    }
  }, [initializationKey, isOpen, resetStatus]);

  // Source-specific remote options.
  const taskQuery = useQuery({
    queryKey: ['tasks', 'hours-options', draft.staffId],
    queryFn: ({ signal }) => loadTasks(draft.staffId, { signal }),
    enabled: isOpen && draft.source === 'task' && Boolean(draft.staffId) && !taskLocked,
  });
  const taskOptions = initialTask
    ? [initialTask]
    : (taskQuery.data ?? []).filter(task => task.state === 'open');

  const sessionQuery = useQuery({
    queryKey: ['hours-sessions', draft.staffId, draft.date],
    queryFn: ({ signal }) => getHoursSessions(draft.staffId, draft.date, signal),
    enabled: isOpen && draft.source === 'session' && Boolean(draft.staffId) && Boolean(draft.date),
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

    if (!submitLock.tryLock()) return;

    setSubmitStatus('submitting');
    setError('');
    const shared = {
      staffId: draft.staffId,
      hours: Number(draft.hours),
      note: draft.note.trim(),
    };

    try {
      const input: SetHoursInput = draft.source === 'task'
        ? {
          ...shared,
          source: 'task',
          date: draft.date,
          taskId: draft.taskId,
          completeTask: canCompleteTask && draft.completeTask,
        }
        : draft.source === 'session'
          ? { ...shared, source: 'session', sessionId: draft.sessionId }
          : {
            ...shared,
            source: 'regular',
            date: draft.date,
            programId: draft.programId || null,
            category: draft.category,
      };
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
