import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import YouthModal from './YouthModal';
import { makeYouthProfile } from '../../../../tests/factories/youth';

vi.mock('../../../../common/api/youth.api', () => ({
  setYouth: vi.fn(),
}));

vi.mock('../../../../common/hooks/useSchools', () => ({
  useSchools: () => ({
    schools: [],
    loading: false,
    error: '',
    refetch: vi.fn(),
  }),
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
    it('calls setYouth with active status when creating', async () => {
      renderModal();
      fillRequiredFields();
      submitForm();
      await waitFor(() => {
        expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({
          firstName: 'Jamie',
          lastName: 'Test',
          status: 'active',
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

    it('preserves active status when updating an active profile', async () => {
      const profile = makeYouthProfile({ firstName: 'Jordan', lastName: 'Smith', status: 'active' });
      renderModal({ youthData: profile });
      submitForm();
      await waitFor(() => {
        expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
      });
    });

    it('preserves inactive status when updating an inactive profile', async () => {
      const profile = makeYouthProfile({ firstName: 'Jordan', lastName: 'Smith', status: 'inactive' });
      renderModal({ youthData: profile });
      submitForm();
      await waitFor(() => {
        expect(mockSetYouth).toHaveBeenCalledWith(expect.objectContaining({ status: 'inactive' }));
      });
    });
  });
});
