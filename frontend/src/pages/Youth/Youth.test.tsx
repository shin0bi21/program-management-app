import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Youth from './Youth';
import { makeYouthProfile } from '../../tests/factories/youth';

const mockUseYouth = vi.fn();
const cohortsApi = vi.hoisted(() => ({ getCohorts: vi.fn() }));
const youthApi = vi.hoisted(() => ({ getYouthSessionNotes: vi.fn() }));
const cohortFixture = {
  id: 'cohort-1',
  programId: 'program-1',
  programName: 'Soft Skills',
  rosterMode: 'enrolled',
  name: 'Summer 2026',
  startsOn: '2026-06-30',
  endsOn: '2026-08-31',
  state: 'active',
  enrolledCount: 1,
  nextSessionAt: null,
  nextSessionId: null,
  averageAttendance: null,
  attendanceAttendedCount: 0,
  attendanceRecordedCount: 0,
  uniqueAttendeeCount: 0,
};

vi.mock('./hooks/useYouth', () => ({
  useYouth: (...args: unknown[]) => mockUseYouth(...args),
}));
vi.mock('../../common/api/cohorts.api', () => cohortsApi);
vi.mock('../../common/api/youth.api', () => youthApi);

vi.mock('../../common/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Soft Skills' }], loading: false, error: '' }),
}));

vi.mock('../../common/context/AuthContext', () => ({
  useAuth: () => ({ permissions: ['read:youth_profiles', 'write:youth_profiles', 'write:cohorts'] }),
}));

vi.mock('../../common/components/Header/Header', () => ({ default: () => null }));
vi.mock('./components/YouthModal/YouthModal', () => ({
  default: ({ isOpen, mode }: { isOpen: boolean; mode?: string }) => isOpen
    ? <div data-testid="youth-modal">{mode ?? 'full'}</div>
    : null,
}));
vi.mock('./components/ManageCohortsModal/ManageCohortsModal', () => ({ default: () => null }));
vi.mock('../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: { id: string; label: string }[] }) => (
    <div>{items.map(item => <span key={item.id}>{item.label}</span>)}</div>
  ),
}));

describe('Youth', () => {
  beforeEach(() => {
    localStorage.clear();
    cohortsApi.getCohorts.mockReturnValue(new Promise(() => {}));
    youthApi.getYouthSessionNotes.mockResolvedValue([]);
    mockUseYouth.mockReturnValue({
      youth: [makeYouthProfile({ account: null })],
      setYouth: vi.fn(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('keeps account invitation controls out of the Youth page', () => {
    render(<Youth />);

    expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Manage Cohorts')).toBeInTheDocument();
    expect(screen.queryByText('Deactivate')).not.toBeInTheDocument();
    expect(screen.queryByText('Activate')).not.toBeInTheDocument();
    expect(screen.queryByText('Invite')).not.toBeInTheDocument();
  });

  it('requests youth filtered by program', async () => {
    render(<Youth />);

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Program/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Soft Skills' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(mockUseYouth).toHaveBeenLastCalledWith({
      search: '',
      programIds: ['program-1'],
      cohortIds: [],
    }));
  });

  it('requests youth filtered by cohort', async () => {
    cohortsApi.getCohorts.mockResolvedValue([cohortFixture]);
    render(<Youth />);
    await waitFor(() => expect(cohortsApi.getCohorts).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Cohort/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', {
      name: 'Soft Skills · Summer 2026',
    }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(mockUseYouth).toHaveBeenLastCalledWith({
      search: '',
      programIds: [],
      cohortIds: ['cohort-1'],
    }));
  });

  it('shows the selected profile contact and notes', () => {
    mockUseYouth.mockReturnValue({
      youth: [makeYouthProfile({
        notes: 'Youth profile note',
        lastAttendedOn: '2026-07-21',
        cohorts: [{
          id: 'cohort-1',
          name: 'Summer 2026',
          programId: 'program-1',
          programName: 'Soft Skills',
          rosterMode: 'enrolled',
          startsOn: '2026-06-30',
          endsOn: '2026-08-31',
          enrolledOn: '2026-06-30',
          withdrawnOn: null,
          presentCount: 8,
          lateCount: 2,
          absentCount: 4,
          lastAttendedOn: '2026-07-21',
        }],
        contacts: [{ id: 'contact-1', firstName: 'Parent', lastName: 'One', phoneNumber: '416-555-0101', type: 'parent' }],
      })],
      setYouth: vi.fn(), loading: false, error: null, refetch: vi.fn(),
    });
    render(<Youth />);

    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    expect(screen.getByText('Parent One')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByText('Summer 2026')).toBeInTheDocument();
    expect(screen.getByText(/Present 8.*Late 2.*Absent 4/)).toBeInTheDocument();
    expect(screen.getByText('Last attended: Jul 21, 2026')).toBeInTheDocument();
    expect(screen.getByText('Youth profile note')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('persists the Session notes tab while switching profiles and page visits', async () => {
    const sessionNote = {
      id: 'note-1',
      sessionId: 'session-1',
      category: 'achievement',
      title: 'Strong participation',
      details: 'Jamie led the opening activity.',
      createdAt: '2026-07-21T23:00:00.000Z',
      updatedAt: '2026-07-21T23:00:00.000Z',
      createdByName: 'Bilal Khan',
      youth: [{ youthId: 'youth-1', firstName: 'Jamie', lastName: 'Test' }],
      sessionTheme: 'Communication',
      startsAt: '2026-07-21T21:00:00.000Z',
      cohortId: 'cohort-1',
      cohortName: 'Summer 2026',
      programId: 'program-1',
      programName: 'Soft Skills',
    };
    mockUseYouth.mockReturnValue({
      youth: [
        makeYouthProfile(),
        makeYouthProfile({ id: 'youth-2', firstName: 'Alex', lastName: 'Second' }),
      ],
      setYouth: vi.fn(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    youthApi.getYouthSessionNotes.mockImplementation((youthId: string) => (
      Promise.resolve(youthId === 'youth-1' ? [sessionNote] : [])
    ));

    const view = render(<Youth />);
    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    fireEvent.click(screen.getByRole('button', { name: 'Session' }));

    await waitFor(() => expect(youthApi.getYouthSessionNotes).toHaveBeenCalledWith('youth-1'));
    expect(localStorage.getItem('youthNotesTab')).toBe('session');
    fireEvent.click(await screen.findByRole('button', { name: /Strong participation/ }));
    expect(screen.getByRole('heading', { name: 'Strong participation' })).toBeInTheDocument();
    expect(screen.getByText('Jamie led the opening activity.')).toBeInTheDocument();
    expect(screen.getByText(
      'Soft Skills · Summer 2026 · Communication · Jul 21, 2026',
    )).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByText('Alex').closest('tr')!);
    await waitFor(() => expect(youthApi.getYouthSessionNotes).toHaveBeenCalledWith('youth-2'));
    expect(screen.getByRole('button', { name: 'Session' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('No linked session notes.')).toBeInTheDocument();

    view.unmount();
    render(<Youth />);
    expect(screen.getByRole('button', { name: 'Session' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens only the contact section from the primary contact card', () => {
    render(<Youth />);

    expect(screen.getByRole('button', { name: 'Add primary contact' })).toBeDisabled();
    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    const addContact = screen.getByRole('button', { name: 'Add primary contact' });
    expect(addContact).toBeEnabled();
    fireEvent.click(addContact);

    expect(screen.getByTestId('youth-modal')).toHaveTextContent('contact');
  });
});
