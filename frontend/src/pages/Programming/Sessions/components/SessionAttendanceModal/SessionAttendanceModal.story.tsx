import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeProgramSession } from '../../../../../tests/factories/session';
import SessionAttendanceModal from './SessionAttendanceModal';
import '../../Sessions.css';

const session = makeProgramSession({ enrollmentRequired: false });
const youth = Array.from({ length: 60 }, (_, index) => ({
  id: `youth-${index + 1}`,
  firstName: 'Person',
  lastName: String(index + 1).padStart(2, '0'),
}));

/**
 * Shows an open-session attendance picker with sixty selectable youth.
 * @example Searching Person 60 exposes choices beyond the initial visible group.
 */
export function OpenAttendance() {
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    queryClient.setQueryData(['sessions', 'attendance-youth'], youth);
    return queryClient;
  });

  return (
    <QueryClientProvider client={client}>
      <SessionAttendanceModal session={session}
        roster={[{ youthId: 'youth-1', firstName: 'Person', lastName: '01', status: 'present', notes: null }]}
        onClose={() => {}} onSaved={() => {}} />
    </QueryClientProvider>
  );
}
