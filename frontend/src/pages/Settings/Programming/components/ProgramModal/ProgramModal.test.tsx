import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateProgram } from '../../../../../common/features/programs/programs.api';
import type { Program } from '../../../../../common/features/programs/types';
import ProgramModal from './ProgramModal';

vi.mock('../../../../../common/features/programs/programs.api', () => ({
  createProgram: vi.fn(),
  updateProgram: vi.fn(),
}));

const program: Program = {
  id: 'program-1',
  name: 'Soft Skills',
  description: 'Life skills',
  rosterMode: 'enrolled',
  minAge: 12,
  maxAge: 15,
};

describe('ProgramModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the editable program fields and attendance selector', () => {
    render(<ProgramModal isOpen program={program} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Program name' })).toHaveValue('Soft Skills');
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('Life skills');
    expect(screen.getByRole('spinbutton', { name: 'Minimum age' })).toHaveValue(12);
    expect(screen.getByRole('spinbutton', { name: 'Maximum age' })).toHaveValue(15);
    expect(screen.getByRole('button', { name: 'Attendance' })).toHaveTextContent(
      'Enrollment required',
    );
  });

  it('disables the complete form while saving', async () => {
    vi.mocked(updateProgram).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<ProgramModal isOpen program={program} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    const nameInput = screen.getByRole('textbox', { name: 'Program name' });
    await waitFor(() => expect(nameInput.closest('form')).toHaveAttribute('aria-busy', 'true'));
    expect(nameInput).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Minimum age' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Attendance' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
