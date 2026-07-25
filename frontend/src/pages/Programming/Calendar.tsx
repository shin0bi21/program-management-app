import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { DatesSetInfo, EventInput } from '@fullcalendar/react';
import { useSearchParams } from 'react-router-dom';
import Button from '../../common/components/Button/Button';
import FilterCard, { type FilterCardCategory } from '../../common/components/FilterCard/FilterCard';
import FloatingSelect from '../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../common/components/FormField/FormField';
import Modal from '../../common/components/Modal/Modal';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import { getCohorts, getCohortSessions } from '../../common/api/cohorts.api';
import { useAuth } from '../../common/context/AuthContext';
import { usePrograms } from '../../common/hooks/usePrograms';
import type { CohortSession, ProgramCohort } from '../../common/types/cohort';
import AttendanceModal from './components/AttendanceModal';
import GenerateSessionsModal from './components/GenerateSessionsModal';
import ProgrammingCalendar from './components/ProgrammingCalendar/ProgrammingCalendar';
import './Calendar.css';

interface CalendarRange {
  start: string;
  end: string;
}

export default function Calendar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { permissions } = useAuth();
  const { programs } = usePrograms();
  const [cohorts, setCohorts] = useState<ProgramCohort[]>([]);
  const [sessions, setSessions] = useState<CohortSession[]>([]);
  const [currentRange, setCurrentRange] = useState<CalendarRange | null>(null);
  const [attendanceTarget, setAttendanceTarget] = useState<CohortSession | null>(null);
  const [cohortPickerOpen, setCohortPickerOpen] = useState(false);
  const [scheduleCohortId, setScheduleCohortId] = useState('');
  const [generationTarget, setGenerationTarget] = useState<ProgramCohort | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedProgramIds = (searchParams.get('program') ?? '')
    .split(',')
    .filter(Boolean);
  const selectedCohortId = searchParams.get('cohort') ?? '';
  const canSchedule = permissions.includes('write:cohorts');

  useEffect(() => {
    getCohorts()
      .then(setCohorts)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load cohorts'));
  }, []);

  const loadSessions = useCallback(async (range: CalendarRange) => {
    setError(null);
    try {
      setSessions(await getCohortSessions(range.start, range.end));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load sessions');
    }
  }, []);

  const handleDatesSet = useCallback((range: DatesSetInfo) => {
    const nextRange = {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    };
    setCurrentRange(nextRange);
    void loadSessions(nextRange);
  }, [loadSessions]);

  const cohortsForProgram = useMemo(
    () => selectedProgramIds.length
      ? cohorts.filter(cohort => selectedProgramIds.includes(cohort.programId))
      : cohorts,
    [cohorts, selectedProgramIds.join(',')],
  );

  const visibleSessions = useMemo(
    () => sessions.filter(session => {
      if (selectedProgramIds.length && !selectedProgramIds.includes(session.programId)) return false;
      if (selectedCohortId && session.cohortId !== selectedCohortId) return false;
      return true;
    }),
    [selectedCohortId, selectedProgramIds.join(','), sessions],
  );

  const events = useMemo<EventInput[]>(() => visibleSessions.map(session => ({
    id: session.id,
    title: session.theme,
    start: session.startsAt,
    end: session.endsAt,
    backgroundColor: session.cancelledAt ? '#6b7280' : undefined,
    borderColor: session.cancelledAt ? '#6b7280' : undefined,
    extendedProps: {
      description: session.description,
    },
  })), [visibleSessions]);

  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    {
      id: 'program',
      label: 'Program',
      options: programs.map(program => ({ value: program.id, label: program.name })),
    },
    {
      id: 'cohort',
      label: 'Cohort',
      selectionMode: 'single',
      options: cohortsForProgram.map(cohort => ({
        value: cohort.id,
        label: `${cohort.programName} · ${cohort.name}`,
      })),
    },
  ], [cohortsForProgram, programs]);

  const setFilter = (key: 'program' | 'cohort', values: string[]) => {
    const next = new URLSearchParams(searchParams);
    if (values.length) next.set(key, values.join(','));
    else next.delete(key);
    if (key === 'program') next.delete('cohort');
    setSearchParams(next);
  };

  const openSchedulePicker = () => {
    const preferredCohort = selectedCohortId
      ? cohorts.find(cohort => cohort.id === selectedCohortId)
      : cohortsForProgram.find(cohort => cohort.state !== 'completed') ?? cohortsForProgram[0];
    setScheduleCohortId(preferredCohort?.id ?? '');
    setCohortPickerOpen(true);
  };

  const chooseScheduleCohort = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cohort = cohorts.find(candidate => candidate.id === scheduleCohortId);
    if (!cohort) return;
    setCohortPickerOpen(false);
    setGenerationTarget(cohort);
  };

  const reloadCurrentRange = async () => {
    if (currentRange) await loadSessions(currentRange);
  };

  return (
    <div className="calendar-page">
      <PageHeader
        title="Calendar"
        actions={canSchedule ? (
          <Button onClick={openSchedulePicker} disabled={!cohortsForProgram.length}>
            + Schedule Sessions
          </Button>
        ) : undefined}
        filters={<FilterCard
          categories={filterCategories}
          values={{
            program: selectedProgramIds,
            cohort: selectedCohortId ? [selectedCohortId] : [],
          }}
          onApply={(category, selected) => {
            if (category === 'program' || category === 'cohort') {
              setFilter(category, category === 'program' ? selected : selected.slice(0, 1));
            }
          }}
          onClearAll={() => setSearchParams({})}
        />}
      />

      {error && <p className="programming-error">{error}</p>}

      <ProgrammingCalendar
        events={events}
        onDatesSet={handleDatesSet}
        onEventSelect={sessionId => {
          const session = visibleSessions.find(candidate => candidate.id === sessionId);
          if (session) setAttendanceTarget(session);
        }}
      />

      <AttendanceModal
        session={attendanceTarget}
        onClose={() => setAttendanceTarget(null)}
        onSaved={reloadCurrentRange}
      />

      <Modal
        isOpen={cohortPickerOpen}
        onClose={() => setCohortPickerOpen(false)}
        title="Schedule sessions"
        maxWidth="520px"
        footer={<>
          <Button variant="secondary" onClick={() => setCohortPickerOpen(false)}>Cancel</Button>
          <Button type="submit" form="choose-schedule-cohort" disabled={!scheduleCohortId}>Continue</Button>
        </>}
      >
        <form id="choose-schedule-cohort" onSubmit={chooseScheduleCohort}>
          <FormField id="schedule-cohort" label="Cohort">
            <FloatingSelect
              id="schedule-cohort"
              value={scheduleCohortId}
              onChange={setScheduleCohortId}
              placeholder="Choose a cohort"
              options={cohortsForProgram.map(cohort => ({
                value: cohort.id,
                label: `${cohort.programName} · ${cohort.name}`,
              }))}
            />
          </FormField>
        </form>
      </Modal>

      <GenerateSessionsModal
        cohort={generationTarget}
        onClose={() => setGenerationTarget(null)}
        onSuccess={async () => {
          await Promise.all([
            reloadCurrentRange(),
            getCohorts().then(setCohorts),
          ]);
        }}
      />
    </div>
  );
}
