// Owns signup target reset, cohort eligibility, command payloads, and reconciliation outcomes.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCohorts } from '../../../../../common/features/programming/api/cohorts.api';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../../tests/queryClientTestUtils';

import { signUpLead } from '../../leads.api';
import type { Lead } from '../../types';
import useSignUpLeadModal from './useSignUpLeadModal';

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
  notes: 'Follow up with guardian.',
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

const queryKey = ['lead-signup-cohorts'] as const;

function renderWorkflow(currentLead: Lead | null, onSuccess = vi.fn()) {
  const queryClient = createTestQueryClient();
  return renderHook(
    ({ target }) => useSignUpLeadModal({ queryKey, lead: target, onSuccess }),
    {
      initialProps: { target: currentLead },
      wrapper: createQueryClientWrapper(queryClient),
    },
  );
}

describe('useSignUpLeadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCohorts).mockResolvedValue([
      cohort,
      { ...cohort, id: 'cohort-too-old', minAge: 16, maxAge: 18 },
      { ...cohort, id: 'cohort-completed', state: 'completed' },
      { ...cohort, id: 'cohort-open', rosterMode: 'open' },
    ]);
    vi.mocked(signUpLead).mockResolvedValue({ ...lead, status: 'signed_up' });
  });

  it('loads active enrollment cohorts and applies the lead age boundary', async () => {
    const { result } = renderWorkflow(lead);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getCohorts).toHaveBeenCalledWith(
      undefined,
      {},
      { signal: expect.any(AbortSignal) },
    );
    expect(result.current.cohorts.map(item => item.id)).toEqual([
      'cohort-1',
      'cohort-too-old',
    ]);
    expect(result.current.visibleCohorts.map(item => item.id)).toEqual(['cohort-1']);
  });

  it('submits the selected cohort and note category before reporting success', async () => {
    const onSuccess = vi.fn();
    const updatedLead = { ...lead, status: 'signed_up' as const };
    vi.mocked(signUpLead).mockResolvedValue(updatedLead);
    const { result } = renderWorkflow(lead, onSuccess);
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.selectCohort('cohort-1');
      result.current.selectNoteCategory('health');
    });
    await act(() => result.current.submit());

    expect(signUpLead).toHaveBeenCalledWith('lead-1', 'cohort-1', 'health');
    expect(onSuccess).toHaveBeenCalledWith(updatedLead);
    expect(result.current.submitStatus).toBe('success');
    expect(result.current.statusMessage).toBe(
      'Youth profile successfully created and added to Soft Skills - Summer 2026.',
    );
  });

  it('starts a different lead with a clean draft', async () => {
    const view = renderWorkflow(lead);
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    act(() => {
      view.result.current.selectCohort('cohort-1');
      view.result.current.selectNoteCategory('health');
    });

    view.rerender({ target: { ...lead, id: 'lead-2' } });

    await waitFor(() => expect(view.result.current.cohortId).toBe(''));
    expect(view.result.current.noteCategory).toBe('general');
    expect(view.result.current.submitStatus).toBe('idle');
  });

  it('shows an API failure and permits a retry', async () => {
    vi.mocked(signUpLead)
      .mockRejectedValueOnce(new Error('Signup unavailable'))
      .mockResolvedValueOnce({ ...lead, status: 'signed_up' });
    const { result } = renderWorkflow(lead);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.submit());
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Signup unavailable');

    await act(() => result.current.submit());
    expect(signUpLead).toHaveBeenCalledTimes(2);
    expect(result.current.submitStatus).toBe('success');
  });

  it('keeps a completed signup successful when page reconciliation fails', async () => {
    const { result } = renderWorkflow(
      lead,
      vi.fn().mockRejectedValue(new Error('Refresh failed')),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.submit());

    expect(signUpLead).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
    expect(result.current.statusMessage).toContain('Reload to see it');
  });
});
