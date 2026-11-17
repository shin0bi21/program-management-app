import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import {
  createHomepageImage,
  deleteHomepageImage,
  getHomepageImageFile,
  getManagedHomepage,
  getPublicHomepageImages,
  getPublicHomepagePrograms,
  reorderHomepageImages,
  submitPublicLead,
  updateHomepageImage,
} from '../services/homepageService';
import type {
  CreateHomepageImageInput,
  ReorderHomepageImagesInput,
  UpdateHomepageImageInput,
} from '../validation/homepageSchemas';

const user = (req: Request) => (req as AuthRequest).user!;

export const handleGetPublicHomepageImages = async (_req: Request, res: Response) => {
  res.json(await getPublicHomepageImages());
};

export const handleGetPublicHomepagePrograms = async (_req: Request, res: Response) => {
  res.json(await getPublicHomepagePrograms());
};

export const handleGetManagedHomepage = async (_req: Request, res: Response) => {
  res.json(await getManagedHomepage());
};

export const handleCreateHomepageImage = async (req: Request, res: Response) => {
  res.status(201).json(await createHomepageImage(req.body as CreateHomepageImageInput, req.file, user(req)));
};

export const handleUpdateHomepageImage = async (req: Request, res: Response) => {
  res.json(await updateHomepageImage(req.params.imageId, req.body as UpdateHomepageImageInput, user(req)));
};

export const handleDeleteHomepageImage = async (req: Request, res: Response) => {
  await deleteHomepageImage(req.params.imageId);
  res.json({ id: req.params.imageId });
};

export const handleReorderHomepageImages = async (req: Request, res: Response) => {
  res.json(await reorderHomepageImages(req.body as ReorderHomepageImagesInput, user(req)));
};

export const handleGetHomepageImageFile = async (req: Request, res: Response) => {
  const variant = (req.params.variant ?? 'original') as 'original' | 'thumbnail' | 'mobile' | 'display';
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(await getHomepageImageFile(req.params.imageId, variant));
};

export const handlePublicLead = async (req: Request, res: Response) => {
  await submitPublicLead(req.body);
  res.status(201).json({ message: 'Lead submitted successfully' });
};
