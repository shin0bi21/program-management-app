import type { ReactElement } from 'react';
import type { SessionType } from '../../types';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import useSessionModal, { type SessionModalOptions } from './hooks/useSessionModal';

export interface SessionModalProps extends SessionModalOptions {
  sessionTypes: SessionType[];
  onClose: () => void;
}

/**
 * Adds or edits a session; program selection and its schedule defaults are available when adding.
 * @param props - Page references, optional saved session/calendar context, and close/save callbacks.
 * @example <SessionModal programs={programs} sessionTypes={types} onClose={close} onSave={save} onSaved={refresh} />
 */
export default function SessionModal({ onClose, sessionTypes, ...options }: SessionModalProps): ReactElement {
  const workflow = useSessionModal(options);
  const isEdit = options.session !== undefined;
  return <Modal isOpen onClose={onClose} title={isEdit ? 'Edit Session' : 'Add Session'} status={workflow.status}
    statusMessage={workflow.message}
    footer={<ModalFormFooter formId="session-form"
      submitStatus={workflow.status} submitDisabled={workflow.locked || !workflow.draft.sessionType || (!isEdit && !workflow.program)} onClose={onClose} />}>
    <form id="session-form" onSubmit={workflow.submit}>
      {!isEdit && <FormField id="session-program" label="Program">
        <FloatingSelect id="session-program" value={workflow.draft.programId} onChange={workflow.selectProgram}
          disabled={workflow.locked} options={options.programs.map(({ id, title }) => ({ id, label: title }))} />
      </FormField>}
      <FormField id="session-type" label="Type">
        <FloatingSelect id="session-type" value={workflow.draft.sessionType}
          onChange={value => workflow.setValue('sessionType', sessionTypes.find(type => type.id === value)?.id ?? '')}
          disabled={workflow.locked}
          options={sessionTypes.map(({ id, name }) => ({ id, label: name }))} />
      </FormField>
      <FormField id="session-title" label="Title">
        <input id="session-title" required maxLength={160}
          disabled={workflow.locked} {...workflow.register('title')} />
      </FormField>
      <FormField id="session-date" label="Session Date">
        <input id="session-date" type="date" required
          disabled={workflow.locked} {...workflow.register('date')} />
      </FormField>
      <div className="form-row session-time-row">
        <FormField id="session-start-time" label="Start Time">
          <input id="session-start-time" type="time" required
          disabled={workflow.locked} {...workflow.register('startTime')} />
        </FormField>
        <FormField id="session-end-time" label="End Time">
          <input id="session-end-time" type="time" required
          disabled={workflow.locked} {...workflow.register('endTime')} />
        </FormField>
      </div>
      <FormField id="session-description" label="Description">
        <textarea id="session-description" maxLength={5000}
          disabled={workflow.locked} {...workflow.register('description')} />
      </FormField>
    </form>
  </Modal>;
}
