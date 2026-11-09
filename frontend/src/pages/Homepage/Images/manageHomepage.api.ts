import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import { normalizeHomepageImage } from '../common/homepageImage';
import type { ManagedHomepageImage } from './types';

interface ManagedHomepageResponse {
  images: ManagedHomepageImage[];
}

/**
 * Loads the managed image collection with renderable image URLs.
 * @param opts - Request cancellation and HTTP options supplied by the query owner.
 * @example await getManagedHomepage({ signal }) // complete images with resolved asset URLs
 */
export async function getManagedHomepage(opts?: RequestOptions) {
  const content = opts
    ? await apiClient.get<ManagedHomepageResponse>('/homepage', opts)
    : await apiClient.get<ManagedHomepageResponse>('/homepage');
  return { images: content.images.map(normalizeHomepageImage) };
}

/**
 * Uploads an image and returns its complete saved record with renderable URLs.
 * @param data - Selected upload file and its validated caption.
 * @example await createHomepageImage({ image: file, caption: 'Community event.' }) // saved image
 */
export async function createHomepageImage(data: { image: File; caption: string }) {
  const body = new FormData();
  body.set('file', data.image);
  body.set('caption', data.caption);
  const saved = await apiClient.post<ManagedHomepageImage>('/homepage/images', body);
  return normalizeHomepageImage(saved);
}

/**
 * Saves the caption and returns the complete authoritative image record.
 * @param imageId - Existing image being edited.
 * @param data - Replacement caption from the validated form.
 * @example await updateHomepageImage('image-1', { caption: 'Updated event.' }) // saved image
 */
export async function updateHomepageImage(imageId: string, data: Pick<ManagedHomepageImage, 'caption'>) {
  const saved = await apiClient.put<ManagedHomepageImage>(`/homepage/images/${imageId}`, data);
  return normalizeHomepageImage(saved);
}

/**
 * Saves the entire image order.
 * @param imageIds - All image IDs in the desired display order.
 * @example await reorderHomepageImages(['image-2', 'image-1']) // image-2 displays first
 */
export function reorderHomepageImages(imageIds: string[]) {
  return apiClient.put<{ imageIds: string[] }>('/homepage/images/order', { imageIds });
}

/**
 * Deletes the selected homepage image and its uploaded assets.
 * @param imageId - Saved image confirmed for deletion.
 * @example await deleteHomepageImage('image-1') // removes that image
 */
export function deleteHomepageImage(imageId: string) {
  return apiClient.delete(`/homepage/images/${imageId}`);
}
