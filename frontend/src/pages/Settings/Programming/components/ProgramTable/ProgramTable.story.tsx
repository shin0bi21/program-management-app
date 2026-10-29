import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Program } from '../../../../../common/features/programs/types';
import { referenceDataKeys } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import type { CycleReference } from '../../../../../common/features/referenceData/referenceData.api';
import Programming from '../../Programming';

export function ManagementTables() {
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    const program: Program = {
      id: 'program-1', name: 'Art', enrollmentRequired: true, minAge: null, maxAge: null,
      defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
    };
    const cycle: CycleReference = {
      id: 'cycle-1', name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2026-12-31', state: 'active',
    };
    queryClient.setQueryData(['programs', { assignedOnly: false }], [program]);
    queryClient.setQueryData(referenceDataKeys.cycles, [cycle]);
    return queryClient;
  });

  return <QueryClientProvider client={client}><Programming /></QueryClientProvider>;
}
