import { useQuery } from '@tanstack/react-query';
import { getErrorMessage } from '../../../../../../http/errors';
import { getYouthAttendance } from '../../../../../../common/features/Attendance/attendance.api';

/**
 * Loads complete active-cycle attendance for the selected youth.
 * @param youthId - Selected youth ID; null leaves the dashboard without a selection.
 * @returns Complete cycle attendance, request state, and the dashboard's retry action.
 * @example useYouthAttendanceData(selectedProfileId) // one read shared with the attendance editor
 */
export default function useYouthAttendanceData(youthId: string | null) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['youth', 'attendance', youthId],
    queryFn: ({ signal }) => getYouthAttendance(youthId!, { signal }),
    enabled: Boolean(youthId),
  });

  return {
    attendance: data ?? null,
    loading: Boolean(youthId) && isLoading,
    error: error ? getErrorMessage(error, 'Could not load attendance.') : null,
    retry: refetch,
  };
}
