import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faPen } from '@fortawesome/free-solid-svg-icons';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import { getDateKeyInTimeZone } from '../../../../../common/utils/date';
import type { YouthProfile } from '../../../types';
import YouthDashboardTabs from './YouthDashboardTabs/YouthDashboardTabs';
import './YouthAttendanceDashboardCard.css';

type AttendanceCohort = YouthProfile['cohorts'][number];

const attendanceTabs = [
  { value: 'active', label: 'Active' },
  { value: 'history', label: 'History' },
] as const;

export default function YouthAttendanceDashboardCard({
  cohorts,
  selected,
  canManage = false,
  onManage,
  canViewReport = false,
  onViewReport,
}: {
  cohorts?: AttendanceCohort[];
  selected: boolean;
  canManage?: boolean;
  onManage?: (cohort: AttendanceCohort) => void;
  canViewReport?: boolean;
  onViewReport?: (cohort: AttendanceCohort) => void;
}) {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const today = getDateKeyInTimeZone();
  const visibleCohorts = cohorts?.filter(cohort => {
    const active = cohort.startsOn <= today && cohort.endsOn >= today && cohort.withdrawnOn === null;
    return activeTab === 'active' ? active : !active;
  }) ?? [];

  return (
    <DashboardCard
      title="Attendance"
      action={selected ? (
        <YouthDashboardTabs
          activeTab={activeTab}
          ariaLabel="Attendance view"
          onChange={setActiveTab}
          options={attendanceTabs}
        />
      ) : undefined}
      emptyMessage={!selected
        ? 'Select a row to view attendance.'
        : activeTab === 'active'
          ? 'No active cohort attendance.'
          : 'No historical attendance.'}
    >
      {selected && visibleCohorts.length ? (
        <div className="attendance-card__cohorts">
          {visibleCohorts.map(cohort => (
            <div className="attendance-card__cohort" key={cohort.id}>
              <div className="attendance-card__cohort-header">
                <strong>{cohort.programName} · {cohort.name}</strong>
                <div className="attendance-card__actions">
                  {canViewReport && onViewReport && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="attendance-card__view"
                      aria-label={`View attendance report for ${cohort.programName} · ${cohort.name}`}
                      disabled={!cohort.enrollmentRequired}
                      title={!cohort.enrollmentRequired ? undefined : 'View attendance report'}
                      onClick={() => onViewReport(cohort)}
                    >
                      <FontAwesomeIcon icon={faEye} aria-hidden="true" />
                    </Button>
                  )}
                  {canManage && onManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="attendance-card__manage"
                      aria-label={`Manage attendance for ${cohort.programName} · ${cohort.name}`}
                      title="Manage attendance"
                      onClick={() => onManage(cohort)}
                    >
                      <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
              {!cohort.enrollmentRequired ? (
                <p className="attendance-card__breakdown">
                  {cohort.presentCount} {cohort.presentCount === 1 ? 'visit' : 'visits'}
                </p>
              ) : (
                <p className="attendance-card__breakdown">
                  Present {cohort.presentCount}<span aria-hidden="true"> · </span>
                  Late {cohort.lateCount}<span aria-hidden="true"> · </span>
                  Absent {cohort.absentCount}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : undefined}
    </DashboardCard>
  );
}
