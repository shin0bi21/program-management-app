import { act, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useFloatingMenu } from './useFloatingMenu';

function rect(overrides: Partial<DOMRect>): DOMRect {
  return {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('useFloatingMenu', () => {
  it('repositions from rendered dimensions, focuses the first item, and restores focus after outside dismissal', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      observe = observe;
      disconnect = disconnect;
    });

    const trigger = document.createElement('button');
    const focusTrigger = vi.spyOn(trigger, 'focus');
    const outside = document.createElement('div');
    const menu = document.createElement('div');
    const disabledItem = document.createElement('button');
    disabledItem.setAttribute('role', 'menuitem');
    disabledItem.disabled = true;
    const firstItem = document.createElement('button');
    firstItem.setAttribute('role', 'menuitem');
    menu.append(disabledItem, firstItem);
    document.body.append(trigger, outside, menu);
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect({
      top: 600,
      bottom: 628,
      left: 800,
      right: 828,
      width: 28,
      height: 28,
      x: 800,
      y: 600,
    }));
    vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue(rect({
      top: 0,
      bottom: 240,
      left: 0,
      right: 160,
      width: 160,
      height: 240,
    }));
    const triggerRef = { current: trigger };
    const { result } = renderHook(() => useFloatingMenu(
      triggerRef,
      { side: 'bottom', align: 'start' },
    ));
    (result.current.menuRef as { current: HTMLDivElement | null }).current = menu;

    act(() => result.current.open());

    expect(result.current.isOpen).toBe(true);
    expect(result.current.position).toEqual({ top: 356, left: 800 });
    expect(firstItem).toHaveFocus();
    expect(observe).toHaveBeenCalledWith(trigger);
    expect(observe).toHaveBeenCalledWith(menu);

    act(() => fireEvent.pointerDown(outside));

    expect(result.current.isOpen).toBe(false);
    expect(focusTrigger).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('opens from explicit rectangles and points and toggles the current menu closed', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    const { result } = renderHook(() => useFloatingMenu(
      { current: trigger },
      { side: 'bottom', align: 'start' },
      { offset: 8, widthEstimate: 120, heightEstimate: 80 },
    ));

    act(() => result.current.openAtRect(rect({
      top: 100,
      bottom: 120,
      left: 100,
      right: 140,
      width: 40,
      height: 20,
    })));
    expect(result.current.position).toEqual({ top: 128, left: 100 });

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);

    act(() => result.current.openAtPoint(300, 200));
    expect(result.current.position).toEqual({ top: 208, left: 300 });

    act(() => result.current.close());
    expect(result.current.position).toBeNull();
  });
});
