import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';
import { getYouthProfileNotes } from '../../../youth.api';
import type { YouthProfileNote } from '../../../types';
import YouthNotesDashboardCard from './YouthNotesDashboardCard';

vi.mock('../../../youth.api', () => ({ getYouthProfileNotes: vi.fn() }));

describe('YouthNotesDashboardCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('distinguishes loading notes from an empty selected profile', async () => {
    let finishRead!: (notes: YouthProfileNote[]) => void;
    vi.mocked(getYouthProfileNotes).mockReturnValue(new Promise(resolve => { finishRead = resolve; }));
    const onSelectProfileNote = vi.fn();
    const { rerender } = renderWithQueryClient(<YouthNotesDashboardCard youthId={null} onSelectProfileNote={onSelectProfileNote} />);
    expect(getYouthProfileNotes).not.toHaveBeenCalled();

    rerender(<YouthNotesDashboardCard youthId="youth-1" onSelectProfileNote={onSelectProfileNote} />);

    expect(screen.getByRole('status', { name: 'Loading profile notes…' })).toBeInTheDocument();
    expect(screen.queryByText('No profile notes recorded.')).not.toBeInTheDocument();
    expect(getYouthProfileNotes).toHaveBeenCalledWith('youth-1', { signal: expect.any(AbortSignal) });

    await act(async () => finishRead([]));

    expect(await screen.findByText('No profile notes recorded.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('reports a query error to the page and renders a neutral unavailable state', async () => {
    vi.mocked(getYouthProfileNotes).mockRejectedValue(new Error('Unavailable'));
    const onMessageChange = vi.fn();
    renderWithQueryClient(<YouthNotesDashboardCard
      youthId="youth-1"
      onMessageChange={onMessageChange}
      onSelectProfileNote={vi.fn()}
    />);

    expect(await screen.findByText('Profile notes unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(onMessageChange).toHaveBeenLastCalledWith({
      message: 'Could not load profile notes',
      action: { label: 'Retry', onClick: expect.any(Function) },
    }));
  });
});
