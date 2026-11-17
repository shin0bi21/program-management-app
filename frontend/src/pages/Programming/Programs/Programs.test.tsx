import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../common/features/programs/types';
import { renderWithQueryClient as render } from '../../../tests/queryClientTestUtils';
import { getProgramCycleAssignments } from './api/programCycleAssignments.api';
import Programs from './Programs';

vi.mock('./components/ProgramCyclesModal/ProgramCyclesModal', () => ({
  default: ({ program, onClose }: { program: Program; onClose: () => void }) => <div role="dialog" aria-label={`Assignments for ${program.title}`}><button onClick={onClose}>Close assignments</button></div>,
}));

vi.mock('./api/programCycleAssignments.api', () => ({ getProgramCycleAssignments: vi.fn() }));

const programmingApi = vi.hoisted(() => ({
  getCycleReferences: vi.fn(),
  getProgramReferences: vi.fn(),
  getCycleList: vi.fn(),
  setProgramCycle: vi.fn(),
  deleteProgramCycle: vi.fn(),
}));
const programsApi = vi.hoisted(() => ({
  getProgramList: vi.fn(),
  createProgram: vi.fn(),
  updateProgram: vi.fn(),
}));
const attendanceApi = vi.hoisted(() => ({ getAttendance: vi.fn() }));
vi.mock('../../../common/features/Attendance/attendance.api', () => attendanceApi);
const programState = vi.hoisted<{ programs: Program[] }>(() => ({
  programs: [],
}));

vi.mock('./api/cycles.api', () => programmingApi);
vi.mock('../../../common/features/referenceData/referenceData.api', () => ({ getCycleReferences: programmingApi.getCycleReferences, getProgramReferences: programmingApi.getProgramReferences }));
vi.mock('./api/programs.api', () => programsApi);

const auth = vi.hoisted(() => ({ role: 'project_manager', permissions: [] as string[] }));
vi.mock('../../../auth/authContext', () => ({ useAuth: () => auth }));

vi.mock('./components/ManageRosterModal/ManageRosterModal', () => ({
  default: ({ assignment }: { assignment: { cycle: string } | null }) => assignment ? <div role="dialog" aria-label={`Roster for ${assignment.cycle}`} /> : null,
}));
describe('Programs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    attendanceApi.getAttendance.mockResolvedValue({ groups: [] });
    auth.role = 'project_manager';
    auth.permissions = ['read:programs', 'write:programs', 'write:enrollments', 'read:youth_profiles', 'read:attendance', 'read:sessions'];
    vi.mocked(getProgramCycleAssignments).mockResolvedValue([{
      programId: 'program-1', program: 'Soft Skills', cycleId: 'cycle-1', cycle: 'Fall 2026',
      startsOn: '2020-01-01', endsOn: '2100-12-31', enrollmentRequired: true, minAge: 12, maxAge: 15, state: 'active',
      enrolledCount: 5, uniqueAttendeeCount: 0,
    }]);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    programState.programs = [{
      id: 'program-1', title: 'Soft Skills', description: 'Life skills', enrollmentRequired: true, minAge: 12, maxAge: 15, defaultDayOfWeek: 'tuesday' as const, defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
    }];
    programmingApi.getProgramReferences.mockImplementation(async () => programState.programs.map(({ id, title }) => ({ id, title })));
    programsApi.getProgramList.mockImplementation(async () => ({ rows: programState.programs, nextCursor: null }));
    programmingApi.getCycleList.mockResolvedValue({ rows: [{
      id: 'cycle-1', title: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31', state: 'upcoming',
    }], nextCursor: null });
    programmingApi.getCycleReferences.mockResolvedValue([{
      id: 'cycle-1', title: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31', state: 'upcoming',
    }]);
  });

  // Rendered states.
  it('lets project managers manage programs and cycles from Programs', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Programs /></MemoryRouter>);

    expect(await screen.findByText('Soft Skills')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Manage Cycles' }));
    expect(await screen.findByText('Fall 2026')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Actions for Fall 2026' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit Cycle' }));
    expect(screen.getByRole('heading', { name: 'Edit Cycle' })).toBeInTheDocument();
  });

  it('retries cycle loading without forwarding the click event as an abort signal', async () => {
    const user = userEvent.setup();
    programmingApi.getCycleReferences
      .mockRejectedValueOnce(new Error('Cycle service unavailable'))
      .mockResolvedValueOnce([]);
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Programs /></MemoryRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent('Cycle service unavailable');
    await user.click(screen.getAllByRole('button', { name: 'Retry' })[0]);

    await waitFor(() => expect(programmingApi.getCycleReferences).toHaveBeenCalledTimes(2));
    expect(programmingApi.getCycleReferences).toHaveBeenLastCalledWith({ signal: expect.any(AbortSignal) });
  });

  it('passes the selected program to its overview query', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Programs /></MemoryRouter>);

    await user.click(await screen.findByText('Soft Skills'));
    expect(await screen.findByRole('heading', { name: 'Soft Skills - Fall 2026 Overview' })).toBeInTheDocument();
    expect(getProgramCycleAssignments).toHaveBeenCalledWith('program-1', { includeAllPrograms: false }, { signal: expect.any(AbortSignal) });

  });

  it('lets assigned staff manage rosters without program or cycle edit actions', async () => {
    auth.role = 'staff';
    auth.permissions = ['read:programs', 'write:enrollments', 'read:youth_profiles'];
    const user = userEvent.setup();
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Programs /></MemoryRouter>);

    await user.click(await screen.findByText('Soft Skills'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Manage Roster' }));
    expect(screen.getByRole('dialog', { name: 'Roster for Fall 2026' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add Program' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage Cycles' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actions for Soft Skills' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Attendance Report' })).not.toBeInTheDocument();
  });

  it.each([
    ['read:programs'],
    ['read:programs', 'write:enrollments'],
    ['read:programs', 'read:youth_profiles'],
  ])('requires enrollment write and youth read access for roster entry: %j', async (...permissions) => {
    auth.permissions = permissions;
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Programs /></MemoryRouter>);

    await userEvent.click(await screen.findByText('Soft Skills'));
    expect(await screen.findByRole('heading', { name: 'Soft Skills - Fall 2026 Overview' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage Roster' })).not.toBeInTheDocument();
  });

  // Commands and dialogs.
  it('opens assignment management for the selected existing program', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Programs /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Actions for Soft Skills' }));
    await user.click(screen.getByRole('menuitem', { name: 'Assigned Cycles' }));
    expect(screen.getByRole('dialog', { name: 'Assignments for Soft Skills' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close assignments' }));
    expect(screen.queryByRole('dialog', { name: 'Assignments for Soft Skills' })).not.toBeInTheDocument();
  });

  it('updates the selected program overview after editing', async () => {
    const user = userEvent.setup();
    const saved = { ...programState.programs[0], title: 'Updated Skills' };
    programsApi.updateProgram.mockResolvedValue({ program: saved, updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] });
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Programs /></MemoryRouter>);
    await user.click(await screen.findByText('Soft Skills'));
    await user.click(screen.getByRole('button', { name: 'Actions for Soft Skills' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit Program' }));

    await user.clear(screen.getByRole('textbox', { name: 'Program Title' }));
    await user.type(screen.getByRole('textbox', { name: 'Program Title' }), saved.title);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 3000 });
    expect(await screen.findByRole('heading', { name: 'Updated Skills - Fall 2026 Overview' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Updated Skills' })).toBeInTheDocument();
    expect(programsApi.getProgramList).toHaveBeenCalledOnce();
  });

  it('creates programs from the Programs header', async () => {
    const user = userEvent.setup();
    const created = {
      id: 'program-2', title: 'Job Readiness', description: null, enrollmentRequired: true, minAge: 16, maxAge: 19, defaultDayOfWeek: 'tuesday' as const, defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
    };
    programsApi.createProgram.mockResolvedValue({ program: created, updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] });
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Programs /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: '+ Add Program' }));
    await user.type(screen.getByRole('textbox', { name: 'Program Title' }), 'Job Readiness');
    await user.click(screen.getByRole('button', { name: 'Default Session Day' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Tuesday' }));
    await user.type(screen.getByLabelText('Default Start Time'), '17:00');
    await user.type(screen.getByLabelText('Default End Time'), '19:30');
    await user.type(screen.getByRole('spinbutton', { name: 'Minimum Age' }), '16');
    await user.type(screen.getByRole('spinbutton', { name: 'Maximum Age' }), '19');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(programsApi.createProgram).toHaveBeenCalledOnce());
    expect(await screen.findByText('Program added successfully.')).toBeInTheDocument();
  });

  it('keeps the cycle query alive while editing and returns to the saved row without refetching', async () => {
    const user = userEvent.setup();
    programmingApi.setProgramCycle.mockResolvedValue({
      cycle: { id: 'cycle-1', title: 'Updated cycle', startsOn: '2026-09-01', endsOn: '2027-01-31', state: 'upcoming' },
      updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [],
    });
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Programs /></MemoryRouter>);
    expect(programmingApi.getCycleList).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Manage Cycles' }));
    await user.click(await screen.findByRole('button', { name: 'Actions for Fall 2026' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit Cycle' }));

    await user.clear(screen.getByRole('textbox', { name: 'Cycle Title' }));
    await user.type(screen.getByRole('textbox', { name: 'Cycle Title' }), 'Updated cycle');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('cell', { name: 'Updated cycle' }, { timeout: 3000 })).toBeInTheDocument();
    expect(programmingApi.getCycleList).toHaveBeenCalledOnce();
  });

  it('deletes an unused cycle after confirmation', async () => {
    const user = userEvent.setup();
    programmingApi.deleteProgramCycle.mockResolvedValue({ id: 'cycle-1' });
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Programs /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Manage Cycles' }));
    await user.click(await screen.findByRole('button', { name: 'Actions for Fall 2026' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete Cycle' }));

    expect(screen.getByRole('heading', { name: 'Delete Cycle' })).toBeInTheDocument();
    expect(screen.getByText(/Cycles assigned to programs or logged hours cannot be deleted/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(programmingApi.deleteProgramCycle).toHaveBeenCalledWith('cycle-1'));
    await waitFor(() => expect(screen.queryByText('Fall 2026')).not.toBeInTheDocument());
    expect(screen.getByText('Cycle deleted')).toBeInTheDocument();
  });

  it('keeps an assigned cycle visible when deletion is rejected', async () => {
    const user = userEvent.setup();
    programmingApi.deleteProgramCycle.mockRejectedValue(new Error('Cycle cannot be deleted because it is still in use'));
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Programs /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Manage Cycles' }));
    await user.click(await screen.findByRole('button', { name: 'Actions for Fall 2026' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete Cycle' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cycle cannot be deleted because it is still in use');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('Fall 2026')).toBeInTheDocument();
  });
});
