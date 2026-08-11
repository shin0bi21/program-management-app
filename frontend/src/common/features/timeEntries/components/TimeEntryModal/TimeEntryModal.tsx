import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../../components/Button/Button';
import FloatingSelect from '../../../../components/FloatingSelect/FloatingSelect';
import FormField from '../../../../components/FormField/FormField';
import Modal from '../../../../components/Modal/Modal';
import { dayKey } from '../../../../components/ResourceCalendar/periods';
import { getErrorMessage } from '../../../../../http/clientErrors';
import { getTasks } from '../../../tasks/api/tasks.api';
import type { Task } from '../../../tasks/types';
import { getTimeEntryCohorts, getTimeEntrySessions, type SetTimeEntryInput } from '../../api/timeEntries.api';
import { OTHER_TIME_ENTRY_CATEGORY_OPTIONS } from '../../timeEntryOptions';
import type { StaffResource, TimeEntryCategory, TimeEntryCycle, TimeEntryProgram, TimesheetItem } from '../../types';
import './TimeEntryModal.css';

interface TimeEntryModalProps {
  isOpen: boolean;
  resources: readonly StaffResource[];
  programs: readonly TimeEntryProgram[];
  cycles: readonly TimeEntryCycle[];
  onClose: () => void;
  onAdd: (input: SetTimeEntryInput) => Promise<void>;
  initialResourceId?: string;
  initialDate?: string;
  initialSource?: 'other' | 'task' | 'session';
  initialTask?: Task;
  initialItem?: TimesheetItem;
}

export default function TimeEntryModal({
  isOpen, resources, programs, cycles: allCycles, onClose, onAdd,
  initialResourceId, initialDate, initialSource = 'other', initialTask, initialItem,
}: TimeEntryModalProps) {
  const [resourceId, setResourceId] = useState(resources[0]?.id ?? '');
  const [entrySource, setEntrySource] = useState<'other' | 'task' | 'session'>('other');
  const [programId, setProgramId] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [date, setDate] = useState(dayKey(new Date()));
  const [category, setCategory] = useState<Exclude<TimeEntryCategory, 'program_delivery'>>('planning_prep');
  const [taskId, setTaskId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [hours, setHours] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const shouldDefaultCohortRef = useRef(false);
  const taskLocked = Boolean(initialTask);
  const cohortQuery = useQuery({
    queryKey: ['time-entry-cohorts', programId],
    queryFn: ({ signal }) => getTimeEntryCohorts(programId, signal),
    enabled: isOpen && entrySource === 'other' && Boolean(programId),
  });
  const taskQuery = useQuery({
    queryKey: ['tasks', resourceId, 'time-entry'],
    queryFn: ({ signal }) => getTasks({ staffId: resourceId }, { signal }),
    enabled: isOpen && entrySource === 'task' && Boolean(resourceId) && !taskLocked,
  });
  const taskOptions = initialTask
    ? [initialTask]
    : (taskQuery.data ?? []).filter(task => task.status === 'todo' || task.status === 'in_progress');
  const sessionQuery = useQuery({
    queryKey: ['time-entry-sessions', resourceId, date],
    queryFn: ({ signal }) => getTimeEntrySessions(resourceId, date, signal),
    enabled: isOpen && entrySource === 'session' && Boolean(resourceId) && Boolean(date),
  });
  const sessionOptions = sessionQuery.data ?? [];
  const programCycles = cohortQuery.data ?? [];
  const cycles = programId
    ? programCycles.map(cycle => ({ id: cycle.cycleId, name: cycle.name, state: cycle.state }))
    : allCycles;
  const status = error ? 'error' : submitting ? 'submitting' : 'idle';
  const statusMessage = error || (submitting ? (initialItem ? 'Updating time entry...' : 'Adding time entry...') : undefined);
  const selectProgram = (value: string) => {
    setProgramId(value);
    if (value) { setCycleId(''); shouldDefaultCohortRef.current = true; }
    else shouldDefaultCohortRef.current = false;
  };

  useEffect(() => {
    if (!shouldDefaultCohortRef.current || !cohortQuery.data) return;
    setCycleId(cohortQuery.data.find(cycle => cycle.state === 'active')?.cycleId ?? '');
    shouldDefaultCohortRef.current = false;
  }, [cohortQuery.data]);

  useEffect(() => {
    if (!isOpen) return;
    const preferredResourceId = initialTask?.assignee.id ?? initialResourceId;
    setResourceId(preferredResourceId && resources.some(resource => resource.id === preferredResourceId)
      ? preferredResourceId : resources[0]?.id ?? '');
    setProgramId(initialItem?.programId && programs.some(program => program.id === initialItem.programId) ? initialItem.programId : '');
    setCycleId(initialItem?.cycleId ?? allCycles.find(cycle => cycle.state === 'active')?.id ?? allCycles[0]?.id ?? '');
    shouldDefaultCohortRef.current = false;
    setDate(initialDate ?? dayKey(new Date()));
    setEntrySource(initialTask || initialItem?.taskId ? 'task' : initialItem?.sessionId ? 'session' : initialSource);
    setCategory(initialItem?.category && initialItem.category !== 'program_delivery' ? initialItem.category : 'planning_prep');
    setTaskId(initialTask?.id ?? initialItem?.taskId ?? '');
    setSessionId(initialItem?.sessionId ?? '');
    setHours(initialItem ? String(initialItem.hours) : '1');
    setNote(initialItem?.note ?? '');
    setError('');
  }, [allCycles, initialDate, initialItem, initialResourceId, initialSource, initialTask, isOpen, programs, resources]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError('');
    try {
      const shared = { staffId: resourceId, hours: Number(hours), note: note.trim() };
      await onAdd(entrySource === 'task' ? { ...shared, source: 'task', workDate: date, taskId }
        : entrySource === 'session' ? { ...shared, source: 'session', sessionId }
          : { ...shared, source: 'other', workDate: date, programId: programId || null, cycleId, category });
      setNote(''); onClose();
    } catch (cause) { setError(getErrorMessage(cause, initialItem ? 'Unable to update time entry' : 'Unable to add time entry')); }
    finally { setSubmitting(false); }
  };

  return <Modal isOpen={isOpen} onClose={onClose} title={initialItem ? 'Edit time entry' : 'Add time entry'} maxWidth="620px"
    status={status} statusMessage={statusMessage} footer={<>
      <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
      <Button type="submit" form="time-entry-form" disabled={submitting || !resources.length || (entrySource === 'task' ? !taskId : entrySource === 'session' ? !sessionId : !cycleId)}>{initialItem ? 'Save changes' : 'Add entry'}</Button>
    </>}>
    <form id="time-entry-form" className="time-entry-form" onSubmit={submit}>
      <FormField id="time-entry-staff" label="Staff member"><FloatingSelect id="time-entry-staff" value={resourceId}
        options={resources.map(resource => ({ value: resource.id, label: resource.name }))}
        onChange={value => { setResourceId(value); setTaskId(''); setSessionId(''); }} placeholder="Select staff member" ariaLabel="Staff member"
        disabled={submitting || resources.length === 0 || taskLocked} /></FormField>
      <FormField id="time-entry-date" label="Date"><input id="time-entry-date" type="date" value={date}
        onChange={event => { setDate(event.target.value); if (entrySource === 'session') setSessionId(''); }}
        required disabled={entrySource === 'session' && Boolean(initialDate)} /></FormField>
      {entrySource === 'task' && <FormField id="time-entry-assigned-task" label="Task *" error={taskQuery.error ? 'Unable to load assigned tasks' : undefined}>
        <FloatingSelect id="time-entry-assigned-task" value={taskId}
          options={taskOptions.map(task => ({
            value: task.id,
            label: task.title,
          }))}
          onChange={setTaskId} placeholder={taskQuery.isLoading ? 'Loading assigned tasks…' : 'Select assigned task'} ariaLabel="Task"
          disabled={submitting || taskQuery.isLoading || taskLocked} /></FormField>}
      {entrySource === 'session' && <FormField id="time-entry-session" label="Session *" error={sessionQuery.error ? 'Unable to load sessions' : undefined}>
        <FloatingSelect id="time-entry-session" value={sessionId}
          options={sessionOptions.map(session => ({ value: session.id, label: session.label }))}
          onChange={value => {
            setSessionId(value);
            const session = sessionOptions.find(option => option.id === value);
            if (session) setDate(session.workDate);
          }} placeholder={sessionQuery.isLoading ? 'Loading sessions…' : !sessionOptions.length ? 'No sessions on this date' : 'Select session'} ariaLabel="Session"
          disabled={submitting || sessionQuery.isLoading} /></FormField>}
      {entrySource === 'other' && <FormField id="time-entry-program" label="Program (optional)"><FloatingSelect id="time-entry-program" value={programId}
        options={programs.map(program => ({ value: program.id, label: program.name }))} onChange={selectProgram} placeholder="Select a program" ariaLabel="Program" disabled={submitting}
        action={programId ? { label: 'Clear program', onSelect: () => selectProgram('') } : undefined} /></FormField>}
      {entrySource === 'other' && <FormField id="time-entry-cohort" label="Cycle *" error={programId && cohortQuery.error ? 'Unable to load cycles' : undefined}>
        <FloatingSelect id="time-entry-cohort" value={cycleId} options={cycles.map(cycle => ({ value: cycle.id, label: cycle.name }))} onChange={setCycleId}
          placeholder={programId && cohortQuery.isLoading ? 'Loading cycles…' : 'No cycles available'} ariaLabel="Cycle"
          disabled={submitting || (programId && cohortQuery.isLoading) || cycles.length === 0} /></FormField>}
      {entrySource === 'other' && <FormField id="time-entry-category" label="Category *"><FloatingSelect id="time-entry-category" value={category}
        options={OTHER_TIME_ENTRY_CATEGORY_OPTIONS} onChange={value => { setCategory(value as Exclude<TimeEntryCategory, 'program_delivery'>); setTaskId(''); }} ariaLabel="Category" disabled={submitting} /></FormField>}
      <FormField id="time-entry-hours" label="Hours"><input id="time-entry-hours" type="number" min="0.25" max="24" step="0.25" value={hours} onChange={event => setHours(event.target.value)} required /></FormField>
      <div className="time-entry-form__note"><FormField id="time-entry-note" label="Note"><textarea id="time-entry-note" value={note} onChange={event => setNote(event.target.value)} rows={5} maxLength={2000} required /></FormField></div>
    </form>
  </Modal>;
}
