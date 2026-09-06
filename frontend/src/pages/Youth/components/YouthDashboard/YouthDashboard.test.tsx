import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeYouthProfile } from '../../../../tests/factories/youth';
import YouthDashboard from './YouthDashboard';

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
      canManageAttendance={false}
      onManageAttendance={vi.fn()}
      canViewAttendanceReport={false}
      onViewAttendanceReport={vi.fn()}
      profileNotes={[]}
      profileNotesLoading={false}
      profileNotesError={null}
      onSelectProfileNote={vi.fn()}
      onAddProfileNote={vi.fn()}
      onEditProfileNote={vi.fn()}
      onDeleteProfileNote={vi.fn()}
    />);

    expect(screen.getByRole('heading', { name: 'Primary Contact' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Manage primary contact' }));
    expect(onManagePrimaryContact).toHaveBeenCalledWith(profile);
  });
});
