import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import Button from '../../../../../common/components/Button/Button';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';

import type { Lead } from '../../types';

import useSignUpLeadModal, { type LeadNoteCategory } from './useSignUpLeadModal';

import './SignUpLeadModal.css';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const formatDate = (date: string) => dateFormatter.format(new Date(`${date}T00:00:00`));

const noteCategoryOptions: Array<{ value: LeadNoteCategory; label: string }> = [
  { value: 'general', label: 'General' },
  { value: 'health', label: 'Health' },
  { value: 'preference', label: 'Preference' },
];

export default function SignUpLeadModal({ queryKey, lead, onClose, onSuccess }: {
  queryKey: readonly unknown[];
  lead: Lead | null;
  onClose: () => void;
  onSuccess: (lead: Lead) => void | Promise<void>;
}) {
  const workflow = useSignUpLeadModal({
    queryKey,
    lead,
    onSuccess,
  });

  const cohortOptions = [
    { value: '', label: 'Do not enroll yet' },
    ...workflow.visibleCohorts.map(cohort => ({
      value: cohort.id,
      label: `${cohort.programName} — ${cohort.name} · ${formatDate(cohort.startsOn)}–${formatDate(cohort.endsOn)}`,
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
      isOpen={lead !== null}
      onClose={onClose}
      title="Sign Up Lead"
      status={modalStatus}
      statusMessage={modalStatusMessage}
      successDelay={1400}
      maxWidth="600px"
      footer={(
        <ModalFormFooter
          formId="sign-up-lead-form"
          submitLabel="Create Profile"
          submitStatus={workflow.submitStatus}
          submitDisabled={workflow.loading}
          onClose={onClose}
        />
      )}
    >
      {lead && (
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
                <dt>Age</dt>
                <dd>{lead.age}</dd>
              </div>
              <div>
                <dt>School</dt>
                <dd>{lead.school}</dd>
              </div>
              <div>
                <dt>Eligible Program</dt>
                <dd>{lead.recommendedProgramName || 'Not available'}</dd>
              </div>
            </dl>
          </section>

          <section className="sign-up-lead-enrollment" aria-labelledby="sign-up-lead-enrollment-title">
            <h3 id="sign-up-lead-enrollment-title">Cohort enrollment</h3>
            <FloatingSelect
              id="sign-up-cohort"
              ariaLabel="Cohort enrollment"
              value={workflow.cohortId}
              onChange={workflow.selectCohort}
              options={cohortOptions}
              placeholder={workflow.loading ? 'Loading cohorts...' : 'Do not enroll yet'}
              disabled={workflow.loading || workflow.submissionComplete}
            />
            <Button type="button" size="sm" variant="secondary" onClick={() => workflow.setShowAllPrograms(!workflow.showAllPrograms)} disabled={workflow.loading || workflow.submissionComplete}>
              {workflow.showAllPrograms ? 'Show eligible program' : 'View all programs'}
            </Button>
            {!workflow.loading && workflow.visibleCohorts.length === 0 && (
              <p className="sign-up-lead-empty">
                {workflow.cohorts.length
                  ? 'No cohorts match this youth’s age. Create the profile now and manage cohorts later.'
                  : 'No eligible cohorts are available. The youth profile can still be created.'}
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
                options={noteCategoryOptions}
                disabled={workflow.submissionComplete}
              />
            </section>
          )}
        </form>
      )}
    </Modal>
  );
}
