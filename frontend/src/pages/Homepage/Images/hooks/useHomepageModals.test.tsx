import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ManagedHomepageImage } from '../types';
import { useHomepageModals } from './useHomepageModals';

const image: ManagedHomepageImage = {
  id: 'image-1',
  imageUrl: '/image.webp',
  mobileUrl: '/image-mobile.webp',
  thumbnailUrl: '/image-thumbnail.webp',
  altText: 'Youth event',
  caption: 'Youth event.',
  displayOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('useHomepageModals', () => {
  it('owns new, edit, and close transitions for the image editor', () => {
    const { result } = renderHook(() => useHomepageModals({ deleteImage: vi.fn() }));

    act(() => result.current.image.openEdit(image));
    expect(result.current.image).toMatchObject({ open: true, target: image });

    act(() => result.current.image.close());
    expect(result.current.image).toMatchObject({ open: false, target: null });

    act(() => result.current.image.openNew());
    expect(result.current.image).toMatchObject({ open: true, target: null });
  });

  it('builds and closes the deletion confirmation workflow', async () => {
    const deleteImage = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useHomepageModals({ deleteImage }));

    act(() => result.current.deletion.open(image));
    expect(result.current.deletion.action).toMatchObject({
      title: 'Delete Homepage Image',
      confirmVariant: 'danger',
    });

    await result.current.deletion.action?.onConfirm();
    expect(deleteImage).toHaveBeenCalledWith('image-1');

    act(() => result.current.deletion.close());
    expect(result.current.deletion.action).toBeNull();
  });
});
