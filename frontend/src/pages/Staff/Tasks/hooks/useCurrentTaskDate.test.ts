// Scope: keeps date-derived task timing current while the page remains open.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useCurrentTaskDate from './useCurrentTaskDate';

describe('useCurrentTaskDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T03:59:30.000Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('updates when the Toronto calendar date changes', () => {
    const { result } = renderHook(() => useCurrentTaskDate());
    expect(result.current).toBe('2026-08-18');

    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current).toBe('2026-08-19');
  });
});
