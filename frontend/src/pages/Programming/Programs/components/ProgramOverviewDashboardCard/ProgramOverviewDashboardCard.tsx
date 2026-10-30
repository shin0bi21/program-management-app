import { getDateKeyInTimeZone } from '../../../../../common/utils/date';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard, DashboardCardLoading } from '../../../../../common/components/DashboardCard/DashboardCard';
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

  const cohort = program && !error && !loading ? currentCohort : undefined;
  const enrolled = (cohort?.enrollmentRequired ?? program?.enrollmentRequired) !== false;
  const title = program
    ? `${program.name}${cohort ? ` - ${cohort.cycleName}` : ''} Overview`
    : 'Program Overview';
  const metricsLoading = Boolean(program) && loading;

  return <DashboardCard
    title={title}
    className="program-dashboard-card"
    action={<div className="program-dashboard__actions">
      {canManageRoster && enrolled && <Button
        size="sm" variant="secondary" disabled={!cohort}
        onClick={() => { if (cohort) onManageRoster(cohort); }}
      >Manage Roster</Button>}
      {canViewYouthReport && <Button
        size="sm" variant="secondary" disabled={!cohort || !enrolled}
        onClick={() => { if (cohort) onViewReport(cohort); }}
      >Attendance Report</Button>}
    </div>}
  >
    <section aria-label={cohort ? `${cohort.cycleName}: ${cohort.name}` : 'Program metrics'} className="program-dashboard__cohort">
      <dl className="program-dashboard__metrics" aria-busy={metricsLoading}>
        <div><dt>{enrolled ? 'Enrollment' : 'Youth attended'}</dt><dd>{metricsLoading
          ? <DashboardCardLoading label="Loading program rosters…" />
          : cohort ? enrolled ? cohort.enrolledCount : cohort.uniqueAttendeeCount : '—'}</dd></div>
        <div><dt>Average attendance</dt><dd>{metricsLoading
          ? <DashboardCardLoading label="Loading average attendance…" />
          : cohort?.averageAttendance == null ? '—' : `${cohort.averageAttendance}%`}</dd></div>
      </dl>
      {!program ? <p className="dashboard-card__empty">Select a program to view its current cohort.</p>
        : error ? <UnavailableState compact title="Program rosters unavailable" onRetry={onRetry} />
        : !loading && !cohort ? <p className="dashboard-card__empty">No current cohort matches the selected filters.</p> : null}
    </section>
  </DashboardCard>;
}
