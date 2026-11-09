import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getProgramReferences } from '../../../../../common/features/referenceData/referenceData.api';
import { inviteAccount, updateAccount } from '../../accounts.api';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';
import AccountModal from './AccountModal';

vi.mock('../../../../../common/features/referenceData/referenceData.api', () => ({
  getProgramReferences: vi.fn(),
}));

vi.mock('../../accounts.api', () => ({
  inviteAccount: vi.fn(),
  updateAccount: vi.fn(),
}));

const softSkillsId = '11111111-1111-4111-8111-111111111111';
const jobReadinessId = '44444444-4444-4444-8444-444444444444';
const dropInId = '22222222-2222-4222-8222-222222222222';

describe('AccountModal program assignments', () => {
  beforeEach(() => {
    vi.mocked(getProgramReferences).mockResolvedValue([
      { id: softSkillsId, name: 'Soft Skills' },
      { id: jobReadinessId, name: 'Job Readiness' },
      { id: dropInId, name: 'Drop In' },
    ]);
    vi.mocked(inviteAccount).mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      firstName: 'Sam',
      lastName: 'Staff',
      email: 'sam@example.com',
      role: 'staff',
      status: 'invited',
      createdAt: '2026-07-25T00:00:00.000Z',
      programIds: [softSkillsId, dropInId],
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

  it('submits a project manager invitation from the role selector', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AccountModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText('First Name *'), 'Project');
    await user.type(screen.getByLabelText('Last Name *'), 'Manager');
    await user.type(screen.getByLabelText('Email *'), 'manager@example.com');
    await user.click(screen.getByRole('button', { name: 'Role' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Project Manager' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(inviteAccount).toHaveBeenCalledWith(expect.objectContaining({
      role: 'project_manager', email: 'manager@example.com',
    })));
  });

  it('assigns selected enrolled and open-roster programs', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    renderWithQueryClient(
      <AccountModal
        isOpen
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    expect(await screen.findByRole('checkbox', { name: 'Drop In' })).not.toBeChecked();
    await user.type(screen.getByLabelText('First Name *'), 'Sam');
    await user.type(screen.getByLabelText('Last Name *'), 'Staff');
    await user.type(screen.getByLabelText('Email *'), 'sam@example.com');
    await user.click(screen.getByRole('button', { name: 'Role' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Staff' }));
    await user.click(screen.getByRole('checkbox', { name: 'Soft Skills' }));
    await user.click(screen.getByRole('checkbox', { name: 'Drop In' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(inviteAccount).toHaveBeenCalledWith({
      firstName: 'Sam',
      lastName: 'Staff',
      email: 'sam@example.com',
      role: 'staff',
      programIds: [softSkillsId, dropInId],
    }));
    expect(onSuccess).toHaveBeenCalled();
    expect(screen.getByText('Invitation sent!')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Invite Staff Account' })).toBeInTheDocument();
    expect(screen.getByLabelText('First Name *')).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Soft Skills' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
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
    await user.click(screen.getByRole('checkbox', { name: 'Soft Skills' }));
    await user.click(screen.getByRole('checkbox', { name: 'Job Readiness' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateAccount).toHaveBeenCalledWith({
      id: '33333333-3333-4333-8333-333333333333',
      firstName: 'Sam',
      lastName: 'Staff',
      email: 'sam@example.com',
      role: 'staff',
      programIds: [jobReadinessId],
    }));
  });

  it('uses the shared role selector and preserves explicit program assignments for admins', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <AccountModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    await screen.findByRole('checkbox', { name: 'Drop In' });
    await user.type(screen.getByLabelText('First Name *'), 'Avery');
    await user.type(screen.getByLabelText('Last Name *'), 'Admin');
    await user.type(screen.getByLabelText('Email *'), 'avery@example.com');
    await user.click(screen.getByRole('checkbox', { name: 'Soft Skills' }));
    await user.click(screen.getByRole('button', { name: 'Role' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Admin' }));

    expect(screen.getByRole('checkbox', { name: 'Soft Skills' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(inviteAccount).toHaveBeenCalledWith(expect.objectContaining({
      role: 'admin',
      programIds: [softSkillsId],
    })));
  });
});
