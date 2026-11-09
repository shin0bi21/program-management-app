// @vitest-environment node
import { expect, it } from 'vitest';
import { createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import type { ProgramCycleAssignment } from '../../types';
import { PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY, syncProgramCycleAssignmentChanges } from './programCycleAssignmentCache';

it('reconciles saved assignments and refreshes membership, cross-program roster eligibility, and attendance summaries', () => {
  const client = createTestQueryClient();
  const old = { programId: 'program-1', cycleId: 'edited', cycle: 'Alpha' } as ProgramCycleAssignment;
  const other = { programId: 'program-1', cycleId: 'other', cycle: 'Beta' } as ProgramCycleAssignment;
  const removed = { programId: 'program-1', cycleId: 'removed', cycle: 'Gamma' } as ProgramCycleAssignment;
  const key = [...PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY, { programId: 'program-1' }];
  const unrelatedKey = [...PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY, { programId: 'program-2' }];
  client.setQueryData(key, [old, other, removed]);
  const sameCycleOtherProgram = { ...old, programId: 'program-2' };
  const removedCycleOtherProgram = { ...removed, programId: 'program-2' };
  client.setQueryData(unrelatedKey, [sameCycleOtherProgram, removedCycleOtherProgram]);
  const attendanceKey = ['youth', 'attendance', 'youth-1'];
  client.setQueryData(attendanceKey, []);
  const saved = { ...old, cycle: 'Zulu' };
  const firstRosterKey = ['programs', 'roster-youth', 'program-1', 'cycle-1'];
  const otherRosterKey = ['programs', 'roster-youth', 'program-2', 'cycle-2'];
  client.setQueryData(firstRosterKey, []);
  client.setQueryData(otherRosterKey, []);

  syncProgramCycleAssignmentChanges(client, { updatedProgramCycles: [saved], removedProgramCycles: [removed], createdProgramCycles: [] });

  expect(client.getQueryData(key)).toEqual([saved, other]);
  expect(client.getQueryData<ProgramCycleAssignment[]>(key)?.[1]).toBe(other);
  expect(client.getQueryData(unrelatedKey)).toEqual([sameCycleOtherProgram, removedCycleOtherProgram]);
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  expect(client.getQueryState(firstRosterKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(otherRosterKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(attendanceKey)?.isInvalidated).toBe(true);
});
