import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../../types';
import { inviteAccount, updateAccount } from '../../accounts.api';
import { useAccountModal } from './useAccountModal';

vi.mock('../../accounts.api', () => ({
  inviteAccount: vi.fn(),
  updateAccount: vi.fn(),
}));

const account: User = {
  id: 'account-1',
  firstName: 'Sam',
  lastName: 'Staff',
  email: 'sam@example.com',
  role: 'staff',
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
  programIds: ['00000000-0000-4000-8000-000000000001'],
};

/**
 * Renders the hook's validated account command boundary with editable domain fields.
 * @param props - Optional saved staff account and saved-result observer.
 * @example <AccountFormHarness account={account} onSuccess={sync} />
 */
function AccountFormHarness({
  account: target,
  onSuccess,
}: {
  account?: User;
  onSuccess: (saved: User) => void;
}) {
  const modal = useAccountModal({ account: target, onSuccess });

  return (
    <form aria-label="Account form" onSubmit={modal.onSubmit}>
      <label>First name<input {...modal.register('firstName')} /></label>
      <label>Last name<input {...modal.register('lastName')} /></label>
      <label>Email<input {...modal.register('email')} /></label>
      <label>Role<select {...modal.register('role')}>
        <option value="">Select a role</option>
        <option value="staff">Staff</option>
        <option value="project_manager">Project Manager</option>
        <option value="admin">Admin</option>
      </select></label>
      <button type="submit">Save</button>
      <output aria-label="Submit status">{modal.submitStatus}</output>
      {modal.error && <p role="alert">{modal.error}</p>}
    </form>
  );
}

describe('useAccountModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes an invitation and immediately reconciles the saved account', async () => {
    vi.mocked(inviteAccount).mockResolvedValue(account);
    const onSuccess = vi.fn();
    render(<AccountFormHarness onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: '  Sam  ' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: '  Staff  ' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  sam@example.com  ' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'staff' } });
    await act(async () => {
      fireEvent.submit(screen.getByRole('form', { name: 'Account form' }));
    });

    expect(inviteAccount).toHaveBeenCalledWith({
      firstName: 'Sam',
      lastName: 'Staff',
      email: 'sam@example.com',
      role: 'staff',
      programIds: [],
    });
    expect(screen.getByLabelText('Submit status')).toHaveTextContent('success');
    expect(onSuccess).toHaveBeenCalledWith(account);
  });

  it('preserves the project manager role when editing an account', async () => {
    const manager: User = { ...account, role: 'project_manager' };
    vi.mocked(updateAccount).mockResolvedValue(manager);
    render(<AccountFormHarness account={manager} onSuccess={vi.fn()} />);

    await act(async () => {
      fireEvent.submit(screen.getByRole('form', { name: 'Account form' }));
    });

    expect(updateAccount).toHaveBeenCalledWith(expect.objectContaining({
      id: manager.id, role: 'project_manager', programIds: manager.programIds,
    }));
  });

  it('initializes edit values and reports update failures without closing', async () => {
    vi.mocked(updateAccount).mockRejectedValue(new Error('Email already exists'));
    const onSuccess = vi.fn();
    render(<AccountFormHarness account={account} onSuccess={onSuccess} />);

    expect(screen.getByLabelText('First name')).toHaveValue('Sam');
    expect(screen.getByLabelText('Email')).toHaveValue('sam@example.com');
    await act(async () => {
      fireEvent.submit(screen.getByRole('form', { name: 'Account form' }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Email already exists');
    expect(updateAccount).toHaveBeenCalledWith({
      id: 'account-1',
      firstName: 'Sam',
      lastName: 'Staff',
      email: 'sam@example.com',
      role: 'staff',
      programIds: ['00000000-0000-4000-8000-000000000001'],
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
