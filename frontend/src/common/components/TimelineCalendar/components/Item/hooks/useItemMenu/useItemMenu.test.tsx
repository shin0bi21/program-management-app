import type { MouseEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import useItemMenu from './useItemMenu';

const click = { clientX: 0 } as MouseEvent<HTMLButtonElement>;

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

function options(hasActions = true) {
  const trigger = document.createElement('button');
  document.body.appendChild(trigger);
  return { triggerRef: { current: trigger }, hasActions, hideDetails: vi.fn(), showDetails: vi.fn() };
}

it('hides details without opening a menu for an item with no actions', () => {
  const props = options(false);
  const { result } = renderHook(() => useItemMenu(props));

  act(() => result.current.onClick(click));
  expect(props.hideDetails).toHaveBeenCalledOnce();
  expect(result.current.isOpen).toBe(false);
});

it('toggles the anchored item menu and exposes touch detail discovery', () => {
  const { result } = renderHook(() => useItemMenu(options()));

  act(() => result.current.onClick(click));
  expect(result.current.isOpen).toBe(true);
  expect(result.current.showTouchDetails).toBe(true);
  act(() => result.current.onClick(click));
  expect(result.current.isOpen).toBe(false);
});

it('closes the menu and stops item activation before running actions or showing details', () => {
  const props = options();
  const { result } = renderHook(() => useItemMenu(props));
  const stopPropagation = vi.fn();
  const event = { stopPropagation } as unknown as MouseEvent<HTMLButtonElement>;
  const action = vi.fn();

  act(() => result.current.onClick(click));
  act(() => result.current.runAction(event, action));
  expect(result.current.isOpen).toBe(false);
  expect(action).toHaveBeenCalledOnce();
  act(() => result.current.onClick(click));
  act(() => result.current.viewDetails(event));
  expect(result.current.isOpen).toBe(false);
  expect(props.showDetails).toHaveBeenCalledOnce();
  expect(stopPropagation).toHaveBeenCalledTimes(2);
});
