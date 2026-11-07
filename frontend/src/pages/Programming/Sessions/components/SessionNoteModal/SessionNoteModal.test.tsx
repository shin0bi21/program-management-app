import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeProgramSession } from '../../../../../tests/factories/session';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import SessionNoteModal from './SessionNoteModal';

const api = vi.hoisted(() => ({
  createSessionNote: vi.fn(),
  getSessionRoster: vi.fn(),
  updateSessionNote: vi.fn(),
}));

vi.mock('../../sessions.api', () => ({
  createSessionNote: api.createSessionNote,
  getSessionRoster: api.getSessionRoster,
  updateSessionNote: api.updateSessionNote,
}));

const session = makeProgramSession({
  sessionType: 'Regular',
  startsAt: '2026-07-28T21:00:00.000Z',
  endsAt: '2026-07-28T23:30:00.000Z',
  description: 'Planned communication exercise',
});

describe('SessionNoteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSessionRoster.mockResolvedValue([
      { youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson', status: null, notes: null },
      { youthId: 'youth-2', firstName: 'Noah', lastName: 'Williams', status: null, notes: null },
    ]);
    api.createSessionNote.mockResolvedValue({});
    api.updateSessionNote.mockResolvedValue({});
  });

  it('updates the category, note draft, and linked youth selection', async () => {
    render(<SessionNoteModal session={session} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByRole('group', { name: 'Link youth' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Behaviour' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note *' }), { target: { value: 'Led discussion.' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Maya Thompson' }));
    expect(screen.getByRole('button', { name: 'Category' })).toHaveTextContent('Behaviour');
    expect(screen.getByRole('textbox', { name: 'Note *' })).toHaveValue('Led discussion.');
    expect(screen.getByRole('checkbox', { name: 'Maya Thompson' })).toBeChecked();
  });

  it('preselects a youth for a youth-centric new note', async () => {
    render(
      <SessionNoteModal
        session={session}
        initialYouthId="youth-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(await screen.findByRole('checkbox', { name: 'Maya Thompson' })).toBeChecked();
  });

  it('keeps submission available while the optional roster loads', () => {
    api.getSessionRoster.mockReturnValue(new Promise(() => {}));
    render(<SessionNoteModal session={session} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByText('Loading youth…')).toBeInTheDocument();
  });

  it('shows a roster loading failure', async () => {
    api.getSessionRoster.mockRejectedValue(new Error('Roster unavailable'));
    render(<SessionNoteModal session={session} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Roster unavailable');
  });

  it('renders edit fields and linked youth', async () => {
    render(<SessionNoteModal session={session} note={{
      id: 'note-1', sessionId: session.id, category: 'achievement',
      details: 'Original details.', createdAt: '2026-07-28T23:30:00.000Z', updatedAt: '2026-07-28T23:30:00.000Z',
      createdByName: 'Programming Demo', youth: [{ youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson' }],
    }} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByRole('checkbox', { name: 'Maya Thompson' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Note *' })).toHaveValue('Original details.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('locks every form interaction while submission is pending', async () => {
    let resolve!: (value: unknown) => void;
    api.createSessionNote.mockReturnValue(new Promise(done => { resolve = done; }));
    render(<SessionNoteModal session={session} onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Note *' }), {
      target: { value: 'Pending note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.createSessionNote).toHaveBeenCalledOnce());

    expect(screen.getByRole('textbox', { name: 'Note *' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Category' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await act(async () => resolve({}));
  });
});
