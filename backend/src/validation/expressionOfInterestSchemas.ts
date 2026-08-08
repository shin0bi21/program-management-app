import { z } from 'zod';
import { cursorListFields } from './listQuerySchemas';

const expressionStatusSchema = z.enum(['new', 'reviewed', 'converted', 'spam', 'contacted', 'signed_up', 'lost']);
const commaSeparated = (schema: z.ZodType<string>) => z.preprocess(value => {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap(item => typeof item === 'string' ? item.split(',') : item);
}, z.array(schema).max(20));

export const expressionOfInterestQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(120).optional().default(''),
    statuses: commaSeparated(expressionStatusSchema),
    programIds: commaSeparated(z.string().uuid('Invalid program ID')),
    ...cursorListFields(['name', 'age', 'school', 'program', 'submittedByRole', 'createdAt', 'status'], 'createdAt', 'desc'),
  }),
});

export type ExpressionOfInterestQuery = z.infer<typeof expressionOfInterestQuerySchema.shape.query>;

export const updateExpressionOfInterestStatusSchema = z.object({
  body: z.object({
    status: expressionStatusSchema,
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
