// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../http/client';
import {
  createHomepageImage,
  deleteHomepageImage,
  getManagedHomepage,
  reorderHomepageImages,
  updateHomepageImage,
} from './manageHomepage.api';

vi.mock('../../../http/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../../http/transport', () => ({
  apiUrl: (path: string) => `https://api.example.test${path}`,
}));

const savedImage = {
  id: 'image-1',
  imageUrl: '/public/image.webp',
  mobileUrl: '/public/image-mobile.webp',
  thumbnailUrl: '/public/image-thumbnail.webp',
  altText: 'Youth event',
  caption: 'Youth event.',
  displayOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('manageHomepage API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads managed images through the authenticated endpoint', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ images: [savedImage] });

    const result = await getManagedHomepage();

    expect(apiClient.get).toHaveBeenCalledWith('/homepage');
    expect(result.images[0].thumbnailUrl).toBe(
      'https://api.example.test/public/image-thumbnail.webp',
    );
  });

  it('writes image creation, updates, ordering, and deletion to their focused endpoints and normalizes complete saved records', async () => {
    const image = new File(['image'], 'hero.png', { type: 'image/png' });
    vi.mocked(apiClient.post).mockResolvedValue(savedImage);
    vi.mocked(apiClient.put).mockResolvedValue(savedImage);
    const created = await createHomepageImage({ image, caption: 'Community event.' });
    const updated = await updateHomepageImage('image-1', { caption: 'Updated.' });
    reorderHomepageImages(['image-2', 'image-1']);
    deleteHomepageImage('image-1');

    const normalizedImage = {
      ...savedImage,
      imageUrl: 'https://api.example.test/public/image.webp',
      mobileUrl: 'https://api.example.test/public/image-mobile.webp',
      thumbnailUrl: 'https://api.example.test/public/image-thumbnail.webp',
    };
    expect(created).toEqual(normalizedImage);
    expect(updated).toEqual(normalizedImage);
    expect(apiClient.post).toHaveBeenCalledWith('/homepage/images', expect.any(FormData));
    const createBody = vi.mocked(apiClient.post).mock.calls[0][1] as FormData;
    expect(createBody.get('file')).toBe(image);
    expect(createBody.get('caption')).toBe('Community event.');
    expect(apiClient.put).toHaveBeenNthCalledWith(1, '/homepage/images/image-1', { caption: 'Updated.' });
    expect(apiClient.put).toHaveBeenNthCalledWith(2, '/homepage/images/order', { imageIds: ['image-2', 'image-1'] });
    expect(apiClient.delete).toHaveBeenCalledWith('/homepage/images/image-1');
  });
});
