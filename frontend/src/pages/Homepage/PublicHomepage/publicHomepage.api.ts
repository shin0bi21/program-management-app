import type { PublicOutreachFormValues } from '../../../common/features/OutreachForm/outreachFormSchema';
import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import { apiUrl } from '../../../http/transport';
import type { HomepageProgram } from './types';

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

export type PublicLeadPayload = Omit<PublicOutreachFormValues, 'notes'> & { notes?: string };

export function submitPublicLead(payload: PublicLeadPayload) {
  return apiClient.post<{ message: string }>('/public/leads', payload, { auth: false });
}

function resolveImageUrl(image: HomepageImage): HomepageImage {
  const resolve = (url: string) => url.startsWith('/public/') ? apiUrl(url) : url;
  return {
    ...image,
    imageUrl: resolve(image.imageUrl),
    mobileUrl: resolve(image.mobileUrl ?? image.imageUrl),
    thumbnailUrl: resolve(image.thumbnailUrl ?? image.imageUrl),
  };
}

export async function getPublicHomepageImages(opts: RequestOptions = {}) {
  const content = await apiClient.get<{ images: HomepageImage[] }>('/public/homepage/images', {
    ...opts,
    auth: false,
  });
  return { images: content.images.map(resolveImageUrl) };
}

export function getPublicHomepagePrograms(opts: RequestOptions = {}) {
  return apiClient.get<{ programs: HomepageProgram[] }>('/public/homepage/programs', {
    ...opts,
    auth: false,
  });
}

export function getPublicHomepageSignup(opts: RequestOptions = {}) {
  return apiClient.get<{ signupEnabled: boolean }>('/public/homepage/signup', {
    ...opts,
    auth: false,
  });
}
