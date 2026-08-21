import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import { apiUrl } from '../../../http/transport';
import type { ManagedHomepageImage } from './types';

function resolveImageUrl(image: ManagedHomepageImage): ManagedHomepageImage {
  const resolve = (url: string) => url.startsWith('/public/') ? apiUrl(url) : url;
  return {
    ...image,
    imageUrl: resolve(image.imageUrl),
    mobileUrl: resolve(image.mobileUrl ?? image.imageUrl),
    thumbnailUrl: resolve(image.thumbnailUrl ?? image.imageUrl),
  };
}

export async function getManagedHomepage(opts?: RequestOptions) {
  const content = opts
    ? await apiClient.get<{ images: ManagedHomepageImage[] }>('/homepage', opts)
    : await apiClient.get<{ images: ManagedHomepageImage[] }>('/homepage');
  return { images: content.images.map(resolveImageUrl) };
}

export function createHomepageImage(data: { image: File; caption: string }) {
  const body = new FormData();
  body.set('image', data.image);
  body.set('caption', data.caption);
  return apiClient.post<{ id: string }>('/homepage/images', body);
}

export function updateHomepageImage(imageId: string, data: Pick<ManagedHomepageImage, 'caption'>) {
  return apiClient.put<{ id: string }>(`/homepage/images/${imageId}`, data);
}

export function reorderHomepageImages(imageIds: string[]) {
  return apiClient.put<{ imageIds: string[] }>('/homepage/images/order', { imageIds });
}

export function deleteHomepageImage(imageId: string) {
  return apiClient.delete(`/homepage/images/${imageId}`);
}
