import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Youth from './Youth';
import { makeYouthProfile } from '../../tests/factories/youth';
import render from '../../tests/renderWithQueryClient';

const mockUseYouth = vi.fn();
const youthApi = vi.hoisted(() => ({
  getYouthProfileNotes: vi.fn(),
  setYouthProfileNote: vi.fn(),
  deleteYouthProfileNote: vi.fn(),
}));
const preferenceHook = vi.hoisted(() => ({
  preference: null as { statuses: Array<'active' | 'inactive'>; programIds: string[] } | null,
  loading: false,
  error: null as string | null,
  save: vi.fn(),
}));

vi.mock('./hooks/useYouth', () => ({
  useYouth: (filters: unknown) => mockUseYouth(filters),
}));
vi.mock('../../common/features/youth/api/youth.api', () => youthApi);
vi.mock('../../common/features/preferences/hooks/useUserPreference', () => ({ default: () => preferenceHook }));

vi.mock('../../common/features/programs/hooks/usePrograms', () => ({
  usePrograms: (...args: unknown[]) => {
    expect(args).toEqual([{ assignedOnly: true }]);
    return { programs: [{ id: 'program-1', name: 'Soft Skills' }], loading: false, error: '' };
  },
}));

vi.mock('../../auth/authContext', () => ({
  useAuth: () => ({ role: 'staff', permissions: ['read:youth_profiles', 'write:youth_profiles', 'read:cohorts', 'write:cohorts', 'read:attendance', 'write:attendance', 'read:sessions', 'write:sessions'] }),
}));

vi.mock('../../common/features/youth/components/YouthModal/YouthModal', () => ({
  default: ({ isOpen, mode }: { isOpen: boolean; mode?: string }) => isOpen
    ? <div data-testid="youth-modal">{mode ?? 'full'}</div>
    : null,
}));
vi.mock('./components/YouthAttendanceModal/YouthAttendanceModal', () => ({
  default: ({ cohort }: { cohort: { name: string } | null }) => cohort
    ? <div data-testid="youth-attendance-modal">{cohort.name}</div>
    : null,
}));
vi.mock('../../common/features/programming/components/YouthReportModal/YouthReportModal', () => ({
  default: ({ cohort, youthId }: { cohort: { name: string }; youthId?: string }) => (
    <div data-testid="youth-report-modal">{cohort.name} · {youthId}</div>
  ),
}));
vi.mock('../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ ariaLabel, items }: {
    ariaLabel: string;
    items: Array<{ id: string; label: string; onClick: () => void }>;
  }) => <>
    <button aria-label={ariaLabel}>{items[0].label}</button>
    {items.slice(1).map(item => <button key={item.id} onClick={item.onClick}>{item.label}</button>)}
  </>,
}));
describe('Youth', () => {
  beforeEach(() => {
    localStorage.clear();
    youthApi.getYouthProfileNotes.mockResolvedValue([]);
    youthApi.setYouthProfileNote.mockReset();
    youthApi.deleteYouthProfileNote.mockReset();
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.save.mockReset();
    mockUseYouth.mockReturnValue({
      youth: [makeYouthProfile({ account: null })],
      upsertYouth: vi.fn(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('closes a newly saved profile note without opening its details', async () => {
    youthApi.setYouthProfileNote.mockResolvedValue({
      id: 'profile-note-new', youthId: 'youth-1', category: 'general', title: 'New profile note',
      details: null, createdAt: '2026-08-10T12:00:00.000Z', updatedAt: '2026-08-10T12:00:00.000Z',
      createdByName: 'Bilal Khan',
    });
    render(<Youth />);

    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    fireEvent.click(screen.getByRole('button', { name: 'Add Note' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'New profile note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add Profile Note' })).not.toBeInTheDocument());
    expect(screen.queryByRole('dialog', { name: 'New profile note' })).not.toBeInTheDocument();
    expect(youthApi.setYouthProfileNote).toHaveBeenCalledWith('youth-1', expect.objectContaining({
      title: 'New profile note',
    }));
  });

  it('keeps account invitation controls out of the Youth page', () => {
    render(<Youth />);

    expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions for Jamie Test' })).toBeInTheDocument();
    expect(screen.queryByText('Manage Cohorts')).not.toBeInTheDocument();
    expect(screen.queryByText('Deactivate')).not.toBeInTheDocument();
    expect(screen.queryByText('Activate')).not.toBeInTheDocument();
    expect(screen.queryByText('Invite')).not.toBeInTheDocument();
  });

  it('persists a complete preference when first hiding a column', async () => {
    render(<Youth />);
    await waitFor(() => expect(mockUseYouth).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'School' }));

    expect(preferenceHook.save).toHaveBeenCalledWith({
      statuses: ['active'], programIds: ['program-1'], sorting: { key: 'firstName', direction: 'asc' }, columnWidths: {}, hiddenColumns: ['school'],
    });
  });

  it('defaults staff to active youth in their assigned programs and persists changes', async () => {
    render(<Youth />);

    await waitFor(() => expect(mockUseYouth).toHaveBeenLastCalledWith({
      search: '',
      statuses: ['active'],
      programIds: ['program-1'],
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Program/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Soft Skills' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(mockUseYouth).toHaveBeenLastCalledWith({
      search: '',
      statuses: ['active'],
      programIds: [],
    }));
    expect(preferenceHook.save).toHaveBeenCalledWith(expect.objectContaining({
      statuses: ['active'],
      programIds: [],
    }));
  });

  it('can filter inactive youth and restore the saved filters on another visit', async () => {
    render(<Youth />);

    await waitFor(() => expect(mockUseYouth).toHaveBeenCalledWith({
      search: '',
      statuses: ['active'],
      programIds: ['program-1'],
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Status/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Active' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Inactive' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(mockUseYouth).toHaveBeenLastCalledWith({
      search: '',
      statuses: ['inactive'],
      programIds: ['program-1'],
    }));
    expect(preferenceHook.save).toHaveBeenCalledWith(expect.objectContaining({
      statuses: ['inactive'],
      programIds: ['program-1'],
    }));

    preferenceHook.preference = {
      statuses: ['inactive'],
      programIds: [],
    };
    mockUseYouth.mockClear();
    render(<Youth />);
    await waitFor(() => expect(mockUseYouth).toHaveBeenLastCalledWith({
      search: '',
      statuses: ['inactive'],
      programIds: [],
    }));
  });

  it('shows the selected profile contact and profile notes', async () => {
    youthApi.getYouthProfileNotes.mockResolvedValue([{
      id: 'profile-note-1', youthId: 'youth-1', category: 'general', title: 'Family follow-up',
      details: 'Youth profile note', createdAt: '2026-07-21T23:00:00.000Z', updatedAt: '2026-07-21T23:00:00.000Z', createdByName: 'Bilal Khan',
    }]);
    mockUseYouth.mockReturnValue({
      youth: [makeYouthProfile({
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
        contacts: [{ id: 'contact-1', phoneNumber: '416-555-0101', type: 'parent' }],
      })],
      upsertYouth: vi.fn(), loading: false, error: null, refetch: vi.fn(),
    });
    render(<Youth />);

    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    expect(screen.getByText('416-555-0101')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByText('Soft Skills · Summer 2026')).toBeInTheDocument();
    expect(screen.getByText(/Present 8.*Late 2.*Absent 4/)).toBeInTheDocument();
    expect(screen.queryByText(/Last attended:/)).not.toBeInTheDocument();
    expect(await screen.findByText('Family follow-up')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profile Notes (1)' })).toBeInTheDocument();
  });

  it('opens youth-centric attendance management from a cohort summary', () => {
    const profile = makeYouthProfile({
      cohorts: [{
        id: 'cohort-1', name: 'Summer 2026', programId: 'program-1', programName: 'Soft Skills',
        rosterMode: 'enrolled', startsOn: '2026-06-30', endsOn: '2026-08-31',
        enrolledOn: '2026-06-30', withdrawnOn: null, presentCount: 2, lateCount: 0,
        absentCount: 0, lastAttendedOn: '2026-07-21',
      }],
    });
    mockUseYouth.mockReturnValue({
      youth: [profile], upsertYouth: vi.fn(), loading: false, error: null, refetch: vi.fn(),
    });
    render(<Youth />);

    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    fireEvent.click(screen.getByRole('button', { name: 'Manage attendance for Soft Skills · Summer 2026' }));
    expect(screen.getByTestId('youth-attendance-modal')).toHaveTextContent('Summer 2026');
  });

  it('opens the cohort attendance report filtered to the selected youth', () => {
    const profile = makeYouthProfile({
      cohorts: [{
        id: 'cohort-1', name: 'Summer 2026', programId: 'program-1', programName: 'Soft Skills',
        rosterMode: 'enrolled', startsOn: '2026-06-30', endsOn: '2026-08-31',
        enrolledOn: '2026-06-30', withdrawnOn: null, presentCount: 2, lateCount: 0,
        absentCount: 0, lastAttendedOn: '2026-07-21',
      }],
    });
    mockUseYouth.mockReturnValue({
      youth: [profile], upsertYouth: vi.fn(), loading: false, error: null, refetch: vi.fn(),
    });
    render(<Youth />);

    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    fireEvent.click(screen.getByRole('button', { name: 'View attendance report for Soft Skills · Summer 2026' }));

    expect(screen.getByTestId('youth-report-modal')).toHaveTextContent(`Summer 2026 · ${profile.id}`);
  });

  it('keeps a profile note open and reports a deletion failure', async () => {
    youthApi.getYouthProfileNotes.mockResolvedValue([{
      id: 'profile-note-1', youthId: 'youth-1', category: 'general', title: 'Family follow-up',
      details: null, createdAt: '2026-07-21T23:00:00.000Z', updatedAt: '2026-07-21T23:00:00.000Z', createdByName: 'Bilal Khan',
    }]);
    youthApi.deleteYouthProfileNote.mockRejectedValue(new Error('Unable to delete note'));
    render(<Youth />);

    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    fireEvent.click(await screen.findByRole('button', { name: 'View Family follow-up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Unable to delete note')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Delete Profile Note' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('returns to profile-note details after saving an edit', async () => {
    youthApi.getYouthProfileNotes.mockResolvedValue([{
      id: 'profile-note-1', youthId: 'youth-1', category: 'general', title: 'Family follow-up',
      details: null, createdAt: '2026-07-21T23:00:00.000Z', updatedAt: '2026-07-21T23:00:00.000Z', createdByName: 'Bilal Khan',
    }]);
    youthApi.setYouthProfileNote.mockResolvedValue({
      id: 'profile-note-1', youthId: 'youth-1', category: 'general', title: 'Updated follow-up',
      details: null, createdAt: '2026-07-21T23:00:00.000Z', updatedAt: '2026-08-11T12:00:00.000Z', createdByName: 'Bilal Khan',
    });
    render(<Youth />);

    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Family follow-up' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Updated follow-up' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('dialog', { name: 'Updated follow-up' })).toBeInTheDocument();
    expect(youthApi.setYouthProfileNote).toHaveBeenCalledWith('youth-1', expect.objectContaining({
      title: 'Updated follow-up',
    }), 'profile-note-1');
  });

  it('does not reopen stale note details when the selected profile changes during save', async () => {
    youthApi.getYouthProfileNotes.mockResolvedValue([{
      id: 'profile-note-1', youthId: 'youth-1', category: 'general', title: 'Family follow-up',
      details: null, createdAt: '2026-07-21T23:00:00.000Z', updatedAt: '2026-07-21T23:00:00.000Z', createdByName: 'Bilal Khan',
    }]);
    mockUseYouth.mockReturnValue({
      youth: [
        makeYouthProfile({ id: 'youth-1', firstName: 'Jamie', account: null }),
        makeYouthProfile({ id: 'youth-2', firstName: 'Taylor', account: null }),
      ],
      upsertYouth: vi.fn(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    let resolveUpdate!: (note: Awaited<ReturnType<typeof youthApi.setYouthProfileNote>>) => void;
    youthApi.setYouthProfileNote.mockReturnValue(new Promise(resolve => {
      resolveUpdate = resolve;
    }));
    render(<Youth />);

    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Family follow-up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(youthApi.setYouthProfileNote).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Taylor').closest('tr')!);
    resolveUpdate({
      id: 'profile-note-1', youthId: 'youth-1', category: 'general', title: 'Family follow-up',
      details: null, createdAt: '2026-07-21T23:00:00.000Z', updatedAt: '2026-08-11T12:00:00.000Z', createdByName: 'Bilal Khan',
    });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Family follow-up' })).not.toBeInTheDocument());
  });

  it('removes a successfully deleted profile note from the card', async () => {
    youthApi.getYouthProfileNotes.mockResolvedValue([{
      id: 'profile-note-1', youthId: 'youth-1', category: 'general', title: 'Family follow-up',
      details: null, createdAt: '2026-07-21T23:00:00.000Z', updatedAt: '2026-07-21T23:00:00.000Z', createdByName: 'Bilal Khan',
    }]);
    youthApi.deleteYouthProfileNote.mockResolvedValue(undefined);
    render(<Youth />);

    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Family follow-up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByText('Family follow-up')).not.toBeInTheDocument());
    expect(youthApi.deleteYouthProfileNote).toHaveBeenCalledWith('youth-1', 'profile-note-1');
    expect(screen.getByText('No profile notes recorded.')).toBeInTheDocument();
  });

  it('opens only the contact section from the primary contact card', () => {
    render(<Youth />);

    expect(screen.getByRole('button', { name: 'Manage primary contact' })).toBeDisabled();
    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    const addContact = screen.getByRole('button', { name: 'Manage primary contact' });
    expect(addContact).toBeEnabled();
    fireEvent.click(addContact);

    expect(screen.getByTestId('youth-modal')).toHaveTextContent('contact');
  });
});
