// Owns account-form initialization, payloads, immediate reconciliation, and failure recovery.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Account } from '../../../../../common/types/account';
import { inviteAccount, updateAccount } from '../../accounts.api';
import { useAccountModal } from './useAccountModal';

vi.mock('../../accounts.api', () => ({
  inviteAccount: vi.fn(),
  updateAccount: vi.fn(),
}));

const account: Account = {
  id: 'account-1',
  firstName: 'Sam',
  lastName: 'Staff',
  email: 'sam@example.com',
  role: 'staff',
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
  programIds: ['00000000-0000-4000-8000-000000000001'],
};

function AccountFormHarness({
  account: target,
  onClose,
  onSuccess,
}: {
  account?: Account;
  onClose: () => void;
  onSuccess: (saved: Account) => void;
}) {
  const modal = useAccountModal({ isOpen: true, account: target, onClose, onSuccess });

  return (
    <form aria-label="Account form" onSubmit={modal.onSubmit}>
      <label>First name<input {...modal.register('firstName')} /></label>
      <label>Last name<input {...modal.register('lastName')} /></label>
      <label>Email<input {...modal.register('email')} /></label>
      <button type="submit">Save</button>
      <button type="button" onClick={modal.handleClose}>Close</button>
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
    const order: string[] = [];
    render(<AccountFormHarness
      onSuccess={() => order.push('success')}
      onClose={() => order.push('close')}
    />);

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: '  Sam  ' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: '  Staff  ' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  sam@example.com  ' } });
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
    expect(order).toEqual(['success']);
  });

  it('initializes edit values and reports update failures without closing', async () => {
    vi.mocked(updateAccount).mockRejectedValue(new Error('Email already exists'));
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(<AccountFormHarness account={account} onSuccess={onSuccess} onClose={onClose} />);

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
    expect(onClose).not.toHaveBeenCalled();
  });
});
