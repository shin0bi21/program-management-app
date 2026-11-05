import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { ProgramCycle } from '../../../../../../common/features/programming/cycles/types';
import useCycleTableData from './useCycleTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));

it('supplies the cycle start date as its descending sort value', () => {
  const cycle: ProgramCycle = { id: 'cycle-1', name: 'Fall', startsOn: '2026-09-01', endsOn: '2026-12-31', state: 'active' };
  renderHook(() => useCycleTableData(true));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('desc');
  const getValue = vi.mocked(useInfiniteListQuery<ProgramCycle>).mock.calls[0][0].ordering!.getValue;

  expect(getValue(cycle)).toBe('2026-09-01');
});
