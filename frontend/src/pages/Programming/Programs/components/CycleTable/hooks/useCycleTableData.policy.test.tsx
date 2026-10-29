import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { ProgramCycle } from '../../../../../../common/features/programming/cycles/types';
import useCycleTableData from './useCycleTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));

it('tracks cycle start-date ordering while preserving the view after other edits', () => {
  const cycle: ProgramCycle = { id: 'cycle-1', name: 'Fall', startsOn: '2026-09-01', endsOn: '2026-12-31', state: 'active' };
  renderHook(() => useCycleTableData(true));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('desc');
  const getValue = vi.mocked(useInfiniteListQuery<ProgramCycle>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...cycle, startsOn: '2026-08-01' })).not.toEqual(getValue(cycle));
  expect(getValue({ ...cycle, name: 'Renamed', endsOn: '2027-01-01' })).toEqual(getValue(cycle));
});
