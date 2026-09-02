// Owns YouthTable.integration rendered behavior and owner wiring.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getYouth } from '../../../../common/features/youth/youth.api';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import type { YouthProfile } from '../../types';
import YouthTable from './YouthTable';

vi.mock('../../../../common/features/youth/youth.api', () => ({ getYouth: vi.fn() }));

vi.mock('../../../../common/components/Table/Table', () => ({
  default: () => <div aria-label="Mock youth table" />,
}));

describe('YouthTable selection reconciliation', () => {
  beforeEach(() => vi.mocked(getYouth).mockReset());

  it('reports only the selected profile without mirroring every rows array into the page', async () => {
    const profile = makeYouthProfile();
    vi.mocked(getYouth).mockResolvedValue({ rows: [profile], nextCursor: null } as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    function Harness() {
      const [selectedProfile, setSelectedProfile] = useState<YouthProfile | null>(null);
      return <>
        <span>{selectedProfile?.firstName ?? 'No selection'}</span>
        <YouthTable
          columns={[]}
          filters={{ search: '', statuses: [], programIds: [] }}
          hiddenColumnKeys={[]}
          sorting={{ key: 'firstName', direction: 'asc' }}
          columnWidths={{}}
          selectedProfileId={profile.id}
          onSelectedProfileResolved={setSelectedProfile}
          onRowSelect={setSelectedProfile}
          onSortingChange={vi.fn()}
          onColumnWidthsChange={vi.fn()}
        />
      </>;
    }

    render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);

    await screen.findByText(profile.firstName);
    await waitFor(() => expect(getYouth).toHaveBeenCalledTimes(1));
  });
});
