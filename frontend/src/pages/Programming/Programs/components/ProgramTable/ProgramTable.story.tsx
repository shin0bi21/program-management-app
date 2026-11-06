import { CYCLE_TABLE_QUERY_KEY } from '../CycleTable/queryKeys';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import Button from '../../../../../common/components/Button/Button';
import PageContainer from '../../../../../common/components/PageContainer/PageContainer';
import type { Program } from '../../../../../common/features/programs/types';
import CycleTable from '../CycleTable/CycleTable';
import useCycleTable from '../CycleTable/hooks/useCycleTable';
import ProgramTable from './ProgramTable';
import useProgramTable from './hooks/useProgramTable';

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
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    queryClient.setQueryData(['gallery-programs', 'table', { assignedOnly: true }], { pages: [{ rows: [program], nextCursor: null }], pageParams: [null] });
    queryClient.setQueryData([...CYCLE_TABLE_QUERY_KEY, { key: 'startsOn', direction: 'desc' }], { pages: [{ rows: [cycle], nextCursor: null }], pageParams: [null] });

    return queryClient;
  });
  const [cyclesOpen, setCyclesOpen] = useState(false);
  const { columns: programColumns } = useProgramTable(() => {}, () => {}, true, {
    assignments: [{ programId: program.id, state: 'active' }], loading: false, error: null,
  });
  const { columns: cycleColumns } = useCycleTable({ onEdit: () => {}, onDelete: () => {} });

  return (
    <QueryClientProvider client={client}>
      <PageContainer
        title="Programs"
        ariaLabel="Program management"
        actions={<Button onClick={() => setCyclesOpen(true)}>Manage Cycles</Button>}
        table={<ProgramTable
          queryKey={['gallery-programs', 'table']}
          filters={{ assignedOnly: true }}
          columns={programColumns}
        />}
      />
      <CycleTable
        columns={cycleColumns}
        isOpen={cyclesOpen}
        enabled={cyclesOpen}
        onClose={() => setCyclesOpen(false)}
        onAdd={() => {}}
      />
    </QueryClientProvider>
  );
}
