import { act, renderHook } from '@testing-library/react';
import { createElement, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dayKey } from '../../utils/periods';
import { useToday } from './useToday';

describe('useToday', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 9, 23, 59, 59));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(['focus', 'visibilitychange'])('catches up after sleep on %s and reschedules midnight', event => {
    const { result } = renderHook(() => useToday());
    vi.setSystemTime(new Date(2026, 7, 12, 23, 59, 59));

    act(() => {
      if (event === 'focus') window.dispatchEvent(new Event(event));
      else {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        document.dispatchEvent(new Event(event));
      }
    });
    if (event === 'visibilitychange') {
      expect(dayKey(result.current.today)).toBe('2026-08-09');

      act(() => {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
        document.dispatchEvent(new Event(event));
      });
    }

    expect(dayKey(result.current.today)).toBe('2026-08-12');
    act(() => vi.advanceTimersByTime(1000));
    expect(dayKey(result.current.today)).toBe('2026-08-13');
  });

  it.each([
    new Date(2026, 7, 9, 23, 59, 59),
    new Date(2026, 2, 8), new Date(2026, 10, 1),
    new Date(2026, 2, 29), new Date(2026, 9, 25),
    new Date(2026, 3, 5), new Date(2026, 9, 4),
  ])('advances at local midnight, including daylight saving changes, from %s', start => {
    vi.setSystemTime(start);
    const { result } = renderHook(() => useToday());
    const nextMidnight = new Date(start);
    nextMidnight.setHours(24, 0, 0, 0);

    act(() => vi.advanceTimersByTime(nextMidnight.getTime() - start.getTime() - 1));
    expect(dayKey(result.current.today)).toBe(dayKey(start));

    act(() => vi.advanceTimersByTime(1));
    expect(dayKey(result.current.today)).toBe(dayKey(nextMidnight));
  });

  it('cleans up its timer and resume listeners, including StrictMode replay', () => {
    const { unmount } = renderHook(() => useToday(), {
      wrapper: ({ children }) => createElement(StrictMode, null, children),
    });
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(vi.getTimerCount()).toBe(0);
  });
});
