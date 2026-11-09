import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDateOfBirthBounds } from '../../../../common/features/youth/dateOfBirth';
import { getProgramCycleAssignments } from '../../../Programming/Programs/api/programCycleAssignments.api';
import { signUpLead } from '../../leads.api';
import type { Lead } from '../../types';
import SignUpLeadModal from './SignUpLeadModal';
import { renderWithQueryClient } from '../../../../tests/queryClientTestUtils';

const LEAD_SIGNUP_COHORTS_QUERY_KEY = ['lead-signup-programCycles'] as const;

vi.mock('../../../Programming/Programs/api/programCycleAssignments.api', () => ({
  getProgramCycleAssignments: vi.fn(),
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
  dateOfBirth: `${new Date().getFullYear() - 14}-01-01`,
  school: 'Test School',
  recommendedProgramId: 'program-1',
  recommendedProgram: 'Future Ready',
  contactPhoneNumber: '416-555-0142',
  contactRelationship: 'guardian',
  discoverySource: 'online',
  notes: null,
  status: 'new',
  statusUpdatedAt: '2026-07-24T12:00:00.000Z',
  createdAt: '2026-07-24T12:00:00.000Z',
};

const programCycle = {
  programId: 'program-1',
  program: 'Future Ready',
  enrollmentRequired: true,
  minAge: 12,
  maxAge: 15,
  cycleId: 'cycle-summer-2026',
  cycle: 'Summer 2026',
  startsOn: '2026-06-30',
  endsOn: '2026-08-31',
  state: 'active' as const,
  enrolledCount: 10,
  nextSessionAt: null,
  nextSessionId: null,
  uniqueAttendeeCount: 0,
};

describe('SignUpLeadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProgramCycleAssignments).mockResolvedValue([
      programCycle,
      { ...programCycle, cycleId: 'programCycle-completed', cycle: 'Spring 2026', state: 'completed' },
      { ...programCycle, cycleId: 'programCycle-open', cycle: 'Drop In', enrollmentRequired: false },
    ]);
    vi.mocked(signUpLead).mockResolvedValue({ lead });
  });

  it('renders only matching enrollment programCycles', async () => {
    renderWithQueryClient(<SignUpLeadModal queryKey={LEAD_SIGNUP_COHORTS_QUERY_KEY} lead={lead} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const programCycleSelect = screen.getByRole('button', { name: 'Program and cycle enrollment' });
    await waitFor(() => expect(programCycleSelect).toBeEnabled());
    expect(screen.queryByText('New youth profile')).not.toBeInTheDocument();
    expect(screen.queryByText(
      'Optional. You can create the profile now and manage enrollment later.',
    )).not.toBeInTheDocument();
    expect(screen.queryByText('Choose a programCycle')).not.toBeInTheDocument();
    fireEvent.click(programCycleSelect);
    const programCycleOption = await screen.findByRole('menuitemradio', { name: /Future Ready — Summer 2026/ });
    expect(programCycleOption).toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: /Spring 2026/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: /Drop In/ })).not.toBeInTheDocument();
    expect(getProgramCycleAssignments).toHaveBeenCalledWith(
      undefined,
      {},
      { signal: expect.any(AbortSignal) },
    );

    fireEvent.click(programCycleOption);
    expect(programCycleSelect).toHaveTextContent('Future Ready — Summer 2026');
  });

  it('shows missing birth date and age without inventing a default', () => {
    renderWithQueryClient(<SignUpLeadModal queryKey={LEAD_SIGNUP_COHORTS_QUERY_KEY} lead={{ ...lead, dateOfBirth: null, age: null }} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByLabelText('Date of Birth *')).toHaveValue('');
    expect(screen.getByLabelText('Date of Birth *')).toBeRequired();
    expect(screen.getByLabelText('Date of Birth *')).not.toHaveAttribute('min');
    expect(screen.getByLabelText('Date of Birth *')).toHaveAttribute('max', getDateOfBirthBounds().max);

    fireEvent.change(screen.getByLabelText('Date of Birth *'), { target: { value: `${new Date().getFullYear() - 16}-01-01` } });
    expect(screen.getByText('16')).toBeInTheDocument();
  });

  it('quietly excludes programCycles outside the lead age range', async () => {
    const user = {
      ...lead,
      age: 16,
      dateOfBirth: `${new Date().getFullYear() - 16}-01-01`,
    };
    renderWithQueryClient(<SignUpLeadModal queryKey={LEAD_SIGNUP_COHORTS_QUERY_KEY} lead={user} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', {
      name: 'Program and cycle enrollment',
    })).toBeEnabled());
    expect(screen.queryByText(/Filter programCycles by age/)).not.toBeInTheDocument();
    expect(screen.getByText(
      'No program cycles match this youth’s age. Create the profile now and manage enrollment later.',
    )).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Program and cycle enrollment' }));

    expect(screen.queryByRole('menuitemradio', {
      name: /Future Ready — Summer 2026/,
    })).not.toBeInTheDocument();
  });

  it('asks for a note type when the lead has notes', async () => {
    renderWithQueryClient(<SignUpLeadModal queryKey={LEAD_SIGNUP_COHORTS_QUERY_KEY} lead={{ ...lead, notes: 'Avoid peanuts' }} onClose={vi.fn()} onSuccess={vi.fn()} />);
    const noteType = screen.getByRole('button', { name: 'Type of note' });
    fireEvent.click(noteType);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Health' }));
    const createProfile = screen.getByRole('button', { name: 'Save' });
    await waitFor(() => expect(createProfile).toBeEnabled());
    expect(noteType).toHaveTextContent('Health');
  });

  it('shows successful signup feedback even when optional programCycles failed to load', async () => {
    vi.mocked(getProgramCycleAssignments).mockRejectedValue(new Error('ProgramCycles unavailable'));
    vi.mocked(signUpLead).mockResolvedValue({ lead: { ...lead, status: 'signed_up' } });

    renderWithQueryClient(<SignUpLeadModal queryKey={LEAD_SIGNUP_COHORTS_QUERY_KEY} lead={lead} onClose={vi.fn()} onSuccess={vi.fn()} />);

    const createProfile = screen.getByRole('button', { name: 'Save' });
    await waitFor(() => expect(createProfile).toBeEnabled());
    fireEvent.click(createProfile);

    expect(await screen.findByText(
      'Youth profile successfully created for Avery Outreach.',
    )).toBeInTheDocument();
    expect(screen.queryByText('ProgramCycles unavailable')).not.toBeInTheDocument();
  });
});
