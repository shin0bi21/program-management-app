import { createTestQueryClient, createQueryClientWrapper } from '../../../../tests/queryClientTestUtils';
import type { QueryClient } from '@tanstack/react-query';
import type { RecordListIndex } from '../../../../query/createRecordStore';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { deleteLead, updateLeadStatus } from '../../leads.api';
import type { Lead } from '../../types';
import type { ProgramCycleAssignment } from '../../../Programming/Programs/types';
import useLeadActions from './useLeadActions';
import { leadData, getLeadSortValue } from '../data/useLeadData';

vi.mock('../../leads.api', () => ({ deleteLead: vi.fn(), updateLeadStatus: vi.fn() }));

const lead = { id: 'lead-1', youthFirstName: 'Avery', youthLastName: 'Outreach', status: 'new', school: 'Central', createdAt: '2026-01-01' } as Lead;
const otherLead = { ...lead, id: 'lead-2', youthFirstName: 'Sam', youthLastName: 'Stable' } as Lead;
const tableKey = ['leads', 'table', 'external'] as const;

/**
 * Seeds saved leads and a loaded table variant containing their membership indexes.
 * @param client - Isolated query cache for this example.
 * @param rows - Complete saved leads included in the variant.
 * @example const variantKey = seedVariant(client, [lead])
 */
function seedVariant(client: QueryClient, rows: Lead[]) {
  const queryKey = [...tableKey, { search: 'variant' }, { key: 'firstName', direction: 'asc' }];
  rows.forEach(row => leadData.write(client, row));
  const indexes = rows.map(row => ({ id: row.id, sortValue: getLeadSortValue(row, 'firstName') }));
  client.setQueryData(queryKey, { pages: [{ rows: indexes, nextCursor: null }], pageParams: [undefined] });
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

it('reconciles a direct status response across the lead table and selection', async () => {
  const { client, wrapper } = setup();
  const variantKey = seedVariant(client, [lead, otherLead]);
  const savedLead = { ...lead, status: 'contacted' } as Lead;
  vi.mocked(updateLeadStatus).mockResolvedValue(savedLead);
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey }), { wrapper });

  await act(async () => result.current.setStatus(lead, 'contacted'));

  expect(client.getQueryData<{ pages: { rows: RecordListIndex[] }[] }>(variantKey)?.pages[0].rows).toEqual([savedLead, otherLead].map(row => ({ id: row.id, sortValue: getLeadSortValue(row, 'firstName') })));
  expect(leadData.get(client, lead.id)).toEqual(savedLead);
  expect(updateLeadStatus).toHaveBeenCalledWith(lead.id, 'contacted');
});

it('removes a confirmed lead from cached table variants', async () => {
  const { client, wrapper } = setup();
  const variantKey = seedVariant(client, [lead, otherLead]);
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey }), { wrapper });

  act(() => result.current.requestDelete(lead));
  await act(async () => result.current.confirmAction?.onConfirm());

  expect(deleteLead).toHaveBeenCalledWith(lead.id);
  expect(client.getQueryData<{ pages: { rows: RecordListIndex[] }[] }>(variantKey)?.pages[0].rows).toEqual([{ id: otherLead.id, sortValue: getLeadSortValue(otherLead, 'firstName') }]);
});

it('reconciles signup rows without refetching existing leads or programCycles and invalidates only the created youth list', async () => {
  const { client, wrapper } = setup();
  const leadVariant = seedVariant(client, [lead, otherLead]);
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
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey }), { wrapper });
  const signedUp = { ...lead, status: 'signed_up' as const, convertedYouthId: 'youth-1' };

  await act(async () => result.current.reconcileSignUp({ lead: signedUp, updatedProgramCycle: programCycle }));

  expect(client.getQueryData<{ pages: { rows: RecordListIndex[] }[] }>(leadVariant)?.pages[0].rows).toEqual([signedUp, otherLead].map(row => ({ id: row.id, sortValue: getLeadSortValue(row, 'firstName') })));
  expect(client.getQueryData<ProgramCycleAssignment[]>(programCycleVariant)).toEqual([programCycle, untouched]);
  expect(client.getQueryData<ProgramCycleAssignment[]>(programCycleVariant)?.[1]).toBe(untouched);
  expect(leadData.get(client, lead.id)).toEqual(signedUp);
  expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
    ['youth', 'table'], ['programs', 'cycle-assignments'],
  ]);
});

it('ignores a status response after the account cache is cleared', async () => {
  const { client, wrapper } = setup();
  seedVariant(client, [lead]);
  let resolveStatus!: (saved: Lead) => void;
  vi.mocked(updateLeadStatus).mockImplementation(() => new Promise(resolve => { resolveStatus = resolve; }));
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey }), { wrapper });
  let pending!: Promise<void>;
  act(() => { pending = result.current.setStatus(lead, 'contacted'); });
  act(() => client.clear());

  await act(async () => {
    resolveStatus({ ...lead, status: 'contacted' });
    await pending;
  });

  expect(leadData.get(client, lead.id)).toBeUndefined();
});
