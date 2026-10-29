import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import YouthModal from './YouthModal';
import { getDateOfBirthBounds } from '../../../../common/features/youth/dateOfBirth';
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

function renderModal(props: Partial<React.ComponentProps<typeof YouthModal>> = {}) {
  return render(
    <YouthModal
      isOpen={true}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      {...props}
    />
  );
}

function fillRequiredFields(firstName = 'Jamie', lastName = 'Test') {
  fireEvent.change(document.getElementById('firstName')!, { target: { value: firstName } });
  fireEvent.change(document.getElementById('lastName')!, { target: { value: lastName } });
  fireEvent.change(screen.getByLabelText('Date of Birth *'), { target: { value: '2012-08-19' } });
}

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
    it('shows Add Youth Profile title when creating from Youth', () => {
      renderModal();
      expect(screen.getByText('Add Youth Profile')).toBeInTheDocument();
    });

    it('collects only a street address for youth addresses', () => {
      renderModal();

      expect(screen.getByLabelText('Address (optional)')).toBeInTheDocument();
      expect(screen.queryByLabelText('Grade')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('City')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Province')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Postal Code')).not.toBeInTheDocument();
    });

    it('shows Update Youth Profile title when editing', () => {
      renderModal({ youthData: makeYouthProfile() });
      expect(screen.getByRole('heading', { name: 'Update Youth Profile' })).toBeInTheDocument();
    });

    it('shows only the primary contact section in contact mode', () => {
      renderModal({ youthData: makeYouthProfile(), mode: 'contact' });

      expect(screen.getByRole('heading', { name: 'Primary Contact' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save Contact' })).toBeInTheDocument();
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

    it('does not show login email when opened from Youth', () => {
      renderModal();
      expect(screen.queryByLabelText('Login Email')).not.toBeInTheDocument();
    });

    it('shows login email when opened from Users', () => {
      renderModal({ showLoginEmail: true });
      expect(screen.getByLabelText('Login Email')).toBeInTheDocument();
    });

    it('shows an existing account email as read-only in account mode', () => {
      renderModal({ showLoginEmail: true, youthData: makeYouthProfile({ account: { email: 'youth@example.com', status: 'active' } }) });
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

    it('shows only the school action dialog while managing a school', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'School' }));
      fireEvent.click(screen.getByRole('menuitem', { name: '+ Add school' }));

      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(screen.getByRole('dialog', { name: 'Add School' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Add Youth Profile' })).not.toBeInTheDocument();
    });

    it('does not render when closed', () => {
      renderModal({ isOpen: false });
      expect(screen.queryByText('Add Youth Profile')).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('requires birthdate and exposes its validation error accessibly', async () => {
      renderModal();
      fillRequiredFields();
      const input = screen.getByLabelText('Date of Birth *');
      expect(input).toBeRequired();
      fireEvent.change(input, { target: { value: '' } });
      submitForm();

      await waitFor(() => expect(input).toHaveAccessibleDescription('Date of birth is required'));
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(mockSetYouth).not.toHaveBeenCalled();
    });

    it('uses yesterday as maximum and accepts an adult DOB when creating', async () => {
      renderModal();
      fillRequiredFields();
      const input = screen.getByLabelText('Date of Birth *');
      const bounds = getDateOfBirthBounds();
      expect(input).not.toHaveAttribute('min');
      expect(input).toHaveAttribute('max', bounds.max);
      fireEvent.change(input, { target: { value: '1980-01-01' } });
      submitForm();

      await waitFor(() => expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({ dateOfBirth: '1980-01-01' })));
    });

    it('allows a historical profile birthdate outside intake ages when editing', async () => {
      renderModal({ youthData: makeYouthProfile({ dateOfBirth: '1980-01-01' }) });
      const input = screen.getByLabelText('Date of Birth *');
      expect(input).not.toHaveAttribute('min');
      submitForm();

      await waitFor(() => expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({ dateOfBirth: '1980-01-01' })));
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

    it('includes login email when inviting during youth creation', async () => {
      renderModal({ showLoginEmail: true });
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

    it('does not submit the cohort-derived status when updating', async () => {
      const profile = makeYouthProfile({ firstName: 'Jordan', lastName: 'Smith', dateOfBirth: '2012-08-19' });
      renderModal({ youthData: profile });
      submitForm();
      await waitFor(() => {
        expect(mockSetYouth).toHaveBeenCalledWith(
          expect.not.objectContaining({ status: expect.anything() }),
        );
      });
    });
  });
});
