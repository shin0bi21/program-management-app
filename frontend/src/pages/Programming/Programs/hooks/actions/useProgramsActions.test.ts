import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  title: 'Fall 2026',
  startsOn: '2026-09-01',
  endsOn: '2027-01-31',
  state: 'upcoming' as const,
};

describe('useProgramsActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates the selected program and refreshes its affected references', () => {
    const client = createTestQueryClient();
    const program: Program = {
      id: 'program-1', title: 'Alpha', enrollmentRequired: true, minAge: 12, maxAge: 15,
      defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
    };
    const tableKey = ['programs', 'table'];
    const derivedKeys = [['programs', 'options'], ['programs', 'cycle-assignments'], referenceDataKeys.programs(false), referenceDataKeys.programs(true), referenceDataKeys.sessionScheduling];
    derivedKeys.forEach(key => client.setQueryData(key, []));
    const onProgramSynced = vi.fn();
    const { result } = renderHook(() => useProgramsActions({
      programTableQueryKey: tableKey, onProgramSynced, onCycleDeleted: vi.fn(),
    }), { wrapper: createQueryClientWrapper(client) });
    const saved = { ...program, title: 'Zulu' };
    act(() => result.current.syncProgram({ program: saved, updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] }, 'update'));

    expect(onProgramSynced).toHaveBeenCalledWith(saved);
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
      id: 'program-1', title: 'New program', enrollmentRequired: true, minAge: null, maxAge: null,
      defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
    };

    act(() => result.current.syncProgram({ program, updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] }, 'create'));

    expect(client.getQueryData(tableKey)).toBe(rows);
    expect(client.getQueryState(tableKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(['programs', 'unrelated'])?.isInvalidated).toBe(false);
    expect(onProgramSynced).not.toHaveBeenCalled();
  });

  it('updates cycle choices from the saved response', () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useProgramsActions({
      programTableQueryKey: ['programs', 'table'], onProgramSynced: vi.fn(), onCycleDeleted: vi.fn(),
    }), { wrapper: createQueryClientWrapper(client) });
    client.setQueryData(referenceDataKeys.cycles, [cycle]);
    const saved = { ...cycle, title: 'Updated cycle' };

    act(() => result.current.syncCycle({ cycle: saved, updatedProgramCycles: [], removedProgramCycles: [], createdProgramCycles: [] }, 'update'));

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
