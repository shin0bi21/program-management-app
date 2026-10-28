// This suite owns the shared pointer threshold, exclusivity, capture, completion, and cleanup lifecycle.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePointerSession } from './usePointerSession';

function dispatchPointer(type: string, values: Record<string, unknown>) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.entries(values).forEach(([key, value]) => {
    Object.defineProperty(event, key, { value });
  });
  window.dispatchEvent(event);
}

function dispatchPointerFrom(element: HTMLElement, type: string, values: Record<string, unknown>) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.entries(values).forEach(([key, value]) => {
    Object.defineProperty(event, key, { value });
  });
  element.dispatchEvent(event);
}

describe('usePointerSession', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('shares transient click suppression and clears its timer on unmount', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => usePointerSession());

    expect(result.current.isClickSuppressed()).toBe(false);
    act(() => result.current.suppressNextClick());
    expect(result.current.isClickSuppressed()).toBe(true);
    act(() => vi.runOnlyPendingTimers());
    expect(result.current.isClickSuppressed()).toBe(false);

    act(() => result.current.suppressNextClick());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('activates one captured session after threshold movement and releases it on completion', () => {
    const source = document.createElement('div');
    source.setPointerCapture = vi.fn();
    source.hasPointerCapture = vi.fn(() => true);
    source.releasePointerCapture = vi.fn();
    const onActivate = vi.fn();
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const onCancel = vi.fn();
    const { result } = renderHook(() => usePointerSession());

    act(() => expect(result.current.startPointerSession({
      type: 'item-move',
      pointerId: 7,
      startX: 100,
      startY: 100,
      captureElement: source,
      onActivate,
      onMove,
      onEnd,
      onCancel,
    })).toBe(true));
    expect(result.current.activeType).toBe('item-move');
    act(() => expect(result.current.startPointerSession({
      type: 'item-resize',
      pointerId: 8,
      startX: 100,
      startY: 100,
      captureElement: source,
      onActivate,
      onMove,
      onEnd,
      onCancel,
    })).toBe(false));

    act(() => dispatchPointer('pointermove', { pointerId: 7, clientX: 109, clientY: 100 }));
    expect(onActivate).not.toHaveBeenCalled();
    act(() => dispatchPointer('pointermove', { pointerId: 7, clientX: 110, clientY: 100 }));
    expect(source.setPointerCapture).toHaveBeenCalledWith(7);
    expect(onActivate).toHaveBeenCalledOnce();
    expect(onMove).toHaveBeenCalledOnce();

    act(() => dispatchPointer('pointerup', { pointerId: 7, clientX: 110, clientY: 100 }));
    expect(source.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    expect(result.current.activeType).toBeNull();
  });

  it('ignores foreign capture loss and recovers genuine capture loss on the next move', async () => {
    const captureOwner = document.createElement('div');
    const foreignElement = document.createElement('button');
    document.body.append(captureOwner, foreignElement);
    captureOwner.setPointerCapture = vi.fn();
    captureOwner.hasPointerCapture = vi.fn(() => true);
    captureOwner.releasePointerCapture = vi.fn();
    const onCancel = vi.fn();
    const onMove = vi.fn();
    const { result } = renderHook(() => usePointerSession());

    act(() => result.current.startPointerSession({
      type: 'item-move',
      pointerId: 7,
      startX: 100,
      startY: 100,
      captureElement: captureOwner,
      onActivate: vi.fn(),
      onMove,
      onEnd: vi.fn(),
      onCancel,
    }));
    act(() => dispatchPointer('pointermove', {
      pointerId: 7,
      pointerType: 'mouse',
      buttons: 1,
      clientX: 120,
      clientY: 100,
    }));

    await act(async () => {
      dispatchPointerFrom(foreignElement, 'lostpointercapture', {
        pointerId: 7,
        pointerType: 'mouse',
        buttons: 1,
      });
      await Promise.resolve();
    });
    expect(onCancel).not.toHaveBeenCalled();
    expect(result.current.activeType).toBe('item-move');

    await act(async () => {
      dispatchPointerFrom(captureOwner, 'lostpointercapture', {
        pointerId: 7,
        pointerType: 'mouse',
        buttons: 1,
      });
      await Promise.resolve();
    });
    expect(onCancel).not.toHaveBeenCalled();
    expect(result.current.activeType).toBe('item-move');

    act(() => dispatchPointer('pointermove', {
      pointerId: 7,
      pointerType: 'mouse',
      buttons: 1,
      clientX: 130,
      clientY: 100,
    }));
    expect(captureOwner.setPointerCapture).toHaveBeenCalledTimes(2);
    expect(onMove).toHaveBeenCalledTimes(2);

    act(() => dispatchPointer('pointercancel', { pointerId: 7, clientX: 130, clientY: 100 }));
    expect(onCancel).toHaveBeenCalledWith('pointer-cancel');
    expect(result.current.activeType).toBeNull();
  });

  it('waits for pointerup instead of recapturing after the mouse button is already released', () => {
    const captureOwner = document.createElement('div');
    document.body.append(captureOwner);
    captureOwner.setPointerCapture = vi.fn();
    captureOwner.hasPointerCapture = vi.fn(() => true);
    captureOwner.releasePointerCapture = vi.fn();
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const onCancel = vi.fn();
    const { result } = renderHook(() => usePointerSession());

    act(() => result.current.startPointerSession({
      type: 'item-move',
      pointerId: 7,
      startX: 100,
      startY: 100,
      captureElement: captureOwner,
      onActivate: vi.fn(),
      onMove,
      onEnd,
      onCancel,
    }));
    act(() => dispatchPointer('pointermove', {
      pointerId: 7,
      pointerType: 'mouse',
      buttons: 1,
      clientX: 120,
      clientY: 100,
    }));
    act(() => dispatchPointerFrom(captureOwner, 'lostpointercapture', {
      pointerId: 7,
      pointerType: 'mouse',
      buttons: 0,
    }));
    act(() => dispatchPointer('pointermove', {
      pointerId: 7,
      pointerType: 'mouse',
      buttons: 0,
      clientX: 130,
      clientY: 100,
    }));

    expect(captureOwner.setPointerCapture).toHaveBeenCalledOnce();
    expect(onMove).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();

    act(() => dispatchPointer('pointerup', {
      pointerId: 7,
      pointerType: 'mouse',
      buttons: 0,
      clientX: 130,
      clientY: 100,
    }));
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    expect(result.current.activeType).toBeNull();
  });

  it('finishes in window capture phase before target pointerup handlers can report capture loss', () => {
    const captureOwner = document.createElement('div');
    document.body.append(captureOwner);
    captureOwner.setPointerCapture = vi.fn();
    captureOwner.hasPointerCapture = vi.fn(() => true);
    captureOwner.releasePointerCapture = vi.fn();
    const onEnd = vi.fn();
    const onCancel = vi.fn();
    const { result } = renderHook(() => usePointerSession());

    act(() => result.current.startPointerSession({
      type: 'item-move',
      pointerId: 7,
      startX: 100,
      startY: 100,
      captureElement: captureOwner,
      onActivate: vi.fn(),
      onMove: vi.fn(),
      onEnd,
      onCancel,
    }));
    act(() => dispatchPointer('pointermove', {
      pointerId: 7,
      pointerType: 'mouse',
      buttons: 1,
      clientX: 120,
      clientY: 100,
    }));
    captureOwner.addEventListener('pointerup', () => {
      dispatchPointerFrom(captureOwner, 'lostpointercapture', {
        pointerId: 7,
        pointerType: 'mouse',
        buttons: 0,
      });
    });

    act(() => dispatchPointerFrom(captureOwner, 'pointerup', {
      pointerId: 7,
      pointerType: 'mouse',
      buttons: 0,
      clientX: 120,
      clientY: 100,
    }));

    expect(onEnd).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    expect(result.current.activeType).toBeNull();
  });

  it('cancels an active session when the browser window loses focus', () => {
    const source = document.createElement('div');
    const onCancel = vi.fn();
    const { result } = renderHook(() => usePointerSession());

    act(() => result.current.startPointerSession({
      type: 'item-resize',
      pointerId: 9,
      startX: 100,
      startY: 100,
      captureElement: source,
      onActivate: vi.fn(),
      onMove: vi.fn(),
      onEnd: vi.fn(),
      onCancel,
    }));
    act(() => window.dispatchEvent(new Event('blur')));

    expect(onCancel).toHaveBeenCalledWith('window-blur');
    expect(result.current.activeType).toBeNull();
  });

  it('cancels the session when the document becomes hidden', () => {
    const onCancel = vi.fn();
    const { result } = renderHook(() => usePointerSession());
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

    act(() => result.current.startPointerSession({
      type: 'item-move',
      pointerId: 10,
      startX: 100,
      startY: 100,
      captureElement: document.createElement('div'),
      onActivate: vi.fn(),
      onMove: vi.fn(),
      onEnd: vi.fn(),
      onCancel,
    }));
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    expect(onCancel).toHaveBeenCalledWith('document-hidden');
    expect(result.current.activeType).toBeNull();
  });

  it('releases an active session without committing when its owner unmounts', () => {
    const source = document.createElement('div');
    source.setPointerCapture = vi.fn();
    source.hasPointerCapture = vi.fn(() => true);
    source.releasePointerCapture = vi.fn();
    const onEnd = vi.fn();
    const onCancel = vi.fn();
    const { result, unmount } = renderHook(() => usePointerSession());

    act(() => result.current.startPointerSession({
      type: 'item-resize',
      pointerId: 11,
      startX: 100,
      startY: 100,
      captureElement: source,
      onActivate: vi.fn(),
      onMove: vi.fn(),
      onEnd,
      onCancel,
    }));
    act(() => dispatchPointer('pointermove', {
      pointerId: 11,
      pointerType: 'mouse',
      buttons: 1,
      clientX: 120,
      clientY: 100,
    }));
    unmount();

    expect(source.releasePointerCapture).toHaveBeenCalledWith(11);
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledWith('unmount');
    expect(onEnd).not.toHaveBeenCalled();
  });
});
