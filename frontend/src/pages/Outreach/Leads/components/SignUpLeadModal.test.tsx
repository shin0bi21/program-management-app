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
};

describe('SignUpLeadModal', () => {
  beforeEach(() => {
    vi.mocked(getCohorts).mockResolvedValue([
      cohort,
      { ...cohort, id: 'cohort-completed', name: 'Spring 2026', state: 'completed' },
    ]);
    vi.mocked(signUpLead).mockResolvedValue(lead);
  });

  it('loads matching cohorts and reports a successful enrollment', async () => {
    const onSuccess = vi.fn();
    render(<SignUpLeadModal lead={lead} onClose={vi.fn()} onSuccess={onSuccess} />);

    expect(await screen.findByRole('option', { name: /Soft Skills — Summer 2026/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Spring 2026/ })).not.toBeInTheDocument();
    expect(getCohorts).toHaveBeenCalledWith('program-1');

    fireEvent.change(screen.getByLabelText('Cohort enrollment'), { target: { value: 'cohort-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    await waitFor(() => expect(signUpLead).toHaveBeenCalledWith('lead-1', 'cohort-1'));
    expect(onSuccess).toHaveBeenCalled();
    expect(await screen.findByText(
      'Youth profile successfully created and added to Soft Skills - Summer 2026.',
    )).toBeInTheDocument();
  });
});
