import type { PublicOutreachFormValues } from '../../../common/features/OutreachForm/outreachFormSchema';
import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import { normalizeHomepageImage, type HomepageImage } from '../common/homepageImage';
import type { HomepageProgram } from './types';

export type { HomepageImage } from '../common/homepageImage';

export type PublicLeadPayload = Omit<PublicOutreachFormValues, 'notes'> & { notes?: string };

/**
 * Submits an expression of interest from the public signup form.
 * @param payload - Validated youth and contact details supplied by the visitor.
 * @example await submitPublicLead(payload) // submits interest without signing in
 */
export function submitPublicLead(payload: PublicLeadPayload) {
  return apiClient.post<{ message: string }>('/public/leads', payload, { auth: false });
}

/**
 * Loads public homepage images with renderable asset URLs without authentication.
 * @param opts - HTTP options and cancellation signal supplied by the query owner.
 * @example await getPublicHomepageImages({ signal }) // complete images for the public carousel
 */
export async function getPublicHomepageImages(opts: RequestOptions = {}) {
  const content = await apiClient.get<{ images: HomepageImage[] }>('/public/homepage/images', {
    ...opts,
    auth: false,
  });
  return { images: content.images.map(normalizeHomepageImage) };
}

/**
 * Loads the program summaries displayed on the public homepage.
 * @param opts - HTTP options and cancellation signal supplied by the query owner.
 * @example await getPublicHomepagePrograms({ signal }) // public program summaries
 */
export function getPublicHomepagePrograms(opts: RequestOptions = {}) {
  return apiClient.get<{ programs: HomepageProgram[] }>('/public/homepage/programs', {
    ...opts,
    auth: false,
  });
}
