import { FormEvent, useEffect, useState } from 'react';
import Button from '../../../common/components/Button/Button';
import FloatingSelect from '../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../common/components/FormField/FormField';
import Modal from '../../../common/components/Modal/Modal';
import { generateSessions } from '../../../common/api/cohorts.api';
import type { SubmitStatus } from '../../../common/hooks/useSubmitStatus';
import type { GenerateSessionsInput, ProgramCohort } from '../../../common/types/cohort';

interface GenerateSessionsModalProps {
  cohort: ProgramCohort | null;
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

const ordinal = (day: number) => {
  if (day >= 11 && day <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
};

export default function GenerateSessionsModal({ cohort, onClose, onSuccess }: GenerateSessionsModalProps) {
  const [frequency, setFrequency] = useState<GenerateSessionsInput['frequency']>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState<NonNullable<GenerateSessionsInput['dayOfWeek']>>('tuesday');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!cohort) return;
    setSubmitStatus('idle');
    setStatusMessage('');
  }, [cohort]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cohort) return;
    const form = new FormData(event.currentTarget);
    setSubmitStatus('submitting');
    setStatusMessage(`Adding sessions for ${cohort.programName} - ${cohort.name}...`);
    try {
      const result = await generateSessions(cohort.id, {
        name: String(form.get('name')),
        focus: String(form.get('focus')).trim() || null,
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
        + `${cohort.programName} - ${cohort.name}.`,
      );
      setSubmitStatus('success');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not generate sessions';
      setStatusMessage(message);
      setSubmitStatus('error');
    }
  };

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';

  return (
    <Modal
      isOpen={cohort !== null}
      onClose={onClose}
      title={`Add sessions for ${cohort?.name ?? ''}`}
      status={submitStatus}
      statusMessage={statusMessage}
      successDelay={1400}
      disableClose={submitStatus === 'submitting'}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={submissionComplete}>Cancel</Button>
        <Button type="submit" form="generate-sessions-form" disabled={submissionComplete}>Add Sessions</Button>
      </>}
      maxWidth="620px"
    >
      <form id="generate-sessions-form" onSubmit={event => void submit(event)}>
        <div className="form-row">
          <FormField id="activity-name" label="Activity">
            <input id="activity-name" name="name" required maxLength={120} placeholder="Weekly Soft Skills" />
          </FormField>
          <FormField id="session-focus" label="Focus">
            <input id="session-focus" name="focus" maxLength={160} placeholder="Communication" />
          </FormField>
        </div>
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
              min={cohort?.startsOn}
              max={cohort?.endsOn}
              defaultValue={cohort?.startsOn}
            />
          </FormField>
          {frequency !== 'once' && (
            <FormField id="sessions-end-on" label="Ends on">
              <input
                id="sessions-end-on"
                name="endsOn"
                type="date"
                required
                min={cohort?.startsOn}
                max={cohort?.endsOn}
                defaultValue={cohort?.endsOn}
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
