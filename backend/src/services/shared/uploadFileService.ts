import { mkdir, rename, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

/** A file moved aside until its owning database mutation commits or rolls back. */
export interface QuarantinedUpload {
  originalPath: string;
  quarantinePath: string;
}

export async function quarantineUpload(filePath: string): Promise<QuarantinedUpload | null> {
  const quarantineRoot = path.join(path.dirname(filePath), '.trash');
  const quarantinePath = path.join(quarantineRoot, `${randomUUID()}-${path.basename(filePath)}`);
  await mkdir(quarantineRoot, { recursive: true });
  try {
    await rename(filePath, quarantinePath);
    return { originalPath: filePath, quarantinePath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function restoreQuarantinedUpload(file: QuarantinedUpload | null) {
  if (!file) return;
  await rename(file.quarantinePath, file.originalPath);
}

export async function finalizeQuarantinedUpload(file: QuarantinedUpload | null) {
  if (!file) return;
  try {
    await unlink(file.quarantinePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[UploadCleanup]', error);
    }
  }
}
