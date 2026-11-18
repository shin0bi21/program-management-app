import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setProgramCycle } from '../../api/cycles.api';
import type { ProgramCycle } from '../../../../../common/features/programming/cycles/types';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import CycleModal from './CycleModal';

vi.mock('../../api/cycles.api', () => ({ setProgramCycle: vi.fn() }));

const programs = [{ id: 'program-1', title: 'Skills' }] as import('../../types').Program[];

const assignmentProps = { assignments: [{ programId: 'program-1', cycleId: 'cycle-1' }] as import('../../types').ProgramCycleAssignment[], assignmentsReady: true, assignmentsError: '', onRetryAssignments: vi.fn() };

const cycle: ProgramCycle = {
  id: 'cycle-1', title: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31', state: 'upcoming',
};

describe('CycleModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits the create form and displays its success status', async () => {
    const user = userEvent.setup();
    vi.mocked(setProgramCycle).mockResolvedValue({ cycle, updatedProgramCycles: [], createdProgramCycles: [], removedProgramCycles: [] });
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<CycleModal {...assignmentProps} programs={programs} isOpen cycle={null} onClose={vi.fn()} onSaved={onSaved} />);

    await user.type(screen.getByRole('textbox', { name: 'Cycle Title' }), 'Fall 2026');
    await user.type(screen.getByLabelText('Starts on'), '2026-09-01');
    await user.type(screen.getByLabelText('Ends on'), '2027-01-31');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(setProgramCycle).toHaveBeenCalledWith({
      title: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31', programIds: [],
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(screen.getByText('Cycle created successfully.')).toBeInTheDocument();
  });

  it('renders existing cycle fields and the edit submit action', async () => {
    const user = userEvent.setup();
    vi.mocked(setProgramCycle).mockResolvedValue({ cycle, updatedProgramCycles: [], createdProgramCycles: [], removedProgramCycles: [] });
    render(<CycleModal {...assignmentProps} programs={programs} isOpen cycle={cycle} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Cycle Title' })).toHaveValue('Fall 2026');
    expect(screen.getByLabelText('Starts on')).toHaveValue('2026-09-01');
    expect(screen.getByLabelText('Ends on')).toHaveValue('2027-01-31');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Cycle updated successfully.')).toBeInTheDocument();
  });

  it('keeps the form open and reports save failures', async () => {
    vi.mocked(setProgramCycle).mockRejectedValue(new Error('Cycle dates overlap'));
    const user = userEvent.setup();
    render(<CycleModal {...assignmentProps} programs={programs} isOpen cycle={cycle} onClose={vi.fn()} onSaved={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cycle dates overlap');
    expect(screen.getByRole('dialog', { name: 'Edit Cycle' })).toBeInTheDocument();
  });

});
