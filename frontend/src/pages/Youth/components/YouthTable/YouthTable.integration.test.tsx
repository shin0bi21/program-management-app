import { renderWithQueryClient } from '../../../../tests/queryClientTestUtils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getYouth } from '../../youth.api';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import type { YouthProfile } from '../../types';
import { youthData } from '../../hooks/data/useYouthData';
import { useYouthSelection } from '../../hooks/selection/useYouthSelection';
import YouthTable from './YouthTable';

vi.mock('../../youth.api', () => ({ getYouth: vi.fn() }));
vi.mock('../../../../common/components/Table/Table', () => ({
  default: ({ data, onRowSelect }: { data: YouthProfile[]; onRowSelect: (profile: YouthProfile) => void }) => <>
    {data.map(profile => <button key={profile.id} onClick={() => onRowSelect(profile)}>Select {profile.firstName}</button>)}
  </>,
}));

/**
 * Connects the table's selection event to the page-owned identifier and saved profile.
 * @example <Harness /> // selection remains visible after applying an empty filter
 */
function Harness() {
  const [search, setSearch] = useState('');
  const records = youthData.useRecords();
  const { selectedProfile, selectedProfileId, selectProfile } = useYouthSelection(records, { onSelectedProfileIdChange: vi.fn() });
  return <>
    <span>Selected: {selectedProfile?.firstName ?? 'None'}</span>
    <button onClick={() => setSearch('missing')}>Apply empty filter</button>
    <YouthTable
      records={records}
      columns={[]}
      filters={{ search }}
      hiddenColumnKeys={[]}
      sorting={{ key: 'firstName', direction: 'asc' }}
      columnWidths={{}}
      selectedProfileId={selectedProfileId}
      onRowSelect={selectProfile}
      onSortingChange={vi.fn()}
      onColumnWidthsChange={vi.fn()}
    />
  </>;
}

describe('YouthTable selection ownership', () => {
  beforeEach(() => vi.mocked(getYouth).mockReset());

  it('retains selection across filters and resolves subsequent saved records from the owner', async () => {
    const profile = makeYouthProfile();
    vi.mocked(getYouth).mockResolvedValueOnce({ rows: [profile], nextCursor: null } as never);
    vi.mocked(getYouth).mockResolvedValue({ rows: [], nextCursor: null } as never);
    const { queryClient } = renderWithQueryClient(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Select Jamie' }));
    expect(screen.getByText('Selected: Jamie')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply empty filter' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Select Jamie' })).not.toBeInTheDocument());
    expect(screen.getByText('Selected: Jamie')).toBeInTheDocument();

    act(() => youthData.write(queryClient, { ...profile, firstName: 'Saved name' }));
    expect(await screen.findByText('Selected: Saved name')).toBeInTheDocument();
    expect(getYouth).toHaveBeenCalledTimes(2);
  });
});
