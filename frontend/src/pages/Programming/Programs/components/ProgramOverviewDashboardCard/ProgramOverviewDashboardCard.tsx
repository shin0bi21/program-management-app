import { getDateKeyInTimeZone } from '../../../../../common/utils/date';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard, DashboardCardLoading } from '../../../../../common/components/DashboardCard/DashboardCard';
import type { Program } from '../../../../../common/features/programs/types';
import type { ProgramCycleAssignment } from '../../types';
import './ProgramOverviewDashboardCard.css';

interface ProgramOverviewDashboardCardProps {
  program: Program | null;
  assignments: ProgramCycleAssignment[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  canManageRoster: boolean;
  canViewYouthReport: boolean;
  onManageRoster: (assignment: ProgramCycleAssignment) => void;
  onViewReport: (assignment: ProgramCycleAssignment) => void;
}

export default function ProgramOverviewDashboardCard({
  program, assignments, loading = false, error, onRetry, canManageRoster, canViewYouthReport,
  onManageRoster, onViewReport,
}: ProgramOverviewDashboardCardProps) {
  const today = program ? getDateKeyInTimeZone(new Date(), program.timezone) : '';
  const currentAssignment = assignments
    .filter(assignment => assignment.startsOn <= today && assignment.endsOn >= today)
    .sort((left, right) => right.startsOn.localeCompare(left.startsOn) || left.cycleId.localeCompare(right.cycleId))[0];

  const assignment = program && !error && !loading ? currentAssignment : undefined;
  const enrolled = (assignment?.enrollmentRequired ?? program?.enrollmentRequired) !== false;
  const cycleName = assignment?.cycleName;
  const title = program
    ? `${program.name}${cycleName ? ` - ${cycleName}` : ''} Overview`
    : 'Program Overview';
  const metricsLoading = Boolean(program) && loading;

  return <DashboardCard
    title={title}
    className="program-dashboard-card"
    action={<div className="program-dashboard__actions">
      {canManageRoster && enrolled && <Button
        size="sm" variant="secondary" disabled={!assignment}
        onClick={() => { if (assignment) onManageRoster(assignment); }}
      >Manage Roster</Button>}
      {canViewYouthReport && <Button
        size="sm" variant="secondary" disabled={!assignment || !enrolled}
        onClick={() => { if (assignment) onViewReport(assignment); }}
      >Attendance Report</Button>}
    </div>}
  >
    <section aria-label={assignment ? assignment.cycleName : 'Program metrics'} className="program-dashboard__cohort">
      <dl className="program-dashboard__metrics" aria-busy={metricsLoading}>
        <div><dt>{enrolled ? 'Enrollment' : 'Youth attended'}</dt><dd>{metricsLoading
          ? <DashboardCardLoading label="Loading program rosters…" />
          : assignment ? enrolled ? assignment.enrolledCount : assignment.uniqueAttendeeCount : '—'}</dd></div>
        <div><dt>Average attendance</dt><dd>{metricsLoading
          ? <DashboardCardLoading label="Loading average attendance…" />
          : assignment?.averageAttendance == null ? '—' : `${assignment.averageAttendance}%`}</dd></div>
      </dl>
      {!program ? <p className="dashboard-card__empty">Select a program to view its current cycle.</p>
        : error ? <UnavailableState compact title="Program rosters unavailable" onRetry={onRetry} />
        : !loading && !assignment ? <p className="dashboard-card__empty">No current cycle for this program.</p> : null}
    </section>
  </DashboardCard>;
}
