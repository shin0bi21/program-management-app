import { youthData, getYouthSortValue } from '../../../../Youth/hooks/data/useYouthData';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeYouthProfile } from '../../../../../tests/factories/youth';
import type { ProgramCycleAssignment } from '../../types';
import { deleteProgramCycle } from '../../api/cycles.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import type { Program } from '../../../../../common/features/programs/types';
import { referenceDataKeys } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import useProgramsActions from './useProgramsActions';

vi.mock('../../api/cycles.api', () => ({
  deleteProgramCycle: vi.fn(),
}));

const cycle = {
  id: 'cycle-1',
  name: 'Fall 2026',
  startsOn: '2026-09-01',
  endsOn: '2027-01-31',
  state: 'upcoming' as const,
};

describe('useProgramsActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reconciles edited rows and selection while keeping list position, membership, and unrelated references', () => {
    const client = createTestQueryClient();
    const program: Program = {
      id: 'program-1', name: 'Alpha', enrollmentRequired: true, minAge: 12, maxAge: 15,
      defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
    };
    const other = { ...program, id: 'program-2', name: 'Beta' };
    const tableKey = ['programs', 'table'];
    const assignedKey = [...tableKey, { assignedOnly: true }];
    const allKey = [...tableKey, { assignedOnly: false }];
    client.setQueryData(assignedKey, { pages: [{ rows: [program, other], nextCursor: 'next' }], pageParams: [null] });
    client.setQueryData(allKey, { pages: [{ rows: [other], nextCursor: null }], pageParams: [null] });
    const unrelatedList = client.getQueryData(allKey);
    const derivedKeys = [['programs', 'options'], ['programs', 'cycle-assignments'], referenceDataKeys.programs(false), referenceDataKeys.programs(true), referenceDataKeys.sessionScheduling];
    derivedKeys.forEach(key => client.setQueryData(key, []));
    const onProgramSynced = vi.fn();
    const { result } = renderHook(() => useProgramsActions({
      programTableQueryKey: tableKey, onProgramSynced, onCycleDeleted: vi.fn(),
    }), { wrapper: createQueryClientWrapper(client) });
    const saved = { ...program, name: 'Zulu' };
    const programCycle: ProgramCycleAssignment = {
      programId: program.id, program: saved.name, enrollmentRequired: true,
      minAge: 12, maxAge: 15, cycleId: 'cycle-1', cycle: 'Fall', startsOn: '2026-09-01', endsOn: '2027-01-31', state: 'active', enrolledCount: 1,
      nextSessionAt: null, nextSessionId: null, averageAttendance: null,
      attendanceAttendedCount: 0, attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
    };
    const youth = makeYouthProfile();
    const savedYouth = { ...youth, lastName: 'Canonical returned youth' };
    client.setQueryData(['programs', 'cycle-assignments', { programId: program.id }], [{ ...programCycle, program: 'Alpha' }]);
    const youthKey = ['youth', 'table', {}, { key: 'lastName', direction: 'asc' }];
    client.setQueryData(youthKey, { pages: [{ rows: [{ id: youth.id, sortValue: getYouthSortValue(youth, 'lastName') }], nextCursor: null }], pageParams: [null] });

    act(() => result.current.syncProgram({ program: saved, updatedProgramCycles: [programCycle], removedProgramCycles: [], createdProgramCycles: [], updatedYouth: [savedYouth] }, 'update'));

    const updated = client.getQueryData<{ pages: { rows: Program[]; nextCursor: string }[] }>(assignedKey)!;
    expect(updated.pages[0].rows).toEqual([saved, other]);
    expect(updated.pages[0].rows[1]).toBe(other);
    expect(updated.pages[0].nextCursor).toBe('next');
    expect(client.getQueryData(allKey)).toBe(unrelatedList);
    [assignedKey, allKey].forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(false));
    expect(onProgramSynced).toHaveBeenCalledWith(saved);
    expect(client.getQueryData(['programs', 'cycle-assignments', { programId: program.id }])).toEqual([programCycle]);
    expect(client.getQueryData(youthKey)).toEqual({ pages: [{ rows: [{ id: youth.id, sortValue: getYouthSortValue(savedYouth, 'lastName') }], nextCursor: null }], pageParams: [null] });
    expect(youthData.get(client, youth.id)).toEqual(savedYouth);
    expect(client.getQueryState(['programs', 'cycle-assignments', { programId: program.id }])?.isInvalidated).toBe(true);
    expect(client.getQueryState(youthKey)?.isInvalidated).toBe(false);

    derivedKeys.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
  });

  it('invalidates only program table and derived queries after creation', () => {
    const client = createTestQueryClient();
    const tableKey = ['programs', 'table'];
    const rows = { pages: [{ rows: [], nextCursor: null }], pageParams: [null] };
    client.setQueryData(tableKey, rows);
    client.setQueryData(['programs', 'unrelated'], []);
    const onProgramSynced = vi.fn();
    const { result } = renderHook(() => useProgramsActions({
      programTableQueryKey: tableKey, onProgramSynced, onCycleDeleted: vi.fn(),
    }), { wrapper: createQueryClientWrapper(client) });
    const program: Program = {
      id: 'program-1', name: 'New program', enrollmentRequired: true, minAge: null, maxAge: null,
      defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
    };

    act(() => result.current.syncProgram({ program, updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] }, 'create'));

    expect(client.getQueryData(tableKey)).toBe(rows);
    expect(client.getQueryState(tableKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(['programs', 'unrelated'])?.isInvalidated).toBe(false);
    expect(onProgramSynced).not.toHaveBeenCalled();
  });

  it('reconciles an edited cycle and programCycle rows without refetching their tables', () => {
    const client = createTestQueryClient();
    const key = ['cycles', 'table'];
    client.setQueryData(key, { pages: [{ rows: [cycle], nextCursor: null }], pageParams: [null] });
    const { result } = renderHook(() => useProgramsActions({
      programTableQueryKey: ['programs', 'table'], onProgramSynced: vi.fn(), onCycleDeleted: vi.fn(),
    }), { wrapper: createQueryClientWrapper(client) });
    client.setQueryData(referenceDataKeys.cycles, [cycle]);
    const saved = { ...cycle, name: 'Updated cycle' };

    act(() => result.current.syncCycle({ cycle: saved, updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] }, 'update'));

    expect(client.getQueryData(key)).toEqual({ pages: [{ rows: [saved], nextCursor: null }], pageParams: [null] });
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    expect(client.getQueryData(referenceDataKeys.cycles)).toEqual([saved]);
  });

  it('deletes the requested cycle and reconciles the returned identity', async () => {
    vi.mocked(deleteProgramCycle).mockResolvedValue({ id: cycle.id });
    const onCycleDeleted = vi.fn();
    const { result } = renderHook(() => useProgramsActions({ programTableQueryKey: ['programs', 'table'], onProgramSynced: vi.fn(), onCycleDeleted }), { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    act(() => result.current.requestCycleDeletion(cycle));
    await act(async () => result.current.confirmAction?.onConfirm());

    expect(deleteProgramCycle).toHaveBeenCalledWith(cycle.id);
    expect(onCycleDeleted).toHaveBeenCalledWith(cycle.id);
  });

  it('does not reconcile when deletion fails', async () => {
    vi.mocked(deleteProgramCycle).mockRejectedValue(new Error('Cycle is in use'));
    const onCycleDeleted = vi.fn();
    const { result } = renderHook(() => useProgramsActions({ programTableQueryKey: ['programs', 'table'], onProgramSynced: vi.fn(), onCycleDeleted }), { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    act(() => result.current.requestCycleDeletion(cycle));
    await expect(result.current.confirmAction?.onConfirm()).rejects.toThrow('Cycle is in use');
    expect(onCycleDeleted).not.toHaveBeenCalled();
  });
});
