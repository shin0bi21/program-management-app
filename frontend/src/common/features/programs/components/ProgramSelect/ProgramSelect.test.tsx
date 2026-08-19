import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProgramSelect from './ProgramSelect';

const programState = vi.hoisted(() => ({
  permissions: ['write:programs'],
  upsertProgram: vi.fn(),
}));

vi.mock('../../../../../auth/authContext', () => ({
  useAuth: () => ({ permissions: programState.permissions }),
}));

vi.mock('../../hooks/usePrograms', () => ({
  usePrograms: () => ({
    programs: [{
      id: 'program-1',
      name: 'Soft Skills',
      description: null,
      rosterMode: 'enrolled',
      minAge: null,
      maxAge: null,
    }],
    upsertProgram: programState.upsertProgram,
    loading: false,
    error: '',
  }),
}));

vi.mock('./AddProgramModal/AddProgramModal', () => ({
  default: ({
    isOpen,
    onClose,
    onCreated,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (program: {
      id: string;
      name: string;
      description: null;
      rosterMode: 'enrolled';
      minAge: null;
      maxAge: null;
    }) => void;
  }) => isOpen ? <div>
    <h2>Add Program</h2>
    <button type="button" onClick={onClose}>Cancel</button>
    <button type="button" onClick={() => onCreated({
      id: 'program-2',
      name: 'Leadership',
      description: null,
      rosterMode: 'enrolled',
      minAge: null,
      maxAge: null,
    })}>Finish adding</button>
  </div> : null,
}));

describe('ProgramSelect', () => {
  beforeEach(() => {
    programState.permissions = ['write:programs'];
    programState.upsertProgram.mockReset();
  });

  it('selects an available program', () => {
    const onChange = vi.fn();
    render(<ProgramSelect id="program" value="" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select a program' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Soft Skills' }));

    expect(onChange).toHaveBeenCalledWith('program-1');
  });

  it('opens the add flow only with write permission and reconciles the created program', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ProgramSelect id="program" value="" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select a program' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '+ Add program' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish adding' }));
    expect(programState.upsertProgram).toHaveBeenCalledWith(expect.objectContaining({ id: 'program-2' }));
    expect(onChange).toHaveBeenCalledWith('program-2');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    programState.permissions = [];
    rerender(<ProgramSelect id="program" value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Select a program' }));
    expect(screen.queryByRole('menuitem', { name: '+ Add program' })).not.toBeInTheDocument();
  });
});
