import { createTestQueryClient, createQueryClientWrapper } from '../../../../../../tests/queryClientTestUtils';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getManagedHomepage, getManagedHomepageSignup, reorderHomepageImages, updateHomepageSignup } from '../../../manageHomepage.api';
import { useManagedHomepage } from '../../../hooks/useManagedHomepage';
import { useHomepageSignupSetting } from './useHomepageSignupSetting';

vi.mock('../../../manageHomepage.api', () => ({
  getManagedHomepage: vi.fn(),
  getManagedHomepageSignup: vi.fn(),
  reorderHomepageImages: vi.fn(),
  updateHomepageSignup: vi.fn(),
}));

const images = ['first', 'second'].map((id, displayOrder) => ({
  id, displayOrder, caption: id, altText: id, imageUrl: id, mobileUrl: id,
  thumbnailUrl: id, createdAt: '', updatedAt: '',
}));
describe('useHomepageSignupSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManagedHomepage).mockResolvedValue({ images });
    vi.mocked(getManagedHomepageSignup).mockResolvedValue({ signupEnabled: true });
    vi.mocked(updateHomepageSignup).mockResolvedValue({ signupEnabled: false });
    vi.mocked(reorderHomepageImages).mockResolvedValue({ imageIds: [] });
  });

  it('keeps signup state intact through photo reorder and refresh, and saves without refreshing photos', async () => {
    const { result } = renderHook(() => ({ photos: useManagedHomepage(), signup: useHomepageSignupSetting() }), { wrapper: createQueryClientWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.photos.images).toEqual(images));
    await waitFor(() => expect(result.current.signup.signupEnabled).toBe(true));

    await act(() => result.current.photos.reorderImages('second', 'first'));
    await act(() => result.current.photos.refresh());
    expect(result.current.signup.signupEnabled).toBe(true);
    expect(getManagedHomepageSignup).toHaveBeenCalledOnce();

    act(() => result.current.signup.setSignupEnabled(false));
    await waitFor(() => expect(result.current.signup.signupEnabled).toBe(false));
    expect(updateHomepageSignup).toHaveBeenCalledWith(false, expect.anything());
    expect(getManagedHomepage).toHaveBeenCalledTimes(3);
    expect(getManagedHomepageSignup).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
  });

  it('retains signup status when saving fails and retries only signup', async () => {
    vi.mocked(updateHomepageSignup).mockRejectedValue(new Error('Save failed'));
    const { result } = renderHook(useHomepageSignupSetting, { wrapper: createQueryClientWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.signupEnabled).toBe(true));

    act(() => result.current.setSignupEnabled(false));
    await waitFor(() => expect(result.current.error).toBe('Save failed'));
    expect(result.current.signupEnabled).toBe(true);

    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(getManagedHomepageSignup).toHaveBeenCalledTimes(2);
    expect(getManagedHomepage).not.toHaveBeenCalled();
  });
});
