import { formatShortDate, getDate } from '../../../../common/utils/date';
import FormField from '../../../../common/components/FormField/FormField';
import FloatingSelect from '../../../../common/components/FloatingSelect/FloatingSelect';
import Button from '../../../../common/components/Button/Button';
import Modal from '../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../common/components/Modal/components/ModalFormFooter';

import type { Lead } from '../../types';
import type { LeadSignUpResult } from '../../leads.api';

import useSignUpLeadModal, { type LeadNoteCategory } from './useSignUpLeadModal';

import './SignUpLeadModal.css';

const noteCategoryOptions: Array<{ id: LeadNoteCategory; name: string }> = [
  { id: 'general', name: 'General' },
  { id: 'health', name: 'Health' },
  { id: 'preference', name: 'Preference' },
];

interface SignUpLeadModalProps {
  queryKey: readonly unknown[];
  lead: Lead | null;
  onClose: () => void;
  onSuccess: (result: LeadSignUpResult) => void | Promise<void>;
}

/**
 * Mounts the signup interaction only while its saved lead target is open.
 * @param props - Lead target, assignment-query scope, and completion actions.
 * @example <SignUpLeadModal queryKey={queryKey} lead={lead} onClose={close} onSuccess={sync} />
 */
export default function SignUpLeadModal({ lead, ...props }: SignUpLeadModalProps) {
  return lead ? <SignUpForm key={lead.id} lead={lead} {...props} /> : null;
}

/**
 * Owns one lead's enrollment and intake-note choices until signup completes or closes.
 * @param props - Saved lead, assignment-query scope, and completion actions.
 * @example <SignUpForm queryKey={queryKey} lead={lead} onClose={close} onSuccess={sync} />
 */
function SignUpForm({ queryKey, lead, onClose, onSuccess }: Omit<SignUpLeadModalProps, 'lead'> & { lead: Lead }) {
  const workflow = useSignUpLeadModal({
    queryKey,
    lead,
    onSuccess,
  });

  const programCycleOptions = [
    { id: '', name: 'Do not enroll yet' },
    ...workflow.visibleProgramCycles.map(programCycle => ({
      id: `${programCycle.programId}:${programCycle.cycleId}`,
      name: `${programCycle.program} — ${programCycle.cycle} · ${formatShortDate(programCycle.startsOn)}–${formatShortDate(programCycle.endsOn)}`,
    })),
  ];
  const modalStatus = workflow.submitStatus === 'idle' && workflow.loadError
    ? 'error'
    : workflow.submitStatus;
  const modalStatusMessage = workflow.submitStatus === 'idle'
    ? workflow.loadError || workflow.statusMessage
    : workflow.statusMessage;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Sign Up Lead"
      status={modalStatus}
      statusMessage={modalStatusMessage}
      maxWidth="600px"
      footer={(
        <ModalFormFooter
          formId="sign-up-lead-form"
          submitStatus={workflow.submitStatus}
          submitDisabled={workflow.loading}
          onClose={onClose}
        />
      )}
    >
      <form
        id="sign-up-lead-form"
        className="sign-up-lead-form"
        onSubmit={(event) => {
          event.preventDefault();
          void workflow.submit();
        }}
      >
        <section className="sign-up-lead-summary" aria-labelledby="sign-up-lead-name">
          <h3 id="sign-up-lead-name">
            {lead.youthFirstName} {lead.youthLastName}
          </h3>
          <dl className="sign-up-lead-details">
            <div>
              <dt>Date of Birth</dt>
              <dd>{workflow.age !== null ? formatShortDate(workflow.dateOfBirth) : '—'}</dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>{workflow.age ?? '—'}</dd>
            </div>
            <div>
              <dt>School</dt>
              <dd>{lead.school}</dd>
            </div>
            <div>
              <dt>Eligible Program</dt>
              <dd>{lead.recommendedProgram || 'Not available'}</dd>
            </div>
          </dl>
        </section>

        <FormField id="sign-up-dateOfBirth" label="Date of Birth *">
          <input id="sign-up-dateOfBirth" type="date" required max={getDate(-1)} value={workflow.dateOfBirth} onChange={event => workflow.changeDateOfBirth(event.target.value)} disabled={workflow.submissionComplete} />
        </FormField>

        <section className="sign-up-lead-enrollment" aria-labelledby="sign-up-lead-enrollment-title">
          <h3 id="sign-up-lead-enrollment-title">Program and cycle enrollment</h3>
          <FloatingSelect
            id="sign-up-programCycle"
            ariaLabel="Program and cycle enrollment"
            value={workflow.selectedPairKey}
            onChange={workflow.selectProgramCycle}
            options={programCycleOptions.map(({ id, name }) => ({ id, label: name }))}
            placeholder={workflow.loading ? 'Loading program cycles...' : 'Do not enroll yet'}
            disabled={workflow.loading || workflow.submissionComplete}
          />
          <Button type="button" size="sm" variant="secondary" onClick={() => workflow.setShowAllPrograms(!workflow.showAllPrograms)} disabled={workflow.loading || workflow.submissionComplete}>
            {workflow.showAllPrograms ? 'Show eligible program' : 'View all programs'}
          </Button>
          {!workflow.loading && workflow.visibleProgramCycles.length === 0 && (
            <p className="sign-up-lead-empty">
              {workflow.programCycles.length
                ? 'No program cycles match this youth’s age. Create the profile now and manage enrollment later.'
                : 'No eligible program cycles are available. The youth profile can still be created.'}
            </p>
          )}
        </section>

        {lead.notes?.trim() && (
          <section className="sign-up-lead-enrollment" aria-labelledby="sign-up-lead-note-title">
            <h3 id="sign-up-lead-note-title">Intake Information</h3>
            <FloatingSelect
              id="sign-up-note-category"
              ariaLabel="Type of note"
              value={workflow.noteCategory}
              onChange={value => workflow.selectNoteCategory(value as LeadNoteCategory)}
              options={noteCategoryOptions.map(({ id, name }) => ({ id, label: name }))}
              disabled={workflow.submissionComplete}
            />
          </section>
        )}
      </form>
    </Modal>
  );
}
