import { createTestQueryClient, createQueryClientWrapper } from '../../../../tests/queryClientTestUtils';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { deleteLead, updateLeadStatus } from '../../leads.api';
import type { Lead } from '../../types';
import type { ProgramCycleAssignment } from '../../../Programming/Programs/types';
import useLeadActions from './useLeadActions';

vi.mock('../../leads.api', () => ({ deleteLead: vi.fn(), updateLeadStatus: vi.fn() }));

const lead = { id: 'lead-1', youthFirstName: 'Avery', youthLastName: 'Outreach', status: 'new', school: 'Central', createdAt: '2026-01-01' } as Lead;
const otherLead = { ...lead, id: 'lead-2', youthFirstName: 'Sam', youthLastName: 'Stable' } as Lead;
const tableKey = ['leads', 'table', 'external'] as const;

/**
 * Seeds complete lead rows in a loaded table query.
 * @param client - Isolated query cache for this example.
 * @param rows - Complete saved leads included in the variant.
 * @example const variantKey = seedVariant(client, [lead])
 */
function seedVariant(client: QueryClient, rows: Lead[]) {
  const queryKey = [...tableKey, { search: 'variant' }, { key: 'firstName', direction: 'asc' }];
  client.setQueryData(queryKey, { pages: [{ rows, nextCursor: null }], pageParams: [undefined] });
  return queryKey;
}

/**
 * Creates an isolated query cache and React provider for an action example.
 * @example const { client, wrapper } = setup()
 */
function setup() {
  const client = createTestQueryClient();
  const wrapper = createQueryClientWrapper(client);
  return { client, wrapper };
}

beforeEach(() => vi.clearAllMocks());

it('updates the saved lead row and selected context after a status save', async () => {
  const { client, wrapper } = setup();
  seedVariant(client, [lead, otherLead]);
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const onLeadSynced = vi.fn();
  const savedLead = { ...lead, status: 'contacted' } as Lead;
  vi.mocked(updateLeadStatus).mockResolvedValue(savedLead);
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey, onLeadSynced }), { wrapper });

  await act(async () => result.current.setStatus(lead, 'contacted'));

  expect(onLeadSynced).toHaveBeenCalledWith(savedLead);
  expect(invalidate).not.toHaveBeenCalledWith({ queryKey: tableKey });
  expect(updateLeadStatus).toHaveBeenCalledWith(lead.id, 'contacted');
});

it('removes the lead row and clears selected context after a confirmed delete', async () => {
  const { client, wrapper } = setup();
  seedVariant(client, [lead, otherLead]);
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const onLeadRemoved = vi.fn();
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey, onLeadRemoved }), { wrapper });

  act(() => result.current.requestDelete(lead));
  await act(async () => result.current.confirmAction?.onConfirm());

  expect(deleteLead).toHaveBeenCalledWith(lead.id);
  expect(onLeadRemoved).toHaveBeenCalledWith(lead.id);
  expect(invalidate).not.toHaveBeenCalledWith({ queryKey: tableKey });
});

it('updates signup context and invalidates affected collections', async () => {
  const { client, wrapper } = setup();
  seedVariant(client, [lead, otherLead]);
  const programCycle: ProgramCycleAssignment = {
    programId: 'program-1', program: 'Future Ready', enrollmentRequired: true,
    minAge: 12, maxAge: 15, cycleId: 'cycle-1', cycle: 'Summer', startsOn: '2026-06-30', endsOn: '2026-08-31', state: 'active', enrolledCount: 1,
    nextSessionAt: null, nextSessionId: null, averageAttendance: null,
    attendanceAttendedCount: 0, attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
  };
  const programCycleVariant = ['programs', 'cycle-assignments', { programId: 'program-1' }];
  const untouched = { ...programCycle, cycleId: 'cycle-2' };
  client.setQueryData(programCycleVariant, [{ ...programCycle, enrolledCount: 0 }, untouched]);
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const onLeadSynced = vi.fn();
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey, onLeadSynced }), { wrapper });
  const signedUp = { ...lead, status: 'signed_up' as const, convertedYouthId: 'youth-1' };

  await act(async () => result.current.reconcileSignUp({ lead: signedUp, updatedProgramCycle: programCycle }));

  expect(onLeadSynced).toHaveBeenCalledWith(signedUp);
  expect(client.getQueryData<ProgramCycleAssignment[]>(programCycleVariant)).toEqual([programCycle, untouched]);
  expect(client.getQueryData<ProgramCycleAssignment[]>(programCycleVariant)?.[1]).toBe(untouched);
  expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
    ['youth', 'table'], ['programs', 'cycle-assignments'],
  ]);
});
