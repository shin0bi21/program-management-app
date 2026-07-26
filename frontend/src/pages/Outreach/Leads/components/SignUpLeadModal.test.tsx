import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCohorts } from '../../../../common/api/cohorts.api';
import { signUpLead } from '../api/leads.api';
import type { Lead } from '../types';
import SignUpLeadModal from './SignUpLeadModal';

vi.mock('../../../../common/api/cohorts.api', () => ({
  getCohorts: vi.fn(),
}));

vi.mock('../api/leads.api', () => ({
  signUpLead: vi.fn(),
}));

const lead: Lead = {
  id: 'lead-1',
  origin: 'staff_created',
  expressionOfInterestId: null,
  convertedYouthId: null,
  youthFirstName: 'Avery',
  youthLastName: 'Outreach',
  age: 14,
  school: 'Test School',
  programOfInterestId: 'program-1',
  programOfInterestName: 'Soft Skills',
  contactFirstName: 'Jordan',
  contactLastName: 'Outreach',
  contactPhoneNumber: '416-555-0142',
  contactRelationship: 'guardian',
  discoverySource: 'online',
  notes: null,
  status: 'new',
  statusUpdatedAt: '2026-07-24T12:00:00.000Z',
  createdAt: '2026-07-24T12:00:00.000Z',
};

const cohort = {
  id: 'cohort-1',
  programId: 'program-1',
  programName: 'Soft Skills',
  rosterMode: 'enrolled' as const,
  minAge: 12,
  maxAge: 15,
  name: 'Summer 2026',
  startsOn: '2026-06-30',
  endsOn: '2026-08-31',
  state: 'active' as const,
  enrolledCount: 10,
  nextSessionAt: null,
  nextSessionId: null,
  averageAttendance: null,
  attendanceAttendedCount: 0,
  attendanceRecordedCount: 0,
  uniqueAttendeeCount: 0,
};

describe('SignUpLeadModal', () => {
  beforeEach(() => {
    vi.mocked(getCohorts).mockResolvedValue([
      cohort,
      { ...cohort, id: 'cohort-completed', name: 'Spring 2026', state: 'completed' },
      { ...cohort, id: 'cohort-open', name: 'Drop In', rosterMode: 'open' },
    ]);
    vi.mocked(signUpLead).mockResolvedValue(lead);
  });

  it('loads matching cohorts and reports a successful enrollment', async () => {
    const onSuccess = vi.fn();
    render(<SignUpLeadModal lead={lead} onClose={vi.fn()} onSuccess={onSuccess} />);

    const cohortSelect = screen.getByRole('button', { name: 'Cohort enrollment' });
    await waitFor(() => expect(cohortSelect).toBeEnabled());
    fireEvent.click(cohortSelect);
    const cohortOption = await screen.findByRole('menuitemradio', { name: /Soft Skills — Summer 2026/ });
    expect(cohortOption).toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: /Spring 2026/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: /Drop In/ })).not.toBeInTheDocument();
    expect(getCohorts).toHaveBeenCalledWith('program-1');

    fireEvent.click(cohortOption);
    fireEvent.click(screen.getByRole('button', { name: 'Create Profile' }));

    await waitFor(() => expect(signUpLead).toHaveBeenCalledWith('lead-1', 'cohort-1'));
    expect(onSuccess).toHaveBeenCalled();
    expect(await screen.findByText(
      'Youth profile successfully created and added to Soft Skills - Summer 2026.',
    )).toBeInTheDocument();
  });

  it('quietly excludes cohorts outside the lead age range', async () => {
    const user = {
      ...lead,
      age: 16,
    };
    render(<SignUpLeadModal lead={user} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', {
      name: 'Cohort enrollment',
    })).toBeEnabled());
    expect(screen.queryByText(/Filter cohorts by age/)).not.toBeInTheDocument();
    expect(screen.getByText(
      'No cohorts match this youth’s age. Create the profile now and manage cohorts later.',
    )).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cohort enrollment' }));

    expect(screen.queryByRole('menuitemradio', {
      name: /Soft Skills — Summer 2026/,
    })).not.toBeInTheDocument();
  });
});
