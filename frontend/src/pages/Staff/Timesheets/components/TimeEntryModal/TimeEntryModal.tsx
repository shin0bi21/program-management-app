import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../../../common/components/Button/Button';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import { dayKey } from '../../../../../common/components/ResourceCalendar/periods';
import { getErrorMessage } from '../../../../../http/clientErrors';
import type { StaffResource, TimeEntryProgram, TimeEntryTask, TimesheetItem } from '../../types';
import { getTimeEntryCohorts } from '../../api/timeEntries.api';
import { TIME_ENTRY_TASK_OPTIONS } from '../../timeEntryOptions';
import './TimeEntryModal.css';

interface TimeEntryModalProps {
  isOpen: boolean;
  resources: readonly StaffResource[];
  programs: readonly TimeEntryProgram[];
  onClose: () => void;
  onAdd: (input: { staffId: string; programId: string | null; cohortId: string | null; task: TimeEntryTask; workDate: string; hours: number; note: string }) => Promise<void>;
  initialResourceId?: string;
  initialDate?: string;
  initialItem?: TimesheetItem;
}

export default function TimeEntryModal({
  isOpen,
  resources,
  programs,
  onClose,
  onAdd,
  initialResourceId,
  initialDate,
  initialItem,
}: TimeEntryModalProps) {
  const [resourceId, setResourceId] = useState(resources[0]?.id ?? '');
  const [programId, setProgramId] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [date, setDate] = useState(dayKey(new Date()));
  const [task, setTask] = useState<TimeEntryTask>('programming');
  const [hours, setHours] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const shouldDefaultCohortRef = useRef(false);
  const cohortQuery = useQuery({
    queryKey: ['time-entry-cohorts', programId],
    queryFn: ({ signal }) => getTimeEntryCohorts(programId, signal),
    enabled: isOpen && Boolean(programId),
  });
  const cohorts = cohortQuery.data ?? [];
  const status = error ? 'error' : submitting ? 'submitting' : 'idle';
  const statusMessage = error
    || (submitting ? (initialItem ? 'Updating time entry...' : 'Adding time entry...') : undefined);

  useEffect(() => {
    if (!shouldDefaultCohortRef.current || !cohortQuery.data) return;
    setCohortId(cohortQuery.data.find(cohort => cohort.state === 'active')?.id ?? '');
    shouldDefaultCohortRef.current = false;
  }, [cohortQuery.data]);

  useEffect(() => {
    if (!isOpen) return;
    setResourceId(initialResourceId && resources.some(resource => resource.id === initialResourceId)
      ? initialResourceId
      : resources[0]?.id ?? '');
    setProgramId(initialItem?.programId && programs.some(program => program.id === initialItem.programId)
      ? initialItem.programId
      : '');
    setCohortId(initialItem?.cohortId ?? '');
    shouldDefaultCohortRef.current = false;
    setDate(initialDate ?? dayKey(new Date()));
    setTask(initialItem?.task ?? 'programming');
    setHours(initialItem ? String(initialItem.hours) : '1');
    setNote(initialItem?.note ?? '');
    setError('');
  }, [initialDate, initialItem, initialResourceId, isOpen, programs, resources]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onAdd({ staffId: resourceId, programId: programId || null, cohortId: cohortId || null, task, workDate: date, hours: Number(hours), note: note.trim() });
      setNote('');
      onClose();
    } catch (cause) {
      setError(getErrorMessage(cause, initialItem ? 'Unable to update time entry' : 'Unable to add time entry'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialItem ? 'Edit time entry' : 'Add time entry'}
      maxWidth="620px"
      status={status}
      statusMessage={statusMessage}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form="time-entry-form" disabled={submitting || !resources.length}>
            {initialItem ? 'Save changes' : 'Add entry'}
          </Button>
        </>
      )}
    >
      <form id="time-entry-form" className="time-entry-form" onSubmit={submit}>
        <FormField id="time-entry-staff" label="Staff member">
          <FloatingSelect
            id="time-entry-staff"
            value={resourceId}
            options={resources.map(resource => ({ value: resource.id, label: resource.name }))}
            onChange={setResourceId}
            placeholder="Select staff member"
            ariaLabel="Staff member"
            disabled={submitting || resources.length === 0}
          />
        </FormField>
        <FormField id="time-entry-date" label="Date">
          <input id="time-entry-date" type="date" value={date} onChange={event => setDate(event.target.value)} required />
        </FormField>
        <FormField id="time-entry-program" label="Program (optional)">
          <FloatingSelect
            id="time-entry-program"
            value={programId}
            options={[{ value: '', label: 'General' }, ...programs.map(program => ({ value: program.id, label: program.name }))]}
            onChange={value => {
              setProgramId(value);
              setCohortId('');
              shouldDefaultCohortRef.current = Boolean(value);
            }}
            placeholder="General"
            ariaLabel="Program"
            disabled={submitting}
          />
        </FormField>
        {programId && <FormField
          id="time-entry-cohort"
          label="Cohort (optional)"
          error={cohortQuery.error ? 'Unable to load cohorts' : undefined}
        >
          <FloatingSelect
            id="time-entry-cohort"
            value={cohortId}
            options={cohorts.length
              ? [{ value: '', label: 'No cohort' }, ...cohorts.map(cohort => ({ value: cohort.id, label: cohort.name }))]
              : []}
            onChange={setCohortId}
            placeholder={cohortQuery.isLoading ? 'Loading cohorts…' : cohorts.length ? 'No cohort' : 'No cohorts for this program'}
            ariaLabel="Cohort"
            disabled={submitting || cohortQuery.isLoading || cohorts.length === 0}
          />
        </FormField>}
        <FormField id="time-entry-task" label="Task">
          <FloatingSelect
            id="time-entry-task"
            value={task}
            options={TIME_ENTRY_TASK_OPTIONS}
            onChange={value => setTask(value as TimeEntryTask)}
            ariaLabel="Task"
            disabled={submitting}
          />
        </FormField>
        <FormField id="time-entry-hours" label="Hours">
          <input id="time-entry-hours" type="number" min="0.25" max="24" step="0.25" value={hours} onChange={event => setHours(event.target.value)} required />
        </FormField>
        <div className="time-entry-form__note">
          <FormField id="time-entry-note" label="Note">
            <textarea id="time-entry-note" value={note} onChange={event => setNote(event.target.value)} rows={5} maxLength={2000} required />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
