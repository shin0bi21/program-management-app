import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateSession } from '../../sessions.api';
import { makeProgramSession } from '../../../../../tests/factories/session';
import SessionModal from './SessionModal';

vi.mock('../../sessions.api', () => ({
  updateSession: vi.fn(),
}));

const session = makeProgramSession({ description: 'Practice session' });
const sessionTypes = [
  { id: 'Regular', name: 'Regular' },
  { id: 'Guest Speaker', name: 'Guest Speaker' },
];

describe('SessionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders session fields and submits edits with success feedback', async () => {
    vi.mocked(updateSession).mockResolvedValue({ session });
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithQueryClient(
      <SessionModal
        programs={[]}
        sessionTypes={sessionTypes}
        session={session}
        onClose={vi.fn()}
        onSaved={onSaved}
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
    fireEvent.submit(document.getElementById('session-form')!);

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(screen.getByText('Session updated successfully.')).toBeInTheDocument();
  });

  it('keeps the session open and reports update failures', async () => {
    vi.mocked(updateSession).mockRejectedValue(new Error('Session overlaps another session'));
    renderWithQueryClient(
      <SessionModal
        programs={[]}
        sessionTypes={sessionTypes}
        session={session}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Regular'));
    fireEvent.submit(document.getElementById('session-form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Session overlaps another session');
    expect(screen.getByRole('dialog', { name: 'Edit Session' })).toBeInTheDocument();
  });

});
