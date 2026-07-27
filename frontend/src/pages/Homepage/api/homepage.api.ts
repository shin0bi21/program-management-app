import { apiClient } from '../../../common/api/http/client';
import { api } from '../../../common/api/http/config';
import type { OutreachFormValues } from '../../../common/components/OutreachForm/outreachFormSchema';

export type ExpressionOfInterestPayload = Omit<OutreachFormValues, 'notes'> & { notes?: string };

export function submitExpressionOfInterest(payload: ExpressionOfInterestPayload) {
  return apiClient.post<{ message: string }>('/public/expressions-of-interest', payload, { auth: false });
}

export interface HomepageImage {
  id: string;
  imageUrl: string;
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
  return {
    ...image,
    imageUrl: image.imageUrl.startsWith('/public/') ? api(image.imageUrl) : image.imageUrl,
  };
}

function resolveImages(content: HomepageContent): HomepageContent {
  return {
    ...content,
    images: content.images.map(resolveImageUrl),
  };
}

export async function getPublicHomepage() {
  return resolveImages(await apiClient.get<HomepageContent>('/public/homepage', { auth: false }));
}

export async function getManagedHomepage() {
  const content = await apiClient.get<{ images: HomepageImage[] }>('/homepage');
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
