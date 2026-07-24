import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Button from '../../../../common/components/Button/Button';
import Modal from '../../../../common/components/Modal/Modal';
import SearchInput from '../../../../common/components/SearchInput/SearchInput';
import { getCohorts, syncYouthCohorts } from '../../../../common/api/cohorts.api';
import type { SubmitStatus } from '../../../../common/hooks/useSubmitStatus';
import type { ProgramCohort } from '../../../../common/types/cohort';
import type { YouthProfile } from '../../../../common/types/youth';
import './ManageCohortsModal.css';

interface ManageCohortsModalProps {
  youth: YouthProfile | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

const sortedIds = (values: string[]) => [...values].sort().join(',');

export default function ManageCohortsModal({
  youth,
  onClose,
  onChanged,
}: ManageCohortsModalProps) {
  const [cohorts, setCohorts] = useState<ProgramCohort[]>([]);
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!youth) return;
    let active = true;
    setSelectedCohortIds(
      youth.cohorts
        .filter(enrollment => enrollment.withdrawnOn === null)
        .map(enrollment => enrollment.id),
    );
    setSearch('');
    setSubmitStatus('idle');
    setStatusMessage('');
    setError(null);
    setLoading(true);
    getCohorts()
      .then(data => { if (active) setCohorts(data); })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load cohorts');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [youth?.id]);

  const manageableCohorts = useMemo(
    () => cohorts.filter(cohort => cohort.state !== 'completed'),
    [cohorts],
  );

  const visibleCohorts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return manageableCohorts;
    return manageableCohorts.filter(cohort => (
      `${cohort.programName} ${cohort.name}`.toLowerCase().includes(query)
    ));
  }, [manageableCohorts, search]);

  const initialIds = useMemo(() => {
    if (!youth) return [];
    const manageableIds = new Set(manageableCohorts.map(cohort => cohort.id));
    return youth.cohorts
      .filter(enrollment => enrollment.withdrawnOn === null && manageableIds.has(enrollment.id))
      .map(enrollment => enrollment.id);
  }, [manageableCohorts, youth]);

  const selectedManageableIds = useMemo(() => {
    const manageableIds = new Set(manageableCohorts.map(cohort => cohort.id));
    return selectedCohortIds.filter(id => manageableIds.has(id));
  }, [manageableCohorts, selectedCohortIds]);

  const changed = sortedIds(initialIds) !== sortedIds(selectedManageableIds);
  const visibleIds = visibleCohorts.map(cohort => cohort.id);
  const allVisibleSelected = Boolean(visibleIds.length)
    && visibleIds.every(id => selectedCohortIds.includes(id));

  const toggleCohort = (cohortId: string) => {
    setSelectedCohortIds(current => (
      current.includes(cohortId)
        ? current.filter(id => id !== cohortId)
        : [...current, cohortId]
    ));
  };

  const toggleVisible = () => {
    setSelectedCohortIds(current => {
      if (allVisibleSelected) return current.filter(id => !visibleIds.includes(id));
      return [...new Set([...current, ...visibleIds])];
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!youth || !changed) return;
    const youthName = `${youth.firstName} ${youth.lastName}`;
    setSubmitStatus('submitting');
    setStatusMessage(`Updating cohorts for ${youthName}...`);
    setError(null);
    try {
      await syncYouthCohorts(youth.id, selectedManageableIds);
      await onChanged();
      setStatusMessage(`Cohorts successfully updated for ${youthName}.`);
      setSubmitStatus('success');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not update cohorts';
      setError(message);
      setStatusMessage(message);
      setSubmitStatus('error');
    }
  };

  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';

  return (
    <Modal
      isOpen={youth !== null}
      onClose={onClose}
      title={`Manage cohorts for ${youth?.firstName ?? ''} ${youth?.lastName ?? ''}`}
      status={submitStatus}
      statusMessage={statusMessage}
      successDelay={1400}
      disableClose={submitStatus === 'submitting'}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={submissionComplete}>Cancel</Button>
        <Button type="submit" form="manage-cohorts-form" disabled={loading || submissionComplete || !changed}>
          Apply Changes
        </Button>
      </>}
    >
      {error && submitStatus === 'idle' && <p className="form-error">{error}</p>}
      <form id="manage-cohorts-form" onSubmit={event => void submit(event)}>
        <SearchInput
          label="Search cohorts"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search programs or cohorts"
        />

        {!loading && visibleCohorts.length > 0 && (
          <label className="manage-cohorts-checklist__select-all">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} />
            <span>Select all shown</span>
          </label>
        )}

        <div className="manage-cohorts-checklist" aria-label="Available cohorts">
          {loading ? (
            <p className="programming-empty">Loading cohorts…</p>
          ) : visibleCohorts.length ? visibleCohorts.map(cohort => (
            <label className="manage-cohorts-checklist__item" key={cohort.id}>
              <input
                type="checkbox"
                aria-label={`${cohort.programName} · ${cohort.name} (${cohort.state})`}
                checked={selectedCohortIds.includes(cohort.id)}
                onChange={() => toggleCohort(cohort.id)}
              />
              <span>
                <strong>{cohort.programName} · {cohort.name}</strong>
                <small>{cohort.state}</small>
              </span>
            </label>
          )) : (
            <p className="programming-empty">
              {manageableCohorts.length ? 'No cohorts match your search.' : 'No active or upcoming cohorts.'}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
