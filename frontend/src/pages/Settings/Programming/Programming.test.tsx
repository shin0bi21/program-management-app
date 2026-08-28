// Owns Settings Programming route composition, selection, modal entry, and deletion wiring.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../common/features/programs/types';
import Programming from './Programming';

const programmingApi = vi.hoisted(() => ({
  getProgramCycles: vi.fn(),
  setProgramCycle: vi.fn(),
  deleteProgramCycle: vi.fn(),
}));
const programsApi = vi.hoisted(() => ({
  createProgram: vi.fn(),
  updateProgram: vi.fn(),
}));
const programState = vi.hoisted<{ programs: Program[]; upsertProgram: ReturnType<typeof vi.fn> }>(() => ({
  programs: [],
  upsertProgram: vi.fn(),
}));

vi.mock('../../../common/features/programming/api/cohorts.api', () => programmingApi);
vi.mock('../../../common/features/programs/programs.api', () => programsApi);
vi.mock('../../../common/features/programs/hooks/usePrograms', () => ({
  usePrograms: () => ({
    programs: programState.programs,
    upsertProgram: programState.upsertProgram,
    loading: false,
    error: null,
  }),
}));

describe('Programming settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    programState.programs = [{
      id: 'program-1', name: 'Soft Skills', description: 'Life skills', rosterMode: 'enrolled', minAge: 12, maxAge: 15,
    }];
    programmingApi.getProgramCycles.mockResolvedValue([{
      id: 'cycle-1', name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31', state: 'upcoming',
    }]);
  });

  it('lists selectable programs and cycles with edit actions', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><Programming /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Programming Settings' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Program and cycle management' })).toBeInTheDocument();
    const programRow = screen.getByText('Soft Skills').closest('tr');
    expect(programRow).toHaveAttribute('tabindex', '0');
    await user.click(programRow!);
    expect(programRow).toHaveAttribute('aria-selected', 'true');

    const cycleRow = (await screen.findByText('Fall 2026')).closest('tr');
    expect(cycleRow).toHaveAttribute('tabindex', '0');
    await user.click(screen.getByRole('button', { name: 'Actions for Fall 2026' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit Cycle' }));
    expect(screen.getByRole('heading', { name: 'Edit Cycle' })).toBeInTheDocument();
  });

  it('creates programs from the settings page', async () => {
    const user = userEvent.setup();
    const created = {
      id: 'program-2', name: 'Job Readiness', description: null, rosterMode: 'enrolled' as const, minAge: 16, maxAge: 19,
    };
    programsApi.createProgram.mockResolvedValue(created);
    render(<MemoryRouter><Programming /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: '+ Add Program' }));
    await user.type(screen.getByRole('textbox', { name: 'Program name' }), 'Job Readiness');
    await user.type(screen.getByRole('spinbutton', { name: 'Minimum age' }), '16');
    await user.type(screen.getByRole('spinbutton', { name: 'Maximum age' }), '19');
    await user.click(screen.getByRole('button', { name: 'Add Program' }));

    expect(programsApi.createProgram).toHaveBeenCalledWith({
      name: 'Job Readiness', description: null, rosterMode: 'enrolled', minAge: 16, maxAge: 19,
    });
    await waitFor(() => expect(programState.upsertProgram).toHaveBeenCalledWith(created));
    expect(await screen.findByText('Program added successfully.')).toBeInTheDocument();
  });

  it('deletes an unused cycle after confirmation', async () => {
    const user = userEvent.setup();
    programmingApi.deleteProgramCycle.mockResolvedValue({ id: 'cycle-1' });
    render(<MemoryRouter><Programming /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Actions for Fall 2026' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete Cycle' }));

    expect(screen.getByRole('heading', { name: 'Delete Cycle' })).toBeInTheDocument();
    expect(screen.getByText(/Cycles assigned to cohorts or logged hours cannot be deleted/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(programmingApi.deleteProgramCycle).toHaveBeenCalledWith('cycle-1'));
    await waitFor(() => expect(screen.queryByText('Fall 2026')).not.toBeInTheDocument());
    expect(screen.getByText('Cycle deleted')).toBeInTheDocument();
  });

  it('keeps an assigned cycle visible when deletion is rejected', async () => {
    const user = userEvent.setup();
    programmingApi.deleteProgramCycle.mockRejectedValue(new Error('Cycle cannot be deleted because it is still in use'));
    render(<MemoryRouter><Programming /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Actions for Fall 2026' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete Cycle' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cycle cannot be deleted because it is still in use');
    expect(screen.getByText('Fall 2026')).toBeInTheDocument();
  });

  it('retries cycle loading without forwarding the click event as an abort signal', async () => {
    const user = userEvent.setup();
    programmingApi.getProgramCycles
      .mockRejectedValueOnce(new Error('Cycle service unavailable'))
      .mockResolvedValueOnce([]);
    render(<MemoryRouter><Programming /></MemoryRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent('Cycle service unavailable');
    await user.click(screen.getAllByRole('button', { name: 'Retry' })[0]);

    await waitFor(() => expect(programmingApi.getProgramCycles).toHaveBeenCalledTimes(2));
    expect(programmingApi.getProgramCycles).toHaveBeenLastCalledWith(undefined);
  });
});
