import { useState } from 'react';
import { DashboardCard } from '../../../../common/components/DashboardCard/DashboardCard';
import { getDateKeyInTimeZone } from '../../../../common/utils/date';
import YouthDashboardTabs from '../YouthDashboardTabs/YouthDashboardTabs';
import './AttendanceCard.css';

interface AttendanceCohort {
  id: string;
  name: string;
  programName: string;
  rosterMode: 'enrolled' | 'open';
  startsOn: string;
  endsOn: string;
  withdrawnOn: string | null;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  lastAttendedOn: string | null;
}

const attendanceTabs = [
  { value: 'active', label: 'Active' },
  { value: 'history', label: 'History' },
] as const;

export default function AttendanceCard({
  cohorts,
  selected,
}: {
  cohorts?: AttendanceCohort[];
  selected: boolean;
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
              <strong>{cohort.programName} · {cohort.name}</strong>
              {cohort.rosterMode === 'open' ? (
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
