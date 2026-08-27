import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionNote } from '../../../../../../common/types/cohort';
import { makeCohortSession } from '../../../../../../tests/factories/session';
import { renderWithQueryClient } from '../../../../../../tests/queryClientTestUtils';
import SessionNotesDashboardCard from './SessionNotesDashboardCard';

const queryKey = ['sessions'] as const;
const api = vi.hoisted(() => ({
  createSessionNote: vi.fn(),
  deleteSessionNote: vi.fn(),
  getSessionNotes: vi.fn(),
  getSessionRoster: vi.fn(),
  updateSessionNote: vi.fn(),
}));

vi.mock('../../../../../../common/features/programming/api/sessions.api', () => api);

const session = makeCohortSession();

const note = {
  id: 'note-1',
  sessionId: session.id,
  category: 'achievement',
  details: 'Maya led the opening activity.',
  createdAt: '2026-07-28T23:30:00.000Z',
  updatedAt: '2026-07-28T23:30:00.000Z',
  createdByName: 'Programming Demo',
  youth: [{ youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson' }],
} satisfies SessionNote;

describe('SessionNotesDashboardCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSessionNotes.mockResolvedValue([]);
    api.getSessionRoster.mockResolvedValue([]);
    api.deleteSessionNote.mockResolvedValue({});
  });

  it('owns empty, unselected, and add-note states', async () => {
    const view = renderWithQueryClient(
      <SessionNotesDashboardCard queryKey={queryKey} session={null} canWrite />,
    );
    expect(screen.getByText('No session selected.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add notes' })).toBeDisabled();
    expect(api.getSessionNotes).not.toHaveBeenCalled();

    view.unmount();
    renderWithQueryClient(
      <SessionNotesDashboardCard queryKey={queryKey} session={session} canWrite />,
    );
    expect(await screen.findByText('No notes.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add notes' }));
    expect(screen.getByRole('heading', { name: 'Add Note' })).toBeInTheDocument();
    expect(await screen.findByText('No youth are enrolled in this cohort.')).toBeInTheDocument();
  });

  it('shows note metadata and linked-youth details', async () => {
    api.getSessionNotes.mockResolvedValue([note]);
    renderWithQueryClient(<SessionNotesDashboardCard queryKey={queryKey} session={session} canWrite />);

    expect(await screen.findByRole('button', { name: 'View session note' })).toBeInTheDocument();
    expect(screen.queryByText(note.details)).not.toBeInTheDocument();
    expect(screen.getByText('Achievement')).toBeInTheDocument();
    expect(screen.getByText('Jul 28, 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View session note' }));
    expect(screen.getByRole('heading', { name: 'Session Note' })).toBeInTheDocument();
    expect(screen.getByText(/Programming Demo/)).toBeInTheDocument();
    expect(screen.getByText(note.details)).toBeInTheDocument();
    expect(screen.getByText('Maya Thompson')).toBeInTheDocument();
  });

  it('opens editing and deletes through the card-owned confirmation flow', async () => {
    api.getSessionNotes.mockResolvedValueOnce([note]).mockResolvedValue([]);
    renderWithQueryClient(<SessionNotesDashboardCard queryKey={queryKey} session={session} canWrite />);

    await screen.findByRole('button', { name: 'Edit session note' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit session note' }));
    expect(screen.getByRole('heading', { name: 'Edit Note' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete session note' }));
    const deleteModal = screen.getByRole('heading', { name: 'Delete Note' }).closest('.modal-container');
    fireEvent.click(within(deleteModal as HTMLElement).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(api.deleteSessionNote).toHaveBeenCalledWith(session.id, note.id));
    await waitFor(() => expect(screen.queryByText(note.details)).not.toBeInTheDocument());
  });
});
