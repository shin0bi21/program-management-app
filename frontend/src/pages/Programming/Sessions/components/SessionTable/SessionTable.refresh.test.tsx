import { useState } from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import PageMessageOverlay, { type PageMessageValue } from '../../../../../common/components/PageMessageOverlay/PageMessageOverlay';
import { replaceInfiniteListRow } from '../../../../../query/infiniteListCache';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';
import { makeProgramSession } from '../../../../../tests/factories/session';
import { getSessions } from '../../sessions.api';
import SessionTable from './SessionTable';

vi.mock('../../sessions.api', () => ({ getSessions: vi.fn() }));

it('keeps edited rows visible with the error and ordering warning when manual refresh fails', async () => {
  const first = makeProgramSession({ id: 'first', theme: 'Alpha' });
  const second = makeProgramSession({ id: 'second', theme: 'Beta' });
  vi.mocked(getSessions).mockResolvedValue({ rows: [first, second], nextCursor: null });
  const user = userEvent.setup();
  function Page() {
    const [message, setMessage] = useState<PageMessageValue>(null);
    return <>
      <PageMessageOverlay messages={[message]} />
      <SessionTable queryKey={['sessions', 'table']} columns={[
        { id: 'theme', header: 'Theme', cell: ({ row }) => row.original.theme },
      ]} hiddenColumnKeys={[]} filters={{}} sorting={{ key: 'theme', direction: 'asc' }}
      columnWidths={{}} selectedSessionId="first" onSessionSelect={vi.fn()} onSortingChange={vi.fn()}
      onColumnWidthsChange={vi.fn()} onSelectedSessionResolved={vi.fn()} onMessageChange={setMessage} />
    </>;
  }
  const { queryClient } = renderWithQueryClient(<Page />);
  expect(await screen.findByRole('cell', { name: 'Alpha' })).toBeVisible();

  act(() => replaceInfiniteListRow(queryClient, ['sessions', 'table'], { ...first, theme: 'Gamma' }));
  expect(await screen.findByText('This table’s data is out of order.')).toBeVisible();
  vi.mocked(getSessions).mockRejectedValueOnce(new Error('Refresh failed'));
  await user.click(screen.getByRole('button', { name: 'Refresh' }));

  await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible());
  expect(screen.getByRole('cell', { name: 'Gamma' })).toBeVisible();
  expect(screen.getByRole('cell', { name: 'Beta' })).toBeVisible();
  expect(screen.getByText('This table’s data is out of order.')).toBeVisible();
  expect(screen.queryByText('Sessions unavailable')).not.toBeInTheDocument();
  expect(getSessions).toHaveBeenCalledTimes(2);
});
