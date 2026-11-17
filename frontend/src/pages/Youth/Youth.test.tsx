import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Youth from './Youth';
import type { SchoolAction, SchoolSelection } from '../../common/features/SchoolModal/types';
import { getCycleReferences } from '../../common/features/referenceData/referenceData.api';
import { makeYouthProfile } from '../../tests/factories/youth';
import { renderWithQueryClient as render } from '../../tests/queryClientTestUtils';

const mockUseYouthTableData = vi.fn();
const schoolSelectionChanged = vi.hoisted(() => vi.fn());
const youthApi = vi.hoisted(() => ({
  getYouthProfileNotes: vi.fn(),
  setYouthProfileNote: vi.fn(),
  deleteYouthProfileNote: vi.fn(),
}));
const attendanceApi = vi.hoisted(() => ({ getAttendance: vi.fn() }));
const preferenceApi = vi.hoisted(() => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
const authState = vi.hoisted(() => ({
  permissions: ['read:youth_profiles', 'write:youth_profiles', 'read:programs', 'write:enrollments', 'read:attendance', 'write:attendance', 'read:sessions', 'write:sessions'],
}));

vi.mock('./components/YouthTable/hooks/useYouthTableData', () => ({
  default: (filters: unknown) => mockUseYouthTableData(filters),
}));
vi.mock('./youth.api', () => youthApi);
vi.mock('../../common/features/Attendance/attendance.api', () => attendanceApi);
vi.mock('../../common/features/SchoolModal/schoolModal.api', () => ({
  createSchool: vi.fn().mockResolvedValue({ id: 'school-new', name: 'Saved School' }),
}));
vi.mock('../../common/features/Preferences/preferences.api', () => preferenceApi);

vi.mock('../../common/features/referenceData/hooks/useReferenceData', async importOriginal => ({
  ...await importOriginal<typeof import('../../common/features/referenceData/hooks/useReferenceData')>(),
  useProgramReferences: (...args: unknown[]) => {
    expect(args).toEqual([{ assignedOnly: true }]);
    return { rows: [{ id: 'program-1', title: 'Soft Skills' }], loading: false, error: '' };
  },
}));

vi.mock('../../common/features/referenceData/referenceData.api', () => ({ getCycleReferences: vi.fn(), getSchoolReferences: vi.fn().mockResolvedValue([]) }));

vi.mock('../../auth/authContext', () => ({
  useAuth: () => ({ role: 'staff', permissions: authState.permissions }),
}));

vi.mock('./components/YouthModal/YouthModal', () => ({
  default: ({ isOpen, suspended, onManageSchool, mode, youthData, onSuccess }: {
    isOpen: boolean;
    suspended?: boolean;
    onManageSchool?: (action: SchoolAction, selection: SchoolSelection) => void;
    mode?: string;
    youthData?: ReturnType<typeof makeYouthProfile>;
    onSuccess: (profile: ReturnType<typeof makeYouthProfile>) => void;
  }) => isOpen && !suspended
    ? <div data-testid="youth-modal">
      {mode ?? 'full'}
      {onManageSchool && <button onClick={() => onManageSchool({ type: 'add' }, { schoolId: '', onChange: schoolSelectionChanged })}>Manage school</button>}
      {youthData && <button onClick={() => onSuccess({
        ...youthData,
        firstName: 'Authoritative',
        contacts: [{ id: 'contact-saved', phoneNumber: '416-555-0199', type: 'guardian' }],
      })}>Complete save</button>}
    </div>
    : null,
}));
vi.mock('../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ ariaLabel, items }: {
    ariaLabel: string;
    items: Array<{ id: string; label: string; onClick: () => void }>;
  }) => <>
    <button aria-label={ariaLabel} onClick={items[0].onClick}>{items[0].label}</button>
    {items.slice(1).map(item => <button key={item.id} onClick={item.onClick}>{item.label}</button>)}
  </>,
}));
describe('Youth', () => {
  beforeEach(() => {
    localStorage.clear();
    schoolSelectionChanged.mockClear();
    authState.permissions = ['read:youth_profiles', 'write:youth_profiles', 'read:programs', 'write:enrollments', 'read:attendance', 'write:attendance', 'read:sessions', 'write:sessions'];
    mockUseYouthTableData.mockClear();
    vi.mocked(getCycleReferences).mockResolvedValue([{
      id: 'cycle-1', title: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
    }]);
    youthApi.getYouthProfileNotes.mockResolvedValue([]);
    attendanceApi.getAttendance.mockResolvedValue({ groups: [] });
    youthApi.setYouthProfileNote.mockReset();
    youthApi.deleteYouthProfileNote.mockReset();
    preferenceApi.getPreference.mockResolvedValue(null);
    preferenceApi.setPreference.mockImplementation((_key, value) => Promise.resolve(value));
    mockUseYouthTableData.mockReturnValue({
      rows: [makeYouthProfile({ account: null })],
      loading: false,
      refreshing: false,
      error: null,
      hasNextPage: false,
      loadingNextPage: false,
      loadNextPage: vi.fn(),
    });
  });

  // Entry and readiness.
  it('loads youth records without exposing attendance to youth-only readers', async () => {
    authState.permissions = ['read:youth_profiles'];
    render(<Youth />);

    fireEvent.click((await screen.findByText('Jamie')).closest('tr')!);
    expect(screen.queryByRole('heading', { name: 'Attendance' })).not.toBeInTheDocument();
    expect(attendanceApi.getAttendance).not.toHaveBeenCalled();
  });

  it('keeps account invitation controls out of the Youth page', async () => {
    render(<Youth />);
    await screen.findByRole('button', { name: 'Filters' });

    expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
    expect(screen.queryByText('Manage ProgramCycles')).not.toBeInTheDocument();
    expect(screen.queryByText('Deactivate')).not.toBeInTheDocument();
    expect(screen.queryByText('Activate')).not.toBeInTheDocument();
    expect(screen.queryByText('Invite')).not.toBeInTheDocument();
  });

  it('hides Add without youth write permission', async () => {
    authState.permissions = ['read:youth_profiles'];

    render(<Youth />);
    await screen.findByRole('button', { name: 'Filters' });

    expect(screen.queryByRole('button', { name: '+ Add' })).not.toBeInTheDocument();
  });

  // Controls and views.
  it('passes restored filters to the youth table and coordinates clearing the cycle', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      search: 'Jamie',
      programIds: ['program-1'], cycleIds: ['cycle-1'], statuses: ['active'],
    });
    render(<Youth />);
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    expect(screen.queryByRole('menuitem', { name: 'ProgramCycle' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^Program/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^Status/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /^Cycle/ }));

    expect(mockUseYouthTableData).toHaveBeenLastCalledWith({
      search: 'Jamie', programIds: ['program-1'], cycleIds: ['cycle-1'],
    });

    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear' }));
    await waitFor(() => expect(mockUseYouthTableData).toHaveBeenLastCalledWith({
      search: 'Jamie', programIds: ['program-1'], cycleIds: [],
    }));
  });

  // Selection and coordination.
  it('shows the selected profile contact and profile notes', async () => {
    youthApi.getYouthProfileNotes.mockResolvedValue([{
      id: 'profile-note-1', youthId: 'youth-1', category: 'general',
      details: 'Youth profile note', createdAt: '2026-07-21T23:00:00.000Z', updatedAt: '2026-07-21T23:00:00.000Z', createdByName: 'Bilal Khan',
    }]);
    mockUseYouthTableData.mockReturnValue({
      rows: [makeYouthProfile({
        contacts: [{ id: 'contact-1', phoneNumber: '416-555-0101', type: 'parent' }],
      })],
      loading: false, error: null,
    });
    render(<Youth />);
    await screen.findByRole('button', { name: 'Filters' });

    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    expect(screen.getByText('416-555-0101')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'View profile note' })).toBeInTheDocument();
    expect(screen.queryByText('Youth profile note')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
  });

  it('reconciles an authoritative contact save into the selected dashboard', async () => {
    render(<Youth />);
    await screen.findByRole('button', { name: 'Filters' });

    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    fireEvent.click(screen.getByRole('button', { name: 'Manage primary contact' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete save' }));

    expect(await screen.findByText('416-555-0199')).toBeInTheDocument();
  });

  // Commands and dialogs.
  it('opens a sibling school dialog and returns to the youth form after cancel or save', async () => {
    render(<Youth />);
    await screen.findByRole('button', { name: 'Filters' });
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage school' }));

    expect(screen.getByRole('dialog', { name: 'Add School' })).toBeInTheDocument();
    expect(screen.queryByTestId('youth-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('youth-modal')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Add School' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Manage school' }));
    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: 'New School' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add School' })).not.toBeInTheDocument());
    expect(screen.getByTestId('youth-modal')).toBeInTheDocument();
    expect(schoolSelectionChanged).toHaveBeenCalledWith('school-new');
  });

  it('adds a profile note from the row action without selecting the youth or opening note details', async () => {
    youthApi.setYouthProfileNote.mockResolvedValue({
      id: 'profile-note-new', youthId: 'youth-1', category: 'general',
      details: 'New profile note', createdAt: '2026-08-10T12:00:00.000Z', updatedAt: '2026-08-10T12:00:00.000Z',
      createdByName: 'Bilal Khan',
    });
    render(<Youth />);
    await screen.findByRole('button', { name: 'Filters' });

    fireEvent.click(screen.getByRole('button', { name: 'Add Note' }));
    expect(screen.getByRole('button', { name: 'Manage primary contact' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Note *'), { target: { value: 'New profile note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'General' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Profile note added.');
    expect(screen.getByRole('dialog', { name: 'Add Profile Note' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'New profile note' })).not.toBeInTheDocument();
  });

  it('opens only the contact section from the primary contact card', async () => {
    render(<Youth />);
    await screen.findByRole('button', { name: 'Filters' });

    expect(screen.getByRole('button', { name: 'Manage primary contact' })).toBeDisabled();
    fireEvent.click(screen.getByText('Jamie').closest('tr')!);
    const addContact = screen.getByRole('button', { name: 'Manage primary contact' });
    expect(addContact).toBeEnabled();
    fireEvent.click(addContact);

    expect(screen.getByTestId('youth-modal')).toHaveTextContent('contact');
  });
});
