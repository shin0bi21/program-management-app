// Scope: verifies account modal program assignment, role, and route-adapter integration behavior.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPrograms } from '../../../../../common/features/programs/programs.api';
import { inviteAccount, updateAccount } from '../../accounts.api';
import renderWithQueryClient from '../../../../../tests/renderWithQueryClient';
import AccountModal from './AccountModal';

vi.mock('../../../../../common/features/programs/programs.api', () => ({
  getPrograms: vi.fn(),
}));

vi.mock('../../accounts.api', () => ({
  inviteAccount: vi.fn(),
  updateAccount: vi.fn(),
}));

const softSkillsId = '11111111-1111-4111-8111-111111111111';
const jobReadinessId = '44444444-4444-4444-8444-444444444444';

describe('AccountModal program assignments', () => {
  beforeEach(() => {
    vi.mocked(getPrograms).mockResolvedValue([
      {
        id: softSkillsId,
        name: 'Soft Skills',
        description: null,
        rosterMode: 'enrolled',
        minAge: 12,
        maxAge: 15,
      },
      {
        id: jobReadinessId,
        name: 'Job Readiness',
        description: null,
        rosterMode: 'enrolled',
        minAge: 16,
        maxAge: 19,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Drop In',
        description: null,
        rosterMode: 'open',
        minAge: null,
        maxAge: null,
      },
    ]);
    vi.mocked(inviteAccount).mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      firstName: 'Sam',
      lastName: 'Staff',
      email: 'sam@example.com',
      role: 'staff',
      status: 'invited',
      createdAt: '2026-07-25T00:00:00.000Z',
      programIds: [softSkillsId],
    });
    vi.mocked(updateAccount).mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      firstName: 'Sam',
      lastName: 'Staff',
      email: 'sam@example.com',
      role: 'staff',
      status: 'active',
      createdAt: '2026-07-25T00:00:00.000Z',
      programIds: [softSkillsId, jobReadinessId],
    });
  });

  it('assigns selected enrollment programs and lists open programs as automatic', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <AccountModal
        isOpen
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(await screen.findByText('Automatically available: Drop In')).toBeInTheDocument();
    await user.type(screen.getByLabelText('First Name *'), 'Sam');
    await user.type(screen.getByLabelText('Last Name *'), 'Staff');
    await user.type(screen.getByLabelText('Email *'), 'sam@example.com');
    await user.click(screen.getByRole('checkbox', { name: 'Soft Skills' }));
    await user.click(screen.getByRole('button', { name: 'Send Invite' }));

    await waitFor(() => expect(inviteAccount).toHaveBeenCalledWith({
      firstName: 'Sam',
      lastName: 'Staff',
      email: 'sam@example.com',
      role: 'staff',
      programIds: [softSkillsId],
    }));
    expect(screen.queryByRole('checkbox', { name: 'Drop In' })).not.toBeInTheDocument();
  });

  it('lets an admin edit an existing staff member program assignments', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <AccountModal
        isOpen
        account={{
          id: '33333333-3333-4333-8333-333333333333',
          firstName: 'Sam',
          lastName: 'Staff',
          email: 'sam@example.com',
          role: 'staff',
          status: 'active',
          createdAt: '2026-07-25T00:00:00.000Z',
          programIds: [softSkillsId],
        }}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(await screen.findByRole('checkbox', { name: 'Soft Skills' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Job Readiness' })).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Job Readiness' }));
    await user.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => expect(updateAccount).toHaveBeenCalledWith({
      id: '33333333-3333-4333-8333-333333333333',
      firstName: 'Sam',
      lastName: 'Staff',
      email: 'sam@example.com',
      role: 'staff',
      programIds: [softSkillsId, jobReadinessId],
    }));
  });

  it('uses the shared role selector and preserves explicit program assignments for admins', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <AccountModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    await screen.findByText('Automatically available: Drop In');
    await user.type(screen.getByLabelText('First Name *'), 'Avery');
    await user.type(screen.getByLabelText('Last Name *'), 'Admin');
    await user.type(screen.getByLabelText('Email *'), 'avery@example.com');
    await user.click(screen.getByRole('checkbox', { name: 'Soft Skills' }));
    await user.click(screen.getByRole('button', { name: 'Role' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Admin' }));

    expect(screen.getByRole('checkbox', { name: 'Soft Skills' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Send Invite' }));
    await waitFor(() => expect(inviteAccount).toHaveBeenCalledWith(expect.objectContaining({
      role: 'admin',
      programIds: [softSkillsId],
    })));
  });
});
