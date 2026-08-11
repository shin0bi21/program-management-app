import { type FormEvent, useEffect, useState } from 'react';
import FloatingSelect from '../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../common/components/FormField/FormField';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/Modal/components/ModalFormFooter';
import { createProgram, updateProgram } from '../../../../common/features/programs/api/programs.api';
import type { Program } from '../../../../common/features/programs/types';
import type { SubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../http/clientErrors';

interface ProgramModalProps {
  isOpen: boolean;
  program: Program | null;
  onClose: () => void;
  onSaved: (program: Program) => void;
}

export default function ProgramModal({ isOpen, program, onClose, onSaved }: ProgramModalProps) {
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [rosterMode, setRosterMode] = useState<'enrolled' | 'open'>('enrolled');

  useEffect(() => {
    if (!isOpen) return;
    setStatus('idle');
    setStatusMessage('');
    setRosterMode(program?.rosterMode ?? 'enrolled');
  }, [isOpen, program]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      name: String(form.get('name')),
      description: String(form.get('description')).trim() || null,
      rosterMode,
      minAge: form.get('minAge') ? Number(form.get('minAge')) : null,
      maxAge: form.get('maxAge') ? Number(form.get('maxAge')) : null,
    };
    setStatus('submitting');
    setStatusMessage(program ? `Updating ${input.name}...` : `Adding ${input.name}...`);
    try {
      const saved = program
        ? await updateProgram(program.id, input)
        : await createProgram(input);
      onSaved(saved);
      setStatusMessage(program ? 'Program updated successfully.' : 'Program added successfully.');
      setStatus('success');
    } catch (cause) {
      setStatusMessage(getErrorMessage(cause, program ? 'Could not update program' : 'Could not create program'));
      setStatus('error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={program ? 'Edit Program' : 'Add Program'}
      status={status}
      statusMessage={statusMessage}
      successDelay={1400}
      footer={<ModalFormFooter formId="program-form" submitLabel={program ? 'Save Changes' : 'Add Program'} submitStatus={status} onClose={onClose} />}
    >
      <form key={program?.id ?? 'new'} id="program-form" onSubmit={(event) => void submit(event)}>
        <FormField id="program-name" label="Program name">
          <input id="program-name" name="name" required maxLength={120} defaultValue={program?.name} />
        </FormField>
        <FormField id="program-description" label="Description">
          <textarea id="program-description" name="description" rows={4} maxLength={2000} defaultValue={program?.description ?? ''} />
        </FormField>
        <div className="form-row">
          <FormField id="program-min-age" label="Minimum age">
            <input id="program-min-age" name="minAge" type="number" min={0} max={30} defaultValue={program?.minAge ?? ''} />
          </FormField>
          <FormField id="program-max-age" label="Maximum age">
            <input id="program-max-age" name="maxAge" type="number" min={0} max={30} defaultValue={program?.maxAge ?? ''} />
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
