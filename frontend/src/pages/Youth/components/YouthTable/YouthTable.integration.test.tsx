import { renderWithQueryClient } from '../../../../tests/queryClientTestUtils';
import { screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getYouth } from '../../youth.api';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import type { YouthProfile } from '../../types';
import YouthTable from './YouthTable';

vi.mock('../../youth.api', () => ({ getYouth: vi.fn() }));

vi.mock('../../../../common/components/Table/Table', () => ({
  default: () => <div aria-label="Mock youth table" />,
}));

describe('YouthTable selection reconciliation', () => {
  beforeEach(() => vi.mocked(getYouth).mockReset());

  it('reports only the selected profile without mirroring every rows array into the page', async () => {
    const profile = makeYouthProfile();
    vi.mocked(getYouth).mockResolvedValue({ rows: [profile], nextCursor: null } as never);

    function Harness() {
      const [selectedProfile, setSelectedProfile] = useState<YouthProfile | null>(null);
      return <>
        <span>{selectedProfile?.firstName ?? 'No selection'}</span>
        <YouthTable
          columns={[]}
          filters={{ search: '', programIds: [] }}
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

    renderWithQueryClient(<Harness />);

    await screen.findByText(profile.firstName);
    await waitFor(() => expect(getYouth).toHaveBeenCalledTimes(1));
  });
});
