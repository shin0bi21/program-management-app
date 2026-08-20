// Owns the rendered signup choices and their wiring to the modal workflow.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCohorts } from '../../../../../common/features/programming/api/cohorts.api';
import { signUpLead } from '../../leads.api';
import type { Lead } from '../../types';
import SignUpLeadModal from './SignUpLeadModal';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';

const LEAD_SIGNUP_COHORTS_QUERY_KEY = ['lead-signup-cohorts'] as const;

vi.mock('../../../../../common/features/programming/api/cohorts.api', () => ({
  getCohorts: vi.fn(),
}));

vi.mock('../../leads.api', () => ({
  signUpLead: vi.fn(),
}));

const lead: Lead = {
  id: 'lead-1',
  origin: 'internal',
  submittedByRole: 'staff',
  convertedYouthId: null,
  youthFirstName: 'Avery',
  youthLastName: 'Outreach',
  age: 14,
  school: 'Test School',
  recommendedProgramId: 'program-1',
  recommendedProgramName: 'Soft Skills',
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
  cycleId: 'cycle-summer-2026',
  cycleName: 'Summer 2026',
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
    vi.clearAllMocks();
    vi.mocked(getCohorts).mockResolvedValue([
      cohort,
      { ...cohort, id: 'cohort-completed', name: 'Spring 2026', state: 'completed' },
      { ...cohort, id: 'cohort-open', name: 'Drop In', rosterMode: 'open' },
    ]);
    vi.mocked(signUpLead).mockResolvedValue(lead);
  });

  it('renders only matching enrollment cohorts', async () => {
    renderWithQueryClient(<SignUpLeadModal queryKey={LEAD_SIGNUP_COHORTS_QUERY_KEY} lead={lead} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const cohortSelect = screen.getByRole('button', { name: 'Cohort enrollment' });
    await waitFor(() => expect(cohortSelect).toBeEnabled());
    expect(screen.queryByText('New youth profile')).not.toBeInTheDocument();
    expect(screen.queryByText(
      'Optional. You can create the profile now and manage cohorts later.',
    )).not.toBeInTheDocument();
    expect(screen.queryByText('Choose a cohort')).not.toBeInTheDocument();
    fireEvent.click(cohortSelect);
    const cohortOption = await screen.findByRole('menuitemradio', { name: /Soft Skills — Summer 2026/ });
    expect(cohortOption).toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: /Spring 2026/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: /Drop In/ })).not.toBeInTheDocument();
    expect(getCohorts).toHaveBeenCalledWith(
      undefined,
      {},
      { signal: expect.any(AbortSignal) },
    );

    fireEvent.click(cohortOption);
    expect(cohortSelect).toHaveTextContent('Soft Skills — Summer 2026');
  });

  it('quietly excludes cohorts outside the lead age range', async () => {
    const user = {
      ...lead,
      age: 16,
    };
    renderWithQueryClient(<SignUpLeadModal queryKey={LEAD_SIGNUP_COHORTS_QUERY_KEY} lead={user} onClose={vi.fn()} onSuccess={vi.fn()} />);

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

  it('asks for a note type when the lead has notes', async () => {
    renderWithQueryClient(<SignUpLeadModal queryKey={LEAD_SIGNUP_COHORTS_QUERY_KEY} lead={{ ...lead, notes: 'Avoid peanuts' }} onClose={vi.fn()} onSuccess={vi.fn()} />);
    const noteType = screen.getByRole('button', { name: 'Type of note' });
    fireEvent.click(noteType);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Health' }));
    const createProfile = screen.getByRole('button', { name: 'Create Profile' });
    await waitFor(() => expect(createProfile).toBeEnabled());
    expect(noteType).toHaveTextContent('Health');
  });

  it('shows successful signup feedback even when optional cohorts failed to load', async () => {
    vi.mocked(getCohorts).mockRejectedValue(new Error('Cohorts unavailable'));
    vi.mocked(signUpLead).mockResolvedValue({ ...lead, status: 'signed_up' });

    renderWithQueryClient(<SignUpLeadModal queryKey={LEAD_SIGNUP_COHORTS_QUERY_KEY} lead={lead} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const createProfile = screen.getByRole('button', { name: 'Create Profile' });
    await waitFor(() => expect(createProfile).toBeEnabled());
    fireEvent.click(createProfile);

    expect(await screen.findByText(
      'Youth profile successfully created for Avery Outreach.',
    )).toBeInTheDocument();
    expect(screen.queryByText('Cohorts unavailable')).not.toBeInTheDocument();
  });
});
