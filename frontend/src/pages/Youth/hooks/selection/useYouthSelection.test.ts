import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import { useYouthSelection } from './useYouthSelection';

describe('useYouthSelection', () => {
  it('keeps the clicked profile and reconciles only that selection', () => {
    const profile = makeYouthProfile();
    const { result } = renderHook(() => useYouthSelection());

    act(() => result.current.selectProfile(profile));
    expect(result.current.selectedProfileId).toBe(profile.id);
    expect(result.current.selectedProfile).toEqual(profile);

    act(() => result.current.updateSelectedProfile({ ...profile, firstName: 'Updated' }));
    expect(result.current.selectedProfile?.firstName).toBe('Updated');

    act(() => result.current.updateSelectedProfile(makeYouthProfile({ id: 'other' })));
    expect(result.current.selectedProfileId).toBe(profile.id);

    act(() => result.current.selectProfile(makeYouthProfile({ id: 'youth-2' })));
  });
});
