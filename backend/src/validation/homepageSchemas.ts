import { z } from 'zod';

const imageFields = z.object({
  caption: z.string().trim().min(1, 'Caption is required').max(500),
});

export const createHomepageImageSchema = z.object({
  body: imageFields,
});

export const updateHomepageImageSchema = z.object({
  params: z.object({ imageId: z.string().uuid('Invalid image ID') }),
  body: imageFields,
});

export const homepageImageParamsSchema = z.object({
  params: z.object({ imageId: z.string().uuid('Invalid image ID') }),
});

export const homepageImageFileParamsSchema = z.object({
  params: z.object({
    imageId: z.string().uuid('Invalid image ID'),
    variant: z.enum(['thumbnail', 'mobile', 'display']),
  }),
});

export const reorderHomepageImagesSchema = z.object({
  body: z.object({
    imageIds: z
      .array(z.string().uuid('Invalid image ID'))
      .min(1)
      .max(100)
      .refine((imageIds) => new Set(imageIds).size === imageIds.length, {
        message: 'Image order cannot contain duplicates',
      }),
  }),
});

export const updateHomepageSignupSchema = z.object({
  body: z.object({
    enabled: z.boolean(),
  }).strict(),
});

export type CreateHomepageImageInput = z.infer<typeof createHomepageImageSchema.shape.body>;
export type UpdateHomepageImageInput = z.infer<typeof updateHomepageImageSchema.shape.body>;
export type ReorderHomepageImagesInput = z.infer<typeof reorderHomepageImagesSchema.shape.body>;
export type UpdateHomepageSignupInput = z.infer<typeof updateHomepageSignupSchema.shape.body>;
