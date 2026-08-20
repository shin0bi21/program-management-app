import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';

import { dayKey } from '../../../../../components/ResourceCalendar/periods/periods';
import { useSubmitStatus } from '../../../../../hooks/useSubmitStatus';
import useSubmitLock from '../../../../../hooks/useSubmitLock';
import { getErrorMessage } from '../../../../../../http/clientErrors';
import { getTasks } from '../../../../tasks/tasks.api';
import type { Task } from '../../../../tasks/types';
import { getHoursSessions, type SetHoursInput } from '../../../hours.api';
import type {
  StaffResource,
  HoursCategory,
  HoursProgram,
  HoursItem,
} from '../../../types';

type HoursSource = 'regular' | 'task' | 'session';

interface HoursDraft {
  resourceId: string;
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
  onAdd: (input: SetHoursInput) => Promise<void>;
  initialResourceId?: string;
  initialDate?: string;
  initialSource?: HoursSource;
  initialTask?: Task;
  initialItem?: HoursItem;
  canCompleteTask?: boolean;
}

type InitialDraftOptions = Pick<UseHoursModalOptions,
  | 'resources'
  | 'programs'
  | 'initialResourceId'
  | 'initialDate'
  | 'initialSource'
  | 'initialTask'
  | 'initialItem'>;

function buildInitialDraft({
  resources,
  programs,
  initialResourceId,
  initialDate,
  initialSource = 'regular',
  initialTask,
  initialItem,
}: InitialDraftOptions): HoursDraft {
  const preferredResourceId = initialTask?.assignee.id ?? initialResourceId;
  const resourceId = preferredResourceId
    && resources.some(resource => resource.id === preferredResourceId)
    ? preferredResourceId
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
    resourceId,
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
  if (!draft.resourceId) return 'Select a staff member.';
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
    onAdd,
    initialResourceId,
    initialDate,
    initialSource = 'regular',
    initialTask,
    initialItem,
    canCompleteTask = false,
  } = options;
  const initialDraft = useMemo(() => buildInitialDraft({
    resources,
    programs,
    initialResourceId,
    initialDate,
    initialSource,
    initialTask,
    initialItem,
  }), [
    initialDate,
    initialItem,
    initialResourceId,
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
      : `new:${initialSource}:${initialResourceId ?? ''}:${initialDate ?? ''}`;
  const initializationKey = `${targetKey}:${initialDraft.resourceId}:${initialDraft.programId}`;
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
    queryKey: ['tasks', draft.resourceId, 'time-entry'],
    queryFn: ({ signal }) => getTasks({ staffId: draft.resourceId }, { signal }),
    enabled: isOpen && draft.source === 'task' && Boolean(draft.resourceId) && !taskLocked,
  });
  const taskOptions = initialTask
    ? [initialTask]
    : (taskQuery.data ?? []).filter(task => task.status === 'open');

  const sessionQuery = useQuery({
    queryKey: ['time-entry-sessions', draft.resourceId, draft.date],
    queryFn: ({ signal }) => getHoursSessions(draft.resourceId, draft.date, signal),
    enabled: isOpen && draft.source === 'session' && Boolean(draft.resourceId) && Boolean(draft.date),
  });
  const sessionOptions = sessionQuery.data ?? [];

  // Dependent field events.
  const selectResource = (resourceId: string) => {
    setDraft(current => ({ ...current, resourceId, taskId: '', sessionId: '' }));
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
      date: session?.workDate ?? current.date,
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
      staffId: draft.resourceId,
      hours: Number(draft.hours),
      note: draft.note.trim(),
    };

    try {
      const input: SetHoursInput = draft.source === 'task'
        ? {
          ...shared,
          source: 'task',
          workDate: draft.date,
          taskId: draft.taskId,
          completeTask: canCompleteTask && draft.completeTask,
        }
        : draft.source === 'session'
          ? { ...shared, source: 'session', sessionId: draft.sessionId }
          : {
            ...shared,
            source: 'regular',
            workDate: draft.date,
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
    selectResource,
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
