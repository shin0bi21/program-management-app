// Owns PublicTopBar scroll-state lifecycle and listener cleanup.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import usePublicTopBarScroll from './usePublicTopBarScroll';

describe('usePublicTopBarScroll', () => {
  afterEach(() => vi.restoreAllMocks());

  it('tracks whether the page has crossed the top-bar scroll threshold', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    const { result } = renderHook(usePublicTopBarScroll);

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 61 });
    act(() => window.dispatchEvent(new Event('scroll')));
    expect(result.current).toBe(true);

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 60 });
    act(() => window.dispatchEvent(new Event('scroll')));
    expect(result.current).toBe(false);
  });

  it('removes its scroll listener when the top bar unmounts', () => {
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(usePublicTopBarScroll);

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
