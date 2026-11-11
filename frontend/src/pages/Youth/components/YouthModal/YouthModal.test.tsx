import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import YouthModal from './YouthModal';
import { makeYouthProfile } from '../../../../tests/factories/youth';

vi.mock('../../youth.api', () => ({
  setYouth: vi.fn(),
  setYouthContacts: vi.fn(),
}));

const schoolState = vi.hoisted(() => ({
  schools: [] as Array<{ id: string; name: string }>,
  upsertSchool: vi.fn(),
  removeSchool: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  permissions: ['write:schools'] as string[],
}));

vi.mock('../../../../common/features/SchoolModal/hooks/useSchools', () => ({
  useSchools: () => ({
    schools: schoolState.schools,
    upsertSchool: schoolState.upsertSchool,
    removeSchool: schoolState.removeSchool,
    loading: false,
    error: '',
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../../auth/authContext', () => ({
  useAuth: () => authState,
}));

import { setYouth, setYouthContacts } from '../../youth.api';

const mockSetYouth = setYouth as ReturnType<typeof vi.fn>;

/**
 * Renders one open Youth form with default callbacks and the supplied scenario props.
 * @param props - Initial profile, mode, school workflow, or callbacks for this test.
 * @example renderModal({ youthData: profile }) // edits the supplied profile
 */
function renderModal(props: Partial<React.ComponentProps<typeof YouthModal>> = {}) {
  return render(
    <YouthModal
      isOpen
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      onManageSchool={vi.fn()}
      {...props}
    />
  );
}

/**
 * Enters profile names and a valid birth date before the test submits the form.
 * @param firstName - First name to enter.
 * @param lastName - Last name to enter.
 * @example fillRequiredFields('Jordan', 'Smith')
 */
function fillRequiredFields(firstName = 'Jamie', lastName = 'Test') {
  fireEvent.change(document.getElementById('firstName')!, { target: { value: firstName } });
  fireEvent.change(document.getElementById('lastName')!, { target: { value: lastName } });
  fireEvent.change(screen.getByLabelText('Date of Birth (optional)'), { target: { value: '2012-08-19' } });
}

/**
 * Submits the currently rendered Youth form through its validation boundary.
 * @example submitForm() // displays validation errors or starts the profile save
 */
function submitForm() {
  fireEvent.submit(document.getElementById('youth-form')!);
}

describe('YouthModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetYouth.mockResolvedValue(makeYouthProfile());
    vi.mocked(setYouthContacts).mockResolvedValue(makeYouthProfile());
    schoolState.schools = [];
    schoolState.upsertSchool.mockReset();
    schoolState.removeSchool.mockReset();
    authState.permissions = ['write:schools'];
  });

  describe('rendering', () => {
    it('shows only the primary contact section in contact mode', () => {
      renderModal({ youthData: makeYouthProfile(), mode: 'contact' });

      expect(screen.getByRole('heading', { name: 'Primary Contact' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'General Information' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Address/ })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('School')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/Phone Number/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Relationship/)).toBeInTheDocument();
    });

    it('pre-fills first and last name when editing', () => {
      renderModal({ youthData: makeYouthProfile({ firstName: 'Jordan', lastName: 'Smith', dateOfBirth: '2012-08-19' }) });
      expect(screen.getByDisplayValue('Jordan')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Smith')).toBeInTheDocument();
    });

    it('shows an existing account email as read-only in account mode', () => {
      renderModal({ inviteYouth: true, youthData: makeYouthProfile({ account: { email: 'youth@example.com', status: 'active' } }) });
      expect(screen.getByLabelText('Login Email')).toHaveValue('youth@example.com');
      expect(screen.getByLabelText('Login Email')).toBeDisabled();
    });

    it('offers school creation only with school write permission', () => {
      const { unmount } = renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'School' }));
      expect(screen.getByRole('menuitem', { name: '+ Add school' })).toBeInTheDocument();
      unmount();

      authState.permissions = [];
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'School' }));
      expect(screen.queryByRole('menuitem', { name: '+ Add school' })).not.toBeInTheDocument();
    });

    it('shows edit and delete actions on each school option for writers', () => {
      schoolState.schools = [{ id: 'school-1', name: 'Central High' }];
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'School' }));

      expect(screen.getByRole('menuitem', { name: 'Edit Central High' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Delete Central High' })).toBeInTheDocument();
    });

    it('delegates school actions and accepts the new school selection', async () => {
      const onManageSchool = vi.fn();
      renderModal({ onManageSchool });
      fillRequiredFields();

      fireEvent.click(screen.getByRole('button', { name: 'School' }));
      fireEvent.click(screen.getByRole('menuitem', { name: '+ Add school' }));

      expect(onManageSchool).toHaveBeenCalledWith({ type: 'add' }, {
        schoolId: '', onChange: expect.any(Function),
      });
      expect(screen.queryByRole('dialog', { name: 'Add School' })).not.toBeInTheDocument();

      act(() => onManageSchool.mock.calls[0][1].onChange('school-new'));
      submitForm();

      await waitFor(() => expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({ schoolId: 'school-new' })));
    });

    it('preserves an edited profile draft while its dialog is suspended', () => {
      const youthData = makeYouthProfile();
      const props = { youthData, onClose: vi.fn(), onSuccess: vi.fn() };
      const { rerender } = renderModal(props);
      fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'Unsaved name' } });

      rerender(<YouthModal isOpen {...props} suspended />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      rerender(<YouthModal isOpen {...props} />);
      expect(screen.getByLabelText('First Name *')).toHaveValue('Unsaved name');
    });

    it('omits school management when the caller does not supply a workflow', () => {
      renderModal({ onManageSchool: undefined });
      fireEvent.click(screen.getByRole('button', { name: 'School' }));

      expect(screen.queryByRole('menuitem', { name: '+ Add school' })).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('submits a profile without a birthdate', async () => {
      renderModal();
      fillRequiredFields();
      const input = screen.getByLabelText('Date of Birth (optional)');
      expect(input).not.toBeRequired();
      fireEvent.change(input, { target: { value: '' } });
      submitForm();

      await waitFor(() => expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({ dateOfBirth: null })));
    });



    it('shows validation error when submitting without first name', async () => {
      renderModal();
      submitForm();
      await waitFor(() => {
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      });
    });

    it('shows validation error when submitting without last name', async () => {
      renderModal();
      fireEvent.change(document.getElementById('firstName')!, { target: { value: 'Jamie' } });
      submitForm();
      await waitFor(() => {
        expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      });
    });

    it('keeps successful feedback visible until the shared modal delay closes', async () => {
      const onClose = vi.fn();
      const onSuccess = vi.fn();
      renderModal({ onClose, onSuccess });
      fillRequiredFields();

      submitForm();

      await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'youth-1' }),
      ));
      expect(screen.getByText('Youth profile created successfully!')).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Add Youth Profile' })).toBeInTheDocument();
      expect(screen.getByLabelText('First Name *')).toBeDisabled();
      expect(screen.getByLabelText(/Phone Number/)).toBeDisabled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('api calls', () => {
    it('calls setYouth with the profile fields when creating', async () => {
      renderModal();
      fillRequiredFields();
      submitForm();
      await waitFor(() => {
        expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({
          firstName: 'Jamie',
          lastName: 'Test',
          dateOfBirth: '2012-08-19',
          addresses: [],
        }));
      });
    });

    it('submits a youth address with only the street address', async () => {
      renderModal();
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText('Address (optional)'), {
        target: { value: ' 123 Main Street ' },
      });
      submitForm();

      await waitFor(() => {
        expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({
          addresses: [{ address: '123 Main Street' }],
        }));
      });
    });

    it('requires saved addresses and preserves every address ID when editing', async () => {
      renderModal({ youthData: makeYouthProfile({
        addresses: [
          { id: 'address-1', address: '123 Main Street' },
          { id: 'address-2', address: '456 Queen Street' },
        ],
      }) });
      const addressFields = screen.getAllByLabelText('Address (optional)');
      fireEvent.change(addressFields[0], { target: { value: '   ' } });
      submitForm();

      expect(await screen.findByText('Street address is required')).toBeInTheDocument();
      expect(mockSetYouth).not.toHaveBeenCalled();

      fireEvent.change(addressFields[0], { target: { value: ' 789 King Street ' } });
      submitForm();

      await waitFor(() => expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({
        addresses: [
          { id: 'address-1', address: '789 King Street' },
          { id: 'address-2', address: '456 Queen Street' },
        ],
      })));
    });

    it('includes login email when inviting during youth creation', async () => {
      renderModal({ inviteYouth: true });
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText('Login Email'), { target: { value: 'new-youth@example.com' } });
      submitForm();
      await waitFor(() => {
        expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({ email: 'new-youth@example.com' }));
      });
    });

    it('submits the selected school id', async () => {
      schoolState.schools = [{ id: 'school-1', name: 'Central High' }];
      renderModal();
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: 'School' }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Central High' }));
      submitForm();

      await waitFor(() => {
        expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({ schoolId: 'school-1' }));
      });
    });

    it('does not include id in payload when creating', async () => {
      renderModal();
      fillRequiredFields();
      submitForm();
      await waitFor(() => {
        expect(mockSetYouth).toHaveBeenCalledWith(
          expect.not.objectContaining({ id: expect.anything() })
        );
      });
    });

    it('includes id in payload when updating', async () => {
      const profile = makeYouthProfile({ id: 'youth-99', firstName: 'Jordan', lastName: 'Smith', dateOfBirth: '2012-08-19' });
      renderModal({ youthData: profile });
      submitForm();
      await waitFor(() => {
        expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({ id: 'youth-99' }));
      });
    });

    it('updates contacts from contact-only mode without clearing profile data', async () => {
      const profile = makeYouthProfile({
        id: 'youth-99',
        firstName: 'Jordan',
        lastName: 'Smith',
        contacts: null,
      });
      renderModal({ youthData: profile, mode: 'contact' });
      fireEvent.change(screen.getByLabelText(/Phone Number/), { target: { value: '519-555-0101' } });
      submitForm();

      await waitFor(() => {
        expect(setYouthContacts).toHaveBeenCalledWith('youth-99', [{
          phoneNumber: '519-555-0101',
          type: 'parent',
        }]);
        expect(mockSetYouth).not.toHaveBeenCalled();
      });
    });

    it('uses the shared relationship selector in contact mode', async () => {
      const profile = makeYouthProfile({
        id: 'youth-99',
        firstName: 'Jordan',
        lastName: 'Smith',
        contacts: null,
      });
      renderModal({ youthData: profile, mode: 'contact' });
      fireEvent.change(screen.getByLabelText(/Phone Number/), { target: { value: '519-555-0101' } });
      fireEvent.click(screen.getByRole('button', { name: 'Relationship 1' }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Guardian' }));
      submitForm();

      await waitFor(() => expect(setYouthContacts).toHaveBeenCalledWith('youth-99', [
        { phoneNumber: '519-555-0101', type: 'guardian' },
      ]));
    });

  });
});
