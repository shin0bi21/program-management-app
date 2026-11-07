import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProgramCycleAssignments } from '../../../Programming/Programs/api/programCycleAssignments.api';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../tests/queryClientTestUtils';

import { signUpLead } from '../../leads.api';
import { getDateKeyInTimeZone } from '../../../../common/utils/date';
import type { Lead } from '../../types';
import useSignUpLeadModal from './useSignUpLeadModal';

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
  notes: 'Follow up with guardian.',
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
  averageAttendance: null,
  attendanceAttendedCount: 0,
  attendanceRecordedCount: 0,
  uniqueAttendeeCount: 0,
};

const queryKey = ['lead-signup-programCycles'] as const;

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
    vi.mocked(getProgramCycleAssignments).mockResolvedValue([
      programCycle,
      { ...programCycle, cycleId: 'programCycle-too-old', minAge: 16, maxAge: 18 },
      { ...programCycle, cycleId: 'programCycle-completed', state: 'completed' },
      { ...programCycle, cycleId: 'programCycle-open', enrollmentRequired: false },
    ]);
    vi.mocked(signUpLead).mockResolvedValue({ lead: { ...lead, status: 'signed_up' } });
  });

  it('loads active enrollment programCycles and applies the lead age boundary', async () => {
    const { result } = renderWorkflow(lead);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getProgramCycleAssignments).toHaveBeenCalledWith(
      undefined,
      {},
      { signal: expect.any(AbortSignal) },
    );
    expect(result.current.programCycles.map(item => item.cycleId)).toEqual([
      'cycle-summer-2026',
      'programCycle-too-old',
    ]);
    expect(result.current.visibleProgramCycles.map(item => item.cycleId)).toEqual(['cycle-summer-2026']);

    act(() => result.current.changeDateOfBirth(`${new Date().getFullYear() - 16}-01-01`));
    expect(result.current.visibleProgramCycles.map(item => item.cycleId)).toEqual(['programCycle-too-old']);
  });

  it('submits the selected programCycle and note category before reporting success', async () => {
    const onSuccess = vi.fn();
    const updatedLead = { ...lead, status: 'signed_up' as const };
    vi.mocked(signUpLead).mockResolvedValue({ lead: updatedLead });
    const { result } = renderWorkflow(lead, onSuccess);
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.selectProgramCycle(`${programCycle.programId}:${programCycle.cycleId}`);
      result.current.selectNoteCategory('health');
    });
    await act(() => result.current.submit());

    expect(signUpLead).toHaveBeenCalledWith('lead-1', { programId: 'program-1', cycleId: 'cycle-summer-2026' }, 'health', lead.dateOfBirth);
    expect(onSuccess).toHaveBeenCalledWith({ lead: updatedLead });
    expect(result.current.submitStatus).toBe('success');
    expect(result.current.statusMessage).toBe(
      'Youth profile successfully created and added to Future Ready - Summer 2026.',
    );
  });

  it('requires a real DOB for legacy leads and sends the entered date to signup', async () => {
    const { result } = renderWorkflow({ ...lead, dateOfBirth: null, age: null });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.dateOfBirth).toBe('');
    expect(result.current.age).toBeNull();
    expect(result.current.visibleProgramCycles).toEqual([]);

    await act(() => result.current.submit());
    expect(signUpLead).not.toHaveBeenCalled();
    expect(result.current.statusMessage).toBe('Date of birth is required');

    act(() => result.current.changeDateOfBirth(getDateKeyInTimeZone()));
    await act(() => result.current.submit());
    expect(signUpLead).not.toHaveBeenCalled();
    expect(result.current.statusMessage).toBe('Date of birth must be before today');

    act(() => result.current.changeDateOfBirth(`${new Date().getFullYear() - 16}-01-01`));
    expect(result.current.visibleProgramCycles.map(item => item.cycleId)).toEqual(['programCycle-too-old']);
    act(() => result.current.selectProgramCycle('program-1:programCycle-too-old'));
    await act(() => result.current.submit());
    expect(signUpLead).toHaveBeenCalledWith('lead-1', { programId: 'program-1', cycleId: 'programCycle-too-old' }, 'general', `${new Date().getFullYear() - 16}-01-01`);
  });

  it('allows profile signup outside all programCycle age bounds without enrolling', async () => {
    const { result } = renderWorkflow(lead);
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.selectProgramCycle(`${programCycle.programId}:${programCycle.cycleId}`));
    act(() => result.current.changeDateOfBirth('2000-01-01'));
    expect(result.current.selectedPairKey).toBe('');
    expect(result.current.visibleProgramCycles).toEqual([]);
    await act(() => result.current.submit());
    expect(signUpLead).toHaveBeenCalledWith('lead-1', null, 'general', '2000-01-01');
  });

  it('starts a different lead with a clean draft', async () => {
    const view = renderWorkflow(lead);
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    act(() => {
      view.result.current.selectProgramCycle(`${programCycle.programId}:${programCycle.cycleId}`);
      view.result.current.selectNoteCategory('health');
    });

    view.rerender({ target: { ...lead, id: 'lead-2' } });

    await waitFor(() => expect(view.result.current.selectedPairKey).toBe(''));
    expect(view.result.current.noteCategory).toBe('general');
    expect(view.result.current.submitStatus).toBe('idle');
  });

  it('shows an API failure and permits a retry', async () => {
    vi.mocked(signUpLead)
      .mockRejectedValueOnce(new Error('Signup unavailable'))
      .mockResolvedValueOnce({ lead: { ...lead, status: 'signed_up' } });
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
