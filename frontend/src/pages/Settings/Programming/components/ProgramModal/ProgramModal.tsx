import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { Program, ProgramWeekday } from '../../../../../common/features/programs/types';
import useProgramModal from './hooks/useProgramModal';

interface ProgramModalProps {
  isOpen: boolean;
  program: Program | null;
  onClose: () => void;
  onSaved: (program: Program) => void;
}

export default function ProgramModal({ isOpen, program, onClose, onSaved }: ProgramModalProps) {
  const workflow = useProgramModal({ isOpen, program, onSaved });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={program ? 'Edit Program' : 'Add Program'}
      status={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      successDelay={1400}
      footer={(
        <ModalFormFooter
          formId="program-form"
          submitLabel={program ? 'Save Changes' : 'Add Program'}
          submitStatus={workflow.submitStatus}
          onClose={onClose}
        />
      )}
    >
      <form
        id="program-form"
        aria-busy={workflow.submissionComplete}
        onSubmit={(event) => {
          event.preventDefault();
          void workflow.submit();
        }}
      >
        <FormField id="program-name" label="Program Name">
          <input
            id="program-name"
            name="name"
            required
            maxLength={120}
            value={workflow.draft.name}
            disabled={workflow.submissionComplete}
            onChange={event => workflow.updateDraft('name', event.target.value)}
          />
        </FormField>
        <FormField id="program-description" label="Description">
          <textarea
            id="program-description"
            name="description"
            rows={4}
            maxLength={2000}
            value={workflow.draft.description}
            disabled={workflow.submissionComplete}
            onChange={event => workflow.updateDraft('description', event.target.value)}
          />
        </FormField>
        <div className="form-row">
          <FormField id="program-min-age" label="Minimum Age">
            <input
              id="program-min-age"
              name="minAge"
              type="number"
              min={0}
              max={30}
              value={workflow.draft.minAge}
              disabled={workflow.submissionComplete}
              onChange={event => workflow.updateDraft('minAge', event.target.value)}
            />
          </FormField>
          <FormField id="program-max-age" label="Maximum Age">
            <input
              id="program-max-age"
              name="maxAge"
              type="number"
              min={0}
              max={30}
              value={workflow.draft.maxAge}
              disabled={workflow.submissionComplete}
              onChange={event => workflow.updateDraft('maxAge', event.target.value)}
            />
          </FormField>
        </div>
        <FormField id="program-default-weekday" label="Default Session Day">
          <FloatingSelect
            id="program-default-weekday"
            value={workflow.draft.defaultDayOfWeek}
            disabled={workflow.submissionComplete}
            onChange={value => workflow.updateDraft('defaultDayOfWeek', value as ProgramWeekday)}
            options={['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => ({
              value: day,
              label: day[0].toUpperCase() + day.slice(1),
            }))}
          />
        </FormField>
        <div className="form-row">
          <FormField id="program-default-start" label="Default Start Time">
            <input
              id="program-default-start"
              type="time"
              required
              value={workflow.draft.defaultStartTime}
              disabled={workflow.submissionComplete}
              onChange={event => workflow.updateDraft('defaultStartTime', event.target.value)}
            />
          </FormField>
          <FormField id="program-default-end" label="Default End Time">
            <input
              id="program-default-end"
              type="time"
              required
              value={workflow.draft.defaultEndTime}
              disabled={workflow.submissionComplete}
              onChange={event => workflow.updateDraft('defaultEndTime', event.target.value)}
            />
          </FormField>
        </div>
        <FormField id="program-timezone" label="Session Timezone">
          <FloatingSelect
            id="program-timezone"
            value={workflow.draft.timezone}
            disabled={workflow.submissionComplete}
            options={[{ value: 'America/Toronto', label: 'Toronto (Eastern Time)' }]}
            onChange={value => workflow.updateDraft('timezone', value as Program['timezone'])}
          />
        </FormField>
        <FormField id="program-enrollment-required" label="Enrollment Required">
          <FloatingSelect
            id="program-enrollment-required"
            value={workflow.draft.enrollmentRequired ? 'yes' : 'no'}
            disabled={workflow.submissionComplete}
            onChange={value => workflow.updateDraft(
              'enrollmentRequired',
              value === 'yes',
            )}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
          />
        </FormField>
      </form>
    </Modal>
  );
}
