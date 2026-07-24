import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Youth from './Youth';
import { makeYouthProfile } from '../../tests/factories/youth';

const mockUseYouth = vi.fn();
const cohortsApi = vi.hoisted(() => ({ getCohorts: vi.fn() }));
const cohortFixture = {
  id: 'cohort-1',
  programId: 'program-1',
  programName: 'Soft Skills',
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
};

vi.mock('./hooks/useYouth', () => ({
  useYouth: (...args: unknown[]) => mockUseYouth(...args),
}));
vi.mock('../../common/api/cohorts.api', () => cohortsApi);

vi.mock('../../common/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Soft Skills' }], loading: false, error: '' }),
}));

vi.mock('../../common/context/AuthContext', () => ({
  useAuth: () => ({ permissions: ['read:youth_profiles', 'write:youth_profiles', 'write:cohorts'] }),
}));

vi.mock('../../common/components/Header/Header', () => ({ default: () => null }));
vi.mock('./components/YouthModal/YouthModal', () => ({ default: () => null }));
vi.mock('./components/ManageCohortsModal/ManageCohortsModal', () => ({ default: () => null }));
vi.mock('../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: { id: string; label: string }[] }) => (
    <div>{items.map(item => <span key={item.id}>{item.label}</span>)}</div>
  ),
}));

describe('Youth', () => {
  beforeEach(() => {
    cohortsApi.getCohorts.mockReturnValue(new Promise(() => {}));
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

    expect(screen.getByRole('button', { name: '+ Add Youth' })).toBeInTheDocument();
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
  });
});
