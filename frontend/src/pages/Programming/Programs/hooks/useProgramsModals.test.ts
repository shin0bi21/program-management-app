import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useProgramsModals from './useProgramsModals';

describe('useProgramsModals', () => {
  it('distinguishes closed, create, and edit targets for each modal', () => {
    const { result } = renderHook(() => useProgramsModals());

    expect(result.current.program.target).toBeUndefined();
    act(() => result.current.program.open(null));
    expect(result.current.program.target).toBeNull();
    act(() => result.current.program.open({
      id: 'program-1',
      name: 'Skills',
      description: null,
      enrollmentRequired: false,
      minAge: null,
      maxAge: null, defaultDayOfWeek: 'tuesday' as const, defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
    }));
    expect(result.current.program.target?.id).toBe('program-1');
    act(() => result.current.program.close());
    expect(result.current.program.target).toBeUndefined();

    act(() => result.current.cycle.open(null));
    expect(result.current.cycle.target).toBeNull();
    act(() => result.current.cycle.close());
    expect(result.current.cycle.target).toBeUndefined();
  });
});
