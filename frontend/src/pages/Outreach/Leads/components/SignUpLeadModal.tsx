import { useEffect, useState } from 'react';
import Button from '../../../../common/components/Button/Button';
import Modal from '../../../../common/components/Modal/Modal';
import { getCohorts } from '../../../../common/api/cohorts.api';
import type { SubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../common/utils/clientErrors';
import type { ProgramCohort } from '../../../../common/types/cohort';
import { signUpLead } from '../api/leads.api';
import type { Lead } from '../types';

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
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lead) return;
    setLoading(true);
    setSubmitStatus('idle');
    setStatusMessage('');
    setError('');
    setCohortId('');
    getCohorts(lead.programOfInterestId ?? undefined)
      .then(rows => setCohorts(rows.filter(cohort => cohort.state !== 'completed')))
      .catch(err => {
        const message = getErrorMessage(err, 'Unable to load cohorts');
        setError(message);
        setStatusMessage(message);
        setSubmitStatus('error');
      })
      .finally(() => setLoading(false));
  }, [lead]);

  const submit = async () => {
    if (!lead) return;
    const youthName = `${lead.youthFirstName} ${lead.youthLastName}`;
    const selectedCohort = cohorts.find(cohort => cohort.id === cohortId);
    setSubmitStatus('submitting');
    setStatusMessage(`Creating youth profile for ${youthName}...`);
    setError('');
    try {
      await signUpLead(lead.id, cohortId || null);
      await onSuccess();
      setStatusMessage(selectedCohort
        ? `Youth profile successfully created and added to ${selectedCohort.programName} - ${selectedCohort.name}.`
        : `Youth profile successfully created for ${youthName}.`);
      setSubmitStatus('success');
    } catch (err) {
      const message = getErrorMessage(err, 'Unable to create youth profile');
      setError(message);
      setStatusMessage(message);
      setSubmitStatus('error');
    }
  };

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';

  return (
    <Modal
      isOpen={lead !== null}
      onClose={onClose}
      title="Sign Up Lead"
      status={submitStatus}
      statusMessage={statusMessage || error || undefined}
      successDelay={1400}
      disableClose={submitStatus === 'submitting'}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={submissionComplete}>Cancel</Button>
        <Button onClick={() => void submit()} disabled={submissionComplete || loading}>Sign Up</Button>
      </>}
    >
      {lead && <>
        <p>
          Create a youth profile for {lead.youthFirstName} {lead.youthLastName}.
          {lead.programOfInterestName ? ` Their program of interest is ${lead.programOfInterestName}.` : ''}
        </p>
        <div className="form-group">
          <label htmlFor="sign-up-cohort">Cohort enrollment</label>
          <select
            id="sign-up-cohort"
            value={cohortId}
            onChange={event => setCohortId(event.target.value)}
            disabled={loading || submissionComplete}
          >
            <option value="">{loading ? 'Loading cohorts...' : 'Do not enroll yet'}</option>
            {cohorts.map(cohort => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.programName} — {cohort.name} ({cohort.startsOn} to {cohort.endsOn})
              </option>
            ))}
          </select>
        </div>
      </>}
    </Modal>
  );
}
