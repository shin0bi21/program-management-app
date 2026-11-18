import type { ComponentProps } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQueryClient } from '../../../tests/queryClientTestUtils';
import { getCycleReferences, getProgramReferences } from '../../../common/features/referenceData/referenceData.api';
import { getProgramCycleAssignments } from './api/programCycleAssignments.api';
import { deleteProgramCycle } from './api/cycles.api';
import type { Program } from './types';
import Programs from './Programs';
import type ProgramTable from './components/ProgramTable/ProgramTable';
import type CycleTable from './components/CycleTable/CycleTable';
import type ProgramOverviewDashboardCard from './components/ProgramOverviewDashboardCard/ProgramOverviewDashboardCard';
import type ProgramModal from './components/ProgramModal/ProgramModal';
import type CycleModal from './components/CycleModal/CycleModal';
import type ProgramCyclesModal from './components/ProgramCyclesModal/ProgramCyclesModal';

const children = vi.hoisted(() => ({
  table: null as ComponentProps<typeof ProgramTable> | null,
  cycles: null as ComponentProps<typeof CycleTable> | null,
  overview: null as ComponentProps<typeof ProgramOverviewDashboardCard> | null,
  programModal: null as ComponentProps<typeof ProgramModal> | null,
  cycleModal: null as ComponentProps<typeof CycleModal> | null,
  assignmentsModal: null as ComponentProps<typeof ProgramCyclesModal> | null,
}));

// Capture page contracts without loading child queries or rendering their forms.
vi.mock('./components/ProgramTable/ProgramTable', () => ({
  default: (props: ComponentProps<typeof ProgramTable>) => {
    children.table = props;
    return <div data-testid="program-table" />;
  },
}));
vi.mock('./components/CycleTable/CycleTable', () => ({
  default: (props: ComponentProps<typeof CycleTable>) => {
    children.cycles = props;
    return props.enabled && props.isOpen ? <div role="dialog" aria-label="Manage Cycles" /> : null;
  },
}));
vi.mock('./components/ProgramOverviewDashboardCard/ProgramOverviewDashboardCard', () => ({
  default: (props: ComponentProps<typeof ProgramOverviewDashboardCard>) => {
    children.overview = props;
    return null;
  },
}));
vi.mock('./components/ProgramModal/ProgramModal', () => ({
  default: (props: ComponentProps<typeof ProgramModal>) => {
    children.programModal = props;
    return props.isOpen ? <div role="dialog" aria-label="Program editor" /> : null;
  },
}));
vi.mock('./components/CycleModal/CycleModal', () => ({
  default: (props: ComponentProps<typeof CycleModal>) => {
    children.cycleModal = props;
    return props.isOpen ? <div role="dialog" aria-label="Cycle editor" /> : null;
  },
}));
vi.mock('./components/ProgramCyclesModal/ProgramCyclesModal', () => ({
  default: (props: ComponentProps<typeof ProgramCyclesModal>) => {
    children.assignmentsModal = props;
    return <div role="dialog" aria-label="Program assignments" />;
  },
}));
vi.mock('./api/programCycleAssignments.api', () => ({ getProgramCycleAssignments: vi.fn() }));
vi.mock('./api/cycles.api', () => ({ deleteProgramCycle: vi.fn() }));
vi.mock('../../../common/features/referenceData/referenceData.api', () => ({
  getCycleReferences: vi.fn(), getProgramReferences: vi.fn(),
}));
const auth = vi.hoisted(() => ({ role: 'project_manager', permissions: [] as string[] }));
vi.mock('../../../auth/authContext', () => ({ useAuth: () => auth }));

const program: Program = {
  id: 'program-1', title: 'Soft Skills', description: 'Life skills', enrollmentRequired: true,
  minAge: 12, maxAge: 15, defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00',
  defaultEndTime: '19:30', timezone: 'America/Toronto',
};
const cycle = {
  id: 'cycle-1', title: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31', state: 'upcoming' as const,
};
const assignmentChanges = { updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] };

describe('Programs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.assign(children, {
      table: null, cycles: null, overview: null, programModal: null, cycleModal: null, assignmentsModal: null,
    });
    auth.role = 'project_manager';
    auth.permissions = ['read:programs', 'write:programs', 'write:enrollments', 'read:youth_profiles', 'read:attendance', 'read:sessions'];
    vi.mocked(getProgramReferences).mockResolvedValue([{ id: program.id, title: program.title }]);
    vi.mocked(getCycleReferences).mockResolvedValue([cycle]);
    vi.mocked(getProgramCycleAssignments).mockResolvedValue([]);
  });

  // Entry and readiness.
  it('lets project managers manage programs and cycles from Programs', async () => {
    renderPage();
    await screen.findByTestId('program-table');

    openCycleManagement();
    act(() => children.cycles!.onEdit(cycle));

    expect(screen.getByRole('dialog', { name: 'Cycle editor' })).toBeInTheDocument();
    expect(children.cycleModal?.cycle).toBe(cycle);
    expect(children.table?.canWrite).toBe(true);
  });

  it('retries cycle loading without forwarding the click event as an abort signal', async () => {
    vi.mocked(getCycleReferences).mockRejectedValueOnce(new Error('Cycle service unavailable')).mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Cycle service unavailable');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(getCycleReferences).toHaveBeenCalledTimes(2));
    expect(getCycleReferences).toHaveBeenLastCalledWith({ signal: expect.any(AbortSignal) });
  });

  it('allows roster management for assigned staff without program or cycle editing', async () => {
    auth.role = 'staff';
    auth.permissions = ['read:programs', 'write:enrollments', 'read:youth_profiles'];
    renderPage();
    await screen.findByTestId('program-table');

    expect(children.overview?.canManageRoster).toBe(true);
    expect(children.overview?.canViewYouthReport).toBe(false);
    expect(children.table?.canWrite).toBe(false);
    expect(screen.queryByRole('button', { name: '+ Add Program' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage Cycles' })).not.toBeInTheDocument();
  });

  it.each([
    ['read:programs'],
    ['read:programs', 'write:enrollments'],
    ['read:programs', 'read:youth_profiles'],
  ])('requires enrollment write and youth read access for roster entry: %j', async (...permissions) => {
    auth.permissions = permissions;
    renderPage();
    await screen.findByTestId('program-table');

    expect(children.overview?.canManageRoster).toBe(false);
  });

  // Selection and coordination.
  it('passes the selected program to its overview', async () => {
    renderPage();
    await screen.findByTestId('program-table');

    act(() => children.table!.onProgramSelect!(program));

    expect(children.overview?.program).toBe(program);
  });

  // Commands and dialogs.
  it('opens assignment management for the selected existing program', async () => {
    renderPage();
    await screen.findByTestId('program-table');

    act(() => children.table!.onManageCycles(program));
    expect(screen.getByRole('dialog', { name: 'Program assignments' })).toBeInTheDocument();
    expect(children.assignmentsModal?.program).toBe(program);
    act(() => children.assignmentsModal!.onClose());

    expect(screen.queryByRole('dialog', { name: 'Program assignments' })).not.toBeInTheDocument();
  });

  it('updates the selected program overview after editing', async () => {
    renderPage();
    await screen.findByTestId('program-table');
    act(() => children.table!.onProgramSelect!(program));
    act(() => children.table!.onEdit(program));
    const saved = { ...program, title: 'Updated Skills' };

    act(() => children.programModal!.onSaved({ program: saved, ...assignmentChanges }, 'update'));
    act(() => children.programModal!.onClose());

    expect(children.overview?.program).toBe(saved);
    expect(children.table?.selectedProgramId).toBe(saved.id);
    expect(screen.queryByRole('dialog', { name: 'Program editor' })).not.toBeInTheDocument();
  });

  it('refreshes the program list after creation and returns to the page', async () => {
    const { queryClient } = renderPage();
    await screen.findByTestId('program-table');
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    fireEvent.click(screen.getByRole('button', { name: '+ Add Program' }));
    expect(children.programModal?.program).toBeNull();

    act(() => children.programModal!.onSaved({ program: { ...program, id: 'program-2' }, ...assignmentChanges }, 'create'));
    act(() => children.programModal!.onClose());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['programs', 'table'] });
    expect(screen.queryByRole('dialog', { name: 'Program editor' })).not.toBeInTheDocument();
  });

  it('keeps cycle management enabled while its editor suspends the dialog', async () => {
    renderPage();
    await screen.findByTestId('program-table');
    expect(children.cycles?.enabled).toBe(false);
    openCycleManagement();
    act(() => children.cycles!.onEdit(cycle));
    expect(children.cycles?.enabled).toBe(true);
    expect(children.cycles?.isOpen).toBe(false);
    const saved = { ...cycle, title: 'Updated cycle' };

    await act(async () => children.cycleModal!.onSaved({ cycle: saved, ...assignmentChanges }, 'update'));
    act(() => children.cycleModal!.onClose());

    expect(children.cycles?.enabled).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Manage Cycles' })).toBeInTheDocument();
    expect(children.cycleModal?.cycle).toBeNull();
  });

  it('deletes an unused cycle after confirmation', async () => {
    vi.mocked(deleteProgramCycle).mockResolvedValue({ id: cycle.id });
    renderPage();
    await screen.findByTestId('program-table');
    openCycleManagement();

    act(() => children.cycles!.onDelete(cycle));
    expect(screen.getByRole('dialog', { name: 'Delete Cycle' })).toHaveTextContent(/Cycles assigned to programs or logged hours cannot be deleted/);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(deleteProgramCycle).toHaveBeenCalledWith(cycle.id));
    expect(await screen.findByText('Cycle deleted')).toBeInTheDocument();
  });

  it('resumes cycle management when deletion is rejected', async () => {
    vi.mocked(deleteProgramCycle).mockRejectedValue(new Error('Cycle cannot be deleted because it is still in use'));
    renderPage();
    await screen.findByTestId('program-table');
    openCycleManagement();
    act(() => children.cycles!.onDelete(cycle));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cycle cannot be deleted because it is still in use');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByRole('dialog', { name: 'Manage Cycles' })).toBeInTheDocument();
    expect(children.cycles?.enabled).toBe(true);
  });
});

/** Opens Programs with its real page data, actions, and an isolated query cache.
 * @example renderPage() // renders the program management route
 */
function renderPage() {
  return renderWithQueryClient(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Programs /></MemoryRouter>);
}

/** Opens the page-owned cycle management interaction through its header action.
 * Requires the program table to be ready.
 * @example openCycleManagement() // enables and displays the cycle table
 */
function openCycleManagement() {
  fireEvent.click(screen.getByRole('button', { name: 'Manage Cycles' }));
}
