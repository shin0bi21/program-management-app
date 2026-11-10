import { useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProgramOverviewDashboardCard from './ProgramOverviewDashboardCard';
import type { Program } from '../../../../../common/features/programs/types';
import type { ProgramCycleAssignment } from '../../types';
import { PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY } from '../../hooks/actions/programCycleAssignmentCache';
import type { AttendanceData } from '../../../../../common/features/Attendance/attendance.api';

const program: Program = {
  id: 'program-1', name: 'Art', enrollmentRequired: true, minAge: null, maxAge: null,
  defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
};

/**
 * Shows the program overview with seeded summary data or a pending query.
 * @param props.loading - Keeps the summary request pending for loading-state browser checks.
 * @example <ProgramDashboard loading />
 */
export function ProgramDashboard({ loading = false }: { loading?: boolean }) {
  const client = useMemo(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const queryKey = [...PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY, { programId: program.id }];
    if (loading) {
      void queryClient.fetchQuery({ queryKey, queryFn: () => new Promise<ProgramCycleAssignment[]>(() => {}) });
    } else {
      queryClient.setQueryData<ProgramCycleAssignment[]>(queryKey, [{
        programId: program.id, program: program.name,
        enrollmentRequired: true, minAge: null, maxAge: null,
        cycleId: 'cycle-1', cycle: 'Current Cycle', startsOn: '2020-01-01', endsOn: '2099-12-31', state: 'active',
        enrolledCount: 12, nextSessionDate: null, nextSessionId: null,
        uniqueAttendeeCount: 10,
      }]);
      queryClient.setQueryData<AttendanceData>(['programs', 'cycle-attendance', program.id, 'cycle-1'], {
        programCycle: {
          programId: program.id, program: program.name, cycleId: 'cycle-1', cycle: 'Current Cycle', enrollmentRequired: true,
        },
        youth: [],
        averageAttendance: 75,
      });
    }
    return queryClient;
  }, [loading]);

  return <QueryClientProvider key={loading ? 'loading' : 'loaded'} client={client}>
    <div style={{ width: 'min(100%, 360px)' }}>
      <ProgramOverviewDashboardCard program={program} canManageRoster canViewYouthReport />
    </div>
  </QueryClientProvider>;
}
