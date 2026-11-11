import { act, renderHook } from '@testing-library/react';
import { createElement, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
      expect(result.current.today).toBe('2026-08-09');

      act(() => {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
        document.dispatchEvent(new Event(event));
      });
    }

    expect(result.current.today).toBe('2026-08-12');
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.today).toBe('2026-08-13');
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
