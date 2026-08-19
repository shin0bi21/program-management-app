import type { PublicOutreachFormValues } from '../../../common/features/outreach/components/OutreachForm/outreachFormSchema';
import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import { api } from '../../../http/config';
import type { HomepageImage, HomepageSession } from './types';

export type ExpressionOfInterestPayload = Omit<PublicOutreachFormValues, 'notes'> & { notes?: string };

export function submitExpressionOfInterest(payload: ExpressionOfInterestPayload) {
  return apiClient.post<{ message: string }>('/public/expressions-of-interest', payload, { auth: false });
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

export async function getPublicHomepageImages(opts: RequestOptions = {}) {
  const content = await apiClient.get<{ images: HomepageImage[] }>('/public/homepage/images', {
    ...opts,
    auth: false,
  });
  return { images: content.images.map(resolveImageUrl) };
}

export function getPublicHomepageSessions(opts: RequestOptions = {}) {
  return apiClient.get<{ sessions: HomepageSession[] }>('/public/homepage/sessions', {
    ...opts,
    auth: false,
  });
}
