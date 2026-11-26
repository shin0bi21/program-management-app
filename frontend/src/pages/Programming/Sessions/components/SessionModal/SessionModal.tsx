import type { SetSessionInput } from '../../sessions.api';
import type { ProgramSession, SessionType } from '../../types';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { Program } from '../../../Programs/types';
import useSessionModal from './hooks/useSessionModal';

interface SessionModalProps {
  programs: Program[];
  session?: ProgramSession;
  sessionTypes: SessionType[];
  programId?: string;
  date?: string;
  pending?: boolean;
  onClose: () => void;
  onSave: (input: SetSessionInput) => Promise<ProgramSession>;
  onSaved: (session: ProgramSession) => void | Promise<void>;
}

/**
 * Adds or edits a session; program selection and its schedule defaults are available when adding.
 * @param props - Page references, optional saved session/calendar context, and close/save callbacks.
 * @example <SessionModal programs={programs} sessionTypes={types} onClose={close} onSave={save} onSaved={refresh} />
 */
export default function SessionModal({ onClose, sessionTypes, ...options }: SessionModalProps) {
  const workflow = useSessionModal(options);
  const isEdit = options.session !== undefined;
  return <Modal isOpen onClose={onClose} title={isEdit ? 'Edit Session' : 'Add Session'} status={workflow.status}
    statusMessage={workflow.message}
    footer={<ModalFormFooter formId="session-form"
      submitStatus={workflow.status} submitDisabled={workflow.locked || !workflow.draft.sessionType || (!isEdit && !workflow.program)} onClose={onClose} />}>
    <form id="session-form" onSubmit={event => { event.preventDefault(); void workflow.submit(); }}>
      {!isEdit && <FormField id="session-program" label="Program">
        <FloatingSelect id="session-program" value={workflow.draft.programId} onChange={workflow.selectProgram}
          disabled={workflow.locked} options={options.programs.map(({ id, title }) => ({ id, label: title }))} />
      </FormField>}
      <FormField id="session-type" label="Type">
        <FloatingSelect id="session-type" value={workflow.draft.sessionType}
          onChange={value => workflow.updateDraft('sessionType', value)} disabled={workflow.locked}
          options={sessionTypes.map(({ id, name }) => ({ id, label: name }))} />
      </FormField>
      <FormField id="session-title" label="Title">
        <input id="session-title" required maxLength={160} value={workflow.draft.title}
          disabled={workflow.locked} onChange={event => workflow.updateDraft('title', event.target.value)} />
      </FormField>
      <FormField id="session-date" label="Session Date">
        <input id="session-date" type="date" required value={workflow.draft.date}
          disabled={workflow.locked} onChange={event => workflow.updateDraft('date', event.target.value)} />
      </FormField>
      <div className="form-row session-time-row">
        <FormField id="session-start-time" label="Start Time">
          <input id="session-start-time" type="time" required value={workflow.draft.startTime}
            disabled={workflow.locked} onChange={event => workflow.updateDraft('startTime', event.target.value)} />
        </FormField>
        <FormField id="session-end-time" label="End Time">
          <input id="session-end-time" type="time" required value={workflow.draft.endTime}
            disabled={workflow.locked} onChange={event => workflow.updateDraft('endTime', event.target.value)} />
        </FormField>
      </div>
      <FormField id="session-description" label="Description">
        <textarea id="session-description" maxLength={5000} value={workflow.draft.description}
          disabled={workflow.locked} onChange={event => workflow.updateDraft('description', event.target.value)} />
      </FormField>
    </form>
  </Modal>;
}
