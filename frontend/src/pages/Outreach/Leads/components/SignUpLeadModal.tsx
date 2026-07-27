import { FormEvent, useEffect, useMemo, useState } from 'react';
import Button from '../../../../common/components/Button/Button';
import FloatingSelect from '../../../../common/components/FloatingSelect/FloatingSelect';
import Modal from '../../../../common/components/Modal/Modal';
import { getCohorts } from '../../../../common/api/cohorts.api';
import type { SubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import type { ProgramCohort } from '../../../../common/types/cohort';
import { signUpLead } from '../api/leads.api';
import type { Lead } from '../types';
import './SignUpLeadModal.css';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const formatDate = (date: string) => dateFormatter.format(new Date(`${date}T00:00:00`));

export default function SignUpLeadModal({ lead, onClose, onSuccess }: {
  lead: Lead | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}) {
  const [cohorts, setCohorts] = useState<ProgramCohort[]>([]);
  const [cohortId, setCohortId] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!lead) return;
    let active = true;
    setLoading(true);
    setSubmitStatus('idle');
    setStatusMessage('');
    setCohortId('');
    getCohorts(lead.programOfInterestId ?? undefined)
      .then(rows => {
        if (!active) return;
        setCohorts(rows.filter(cohort => (
          cohort.state !== 'completed' && cohort.rosterMode === 'enrolled'
        )));
      })
      .catch(err => {
        if (!active) return;
        const message = getErrorMessage(err, 'Unable to load cohorts');
        setStatusMessage(message);
        setSubmitStatus('error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lead]);

  const visibleCohorts = useMemo(() => {
    if (!lead) return cohorts;
    return cohorts.filter(cohort => (
      cohort.minAge == null
      || cohort.maxAge == null
      || (lead.age >= cohort.minAge && lead.age <= cohort.maxAge)
    ));
  }, [cohorts, lead]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lead) return;
    const youthName = `${lead.youthFirstName} ${lead.youthLastName}`;
    const selectedCohort = cohorts.find(cohort => cohort.id === cohortId);
    setSubmitStatus('submitting');
    setStatusMessage(`Creating youth profile for ${youthName}...`);
    try {
      await signUpLead(lead.id, cohortId || null);
      await onSuccess();
      setStatusMessage(selectedCohort
        ? `Youth profile successfully created and added to ${selectedCohort.programName} - ${selectedCohort.name}.`
        : `Youth profile successfully created for ${youthName}.`);
      setSubmitStatus('success');
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to create youth profile');
      setStatusMessage(message);
      setSubmitStatus('error');
    }
  };

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
  const cohortOptions = [
    { value: '', label: 'Do not enroll yet' },
    ...visibleCohorts.map(cohort => ({
      value: cohort.id,
      label: `${cohort.programName} — ${cohort.name} · ${formatDate(cohort.startsOn)}–${formatDate(cohort.endsOn)}`,
    })),
  ];

  return (
    <Modal
      isOpen={lead !== null}
      onClose={onClose}
      title="Sign Up Lead"
      status={submitStatus}
      statusMessage={statusMessage || undefined}
      successDelay={1400}
      disableClose={submitStatus === 'submitting'}
      maxWidth="600px"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={submissionComplete}>Cancel</Button>
        <Button type="submit" form="sign-up-lead-form" disabled={submissionComplete || loading}>
          Create Profile
        </Button>
      </>}
    >
      {lead && (
        <form
          id="sign-up-lead-form"
          className="sign-up-lead-form"
          onSubmit={event => void submit(event)}
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
                <dt>Program interest</dt>
                <dd>{lead.programOfInterestName || 'Not specified'}</dd>
              </div>
            </dl>
          </section>

          <section className="sign-up-lead-enrollment" aria-labelledby="sign-up-lead-enrollment-title">
            <h3 id="sign-up-lead-enrollment-title">Cohort enrollment</h3>
            <FloatingSelect
              id="sign-up-cohort"
              ariaLabel="Cohort enrollment"
              value={cohortId}
              onChange={setCohortId}
              options={cohortOptions}
              placeholder={loading ? 'Loading cohorts...' : 'Do not enroll yet'}
              disabled={loading || submissionComplete}
            />
            {!loading && visibleCohorts.length === 0 && (
              <p className="sign-up-lead-empty">
                {cohorts.length
                  ? 'No cohorts match this youth’s age. Create the profile now and manage cohorts later.'
                  : 'No eligible cohorts are available. The youth profile can still be created.'}
              </p>
            )}
          </section>
        </form>
      )}
    </Modal>
  );
}
