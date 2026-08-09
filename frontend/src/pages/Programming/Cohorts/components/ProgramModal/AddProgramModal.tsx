import { type FormEvent, useEffect, useState } from 'react';
import { createProgram } from '../../../../../common/features/programs/api/programs.api';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { SubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import type { Program } from '../../../../../common/features/programs/types';
import { getErrorMessage } from '../../../../../http/clientErrors';

interface AddProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (program: Program) => void;
}

export default function AddProgramModal({ isOpen, onClose, onCreated }: AddProgramModalProps) {
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [rosterMode, setRosterMode] = useState<'enrolled' | 'open'>('enrolled');

  useEffect(() => {
    if (!isOpen) return;
    setStatus('idle');
    setStatusMessage('');
    setRosterMode('enrolled');
  }, [isOpen]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name'));
    setStatus('submitting');
    setStatusMessage(`Adding ${name}...`);
    try {
      const program = await createProgram({
        name,
        description: String(form.get('description')).trim() || null,
        rosterMode,
        minAge: form.get('minAge') ? Number(form.get('minAge')) : null,
        maxAge: form.get('maxAge') ? Number(form.get('maxAge')) : null,
      });
      onCreated(program);
      setStatusMessage(`${program.name} successfully added.`);
      setStatus('success');
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, 'Could not create program'));
      setStatus('error');
    }
  };

  const complete = status === 'submitting' || status === 'success';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add program"
      status={status}
      statusMessage={statusMessage}
      successDelay={1400}
      disableClose={complete}
      footer={(
        <ModalFormFooter
          formId="add-program-form"
          submitLabel="Add Program"
          submitStatus={status}
          onClose={onClose}
        />
      )}
    >
      <form id="add-program-form" onSubmit={(event) => void submit(event)}>
        <FormField id="program-name" label="Program name">
          <input id="program-name" name="name" required maxLength={120} />
        </FormField>
        <FormField id="program-description" label="Description">
          <textarea id="program-description" name="description" rows={4} maxLength={2000} />
        </FormField>
        <div className="form-row">
          <FormField id="program-min-age" label="Minimum age">
            <input id="program-min-age" name="minAge" type="number" min={0} max={30} />
          </FormField>
          <FormField id="program-max-age" label="Maximum age">
            <input id="program-max-age" name="maxAge" type="number" min={0} max={30} />
          </FormField>
        </div>
        <FormField id="program-roster-mode" label="Attendance">
          <FloatingSelect
            id="program-roster-mode"
            value={rosterMode}
            onChange={(value) => setRosterMode(value as 'enrolled' | 'open')}
            options={[
              { value: 'enrolled', label: 'Enrollment required' },
              { value: 'open', label: 'Open attendance' },
            ]}
          />
        </FormField>
      </form>
    </Modal>
  );
}
