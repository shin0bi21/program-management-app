// Owns independent program and cycle selection across refreshed or filtered row data.
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Program } from '../../../../../common/features/programs/types';
import type { ProgramCycle } from '../../../../../common/types/cohort';
import useProgrammingSelection from './useProgrammingSelection';

const program = { id: 'program-1', name: 'Original program' } as Program;
const cycle = { id: 'cycle-1', name: 'Original cycle' } as ProgramCycle;

describe('useProgrammingSelection', () => {
  it('keeps program and cycle selections independent across refreshed rows', () => {
    const { result, rerender } = renderHook(
      ({ programs, cycles }) => useProgrammingSelection(programs, cycles),
      { initialProps: { programs: [program], cycles: [cycle] } },
    );

    act(() => {
      result.current.programSelection.selectItem(program);
      result.current.cycleSelection.selectItem(cycle);
    });

    const refreshedProgram = { ...program, name: 'Updated program' };
    const refreshedCycle = { ...cycle, name: 'Updated cycle' };
    rerender({ programs: [refreshedProgram], cycles: [refreshedCycle] });

    expect(result.current.programSelection.selectedKey).toBe(program.id);
    expect(result.current.cycleSelection.selectedKey).toBe(cycle.id);
  });

  it('clears only the selection whose row has been removed', async () => {
    const { result, rerender } = renderHook(
      ({ programs, cycles }) => useProgrammingSelection(programs, cycles),
      { initialProps: { programs: [program], cycles: [cycle] } },
    );

    act(() => {
      result.current.programSelection.selectItem(program);
      result.current.cycleSelection.selectItem(cycle);
    });
    rerender({ programs: [], cycles: [cycle] });

    await waitFor(() => expect(result.current.programSelection.selectedKey).toBeNull());
    expect(result.current.cycleSelection.selectedKey).toBe(cycle.id);
  });
});
