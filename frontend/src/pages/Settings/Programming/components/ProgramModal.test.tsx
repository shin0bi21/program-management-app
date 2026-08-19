// Scope: verifies program create/edit initialization, payloads, callback ordering, errors, and reopen resets.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createProgram, updateProgram } from '../../../../common/features/programs/api/programs.api';
import type { Program } from '../../../../common/features/programs/types';
import ProgramModal from './ProgramModal';

vi.mock('../../../../common/features/programs/api/programs.api', () => ({
  createProgram: vi.fn(),
  updateProgram: vi.fn(),
}));

const program: Program = {
  id: 'program-1', name: 'Soft Skills', description: 'Life skills', rosterMode: 'enrolled', minAge: 12, maxAge: 15,
};

describe('ProgramModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a normalized program and returns the saved record', async () => {
    const user = userEvent.setup();
    const created = { ...program, id: 'program-2', name: 'Job Readiness', description: null, minAge: 16, maxAge: 19 };
    vi.mocked(createProgram).mockResolvedValue(created);
    const onSaved = vi.fn();
    render(<ProgramModal isOpen program={null} onClose={vi.fn()} onSaved={onSaved} />);

    await user.type(screen.getByRole('textbox', { name: 'Program name' }), 'Job Readiness');
    await user.type(screen.getByRole('spinbutton', { name: 'Minimum age' }), '16');
    await user.type(screen.getByRole('spinbutton', { name: 'Maximum age' }), '19');
    await user.click(screen.getByRole('button', { name: 'Add Program' }));

    expect(createProgram).toHaveBeenCalledWith({
      name: 'Job Readiness', description: null, rosterMode: 'enrolled', minAge: 16, maxAge: 19,
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));
    expect(screen.getByText('Program added successfully.')).toBeInTheDocument();
  });

  it('initializes and updates an existing program', async () => {
    const user = userEvent.setup();
    vi.mocked(updateProgram).mockResolvedValue({ ...program, rosterMode: 'open' });
    render(<ProgramModal isOpen program={program} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Program name' })).toHaveValue('Soft Skills');
    expect(screen.getByRole('spinbutton', { name: 'Minimum age' })).toHaveValue(12);
    await user.click(screen.getByRole('button', { name: 'Attendance' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Open attendance' }));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(updateProgram).toHaveBeenCalledWith('program-1', expect.objectContaining({
      name: 'Soft Skills', rosterMode: 'open', minAge: 12, maxAge: 15,
    }));
  });

  it('keeps the form open and reports save failures', async () => {
    vi.mocked(createProgram).mockRejectedValue(new Error('Program name already exists'));
    const user = userEvent.setup();
    render(<ProgramModal isOpen program={null} onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.type(screen.getByRole('textbox', { name: 'Program name' }), 'Soft Skills');
    await user.click(screen.getByRole('button', { name: 'Add Program' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Program name already exists');
    expect(screen.getByRole('dialog', { name: 'Add Program' })).toBeInTheDocument();
  });

  it('resets fields, attendance mode, and status when a different target opens', async () => {
    vi.mocked(createProgram).mockRejectedValue(new Error('Program name already exists'));
    const user = userEvent.setup();
    const props = { onClose: vi.fn(), onSaved: vi.fn() };
    const view = render(<ProgramModal isOpen program={null} {...props} />);

    await user.type(screen.getByRole('textbox', { name: 'Program name' }), 'Soft Skills');
    await user.click(screen.getByRole('button', { name: 'Add Program' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Program name already exists');

    view.rerender(<ProgramModal isOpen={false} program={null} {...props} />);
    view.rerender(<ProgramModal isOpen program={{ ...program, rosterMode: 'open' }} {...props} />);

    expect(screen.getByRole('textbox', { name: 'Program name' })).toHaveValue('Soft Skills');
    expect(screen.getByRole('button', { name: 'Attendance' })).toHaveTextContent('Open attendance');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
