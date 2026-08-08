import { apiClient } from '../../../common/api/http/client';
import type { RequestOptions } from '../../../common/api/http/client';
import { api } from '../../../common/api/http/config';
import type { PublicOutreachFormValues } from '../../../common/components/OutreachForm/outreachFormSchema';

export type ExpressionOfInterestPayload = Omit<PublicOutreachFormValues, 'notes'> & { notes?: string };

export function submitExpressionOfInterest(payload: ExpressionOfInterestPayload) {
  return apiClient.post<{ message: string }>('/public/expressions-of-interest', payload, { auth: false });
}

export interface HomepageImage {
  id: string;
  imageUrl: string;
  mobileUrl: string;
  thumbnailUrl: string;
  altText: string;
  caption: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface HomepageSession {
  id: string;
  cohortId: string;
  theme: string | null;
  description: string | null;
  startsAt: string;
  endsAt: string;
  cohortName: string;
  programId: string;
  programName: string;
  programDescription: string | null;
  rosterMode: 'enrolled' | 'open';
  minAge: number | null;
  maxAge: number | null;
  addedAt: string;
}

export interface HomepageContent {
  images: HomepageImage[];
  sessions: HomepageSession[];
}

function resolveImageUrl(image: HomepageImage): HomepageImage {
  const resolve = (url: string) => url.startsWith('/public/') ? api(url) : url;
  return {
    ...image,
    imageUrl: resolve(image.imageUrl),
    mobileUrl: resolve(image.mobileUrl ?? image.imageUrl),
    thumbnailUrl: resolve(image.thumbnailUrl ?? image.imageUrl),
  };
}

function resolveImages<T extends { images: HomepageImage[] }>(content: T): T {
  return {
    ...content,
    images: content.images.map(resolveImageUrl),
  };
}

export async function getPublicHomepageImages(opts: RequestOptions = {}) {
  const content = await apiClient.get<{ images: HomepageImage[] }>('/public/homepage/images', {
    ...opts,
    auth: false,
  });
  return resolveImages(content);
}

export function getPublicHomepageSessions(opts: RequestOptions = {}) {
  return apiClient.get<{ sessions: HomepageSession[] }>('/public/homepage/sessions', {
    ...opts,
    auth: false,
  });
}

export async function getManagedHomepage(opts?: RequestOptions) {
  const content = opts
    ? await apiClient.get<{ images: HomepageImage[] }>('/homepage', opts)
    : await apiClient.get<{ images: HomepageImage[] }>('/homepage');
  return { images: content.images.map(resolveImageUrl) };
}

export function createHomepageImage(data: { image: File; caption: string }) {
  const body = new FormData();
  body.set('image', data.image);
  body.set('caption', data.caption);
  return apiClient.post<{ id: string }>('/homepage/images', body);
}

export function updateHomepageImage(imageId: string, data: Pick<HomepageImage, 'caption'>) {
  return apiClient.put<{ id: string }>(`/homepage/images/${imageId}`, data);
}

export function reorderHomepageImages(imageIds: string[]) {
  return apiClient.put<{ imageIds: string[] }>('/homepage/images/order', { imageIds });
}

export function deleteHomepageImage(imageId: string) {
  return apiClient.delete(`/homepage/images/${imageId}`);
}
