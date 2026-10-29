import { createTestQueryClient, createQueryClientWrapper } from '../../../../tests/queryClientTestUtils';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteHomepageImage,
  getManagedHomepage,
  reorderHomepageImages,
} from '../manageHomepage.api';
import { useManagedHomepage } from './useManagedHomepage';

vi.mock('../manageHomepage.api', () => ({
  deleteHomepageImage: vi.fn(),
  getManagedHomepage: vi.fn(),
  reorderHomepageImages: vi.fn(),
}));

const images = [
  {
    id: 'image-1',
    imageUrl: '/image-1.webp',
    mobileUrl: '/image-1-mobile.webp',
    thumbnailUrl: '/image-1-thumbnail.webp',
    altText: 'First image',
    caption: 'First image.',
    displayOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'image-2',
    imageUrl: '/image-2.webp',
    mobileUrl: '/image-2-mobile.webp',
    thumbnailUrl: '/image-2-thumbnail.webp',
    altText: 'Second image',
    caption: 'Second image.',
    displayOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('useManagedHomepage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManagedHomepage).mockResolvedValue({ images });
    vi.mocked(deleteHomepageImage).mockResolvedValue(undefined);
    vi.mocked(reorderHomepageImages).mockResolvedValue({ imageIds: [] });
  });

  it('exposes the managed image query lifecycle and refresh action', async () => {
    const { result } = renderHook(useManagedHomepage, { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.images).toEqual(images));
    expect(result.current.error).toBeNull();

    await act(() => result.current.refresh());
    expect(getManagedHomepage).toHaveBeenCalledTimes(2);
  });

  it('optimistically reorders images and persists their ids', async () => {
    const { result } = renderHook(useManagedHomepage, { wrapper: createQueryClientWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.images).toEqual(images));

    await act(() => result.current.reorderImages('image-2', 'image-1'));

    expect(result.current.images.map((image) => image.id)).toEqual(['image-2', 'image-1']);
    expect(reorderHomepageImages).toHaveBeenCalledWith(['image-2', 'image-1']);
  });

  it('deletes an image and refreshes the managed content', async () => {
    const { result } = renderHook(useManagedHomepage, { wrapper: createQueryClientWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.images).toEqual(images));

    await act(() => result.current.deleteImage('image-1'));

    expect(deleteHomepageImage).toHaveBeenCalledWith('image-1');
    expect(getManagedHomepage).toHaveBeenCalledTimes(2);
  });
});
