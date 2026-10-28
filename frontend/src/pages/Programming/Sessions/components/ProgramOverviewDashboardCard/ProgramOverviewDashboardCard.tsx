import { getDateKeyInTimeZone } from '../../../../../common/utils/date';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import type { Program } from '../../../../../common/features/programs/types';
import type { ProgramCohort } from '../../../Cohorts/types';
import './ProgramOverviewDashboardCard.css';

interface ProgramOverviewDashboardCardProps {
  program: Program | null;
  cohorts: ProgramCohort[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  canManageRoster: boolean;
  canViewYouthReport: boolean;
  onManageRoster: (cohort: ProgramCohort) => void;
  onViewReport: (cohort: ProgramCohort) => void;
}

export default function ProgramOverviewDashboardCard({
  program, cohorts, loading = false, error, onRetry, canManageRoster, canViewYouthReport,
  onManageRoster, onViewReport,
}: ProgramOverviewDashboardCardProps) {
  const today = program ? getDateKeyInTimeZone(new Date(), program.timezone) : '';
  const currentCohort = cohorts
    .filter(cohort => cohort.startsOn <= today && cohort.endsOn >= today)
    .sort((left, right) => right.startsOn.localeCompare(left.startsOn) || left.id.localeCompare(right.id))[0];

  if (program && !error && !loading && currentCohort) {
    const cohort = currentCohort;
    const enrolled = cohort.enrollmentRequired;

    return <DashboardCard
      key={cohort.id}
      title={`${program.name} - ${cohort.cycleName} Overview`}
      className="program-dashboard-card"
      action={
        <div className="program-dashboard__actions">
          {canManageRoster && enrolled && <Button size="sm" variant="secondary" onClick={() => onManageRoster(cohort)}>Manage Roster</Button>}
          {canViewYouthReport && <Button
            size="sm"
            variant="secondary"
            disabled={!enrolled}
            onClick={() => onViewReport(cohort)}
          >Attendance Report</Button>}
        </div>
      }
    >
      <section aria-label={`${cohort.cycleName}: ${cohort.name}`} className="program-dashboard__cohort">
        <dl className="program-dashboard__metrics">
          <div><dt>{enrolled ? 'Enrollment' : 'Youth attended'}</dt><dd>{enrolled ? cohort.enrolledCount : cohort.uniqueAttendeeCount}</dd></div>
          <div><dt>Average attendance</dt><dd>{cohort.averageAttendance === null ? '—' : `${cohort.averageAttendance}%`}</dd></div>
        </dl>
      </section>
    </DashboardCard>;
  }

  return <DashboardCard title={program ? `${program.name} Overview` : 'Program overview'} className="program-dashboard-card">
    {!program ? <p className="dashboard-card__empty">Select a program to view its current cohort.</p> : <>
      {error ? <UnavailableState title="Program rosters unavailable" onRetry={onRetry} /> : loading
        ? <p role="status">Loading program rosters…</p>
        : <p className="dashboard-card__empty">No current cohort matches the selected filters.</p>}
    </>}
  </DashboardCard>;
}
