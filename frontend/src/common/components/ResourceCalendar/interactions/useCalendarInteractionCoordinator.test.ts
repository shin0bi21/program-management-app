import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCalendarInteractionCoordinator } from './useCalendarInteractionCoordinator';

describe('useCalendarInteractionCoordinator', () => {
  it('publishes one active pointer interaction until its matching release', () => {
    const { result } = renderHook(() => useCalendarInteractionCoordinator());
    const coordinator = result.current.coordinator;

    act(() => expect(coordinator.claim('range-move', 7)).toBe(true));
    expect(result.current.activeType).toBe('range-move');
    expect(result.current.coordinator).toBe(coordinator);

    act(() => expect(coordinator.claim('item-drag', 8)).toBe(false));
    act(() => coordinator.release('range-move', 8));
    expect(result.current.activeType).toBe('range-move');

    act(() => coordinator.release('range-move', 7));
    expect(result.current.activeType).toBeNull();
  });
});
