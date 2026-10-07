// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../http/client';
import {
  getPublicHomepageImages,
  getPublicHomepagePrograms,
  getPublicHomepageSignup,
  submitPublicLead,
} from './publicHomepage.api';

vi.mock('../../../http/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../../../http/transport', () => ({
  apiUrl: (path: string) => `https://api.example.test${path}`,
}));

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);

describe('publicHomepage API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads public images without authentication and resolves backend image paths', async () => {
    get.mockResolvedValue({
      images: [{
        id: 'image-1',
        imageUrl: '/public/image.webp',
        mobileUrl: '/public/image-mobile.webp',
        thumbnailUrl: '/public/image-thumbnail.webp',
        altText: 'Youth event',
        caption: 'Youth event.',
        displayOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
    });

    const result = await getPublicHomepageImages();

    expect(get).toHaveBeenCalledWith('/public/homepage/images', { auth: false });
    expect(result.images[0].imageUrl).toBe('https://api.example.test/public/image.webp');
  });

  it('loads public programs and submits expressions of interest without authentication', () => {
    getPublicHomepagePrograms();
    const payload = {
      youthFirstName: 'Jamie',
      youthLastName: 'Test',
      age: 14,
      school: 'Westview',
      submittedByRole: 'youth' as const,
      contactPhoneNumber: '519-555-0100',
      contactRelationship: 'guardian' as const,
      discoverySource: 'online' as const,
    };
    submitPublicLead(payload);

    expect(get).toHaveBeenCalledWith('/public/homepage/programs', { auth: false });
    expect(post).toHaveBeenCalledWith('/public/leads', payload, { auth: false });
  });
  it('loads signup availability independently without authentication', async () => {
    const signal = new AbortController().signal;
    get.mockResolvedValue({ signupEnabled: false });

    expect(await getPublicHomepageSignup({ signal })).toEqual({ signupEnabled: false });
    expect(get).toHaveBeenCalledWith('/public/homepage/signup', { signal, auth: false });
  });

});
