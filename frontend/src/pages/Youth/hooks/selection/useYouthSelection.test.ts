import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import { useYouthSelection } from './useYouthSelection';

describe('useYouthSelection', () => {
  it('keeps the clicked profile and closes dependents only when its ID changes', () => {
    const profile = makeYouthProfile();
    const onSelectedProfileIdChange = vi.fn();
    const { result } = renderHook(() => useYouthSelection({ onSelectedProfileIdChange }));
    onSelectedProfileIdChange.mockClear();

    act(() => result.current.selectProfile(profile));
    expect(result.current.selectedProfileId).toBe(profile.id);
    expect(result.current.selectedProfile).toEqual(profile);
    expect(onSelectedProfileIdChange).toHaveBeenCalledOnce();

    act(() => result.current.updateSelectedProfile({ ...profile, firstName: 'Updated' }));
    expect(result.current.selectedProfile?.firstName).toBe('Updated');
    expect(onSelectedProfileIdChange).toHaveBeenCalledOnce();

    act(() => result.current.updateSelectedProfile(makeYouthProfile({ id: 'other' })));
    expect(result.current.selectedProfileId).toBe(profile.id);

    act(() => result.current.selectProfile(makeYouthProfile({ id: 'youth-2' })));
    expect(onSelectedProfileIdChange).toHaveBeenCalledTimes(2);
  });
});
