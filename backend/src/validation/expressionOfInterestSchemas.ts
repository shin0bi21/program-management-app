import { z } from 'zod';

export const updateExpressionOfInterestStatusSchema = z.object({
  body: z.object({
    status: z.enum(['new', 'reviewed', 'converted', 'spam', 'contacted', 'signed_up', 'lost']),
  }),
  params: z.object({
    id: z.string().uuid('Invalid submission ID'),
  }),
});

export const expressionOfInterestIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission ID'),
  }),
});

export type UpdateExpressionOfInterestStatusInput = z.infer<typeof updateExpressionOfInterestStatusSchema.shape.body>;
