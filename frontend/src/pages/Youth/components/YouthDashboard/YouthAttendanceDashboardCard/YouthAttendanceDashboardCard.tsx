import { useState, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faPen } from '@fortawesome/free-solid-svg-icons';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import { getDateKeyInTimeZone } from '../../../../../common/utils/date';
import type { YouthAttendanceSummary } from './youthAttendanceSummary.api';
import useYouthAttendanceSummary from './hooks/useYouthAttendanceSummary';
import YouthDashboardTabs from './YouthDashboardTabs/YouthDashboardTabs';
import './YouthAttendanceDashboardCard.css';

const attendanceTabs = [
  { value: 'active', label: 'Active' },
  { value: 'history', label: 'History' },
] as const;

/**
 * Loads and displays attendance totals for the selected youth, with active/history tabs.
 * @param props.youthId - Selected youth ID; null displays the no-selection message.
 * @param props.canManage - Whether to show attendance editing actions.
 * @param props.onManage - Opens attendance editing for the selected program and cycle.
 * @param props.canViewReport - Whether to show report actions.
 * @param props.onViewReport - Opens the report for the selected program and cycle.
 * @example <YouthAttendanceDashboardCard youthId={selectedProfileId} />
 */
export default function YouthAttendanceDashboardCard({
  youthId,
  canManage = false,
  onManage,
  canViewReport = false,
  onViewReport,
}: {
  youthId: string | null;
  canManage?: boolean;
  onManage?: (programCycle: YouthAttendanceSummary) => void;
  canViewReport?: boolean;
  onViewReport?: (programCycle: YouthAttendanceSummary) => void;
}) {
  const { programCycles, loading, error, retry } = useYouthAttendanceSummary(youthId);
  const selected = youthId !== null;
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const today = getDateKeyInTimeZone();
  const visibleProgramCycles = programCycles.filter(programCycle => {
    const active = programCycle.startsOn <= today && programCycle.endsOn >= today && programCycle.withdrawnOn === null;
    return activeTab === 'active' ? active : !active;
  });

  let emptyMessage = 'Select a row to view attendance.';
  if (selected) {
    emptyMessage = activeTab === 'active' ? 'No active program attendance.' : 'No historical attendance.';
  }

  let content: ReactNode = null;
  if (error) {
    content = <div role="alert">
      <p>{error}</p>
      <Button size="sm" onClick={() => { void retry(); }}>Retry</Button>
    </div>;
  } else if (selected && visibleProgramCycles.length > 0) {
    content = (
      <div className="attendance-card__cohorts">
        {visibleProgramCycles.map(programCycle => (
          <div className="attendance-card__cohort" key={`${programCycle.programId}:${programCycle.cycleId}`}>
            <div className="attendance-card__cohort-header">
              <strong>{programCycle.program} · {programCycle.cycle}</strong>
              <div className="attendance-card__actions">
                {canViewReport && onViewReport && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="attendance-card__view"
                    aria-label={`View attendance report for ${programCycle.program} · ${programCycle.cycle}`}
                    disabled={!programCycle.enrollmentRequired}
                    title={!programCycle.enrollmentRequired ? undefined : 'View attendance report'}
                    onClick={() => onViewReport(programCycle)}
                  >
                    <FontAwesomeIcon icon={faEye} aria-hidden="true" />
                  </Button>
                )}
                {canManage && onManage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="attendance-card__manage"
                    aria-label={`Manage attendance for ${programCycle.program} · ${programCycle.cycle}`}
                    title="Manage attendance"
                    onClick={() => onManage(programCycle)}
                  >
                    <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>
            {!programCycle.enrollmentRequired ? (
              <p className="attendance-card__breakdown">
                {programCycle.presentCount} {programCycle.presentCount === 1 ? 'visit' : 'visits'}
              </p>
            ) : (
              <p className="attendance-card__breakdown">
                Present {programCycle.presentCount}<span aria-hidden="true"> · </span>
                Late {programCycle.lateCount}<span aria-hidden="true"> · </span>
                Absent {programCycle.absentCount}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <DashboardCard
      title="Attendance"
      loading={loading}
      loadingLabel="Loading attendance…"
      action={(
        <YouthDashboardTabs
          activeTab={activeTab}
          disabled={!selected}
          ariaLabel="Attendance view"
          onChange={setActiveTab}
          options={attendanceTabs}
        />
      )}
      emptyMessage={emptyMessage}
    >
      {content}
    </DashboardCard>
  );
}
