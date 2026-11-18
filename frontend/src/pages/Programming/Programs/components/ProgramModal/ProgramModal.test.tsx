import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateProgram } from '../../api/programs.api';
import type { Program } from '../../types';
import ProgramModal from './ProgramModal';

vi.mock('../../api/programs.api', () => ({
  createProgram: vi.fn(),
  updateProgram: vi.fn(),
}));

const program: Program = {
  id: 'program-1',
  title: 'Soft Skills',
  description: 'Life skills',
  enrollmentRequired: true,
  minAge: 12,
  maxAge: 15,
  defaultDayOfWeek: 'tuesday',
  defaultStartTime: '17:00',
  defaultEndTime: '19:30',
  timezone: 'America/Toronto',
};

describe('ProgramModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves No as enrollmentRequired false', async () => {
    vi.mocked(updateProgram).mockResolvedValue({ program: { ...program, enrollmentRequired: false }, updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] });
    const user = userEvent.setup();
    render(<ProgramModal isOpen program={program} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Enrollment Required' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'No' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateProgram).toHaveBeenCalledWith(
      program.id,
      expect.objectContaining({ enrollmentRequired: false }),
    ));
  });

  it('disables the complete form while saving', async () => {
    vi.mocked(updateProgram).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<ProgramModal isOpen program={program} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const titleInput = screen.getByRole('textbox', { name: 'Program Title' });
    await waitFor(() => expect(titleInput.closest('form')).toHaveAttribute('aria-busy', 'true'));
    expect(titleInput).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Default Session Day' })).toBeDisabled();
    expect(screen.getByLabelText('Default Start Time')).toBeDisabled();
    expect(screen.getByLabelText('Default End Time')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Session Timezone' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Minimum Age' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Enrollment Required' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
