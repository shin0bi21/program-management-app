import type { MouseEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import useItemDetails from './useItemDetails';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('cancels delayed hover details on dismissal and unmount', () => {
  vi.useFakeTimers();
  const trigger = document.createElement('button');
  const { result, unmount } = renderHook(() => useItemDetails({ current: trigger }));

  act(() => result.current.onMouseEnter({ clientX: 0 } as MouseEvent<HTMLButtonElement>));
  expect(result.current.position).toBeNull();
  act(() => result.current.hideDetails());
  act(() => vi.advanceTimersByTime(120));
  expect(result.current.position).toBeNull();

  act(() => result.current.onMouseEnter({ clientX: 0 } as MouseEvent<HTMLButtonElement>));
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('opens delayed details, then dismisses them when the viewport scrolls', () => {
  vi.useFakeTimers();
  const trigger = document.createElement('button');
  const { result } = renderHook(() => useItemDetails({ current: trigger }));

  act(() => result.current.onMouseEnter({ clientX: 0 } as MouseEvent<HTMLButtonElement>));
  act(() => vi.advanceTimersByTime(120));
  expect(result.current.position).not.toBeNull();
  act(() => window.dispatchEvent(new Event('scroll')));
  expect(result.current.position).toBeNull();
});

it('observes the open detail surface and disconnects on dismissal', () => {
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    observe = observe;
    disconnect = disconnect;
  });
  const trigger = document.createElement('button');
  const detail = document.createElement('div');
  const { result } = renderHook(() => useItemDetails({ current: trigger }));
  Object.assign(result.current.detailRef, { current: detail });

  act(() => result.current.showDetails());
  expect(observe).toHaveBeenCalledWith(detail);
  act(() => result.current.hideDetails());
  expect(disconnect).toHaveBeenCalledOnce();
});

it('opens details on focus only when the trigger is focus-visible', () => {
  const trigger = document.createElement('button');
  const matches = vi.spyOn(trigger, 'matches').mockReturnValue(false);
  const { result } = renderHook(() => useItemDetails({ current: trigger }));

  act(() => result.current.onFocus());
  expect(result.current.position).toBeNull();
  matches.mockReturnValue(true);
  act(() => result.current.onFocus());
  expect(result.current.position).not.toBeNull();
});

it.each(['scroll', 'resize'])('cancels pending hover details on viewport %s', event => {
  vi.useFakeTimers();
  const trigger = document.createElement('button');
  const { result } = renderHook(() => useItemDetails({ current: trigger }));

  act(() => result.current.onMouseEnter({ clientX: 0 } as MouseEvent<HTMLButtonElement>));
  act(() => window.dispatchEvent(new Event(event)));
  act(() => vi.advanceTimersByTime(120));
  expect(result.current.position).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
