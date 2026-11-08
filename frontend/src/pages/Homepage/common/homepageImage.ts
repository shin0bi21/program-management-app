import { apiUrl } from '../../../http/transport';

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

/**
 * Resolves API-hosted image paths for rendering while retaining the saved record fields.
 * @param image - Complete image returned by a managed or public homepage endpoint.
 * @example normalizeHomepageImage(image) // /public/ paths use the API origin; absolute URLs stay intact
 */
export function normalizeHomepageImage(image: HomepageImage): HomepageImage {
  return {
    ...image,
    imageUrl: resolveImageUrl(image.imageUrl),
    mobileUrl: resolveImageUrl(image.mobileUrl ?? image.imageUrl),
    thumbnailUrl: resolveImageUrl(image.thumbnailUrl ?? image.imageUrl),
  };
}

/**
 * Resolves a public API asset path and preserves URLs hosted elsewhere.
 * @param url - Image URL or backend-relative public asset path.
 * @example resolveImageUrl('https://cdn.example/image.webp') // unchanged
 */
function resolveImageUrl(url: string): string {
  return url.startsWith('/public/') ? apiUrl(url) : url;
}
