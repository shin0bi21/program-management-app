import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Button from '../../../common/components/Button/Button';
import Modal from '../../../common/components/Modal/Modal';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import { enrollYouth } from '../../../common/api/cohorts.api';
import { getYouth } from '../../../common/api/youth.api';
import type { SubmitStatus } from '../../../common/hooks/useSubmitStatus';
import type { ProgramCohort } from '../../../common/types/cohort';
import type { YouthProfile } from '../../../common/types/youth';
import './EnrollYouthModal.css';

interface EnrollYouthModalProps {
  cohort: ProgramCohort | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

export default function EnrollYouthModal({ cohort, onClose, onSuccess }: EnrollYouthModalProps) {
  const [youth, setYouth] = useState<YouthProfile[]>([]);
  const [selectedYouthIds, setSelectedYouthIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cohort) return;
    let active = true;
    setSelectedYouthIds([]);
    setSearch('');
    setLoading(true);
    setSubmitStatus('idle');
    setError(null);
    getYouth()
      .then(data => { if (active) setYouth(data); })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load youth');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cohort]);

  const availableYouth = useMemo(
    () => cohort
      ? youth.filter(profile => !profile.cohorts.some(enrollment => (
        enrollment.id === cohort.id && enrollment.withdrawnOn === null
      )))
      : [],
    [cohort, youth],
  );

  const visibleYouth = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return availableYouth;
    return availableYouth.filter(profile => (
      `${profile.firstName} ${profile.lastName}`.toLowerCase().includes(query)
      || profile.schoolName?.toLowerCase().includes(query)
    ));
  }, [availableYouth, search]);

  const visibleIds = visibleYouth.map(profile => profile.id);
  const allVisibleSelected = Boolean(visibleIds.length)
    && visibleIds.every(id => selectedYouthIds.includes(id));

  const toggleYouth = (youthId: string) => {
    setSelectedYouthIds(current => (
      current.includes(youthId)
        ? current.filter(id => id !== youthId)
        : [...current, youthId]
    ));
  };

  const toggleVisible = () => {
    setSelectedYouthIds(current => {
      if (allVisibleSelected) return current.filter(id => !visibleIds.includes(id));
      return [...new Set([...current, ...visibleIds])];
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cohort || !selectedYouthIds.length) return;
    setSubmitStatus('submitting');
    setError(null);
    try {
      await enrollYouth(cohort.id, { youthIds: selectedYouthIds });
      await onSuccess();
      setSubmitStatus('success');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not enroll youth');
      setSubmitStatus('error');
    }
  };

  const selectedCount = selectedYouthIds.length;
  const cohortLabel = cohort ? `${cohort.programName} - ${cohort.name}` : '';
  const statusMessage = submitStatus === 'submitting'
    ? `Adding ${selectedCount} youth to ${cohortLabel}...`
    : submitStatus === 'success'
      ? `${selectedCount} youth successfully added to ${cohortLabel}.`
      : error ?? undefined;
  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';

  return (
    <Modal
      isOpen={cohort !== null}
      onClose={onClose}
      title={`Enroll youth in ${cohort?.name ?? ''}`}
      status={submitStatus}
      statusMessage={statusMessage}
      successDelay={1400}
      disableClose={submitStatus === 'submitting'}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={submissionComplete}>Cancel</Button>
        <Button
          type="submit"
          form="enroll-youth-form"
          disabled={submissionComplete || loading || !selectedYouthIds.length}
        >
          {selectedYouthIds.length
            ? `Enroll ${selectedYouthIds.length} Youth`
            : 'Enroll Youth'}
        </Button>
      </>}
    >
      {error && submitStatus === 'idle' && <p className="form-error">{error}</p>}
      <form id="enroll-youth-form" onSubmit={event => void submit(event)}>
        <SearchInput
          label="Search youth"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search by name or school"
        />

        {!loading && visibleYouth.length > 0 && (
          <label className="enroll-youth-checklist__select-all">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleVisible}
            />
            <span>Select all shown</span>
          </label>
        )}

        <div className="enroll-youth-checklist" aria-label="Youth available for enrollment">
          {loading ? (
            <p className="programming-empty">Loading youth…</p>
          ) : visibleYouth.length ? visibleYouth.map(profile => (
            <label key={profile.id} className="enroll-youth-checklist__item">
              <input
                type="checkbox"
                checked={selectedYouthIds.includes(profile.id)}
                onChange={() => toggleYouth(profile.id)}
              />
              <span>
                <strong>{profile.firstName} {profile.lastName}</strong>
                {profile.schoolName && <small>{profile.schoolName}</small>}
              </span>
            </label>
          )) : (
            <p className="programming-empty">
              {availableYouth.length ? 'No youth match your search.' : 'All youth are already enrolled.'}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
