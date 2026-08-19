import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createProgram } from '../../../api/programs.api';
import AddProgramModal from './AddProgramModal';

vi.mock('../../../api/programs.api', () => ({ createProgram: vi.fn() }));

const createProgramMock = vi.mocked(createProgram);

describe('AddProgramModal', () => {
  beforeEach(() => createProgramMock.mockReset());

  it('validates the program name before submission', async () => {
    render(<AddProgramModal isOpen programsError="" onClose={vi.fn()} onCreated={vi.fn()} />);

    await act(async () => {
      fireEvent.submit(document.getElementById('add-program-form')!);
    });

    expect(await screen.findByText('Program name is required')).toBeInTheDocument();
    expect(createProgramMock).not.toHaveBeenCalled();
  });

  it('creates and returns a normalized program', async () => {
    const program = {
      id: 'program-2',
      name: 'Leadership',
      description: null,
      rosterMode: 'enrolled' as const,
      minAge: null,
      maxAge: null,
    };
    const onCreated = vi.fn();
    createProgramMock.mockResolvedValue(program);
    render(<AddProgramModal isOpen programsError="" onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('Program Name *'), {
      target: { value: '  Leadership  ' },
    });
    fireEvent.submit(document.getElementById('add-program-form')!);

    await waitFor(() => expect(createProgramMock).toHaveBeenCalledWith('Leadership'));
    expect(onCreated).toHaveBeenCalledWith(program);
    expect(screen.getByText('Program added!')).toBeInTheDocument();
  });

  it('resets stale input and validation state when reopened', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <AddProgramModal isOpen programsError="" onClose={onClose} onCreated={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText('Program Name *'), { target: { value: 'Leadership' } });
    fireEvent.change(screen.getByLabelText('Program Name *'), { target: { value: '' } });
    fireEvent.submit(document.getElementById('add-program-form')!);
    expect(await screen.findByText('Program name is required')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    rerender(<AddProgramModal isOpen={false} programsError="" onClose={onClose} onCreated={vi.fn()} />);
    rerender(<AddProgramModal isOpen programsError="" onClose={onClose} onCreated={vi.fn()} />);

    expect(screen.getByLabelText('Program Name *')).toHaveValue('');
    expect(screen.queryByText('Program name is required')).not.toBeInTheDocument();
  });
});
