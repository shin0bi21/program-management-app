import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import { type GenerateSessionsInput } from '../../types';
import { type ProgramCohort } from '../../../Cohorts/types';
import useGenerateSessionsModal from './hooks/useGenerateSessionsModal';

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
  const workflow = useGenerateSessionsModal({ cohort, cohorts, open, initialCohortId, onSuccess });

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={cohort ? `Add Sessions for ${cohort.name}` : 'Add Sessions'}
      status={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      successDelay={1400}
      footer={(
        <ModalFormFooter
          formId="generate-sessions-form"
          submitLabel="Add Sessions"
          submitStatus={workflow.submitStatus}
          submitDisabled={!workflow.selectedCohort || !workflow.draft.sessionTypeId}
          onClose={onClose}
        />
      )}
      maxWidth="620px"
    >
      <form
        id="generate-sessions-form"
        aria-busy={workflow.submissionComplete}
        onSubmit={(event) => {
          event.preventDefault();
          void workflow.submit();
        }}
      >
        {!cohort && (
          <FormField id="session-cohort" label="Cohort">
            <FloatingSelect
              id="session-cohort"
              value={workflow.selectedCohortId}
              onChange={workflow.updateSelectedCohort}
              disabled={workflow.submissionComplete}
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
            value={workflow.draft.sessionTypeId}
            onChange={value => workflow.updateDraft('sessionTypeId', value)}
            disabled={workflow.submissionComplete}
            placeholder="Choose a type"
            options={workflow.sessionTypes.map(type => ({ value: type.id, label: type.name }))}
          />
        </FormField>
        <FormField id="session-theme" label="Title / Theme">
          <input
            id="session-theme"
            name="theme"
            required
            maxLength={160}
            placeholder="Communication"
            value={workflow.draft.theme}
            disabled={workflow.submissionComplete}
            onChange={event => workflow.updateDraft('theme', event.target.value)}
          />
        </FormField>
        <div className="form-row">
          <FormField id="session-frequency" label="Frequency">
            <FloatingSelect
              id="session-frequency"
              value={workflow.draft.frequency}
              onChange={value => workflow.updateDraft('frequency', value as GenerateSessionsInput['frequency'])}
              disabled={workflow.submissionComplete}
              options={[
                { value: 'once', label: 'One time' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'biweekly', label: 'Biweekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
          </FormField>
          {(workflow.draft.frequency === 'weekly' || workflow.draft.frequency === 'biweekly') && (
            <FormField id="session-day-of-week" label="Day of week">
              <FloatingSelect
                id="session-day-of-week"
                value={workflow.draft.dayOfWeek}
                onChange={value => workflow.updateDraft('dayOfWeek', value as NonNullable<GenerateSessionsInput['dayOfWeek']>)}
                disabled={workflow.submissionComplete}
                options={weekdays.map(day => ({
                  value: day,
                  label: day[0].toUpperCase() + day.slice(1),
                }))}
              />
            </FormField>
          )}
          {workflow.draft.frequency === 'monthly' && (
            <FormField id="session-day-of-month" label="Day of month">
              <FloatingSelect
                id="session-day-of-month"
                value={workflow.draft.dayOfMonth}
                onChange={value => workflow.updateDraft('dayOfMonth', value)}
                disabled={workflow.submissionComplete}
                options={Array.from({ length: 31 }, (_, index) => ({
                  value: String(index + 1),
                  label: ordinal(index + 1),
                }))}
              />
            </FormField>
          )}
        </div>
        <div className="form-row">
          <FormField id="sessions-start-on" label={workflow.draft.frequency === 'once' ? 'Session date' : 'Start Date'}>
            <input
              id="sessions-start-on"
              name="startsOn"
              type="date"
              required
              min={workflow.selectedCohort?.startsOn}
              max={workflow.selectedCohort?.endsOn}
              value={workflow.draft.startsOn}
              disabled={workflow.submissionComplete}
              onChange={event => workflow.updateDraft('startsOn', event.target.value)}
            />
          </FormField>
          {workflow.draft.frequency !== 'once' && (
            <FormField id="sessions-end-on" label="End Date">
              <input
                id="sessions-end-on"
                name="endsOn"
                type="date"
                required
                min={workflow.selectedCohort?.startsOn}
                max={workflow.selectedCohort?.endsOn}
                value={workflow.draft.endsOn}
                disabled={workflow.submissionComplete}
                onChange={event => workflow.updateDraft('endsOn', event.target.value)}
              />
            </FormField>
          )}
        </div>
        <div className="form-row">
          <FormField id="session-start-time" label="Start time">
            <input
              id="session-start-time"
              name="startTime"
              type="time"
              required
              value={workflow.draft.startTime}
              disabled={workflow.submissionComplete}
              onChange={event => workflow.updateDraft('startTime', event.target.value)}
            />
          </FormField>
          <FormField id="session-end-time" label="End time">
            <input
              id="session-end-time"
              name="endTime"
              type="time"
              required
              value={workflow.draft.endTime}
              disabled={workflow.submissionComplete}
              onChange={event => workflow.updateDraft('endTime', event.target.value)}
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
