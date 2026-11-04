// @vitest-environment node
import { expect, it } from 'vitest';
import { createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import type { ProgramCycleAssignment } from '../../types';
import { PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY, syncProgramCycleAssignmentChanges } from './programCycleAssignmentCache';

it('reconciles saved assignments in existing list variants and refreshes assignment membership', () => {
  const client = createTestQueryClient();
  const old = { programId: 'program-1', cycleId: 'edited', cycleName: 'Alpha' } as ProgramCycleAssignment;
  const other = { programId: 'program-1', cycleId: 'other', cycleName: 'Beta' } as ProgramCycleAssignment;
  const removed = { programId: 'program-1', cycleId: 'removed', cycleName: 'Gamma' } as ProgramCycleAssignment;
  const key = [...PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY, { programId: 'program-1' }];
  const unrelatedKey = [...PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY, { programId: 'program-2' }];
  client.setQueryData(key, [old, other, removed]);
  const sameCycleOtherProgram = { ...old, programId: 'program-2' };
  const removedCycleOtherProgram = { ...removed, programId: 'program-2' };
  client.setQueryData(unrelatedKey, [sameCycleOtherProgram, removedCycleOtherProgram]);
  const saved = { ...old, cycleName: 'Zulu' };

  syncProgramCycleAssignmentChanges(client, { updatedProgramCycles: [saved], removedProgramCycles: [removed], createdProgramCycles: [] });

  expect(client.getQueryData(key)).toEqual([saved, other]);
  expect(client.getQueryData<ProgramCycleAssignment[]>(key)?.[1]).toBe(other);
  expect(client.getQueryData(unrelatedKey)).toEqual([sameCycleOtherProgram, removedCycleOtherProgram]);
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
});
