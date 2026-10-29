import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { Program } from '../../../../../../common/features/programs/types';
import useProgramTableData from './useProgramTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));

it('tracks case-insensitive program ordering without treating other edits as view changes', () => {
  const program: Program = {
    id: 'program-1', name: 'Skills', enrollmentRequired: true, minAge: null, maxAge: null,
    defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
  };
  renderHook(() => useProgramTableData(['programs', 'table'], { assignedOnly: true }));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('asc');
  const getValue = vi.mocked(useInfiniteListQuery<Program>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...program, name: 'Other' })).not.toEqual(getValue(program));
  expect(getValue({ ...program, name: 'SKILLS' })).toEqual(getValue(program));
  expect(getValue({ ...program, description: 'Edited description', minAge: 12, maxAge: 15 })).toEqual(getValue(program));
});
