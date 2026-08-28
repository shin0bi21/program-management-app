// Owns cycle create/edit initialization, payloads, callback ordering, errors, and reopen resets.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setProgramCycle } from '../../../../../common/features/programming/api/cohorts.api';
import type { ProgramCycle } from '../../../../../common/types/cohort';
import CycleModal from './CycleModal';

vi.mock('../../../../../common/features/programming/api/cohorts.api', () => ({ setProgramCycle: vi.fn() }));

const cycle: ProgramCycle = {
  id: 'cycle-1', name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31', state: 'upcoming',
};

describe('CycleModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a cycle and waits for the owner refresh', async () => {
    const user = userEvent.setup();
    vi.mocked(setProgramCycle).mockResolvedValue(cycle);
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<CycleModal isOpen cycle={null} onClose={vi.fn()} onSaved={onSaved} />);

    await user.type(screen.getByRole('textbox', { name: 'Cycle name' }), 'Fall 2026');
    await user.type(screen.getByLabelText('Starts on'), '2026-09-01');
    await user.type(screen.getByLabelText('Ends on'), '2027-01-31');
    await user.click(screen.getByRole('button', { name: 'Add Cycle' }));

    expect(setProgramCycle).toHaveBeenCalledWith({
      name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31',
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(screen.getByText('Cycle created successfully.')).toBeInTheDocument();
  });

  it('initializes and updates an existing cycle', async () => {
    const user = userEvent.setup();
    vi.mocked(setProgramCycle).mockResolvedValue(cycle);
    render(<CycleModal isOpen cycle={cycle} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Cycle name' })).toHaveValue('Fall 2026');
    expect(screen.getByLabelText('Starts on')).toHaveValue('2026-09-01');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(setProgramCycle).toHaveBeenCalledWith({
      name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31',
    }, 'cycle-1');
  });

  it('keeps the form open and reports save failures', async () => {
    vi.mocked(setProgramCycle).mockRejectedValue(new Error('Cycle dates overlap'));
    const user = userEvent.setup();
    render(<CycleModal isOpen cycle={cycle} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cycle dates overlap');
    expect(screen.getByRole('dialog', { name: 'Edit Cycle' })).toBeInTheDocument();
  });

  it('resets fields and status when a different cycle target opens', async () => {
    vi.mocked(setProgramCycle).mockRejectedValue(new Error('Cycle dates overlap'));
    const user = userEvent.setup();
    const props = { onClose: vi.fn(), onSaved: vi.fn() };
    const view = render(<CycleModal isOpen cycle={cycle} {...props} />);

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cycle dates overlap');

    view.rerender(<CycleModal isOpen={false} cycle={cycle} {...props} />);
    view.rerender(<CycleModal isOpen cycle={null} {...props} />);

    expect(screen.getByRole('textbox', { name: 'Cycle name' })).toHaveValue('');
    expect(screen.getByLabelText('Starts on')).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
