// Owns homepage image create/edit submission, reconciliation, failures, and reopen state.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createHomepageImage, updateHomepageImage } from '../../../manageHomepage.api';
import type { ManagedHomepageImage } from '../../../types';
import useHomepageImageModal from './useHomepageImageModal';

vi.mock('../../../manageHomepage.api', () => ({
  createHomepageImage: vi.fn(),
  updateHomepageImage: vi.fn(),
}));

const image: ManagedHomepageImage = {
  id: 'image-1',
  imageUrl: '/image.webp',
  mobileUrl: '/image-mobile.webp',
  thumbnailUrl: '/image-thumbnail.webp',
  altText: 'Youth event',
  caption: 'Original caption.',
  displayOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('useHomepageImageModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates an image before reconciling the page owner', async () => {
    vi.mocked(updateHomepageImage).mockResolvedValue({ id: image.id });
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useHomepageImageModal({ image, isOpen: true, onSaved }));

    await act(() => result.current.submit('Updated caption.'));

    expect(updateHomepageImage).toHaveBeenCalledWith(image.id, { caption: 'Updated caption.' });
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current).toMatchObject({
      status: 'success',
      statusMessage: 'Homepage image updated.',
    });
  });

  it('uploads the selected file and reports completion after reconciliation', async () => {
    const file = new File(['image'], 'homepage.webp', { type: 'image/webp' });
    vi.mocked(createHomepageImage).mockResolvedValue({ id: 'image-2' });
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useHomepageImageModal({ image: null, isOpen: true, onSaved }));

    act(() => result.current.setSelectedFile(file));
    await act(() => result.current.submit('New image.'));

    expect(createHomepageImage).toHaveBeenCalledWith({ image: file, caption: 'New image.' });
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.statusMessage).toBe('Homepage image added.');
  });

  it('keeps the modal open with an actionable error when no file is selected', async () => {
    const onSaved = vi.fn();
    const { result, rerender } = renderHook(
      ({ isOpen }) => useHomepageImageModal({ image: null, isOpen, onSaved }),
      { initialProps: { isOpen: true } },
    );

    await act(() => result.current.submit('New image.'));

    expect(createHomepageImage).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({
      status: 'error',
      statusMessage: 'Choose an image to upload',
    });

    rerender({ isOpen: false });
    rerender({ isOpen: true });
    expect(result.current).toMatchObject({ status: 'idle', statusMessage: '' });
  });
});
