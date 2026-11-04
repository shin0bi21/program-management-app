import { createTestQueryClient, createQueryClientWrapper } from '../../../../tests/queryClientTestUtils';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { deleteLead, updateLeadStatus } from '../../leads.api';
import type { Lead } from '../../types';
import type { ProgramCycleAssignment } from '../../../Programming/Programs/types';
import useLeadActions from './useLeadActions';

vi.mock('../../leads.api', () => ({ deleteLead: vi.fn(), updateLeadStatus: vi.fn() }));

const lead = { id: 'lead-1', youthFirstName: 'Avery', youthLastName: 'Outreach', status: 'new' } as Lead;
const otherLead = { id: 'lead-2', youthFirstName: 'Sam', youthLastName: 'Stable' } as Lead;
const tableKey = ['leads', 'external', 'table'] as const;

function seedVariant(client: QueryClient, rows: Lead[]) {
  const queryKey = [...tableKey, { search: 'variant' }];
  client.setQueryData(queryKey, { pages: [{ rows, nextCursor: null }], pageParams: [undefined] });
  return queryKey;
}

function setup() {
  const client = createTestQueryClient();
  const wrapper = createQueryClientWrapper(client);
  return { client, wrapper };
}

beforeEach(() => vi.clearAllMocks());

it('reconciles a direct status response across the lead table and selection', async () => {
  const { client, wrapper } = setup();
  const variantKey = seedVariant(client, [lead, otherLead]);
  const onLeadSynced = vi.fn();
  const savedLead = { ...lead, status: 'contacted' } as Lead;
  vi.mocked(updateLeadStatus).mockResolvedValue(savedLead);
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey, onLeadSynced }), { wrapper });

  await act(async () => result.current.setStatus(lead, 'contacted'));

  expect(client.getQueryData<{ pages: { rows: Lead[] }[] }>(variantKey)?.pages[0].rows).toEqual([savedLead, otherLead]);
  expect(onLeadSynced).toHaveBeenCalledWith(savedLead);
  expect(updateLeadStatus).toHaveBeenCalledWith(lead.id, 'contacted');
});

it('removes a confirmed lead from cached table variants', async () => {
  const { client, wrapper } = setup();
  const variantKey = seedVariant(client, [lead, otherLead]);
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey }), { wrapper });

  act(() => result.current.requestDelete(lead));
  await act(async () => result.current.confirmAction?.onConfirm());

  expect(deleteLead).toHaveBeenCalledWith(lead.id);
  expect(client.getQueryData<{ pages: { rows: Lead[] }[] }>(variantKey)?.pages[0].rows).toEqual([otherLead]);
});

it('reconciles signup rows without refetching existing leads or programCycles and invalidates only the created youth list', async () => {
  const { client, wrapper } = setup();
  const leadVariant = seedVariant(client, [lead, otherLead]);
  const programCycle: ProgramCycleAssignment = {
    programId: 'program-1', programName: 'Future Ready', enrollmentRequired: true,
    minAge: 12, maxAge: 15, cycleId: 'cycle-1', cycleName: 'Summer', startsOn: '2026-06-30', endsOn: '2026-08-31', state: 'active', enrolledCount: 1,
    nextSessionAt: null, nextSessionId: null, averageAttendance: null,
    attendanceAttendedCount: 0, attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
  };
  const programCycleVariant = ['programs', 'cycle-assignments', { programId: 'program-1' }];
  const untouched = { ...programCycle, cycleId: 'cycle-2' };
  client.setQueryData(programCycleVariant, [{ ...programCycle, enrolledCount: 0 }, untouched]);
  const onLeadSynced = vi.fn();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey, onLeadSynced }), { wrapper });
  const signedUp = { ...lead, status: 'signed_up' as const, convertedYouthId: 'youth-1' };

  await act(async () => result.current.reconcileSignUp({ lead: signedUp, updatedProgramCycle: programCycle }));

  expect(client.getQueryData<{ pages: { rows: Lead[] }[] }>(leadVariant)?.pages[0].rows).toEqual([signedUp, otherLead]);
  expect(client.getQueryData<ProgramCycleAssignment[]>(programCycleVariant)).toEqual([programCycle, untouched]);
  expect(client.getQueryData<ProgramCycleAssignment[]>(programCycleVariant)?.[1]).toBe(untouched);
  expect(onLeadSynced).toHaveBeenCalledWith(signedUp);
  expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
    ['youth', 'table'], ['programs', 'cycle-assignments'],
  ]);
});
