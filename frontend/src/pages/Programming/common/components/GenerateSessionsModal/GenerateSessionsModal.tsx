import { FormEvent, useEffect, useState } from 'react';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import { generateSessions } from '../../../../../common/api/cohorts.api';
import type { SubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import {
  REGULAR_SESSION_TYPE_ID,
  type GenerateSessionsInput,
  type ProgramCohort,
} from '../../../../../common/types/cohort';
import { useSessionTypes } from '../../hooks/useSessionTypes';

interface GenerateSessionsModalProps {
  cohort: ProgramCohort | null;
  cohorts?: ProgramCohort[];
  isOpen?: boolean;
  initialCohortId?: string;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

const weekdays: Array<NonNullable<GenerateSessionsInput['dayOfWeek']>> = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];
const noCohorts: ProgramCohort[] = [];

const ordinal = (day: number) => {
  if (day >= 11 && day <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
};

export default function GenerateSessionsModal({
  cohort,
  cohorts = noCohorts,
  isOpen,
  initialCohortId,
  onClose,
  onSuccess,
}: GenerateSessionsModalProps) {
  const open = isOpen ?? cohort !== null;
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const sessionTypes = useSessionTypes();
  const [sessionTypeId, setSessionTypeId] = useState(REGULAR_SESSION_TYPE_ID);
  const [frequency, setFrequency] = useState<GenerateSessionsInput['frequency']>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState<NonNullable<GenerateSessionsInput['dayOfWeek']>>('tuesday');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const selectedCohort = cohort
    ?? cohorts.find(candidate => candidate.id === selectedCohortId)
    ?? null;

  useEffect(() => {
    if (!open) return;
    setSelectedCohortId(
      cohort?.id
      ?? (initialCohortId && cohorts.some(candidate => candidate.id === initialCohortId)
        ? initialCohortId
        : cohorts[0]?.id)
      ?? '',
    );
    setSubmitStatus('idle');
    setStatusMessage('');
  }, [cohort, cohorts, initialCohortId, open]);

  useEffect(() => {
    if (!open || !sessionTypes.length) return;
    setSessionTypeId(current => (
      sessionTypes.some(type => type.id === current)
        ? current
        : sessionTypes.find(type => type.name === 'Regular')?.id ?? sessionTypes[0].id
    ));
  }, [open, sessionTypes]);

  useEffect(() => {
    if (!selectedCohort) return;
    setStartsOn(selectedCohort.startsOn);
    setEndsOn(selectedCohort.endsOn);
  }, [selectedCohort?.id]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCohort) return;
    const form = new FormData(event.currentTarget);
    setSubmitStatus('submitting');
    setStatusMessage(`Adding sessions for ${selectedCohort.programName} - ${selectedCohort.name}...`);
    try {
      const result = await generateSessions(selectedCohort.id, {
        sessionTypeId,
        theme: String(form.get('theme')).trim() || null,
        frequency,
        ...((frequency === 'weekly' || frequency === 'biweekly') && { dayOfWeek }),
        ...(frequency === 'monthly' && { dayOfMonth: Number(dayOfMonth) }),
        startsOn: String(form.get('startsOn')),
        ...(frequency !== 'once' && { endsOn: String(form.get('endsOn')) }),
        startTime: String(form.get('startTime')),
        endTime: String(form.get('endTime')),
      });
      await onSuccess();
      const sessionCount = result.sessions.length;
      setStatusMessage(
        `${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'} successfully added to `
        + `${selectedCohort.programName} - ${selectedCohort.name}.`,
      );
      setSubmitStatus('success');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not generate sessions';
      setStatusMessage(message);
      setSubmitStatus('error');
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={cohort ? `Add sessions for ${cohort.name}` : 'Add sessions'}
      status={submitStatus}
      statusMessage={statusMessage}
      successDelay={1400}
      disableClose={submitStatus === 'submitting'}
      footer={(
        <ModalFormFooter
          formId="generate-sessions-form"
          submitLabel="Add Sessions"
          submitStatus={submitStatus}
          submitDisabled={!selectedCohort || !sessionTypeId}
          onClose={onClose}
        />
      )}
      maxWidth="620px"
    >
      <form id="generate-sessions-form" onSubmit={event => void submit(event)}>
        {!cohort && (
          <FormField id="session-cohort" label="Cohort">
            <FloatingSelect
              id="session-cohort"
              value={selectedCohortId}
              onChange={setSelectedCohortId}
              placeholder="Choose a cohort"
              options={cohorts.map(candidate => ({
                value: candidate.id,
                label: `${candidate.programName} · ${candidate.name}`,
              }))}
            />
          </FormField>
        )}
        <FormField id="session-type" label="Type">
          <FloatingSelect
            id="session-type"
            value={sessionTypeId}
            onChange={setSessionTypeId}
            placeholder="Choose a type"
            options={sessionTypes.map(type => ({ value: type.id, label: type.name }))}
          />
        </FormField>
        <FormField id="session-theme" label="Theme (optional)">
          <input id="session-theme" name="theme" maxLength={160} placeholder="Communication" />
        </FormField>
        <div className="form-row">
          <FormField id="session-frequency" label="Frequency">
            <FloatingSelect
              id="session-frequency"
              value={frequency}
              onChange={value => setFrequency(value as GenerateSessionsInput['frequency'])}
              options={[
                { value: 'once', label: 'One time' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'biweekly', label: 'Biweekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
          </FormField>
          {(frequency === 'weekly' || frequency === 'biweekly') && (
            <FormField id="session-day-of-week" label="Day of week">
              <FloatingSelect
                id="session-day-of-week"
                value={dayOfWeek}
                onChange={value => setDayOfWeek(value as NonNullable<GenerateSessionsInput['dayOfWeek']>)}
                options={weekdays.map(day => ({
                  value: day,
                  label: day[0].toUpperCase() + day.slice(1),
                }))}
              />
            </FormField>
          )}
          {frequency === 'monthly' && (
            <FormField id="session-day-of-month" label="Day of month">
              <FloatingSelect
                id="session-day-of-month"
                value={dayOfMonth}
                onChange={setDayOfMonth}
                options={Array.from({ length: 31 }, (_, index) => ({
                  value: String(index + 1),
                  label: ordinal(index + 1),
                }))}
              />
            </FormField>
          )}
        </div>
        <div className="form-row">
          <FormField id="sessions-start-on" label={frequency === 'once' ? 'Session date' : 'Schedule starts'}>
            <input
              id="sessions-start-on"
              name="startsOn"
              type="date"
              required
              min={selectedCohort?.startsOn}
              max={selectedCohort?.endsOn}
              value={startsOn}
              onChange={event => setStartsOn(event.target.value)}
            />
          </FormField>
          {frequency !== 'once' && (
            <FormField id="sessions-end-on" label="Ends on">
              <input
                id="sessions-end-on"
                name="endsOn"
                type="date"
                required
                min={selectedCohort?.startsOn}
                max={selectedCohort?.endsOn}
                value={endsOn}
                onChange={event => setEndsOn(event.target.value)}
              />
            </FormField>
          )}
        </div>
        <div className="form-row">
          <FormField id="session-start-time" label="Start time">
            <input id="session-start-time" name="startTime" type="time" required defaultValue="17:00" />
          </FormField>
          <FormField id="session-end-time" label="End time">
            <input id="session-end-time" name="endTime" type="time" required defaultValue="19:30" />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
