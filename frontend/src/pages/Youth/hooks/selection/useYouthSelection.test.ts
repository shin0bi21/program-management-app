import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import { youthData } from '../data/useYouthData';
import { useYouthSelection } from './useYouthSelection';

describe('useYouthSelection', () => {
  it('resolves current records independently of table membership and closes dependents only on ID changes', async () => {
    const client = createTestQueryClient();
    const profile = makeYouthProfile();
    youthData.write(client, profile);
    const onSelectedProfileIdChange = vi.fn();
    const { result } = renderHook(() => useYouthSelection(youthData.useRecords(), { onSelectedProfileIdChange }), {
      wrapper: createQueryClientWrapper(client),
    });
    onSelectedProfileIdChange.mockClear();

    act(() => result.current.selectProfile(profile));
    expect(result.current.selectedProfileId).toBe(profile.id);
    expect(result.current.selectedProfile).toEqual(profile);
    expect(onSelectedProfileIdChange).toHaveBeenCalledOnce();

    act(() => {
      client.setQueryData(['youth', 'table', { search: 'other' }, { key: 'firstName', direction: 'asc' }], { pages: [{ rows: [], nextCursor: null }], pageParams: [null] });
      youthData.write(client, { ...profile, firstName: 'Updated' });
    });
    await waitFor(() => expect(result.current.selectedProfile?.firstName).toBe('Updated'));
    expect(result.current.selectedProfileId).toBe(profile.id);
    expect(onSelectedProfileIdChange).toHaveBeenCalledOnce();

    act(() => result.current.selectProfile(makeYouthProfile({ id: 'youth-2' })));
    expect(onSelectedProfileIdChange).toHaveBeenCalledTimes(2);
  });

  it('stops exposing a selected record after deletion or account cache clearing', async () => {
    const client = createTestQueryClient();
    const profile = makeYouthProfile();
    youthData.write(client, profile);
    const { result, rerender } = renderHook(() => useYouthSelection(youthData.useRecords(), { onSelectedProfileIdChange: vi.fn() }), {
      wrapper: createQueryClientWrapper(client),
    });
    act(() => result.current.selectProfile(profile));
    act(() => youthData.remove(client, profile.id));
    await waitFor(() => expect(result.current.selectedProfile).toBeNull());
    expect(result.current.selectedProfileId).toBe(profile.id);

    act(() => youthData.write(client, profile));
    await waitFor(() => expect(result.current.selectedProfile).toEqual(profile));
    act(() => client.clear());
    // A render in the next account resolves the retained identifier against its empty owner.
    rerender();
    expect(result.current.selectedProfile).toBeNull();
    expect(result.current.selectedProfileId).toBe(profile.id);
  });
});
