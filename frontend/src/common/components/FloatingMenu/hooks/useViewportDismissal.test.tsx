import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useViewportDismissal from './useViewportDismissal';

describe('useViewportDismissal', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shares viewport listeners and detaches them after the final cleanup', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const firstDismiss = vi.fn();
    const secondDismiss = vi.fn();
    const first = renderHook(() => useViewportDismissal(true, firstDismiss));
    const second = renderHook(() => useViewportDismissal(true, secondDismiss));

    expect(addEventListener.mock.calls.filter(([event]) => event === 'scroll')).toHaveLength(1);
    expect(addEventListener.mock.calls.filter(([event]) => event === 'resize')).toHaveLength(1);
    act(() => window.dispatchEvent(new Event('scroll')));
    expect(firstDismiss).toHaveBeenCalledOnce();
    expect(secondDismiss).toHaveBeenCalledOnce();

    first.unmount();
    expect(removeEventListener.mock.calls.filter(([event]) => event === 'scroll')).toHaveLength(0);
    second.unmount();
    expect(removeEventListener.mock.calls.filter(([event]) => event === 'scroll')).toHaveLength(1);
    expect(removeEventListener.mock.calls.filter(([event]) => event === 'resize')).toHaveLength(1);
  });

  it('keeps floating UI open when its own scrollable content scrolls', () => {
    const onDismiss = vi.fn();
    const floatingUi = document.createElement('div');
    const scrollableContent = document.createElement('div');
    floatingUi.append(scrollableContent);
    const ignoreScrollWithinRef = { current: floatingUi };
    const hook = renderHook(() => useViewportDismissal(
      true,
      onDismiss,
      ignoreScrollWithinRef,
    ));

    act(() => scrollableContent.dispatchEvent(new Event('scroll')));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => window.dispatchEvent(new Event('scroll')));
    expect(onDismiss).toHaveBeenCalledOnce();

    hook.unmount();
  });
});
