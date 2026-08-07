import { z } from 'zod';

export const sortDirectionSchema = z.enum(['asc', 'desc']);

export function cursorListFields<T extends readonly [string, ...string[]]>(sortKeys: T, defaultSort: T[number], defaultDirection: 'asc' | 'desc') {
  return {
    sort: z.enum(sortKeys).optional().default(defaultSort),
    direction: sortDirectionSchema.optional().default(defaultDirection),
    cursor: z.string().max(2048).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  };
}
