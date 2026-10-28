import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { Program } from '../../../../../common/features/programs/types';
import useAddSessionModal from './hooks/useAddSessionModal';

interface AddSessionModalProps {
  programs: Program[];
  initialProgramId?: string;
  initialDate?: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export default function AddSessionModal({ onClose, ...options }: AddSessionModalProps) {
  const workflow = useAddSessionModal(options);
  return <Modal isOpen onClose={onClose} title="Add Session" status={workflow.status}
    statusMessage={workflow.message} successDelay={1400}
    footer={<ModalFormFooter formId="add-session-form" submitLabel="Add Session"
      submitStatus={workflow.status} submitDisabled={!workflow.program} onClose={onClose} />}>
    <form id="add-session-form" onSubmit={event => { event.preventDefault(); void workflow.submit(); }}>
      <FormField id="session-program" label="Program">
        <FloatingSelect id="session-program" value={workflow.programId} onChange={workflow.selectProgram}
          disabled={workflow.locked} options={options.programs.map(program => ({
            value: program.id, label: program.name,
          }))} />
      </FormField>
      <FormField id="session-type" label="Type">
        <FloatingSelect id="session-type" value={workflow.draft.sessionTypeId}
          onChange={value => workflow.updateDraft('sessionTypeId', value)} disabled={workflow.locked}
          options={workflow.sessionTypes.map(type => ({ value: type.id, label: type.name }))} />
      </FormField>
      <FormField id="session-theme" label="Title / Theme">
        <input id="session-theme" required maxLength={160} value={workflow.draft.theme}
          disabled={workflow.locked} onChange={event => workflow.updateDraft('theme', event.target.value)} />
      </FormField>
      <FormField id="session-date" label="Session Date">
        <input id="session-date" type="date" required value={workflow.draft.date}
          disabled={workflow.locked} onChange={event => workflow.updateDraft('date', event.target.value)} />
      </FormField>
      <div className="form-row">
        <FormField id="session-start-time" label="Start Time">
          <input id="session-start-time" type="time" required value={workflow.draft.startTime}
            disabled={workflow.locked} onChange={event => workflow.updateDraft('startTime', event.target.value)} />
        </FormField>
        <FormField id="session-end-time" label="End Time">
          <input id="session-end-time" type="time" required value={workflow.draft.endTime}
            disabled={workflow.locked} onChange={event => workflow.updateDraft('endTime', event.target.value)} />
        </FormField>
      </div>
    </form>
  </Modal>;
}
