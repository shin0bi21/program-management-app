import ProgramOverviewDashboardCard from './ProgramOverviewDashboardCard';
import type { Program } from '../../../../../common/features/programs/types';

const program: Program = {
  id: 'program-1', name: 'Art', enrollmentRequired: true, minAge: null, maxAge: null,
  defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
};

export function ProgramDashboard({ loading = false }: { loading?: boolean }) {
  return <div style={{ width: 'min(100%, 360px)' }}><ProgramOverviewDashboardCard
    program={program}
    loading={loading}
    assignments={[{
      programId: program.id, program: program.name,
      enrollmentRequired: true, minAge: null, maxAge: null,
      cycleId: 'cycle-1', cycle: 'Current Cycle', startsOn: '2020-01-01', endsOn: '2099-12-31', state: 'active',
      enrolledCount: 12, nextSessionAt: null, nextSessionId: null,
      averageAttendance: 75, attendanceAttendedCount: 9, attendanceRecordedCount: 12, uniqueAttendeeCount: 10,
    }]}
    canManageRoster canViewYouthReport onManageRoster={() => {}} onViewReport={() => {}}
  /></div>;
}
