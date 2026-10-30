import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setProgramCycle } from '../../api/cycles.api';
import type { ProgramCycle } from '../../../../../common/features/programming/cycles/types';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import { getCohorts } from '../../../Cohorts/cohorts.api';
import CycleModal from './CycleModal';

vi.mock('../../api/cycles.api', () => ({ setProgramCycle: vi.fn() }));

vi.mock('../../../Cohorts/cohorts.api', () => ({ getCohorts: vi.fn() }));
const programs = [{ id: 'program-1', name: 'Skills' }] as import('../../../../../common/features/programs/types').Program[];

const cycle: ProgramCycle = {
  id: 'cycle-1', name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31', state: 'upcoming',
};

describe('CycleModal', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(getCohorts).mockResolvedValue([{ programId: 'program-1', cycleId: 'cycle-1' }] as Awaited<ReturnType<typeof getCohorts>>); });

  it('submits the create form and displays its success status', async () => {
    const user = userEvent.setup();
    vi.mocked(setProgramCycle).mockResolvedValue({ cycle, updatedCohorts: [], createdCohortIds: [], removedCohortIds: [] });
    const onSaved = vi.fn().mockResolvedValue(undefined);
    render(<CycleModal programs={programs} isOpen cycle={null} onClose={vi.fn()} onSaved={onSaved} />);

    await user.type(screen.getByRole('textbox', { name: 'Cycle name' }), 'Fall 2026');
    await user.type(screen.getByLabelText('Starts on'), '2026-09-01');
    await user.type(screen.getByLabelText('Ends on'), '2027-01-31');
    await user.click(screen.getByRole('button', { name: 'Add Cycle' }));

    expect(setProgramCycle).toHaveBeenCalledWith({
      name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31', programIds: ['program-1'],
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(screen.getByText('Cycle created successfully.')).toBeInTheDocument();
  });

  it('renders existing cycle fields and the edit submit action', async () => {
    const user = userEvent.setup();
    vi.mocked(setProgramCycle).mockResolvedValue({ cycle, updatedCohorts: [], createdCohortIds: [], removedCohortIds: [] });
    render(<CycleModal programs={programs} isOpen cycle={cycle} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Cycle name' })).toHaveValue('Fall 2026');
    expect(screen.getByLabelText('Starts on')).toHaveValue('2026-09-01');
    expect(screen.getByLabelText('Ends on')).toHaveValue('2027-01-31');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Cycle updated successfully.')).toBeInTheDocument();
  });

  it('keeps the form open and reports save failures', async () => {
    vi.mocked(setProgramCycle).mockRejectedValue(new Error('Cycle dates overlap'));
    const user = userEvent.setup();
    render(<CycleModal programs={programs} isOpen cycle={cycle} onClose={vi.fn()} onSaved={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cycle dates overlap');
    expect(screen.getByRole('dialog', { name: 'Edit Cycle' })).toBeInTheDocument();
  });

  it('resets fields and status when a different cycle target opens', async () => {
    vi.mocked(setProgramCycle).mockRejectedValue(new Error('Cycle dates overlap'));
    const user = userEvent.setup();
    const props = { onClose: vi.fn(), onSaved: vi.fn() };
    const view = render(<CycleModal programs={programs} isOpen cycle={cycle} {...props} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cycle dates overlap');

    view.rerender(<CycleModal programs={programs} isOpen={false} cycle={cycle} {...props} />);
    view.rerender(<CycleModal programs={programs} isOpen cycle={null} {...props} />);

    expect(screen.getByRole('textbox', { name: 'Cycle name' })).toHaveValue('');
    expect(screen.getByLabelText('Starts on')).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
