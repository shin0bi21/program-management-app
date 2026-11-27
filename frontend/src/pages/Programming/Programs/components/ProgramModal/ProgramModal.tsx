import type { ProgramMutationResult } from '../../api/programs.api';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { Program, ProgramWeekday } from '../../types';
import useProgramModal from './hooks/useProgramModal';

interface ProgramModalProps {
  isOpen: boolean;
  program: Program | null;
  onClose: () => void;
  onSaved: (result: ProgramMutationResult, operation: 'create' | 'update') => void;
}

/**
 * Mounts a fresh program editor for each open target.
 * @param props - Visibility, supplied saved program and completion actions.
 * @example <ProgramModal isOpen program={program} onClose={close} onSaved={save} />
 */
export default function ProgramModal({ isOpen, ...props }: ProgramModalProps) {
  return isOpen ? <ProgramForm key={props.program?.id ?? 'new'} {...props} /> : null;
}

/**
 * Edits one program for the lifetime of its open dialog.
 * @param props - Saved values or an empty add target, with close/save callbacks.
 * @example <ProgramForm program={null} onClose={close} onSaved={save} />
 */
function ProgramForm({ program, onClose, onSaved }: Omit<ProgramModalProps, 'isOpen'>) {
  const workflow = useProgramModal({ program, onSaved });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={program ? 'Edit Program' : 'Add Program'}
      status={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      footer={(
        <ModalFormFooter
          formId="program-form"
          submitStatus={workflow.submitStatus}
          onClose={onClose}
        />
      )}
    >
      <form
        id="program-form"
        aria-busy={workflow.submissionComplete}
        onSubmit={workflow.submit}
      >
        <FormField id="program-title" label="Program Title">
          <input
            id="program-title"
            required
            maxLength={120}
            disabled={workflow.submissionComplete}
            {...workflow.register('title')}
          />
        </FormField>
        <FormField id="program-description" label="Description">
          <textarea
            id="program-description"
            rows={4}
            maxLength={2000}
            disabled={workflow.submissionComplete}
            {...workflow.register('description')}
          />
        </FormField>
        <div className="form-row">
          <FormField id="program-min-age" label="Minimum Age">
            <input
              id="program-min-age"
              type="number"
              min={0}
              max={30}
              disabled={workflow.submissionComplete}
              {...workflow.register('minAge')}
            />
          </FormField>
          <FormField id="program-max-age" label="Maximum Age">
            <input
              id="program-max-age"
              type="number"
              min={0}
              max={30}
              disabled={workflow.submissionComplete}
              {...workflow.register('maxAge')}
            />
          </FormField>
        </div>
        <FormField id="program-default-weekday" label="Default Session Day">
          <FloatingSelect
            id="program-default-weekday"
            value={workflow.draft.defaultDayOfWeek}
            disabled={workflow.submissionComplete}
            onChange={value => workflow.setValue('defaultDayOfWeek', value as ProgramWeekday)}
            options={['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => ({
              id: day,
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
              disabled={workflow.submissionComplete}
              {...workflow.register('defaultStartTime')}
            />
          </FormField>
          <FormField id="program-default-end" label="Default End Time">
            <input
              id="program-default-end"
              type="time"
              required
              disabled={workflow.submissionComplete}
              {...workflow.register('defaultEndTime')}
            />
          </FormField>
        </div>
        <FormField id="program-timezone" label="Session Timezone">
          <FloatingSelect
            id="program-timezone"
            value={workflow.draft.timezone}
            disabled={workflow.submissionComplete}
            options={[{ id: 'America/Toronto', label: 'Toronto (Eastern Time)' }]}
            onChange={value => workflow.setValue('timezone', value as Program['timezone'])}
          />
        </FormField>
        <FormField id="program-enrollment-required" label="Enrollment Required">
          <FloatingSelect
            id="program-enrollment-required"
            value={workflow.draft.enrollmentRequired ? 'yes' : 'no'}
            disabled={workflow.submissionComplete}
            onChange={value => workflow.setValue(
              'enrollmentRequired',
              value === 'yes',
            )}
            options={[
              { id: 'yes', label: 'Yes' },
              { id: 'no', label: 'No' },
            ]}
          />
        </FormField>
      </form>
    </Modal>
  );
}
