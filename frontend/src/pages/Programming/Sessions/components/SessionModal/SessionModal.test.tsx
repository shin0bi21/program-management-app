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

const session = makeProgramSession({
  date: '2026-12-21', startTime: '17:00', endTime: '19:30', description: 'Practice session',
});
const sessionTypes = [
  { id: 'Regular', name: 'Regular' },
  { id: 'Guest Speaker', name: 'Guest Speaker' },
];

describe('SessionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits edits with the saved date and minute-based clock times', async () => {
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
    expect(screen.getByLabelText('Start Time')).toHaveValue('17:00');
    expect(screen.getByLabelText('End Time')).toHaveValue('19:30');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Regular'));
    await user.click(screen.getByRole('button', { name: 'Type' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Guest Speaker' }));
    await user.clear(screen.getByRole('textbox', { name: 'Title / Theme' }));
    await user.type(screen.getByRole('textbox', { name: 'Title / Theme' }), 'Career Stories');
    await user.clear(screen.getByRole('textbox', { name: 'Description' }));
    fireEvent.change(screen.getByLabelText('Session Date'), { target: { value: '2026-12-22' } });
    fireEvent.submit(document.getElementById('session-form')!);

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(updateSession).toHaveBeenCalledWith(session.id, {
      sessionType: 'Guest Speaker', theme: 'Career Stories', description: null,
      date: '2026-12-22', startTime: '17:00', endTime: '19:30',
    });
  });
});
