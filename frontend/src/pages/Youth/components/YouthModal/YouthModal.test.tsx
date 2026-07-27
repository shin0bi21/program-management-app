import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import YouthModal from './YouthModal';
import { makeYouthProfile } from '../../../../tests/factories/youth';

vi.mock('../../../../common/api/youth.api', () => ({
  setYouth: vi.fn(),
}));

const schoolState = vi.hoisted(() => ({
  schools: [] as Array<{ id: string; name: string; board: null; address: null; postalCode: null }>,
  setSchools: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  permissions: ['write:schools'] as string[],
}));

vi.mock('../../../../common/hooks/useSchools', () => ({
  useSchools: () => ({
    schools: schoolState.schools,
    setSchools: schoolState.setSchools,
    loading: false,
    error: '',
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../../common/context/AuthContext', () => ({
  useAuth: () => authState,
}));

import { setYouth } from '../../../../common/api/youth.api';

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
}

function submitForm() {
  fireEvent.submit(document.getElementById('youth-form')!);
}

describe('YouthModal', () => {
  beforeEach(() => {
    mockSetYouth.mockResolvedValue(makeYouthProfile());
    schoolState.schools = [];
    schoolState.setSchools.mockReset();
    authState.permissions = ['write:schools'];
  });

  describe('rendering', () => {
    it('shows Add Youth Profile title when creating from Youth', () => {
      renderModal();
      expect(screen.getByText('Add Youth Profile')).toBeInTheDocument();
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
      expect(screen.getByLabelText('Phone Number')).toBeInTheDocument();
      expect(screen.getByLabelText('Relationship')).toBeInTheDocument();
    });

    it('pre-fills first and last name when editing', () => {
      renderModal({ youthData: makeYouthProfile({ firstName: 'Jordan', lastName: 'Smith' }) });
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

    it('offers inline school creation only with school write permission', () => {
      const { unmount } = renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'School' }));
      expect(screen.getByRole('menuitem', { name: '+ Add school' })).toBeInTheDocument();
      unmount();

      authState.permissions = [];
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'School' }));
      expect(screen.queryByRole('menuitem', { name: '+ Add school' })).not.toBeInTheDocument();
    });

    it('does not render when closed', () => {
      renderModal({ isOpen: false });
      expect(screen.queryByText('Add Youth Profile')).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
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
      schoolState.schools = [{ id: 'school-1', name: 'Central High', board: null, address: null, postalCode: null }];
      renderModal();
      fillRequiredFields();
      fireEvent.click(screen.getByRole('button', { name: 'School' }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Central High' }));
      submitForm();

      await waitFor(() => {
        expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({ schoolId: 'school-1' }));
      });
    });

    it('submits normalized profile notes', async () => {
      renderModal();
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText('Notes'), { target: { value: ' Follow up with family ' } });
      submitForm();

      await waitFor(() => {
        expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Follow up with family' }));
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
      const profile = makeYouthProfile({ id: 'youth-99', firstName: 'Jordan', lastName: 'Smith' });
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
        notes: 'Existing note',
        contacts: null,
      });
      renderModal({ youthData: profile, mode: 'contact' });
      fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Pat' } });
      fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Smith' } });
      fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: '519-555-0101' } });
      submitForm();

      await waitFor(() => {
        expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({
          id: 'youth-99',
          firstName: 'Jordan',
          lastName: 'Smith',
          notes: 'Existing note',
          contacts: [{
            firstName: 'Pat',
            lastName: 'Smith',
            phoneNumber: '519-555-0101',
            type: 'parent',
          }],
        }));
      });
    });

    it('does not submit the cohort-derived status when updating', async () => {
      const profile = makeYouthProfile({ firstName: 'Jordan', lastName: 'Smith' });
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
