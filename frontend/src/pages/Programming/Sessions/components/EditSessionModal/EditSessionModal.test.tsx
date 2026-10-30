import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSessionTypes, updateSession } from '../../sessions.api';
import { makeCohortSession } from '../../../../../tests/factories/session';
import EditSessionModal from './EditSessionModal';

vi.mock('../../sessions.api', () => ({
  getSessionTypes: vi.fn(),
  updateSession: vi.fn(),
}));

const session = makeCohortSession({ description: 'Practice session' });

describe('EditSessionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionTypes).mockResolvedValue([
      { id: 'type-1', name: 'Regular' },
      { id: 'type-2', name: 'Guest Speaker' },
    ]);
  });

  it('renders session fields and submits edits with success feedback', async () => {
    vi.mocked(updateSession).mockResolvedValue({ session });
    const onUpdated = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithQueryClient(
      <EditSessionModal
        session={session}
        onClose={vi.fn()}
        onUpdated={onUpdated}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Title / Theme' })).toHaveValue('Communication');
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Practice session');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Regular'));
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Guest Speaker' }));
    await user.clear(screen.getByRole('textbox', { name: 'Title / Theme' }));
    await user.type(screen.getByRole('textbox', { name: 'Title / Theme' }), 'Career Stories');
    await user.clear(screen.getByRole('textbox', { name: 'Description' }));
    fireEvent.submit(document.getElementById('edit-session-form')!);

    await waitFor(() => expect(onUpdated).toHaveBeenCalledOnce());
    expect(screen.getByText('Session updated successfully.')).toBeInTheDocument();
  });

  it('keeps the session open and reports update failures', async () => {
    vi.mocked(updateSession).mockRejectedValue(new Error('Session overlaps another session'));
    renderWithQueryClient(
      <EditSessionModal
        session={session}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Regular'));
    fireEvent.submit(document.getElementById('edit-session-form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Session overlaps another session');
    expect(screen.getByRole('dialog', { name: 'Edit Session' })).toBeInTheDocument();
  });

  it('renders fields for a different session target', async () => {
    const props = { onClose: vi.fn(), onUpdated: vi.fn() };
    const view = renderWithQueryClient(<EditSessionModal session={session} {...props} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Regular'));
    view.rerender(<EditSessionModal session={null} {...props} />);
    view.rerender(<EditSessionModal
      session={{ ...session, id: 'session-2', sessionTypeId: 'type-2', theme: 'Career Stories' }}
      {...props}
    />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Guest Speaker'));
    expect(screen.getByRole('textbox', { name: 'Title / Theme' })).toHaveValue('Career Stories');
  });
});
