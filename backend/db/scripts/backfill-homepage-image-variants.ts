import { access, writeFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { sql } from '../../src/db/client';

const uploadRoot = path.resolve(process.env.UPLOAD_ROOT ?? path.join(process.cwd(), 'uploads'));
const homepageRoot = path.join(uploadRoot, 'homepage');

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const images = await sql<{ id: string; storageKey: string }[]>`
    SELECT id, storage_key
    FROM homepage_images
    WHERE storage_key IS NOT NULL
    ORDER BY created_at
  `;
  let generated = 0;
  let skipped = 0;

  for (const image of images) {
    const originalPath = path.join(homepageRoot, image.storageKey);
    const stem = path.parse(image.storageKey).name;
    const thumbnailPath = path.join(homepageRoot, `${stem}-thumbnail.webp`);
    const displayPath = path.join(homepageRoot, `${stem}-display.webp`);
    if (await exists(thumbnailPath) && await exists(displayPath)) {
      skipped += 1;
      continue;
    }
    if (!await exists(originalPath)) {
      console.warn(`Skipping ${image.id}: original file is missing`);
      skipped += 1;
      continue;
    }
    const source = sharp(originalPath, { failOn: 'warning' }).rotate();
    const [thumbnail, display] = await Promise.all([
      source.clone().resize({ width: 320, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer(),
      source.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    ]);
    await Promise.all([
      writeFile(thumbnailPath, thumbnail),
      writeFile(displayPath, display),
    ]);
    generated += 1;
  }

  console.log(`Homepage image variants: ${generated} generated, ${skipped} skipped`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
