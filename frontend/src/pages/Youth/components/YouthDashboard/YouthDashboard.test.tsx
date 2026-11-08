import { fireEvent, screen } from '@testing-library/react';
import { renderWithQueryClient as render } from '../../../../tests/queryClientTestUtils';
import { describe, expect, it, vi } from 'vitest';

import { makeYouthProfile } from '../../../../tests/factories/youth';
import YouthDashboard from './YouthDashboard';

vi.mock('../../youth.api', () => ({ getYouthProfileNotes: vi.fn().mockResolvedValue([]) }));

const profile = makeYouthProfile({
  contacts: [{
    id: 'contact-1',
    phoneNumber: '555-0100',
    type: 'guardian',
  }],
});

describe('YouthDashboard', () => {
  it('renders the selected profile dashboard and delegates primary-contact management', () => {
    const onManagePrimaryContact = vi.fn();
    render(<YouthDashboard
      profile={profile}
      canWrite
      onManagePrimaryContact={onManagePrimaryContact}
      canReadAttendance={false}
      canManageAttendance={false}
      onManageAttendance={vi.fn()}
      canViewAttendanceReport={false}
      onViewAttendanceReport={vi.fn()}
      onSelectProfileNote={vi.fn()}
      onAddProfileNote={vi.fn()}
      onEditProfileNote={vi.fn()}
      onDeleteProfileNote={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Manage primary contact' }));
    expect(onManagePrimaryContact).toHaveBeenCalledWith(profile);
  });
});
