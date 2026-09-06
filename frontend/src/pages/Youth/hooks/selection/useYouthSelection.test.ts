import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import { useYouthSelection } from './useYouthSelection';

describe('useYouthSelection', () => {
  it('exposes the selected profile and its identifier', () => {
    const onSelectedProfileIdChange = vi.fn();
    const profile = makeYouthProfile();
    const { result } = renderHook(() => useYouthSelection({ onSelectedProfileIdChange }));

    act(() => result.current.selectProfile(profile));

    expect(result.current.selectedProfile).toBe(profile);
    expect(result.current.selectedProfileId).toBe(profile.id);
  });

  it('synchronizes dependent workflows only when the selected identifier changes', () => {
    const onSelectedProfileIdChange = vi.fn();
    const profile = makeYouthProfile();
    const { result } = renderHook(() => useYouthSelection({ onSelectedProfileIdChange }));
    onSelectedProfileIdChange.mockClear();

    act(() => result.current.selectProfile(profile));
    expect(onSelectedProfileIdChange).toHaveBeenCalledTimes(1);

    act(() => result.current.selectProfile({ ...profile, firstName: 'Updated' }));
    expect(onSelectedProfileIdChange).toHaveBeenCalledTimes(1);

    act(() => result.current.selectProfile(makeYouthProfile({ id: 'youth-2' })));
    expect(onSelectedProfileIdChange).toHaveBeenCalledTimes(2);
  });

  it('reconciles an authoritative save only when it matches the current selection', () => {
    const selected = makeYouthProfile();
    const unrelated = makeYouthProfile({ id: 'youth-2' });
    const saved = makeYouthProfile({ firstName: 'Updated' });
    const { result } = renderHook(() => useYouthSelection({ onSelectedProfileIdChange: vi.fn() }));

    act(() => result.current.selectProfile(selected));
    act(() => result.current.reconcileSavedProfile(unrelated));
    expect(result.current.selectedProfile).toBe(selected);

    act(() => result.current.reconcileSavedProfile(saved));
    expect(result.current.selectedProfile).toBe(saved);
  });
});
