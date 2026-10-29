import { createTestQueryClient, createQueryClientWrapper } from '../../../../tests/queryClientTestUtils';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicHomepageImages } from '../publicHomepage.api';
import { useHomepageImages } from './useHomepageImages';

vi.mock('../publicHomepage.api', () => ({ getPublicHomepageImages: vi.fn() }));

const image = {
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

describe('useHomepageImages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes the public image query lifecycle and refresh action', async () => {
    vi.mocked(getPublicHomepageImages).mockResolvedValue({ images: [image] });
    const { result } = renderHook(useHomepageImages, { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.images).toEqual([image]));
    expect(result.current.error).toBeNull();

    await result.current.refresh();
    expect(getPublicHomepageImages).toHaveBeenCalledTimes(2);
  });
});
