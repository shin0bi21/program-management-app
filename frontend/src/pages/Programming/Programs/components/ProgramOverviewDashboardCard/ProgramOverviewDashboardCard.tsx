import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProgramCycleAttendance } from '../../../../../common/features/Attendance/attendance.api';
import { getErrorMessage } from '../../../../../http/errors';
import { getDateKeyInTimeZone } from '../../../../../common/utils/date';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard, DashboardCardLoading } from '../../../../../common/components/DashboardCard/DashboardCard';
import type { Program } from '../../../../../common/features/programs/types';
import type { ProgramCycleKey } from '../../types';
import { useProgramCycleAssignments } from '../../hooks/data/useProgramCycleAssignments';
import usePageMessageReporter, { type PageMessageChangeHandler } from '../../../../../common/components/PageMessageOverlay/usePageMessageReporter';
import ManageRosterModal from '../ManageRosterModal/ManageRosterModal';
import ViewAttendanceModal from '../../../../../common/features/Attendance/ViewAttendanceModal';
import './ProgramOverviewDashboardCard.css';

/**
 * Loads the selected program's summaries and resolves roster/report targets from that query.
 * @param props - Selected program context, permissions, and message reporter.
 * @example <ProgramOverviewDashboardCard program={selectedProgram} {...permissions} />
 */
export default function ProgramOverviewDashboardCard({ program, canManageRoster, canViewYouthReport, onMessageChange }: {
  program: Program | null;
  canManageRoster: boolean;
  canViewYouthReport: boolean;
  onMessageChange?: PageMessageChangeHandler;
}) {
  const programId = program?.id;
  const query = useProgramCycleAssignments(programId, Boolean(programId));
  const [rosterTarget, setRosterTarget] = useState<ProgramCycleKey | null>(null);
  const [reportTarget, setReportTarget] = useState<ProgramCycleKey | null>(null);
  const rosterAssignment = query.assignments.find(assignment => assignment.programId === programId
    && assignment.programId === rosterTarget?.programId && assignment.cycleId === rosterTarget?.cycleId);
  const reportAssignment = query.assignments.find(assignment => assignment.programId === programId
    && assignment.programId === reportTarget?.programId && assignment.cycleId === reportTarget?.cycleId);
  const roster = program && canManageRoster && rosterAssignment?.enrollmentRequired ? rosterAssignment : null;
  const report = program && canViewYouthReport && reportAssignment?.enrollmentRequired ? reportAssignment : null;
  let error: string | null = null;
  if (program) error = query.error || null;

  useEffect(() => {
    setRosterTarget(null);
    setReportTarget(null);
  }, [programId]);
  useEffect(() => {
    if (rosterTarget && !roster) setRosterTarget(null);
    if (reportTarget && !report) setReportTarget(null);
  }, [report, reportTarget, roster, rosterTarget]);

  const loading = Boolean(program) && query.loading;
  const assignments = program ? query.assignments : [];
  const today = program ? getDateKeyInTimeZone(new Date(), program.timezone) : '';
  const currentAssignment = assignments
    .filter(assignment => assignment.startsOn <= today && assignment.endsOn >= today)
    .sort((left, right) => right.startsOn.localeCompare(left.startsOn) || left.cycleId.localeCompare(right.cycleId))[0];

  const assignment = program && !error && !loading ? currentAssignment : undefined;
  const attendanceQuery = useQuery({
    queryKey: ['programs', 'cycle-attendance', programId, assignment?.cycleId],
    queryFn: ({ signal }) => getProgramCycleAttendance(assignment!, { signal }),
    enabled: Boolean(program && canViewYouthReport && assignment),
  });
  const reportError = attendanceQuery.error ? getErrorMessage(attendanceQuery.error, 'Could not load attendance report data.') : null;
  usePageMessageReporter(onMessageChange, error || reportError, {
    label: 'Retry', onClick: error ? query.refresh : attendanceQuery.refetch,
  });

  const enrolled = (assignment?.enrollmentRequired ?? program?.enrollmentRequired) !== false;
  const cycle = assignment?.cycle;
  let title = 'Program Overview';
  if (program) {
    const cycleSuffix = cycle ? ` - ${cycle}` : '';
    title = `${program.name}${cycleSuffix} Overview`;
  }
  const metricsLoading = Boolean(program) && loading;
  const attendanceLoading = metricsLoading || Boolean(assignment && canViewYouthReport && attendanceQuery.isLoading);
  let enrollmentValue: ReactNode = '—';
  let attendanceValue: ReactNode = '—';
  if (metricsLoading) {
    enrollmentValue = <DashboardCardLoading label="Loading program rosters…" />;
  } else if (assignment) {
    enrollmentValue = enrolled ? assignment.enrolledCount : assignment.uniqueAttendeeCount;
  }
  if (attendanceLoading) {
    attendanceValue = <DashboardCardLoading label="Loading average attendance…" />;
  } else if (assignment && canViewYouthReport && attendanceQuery.data?.averageAttendance != null) {
    attendanceValue = `${attendanceQuery.data.averageAttendance}%`;
  }
  let message: ReactNode;
  if (error) {
    message = <UnavailableState compact title="Program rosters unavailable" onRetry={query.refresh} />;
  } else if (!program) {
    message = <p className="dashboard-card__empty">Select a program to view its current cycle.</p>;
  } else if (!loading && !assignment) {
    message = <p className="dashboard-card__empty">No current cycle for this program.</p>;
  }

  return <>
    <DashboardCard
      title={title}
      className="program-dashboard-card"
      action={<div className="program-dashboard__actions">
        {canManageRoster && enrolled && <Button
          size="sm" variant="secondary" disabled={!assignment}
          onClick={() => { if (assignment) setRosterTarget({ programId: assignment.programId, cycleId: assignment.cycleId }); }}
        >Manage Roster</Button>}
        {canViewYouthReport && <Button
          size="sm" variant="secondary" disabled={!assignment || !enrolled || !attendanceQuery.data}
          onClick={() => { if (assignment) setReportTarget({ programId: assignment.programId, cycleId: assignment.cycleId }); }}
        >Attendance Report</Button>}
      </div>}
    >
      <section aria-label={assignment ? assignment.cycle : 'Program metrics'} className="program-dashboard__cohort">
        <dl className="program-dashboard__metrics" aria-busy={metricsLoading}>
          <div><dt>{enrolled ? 'Enrollment' : 'Youth attended'}</dt><dd>{enrollmentValue}</dd></div>
          <div><dt>Average attendance</dt><dd>{attendanceValue}</dd></div>
        </dl>
        {message}
      </section>
    </DashboardCard>

    {canManageRoster && (
      <ManageRosterModal
        assignment={roster}
        onClose={() => setRosterTarget(null)}
        onSuccess={query.refresh}
      />
    )}
    {canViewYouthReport && report && attendanceQuery.data
      && report.cycleId === attendanceQuery.data.programCycle.cycleId && (
      <ViewAttendanceModal
        data={attendanceQuery.data}
        onClose={() => setReportTarget(null)}
      />
    )}
  </>;
}
