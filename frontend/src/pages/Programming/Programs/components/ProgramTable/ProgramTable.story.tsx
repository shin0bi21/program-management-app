import { CYCLE_TABLE_QUERY_KEY } from '../CycleTable/queryKeys';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import Button from '../../../../../common/components/Button/Button';
import PageContainer from '../../../../../common/components/PageContainer/PageContainer';
import type { Program } from '../../../../../common/features/programs/types';
import CycleTable from '../CycleTable/CycleTable';
import ProgramTable from './ProgramTable';

const PROGRAM_TABLE_QUERY_KEY = ['programs', 'table'] as const;
const program: Program = {
  id: 'program-1', name: 'Art', enrollmentRequired: true, minAge: null, maxAge: null,
  defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
};
const cycle = {
  id: 'cycle-1', name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2026-12-31', state: 'active' as const,
};

/**
 * Displays seeded program and cycle tables for browser layout checks without network reads.
 * @example Opening Manage Cycles shows Fall 2026 in the Cycles dialog.
 */
export function ManagementTables() {
  const [cyclesOpen, setCyclesOpen] = useState(false);
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    queryClient.setQueryData([...PROGRAM_TABLE_QUERY_KEY, { assignedOnly: true }], { pages: [{ rows: [program], nextCursor: null }], pageParams: [null] });
    queryClient.setQueryData([...CYCLE_TABLE_QUERY_KEY, { key: 'startsOn', direction: 'desc' }], { pages: [{ rows: [cycle], nextCursor: null }], pageParams: [null] });
    return queryClient;
  });

  return <QueryClientProvider client={client}>
    <PageContainer
      title="Programs"
      ariaLabel="Program management"
      actions={<Button onClick={() => setCyclesOpen(true)}>Manage Cycles</Button>}
      table={<ProgramTable
        assignments={{
          assignments: [{
            programId: program.id, program: program.name, cycleId: cycle.id, cycle: cycle.name,
            startsOn: cycle.startsOn, endsOn: cycle.endsOn, state: cycle.state,
            enrollmentRequired: true, minAge: null, maxAge: null, enrolledCount: 0,
            uniqueAttendeeCount: 0,
          }],
          loading: false, ready: true, error: '', refresh: async () => {},
        }}
        queryKey={PROGRAM_TABLE_QUERY_KEY}
        filters={{ assignedOnly: true }}
        canWrite onEdit={() => {}} onManageCycles={() => {}}
      />}
    />
    <CycleTable
      onEdit={() => {}} onDelete={() => {}}
      isOpen={cyclesOpen}
      enabled={cyclesOpen}
      onClose={() => setCyclesOpen(false)}
      onAdd={() => {}}
    />
  </QueryClientProvider>;
}
