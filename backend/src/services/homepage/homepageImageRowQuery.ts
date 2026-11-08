import { sql } from '../../db/client';
import type { HomepageImages } from '../../types/database';
import type { DbRow } from '../../types/db';

export type HomepageImageRow = DbRow<Pick<HomepageImages,
  'id' | 'alt_text' | 'caption' | 'display_order' | 'created_at' | 'updated_at'
>> & {
  imageUrl: string;
  mobileUrl: string;
  thumbnailUrl: string;
};

export const homepageImageRowColumns = sql`
  image.id,
  image.alt_text,
  image.caption,
  image.display_order,
  image.created_at,
  image.updated_at,

  ${imageVariantUrlSql('display')} AS image_url,
  ${imageVariantUrlSql('mobile')} AS mobile_url,
  ${imageVariantUrlSql('thumbnail')} AS thumbnail_url
`;

/**
 * Builds complete homepage image rows for public lists, management, and save responses.
 * @param appliedFilters - SQL conditions using the image alias.
 * @param query - Database client; pass trx to read inside an existing transaction.
 * @example getHomepageImageRows(sql`image.id = ${imageId}`) // complete saved image
 */
export function getHomepageImageRows(appliedFilters = sql`TRUE`, query = sql) {
  return query<HomepageImageRow[]>`
    SELECT ${homepageImageRowColumns}
    FROM homepage_images image
    WHERE ${appliedFilters}
  `;
}

/**
 * Supplies a variant URL for a seeded public asset or an uploaded image.
 * @param variant - Generated WebP size to link; display is the main image URL.
 * @example imageVariantUrlSql('mobile') // public asset suffix or uploaded-image route
 */
function imageVariantUrlSql(variant: 'thumbnail' | 'mobile' | 'display') {
  return sql`
    CASE
      WHEN image.public_path IS NOT NULL THEN regexp_replace(
        image.public_path,
        '[.][^./]+$',
        ${`-${variant}.webp`}
      )
      ELSE '/public/homepage/images/' || image.id::text || '/' || ${variant}
    END
  `;
}
